// O'yinlar — scoring + combo rules (pure, unit-tested).

/** Combo multiplier from the current streak of right answers: 1–2 → ×1, 3–4 → ×2, 5+ → ×3. */
export function comboMultiplier(streak: number): 1 | 2 | 3 {
  if (streak >= 5) return 3;
  if (streak >= 3) return 2;
  return 1;
}

// ---------- Blok minorasi (Block Tower) ----------
export const TOWER_QUESTIONS = 10;

export interface TowerState {
  index: number; // questions answered
  height: number; // blocks on the tower = the score
  streak: number;
  bestStreak: number;
  correct: number;
  /** one entry per placed block: 1, 2 or 3 (a combo block counts as that many) */
  blocks: (1 | 2 | 3)[];
  done: boolean;
}

export const towerStart = (): TowerState => ({ index: 0, height: 0, streak: 0, bestStreak: 0, correct: 0, blocks: [], done: false });

export function towerAnswer(s: TowerState, right: boolean, total = TOWER_QUESTIONS): TowerState {
  if (s.done) return s;
  const index = s.index + 1;
  if (!right) return { ...s, index, streak: 0, done: index >= total };
  const streak = s.streak + 1;
  const m = comboMultiplier(streak);
  return {
    index,
    height: s.height + m,
    streak,
    bestStreak: Math.max(s.bestStreak, streak),
    correct: s.correct + 1,
    blocks: [...s.blocks, m],
    done: index >= total,
  };
}

// ---------- Tezkor hisob (60-second speed round) ----------
export const SPEED_SECONDS = 60;
/** "vaqtsiz rejim" (no timer) ends after this many questions instead */
export const SPEED_UNTIMED_QUESTIONS = 20;
export const SPEED_POINTS = 10;

export interface SpeedState {
  score: number;
  streak: number;
  bestStreak: number;
  answered: number;
  correct: number;
}

export const speedStart = (): SpeedState => ({ score: 0, streak: 0, bestStreak: 0, answered: 0, correct: 0 });

export function speedAnswer(s: SpeedState, right: boolean): SpeedState {
  if (!right) return { ...s, streak: 0, answered: s.answered + 1 };
  const streak = s.streak + 1;
  return {
    score: s.score + SPEED_POINTS * comboMultiplier(streak),
    streak,
    bestStreak: Math.max(s.bestStreak, streak),
    answered: s.answered + 1,
    correct: s.correct + 1,
  };
}

/** Tezkor hisob race: the finish flag stands at your record (or 100 m the first time); 1 point = 1 m. */
export const raceGoal = (best: number) => Math.max(100, best);
/** runner position on the track, 0…1 */
export const racePos = (score: number, goal: number) => Math.max(0, Math.min(1, score / Math.max(1, goal)));

/** Best score kept per learner + game (the larger one wins). */
export const betterScore = (prev: number | null | undefined, next: number) => Math.max(prev ?? 0, next);

// ---------- Juftini top (memory) ----------
/** Fewer flips = better: 1000 − 25 per extra flip pair beyond the perfect 6, min 100. */
export function memoryScore(pairs: number, moves: number): number {
  const extra = Math.max(0, moves - pairs);
  return Math.max(100, 1000 - extra * 25);
}
