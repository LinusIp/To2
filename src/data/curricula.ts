// Subject registry for the personal path / mind map / course towns (src/lib/learning/path.ts).
// The Fizika and Ingliz tili skill graphs are byte-identical copies of the files on feat/subjects-2
// (src/data/skills.fizika.uz.json) and feat/languages (src/config/courses/english/skills.json), so the merge is clean.
import { SKILLS, type Skill } from "./skills";
import fizikaRaw from "./skills.fizika.uz.json";
import englishRaw from "@/config/courses/english/skills.json";
import type { Curriculum } from "@/lib/learning/path";

export const CURRICULA: Record<string, Curriculum> = {
  matematika: { id: "matematika", title: "Matematika", skills: SKILLS },
  fizika: { id: "fizika", title: "Fizika", skills: fizikaRaw as Skill[] },
  ingliz: { id: "ingliz", title: "Ingliz tili", skills: englishRaw as Skill[] },
};

export const DEFAULT_CURRICULUM = "matematika";

export function getCurriculum(id?: string | null): Curriculum {
  return (id && CURRICULA[id]) || CURRICULA[DEFAULT_CURRICULUM];
}
