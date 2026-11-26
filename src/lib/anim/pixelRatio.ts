// Adaptive pixel ratio for the 3D tutor canvas (REPORT.md "Lesson smoothness").
// The canvas covers the whole stage, so its pixel count is the main GPU/CPU cost of a frame.
// Start at min(cap, devicePixelRatio); step DOWN when the frame rate stays low, back UP only after
// a long stretch with headroom. Hysteresis (50 vs 57 fps), hold times and a cooldown after every
// change stop it from flickering between two sizes. Pure + allocation-free; unit-tested.

export const DPR_CAP = 1.5;
export const DPR_MIN = 0.75;
const STEP = 0.25;
const LOW_FPS = 50; // under this for DOWN_HOLD_MS → step down
const HIGH_FPS = 57; // over this for UP_HOLD_MS → step up
const DOWN_HOLD_MS = 1500;
const UP_HOLD_MS = 4000;
const COOLDOWN_MS = 2500; // after any change: let the new size settle before judging it

export interface DprState {
  ratio: number;
  /** the most it may go back up to: min(cap, device pixel ratio) */
  max: number;
  /** smoothed frame time, ms */
  ft: number;
  low: number; // ms spent under LOW_FPS
  high: number; // ms spent over HIGH_FPS
  cool: number; // ms of cooldown left
}

export function newDpr(devicePixelRatio: number, cap = DPR_CAP): DprState {
  const max = Math.max(DPR_MIN, Math.min(cap, devicePixelRatio || 1));
  return { ratio: max, max, ft: 1000 / 60, low: 0, high: 0, cool: COOLDOWN_MS };
}

/** Forget the timers (e.g. after the tab was hidden: those frame gaps say nothing about speed). */
export function resetDpr(s: DprState) {
  s.ft = 1000 / 60;
  s.low = s.high = 0;
  s.cool = COOLDOWN_MS;
}

/** Feed one frame's duration (ms). Returns true when `s.ratio` changed (resize the canvas). */
export function stepDpr(s: DprState, frameMs: number): boolean {
  if (!(frameMs > 0)) return false;
  const f = Math.min(frameMs, 250); // one huge hitch must not dominate
  s.ft += (f - s.ft) * 0.1; // ~10-frame smoothing
  const fps = 1000 / s.ft;
  if (s.cool > 0) {
    s.cool -= f;
    return false;
  }
  s.low = fps < LOW_FPS ? s.low + f : 0;
  s.high = fps > HIGH_FPS ? s.high + f : 0;
  let next = s.ratio;
  if (s.low >= DOWN_HOLD_MS && s.ratio > DPR_MIN) next = Math.max(DPR_MIN, s.ratio - STEP);
  else if (s.high >= UP_HOLD_MS && s.ratio < s.max) next = Math.min(s.max, s.ratio + STEP);
  if (next === s.ratio) return false;
  s.ratio = next;
  s.low = s.high = 0;
  s.cool = COOLDOWN_MS;
  return true;
}
