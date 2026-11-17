// Mouth amplitude (0..1) shared between the audio player and the character, read every frame by
// the tutor animator (src/lib/anim/mouth.ts turns it into mouth frames with attack/release,
// hysteresis, a 60 ms minimum frame and the rest face after 120 ms of silence).
//
// Source of the amplitude — always the audio that is actually playing, never a timer or the text:
//   1. "envelope": the per-clip envelope the server sends with the WAV (x-tts-env, 20 ms steps,
//      normalised per clip), sampled at audio.currentTime + LEAD_MS (45 ms) → the mouth leads, never lags;
//   2. "analyser": a live Web Audio AnalyserNode on the <audio> element (no envelope available);
//   3. no audio for a line (captions only: v2 not ready / budget / muted) → a mouth envelope made from
//      the caption text (vowels open, consonants small, pauses at punctuation) over the caption's
//      duration, so the tutor still visibly talks (team rule, 18 Nov).
import { envelopeAt } from "./envelope";

export const mouth = { amp: 0, speaking: false, source: "none" as "envelope" | "analyser" | "text" | "none" };

/** how far the mouth leads the audio */
// 30 ms lead + ~15 ms to cover the 25 ms attack smoothing: measured on all 3 tutors' greetings the
// mouth then never opens after the sound (worst +5 ms), typically 30–65 ms before it (REPORT.md)
export const LEAD_MS = 45;

let ctx: AudioContext | null = null;
let analyser: AnalyserNode | null = null;
let data: Uint8Array<ArrayBuffer> | null = null;
let raf = 0;

/** Connect an <audio> element once (must be called after a user gesture on iOS). */
export function attachAnalyser(el: HTMLAudioElement) {
  if (analyser || typeof window === "undefined") return;
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new AC();
    const src = ctx.createMediaElementSource(el);
    analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    data = new Uint8Array(new ArrayBuffer(analyser.fftSize));
    src.connect(analyser);
    analyser.connect(ctx.destination);
  } catch (e) {
    console.warn("[lipsync] analyser unavailable", e);
    analyser = null;
  }
}

export function resumeAudioContext() {
  if (ctx && ctx.state === "suspended") void ctx.resume();
}

/** Live level of what the speakers play right now (0..1), or -1 without an analyser. */
function liveLevel(): number {
  if (!analyser || !data) return -1;
  analyser.getByteTimeDomainData(data);
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    const v = (data[i] - 128) / 128;
    sum += v * v;
  }
  return Math.min(1, Math.sqrt(sum / data.length) * 4.5);
}

// ── dev-only debug trace for /dev/tutor (ring buffer, ~4 s at 60 fps) ─────────────────────────
export interface LipTrace {
  t: number[]; // performance.now()
  env: number[]; // amplitude the mouth was fed
  live: number[]; // analyser level of the actual output (-1 = n/a)
}
export const lipTrace: LipTrace = { t: [], env: [], live: [] };
let tracing = false;
export function setLipTrace(on: boolean) {
  tracing = on;
  lipTrace.t.length = lipTrace.env.length = lipTrace.live.length = 0;
}

/** Start driving the mouth from `audio` (envelope if we have one, else the live analyser). */
export function startMouth(audio: HTMLAudioElement | null, envelope: Uint8Array | null = null) {
  cancelAnimationFrame(raf);
  if (!audio) {
    mouth.speaking = false;
    mouth.amp = 0;
    mouth.source = "none";
    return;
  }
  mouth.speaking = true;
  const tick = () => {
    if (!mouth.speaking) {
      mouth.amp = 0;
      return;
    }
    if (envelope && envelope.length) {
      mouth.source = "envelope";
      mouth.amp = envelopeAt(envelope, audio.currentTime, LEAD_MS * (audio.playbackRate || 1));
    } else {
      mouth.source = "analyser";
      const l = liveLevel();
      mouth.amp = l < 0 ? 0 : l;
    }
    if (tracing) {
      lipTrace.t.push(performance.now());
      lipTrace.env.push(mouth.amp);
      lipTrace.live.push(mouth.source === "analyser" ? mouth.amp : liveLevel());
      if (lipTrace.t.length > 240) {
        lipTrace.t.shift();
        lipTrace.env.shift();
        lipTrace.live.shift();
      }
    }
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
}

/** Envelope (20 ms steps, 0..255) from caption text spread over `durationMs`: for captions-only lines. */
export function textEnvelope(text: string, durationMs: number): Uint8Array {
  const n = Math.max(1, Math.round(durationMs / 20));
  const chars = [...text];
  const out = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const ch = (chars[Math.floor((i / n) * chars.length)] ?? " ").toLowerCase();
    out[i] = /[aeiouoʼ‘’]/.test(ch) ? 200 : /[a-zЀ-ӿ]/.test(ch) ? 70 : /[.!?…,]/.test(ch) ? 0 : 20;
  }
  return out;
}

/** Captions-only line: drive the mouth from the text envelope along the line's own clock. */
export function startTextMouth(text: string, durationMs: number, fromMs: number, rate: number) {
  cancelAnimationFrame(raf);
  const env = textEnvelope(text, durationMs);
  const t0 = performance.now();
  mouth.speaking = true;
  mouth.source = "text";
  const tick = () => {
    if (!mouth.speaking) {
      mouth.amp = 0;
      return;
    }
    const ms = fromMs + (performance.now() - t0) * rate;
    mouth.amp = envelopeAt(env, ms / 1000, 0);
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
}

export function stopMouth() {
  mouth.speaking = false;
  mouth.amp = 0;
  cancelAnimationFrame(raf);
}
