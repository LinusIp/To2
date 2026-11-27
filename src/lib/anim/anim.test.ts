import { describe, expect, it } from "vitest";
import { clampDt, envelope, follow, springStep, MAX_DT } from "./spring";
import { MIN_HOLD_MS, REST_AFTER_MS, levelFor, newMouth, stepMouth } from "./mouth";
import { BLINK_MS, forceBlink, newBlink, stepBlink } from "./blink";

describe("smoothing", () => {
  it("clampDt caps big frame gaps and ignores negative ones", () => {
    expect(clampDt(0.016)).toBeCloseTo(0.016);
    expect(clampDt(2)).toBe(MAX_DT);
    expect(clampDt(-1)).toBe(0);
  });

  it("follow is frame-rate independent", () => {
    let a = 0;
    for (let i = 0; i < 60; i++) a = follow(a, 1, 10, 1 / 60);
    let b = 0;
    for (let i = 0; i < 30; i++) b = follow(b, 1, 10, 1 / 30);
    expect(a).toBeCloseTo(b, 6);
    expect(a).toBeCloseTo(1 - Math.exp(-10), 6);
  });

  it("critically damped spring reaches the target without overshoot, at any dt", () => {
    for (const dt of [1 / 240, 1 / 60, 1 / 30]) {
      const s = new Float64Array([0]);
      const v = new Float64Array([0]);
      let max = 0;
      for (let t = 0; t < 2; t += dt) {
        springStep(s, v, 0, 1, 14, dt);
        max = Math.max(max, s[0]);
      }
      expect(max).toBeLessThanOrEqual(1 + 1e-9);
      expect(s[0]).toBeGreaterThan(0.999);
    }
  });

  it("spring step size does not change the trajectory (closed form)", () => {
    const run = (dt: number) => {
      const s = new Float64Array([0]);
      const v = new Float64Array([3]);
      for (let t = 0; t < 0.5 - 1e-9; t += dt) springStep(s, v, 0, 1, 22, dt);
      return s[0];
    };
    expect(run(1 / 120)).toBeCloseTo(run(1 / 30), 6);
  });

  it("a stiffer spring settles faster", () => {
    const after = (k: number) => {
      const s = new Float64Array([0]);
      const v = new Float64Array([0]);
      for (let i = 0; i < 6; i++) springStep(s, v, 0, 1, k, 1 / 60);
      return s[0];
    };
    expect(after(22)).toBeGreaterThan(after(14));
    expect(after(14)).toBeGreaterThan(after(8));
  });

  it("envelope: fast attack, slow release", () => {
    const up = envelope(0, 1, 25, 25, 90);
    const down = 1 - envelope(1, 0, 25, 25, 90);
    expect(up).toBeCloseTo(1 - Math.exp(-1), 5);
    expect(down).toBeLessThan(up);
  });
});

describe("mouth hysteresis", () => {
  it("uses different thresholds going up and down", () => {
    expect(levelFor(0.13, 0)).toBe(1);
    expect(levelFor(0.1, 1)).toBe(1); // between down 0.08 and up 0.12: stays
    expect(levelFor(0.07, 1)).toBe(0);
    expect(levelFor(0.6, 0)).toBe(3);
    expect(levelFor(0.5, 3)).toBe(3);
    expect(levelFor(0.44, 3)).toBe(2);
  });

  // noisy speech: random amplitude every frame, with pauses
  function simulate(seed: number, fps: number, instant = false) {
    let r = seed;
    const rand = () => ((r = (r * 1103515245 + 12345) % 2147483648) / 2147483648);
    const m = newMouth();
    const frames: { f: number; t: number }[] = [];
    const dt = 1000 / fps;
    for (let t = 0; t < 8000; t += dt) {
      const speaking = t % 2500 < 2000;
      const amp = speaking ? (rand() < 0.2 ? 0 : rand()) : 0;
      const f = stepMouth(m, t, dt, speaking, amp, instant);
      if (!frames.length || frames[frames.length - 1].f !== f) frames.push({ f, t });
    }
    return frames;
  }

  it("never shows a mouth frame for less than 60 ms (noisy input, 60 and 144 fps)", () => {
    for (const fps of [60, 144]) {
      for (const seed of [1, 7, 42]) {
        const fr = simulate(seed, fps);
        expect(fr.length).toBeGreaterThan(10); // it does move
        for (let i = 1; i < fr.length; i++) expect(fr[i].t - fr[i - 1].t).toBeGreaterThanOrEqual(MIN_HOLD_MS - 1e-6);
      }
    }
  });

  it("goes to the rest face after 120 ms of silence, not before", () => {
    const m = newMouth();
    let t = 0;
    for (; t < 500; t += 16) stepMouth(m, t, 16, true, 0.7);
    expect(m.frame).toBe(3);
    const stop = t;
    let restAt = -1;
    for (; t < stop + 600; t += 16) {
      if (stepMouth(m, t, 16, false, 0) === -1 && restAt < 0) restAt = t;
    }
    expect(restAt - stop).toBeGreaterThanOrEqual(REST_AFTER_MS);
    expect(restAt - stop).toBeLessThan(REST_AFTER_MS + MIN_HOLD_MS + 1); // may wait out the last frame's 60 ms hold
  });

  it("reduced motion: instant frames (no hold)", () => {
    const m = newMouth();
    stepMouth(m, 0, 16, true, 0.7, true);
    expect(m.frame).toBe(3);
    stepMouth(m, 16, 16, true, 0.15, true);
    expect(m.frame).toBe(1);
  });
});

describe("blink", () => {
  // Seeded (mulberry32): with Math.random the double-blink ratio (~160 blinks, p = 0.15) sat only
  // ~2.5 σ inside the bounds and failed about 1 run in 100 (a release run on 9fbd1e1). Three fixed
  // seeds keep it a real statistics check, but deterministic.
  const seeded = (seed: number) => () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let x = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };

  it.each([1, 7, 42])("blinks every 2.5–5 s for 110 ms; doubles are rare (seed %i)", (seed) => {
    const rand = seeded(seed);
    const b = newBlink();
    let starts = 0;
    let doubles = 0;
    let closedMs = 0;
    let prev = false;
    let lastStart = -1;
    const gaps: number[] = [];
    for (let t = 0; t < 600_000; t += 10) {
      const c = stepBlink(b, t, rand);
      if (c) closedMs += 10;
      if (c && !prev) {
        // gaps are measured between the FIRST blinks of each pair
        if (lastStart >= 0 && t - lastStart < 400) doubles++;
        else {
          if (lastStart >= 0) gaps.push(t - lastStart);
          lastStart = t;
        }
        starts++;
      }
      prev = c;
    }
    const singles = starts - doubles;
    expect(Math.min(...gaps)).toBeGreaterThanOrEqual(2400);
    expect(Math.max(...gaps)).toBeLessThanOrEqual(5300);
    expect(doubles / singles).toBeGreaterThan(0.08);
    expect(doubles / singles).toBeLessThan(0.22);
    expect(closedMs / starts).toBeGreaterThan(BLINK_MS * 0.8);
    expect(closedMs / starts).toBeLessThan(BLINK_MS * 1.2);
  });

  it("forceBlink closes the eyes right away", () => {
    const b = newBlink();
    stepBlink(b, 0, () => 0.5);
    expect(stepBlink(b, 100, () => 0.5)).toBe(false);
    forceBlink(b, 100);
    expect(stepBlink(b, 101, () => 0.5)).toBe(true);
  });
});
