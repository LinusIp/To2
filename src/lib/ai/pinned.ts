// Pinned, reviewed answers for the live-demo questions (CLAUDE.md §15 step 5), per tutor.
// The demo must never depend on a live LLM: when a learner asks one of these questions (or a
// close variant) during the fractions lesson, /api/tutor serves the answer below — and stores it
// in KV under the normal interrupt cache key. Any other question still gets a live LLM answer.
//
// Matching: normalize (lowercase, apostrophes/punctuation removed, digits kept, spaces squeezed),
// then compare against each question's alias list. Board targets (fb1, fb2, lcm) are the ids in
// the demo fractions lesson (src/lib/ai/mock/lessons.ts). Notes are short: the note layouter
// places them in the board's note panel.
import type { LessonSegment } from "./schema";

/** Lesson skills whose board is the demo fractions lesson (same element ids). */
export const PINNED_SKILLS = new Set(["frac-add-unlike"]);

export type PinnedId = "why-multiply" | "why-six" | "what-lcm";

/**
 * The normalized question (also the interrupt cache key's text): lowercase, every apostrophe variant
 * (ʻ ’ ‘ ` ʼ) unified to ', other punctuation dropped, word boundaries kept. Uzbek letters stay intact:
 * "Nega KOʻPAYTIRDIK?!" → "nega ko'paytirdik"; "o'n ikki" ≠ "on ikki".
 */
export function normalizeQuestion(q: string): string {
  return q
    .toLowerCase()
    .replace(/[ʻʼ’‘`]/g, "'")
    .replace(/[^\p{L}\p{N}'\s]/gu, " ")
    .replace(/(^|\s)'+|'+(?=\s|$)/g, "$1") // quotes around words, not the o'/g' inside them
    .replace(/\s+/g, " ")
    .trim();
}

/** words for matching: apostrophes ignored (STT writes "kopaytirdik" as often as "ko'paytirdik") */
const tokens = (q: string) => normalizeQuestion(q).replace(/'/g, "").split(" ").filter(Boolean);

/** share of words two questions have in common, over the longer one (multiset) */
export function tokenOverlap(a: string[], b: string[]): number {
  const left = [...b];
  let common = 0;
  for (const t of a) {
    const i = left.indexOf(t);
    if (i >= 0) {
      common++;
      left.splice(i, 1);
    }
  }
  return common / Math.max(a.length, b.length, 1);
}

const ALIASES: Record<PinnedId, string[]> = {
  "why-multiply": [
    "Nega maxrajlarni ko'paytirdik?",
    "Nega maxrajlarni ko'paytirdik",
    "Maxrajlarni nega ko'paytirdik?",
    "Nega maxrajlar ko'paytirildi?",
    "Nega maxrajni ko'paytirdik?",
    "Nega ko'paytirdik?",
    "Nega ikkini uchga ko'paytirdik?",
    "Nega ikki karra uch?",
    "Nega 2 ni 3 ga ko'paytirdik?",
  ],
  "why-six": [
    "Nega maxrajlarni oltiga keltirdik?",
    "Nega oltiga keltirdik?",
    "Nega oltiga?",
    "Nega olti?",
    "Nega aynan olti?",
    "Nega maxraj olti?",
    "Nega maxraj oltiga teng?",
    "Nega 6 ga?",
    "Nega 6?",
    "Nega oltidan bir?",
  ],
  "what-lcm": [
    "EKUK nima?",
    "EKUK degani nima?",
    "EKUK nimani anglatadi?",
    "EKUK nima degani?",
    "Eng kichik umumiy karrali nima?",
    "EKUK qanday topiladi?",
  ],
};

/** The question as asked in the demo script (used for the KV cache key). */
export const CANONICAL: Record<PinnedId, string> = {
  "why-multiply": "Nega maxrajlarni ko'paytirdik?",
  "why-six": "Nega maxrajlarni oltiga keltirdik?",
  "what-lcm": "EKUK nima?",
};

const INDEX: { id: PinnedId; words: string[] }[] = (Object.entries(ALIASES) as [PinnedId, string[]][]).flatMap(([id, list]) => list.map((q) => ({ id, words: tokens(q) })));

/** Minimum word overlap with an alias (full phrase). Strong only: a 5-word question may differ by ≤ 0 words. */
export const PIN_MIN_OVERLAP = 0.85;

/** polite extra words that don't change what is asked ("Ustoz, iltimos, nega olti?") */
const POLITE = new Set(["ustoz", "iltimos", "menga", "ayting", "aytingchi", "aytib", "bering", "ber", "qani", "xo'sh", "xosh", "endi", "unda", "ha", "yana", "bir"]);

/**
 * Only the demo questions and their listed aliases, as FULL phrases (strong match only): every word
 * of the question — polite words aside — must be in the alias, and ≥ 85 % of the words overlap.
 * "Nega maxrajlarni qo'shmadik?" or "Nega olti emas, yetti?" are NOT the demo question → live answer.
 */
export function matchPinned(skillId: string, question: string): PinnedId | null {
  if (!PINNED_SKILLS.has(skillId)) return null;
  const q = tokens(question).filter((w) => !POLITE.has(w));
  if (q.length < 2) return null;
  let best: { id: PinnedId; score: number } | null = null;
  for (const a of INDEX) {
    if (!q.every((w) => a.words.includes(w))) continue;
    const score = tokenOverlap(q, a.words);
    if (score >= PIN_MIN_OVERLAP && (!best || score > best.score)) best = { id: a.id, score };
  }
  return best?.id ?? null;
}

const CHECK: LessonSegment = { id: "chk", type: "check", layer: "note", emotion: "encouraging", say: "Tushunarli bo'ldimi? Davom etamizmi?", board: [] };

type Two = [Omit<LessonSegment, "id" | "type" | "layer">, Omit<LessonSegment, "id" | "type" | "layer">];

// Reviewed by hand: maths exact (EKUK(2;3) = 6 = 2·3 because 2 and 3 share no divisor but 1),
// ≤ 12 words per phrase, numbers as words in `say`, each tutor's own voice.
const ANSWERS: Record<string, Record<PinnedId, Two>> = {
  blokbek: {
    "why-multiply": [
      {
        emotion: "thinking",
        say: "Hmm… zo'r savol! Ikki va uchning umumiy bo'luvchisi yo'q, faqat bir.",
        board: [
          { op: "highlight", target: "fb1", color: "orange" },
          { op: "highlight", target: "fb2", color: "orange" },
          { op: "write", id: "pa1", x: 0, y: 0, text: "EKUB (2; 3) = 1", size: "s", color: "orange" },
        ],
      },
      {
        emotion: "happy",
        say: "Shunda EKUK ularning ko'paytmasi bo'ladi. Ikki karra uch, olti! Bloklar bir xil bo'ldi.",
        board: [
          { op: "highlight", target: "lcm", color: "orange" },
          { op: "write", id: "pa2", x: 0, y: 0, text: "EKUK (2; 3) = 2 · 3 = 6", size: "s", color: "orange" },
        ],
      },
    ],
    "why-six": [
      {
        emotion: "thinking",
        say: "Hmm… qara, bloklar har xil o'lchamda edi. Ularni sanab qo'shib bo'lmaydi.",
        board: [
          { op: "highlight", target: "fb1", color: "orange" },
          { op: "highlight", target: "fb2", color: "orange" },
          { op: "write", id: "pa1", x: 0, y: 0, text: "bir xil bloklar kerak", size: "s", color: "orange" },
        ],
      },
      {
        emotion: "happy",
        say: "Olti ikkiga ham, uchga ham bo'linadi. U eng kichigi, shuning uchun oltini oldik!",
        board: [
          { op: "highlight", target: "lcm", color: "orange" },
          { op: "write", id: "pa2", x: 0, y: 0, text: "6 : 2 = 3    6 : 3 = 2", size: "s", color: "orange" },
        ],
      },
    ],
    "what-lcm": [
      {
        emotion: "thinking",
        say: "EKUK, bu eng kichik umumiy karrali. Ikkala songa ham bo'linadigan eng kichik son.",
        board: [{ op: "write", id: "pa1", x: 0, y: 0, text: "eng kichik umumiy karrali", size: "s", color: "orange" }],
      },
      {
        emotion: "happy",
        say: "Ikki va uch uchun bu olti. Mana, blokma-blok tekshirdik!",
        board: [
          { op: "highlight", target: "lcm", color: "orange" },
          { op: "write", id: "pa2", x: 0, y: 0, text: "2: 2, 4, 6   3: 3, 6", size: "s", color: "orange" },
        ],
      },
    ],
  },
  lola: {
    "why-multiply": [
      {
        emotion: "encouraging",
        say: "Juda yaxshi savol! Ikki va uch hech qanday umumiy bo'luvchiga ega emas.",
        board: [
          { op: "highlight", target: "fb1", color: "orange" },
          { op: "highlight", target: "fb2", color: "orange" },
          { op: "write", id: "pa1", x: 0, y: 0, text: "EKUB (2; 3) = 1", size: "s", color: "orange" },
        ],
      },
      {
        emotion: "happy",
        say: "Shuning uchun EKUK ikki karra uchga teng, ya'ni olti. Sekin-asta, birga tushundik!",
        board: [
          { op: "highlight", target: "lcm", color: "orange" },
          { op: "write", id: "pa2", x: 0, y: 0, text: "EKUK (2; 3) = 2 · 3 = 6", size: "s", color: "orange" },
        ],
      },
    ],
    "why-six": [
      {
        emotion: "encouraging",
        say: "Yaxshi savol! Bo'laklar bir xil bo'lsagina ularni qo'shish mumkin.",
        board: [
          { op: "highlight", target: "fb1", color: "orange" },
          { op: "highlight", target: "fb2", color: "orange" },
          { op: "write", id: "pa1", x: 0, y: 0, text: "bir xil bo'laklar kerak", size: "s", color: "orange" },
        ],
      },
      {
        emotion: "happy",
        say: "Olti ikkiga ham, uchga ham bo'linadi. Bu eng kichik shunday son, shuning uchun olti.",
        board: [
          { op: "highlight", target: "lcm", color: "orange" },
          { op: "write", id: "pa2", x: 0, y: 0, text: "6 : 2 = 3    6 : 3 = 2", size: "s", color: "orange" },
        ],
      },
    ],
    "what-lcm": [
      {
        emotion: "encouraging",
        say: "EKUK, bu eng kichik umumiy karrali. Ikkala songa ham bo'linadigan eng kichik son.",
        board: [{ op: "write", id: "pa1", x: 0, y: 0, text: "eng kichik umumiy karrali", size: "s", color: "orange" }],
      },
      {
        emotion: "happy",
        say: "Ikki va uch uchun bu olti. Barakalla, endi sen ham bilasan!",
        board: [
          { op: "highlight", target: "lcm", color: "orange" },
          { op: "write", id: "pa2", x: 0, y: 0, text: "2: 2, 4, 6   3: 3, 6", size: "s", color: "orange" },
        ],
      },
    ],
  },
  ziyo: {
    "why-multiply": [
      {
        emotion: "thinking",
        say: "Nega deysanmi? Qiziq-a! Ikki va uch faqat birga bo'linadi.",
        board: [
          { op: "highlight", target: "fb1", color: "orange" },
          { op: "highlight", target: "fb2", color: "orange" },
          { op: "write", id: "pa1", x: 0, y: 0, text: "EKUB (2; 3) = 1", size: "s", color: "orange" },
        ],
      },
      {
        emotion: "excited",
        say: "Shunday sonlarda EKUK ularning ko'paytmasi. Ikki karra uch, olti! Tekshirib ko'ramiz!",
        board: [
          { op: "highlight", target: "lcm", color: "orange" },
          { op: "write", id: "pa2", x: 0, y: 0, text: "EKUK (2; 3) = 2 · 3 = 6", size: "s", color: "orange" },
        ],
      },
    ],
    "why-six": [
      {
        emotion: "thinking",
        say: "Nega aynan olti? Qani, o'ylab ko'raylik… bo'laklar bir xil bo'lishi kerak.",
        board: [
          { op: "highlight", target: "fb1", color: "orange" },
          { op: "highlight", target: "fb2", color: "orange" },
          { op: "write", id: "pa1", x: 0, y: 0, text: "bir xil bo'laklar kerak", size: "s", color: "orange" },
        ],
      },
      {
        emotion: "excited",
        say: "Olti ikkiga ham, uchga ham bo'linadi. Undan kichigi yo'q, shuning uchun olti!",
        board: [
          { op: "highlight", target: "lcm", color: "orange" },
          { op: "write", id: "pa2", x: 0, y: 0, text: "6 : 2 = 3    6 : 3 = 2", size: "s", color: "orange" },
        ],
      },
    ],
    "what-lcm": [
      {
        emotion: "thinking",
        say: "EKUK, bu eng kichik umumiy karrali. Ikkala songa ham bo'linadigan eng kichik son.",
        board: [{ op: "write", id: "pa1", x: 0, y: 0, text: "eng kichik umumiy karrali", size: "s", color: "orange" }],
      },
      {
        emotion: "excited",
        say: "Ikki va uch uchun qaysi son? Olti! Qiziq-a, sanab tekshiramiz!",
        board: [
          { op: "highlight", target: "lcm", color: "orange" },
          { op: "write", id: "pa2", x: 0, y: 0, text: "2: 2, 4, 6   3: 3, 6", size: "s", color: "orange" },
        ],
      },
    ],
  },
};

/** The pinned answer (2 segments + the check) for a tutor; tutors without their own fall back to Blokbek's. */
export function pinnedAnswer(id: PinnedId, characterId: string): LessonSegment[] {
  const [a, b] = (ANSWERS[characterId] ?? ANSWERS.blokbek)[id];
  return [
    { id: "p1", type: "explain", layer: "note", ...a },
    { id: "p2", type: "explain", layer: "note", ...b },
    CHECK,
  ];
}

/** Every pinned line with its emotion (for the TTS warm-up). */
export function allPinned(): { characterId: string; question: string; segments: LessonSegment[] }[] {
  const out: { characterId: string; question: string; segments: LessonSegment[] }[] = [];
  for (const characterId of Object.keys(ANSWERS)) for (const id of Object.keys(CANONICAL) as PinnedId[]) out.push({ characterId, question: CANONICAL[id], segments: pinnedAnswer(id, characterId) });
  return out;
}
