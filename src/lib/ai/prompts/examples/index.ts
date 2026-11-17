// Few-shot examples for the LLM (CLAUDE.md §4: "they matter more than the prompt").
// Lesson examples reuse the hand-written demo lessons; the interrupt example is hand-written here.
import { DEMO_LESSONS } from "../../mock/lessons";
import type { LessonSegment } from "../../schema";

const compact = (segs: LessonSegment[]) => JSON.stringify(segs);

/** Fractions lesson (first 5 steps) + equation lesson (first 4) — short enough for a fast prompt. */
export const LESSON_EXAMPLE_FRACTIONS = compact(DEMO_LESSONS["frac-add-unlike"].segments.slice(0, 5));
export const LESSON_EXAMPLE_EQUATION = compact(DEMO_LESSONS["eq-two-step"].segments.slice(0, 4));
export const LESSON_EXAMPLE_PERCENT = compact(DEMO_LESSONS["pct-of-number"].segments.slice(0, 4));
export const LESSON_EXAMPLE_AREA = compact(DEMO_LESSONS["geo-area-rect"].segments.slice(0, 4));

export const INTERRUPT_EXAMPLE_Q = "Nega maxrajlarni oltiga keltirdik?";
export const INTERRUPT_EXAMPLE = JSON.stringify([
  {
    id: "n1",
    type: "explain",
    layer: "note",
    emotion: "thinking",
    say: "Hmm… yaxshi savol! Bo'laklar bir xil o'lchamda bo'lsa, ularni sanab qo'shamiz.",
    board: [
      { op: "highlight", target: "fb1", color: "orange" },
      { op: "highlight", target: "fb2", color: "orange" },
      { op: "write", id: "nq", x: 600, y: 280, text: "bir xil bo'lak = oson sanash", size: "s", color: "orange" },
    ],
  },
  {
    id: "n2",
    type: "explain",
    layer: "note",
    emotion: "neutral",
    say: "Olti, ikkiga ham, uchga ham bo'linadi. U eng kichigi. Shuning uchun ikkala kasrni oltidan birlarga aylantirdik.",
    board: [{ op: "write", id: "n6", x: 600, y: 520, text: "6 : 2 = 3   6 : 3 = 2", size: "s", color: "orange" }],
  },
  { id: "n3", type: "check", layer: "note", emotion: "encouraging", say: "Tushunarli bo'ldimi? Davom etamizmi?", board: [] },
]);
