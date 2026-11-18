// Cache key of a live (interrupt) answer: subject + skill + tutor + simpler + lesson step + the
// normalized question text (hashed). The step is part of the key: the same question at a different
// step gets an answer for THAT step; a different question NEVER shares a key (tested).
import { normalizeQuestion } from "./pinned";
import { getSkill } from "@/data/skills";

export async function interruptKey(o: { skillId: string; characterId: string; simpler: boolean; step: number; question: string }): Promise<string> {
  const norm = normalizeQuestion(o.question);
  const subject = getSkill(o.skillId)?.subject ?? "matematika";
  // the skill id of an "Istalgan mavzu" lesson is its topic text: hash it too (keys stay short)
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${o.skillId}
${norm}`));
  const h = [...new Uint8Array(d)].slice(0, 12).map((x) => x.toString(16).padStart(2, "0")).join("");
  const sk = o.skillId.length > 40 ? o.skillId.slice(0, 40) : o.skillId;
  return `int:v4:${subject}:${sk}:${o.characterId}:${o.simpler ? 1 : 0}:${o.step}:${h}`;
}
