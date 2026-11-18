// The English course's part of the tutor's system prompt. tutor.uz.ts (persona + segment/board
// spec) stays the owner of the full prompt; the main agent inserts courseFlavourPrompt() there.
import type { Course, CourseSkill } from "./types";

/** The subject block: who the tutor is, what must be exact, terms, board use, extra rules, allowed ops. */
export function courseFlavourPrompt(course: Course): string {
  const f = course.flavour;
  return [
    `Fan: ${course.name}. Sen ${f.teacher}san.`,
    `- ${f.exact}`,
    `- To'g'ri o'zbek atamalari: ${f.terms}.`,
    `- ${f.board}`,
    ...f.rules.map((r) => `- ${r}`),
    `- Savol ${f.scope} aloqasiz bo'lsa: bitta do'stona gap bilan darsga qaytar.`,
    `- Doskada FAQAT shu buyruqlar: ${course.boardOps.join(", ")}.`,
    `- Dars ${f.length} segmentdan iborat.`,
  ].join("\n");
}

/** The user message for a lesson on one skill of the course. */
export function courseLessonRequest(course: Course, skill: CourseSkill, grade: number): string {
  return `Fan: ${course.name}. Mavzu: ${skill.title_uz} (${skill.section}, ${skill.grade}-sinf). O'quvchi ${grade}-sinfda. Darsni JSON massiv ko'rinishida yoz.`;
}

/** Drop board commands the course doesn't allow (an LLM may still emit e.g. a fractionbar). */
export function filterBoardOps<T extends { op: string }>(course: Course, cmds: T[]): T[] {
  const ok = new Set<string>(course.boardOps);
  return cmds.filter((c) => ok.has(c.op));
}
