// Kasb sinovi (career mission): a 5-step story where the learner plays a job (math: quruvchi, physics:
// muhandis, english: tur gid). Questions are hand-written in src/data/careers.uz.json (10 per course) and
// go through the same picker as the other games (pickQuestions with a `bank`), so: no repeats, the chosen
// skill first, choices shuffled, the checker re-checks on the server, mastery capped by GAME_MAX_P.
import raw from "@/data/careers.uz.json";
import type { Rng } from "@/data/problems";
import { pickQuestions, type Bank, type GameQuestion } from "./questions";

export type Course = "math" | "physics" | "english";
export interface CareerItem { id: string; skillId: string; story: string; q: string; choices: string[]; answer: string; hint: string }
export interface Career { job: string; title: string; intro: string; done: string; items: CareerItem[] }

export const CAREERS = raw as Record<Course, Career>;
export const MISSION_STEPS = 5;

/** Which course a skill belongs to. Hook for feat/subjects: physics skills "phys-…", English "en-…". */
export function courseOf(skillId: string | null | undefined): Course {
  if (skillId?.startsWith("phys-")) return "physics";
  if (skillId?.startsWith("en-")) return "english";
  return "math";
}

/** The course's items as a question bank (one "generator" per item, grouped by skill). */
export function careerBank(course: Course): Bank {
  const bank: Bank = {};
  for (const it of CAREERS[course].items) {
    (bank[it.skillId] ??= []).push(() => ({ q: it.q, hint: it.hint, expect: { kind: "choice", answer: it.answer, choices: it.choices } }));
  }
  return bank;
}

export interface MissionStep extends GameQuestion { story: string }

/** 5 steps: items on the chosen skill first, then the rest of that course's job story. */
export function pickMission(opts: { skillId?: string | null; course?: Course; rng?: Rng; steps?: number }): { course: Course; career: Career; steps: MissionStep[] } {
  const course = opts.course ?? courseOf(opts.skillId);
  const career = CAREERS[course];
  const bank = careerBank(course);
  const n = opts.steps ?? MISSION_STEPS;
  const r = opts.rng ?? Math.random;
  const first = opts.skillId && bank[opts.skillId] ? pickQuestions({ skillIds: [opts.skillId], n: Math.min(n, bank[opts.skillId].length), rng: r, bank }) : [];
  const seen = new Set(first.map((q) => q.q));
  const others = Object.keys(bank).filter((id) => id !== opts.skillId);
  const rest = pickQuestions({ skillIds: others, n: n * 2, rng: r, bank }).filter((q) => !seen.has(q.q));
  const story = new Map(career.items.map((it) => [it.q, it.story]));
  const steps = [...first, ...rest].slice(0, n).map((q, i) => ({ ...q, id: `${course}#${i}`, story: story.get(q.q) ?? "" }));
  return { course, career, steps };
}
