// Where a lesson (re)starts. Pure + unit-tested (resume.test.ts); used by the lesson engine.
import type { LessonSegment } from "@/lib/ai/schema";

/** 0 = from the start, n = a saved segment index (after a refresh), "explain" = the explanation step (from the quiz) */
export type StartAt = number | "explain";

/** Which segment to begin at, once enough of the lesson has streamed in (null = wait for more segments). */
export function resolveStart(main: Pick<LessonSegment, "type">[], at: StartAt, streamDone: boolean): number | null {
  if (at === 0) return main.length ? 0 : null;
  if (at === "explain") {
    // the explanation step = the first "explain" after the greeting
    const i = main.findIndex((s, k) => k >= 1 && s.type === "explain");
    if (i >= 0) return i;
    return streamDone ? (main.length ? 0 : null) : null;
  }
  if (main.length > at) return at;
  return streamDone ? (main.length ? main.length - 1 : null) : null;
}
