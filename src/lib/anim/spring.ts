// Smoothing math for the tutor rig. Pure functions, no allocation, unit-tested (spring.test.ts).
//
// Every joint has a TARGET (set by the animation state) and a CURRENT value that follows it.
// Nothing ever writes a joint rotation directly — that is what makes the motion smooth.

/** Max frame step: after a tab switch or a long GC pause we never jump more than 1/30 s. */
export const MAX_DT = 1 / 30;

export const clampDt = (dtSeconds: number) => (dtSeconds > 0 ? (dtSeconds < MAX_DT ? dtSeconds : MAX_DT) : 0);

/** Frame-rate independent exponential follow: x += (t - x) * (1 - e^(-k·dt)). Never overshoots. */
export function follow(x: number, target: number, k: number, dt: number): number {
  return x + (target - x) * (1 - Math.exp(-k * dt));
}

/**
 * Critically damped spring, exact closed-form step (stable for any dt, never overshoots a fixed
 * target, but keeps velocity, so moving targets get smooth acceleration).
 * State is stored in `s[i]` (position) and `v[i]` (velocity) so callers allocate nothing.
 * `k` is the angular frequency ω (1/s): larger = stiffer.
 */
export function springStep(s: Float64Array, v: Float64Array, i: number, target: number, k: number, dt: number) {
  if (dt <= 0) return;
  const x0 = s[i] - target;
  const v0 = v[i];
  const e = Math.exp(-k * dt);
  const c = v0 + k * x0;
  s[i] = target + (x0 + c * dt) * e;
  v[i] = (v0 - c * k * dt) * e;
}

/** Envelope follower for the voice amplitude: fast attack, slow release (time constants in ms). */
export function envelope(env: number, input: number, dtMs: number, attackMs: number, releaseMs: number): number {
  const tau = input > env ? attackMs : releaseMs;
  return env + (input - env) * (1 - Math.exp(-dtMs / Math.max(1, tau)));
}

export const clamp = (x: number, lo: number, hi: number) => (x < lo ? lo : x > hi ? hi : x);
export const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
/** ease-in-out (smoothstep) on 0..1 */
export const easeInOut = (t: number) => {
  const u = clamp(t, 0, 1);
  return u * u * (3 - 2 * u);
};
export const DEG = Math.PI / 180;
