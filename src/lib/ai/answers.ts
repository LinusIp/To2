// Live (interrupt) answers: where they are written, and the lines the tutor says when no real answer
// can be given. Pure + tested (answers.test.ts).
import type { LessonSegment } from "./schema";

/** "note" = one short note on the side slate; "main" = written on the (wiped) main board */
export type AnswerDisplay = "note" | "main";

/** live LLM answers per client per hour */
export const INTERRUPT_LIMIT_PER_HOUR = 60;
/** said (cached audio) instead of an answer when the limit is reached — never a canned explanation */
export const RATE_LIMIT_LINE = "Hozir juda ko'p savol berildi, bir daqiqadan keyin qayta so'rang.";
/** said when the LLM gave no usable answer (after one retry) */
export const LLM_FAILED_LINE = "Kechirasan, hozir javob bera olmadim. Savolingni yana bir bor ber.";

const SHAPES = new Set(["rect", "circle", "ellipse", "line", "arrow", "numberline", "fractionbar", "plot", "divider", "tick"]);
/** looks like maths that needs room: an equation, an operation, a fraction */
const FORMULA = /[=+×·÷]|\d\s*[-−:/]\s*\d|\\frac/;

/**
 * Decided from the answer's FIRST segment (the LLM is asked to put everything for a board answer
 * there): more than one note, any formula or any drawing → the main board; one short note → the slate.
 * Pinned demo answers stay on the slate (they circle the lesson's own fraction bars).
 */
export function answerDisplay(first: LessonSegment, pinned = false): AnswerDisplay {
  if (pinned) return "note";
  if (first.layer === "main") return "main";
  const draws = first.board.filter((c) => c.op !== "highlight" && c.op !== "erase" && c.op !== "pause");
  const texts = draws.filter((c) => c.op === "write" || c.op === "latex");
  if (draws.some((c) => SHAPES.has(c.op) || c.op === "latex")) return "main";
  if (texts.length > 1) return "main";
  if (texts.some((c) => c.op === "write" && (FORMULA.test(c.text) || c.text.length > 50))) return "main";
  return "note";
}
