// O'yinlar — turn the course question banks (src/data/problems generators) into 4-choice game questions.
// Pure functions (seedable RNG) so they are unit-tested: no repeats in a round, every question belongs to
// one of the requested skills, the right answer is always among the choices, and no distractor is also
// accepted by the same mathjs checker the lessons use (src/lib/learning/checker.ts).
// Subject framework hook: when feat/subjects is merged, pass that course's skill ids + its own generator
// table via `bank` — nothing here is math-specific except the default bank.
import { GENERATORS, type Problem, type Rng } from "@/data/problems";
import { checkAnswer } from "@/lib/learning/checker";
import type { Expect } from "@/lib/ai/schema";
import { uzText } from "./scenes";

export interface GameQuestion {
  id: string;
  skillId: string;
  q: string;
  hint: string;
  /** exactly 4 (or fewer only if the bank cannot make more) */
  choices: string[];
  /** index of the right choice (games react instantly; the server re-checks with mathjs) */
  correct: number;
  /** the original check, sent back to /api/games/answer */
  expect: Expect;
}

export type Bank = Record<string, ((r: Rng) => Omit<Problem, "skillId" | "key">)[]>;

const shuffle = <T,>(r: Rng, xs: T[]): T[] => {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const gcd = (a: number, b: number): number => (b === 0 ? Math.abs(a) : gcd(b, a % b));
const fmt = (n: number) => String(Math.round(n * 1000) / 1000);

/** Plausible wrong answers for a numeric / fraction / expression answer (filtered by the checker later). */
export function distractorCandidates(answer: string, r: Rng): string[] {
  const a = answer.trim();
  const fm = a.match(/^(-?\d+)\s*\/\s*(\d+)$/);
  if (fm) {
    const n = Number(fm[1]), d = Number(fm[2]);
    const cands: [number, number][] = [
      [n + 1, d], [n, d + 1], [d, n], [n * 2, d], [Math.max(1, n - 1), d], [n, Math.max(2, d - 1)], [n + d, d], [n, d * 2], [n + 2, d + 1],
    ];
    return shuffle(r, cands)
      .filter(([x, y]) => y > 0 && x !== 0)
      .map(([x, y]) => {
        const g = gcd(x, y);
        return y / g === 1 ? `${x / g}` : `${x / g}/${y / g}`;
      });
  }
  const nm = a.replace(",", ".").match(/^(-?\d+(?:\.\d+)?)$/);
  if (nm) {
    const v = Number(nm[1]);
    const dec = nm[1].includes(".");
    const step = dec ? (nm[1].split(".")[1].length === 1 ? 0.1 : 0.01) : 1;
    const big = Math.abs(v) >= 20 ? 10 : 2;
    const raw = [v + step, v - step, v + big * step, v - big * step, v * 10, v / 10, v + 2 * step, -v, v * 2];
    const keepSign = v >= 0;
    return shuffle(r, raw)
      .filter((x) => Number.isFinite(x) && (!keepSign || x >= 0))
      .filter((x) => dec || Number.isInteger(x))
      .map((x) => (dec ? fmt(x).replace(".", ",") : fmt(x)))
      .map((s) => (a.includes(",") || !dec ? s : s.replace(",", ".")));
  }
  // expressions like "5x + 3", "x = 4": nudge the numbers in it
  const nums = [...a.matchAll(/\d+/g)];
  if (!nums.length) return [];
  const out: string[] = [];
  for (const delta of [1, -1, 2, 3]) {
    const m = nums[Math.floor(r() * nums.length)];
    const nv = Math.max(0, Number(m[0]) + delta);
    out.push(a.slice(0, m.index) + nv + a.slice((m.index ?? 0) + m[0].length));
  }
  if (a.includes("+")) out.push(a.replace("+", "−"));
  return out;
}

/** One generated problem → a 4-choice question, or null if we cannot make ≥ 3 honest choices. */
export function toChoiceQuestion(p: Omit<Problem, "key"> & { key?: string }, r: Rng, id: string): GameQuestion | null {
  const ex = p.expect;
  let right: string;
  let wrong: string[];
  if (ex.kind === "choice" && ex.choices?.length) {
    right = ex.answer;
    wrong = ex.choices.filter((c) => c !== ex.answer);
  } else {
    right = ex.answer;
    wrong = distractorCandidates(ex.answer, r);
  }
  const seen = new Set([uzText(right).replace(/\s+/g, "")]);
  const picked: string[] = [];
  for (const w of wrong) {
    const k = uzText(w).replace(/\s+/g, "");
    if (seen.has(k)) continue;
    if (checkAnswer(ex, w).correct) continue; // e.g. 2/4 vs 1/2 — would be "right" too
    seen.add(k);
    picked.push(w);
    if (picked.length === 3) break;
  }
  if (picked.length < 1) return null; // some bank questions are 2-way ("which is bigger?")
  // G5: what the learner sees uses the Uzbek decimal comma (2,5). The server checker accepts both, and
  // `expect` stays as the bank wrote it, so the right choice is still re-checked correctly.
  const choices = shuffle(r, [right, ...picked]).map(uzText);
  return { id, skillId: p.skillId, q: uzText(p.q), hint: uzText(p.hint), choices, correct: choices.indexOf(uzText(right)), expect: ex };
}

/**
 * Pick `n` questions for the given skills: round-robin over the skills (so a mixed round covers all of
 * them), no repeated question text, `maxLen` prefers short questions (speed round).
 */
export function pickQuestions(opts: { skillIds: string[]; n: number; rng?: Rng; maxLen?: number; bank?: Bank }): GameQuestion[] {
  const r = opts.rng ?? Math.random;
  const bank = opts.bank ?? GENERATORS;
  const skills = opts.skillIds.filter((id) => bank[id]?.length);
  if (!skills.length) return [];
  const out: GameQuestion[] = [];
  const seenQ = new Set<string>();
  let tries = 0;
  const maxTries = opts.n * 40;
  while (out.length < opts.n && tries < maxTries) {
    const skillId = skills[(out.length + Math.floor(tries / 20)) % skills.length];
    tries++;
    const gens = bank[skillId];
    const g = gens[Math.floor(r() * gens.length)];
    const raw = g(r);
    if (seenQ.has(raw.q)) continue;
    // long word problems are fine late in the search, but the speed round wants short ones first
    if (opts.maxLen && raw.q.length > opts.maxLen && tries < maxTries / 2) continue;
    const gq = toChoiceQuestion({ ...raw, skillId }, r, `${skillId}#${out.length}`);
    if (!gq) continue;
    seenQ.add(raw.q);
    out.push(gq);
  }
  return out;
}
