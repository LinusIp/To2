// Board-to-speech narrator: everything the chalkboard shows, as Uzbek sentences (voice-first mode +
// screen readers). Formulas go through speakMath (the same words the tutor's voice uses), extended
// for letters with powers ("x²" → "iks kvadrat"), roots and π. Pure + tested (narrator.test.ts).
import { speakMath, numberWords } from "@/lib/ai/speakMath";
import type { BoardEl } from "@/lib/board/model";

const LETTER_NAMES: Record<string, string> = { x: "iks", y: "igrek", a: "a", b: "be", n: "en", c: "se", m: "em", k: "ka" };

/** One formula / line of board text → spoken Uzbek. "x² − 5x + 6 = 0" → "iks kvadrat minus besh iks qo'shuv olti teng nol". */
export function narrateFormula(input: string): string {
  let s = ` ${input.trim()} `;
  // normalise symbols the handwriting uses
  s = s.replace(/\^2/g, "²").replace(/\^3/g, "³").replace(/\*\*/g, "^");
  // √16 / √(x+1)
  s = s.replace(/√\s*\(([^)]*)\)/g, (_, e) => ` ildiz ostida ${e} ,`).replace(/√\s*(\d+|[a-z])/g, (_, e) => ` ${e} ning ildizi `);
  s = s.replace(/π/g, " pi ").replace(/≈/g, " taxminan ").replace(/≠/g, " teng emas ");
  // products of letters: "2ab" → "2 a b"
  s = s.replace(/(^|[^\p{L}])(\d*)([abcxy]{2,3})(?=[^\p{L}]|$)/gu, (_, p, n, vs) => `${p}${n ? n + " " : ""}${vs.split("").join(" ")}`);
  // letter powers: x² → "iks kvadrat", (x+1)² → "…, kvadrat"; 2x² → "ikki iks kvadrat"
  s = s.replace(/(\d*)([a-z])²/g, (_, n, v) => `${n ? n + " " : ""}${v} kvadrat`).replace(/(\d*)([a-z])³/g, (_, n, v) => `${n ? n + " " : ""}${v} kub`);
  s = s.replace(/\)\s*²/g, ") kvadrat").replace(/\)\s*³/g, ") kub");
  // 3y → "3 y" so speakMath's number pass reads it; then the letter name
  s = s.replace(/(\d)\s*([abcmnky])\b/g, "$1 $2");
  s = s.replace(/(^|[\s(])([abcmnky])(?=[\s.,?)=+−-]|$)/g, (_, p, v) => `${p}${LETTER_NAMES[v]}`);
  // a binary minus is "minus" when read off the board (the voice of a teacher reading a formula)
  let out = speakMath(s).replace(/\bayiruv\b/g, "minus");
  out = out.replace(/\bning ildizi\b/g, "ning ildizi").replace(/\s+,/g, ",");
  return out.replace(/\s+/g, " ").trim();
}

/** One board element → a short phrase ("" = nothing worth saying, e.g. a divider). */
export function narrateEl(el: Pick<BoardEl, "cmd">): string {
  const c = el.cmd as unknown as Record<string, unknown> & { op: string };
  switch (c.op) {
    case "write":
      return narrateFormula(String(c.text ?? ""));
    case "latex":
      return narrateFormula(String(c.tex ?? "").replace(/\\frac\{([^}]*)\}\{([^}]*)\}/g, "$1/$2").replace(/\\cdot|\\times/g, "·").replace(/[{}\\]/g, ""));
    case "fractionbar": {
      const parts = Number(c.parts);
      const filled = Number(c.filled);
      return `kasr chizig'i: ${numberWords(parts)} bo'lakdan ${numberWords(filled)} tasi bo'yalgan, ya'ni ${narrateFormula(`${filled}/${parts}`)}`;
    }
    case "numberline": {
      const marks = Array.isArray(c.marks) && c.marks.length ? `, belgilangan: ${(c.marks as number[]).map((m) => narrateFormula(String(m))).join(", ")}` : "";
      return `son o'qi ${narrateFormula(String(c.min))} dan ${narrateFormula(String(c.max))} gacha${marks}`;
    }
    case "plot":
      return `grafik: igrek teng ${narrateFormula(String(c.fn ?? ""))}`;
    case "rect":
      return "to'g'ri to'rtburchak";
    case "circle":
      return c.target ? "" : "doira";
    case "ellipse":
      return "ellips";
    case "tick":
      return "to'g'ri belgisi";
    case "strike":
      return "";
    default:
      return ""; // line, arrow, divider, wipe…: shapes the words already explain
  }
}

/** The board (in reading order: top → bottom, left → right) as sentences. Only the main layer + notes. */
export function narrateBoard(els: Pick<BoardEl, "cmd" | "layer" | "id">[], opts: { only?: Set<string> } = {}): string {
  const rows = els
    .filter((e) => !opts.only || opts.only.has(e.id))
    .map((e) => ({ e, y: num((e.cmd as unknown as { y?: number; from?: [number, number] }).y ?? (e.cmd as { from?: [number, number] }).from?.[1]), x: num((e.cmd as unknown as { x?: number }).x) }))
    .sort((a, b) => (Math.abs(a.y - b.y) < 30 ? a.x - b.x : a.y - b.y));
  const main = rows.filter((r) => r.e.layer !== "note").map((r) => narrateEl(r.e)).filter(Boolean);
  const notes = rows.filter((r) => r.e.layer === "note").map((r) => narrateEl(r.e)).filter(Boolean);
  const parts: string[] = [];
  if (main.length) parts.push(`Doskada: ${main.join(". ")}.`);
  if (notes.length) parts.push(`Savolingizga javob: ${notes.join(". ")}.`);
  return parts.join(" ");
}

/** One board element as TYPED text, exactly as written (typed board): "1/2 + 1/3", "▭ 3/6". "" = a shape. */
export function typedEl(el: Pick<BoardEl, "cmd">): string {
  const c = el.cmd as unknown as Record<string, unknown> & { op: string };
  if (c.op === "write") return String(c.text ?? "");
  if (c.op === "latex") return String(c.tex ?? "").replace(/\\frac\{([^}]*)\}\{([^}]*)\}/g, "$1/$2").replace(/\\cdot|\\times/g, "·").replace(/[{}\\]/g, "");
  if (c.op === "fractionbar") return `▭ ${c.filled}/${c.parts}`;
  if (c.op === "plot") return `y = ${c.fn}`;
  if (c.op === "numberline") return `${c.min} … ${c.max}`;
  return "";
}

/** The board as typed lines in reading order (top → bottom, left → right; same row = one line). */
export function boardLines(els: Pick<BoardEl, "cmd" | "layer" | "id">[]): { main: string[]; note: string[] } {
  const rows = els
    .map((e) => ({ e, y: num((e.cmd as unknown as { y?: number }).y), x: num((e.cmd as unknown as { x?: number }).x), text: typedEl(e) }))
    .filter((r) => r.text)
    .sort((a, b) => (Math.abs(a.y - b.y) < 30 ? a.x - b.x : a.y - b.y));
  const join = (rs: typeof rows) => {
    const out: { y: number; parts: string[] }[] = [];
    for (const r of rs) {
      const last = out[out.length - 1];
      if (last && Math.abs(last.y - r.y) < 30) last.parts.push(r.text);
      else out.push({ y: r.y, parts: [r.text] });
    }
    return out.map((l) => l.parts.join("   "));
  };
  return { main: join(rows.filter((r) => r.e.layer !== "note")), note: join(rows.filter((r) => r.e.layer === "note")) };
}

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);

/** A quiz question with options, for voice-first mode: "… A javob: oltidan besh. B javob: …" */
export function narrateQuestion(q: string, choices?: string[]): string {
  const head = narrateFormula(q);
  if (!choices?.length) return `${head} Javobni ayting yoki yozing.`;
  const opts = choices.map((c, i) => `${"ABCD"[i] ?? i + 1} javob: ${narrateFormula(c)}.`).join(" ");
  return `${head} ${opts} Harfni ayting, masalan: «javob A».`;
}

const ORDINALS = ["Birinchi", "Ikkinchi", "Uchinchi", "To'rtinchi", "Beshinchi", "Oltinchi"];

/** A game question (buttons numbered 1–4): "… Birinchi javob: oltidan besh. Ikkinchi javob: …" */
export function narrateGameQuestion(q: string, choices: string[]): string {
  const head = q.trim() ? narrateFormula(q) : "";
  const opts = choices.map((c, i) => `${ORDINALS[i] ?? i + 1} javob: ${narrateFormula(c)}.`).join(" ");
  return [head, opts, "Raqamini ayting, masalan: «javob bir»."].filter(Boolean).join(" ");
}
