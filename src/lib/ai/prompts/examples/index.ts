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
/** Fizika: the pinned "Tezlik" lesson (diagram → formula → units → worked example) */
export const LESSON_EXAMPLE_ENGLISH = compact(DEMO_LESSONS["en-to-be"].segments.slice(0, 6));
export const LESSON_EXAMPLE_PHYSICS = compact(DEMO_LESSONS["fiz-tezlik"].segments.slice(0, 7));
/** "Istalgan mavzu": a short non-maths lesson — keywords + a scheme, one choice question */
export const TOPIC_EXAMPLE_SEGMENTS: LessonSegment[] = [
  {
    id: "b1",
    type: "explain",
    emotion: "happy",
    say: "Salom! Bugun fotosintezni bilib olamiz. O'simlik o'zi uchun ovqatni qanday tayyorlaydi?",
    board: [{ op: "write", id: "t1", x: 60, y: 70, text: "Fotosintez", size: "m", color: "yellow" }],
  },
  {
    id: "b2",
    type: "explain",
    emotion: "neutral",
    say: "Barg quyosh nurini, suvni va karbonat angidrid gazini oladi.",
    board: [
      { op: "rect", id: "leaf", x: 380, y: 170, w: 200, h: 90, color: "green" },
      { op: "write", id: "in", x: 60, y: 190, text: "nur + suv + CO2", size: "s" },
      { op: "line", id: "a1", from: [300, 215], to: [370, 215], color: "ink", arrow: true },
    ],
  },
  {
    id: "b3",
    type: "explain",
    emotion: "excited",
    say: "Natijada shakar va kislorod hosil bo'ladi. Biz nafas oladigan kislorod shu yerdan!",
    board: [
      { op: "line", id: "a2", from: [590, 215], to: [660, 215], color: "ink", arrow: true },
      { op: "write", id: "out", x: 670, y: 190, text: "shakar + O2", size: "s", color: "green" },
    ],
  },
  {
    id: "b4",
    type: "ask",
    emotion: "encouraging",
    say: "Savol! Fotosintezda qaysi gaz ajralib chiqadi?",
    board: [{ op: "write", id: "q", x: 60, y: 330, text: "Qaysi gaz chiqadi?", size: "s", color: "yellow" }],
    expect: { kind: "choice", answer: "kislorod", choices: ["kislorod", "azot", "vodorod"] },
  },
  {
    id: "b5",
    type: "praise",
    emotion: "happy",
    say: "To'g'ri, kislorod! Barakalla, sen fotosintezni tushunding.",
    board: [{ op: "write", id: "ans", x: 60, y: 380, text: "kislorod", size: "m", color: "green" }],
  },
] as LessonSegment[];
export const LESSON_EXAMPLE_TOPIC = compact(TOPIC_EXAMPLE_SEGMENTS);

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
