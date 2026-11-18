// Pinned English demo lesson "To be: am / is / are" (grade 5). Explained in Uzbek, examples on the
// board in English. `say` writes the few English words the way the Uzbek voice reads them correctly
// ("ay em" = I am, "iz" = is) — the board shows the real spelling. Answers are "choice" (exact match).
import type { LessonSegment } from "@/lib/ai/schema";

export const EN_TO_BE: LessonSegment[] = [
  {
    id: "b1",
    type: "explain",
    emotion: "happy",
    say: "Salom! Bugun ingliz tilidan eng muhim fe'lni o'rganamiz. Tu bi, ya'ni bo'lmoq!",
    board: [{ op: "write", id: "tobe", x: 60, y: 70, text: "to be = bo'lmoq", size: "m", color: "yellow" }],
  },
  {
    id: "b2",
    type: "explain",
    emotion: "neutral",
    say: "Uning hozirgi zamonda uchta shakli bor. Em, iz va ar.",
    board: [
      { op: "write", id: "am", x: 60, y: 170, text: "am", size: "m", color: "blue" },
      { op: "write", id: "is", x: 220, y: 170, text: "is", size: "m", color: "red" },
      { op: "write", id: "are", x: 360, y: 170, text: "are", size: "m", color: "green" },
    ],
  },
  {
    id: "b3",
    type: "explain",
    emotion: "thinking",
    say: "Hmm… qaysi birini qachon aytamiz? Men, ya'ni ay, bilan faqat em keladi.",
    board: [
      { op: "write", id: "iam", x: 60, y: 260, text: "I am", size: "m", color: "blue" },
      { op: "write", id: "iamuz", x: 260, y: 268, text: "men ...man", size: "s" },
    ],
  },
  {
    id: "b4",
    type: "explain",
    emotion: "neutral",
    say: "U, ya'ni hi, shi yoki it bilan iz. Biz, siz va ular bilan esa ar.",
    board: [
      { op: "write", id: "heis", x: 60, y: 340, text: "he / she / it is", size: "m", color: "red" },
      { op: "write", id: "weare", x: 60, y: 420, text: "we / you / they are", size: "m", color: "green" },
    ],
  },
  {
    id: "b5",
    type: "ask",
    emotion: "encouraging",
    say: "Qani, sen tanla! Shi, bo'sh joy, e ticher. Bo'sh joyga qaysi so'z keladi?",
    board: [{ op: "write", id: "q1", x: 60, y: 510, text: "She ___ a teacher.", size: "m", color: "yellow" }],
    expect: { kind: "choice", answer: "is", choices: ["am", "is", "are"], prompt: "She ___ a teacher." },
  },
  {
    id: "b6",
    type: "praise",
    emotion: "excited",
    say: "Barakalla, iz! Shi iz e ticher. U o'qituvchi.",
    board: [
      { op: "write", id: "q1", x: 60, y: 510, text: "She is a teacher.", size: "m", color: "green" },
      { op: "tick", id: "ok1", x: 500, y: 525, color: "green" },
    ],
  },
  {
    id: "b7",
    type: "explain",
    emotion: "neutral",
    say: "Endi qisqa shakli! Ay em, qisqasi aym. Hi iz, qisqasi hiz.",
    board: [
      { op: "write", id: "c1", x: 620, y: 170, text: "I am = I'm", size: "s" },
      { op: "write", id: "c2", x: 620, y: 225, text: "he is = he's", size: "s" },
      { op: "write", id: "c3", x: 620, y: 280, text: "they are = they're", size: "s" },
    ],
  },
  {
    id: "b8",
    type: "ask",
    emotion: "encouraging",
    say: "Endi o'zing sinab ko'r! Vi, bo'sh joy, frendz. Qaysi so'z keladi?",
    board: [{ op: "write", id: "q2", x: 620, y: 520, text: "We ___ friends.", size: "s", color: "yellow" }],
    expect: { kind: "choice", answer: "are", choices: ["am", "is", "are"], prompt: "We ___ friends." },
  },
  {
    id: "b9",
    type: "praise",
    emotion: "happy",
    say: "Zo'r! Vi ar frendz, ya'ni biz do'stmiz. Sen tu bi fe'lini o'rganding!",
    board: [{ op: "write", id: "q2", x: 620, y: 520, text: "We are friends.", size: "s", color: "green" }],
  },
];
