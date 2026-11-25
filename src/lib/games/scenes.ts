// Kasb sinovi scenes — the data model (pure, unit-tested). Every mission item carries a `scene`: a small
// parameterised illustration (brick row, tile grid, fence, bags, a moving train, a sign…). The renderer
// (src/components/games/MissionScene.tsx) draws it in chalk on a board; `sceneValue` computes the number the
// solved scene shows, and a test checks it equals the item's answer — the picture can never disagree with
// the question.

export type Icon =
  | "brick" | "tile" | "window" | "bag" | "sand" | "somsa" | "bread" | "egg" | "box" | "rice" | "water"
  | "person" | "onion" | "shirt" | "apple" | "cup" | "plate" | "suitcase" | "key" | "bed" | "ticket";

export type Vehicle = "train" | "bus" | "bike" | "car" | "truck";

export type SignIcon = "gate" | "madrasa" | "arrow" | "clock" | "bowl" | "tower" | "observatory" | "ticket" | "wave" | "cup" | "plate" | "tea" | "chef" | "menu" | "bill" | "hotel" | "key" | "bed" | "bus" | "suitcase" | "map";

export type Scene =
  /** a length `total` filled with pieces of length `unit` → how many pieces */
  | { kind: "row"; total: number; unit: number; u: string; icon: Icon }
  /** cols × rows items (top view / shelves / floors) → how many */
  | { kind: "grid"; cols: number; rows: number; colsLabel: string; rowsLabel: string; icon: Icon }
  /** a w × h yard, fence around → perimeter */
  | { kind: "fence"; w: number; h: number; u: string }
  /** part = pct% of total, or (find "whole") total from part */
  | { kind: "percent"; total: number; pct: number; find: "part" | "whole"; unit: string; icon: Icon }
  /** a : b, so `target` of A needs ? of B */
  | { kind: "ratio"; a: number; b: number; target: number; nameA: string; nameB: string; iconA: Icon; iconB: Icon }
  /** triangle area */
  | { kind: "triangle"; base: number; h: number; u: string }
  /** right triangle legs → hypotenuse */
  | { kind: "hyp"; a: number; b: number; u: string }
  /** a bar of `parts`: mode "rest" = parts − have; "sum" = have + add */
  | { kind: "fraction"; parts: number; have: number; add?: number; mode: "rest" | "sum"; label: string }
  /** `groups` groups of `each`: find total, or (find "each") per group */
  | { kind: "groups"; groups: number; each: number; find: "total" | "each"; groupLabel: string; icon: Icon }
  /** buy `items` at `price`, pay `paid` → change */
  | { kind: "money"; items: number; price: number; paid: number; u: string; icon: Icon }
  /** two pans; op "sum" adds the values, "mul" multiplies them */
  | { kind: "scale"; values: [number, number]; labels: [string, string]; op: "sum" | "mul"; u: string }
  /** s = v · t; the missing one is `find` */
  | { kind: "motion"; v: number; t: number; find: "v" | "s" | "t"; vu: string; tu: string; su: string; vehicle: Vehicle }
  | { kind: "density"; m: number; V: number }
  | { kind: "weight"; m: number; g: number }
  | { kind: "pressure"; F: number; S: number }
  | { kind: "work"; F: number; s: number }
  | { kind: "power"; A: number; t: number }
  /** English: a sign / card with a blank (`___`) that the answer fills */
  | { kind: "sign"; text: string; icon: SignIcon };

export type SceneKind = Scene["kind"];

const r6 = (x: number) => Math.round(x * 1e6) / 1e6;
const gcd = (a: number, b: number): number => (b === 0 ? Math.abs(a) : gcd(b, a % b));
const fracStr = (n: number, d: number) => {
  const g = gcd(n, d);
  return d / g === 1 ? `${n / g}` : `${n / g}/${d / g}`;
};

/** The value the solved scene shows (as the learner would type it), or null for word scenes. */
export function sceneValue(s: Scene): string | null {
  switch (s.kind) {
    case "row": return String(r6(s.total / s.unit));
    case "grid": return String(s.cols * s.rows);
    case "fence": return String(r6(2 * (s.w + s.h)));
    case "percent": return String(r6(s.find === "part" ? (s.total * s.pct) / 100 : s.total));
    case "ratio": return String(r6((s.target * s.b) / s.a));
    case "triangle": return String(r6((s.base * s.h) / 2));
    case "hyp": return String(r6(Math.hypot(s.a, s.b)));
    case "fraction": return s.mode === "rest" ? fracStr(s.parts - s.have, s.parts) : fracStr(s.have + (s.add ?? 0), s.parts);
    case "groups": return String(s.find === "total" ? s.groups * s.each : s.each);
    case "money": return String(r6(s.paid - s.items * s.price));
    case "scale": return String(r6(s.op === "sum" ? s.values[0] + s.values[1] : s.values[0] * s.values[1]));
    case "motion": return String(r6(s.find === "s" ? s.v * s.t : s.find === "v" ? s.v : s.t));
    case "density": return String(r6(s.m / s.V));
    case "weight": return String(r6(s.m * s.g));
    case "pressure": return String(r6(s.F / s.S));
    case "work": return String(r6(s.F * s.s));
    case "power": return String(r6(s.A / s.t));
    case "sign": return null;
  }
}

/** Uzbek number format: decimal comma, thin-space thousands from 10 000 ("4,5", "80 000"). */
export function uzNum(n: number): string {
  const x = r6(n);
  const [i, d] = String(Math.abs(x)).split(".");
  const int = i.length > 4 ? i.replace(/\B(?=(\d{3})+(?!\d))/g, " ") : i;
  return `${x < 0 ? "−" : ""}${int}${d ? `,${d}` : ""}`;
}

/** Any "1.5"-style decimal in a text → "1,5" (questions, choices and labels are written for Uzbek readers). */
export const uzText = (s: string) => s.replace(/(\d)\.(\d)/g, "$1,$2");
