// Four hand-written demo lessons (CLAUDE.md §4, M1). They are:
//  - what the lesson player shows in MOCK_AI mode and as the instant first lesson,
//  - few-shot examples for the LLM prompt (src/lib/ai/prompts/examples),
//  - the canned fallback when the LLM output fails validation.
// Board canvas is 1000×625. `say` spells numbers in words so TTS reads them well.
import type { LessonSegment } from "../schema";

export interface DemoLesson {
  skillId: string;
  segments: LessonSegment[];
}

const fractions: LessonSegment[] = [
  {
    id: "f1",
    type: "explain",
    emotion: "happy",
    say: "Salom! Bugun maxrajlari har xil kasrlarni qo'shamiz. Bir ikkidan bir qo'shuv bir uchdan bir!",
    board: [{ op: "latex", id: "q", x: 50, y: 40, tex: "\\frac{1}{2} + \\frac{1}{3} = ?", size: "m" }],
  },
  {
    id: "f2",
    type: "explain",
    emotion: "neutral",
    say: "Keling, bloklar bilan ko'ramiz. Ko'k chiziq, bu yarmi. Pushti chiziq esa uchdan bir bo'lagi.",
    board: [
      { op: "fractionbar", id: "fb1", x: 470, y: 70, w: 470, parts: 2, filled: 1, color: "blue", label: "1/2" },
      { op: "fractionbar", id: "fb2", x: 470, y: 170, w: 470, parts: 3, filled: 1, color: "red", label: "1/3" },
    ],
  },
  {
    id: "f3",
    type: "explain",
    emotion: "thinking",
    say: "Hmm… bo'laklar har xil o'lchamda. Ularni darrov qo'shib bo'lmaydi. Bizga bir xil bloklar kerak!",
    board: [
      { op: "highlight", target: "fb1" },
      { op: "highlight", target: "fb2" },
      { op: "write", id: "note1", x: 600, y: 238, text: "bo'laklar har xil!", size: "s", color: "yellow" },
    ],
  },
  {
    id: "f4",
    type: "ask",
    emotion: "encouraging",
    say: "Qani, o'ylab ko'raylik. Ikkiga ham, uchga ham bo'linadigan eng kichik son qaysi?",
    board: [{ op: "write", id: "lcm", x: 50, y: 172, text: "EKUK (2; 3) = ?", size: "m", color: "yellow" }],
    expect: { kind: "number", answer: "6", prompt: "EKUK(2; 3) =" },
  },
  {
    id: "f5",
    type: "praise",
    emotion: "excited",
    say: "Voy, to'g'ri, olti! Endi har bir chiziqni olti bo'lakka bo'lamiz. Bloklar bir xil bo'ladi!",
    board: [
      { op: "write", id: "lcm", x: 50, y: 172, text: "EKUK (2; 3) = 6", size: "m", color: "yellow" },
      { op: "write", id: "note1", x: 600, y: 238, text: "har birini 6 bo'lakka", size: "s", color: "yellow" },
      { op: "fractionbar", id: "fb3", x: 470, y: 330, w: 470, parts: 6, filled: 3, color: "blue", label: "3/6" },
      { op: "fractionbar", id: "fb4", x: 470, y: 450, w: 470, parts: 6, filled: 0, color: "red", label: "?/6" },
    ],
  },
  {
    id: "f6",
    type: "explain",
    emotion: "neutral",
    say: "Ko'k bloklarni sanaymiz. Bir, ikki, uch. Demak, bir ikkidan bir, bu uchta oltidan bir.",
    board: [
      { op: "highlight", target: "fb3", color: "blue" },
      { op: "latex", id: "eq1", x: 50, y: 245, tex: "\\frac{1}{2} = \\frac{3}{6}", size: "m" },
    ],
  },
  {
    id: "f7",
    type: "ask",
    emotion: "encouraging",
    say: "Endi sen ayt. Bir uchdan bir nechta oltidan birga teng?",
    board: [{ op: "latex", id: "eq2", x: 50, y: 370, tex: "\\frac{1}{3} = \\frac{?}{6}", size: "m" }],
    expect: { kind: "number", answer: "2", prompt: "1/3 = ?/6" },
  },
  {
    id: "f8",
    type: "praise",
    emotion: "happy",
    say: "Barakalla! Ikkita oltidan bir. Pushti bloklar ham olti bo'lakka bo'lindi.",
    board: [
      { op: "fractionbar", id: "fb4", x: 470, y: 450, w: 470, parts: 6, filled: 2, color: "red", label: "2/6" },
      { op: "latex", id: "eq2", x: 50, y: 370, tex: "\\frac{1}{3} = \\frac{2}{6}", size: "m" },
    ],
  },
  {
    id: "f9",
    type: "explain",
    emotion: "excited",
    say: "Endi bloklar bir xil! Uchta qo'shuv ikkita, beshta. Javob, beshta oltidan bir!",
    board: [
      { op: "latex", id: "sum", x: 50, y: 495, tex: "\\frac{3}{6} + \\frac{2}{6} = \\frac{5}{6}", size: "m", color: "green" },
      { op: "latex", id: "q", x: 50, y: 40, tex: "\\frac{1}{2} + \\frac{1}{3} = \\frac{5}{6}", size: "m" },
    ],
  },
  {
    id: "f10",
    type: "ask",
    emotion: "encouraging",
    say: "O'zing sinab ko'r! Bir to'rtdan bir qo'shuv bir ikkidan bir nechaga teng?",
    board: [{ op: "latex", id: "try", x: 600, y: 520, tex: "\\frac{1}{4} + \\frac{1}{2} = ?", size: "s", color: "yellow" }],
    expect: { kind: "fraction", answer: "3/4", prompt: "1/4 + 1/2 =" },
  },
  {
    id: "f11",
    type: "praise",
    emotion: "excited",
    say: "Zo'r! Uchta to'rtdan bir. Sen kasrlarni blokma-blok qo'shishni o'rganding!",
    board: [{ op: "latex", id: "try", x: 600, y: 520, tex: "\\frac{1}{4} + \\frac{1}{2} = \\frac{3}{4}", size: "s", color: "green" }],
  },
];

const equation: LessonSegment[] = [
  {
    id: "e1",
    type: "explain",
    emotion: "happy",
    say: "Bugungi missiya! Ikki iks qo'shuv uch teng o'n bir. Iks nechaga teng, topamiz.",
    board: [{ op: "write", id: "eq", x: 60, y: 50, text: "2x + 3 = 11", size: "l" }],
  },
  {
    id: "e2",
    type: "explain",
    emotion: "neutral",
    say: "Tenglama, bu tarozi. Chapda ikkita iks quti va uchta tosh. O'ngda esa o'n bitta tosh.",
    board: [
      { op: "line", id: "beam", from: [520, 300], to: [960, 300] },
      { op: "line", id: "pole", from: [740, 300], to: [740, 580] },
      { op: "line", id: "base", from: [690, 580], to: [790, 580] },
      { op: "rect", id: "x1", x: 530, y: 236, w: 54, h: 54, color: "blue" },
      { op: "rect", id: "x2", x: 592, y: 236, w: 54, h: 54, color: "blue" },
      { op: "write", id: "xl", x: 548, y: 244, text: "x  x", size: "s", color: "blue" },
      { op: "write", id: "stones", x: 656, y: 248, text: "+3", size: "s" },
      { op: "write", id: "right", x: 840, y: 248, text: "11", size: "s" },
    ],
  },
  {
    id: "e3",
    type: "explain",
    emotion: "thinking",
    say: "Hmm… tarozi muvozanatda qolishi kerak. Ikkala tomondan bir xil narsani olamiz. Ikkala tomondan uchni ayiramiz.",
    board: [{ op: "write", id: "step1", x: 60, y: 160, text: "2x + 3 − 3 = 11 − 3", size: "m", color: "red" }],
  },
  {
    id: "e4",
    type: "ask",
    emotion: "encouraging",
    say: "Qani, hisobla. O'n bir ayiruv uch nechaga teng? Ikki iks nechaga teng bo'ldi?",
    board: [{ op: "write", id: "step2", x: 60, y: 260, text: "2x = ?", size: "l" }],
    expect: { kind: "number", answer: "8", prompt: "2x =" },
  },
  {
    id: "e5",
    type: "praise",
    emotion: "happy",
    say: "To'g'ri, sakkiz! Endi ikkita iks sakkizga teng.",
    board: [
      { op: "write", id: "step2", x: 60, y: 260, text: "2x = 8", size: "l" },
      { op: "write", id: "stones", x: 656, y: 248, text: "", size: "s" },
      { op: "write", id: "right", x: 840, y: 248, text: "8", size: "s" },
    ],
  },
  {
    id: "e6",
    type: "ask",
    emotion: "encouraging",
    say: "Oxirgi qadam qoldi. Ikkala tomonni ikkiga bo'lamiz. Iks nechaga teng?",
    board: [{ op: "write", id: "step3", x: 60, y: 380, text: "x = 8 : 2 = ?", size: "l", color: "yellow" }],
    expect: { kind: "number", answer: "4", prompt: "x =" },
  },
  {
    id: "e7",
    type: "praise",
    emotion: "excited",
    say: "Voy, missiya bajarildi! Iks to'rtga teng. Tekshiramiz, ikki karra to'rt qo'shuv uch, o'n bir!",
    board: [
      { op: "write", id: "step3", x: 60, y: 380, text: "x = 4", size: "l", color: "green" },
      { op: "write", id: "check", x: 60, y: 500, text: "2·4 + 3 = 11 ✓", size: "m", color: "green" },
    ],
  },
];

const percent: LessonSegment[] = [
  {
    id: "p1",
    type: "explain",
    emotion: "happy",
    say: "Bugun foizni o'rganamiz! Foiz, bu yuzdan bir qism. Yigirma besh foiz, bu yuzdan yigirma besh.",
    board: [{ op: "latex", id: "def", x: 60, y: 40, tex: "25\\% = \\frac{25}{100}", size: "m" }],
  },
  {
    id: "p2",
    type: "explain",
    emotion: "neutral",
    say: "Yuzdan yigirma beshni qisqartiramiz. To'rtdan bir chiqadi. Ya'ni butunning chorak qismi.",
    board: [
      { op: "latex", id: "def", x: 60, y: 40, tex: "25\\% = \\frac{25}{100} = \\frac{1}{4}", size: "m" },
      { op: "fractionbar", id: "bar", x: 480, y: 90, w: 460, parts: 4, filled: 1, color: "green", label: "25%" },
    ],
  },
  {
    id: "p3",
    type: "explain",
    emotion: "thinking",
    say: "Hmm… bir masala bor. Sinfda bir yuz yigirmata kitob. Ularning yigirma besh foizi ertak. Ertaklar nechta?",
    board: [
      { op: "write", id: "task", x: 60, y: 190, text: "120 ning 25% i = ?", size: "m", color: "yellow" },
      { op: "numberline", id: "nl", x: 480, y: 260, w: 460, min: 0, max: 120, marks: [30] },
    ],
  },
  {
    id: "p4",
    type: "ask",
    emotion: "encouraging",
    say: "Chorak qismni topamiz. Bir yuz yigirmani to'rtga bo'lamiz. Nechchi chiqadi?",
    board: [{ op: "write", id: "calc", x: 60, y: 290, text: "120 : 4 = ?", size: "m" }],
    expect: { kind: "number", answer: "30", prompt: "120 : 4 =" },
  },
  {
    id: "p5",
    type: "praise",
    emotion: "excited",
    say: "Barakalla! O'ttizta ertak kitobi. Son o'qida ham o'ttiz chorak joyida turibdi!",
    board: [
      { op: "write", id: "calc", x: 60, y: 290, text: "120 : 4 = 30", size: "m", color: "green" },
      { op: "highlight", target: "nl", color: "green" },
    ],
  },
  {
    id: "p6",
    type: "ask",
    emotion: "encouraging",
    say: "Endi sen sinab ko'r. Saksonning ellik foizi nechaga teng? Ellik foiz, bu yarmi.",
    board: [{ op: "write", id: "try", x: 60, y: 420, text: "80 ning 50% i = ?", size: "m", color: "yellow" }],
    expect: { kind: "number", answer: "40", prompt: "80 · 50% =" },
  },
  {
    id: "p7",
    type: "praise",
    emotion: "happy",
    say: "To'g'ri, qirq! Qoida shunday. Sonni foizga ko'paytiramiz, keyin yuzga bo'lamiz.",
    board: [
      { op: "write", id: "try", x: 60, y: 420, text: "80 ning 50% i = 40", size: "m", color: "green" },
      { op: "latex", id: "rule", x: 520, y: 430, tex: "a \\cdot \\frac{p}{100}", size: "m", color: "yellow" },
    ],
  },
];

const area: LessonSegment[] = [
  {
    id: "a1",
    type: "explain",
    emotion: "happy",
    say: "Keling, xona polini bloklar bilan qoplaymiz! Bo'yi besh metr, eni uch metr.",
    board: [
      { op: "rect", id: "room", x: 480, y: 120, w: 400, h: 240, color: "ink" },
      { op: "write", id: "wlab", x: 640, y: 372, text: "5 m", size: "s" },
      { op: "write", id: "hlab", x: 892, y: 220, text: "3 m", size: "s" },
    ],
  },
  {
    id: "a2",
    type: "explain",
    emotion: "neutral",
    say: "Har bir blok, bir kvadrat metr. Bir qatorga beshta blok sig'adi.",
    board: [
      { op: "line", id: "v1", from: [560, 120], to: [560, 360], color: "blue" },
      { op: "line", id: "v2", from: [640, 120], to: [640, 360], color: "blue" },
      { op: "line", id: "v3", from: [720, 120], to: [720, 360], color: "blue" },
      { op: "line", id: "v4", from: [800, 120], to: [800, 360], color: "blue" },
    ],
  },
  {
    id: "a3",
    type: "explain",
    emotion: "thinking",
    say: "Hmm… bunday qatorlar uchta. Demak, besh karra uch.",
    board: [
      { op: "line", id: "h1", from: [480, 200], to: [880, 200], color: "blue" },
      { op: "line", id: "h2", from: [480, 280], to: [880, 280], color: "blue" },
      { op: "write", id: "formula", x: 60, y: 120, text: "S = a · b", size: "l", color: "yellow" },
    ],
  },
  {
    id: "a4",
    type: "ask",
    emotion: "encouraging",
    say: "Qani, ayt-chi. Nechta blok kerak? Xonaning yuzi necha kvadrat metr?",
    board: [{ op: "write", id: "calc", x: 60, y: 240, text: "S = 5 · 3 = ?", size: "m" }],
    expect: { kind: "number", answer: "15", prompt: "S =" },
  },
  {
    id: "a5",
    type: "praise",
    emotion: "excited",
    say: "Voy, to'g'ri! O'n besh kvadrat metr. To'g'ri to'rtburchak yuzi, bo'yi karra eni.",
    board: [
      { op: "write", id: "calc", x: 60, y: 240, text: "S = 5 · 3 = 15 m²", size: "m", color: "green" },
      { op: "highlight", target: "room", color: "green" },
    ],
  },
  {
    id: "a6",
    type: "ask",
    emotion: "encouraging",
    say: "O'zing sinab ko'r! Bo'yi sakkiz, eni to'rt metr. Maydonning yuzi necha?",
    board: [{ op: "write", id: "try", x: 60, y: 380, text: "8 · 4 = ?", size: "m", color: "yellow" }],
    expect: { kind: "number", answer: "32", prompt: "S =" },
  },
  {
    id: "a7",
    type: "praise",
    emotion: "happy",
    say: "Zo'r, o'ttiz ikki kvadrat metr! Sen haqiqiy quruvchisan!",
    board: [{ op: "write", id: "try", x: 60, y: 380, text: "8 · 4 = 32 m²", size: "m", color: "green" }],
  },
];

export const DEMO_LESSONS: Record<string, DemoLesson> = {
  "frac-add-unlike": { skillId: "frac-add-unlike", segments: fractions },
  "eq-two-step": { skillId: "eq-two-step", segments: equation },
  "pct-of-number": { skillId: "pct-of-number", segments: percent },
  "geo-area-rect": { skillId: "geo-area-rect", segments: area },
};

/** Related skills reuse the closest demo lesson in mock mode. */
const NEAREST: Record<string, string> = {
  "frac-add-like": "frac-add-unlike",
  "frac-sub-unlike": "frac-add-unlike",
  "frac-equivalent": "frac-add-unlike",
  "frac-compare": "frac-add-unlike",
  lcm: "frac-add-unlike",
  "eq-one-step": "eq-two-step",
  "eq-both-sides": "eq-two-step",
  "eq-word": "eq-two-step",
  "pct-intro": "pct-of-number",
  "pct-find-whole": "pct-of-number",
  "geo-perimeter": "geo-area-rect",
  "geo-area-triangle": "geo-area-rect",
};

export function demoLessonFor(skillId: string): DemoLesson | undefined {
  return DEMO_LESSONS[skillId] ?? DEMO_LESSONS[NEAREST[skillId] ?? ""];
}

// ── Canned interruption answers (mock mode + fallback) ─────────────────────
const CHECK: LessonSegment = {
  id: "chk",
  type: "check",
  layer: "note",
  emotion: "encouraging",
  say: "Tushunarli bo'ldimi? Davom etamizmi?",
  board: [],
};

export function mockInterrupt(question: string, skillId: string): LessonSegment[] {
  const q = question.toLowerCase();
  if (/maxraj|ko'paytir|oltiga|olti|nega/.test(q) && skillId.startsWith("frac") || /maxraj/.test(q)) {
    return [
      {
        id: "n1",
        type: "explain",
        layer: "note",
        emotion: "thinking",
        say: "Hmm… yaxshi savol! Bloklar bir xil o'lchamda bo'lsa, ularni sanab qo'shamiz.",
        board: [
          { op: "highlight", target: "fb1", color: "orange" },
          { op: "highlight", target: "fb2", color: "orange" },
          { op: "write", id: "nq", x: 600, y: 280, text: "bir xil bo'lak = oson sanash", size: "s" },
        ],
      },
      {
        id: "n2",
        type: "explain",
        layer: "note",
        emotion: "neutral",
        say: "Olti, ikkiga ham, uchga ham bo'linadi. U eng kichigi. Shuning uchun ikkala kasrni oltidan birlarga aylantirdik.",
        board: [
          { op: "write", id: "n6", x: 600, y: 520, text: "6 : 2 = 3     6 : 3 = 2", size: "s" },
          { op: "highlight", target: "lcm", color: "orange" },
        ],
      },
      CHECK,
    ];
  }
  if (/[0-9]|kasr|son|nima|qanday|qanaqa|nega|tenglama|foiz|yuz/.test(q)) {
    return [
      {
        id: "n1",
        type: "explain",
        layer: "note",
        emotion: "thinking",
        say: "Hechqisi yo'q, yana bir urinib ko'ramiz! Shu qadamni sekinroq ko'rib chiqamiz.",
        board: [{ op: "write", id: "nq", x: 620, y: 540, text: "qadam-baqadam!", size: "s" }],
      },
      CHECK,
    ];
  }
  return [
    {
      id: "n1",
      type: "explain",
      layer: "note",
      emotion: "happy",
      say: "Qiziq savol! Lekin keling, matematikaga qaytamiz. Biz zo'r joyda to'xtadik!",
      board: [],
    },
    CHECK,
  ];
}
