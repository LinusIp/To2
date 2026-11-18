import raw from "./skills.uz.json";
import { ENGLISH_SKILLS } from "@/config/courses/english";

export interface Skill {
  id: string;
  title_uz: string;
  grade: number;
  prereqs: string[];
  section: string;
}

export const SKILLS: Skill[] = raw as Skill[];
export const SKILL_BY_ID: Record<string, Skill> = Object.fromEntries(SKILLS.map((s) => [s.id, s]));
export const SECTIONS: string[] = [...new Set(SKILLS.map((s) => s.section))];

export function getSkill(id: string): Skill | undefined {
  // English course skills (feat/languages) — lessons + practice; not part of the maths roadmap
  return SKILL_BY_ID[id] ?? ENGLISH_SKILLS.find((s) => s.id === id);
}

/** Skills that list `id` as a prerequisite. */
export function dependents(id: string): Skill[] {
  return SKILLS.filter((s) => s.prereqs.includes(id));
}

/** All transitive prerequisites of a skill. */
export function allPrereqs(id: string, acc = new Set<string>()): Set<string> {
  for (const p of SKILL_BY_ID[id]?.prereqs ?? []) {
    if (!acc.has(p)) {
      acc.add(p);
      allPrereqs(p, acc);
    }
  }
  return acc;
}
