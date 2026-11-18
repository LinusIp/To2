// English practice: 4-choice problems for the 9 course skills (checked by /api/answer like maths,
// same recordAnswer path). EN_PAIRS = word ↔ translation pairs, also for the games module (memory game).
import type { Problem, Rng } from "@/data/problems";

export interface WordPair {
  en: string;
  uz: string;
}

/** word ↔ translation pairs (grade 5 vocabulary) — export for the memory game */
export const EN_PAIRS: WordPair[] = [
  { en: "book", uz: "kitob" },
  { en: "cat", uz: "mushuk" },
  { en: "dog", uz: "it" },
  { en: "apple", uz: "olma" },
  { en: "school", uz: "maktab" },
  { en: "teacher", uz: "o'qituvchi" },
  { en: "friend", uz: "do'st" },
  { en: "water", uz: "suv" },
  { en: "house", uz: "uy" },
  { en: "sun", uz: "quyosh" },
  { en: "mother", uz: "ona" },
  { en: "father", uz: "ota" },
  { en: "pen", uz: "ruchka" },
  { en: "red", uz: "qizil" },
  { en: "big", uz: "katta" },
  { en: "small", uz: "kichik" },
];

const PLURALS: [string, string][] = [
  ["book", "books"], ["cat", "cats"], ["apple", "apples"], ["pen", "pens"],
  ["box", "boxes"], ["bus", "buses"], ["watch", "watches"], ["dish", "dishes"], ["class", "classes"],
];
const PAST: [string, string][] = [
  ["play", "played"], ["watch", "watched"], ["go", "went"], ["see", "saw"], ["have", "had"],
  ["eat", "ate"], ["write", "wrote"], ["do", "did"], ["come", "came"], ["swim", "swam"],
];
const PRONOUNS: [string, string][] = [["men", "I"], ["sen", "you"], ["u (o'g'il bola)", "he"], ["u (qiz bola)", "she"], ["biz", "we"], ["ular", "they"]];
const ALL_PRONOUNS = ["I", "you", "he", "she", "it", "we", "they"];
const TO_BE: [string, string][] = [
  ["I ___ a student.", "am"], ["She ___ a teacher.", "is"], ["We ___ friends.", "are"], ["He ___ tall.", "is"],
  ["They ___ at school.", "are"], ["It ___ a cat.", "is"], ["You ___ my friend.", "are"],
];
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

const pick = <T,>(r: Rng, xs: readonly T[]): T => xs[Math.floor(r() * xs.length)];
const shuffle = <T,>(r: Rng, xs: T[]) => xs.map((x) => [r(), x] as const).sort((a, b) => a[0] - b[0]).map((p) => p[1]);
/** exactly 4 distinct choices containing the answer, shuffled */
function four(r: Rng, answer: string, pool: string[]): string[] {
  const rest = shuffle(r, [...new Set(pool.filter((p) => p !== answer))]).slice(0, 3);
  return shuffle(r, [answer, ...rest]);
}
const choice = (r: Rng, answer: string, pool: string[]) => ({ kind: "choice" as const, answer, choices: four(r, answer, pool) });

type Gen = (r: Rng) => Omit<Problem, "skillId" | "key">;

const wordToEn: Gen = (r) => {
  const w = pick(r, EN_PAIRS);
  return { q: `"${w.uz}" inglizcha qanday?`, expect: choice(r, w.en, EN_PAIRS.map((p) => p.en)), hint: "So'z ma'nosini eslang." };
};
const enToWord: Gen = (r) => {
  const w = pick(r, EN_PAIRS);
  return { q: `"${w.en}" so'zining tarjimasi qaysi?`, expect: choice(r, w.uz, EN_PAIRS.map((p) => p.uz)), hint: "So'z ma'nosini eslang." };
};

export const EN_GENERATORS: Record<string, Gen[]> = {
  "en-alphabet": [
    (r) => {
      const i = Math.floor(r() * 25);
      const a = ALPHABET[i + 1];
      return { q: `Alifboda ${ALPHABET[i]} harfidan keyin qaysi harf keladi?`, expect: choice(r, a, ALPHABET.slice(Math.max(0, i - 3), i + 6).split("")), hint: "A, B, C, D… tartibini ayting." };
    },
    wordToEn,
  ],
  "en-pronouns": [
    (r) => {
      const [uz, en] = pick(r, PRONOUNS);
      return { q: `"${uz}" inglizcha qaysi olmosh?`, expect: choice(r, en, ALL_PRONOUNS), hint: "I — men, you — sen, he — u (o'g'il), she — u (qiz), we — biz, they — ular." };
    },
  ],
  "en-to-be": [
    (r) => {
      const [s, a] = pick(r, TO_BE);
      return { q: `${s}`, expect: choice(r, a, ["am", "is", "are", "be"]), hint: "I — am; he, she, it — is; we, you, they — are." };
    },
  ],
  "en-articles": [
    (r) => {
      const w = pick(r, ["apple", "egg", "orange", "umbrella", "book", "cat", "pen", "house"]);
      const a = /^[aeiou]/.test(w) ? "an" : "a";
      return { q: `Bo'sh joyga a yoki an: ___ ${w}`, expect: choice(r, a, ["a", "an", "am", "is"]), hint: "Unli tovush (a, e, i, o, u) oldidan an, qolganida a." };
    },
  ],
  "en-plurals": [
    (r) => {
      const [one, many] = pick(r, PLURALS);
      return { q: `"${one}" so'zining ko'pligi qaysi?`, expect: choice(r, many, [many, `${one}s`, `${one}es`, one, `${one}'s`]), hint: "-s, -sh, -ch, -x bilan tugasa -es, qolganida -s." };
    },
    enToWord,
  ],
  "en-have-got": [
    (r) => {
      const [subj, a] = pick(r, [["She", "has"], ["He", "has"], ["It", "has"], ["I", "have"], ["We", "have"], ["They", "have"]] as const);
      return { q: `${subj} ___ got a cat.`, expect: choice(r, a, ["have", "has", "is", "are"]), hint: "He, she, it — has got; qolganlari — have got." };
    },
  ],
  "en-present-simple": [
    (r) => {
      const [subj, third] = pick(r, [["He", true], ["She", true], ["My friend", true], ["I", false], ["We", false], ["They", false]] as const);
      const [v, vs] = pick(r, [["play", "plays"], ["read", "reads"], ["like", "likes"], ["swim", "swims"]] as const);
      const a = third ? vs : v;
      return { q: `${subj} ___ every day.`, expect: choice(r, a, [v, vs, `${v}ing`, `${v}ed`]), hint: "He, she, it bilan fe'lga -s qo'shiladi." };
    },
  ],
  "en-present-continuous": [
    (r) => {
      const [v, ing] = pick(r, [["read", "reading"], ["play", "playing"], ["write", "writing"], ["swim", "swimming"]] as const);
      return { q: `I am ___ now.`, expect: choice(r, ing, [v, `${v}s`, ing, `to ${v}`]), hint: "am / is / are + fe'l + -ing." };
    },
  ],
  "en-past-simple": [
    (r) => {
      const [v, past] = pick(r, PAST);
      return { q: `"${v}" fe'lining o'tgan zamon (Past Simple) shakli qaysi?`, expect: choice(r, past, [past, v.endsWith("e") ? `${v}d` : `${v}ed`, `${v}s`, `${v}ing`, v]), hint: "To'g'ri fe'llar -ed oladi; go — went, see — saw kabi noto'g'ri fe'llarni yodlaymiz." };
    },
  ],
};

let counter = 0;
/** one English problem for a course skill (null for other skills) */
export function generateEnglishProblem(skillId: string, rng: Rng = Math.random): Problem | null {
  const gens = EN_GENERATORS[skillId];
  if (!gens?.length) return null;
  const p = gens[Math.floor(rng() * gens.length)](rng);
  return { ...p, skillId, key: `${skillId}#en${++counter}` };
}
