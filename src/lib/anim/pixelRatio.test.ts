import { describe, expect, it } from "vitest";
import { DPR_CAP, DPR_MIN, newDpr, resetDpr, stepDpr } from "./pixelRatio";

/** run `ms` of frames at a fixed frame time; returns the ratios it switched to */
function run(s: ReturnType<typeof newDpr>, frameMs: number, ms: number) {
  const changes: number[] = [];
  for (let t = 0; t < ms; t += frameMs) if (stepDpr(s, frameMs)) changes.push(s.ratio);
  return changes;
}

describe("adaptive pixel ratio", () => {
  it("starts at min(1.5, device pixel ratio)", () => {
    expect(newDpr(3).ratio).toBe(DPR_CAP);
    expect(newDpr(2).ratio).toBe(1.5);
    expect(newDpr(1).ratio).toBe(1);
  });

  it("stays put at 60 fps", () => {
    const s = newDpr(3);
    expect(run(s, 16.7, 20_000)).toEqual([]);
  });

  it("steps down when fps stays under ~50, one step per cooldown, never below the floor", () => {
    const s = newDpr(3);
    const ch = run(s, 40, 30_000); // 25 fps for 30 s
    expect(ch).toEqual([1.25, 1, DPR_MIN]);
    // the first step only after the cooldown (2.5 s) + 1.5 s of low fps
    const s2 = newDpr(3);
    let t = 0;
    while (!stepDpr(s2, 40)) t += 40;
    expect(t).toBeGreaterThanOrEqual(3500);
  });

  it("does not react to a short dip", () => {
    const s = newDpr(2);
    run(s, 16.7, 5000);
    expect(run(s, 40, 800)).toEqual([]); // 0.8 s at 25 fps
    expect(run(s, 16.7, 5000)).toEqual([]);
  });

  it("steps back up only after a long stretch with headroom, up to the start value", () => {
    const s = newDpr(2);
    run(s, 40, 10_000);
    expect(s.ratio).toBeLessThan(1.5);
    const up = run(s, 16, 60_000);
    expect(up.length).toBeGreaterThan(0);
    expect(s.ratio).toBe(1.5);
  });

  it("no flicker: fps hovering between the thresholds changes nothing", () => {
    const s = newDpr(2);
    run(s, 40, 6000); // one step down
    const before = s.ratio;
    // 52–56 fps: above the "down" line, below the "up" line
    const ch: number[] = [];
    for (let i = 0; i < 3000; i++) if (stepDpr(s, i % 2 ? 18.2 : 19.0)) ch.push(s.ratio);
    expect(ch).toEqual([]);
    expect(s.ratio).toBe(before);
  });

  it("alternating slow/fast frames is judged by the average, not each frame", () => {
    const s = newDpr(2);
    // 10 ms / 30 ms alternating = 20 ms average = 50 fps → borderline, but never flips back and forth
    const ch: number[] = [];
    for (let i = 0; i < 4000; i++) if (stepDpr(s, i % 2 ? 10 : 30)) ch.push(s.ratio);
    for (let i = 1; i < ch.length; i++) expect(ch[i]).toBeLessThanOrEqual(ch[i - 1]);
  });

  it("reset after a hidden tab starts a fresh cooldown", () => {
    const s = newDpr(2);
    resetDpr(s);
    expect(stepDpr(s, 200)).toBe(false);
  });
});
