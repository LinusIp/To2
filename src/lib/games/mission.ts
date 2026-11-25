// Kasb sinovi (career mission): a 5-step story where the learner plays a job. Each course has several jobs
// (src/data/careers.uz.json — math: quruvchi / oshpaz / do'kon sotuvchisi, physics: muhandis / mashinist /
// kran operatori, English: tur gid / kafe ofitsianti / mehmonxona administratori). Every item is a hand-written
// real-world problem with a `scene` (src/lib/games/scenes.ts) drawn and filled in as the learner answers;
// at the end the 5 solved scenes become the panels of the job's finished building.
// Questions go through the same picker as the other games (pickQuestions with a `bank`): no repeats, the
// chosen skill first, choices shuffled; answers are re-checked on the server and mastery is capped (maxP).
import raw from "@/data/careers.uz.json";
import type { Rng } from "@/data/problems";
import { pickQuestions, type Bank, type GameQuestion } from "./questions";
import { uzText, type Scene } from "./scenes";

export type Course = "math" | "physics" | "english";
export type FinaleKind = "hall" | "dome" | "shop" | "bridge" | "train" | "tower";
export interface CareerItem { id: string; skillId: string; story: string; q: string; choices: string[]; answer: string; hint: string; scene: Scene }
export interface Job { id: string; title: string; intro: string; done: string; finale: { kind: FinaleKind; sign: string }; items: CareerItem[] }
/** kept for older imports */
export type Career = Job;

export const JOBS = Object.fromEntries(Object.entries(raw as unknown as Record<Course, { jobs: Job[] }>).map(([c, v]) => [c, v.jobs])) as Record<Course, Job[]>;
export const MISSION_STEPS = 5;

/** Which course a skill belongs to: physics "fiz-…" (older "phys-…"), English "en-…", else math. */
export function courseOf(skillId: string | null | undefined): Course {
  if (skillId?.startsWith("fiz-") || skillId?.startsWith("phys-")) return "physics";
  if (skillId?.startsWith("en-")) return "english";
  return "math";
}

/**
 * Which job to play: never the one played last time (when the course has another), preferring jobs that
 * have items on the chosen skill. Pure, so replays are tested.
 */
export function pickJob(jobs: Job[], opts: { skillId?: string | null; lastJobId?: string | null; rng?: Rng } = {}): Job {
  const r = opts.rng ?? Math.random;
  const fresh = jobs.length > 1 ? jobs.filter((j) => j.id !== opts.lastJobId) : jobs;
  const withSkill = fresh.filter((j) => j.items.some((it) => it.skillId === opts.skillId));
  const pool = withSkill.length ? withSkill : fresh;
  return pool[Math.floor(r() * pool.length)];
}

/** A job's items as a question bank (one "generator" per item, grouped by skill). */
export function jobBank(job: Job): Bank {
  const bank: Bank = {};
  for (const it of job.items) {
    (bank[it.skillId] ??= []).push(() => ({ q: uzText(it.q), hint: uzText(it.hint), expect: { kind: "choice", answer: it.answer, choices: it.choices.map(uzText) } }));
  }
  return bank;
}

export interface MissionStep extends GameQuestion { story: string; scene: Scene; itemId: string }

/** 5 steps of one job: items on the chosen skill first, then the rest of that job's story (in story order). */
export function pickMission(opts: { skillId?: string | null; course?: Course; jobId?: string; lastJobId?: string | null; rng?: Rng; steps?: number }): { course: Course; job: Job; career: Job; steps: MissionStep[] } {
  const course = opts.course ?? courseOf(opts.skillId);
  const r = opts.rng ?? Math.random;
  const job = JOBS[course].find((j) => j.id === opts.jobId) ?? pickJob(JOBS[course], { skillId: opts.skillId, lastJobId: opts.lastJobId, rng: r });
  const bank = jobBank(job);
  const n = opts.steps ?? MISSION_STEPS;
  const first = opts.skillId && bank[opts.skillId] ? pickQuestions({ skillIds: [opts.skillId], n: Math.min(n, bank[opts.skillId].length), rng: r, bank }) : [];
  const seen = new Set(first.map((q) => q.q));
  const others = Object.keys(bank).filter((id) => id !== opts.skillId);
  const rest = pickQuestions({ skillIds: others, n: job.items.length, rng: r, bank }).filter((q) => !seen.has(q.q));
  const byQ = new Map(job.items.map((it, k) => [uzText(it.q), { it, k }]));
  // keep the job's story order after the chosen-skill steps
  rest.sort((a, b) => (byQ.get(a.q)?.k ?? 0) - (byQ.get(b.q)?.k ?? 0));
  const steps = [...first, ...rest].slice(0, n).map((q, i) => {
    const { it } = byQ.get(q.q)!;
    return { ...q, id: `${job.id}#${i}`, itemId: it.id, story: it.story, scene: it.scene };
  });
  return { course, job, career: job, steps };
}
