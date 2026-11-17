// BKT-lite mastery model (CLAUDE.md §7). Pure functions.
export const P_START = 0.3;
export const MASTERED = 0.85;
export const IN_PROGRESS = 0.5;
export const INFERRED_PREREQ = 0.7;

export type MasteryLevel = "mastered" | "progress" | "weak";

/** Update p after one answer. Hint used → smaller gain. */
export function updateMastery(p: number, correct: boolean, hintUsed = false): number {
  const next = correct ? p + (1 - p) * (hintUsed ? 0.1 : 0.25) : p * 0.6;
  return clamp(next);
}

export function level(p: number): MasteryLevel {
  if (p >= MASTERED) return "mastered";
  if (p >= IN_PROGRESS) return "progress";
  return "weak";
}

export const clamp = (p: number) => Math.min(1, Math.max(0, Math.round(p * 1000) / 1000));

/** XP for an answer: more for first-try correct, a little for trying. */
export function xpFor(correct: boolean, hintUsed: boolean, firstTry: boolean): number {
  if (!correct) return 1;
  if (hintUsed) return 5;
  return firstTry ? 10 : 6;
}

export const XP_PER_LEVEL = 500;
export const levelFromXp = (xp: number) => Math.floor(xp / XP_PER_LEVEL) + 1;
export const xpInLevel = (xp: number) => xp % XP_PER_LEVEL;

/** Streak: same day → same; next day → +1; gap → reset to 1. Days in UTC+5 (Tashkent). */
export function nextStreak(prevStreak: number, lastActiveMs: number, nowMs: number): number {
  const day = (ms: number) => Math.floor((ms + 5 * 3600_000) / 86_400_000);
  const d = day(nowMs) - day(lastActiveMs);
  if (prevStreak <= 0) return 1;
  if (d <= 0) return prevStreak;
  if (d === 1) return prevStreak + 1;
  return 1;
}
