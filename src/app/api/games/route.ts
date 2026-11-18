// GET /api/games?game=tower|speed&skills=a,b,c → 4-choice questions from the course question banks
// (no LLM, no VoiceLab). Unknown skill ids are dropped; none left → the learner's grade-5 basics.
import { pickQuestions, type Bank } from "@/lib/games/questions";
import { GENERATORS } from "@/data/problems";
import { PHYSICS_BANK } from "@/data/questions.fizika";
import { EN_GENERATORS } from "@/config/courses/english/practice";
import { TOWER_QUESTIONS } from "@/lib/games/scoring";
import { getSkill } from "@/data/skills";
import { json, rateLimit, userIdFor } from "@/lib/server/session";

const FALLBACK = ["nat-add-sub", "nat-mul", "frac-add-like"];
/** every course's question bank: maths generators + Fizika questions + English generators */
const BANK: Bank = { ...GENERATORS, ...(PHYSICS_BANK as Bank), ...EN_GENERATORS };

export async function GET(req: Request) {
  const url = new URL(req.url);
  const game = url.searchParams.get("game") === "speed" ? "speed" : "tower";
  const ids = (url.searchParams.get("skills") ?? "").split(",").map((s) => s.trim()).filter((s) => !!getSkill(s)).slice(0, 8);
  const uid = (await userIdFor(req)) ?? req.headers.get("cf-connecting-ip") ?? "anon";
  if (!(await rateLimit(`games:${uid}`, 60))) return json({ error: "Biroz kuting" }, { status: 429 });
  const skillIds = ids.length ? ids : FALLBACK;
  const questions = game === "speed" ? pickQuestions({ skillIds, n: 40, maxLen: 28, bank: BANK }) : pickQuestions({ skillIds, n: TOWER_QUESTIONS, bank: BANK });
  return json({ game, skillIds, questions });
}
