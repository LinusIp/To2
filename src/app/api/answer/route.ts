// POST /api/answer → mathjs check → mastery update (D1) → XP/streak.
import { z } from "zod";
import { Expect } from "@/lib/ai/schema";
import { checkAnswer } from "@/lib/learning/checker";
import { level, xpFor } from "@/lib/learning/mastery";
import { getSkill } from "@/data/skills";
import { bad, json, userIdFor } from "@/lib/server/session";
import { getUser, recordAnswer } from "@/lib/server/repo";

const Body = z.object({
  skillId: z.string().max(64),
  expect: Expect,
  given: z.string().max(100),
  hintUsed: z.boolean().default(false),
  firstTry: z.boolean().default(true),
  msTaken: z.number().int().min(0).max(3_600_000).optional(),
  question: z.string().max(300).optional(),
  source: z.enum(["lesson", "practice", "diagnostic"]).default("lesson"),
});

export async function POST(req: Request) {
  const b = Body.safeParse(await req.json().catch(() => null));
  if (!b.success) return bad("So'rov noto'g'ri");
  const { skillId, expect, given, hintUsed, firstTry, msTaken, question } = b.data;
  if (!getSkill(skillId)) return bad("Mavzu topilmadi", 404);
  const res = checkAnswer(expect, given);
  if (res.unreadable) return json({ correct: false, unreadable: true, xp: 0 });
  const xp = xpFor(res.correct, hintUsed, firstTry);
  const user = await getUser(await userIdFor(req));
  if (!user) return json({ correct: res.correct, xp: 0 });
  const r = await recordAnswer({ userId: user.id, skillId, problem: { q: question, expect }, answer: given, correct: res.correct, hintUsed, xp, msTaken });
  return json({
    correct: res.correct,
    xp,
    p: r.p,
    before: r.before,
    level: level(r.p),
    becameMastered: level(r.before) !== "mastered" && level(r.p) === "mastered",
    totalXp: r.xp,
    streak: r.streak,
  });
}
