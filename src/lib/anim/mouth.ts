// Lip-sync: voice amplitude → mouth frame (-1 = rest face, 0..3 = closed, small, open, wide).
// Envelope (attack 25 ms / release 90 ms) → thresholds with hysteresis → each frame held ≥ 60 ms
// → rest face after 150 ms of silence. Pure + unit-tested (mouth.test.ts).
import { envelope } from "./spring";

const UP = [0.12, 0.3, 0.55]; // go up to frame i+1 when the envelope passes UP[i]
const DOWN = [0.08, 0.22, 0.45]; // come down below frame i+1 when it drops under DOWN[i]
export const MIN_HOLD_MS = 60;
export const REST_AFTER_MS = 150;

export interface MouthState {
  env: number;
  frame: number; // -1 rest, 0..3
  since: number; // ms when the current frame started
  silentSince: number; // ms when speech stopped (or -1 while speaking)
}

export const newMouth = (): MouthState => ({ env: 0, frame: -1, since: 0, silentSince: 0 });

/** Frame the envelope asks for, given the frame we're on (hysteresis). */
export function levelFor(env: number, cur: number): number {
  let f = cur < 0 ? 0 : cur;
  while (f < 3 && env >= UP[f]) f++;
  while (f > 0 && env < DOWN[f - 1]) f--;
  return f;
}

/**
 * Advance one frame. `speaking` = audio is playing, `amp` 0..1 raw amplitude.
 * `instant` (prefers-reduced-motion): no envelope and no minimum hold.
 */
export function stepMouth(m: MouthState, now: number, dtMs: number, speaking: boolean, amp: number, instant = false): number {
  m.env = instant ? (speaking ? amp : 0) : envelope(m.env, speaking ? amp : 0, dtMs, 25, 90);
  // silence = no audio, or a pause between words
  const quiet = !speaking || m.env < 0.04;
  if (!quiet) m.silentSince = -1;
  else if (m.silentSince < 0) m.silentSince = now;

  let want: number;
  if (quiet && now - m.silentSince >= REST_AFTER_MS) want = -1;
  else want = levelFor(m.env, m.frame);

  if (want !== m.frame && (instant || now - m.since >= MIN_HOLD_MS)) {
    m.frame = want;
    m.since = now;
  }
  return m.frame;
}
