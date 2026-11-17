import { describe, expect, it } from "vitest";
import { computeEnvelope, decodeEnvelope, encodeEnvelope, envelopeAt, ENV_STEP_MS } from "./envelope";
import { newMouth, stepMouth, MIN_HOLD_MS, REST_AFTER_MS } from "@/lib/anim/mouth";

/** a WAV: silence, then speech-like bursts at `level`, as segments [startMs, endMs] */
function wav(totalMs: number, bursts: [number, number][], level: number, sr = 24000) {
  const n = Math.round((totalMs / 1000) * sr);
  const buf = new ArrayBuffer(44 + n * 2);
  const v = new DataView(buf);
  const w = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  w(0, "RIFF"); v.setUint32(4, 36 + n * 2, true); w(8, "WAVE"); w(12, "fmt "); v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true);
  v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, "data"); v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) {
    const ms = (i / sr) * 1000;
    const on = bursts.some(([a, b]) => ms >= a && ms < b);
    // a 180 Hz "voice" with a slow syllable wobble
    const s = on ? level * Math.sin((2 * Math.PI * 180 * i) / sr) * (0.6 + 0.4 * Math.sin((2 * Math.PI * 4 * i) / sr)) : 0;
    v.setInt16(44 + i * 2, Math.round(s * 32767), true);
  }
  return buf;
}

/** play the envelope like the player + animator do (60 fps, envelope read 30 ms ahead) → frame changes */
function playFrames(env: Uint8Array, totalMs: number) {
  const m = newMouth();
  const changes: { t: number; f: number }[] = [];
  for (let t = 0; t < totalMs; t += 1000 / 60) {
    const amp = envelopeAt(env, t / 1000, 30);
    const f = stepMouth(m, t, 1000 / 60, true, amp);
    if (!changes.length || changes[changes.length - 1].f !== f) changes.push({ t, f });
  }
  return changes;
}

describe("lip-sync envelope", () => {
  it("one value per 20 ms, normalised per clip: a quiet voice opens the mouth as wide as a loud one", () => {
    const loud = computeEnvelope(wav(2000, [[300, 1500]], 0.8));
    const quiet = computeEnvelope(wav(2000, [[300, 1500]], 0.1));
    expect(loud.length).toBe(Math.ceil(2000 / ENV_STEP_MS));
    const peak = (e: Uint8Array) => Math.max(...e);
    expect(peak(loud)).toBe(255);
    expect(peak(quiet)).toBe(255);
    expect(Math.abs(loud[40] - quiet[40])).toBeLessThan(8); // same shape after normalising
    expect(loud[5]).toBe(0); // silence stays closed
  });

  it("round-trips through base64 (HTTP header)", () => {
    const e = computeEnvelope(wav(1000, [[100, 900]], 0.5));
    expect(decodeEnvelope(encodeEnvelope(e))).toEqual(e);
  });

  it("the mouth opens within ±40 ms of the audio onset and closes after the 120 ms rest rule", () => {
    const e = computeEnvelope(wav(3000, [[600, 1400], [2000, 2600]], 0.5));
    const ch = playFrames(e, 3000);
    const open1 = ch.find((c) => c.f > 0 && c.t > 300)!;
    expect(Math.abs(open1.t - 600)).toBeLessThanOrEqual(40);
    const open2 = ch.find((c) => c.f > 0 && c.t > 1700)!;
    expect(Math.abs(open2.t - 2000)).toBeLessThanOrEqual(40);
    // the gap 1400→2000 ms (600 ms) shows the rest face, starting ~120 ms after the speech ends
    const rest = ch.find((c) => c.f === -1 && c.t > 1400 && c.t < 2000)!;
    expect(rest).toBeTruthy();
    expect(rest.t - 1400).toBeGreaterThanOrEqual(REST_AFTER_MS - 40);
    expect(rest.t - 1400).toBeLessThanOrEqual(REST_AFTER_MS + 100);
  });

  it("no mouth frame is shown for less than 60 ms", () => {
    const e = computeEnvelope(wav(4000, [[200, 900], [950, 1600], [1700, 1750], [2000, 3500]], 0.6));
    const ch = playFrames(e, 4000);
    for (let i = 1; i < ch.length; i++) expect(ch[i].t - ch[i - 1].t).toBeGreaterThanOrEqual(MIN_HOLD_MS - 1);
  });

  it("envelopeAt leads the audio by 30 ms and is 0 outside the clip", () => {
    const e = new Uint8Array([0, 0, 255, 255]);
    expect(envelopeAt(e, 0.015, 30)).toBe(1); // 15 ms + 30 ms lead → frame 2
    expect(envelopeAt(e, 0.015, 0)).toBe(0);
    expect(envelopeAt(e, 5, 30)).toBe(0);
  });
});
