// Juftini top (memory match) — pair bank + dealing + flip logic (pure, unit-tested).
// Each pair is tied to a skill, so a found pair updates that skill's mastery (server re-checks the pair id).
// Language course hook: when feat/languages lands, add pairs with kind "word" (word ↔ translation) here
// or pass them in via `deal({ bank })`.
import type { Rng } from "@/data/problems";
import { uzText } from "./scenes";
import { EN_PAIRS } from "@/config/courses/english/practice";

export type Face =
  | { kind: "text"; text: string }
  /** a fraction drawn as a bar: `parts` cells, `filled` shaded */
  | { kind: "fracbar"; parts: number; filled: number };

export interface Pair {
  id: string;
  skillId: string;
  /** what the pair means, for the screen reader and the "found" message */
  label: string;
  a: Face;
  b: Face;
}

const fb = (n: number, d: number, skillId = "frac-intro"): Pair => ({
  id: `fb-${n}-${d}`,
  skillId,
  label: `${n}/${d}`,
  a: { kind: "text", text: `${n}/${d}` },
  b: { kind: "fracbar", parts: d, filled: n },
});
const tx = (id: string, skillId: string, a: string, b: string): Pair => ({ id, skillId, label: `${a} — ${b}`, a: { kind: "text", text: a }, b: { kind: "text", text: b } });

export const PAIRS: Pair[] = [
  // fraction ↔ picture
  fb(1, 2), fb(1, 3), fb(3, 4), fb(2, 5), fb(5, 6), fb(3, 8), fb(2, 3), fb(1, 4),
  // formula ↔ name
  tx("f-rect-area", "geo-area-rect", "S = a · b", "To'g'ri to'rtburchak yuzi"),
  tx("f-sq-perim", "geo-perimeter", "P = 4a", "Kvadrat perimetri"),
  tx("f-tri-area", "geo-area-triangle", "S = a · h : 2", "Uchburchak yuzi"),
  tx("f-circle-len", "geo-circle", "C = 2πr", "Aylana uzunligi"),
  tx("f-circle-area", "geo-circle", "S = πr²", "Doira yuzi"),
  tx("f-pyth", "geo-pythagoras", "c² = a² + b²", "Pifagor teoremasi"),
  tx("f-lin", "lin-func", "y = kx + b", "Chiziqli funksiya"),
  tx("f-rect-perim", "geo-perimeter", "P = 2(a + b)", "To'g'ri to'rtburchak perimetri"),
  // same number, two ways
  tx("e-half", "frac-to-dec", "1/2", "0,5"),
  tx("e-quarter", "pct-intro", "1/4", "25%"),
  tx("e-tenth", "dec-intro", "1/10", "0,1"),
  tx("e-pct50", "pct-intro", "50%", "0,5 qismi"),
  tx("e-sq", "nat-powers", "7²", "49"),
  tx("e-cube", "nat-powers", "2³", "8"),
  // Fizika (7-sinf): formula ↔ name
  tx("p-speed", "fiz-tezlik", "v = s : t", "Tezlik"),
  tx("p-density", "fiz-zichlik", "ρ = m : V", "Zichlik"),
  tx("p-weight", "fiz-kuch", "P = m · g", "Og'irlik kuchi"),
  tx("p-pressure", "fiz-bosim", "p = F : S", "Bosim"),
  tx("p-work", "fiz-ish", "A = F · s", "Mexanik ish"),
  tx("p-power", "fiz-quvvat", "N = A : t", "Quvvat"),
  tx("p-path", "fiz-masofa-vaqt", "s = v · t", "Bosib o'tilgan yo'l"),
  // Ingliz tili: word ↔ translation (EN_PAIRS from the English course)
  ...EN_PAIRS.map((w) => tx(`w-${w.en}`, "en-alphabet", w.en, w.uz)),
];

/** pairs of the same course stay together when a round is filled up (math / fizika / ingliz) */
const course = (skillId: string) => (skillId.startsWith("en-") ? "en" : skillId.startsWith("fiz-") ? "fiz" : "math");

export const PAIR_BY_ID: Record<string, Pair> = Object.fromEntries(PAIRS.map((p) => [p.id, p]));

export interface Card {
  /** unique per card */
  uid: string;
  pairId: string;
  face: Face;
}

export const MEMORY_CARDS = 12;

/** The "theme" of a round: pairs whose skill is in `skillIds` first, then fill from the rest. */
export function deal(opts: { skillIds?: string[]; rng?: Rng; bank?: Pair[]; cards?: number } = {}): Card[] {
  const r = opts.rng ?? Math.random;
  const bank = opts.bank ?? PAIRS;
  const want = (opts.cards ?? MEMORY_CARDS) / 2;
  const shuffle = <T,>(xs: T[]) => {
    const a = [...xs];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  const pref = opts.skillIds?.length ? shuffle(bank.filter((p) => opts.skillIds!.includes(p.skillId))) : [];
  const courses = new Set(opts.skillIds?.length ? opts.skillIds.map(course) : ["math"]);
  const others = bank.filter((p) => !pref.includes(p));
  const rest = [...shuffle(others.filter((p) => courses.has(course(p.skillId)))), ...shuffle(others.filter((p) => !courses.has(course(p.skillId))))];
  // two faces must never be identical text on different pairs (would be ambiguous): skip clashes
  const chosen: Pair[] = [];
  const faces = new Set<string>();
  const key = (f: Face) => (f.kind === "text" ? `t:${f.text}` : `b:${f.parts}/${f.filled}`);
  for (const p of [...pref, ...rest]) {
    if (chosen.length >= want) break;
    if (faces.has(key(p.a)) || faces.has(key(p.b))) continue;
    faces.add(key(p.a));
    faces.add(key(p.b));
    chosen.push(p);
  }
  // G5: faces are shown with the Uzbek decimal comma ("0,5"), whatever the bank wrote
  const uz = (f: Face): Face => (f.kind === "text" ? { kind: "text", text: uzText(f.text) } : f);
  const cards = chosen.flatMap((p) => [
    { uid: `${p.id}:a`, pairId: p.id, face: uz(p.a) },
    { uid: `${p.id}:b`, pairId: p.id, face: uz(p.b) },
  ]);
  return shuffle(cards);
}

export interface MemoryState {
  open: string[]; // uids face-up and not yet matched (0–2)
  matched: string[]; // pair ids
  moves: number; // pairs of flips
}

export const memoryStart = (): MemoryState => ({ open: [], matched: [], moves: 0 });

export type FlipResult = { state: MemoryState; event: "none" | "open" | "match" | "miss"; pairId?: string };

/** Flip one card. A third flip while two mismatched cards are open first closes them. */
export function flip(s: MemoryState, cards: Card[], uid: string): FlipResult {
  const card = cards.find((c) => c.uid === uid);
  if (!card || s.matched.includes(card.pairId)) return { state: s, event: "none" };
  if (s.open.length < 2 && s.open.includes(uid)) return { state: s, event: "none" };
  const open = s.open.length >= 2 ? [uid] : [...s.open, uid];
  if (open.length < 2) return { state: { ...s, open }, event: "open" };
  const [a, b] = open.map((u) => cards.find((c) => c.uid === u)!);
  const moves = s.moves + 1;
  if (a.pairId === b.pairId) return { state: { open: [], matched: [...s.matched, a.pairId], moves }, event: "match", pairId: a.pairId };
  return { state: { ...s, open, moves }, event: "miss" };
}

export const memoryDone = (s: MemoryState, cards: Card[]) => s.matched.length * 2 >= cards.length && cards.length > 0;
