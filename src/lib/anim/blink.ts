// Blinks: every 2.5–5 s, 110 ms closed, 15% chance of a quick double blink; `force` blinks now
// (e.g. at the start of a turn). Random source is injectable for tests.
export const BLINK_MS = 110;
const DOUBLE_GAP_MS = 90;

export interface BlinkState {
  next: number; // when the next blink starts
  until: number; // eyes closed until
  second: number; // start of the second blink of a double (0 = none)
}

export const newBlink = (): BlinkState => ({ next: 0, until: 0, second: 0 });

export function forceBlink(b: BlinkState, now: number) {
  if (now >= b.until) b.next = now;
}

/** Returns true while the eyes are closed. */
export function stepBlink(b: BlinkState, now: number, rand: () => number = Math.random): boolean {
  if (!b.next) b.next = now + 1200 + rand() * 2500;
  if (b.second && now >= b.second) {
    b.until = b.second + BLINK_MS * 0.8;
    b.second = 0;
  }
  if (now >= b.next) {
    b.until = now + BLINK_MS;
    b.second = rand() < 0.15 ? b.until + DOUBLE_GAP_MS : 0;
    b.next = now + 2500 + rand() * 2500;
  }
  return now < b.until;
}
