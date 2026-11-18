// O'yinlar → mastery: one game answer → the SAME path the lessons use (checkAnswer → xpFor → recordAnswer,
// which runs updateMastery and adds XP/streak). Dependencies are injected so the rule is unit-tested.
//
// Decisions (REPORT.md "O'yinlar"):
//  • Only RIGHT answers are recorded. A wrong tap in a fast 4-choice game is often a slip, and recording it
//    would cut mastery by 40 % (updateMastery) — games must never push the roadmap backwards.
//  • A right answer counts as `hintUsed` (small mastery gain, 5 XP): picking from 4 choices is easier than
//    solving, so games nudge the roadmap…
//  • …but never past GAME_MAX_P (just under "mastered"): mastering a skill still needs a lesson/quiz.
import { z } from "zod";
import { Expect } from "@/lib/ai/schema";
import { checkAnswer } from "@/lib/learning/checker";
import { MASTERED, xpFor } from "@/lib/learning/mastery";
import { PAIR_BY_ID } from "./memory";

export const GAME_MAX_P = MASTERED - 0.01;

export const GAME_IDS = ["tower", "speed", "memory", "mission"] as const;
export type GameId = (typeof GAME_IDS)[number];

export const GameAnswerBody = z.union([
  z.object({ game: z.enum(GAME_IDS), kind: z.literal("q"), skillId: z.string().max(64), expect: Expect, given: z.string().max(100), question: z.string().max(300).optional(), msTaken: z.number().int().min(0).max(3_600_000).optional() }),
  z.object({ game: z.literal("memory"), kind: z.literal("pair"), pairId: z.string().max(64) }),
]);
export type GameAnswerBody = z.infer<typeof GameAnswerBody>;

export interface GameAnswerDeps {
  skillExists: (id: string) => boolean;
  recordAnswer: (o: { userId: string; skillId: string; problem: unknown; answer: string; correct: boolean; hintUsed: boolean; xp: number; msTaken?: number; maxP?: number }) => Promise<{ p: number; before: number; xp: number; streak: number }>;
}

export type GameAnswerResult = { ok: false; error: string } | { ok: true; correct: boolean; xp: number; recorded: boolean; skillId: string; p?: number; before?: number; totalXp?: number };

export async function gameAnswer(userId: string | null, body: GameAnswerBody, deps: GameAnswerDeps): Promise<GameAnswerResult> {
  let skillId: string;
  let correct: boolean;
  let problem: unknown;
  let answer: string;
  let msTaken: number | undefined;
  if (body.kind === "pair") {
    const pair = PAIR_BY_ID[body.pairId];
    if (!pair) return { ok: false, error: "Juftlik topilmadi" };
    skillId = pair.skillId;
    correct = true; // the client only reports found pairs; the id proves which skill
    problem = { game: "memory", pair: pair.label };
    answer = pair.id;
  } else {
    skillId = body.skillId;
    correct = checkAnswer(body.expect, body.given).correct;
    problem = { game: body.game, q: body.question, expect: body.expect };
    answer = body.given;
    msTaken = body.msTaken;
  }
  if (!deps.skillExists(skillId)) return { ok: false, error: "Mavzu topilmadi" };
  if (!correct) return { ok: true, correct: false, xp: 0, recorded: false, skillId };
  const xp = xpFor(true, true, true);
  if (!userId) return { ok: true, correct, xp: 0, recorded: false, skillId };
  const r = await deps.recordAnswer({ userId, skillId, problem, answer, correct: true, hintUsed: true, xp, msTaken, maxP: GAME_MAX_P });
  return { ok: true, correct: true, xp, recorded: true, skillId, p: r.p, before: r.before, totalXp: r.xp };
}
