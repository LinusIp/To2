// One shared <audio> element for all tutor speech (so the Web Audio analyser is wired once).
// Falls back to a silent timer (captions still show) if TTS audio fails.
import { attachAnalyser, resumeAudioContext, startMouth, startTextMouth, stopMouth } from "./lipsync";
import { decodeEnvelope } from "./envelope";

/** blob URL of the clip playing now (revoked when the next one starts) */
let objUrl: string | null = null;

let el: HTMLAudioElement | null = null;

function audioEl(): HTMLAudioElement {
  if (!el) {
    el = new Audio();
    el.preload = "auto";
    el.crossOrigin = "anonymous";
  }
  return el;
}

/** Call from a user gesture (Start button) to unlock audio on mobile. */
export function unlockAudio() {
  const a = audioEl();
  attachAnalyser(a);
  resumeAudioContext();
  // play a tiny silent buffer to unlock iOS
  a.muted = true;
  a.src = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA=";
  void a.play().catch(() => {}).finally(() => {
    a.pause();
    a.muted = false;
  });
}

/** Tone of a line: emotion drives speed/tags server-side; lead = short "thinking" pause first. */
export interface Tone {
  emotion?: string;
  lead?: boolean;
}

export function ttsUrl(text: string, voice: string, tone: Tone = {}) {
  const em = tone.emotion && tone.emotion !== "neutral" ? `&emotion=${encodeURIComponent(tone.emotion)}` : "";
  return `/api/tts?voice=${encodeURIComponent(voice)}&text=${encodeURIComponent(text)}${em}${tone.lead ? "&lead=1" : ""}`;
}

/** A line's audio, loaded ahead (blob + its lip-sync envelope). */
export interface Clip {
  blob: Blob;
  env: Uint8Array | null;
}
/** the result of a load: a clip, "none" (the server says this line has no audio: muted/mock/cap/error) or null (not yet) */
type Load = Clip | "none" | null;

/** one request per line, shared by the prefetch and the player (no double generation) */
const inflight = new Map<string, Promise<Load>>();
function fetchClip(u: string): Promise<Load> {
  let p = inflight.get(u);
  if (!p) {
    p = fetch(u)
      .then(async (r): Promise<Load> => {
        if (r.status !== 200) return "none";
        const e = r.headers.get("x-tts-env");
        return { blob: await r.blob(), env: e ? decodeEnvelope(e) : null };
      })
      .catch((): Load => null);
    inflight.set(u, p);
    void p.then((x) => {
      if (x === null || x === "none") inflight.delete(u); // let a later attempt try again
    });
  }
  return p;
}

// wait=long: nobody is waiting on a prefetch, so the server holds out for the expressive voice (and caches it)
const longUrl = (text: string, voice: string, tone: Tone) => ttsUrl(text, voice, tone) + "&wait=long";

/** Start loading a line's audio now (the next segment, a live answer as it arrives). */
export function prefetchSpeech(text: string, voice: string, tone: Tone = {}) {
  void fetchClip(longUrl(text, voice, tone));
}

/**
 * Wait (at most `timeoutMs`) for a line's audio. A fresh expressive line takes ~11 s; the caller keeps
 * the tutor thinking (fillers) meanwhile. Resolves the clip, "none" when the server says there is no
 * audio for this line (then waiting is pointless), or null when the time ran out.
 */
export async function loadSpeech(text: string, voice: string, tone: Tone, timeoutMs: number): Promise<Load> {
  const deadline = performance.now() + timeoutMs;
  const u = longUrl(text, voice, tone);
  while (performance.now() < deadline) {
    const left = deadline - performance.now();
    const r = await Promise.race([fetchClip(u), new Promise<"timeout">((res) => setTimeout(() => res("timeout"), left))]);
    if (r === "timeout") return null;
    if (r) return r; // a clip, or "none"
    await new Promise((res) => setTimeout(res, 600)); // network error: try again shortly
  }
  return null;
}

export const estimateMs = (text: string, rate = 1) => Math.max(1200, (text.length * 62) / rate);

export interface Speech {
  /** resolves when speech has STARTED, with its duration */
  started: Promise<number>;
  /** resolves when finished (or stopped) */
  ended: Promise<void>;
  pause(): void;
  resume(): void;
  stop(): void;
  /** ms elapsed in this speech */
  position(): number;
  setRate(r: number): void;
}

/** Speak `text` with the character voice via /api/tts. `fromMs` seeks (resume after interruption). */
export function speak(text: string, voice: string, opts: { rate?: number; fromMs?: number; muted?: boolean; startTimeoutMs?: number; clip?: Clip } & Tone = {}): Speech {
  const a = audioEl();
  let rate = opts.rate ?? 1;
  let fallback = false;
  let fbStart = 0;
  let fbOffset = opts.fromMs ?? 0;
  let fbRunning = false;
  let fbTimer: ReturnType<typeof setTimeout> | null = null;
  let fbDuration = estimateMs(text);
  let done = false;
  /**
   * THIS line's audio has started playing. Must be per speech: the <audio> element is shared, so its
   * paused/currentTime still describe the PREVIOUS clip (currentTime sits at that clip's end, never 0).
   * Checking those made the start timeout never fire after the first line → a hung TTS request or
   * play() froze the tutor for good.
   */
  let playing = false;
  /** lip-sync envelope of exactly this audio (x-tts-env header), null → live analyser */
  let envelope: Uint8Array | null = null;
  const ctrl = new AbortController();
  let resolveEnded!: () => void;
  let resolveStarted!: (ms: number) => void;
  const ended = new Promise<void>((r) => (resolveEnded = r));
  const started = new Promise<number>((r) => (resolveStarted = r));

  const onError = () => startFallback();
  const onPlaying = () => {
    if (done || fallback) {
      a.pause(); // a late play() of a line that already went captions-only
      return;
    }
    playing = true;
    startMouth(a, envelope);
    const d = Number.isFinite(a.duration) ? a.duration * 1000 : estimateMs(text);
    resolveStarted(d);
  };
  const onEnded = () => finish();

  const finish = () => {
    if (done) return;
    done = true;
    stopMouth();
    // only detach our own handlers: a newer line may already own the shared element
    if (a.onended === onEnded) a.onended = null;
    if (a.onerror === onError) a.onerror = null;
    if (a.onplaying === onPlaying) a.onplaying = null;
    resolveEnded();
  };

  const startFallback = () => {
    if (done || fallback) return;
    fallback = true;
    ctrl.abort(); // stop waiting for this line's audio
    if (a.onplaying === onPlaying) a.pause();
    fbDuration = estimateMs(text, 1);
    fbStart = performance.now();
    fbRunning = true;
    startTextMouth(text, fbDuration, fbOffset, rate); // captions only: the mouth follows the caption text
    resolveStarted(fbDuration);
    const left = (fbDuration - fbOffset) / rate;
    fbTimer = setTimeout(finish, Math.max(0, left));
  };

  if (opts.muted) {
    startFallback();
  } else {
    a.onerror = onError;
    a.onplaying = onPlaying;
    a.onended = onEnded;
    a.playbackRate = rate;
    const seek = () => {
      if (opts.fromMs) a.currentTime = opts.fromMs / 1000;
    };
    // fetch (not <audio src>) so we can read the envelope header that belongs to exactly these bytes
    void (async () => {
      try {
        let blob: Blob;
        if (opts.clip) {
          // loaded ahead (loadSpeech): plays at once
          envelope = opts.clip.env;
          blob = opts.clip.blob;
        } else {
          const r = await fetch(ttsUrl(text, voice, { emotion: opts.emotion, lead: opts.lead }), { signal: ctrl.signal });
          if (done || fallback) return; // too late: this line already went captions-only
          if (r.status !== 200) return startFallback();
          const e = r.headers.get("x-tts-env");
          envelope = e ? decodeEnvelope(e) : null;
          blob = await r.blob();
        }
        if (done || fallback) return;
        if (objUrl) URL.revokeObjectURL(objUrl);
        objUrl = URL.createObjectURL(blob);
        a.onloadedmetadata = seek;
        a.src = objUrl;
        await a.play();
      } catch {
        if (!done) startFallback();
      }
    })();
    // If THIS line isn't playing within 13 s (the server waits up to 11 s for v2) — slow or hung
    // request, stuck play() — it goes captions-only. Live answers pass 4 s: never a frozen tutor.
    setTimeout(() => {
      if (!done && !fallback && !playing) startFallback();
    }, opts.startTimeoutMs ?? 13_000);
  }

  return {
    started,
    ended,
    pause() {
      if (done) return;
      stopMouth();
      if (fallback) {
        if (fbRunning) {
          fbOffset += (performance.now() - fbStart) * rate;
          fbRunning = false;
          if (fbTimer) clearTimeout(fbTimer);
        }
      } else a.pause();
    },
    resume() {
      if (done) return;
      if (fallback) {
        if (!fbRunning) {
          fbRunning = true;
          fbStart = performance.now();
          startTextMouth(text, fbDuration, fbOffset, rate);
          fbTimer = setTimeout(finish, Math.max(0, (fbDuration - fbOffset) / rate));
        }
      } else {
        startMouth(a, envelope);
        void a.play().catch(() => startFallback());
      }
    },
    stop() {
      if (fbTimer) clearTimeout(fbTimer);
      ctrl.abort();
      if (!fallback) a.pause();
      finish();
    },
    position() {
      if (fallback) return fbOffset + (fbRunning ? (performance.now() - fbStart) * rate : 0);
      return a.currentTime * 1000;
    },
    setRate(r: number) {
      if (fallback && fbRunning) {
        fbOffset += (performance.now() - fbStart) * rate;
        fbStart = performance.now();
      }
      rate = r;
      if (!fallback) a.playbackRate = r;
    },
  };
}
