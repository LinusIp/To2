// GET /api/practice?skillId=… → a fresh generated problem (checked later by /api/answer).
import { generateProblem } from "@/data/problems";
import { getSkill } from "@/data/skills";
import { bad, json } from "@/lib/server/session";

export async function GET(req: Request) {
  const skillId = new URL(req.url).searchParams.get("skillId") ?? "";
  const skill = getSkill(skillId);
  if (!skill) return bad("Mavzu topilmadi", 404);
  const p = generateProblem(skill.id);
  return json({ problem: { ...p, skillTitle: skill.title_uz } });
}
