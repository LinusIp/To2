// Answer checking with mathjs — never trust the LLM alone for correctness.
import { create, all } from "mathjs";
import type { Expect } from "@/lib/ai/schema";

const math = create(all, { number: "number" });

/** Normalise what a learner (or the LLM) typed: Uzbek decimal comma, unicode minus, "x =", mixed numbers. */
export function normalize(input: string, stripUnits = true): string {
  let s = input
    .trim()
    .toLowerCase()
    .replace(/[−–—]/g, "-")
    .replace(/[×·]/g, "*")
    .replace(/[÷:]/g, "/")
    .replace(/²/g, "^2")
    .replace(/³/g, "^3")
    .replace(/\s+/g, " ");
  // "x = 4" / "y=4" → "4"
  s = s.replace(/^[a-z]\s*=\s*/, "");
  // decimal comma "0,5" → "0.5" (only between digits)
  s = s.replace(/(\d),(\d)/g, "$1.$2");
  // mixed number "1 1/2" → "(1+1/2)"
  s = s.replace(/^(-?)(\d+)\s+(\d+)\/(\d+)$/, (_, sg: string, w: string, n: string, d: string) => `${sg}(${w}+${n}/${d})`);
  // trailing units like "sm", "m²", "so'm" — numeric answers only, before implicit multiplication
  if (stripUnits) s = s.replace(/\s*(sm\^?2?|m\^?2?|so'm|gradus|°|yosh|ta)\s*$/i, "");
  // implicit multiplication "2x" → "2*x"
  s = s.replace(/(\d)([a-z(])/g, "$1*$2");
  return s.trim();
}

function evalNum(s: string): number | null {
  try {
    const v = math.evaluate(s);
    return typeof v === "number" && Number.isFinite(v) ? v : null;
  } catch {
    return null;
  }
}

const close = (a: number, b: number) => Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(a), Math.abs(b));

/** Compare two expressions in x/y/a/b by sampling points (robust, no CAS needed). */
function sameExpression(a: string, b: string): boolean {
  let fa: { evaluate: (s: object) => unknown }, fb: { evaluate: (s: object) => unknown };
  try {
    fa = math.compile(a) as unknown as typeof fa;
    fb = math.compile(b) as unknown as typeof fb;
  } catch {
    return false;
  }
  const vars = new Set<string>();
  for (const src of [a, b]) {
    try {
      math.parse(src).traverse((node) => {
        const n = node as unknown as { isSymbolNode?: boolean; name?: string };
        if (n.isSymbolNode && n.name && !(n.name in Math) && n.name !== "pi" && n.name !== "e") vars.add(n.name);
      });
    } catch {
      return false;
    }
  }
  const pts = [-2.5, -1, 0, 0.5, 1.7, 3, 4.2];
  for (const x of pts) {
    const scope: Record<string, number> = {};
    [...vars].sort().forEach((v, i) => (scope[v] = x * (1 + i * 0.37) + i * 0.71));
    let va: unknown, vb: unknown;
    try {
      va = fa.evaluate({ ...scope });
      vb = fb.evaluate({ ...scope });
    } catch {
      return false;
    }
    if (typeof va !== "number" || typeof vb !== "number" || !close(va, vb)) return false;
  }
  return true;
}

export interface CheckResult {
  correct: boolean;
  /** learner answer could not be read at all (e.g. empty) */
  unreadable?: boolean;
}

export function checkAnswer(expect: Expect, given: string): CheckResult {
  const raw = given.trim();
  if (!raw) return { correct: false, unreadable: true };

  if (expect.kind === "choice") {
    const norm = (s: string) => s.trim().toLowerCase().replace(/[’`ʻʼ‘]/g, "'").replace(/\s+/g, " ");
    if (norm(raw) === norm(expect.answer)) return { correct: true };
    // numeric choices (e.g. "-3" vs "−3")
    const a = evalNum(normalize(raw));
    const b = evalNum(normalize(expect.answer));
    return { correct: a !== null && b !== null && close(a, b) };
  }

  const isExpr = expect.kind === "expression";
  const g = normalize(raw, !isExpr);
  const e = normalize(expect.answer, !isExpr);

  if (isExpr) {
    return { correct: sameExpression(g, e) };
  }

  // number / fraction: compare values (equivalent fractions accepted: 2/4 == 1/2)
  const a = evalNum(g);
  const b = evalNum(e);
  if (a === null) return { correct: false, unreadable: true };
  if (b === null) return { correct: false };
  return { correct: close(a, b) };
}
