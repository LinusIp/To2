// POST /api/games/answer → server re-check (mathjs / pair bank) → the lessons' recordAnswer (mastery + XP).
import { GameAnswerBody, gameAnswer } from "@/lib/games/answer";
import { getSkill } from "@/data/skills";
import { bad, json, userIdFor } from "@/lib/server/session";
import { recordAnswer } from "@/lib/server/repo";

export async function POST(req: Request) {
  const b = GameAnswerBody.safeParse(await req.json().catch(() => null));
  if (!b.success) return bad("So'rov noto'g'ri");
  const r = await gameAnswer(await userIdFor(req), b.data, { skillExists: (id) => !!getSkill(id), recordAnswer });
  if (!r.ok) return bad(r.error, 404);
  return json(r);
}
