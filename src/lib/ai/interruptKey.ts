// Cache key of a live (interrupt) answer: skill + tutor + simpler + lesson step + the normalized question.
// The step is part of the key: the same question at a different step gets an answer for THAT step.
import { normalizeQuestion } from "./pinned";

export async function interruptKey(o: { skillId: string; characterId: string; simpler: boolean; step: number; question: string }): Promise<string> {
  const norm = normalizeQuestion(o.question);
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(norm));
  const h = [...new Uint8Array(d)].slice(0, 12).map((x) => x.toString(16).padStart(2, "0")).join("");
  return `int:v3:${o.skillId}:${o.characterId}:${o.simpler ? 1 : 0}:${o.step}:${h}`;
}
