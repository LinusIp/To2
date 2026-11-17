// One set of rules for "can the learner open this lesson?", "why not?" and "what comes next?",
// used by the roadmap, home, lesson and quiz screens. Pure + unit-tested (access.test.ts).
// The statuses themselves come from buildRoadmap() (mastery + prerequisites + started lessons).
import type { Roadmap, RoadmapNode } from "./roadmap";

/** Mastered, current, next, optional and started lessons can be opened; only "locked" can't. */
export const isOpen = (n: Pick<RoadmapNode, "status">) => n.status !== "locked";

/** Why a node is locked, in Uzbek ("Avval 2-darsni tugating"), or null if it's open. */
export function lockReason(roadmap: Roadmap, node: RoadmapNode): string | null {
  if (isOpen(node)) return null;
  const b = node.lockedBy ? roadmap.nodes.find((n) => n.id === node.lockedBy) : undefined;
  if (!b) return "Avval oldingi darslarni tugating";
  return b.order > 0 ? `Avval ${b.order}-darsni tugating` : `Avval «${b.title}» darsini tugating`;
}

/**
 * The lesson to go to after finishing `afterId`: the next open, unmastered lesson on the learner's
 * path (path order), else any open unmastered lesson; null = nothing left → back to the roadmap.
 */
export function nextLesson(roadmap: Roadmap, afterId: string): string | null {
  const byId = new Map(roadmap.nodes.map((n) => [n.id, n]));
  const candidate = (id: string) => {
    const n = byId.get(id);
    return !!n && id !== afterId && isOpen(n) && n.status !== "mastered";
  };
  const i = roadmap.path.indexOf(afterId);
  const after = i >= 0 ? roadmap.path.slice(i + 1) : roadmap.path;
  const before = i >= 0 ? roadmap.path.slice(0, i) : [];
  return after.find(candidate) ?? before.find(candidate) ?? roadmap.nodes.find((n) => candidate(n.id))?.id ?? null;
}

// ── quiz ──────────────────────────────────────────────────────────────────────
export const QUIZ_LEN = 5;
export const REVIEW_LEN = 3;
export const PASS_SCORE = 0.6;
/** after this many wrong tries on one question: offer "Darsni qayta ko'rish" / "Yana urinish" */
export const OFFER_LESSON_AFTER = 2;

export type QuizResult = "first" | "retry" | "skipped";

/** first try = 1 point, correct after retries = ½, skipped = 0; returns 0..1 */
export function quizScore(results: QuizResult[]): number {
  if (!results.length) return 0;
  const pts = results.reduce((s, r) => s + (r === "first" ? 1 : r === "retry" ? 0.5 : 0), 0);
  return pts / results.length;
}

export const quizPassed = (results: QuizResult[]) => quizScore(results) >= PASS_SCORE;
