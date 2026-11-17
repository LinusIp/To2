// Amplitude envelope of a voice clip for lip-sync: one value per 20 ms, normalised per clip so
// every voice opens the mouth properly (÷ the 95th-percentile RMS of the voiced frames), as bytes.
// The server computes it from the WAV it serves (and stores it with the cached segment); the
// player reads it at audio.currentTime + 30 ms. Pure + unit-tested (envelope.test.ts).
import { parseWav } from "./wav";

export const ENV_STEP_MS = 20;
/** RMS below this (16-bit full scale = 1) counts as silence when finding the clip's level */
const SILENCE = 0.01;

export function computeEnvelope(wav: ArrayBuffer, stepMs = ENV_STEP_MS): Uint8Array {
  const p = parseWav(wav);
  if (p.bits !== 16) return new Uint8Array(0);
  const view = new DataView(p.data.buffer, p.data.byteOffset, p.data.byteLength);
  const frameBytes = 2 * p.channels;
  const n = Math.floor(p.data.byteLength / frameBytes);
  const step = Math.max(1, Math.round((p.sampleRate * stepMs) / 1000));
  const frames = Math.ceil(n / step);
  const rms = new Float32Array(frames);
  for (let f = 0; f < frames; f++) {
    let sum = 0;
    const end = Math.min(n, (f + 1) * step);
    for (let i = f * step; i < end; i++) {
      const v = view.getInt16(i * frameBytes, true) / 32768; // first channel
      sum += v * v;
    }
    rms[f] = Math.sqrt(sum / Math.max(1, end - f * step));
  }
  const voiced = Array.from(rms).filter((r) => r > SILENCE).sort((a, b) => a - b);
  const p95 = voiced.length ? voiced[Math.min(voiced.length - 1, Math.floor(voiced.length * 0.95))] : 1;
  const out = new Uint8Array(frames);
  for (let f = 0; f < frames; f++) out[f] = Math.round(Math.min(1, rms[f] / p95) * 255);
  return out;
}

/** base64 (for an HTTP header / the store) */
export function encodeEnvelope(env: Uint8Array): string {
  let s = "";
  for (let i = 0; i < env.length; i++) s += String.fromCharCode(env[i]);
  return btoa(s);
}

export function decodeEnvelope(b64: string): Uint8Array {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

/** Envelope value (0..1) to show at audio time `tSec`, leading the audio by `leadMs`. */
export function envelopeAt(env: Uint8Array, tSec: number, leadMs = 30, stepMs = ENV_STEP_MS): number {
  const i = Math.floor((tSec * 1000 + leadMs) / stepMs);
  return i >= 0 && i < env.length ? env[i] / 255 : 0;
}
