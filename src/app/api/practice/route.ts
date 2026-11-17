// GET /api/practice?skillId=…[&review=1] → a fresh generated problem (checked later by /api/answer).
// review=1 = the quick review after a failed quiz: easier questions from the skill's prerequisites
// (falls back to the skill itself when it has none).
import { generateProblem } from "@/data/problems";
import { getSkill } from "@/data/skills";
import { bad, json } from "@/lib/server/session";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const skill = getSkill(url.searchParams.get("skillId") ?? "");
  if (!skill) return bad("Mavzu topilmadi", 404);
  let from = skill;
  if (url.searchParams.get("review") === "1") {
    const pre = skill.prereqs.map((id) => getSkill(id)).filter((s): s is NonNullable<typeof s> => !!s);
    if (pre.length) from = pre[Math.floor(Math.random() * pre.length)];
  }
  const p = generateProblem(from.id);
  return json({ problem: { ...p, skillTitle: from.title_uz } });
}
