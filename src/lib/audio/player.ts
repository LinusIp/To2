// One shared <audio> element for all tutor speech (so the Web Audio analyser is wired once).
// Falls back to a silent timer (captions still show) if TTS audio fails.
import { attachAnalyser, resumeAudioContext, startMouth, stopMouth } from "./lipsync";
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

const prefetched = new Set<string>();
/** Warm the HTTP cache (and the server's KV/R2 cache) for the next segment. */
export function prefetchSpeech(text: string, voice: string, tone: Tone = {}) {
  // wait=long: nobody is waiting on a prefetch, so the server holds out for the expressive voice
  // (and caches it); the real request then gets it from cache
  const u = ttsUrl(text, voice, tone) + "&wait=long";
  if (prefetched.has(u)) return;
  prefetched.add(u);
  void fetch(u).catch(() => prefetched.delete(u));
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
export function speak(text: string, voice: string, opts: { rate?: number; fromMs?: number; muted?: boolean } & Tone = {}): Speech {
  const a = audioEl();
  let rate = opts.rate ?? 1;
  let fallback = false;
  let fbStart = 0;
  let fbOffset = opts.fromMs ?? 0;
  let fbRunning = false;
  let fbTimer: ReturnType<typeof setTimeout> | null = null;
  let fbDuration = estimateMs(text);
  let done = false;
  /** lip-sync envelope of exactly this audio (x-tts-env header), null → live analyser */
  let envelope: Uint8Array | null = null;
  const ctrl = new AbortController();
  let resolveEnded!: () => void;
  let resolveStarted!: (ms: number) => void;
  const ended = new Promise<void>((r) => (resolveEnded = r));
  const started = new Promise<number>((r) => (resolveStarted = r));

  const finish = () => {
    if (done) return;
    done = true;
    stopMouth();
    a.onended = a.onerror = a.onplaying = null;
    resolveEnded();
  };

  const startFallback = () => {
    if (done || fallback) return;
    fallback = true;
    a.pause();
    fbDuration = estimateMs(text, 1);
    fbStart = performance.now();
    fbRunning = true;
    startMouth(null); // no audio → the mouth stays closed (never animated from a timer)
    resolveStarted(fbDuration);
    const left = (fbDuration - fbOffset) / rate;
    fbTimer = setTimeout(finish, Math.max(0, left));
  };

  if (opts.muted) {
    startFallback();
  } else {
    a.onerror = () => startFallback();
    a.onplaying = () => {
      if (done) return;
      startMouth(a, envelope);
      const d = Number.isFinite(a.duration) ? a.duration * 1000 : estimateMs(text);
      resolveStarted(d);
    };
    a.onended = () => finish();
    a.playbackRate = rate;
    const seek = () => {
      if (opts.fromMs) a.currentTime = opts.fromMs / 1000;
    };
    // fetch (not <audio src>) so we can read the envelope header that belongs to exactly these bytes
    void (async () => {
      try {
        const r = await fetch(ttsUrl(text, voice, { emotion: opts.emotion, lead: opts.lead }), { signal: ctrl.signal });
        if (done) return;
        if (r.status !== 200) return startFallback();
        const e = r.headers.get("x-tts-env");
        envelope = e ? decodeEnvelope(e) : null;
        const blob = await r.blob();
        if (done) return;
        if (objUrl) URL.revokeObjectURL(objUrl);
        objUrl = URL.createObjectURL(blob);
        a.onloadedmetadata = seek;
        a.src = objUrl;
        await a.play();
      } catch {
        if (!done) startFallback();
      }
    })();
    // If nothing happens within 8s (slow network / TTS down), go silent so the lesson continues.
    setTimeout(() => {
      if (!done && !fallback && a.paused && a.currentTime === 0) startFallback();
    }, 8000);
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
          startMouth(null);
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
