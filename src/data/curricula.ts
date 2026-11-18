// Subject registry for the personal path / mind map (src/lib/learning/path.ts).
// Only maths has data on this branch; other subjects add { id, title, skills } here.
import { SKILLS } from "./skills";
import type { Curriculum } from "@/lib/learning/path";

export const CURRICULA: Record<string, Curriculum> = {
  matematika: { id: "matematika", title: "Matematika", skills: SKILLS },
};

export const DEFAULT_CURRICULUM = "matematika";

export function getCurriculum(id?: string | null): Curriculum {
  return (id && CURRICULA[id]) || CURRICULA[DEFAULT_CURRICULUM];
}
