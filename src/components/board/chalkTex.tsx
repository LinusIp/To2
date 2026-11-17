// Tiny "chalk math" layout for the simple TeX the tutor uses (fractions, + − = · ×, %, powers).
// Renders in the Kalam chalk font like the mockup. Anything fancier falls back to KaTeX.
import type { ReactNode } from "react";

type Tok = { t: "text"; s: string } | { t: "frac"; n: string; d: string } | { t: "sup"; s: string };

const SYMBOLS: Record<string, string> = {
  "\\cdot": "·",
  "\\times": "×",
  "\\div": ":",
  "\\%": "%",
  "\\pi": "π",
  "\\le": "≤",
  "\\ge": "≥",
  "\\neq": "≠",
  "\\approx": "≈",
  "\\,": " ",
  "\\;": " ",
  "\\quad": "  ",
  "\\left": "",
  "\\right": "",
  "\\checkmark": "✓",
};

function readGroup(src: string, i: number): [string, number] | null {
  if (src[i] !== "{") return null;
  let depth = 0;
  for (let j = i; j < src.length; j++) {
    if (src[j] === "{") depth++;
    else if (src[j] === "}" && --depth === 0) return [src.slice(i + 1, j), j + 1];
  }
  return null;
}

const simple = (s: string) => !/[\\{}^_]/.test(simplifySymbols(s));
function simplifySymbols(s: string) {
  return s.replace(/\\[a-z%,;]+/gi, (m) => (m in SYMBOLS ? SYMBOLS[m] : m));
}

/** Tokenise; returns null if the TeX needs real KaTeX. */
export function tokenizeTex(tex: string): Tok[] | null {
  const out: Tok[] = [];
  let buf = "";
  const flush = () => {
    if (buf) out.push({ t: "text", s: buf });
    buf = "";
  };
  let i = 0;
  while (i < tex.length) {
    if (tex.startsWith("\\frac", i) || tex.startsWith("\\dfrac", i) || tex.startsWith("\\tfrac", i)) {
      i += tex.startsWith("\\frac", i) ? 5 : 6;
      while (tex[i] === " ") i++;
      const a = readGroup(tex, i);
      if (!a) return null;
      let j = a[1];
      while (tex[j] === " ") j++;
      const b = readGroup(tex, j);
      if (!b) return null;
      const n = simplifySymbols(a[0]);
      const d = simplifySymbols(b[0]);
      if (!simple(n) || !simple(d)) return null;
      flush();
      out.push({ t: "frac", n, d });
      i = b[1];
      continue;
    }
    if (tex[i] === "^") {
      const g = readGroup(tex, i + 1);
      const s = g ? g[0] : tex[i + 1] ?? "";
      if (!simple(s)) return null;
      flush();
      out.push({ t: "sup", s: simplifySymbols(s) });
      i = g ? g[1] : i + 2;
      continue;
    }
    if (tex[i] === "\\") {
      const m = tex.slice(i).match(/^\\([a-z]+|[%,;{}])/i);
      if (!m) return null;
      const key = m[0];
      if (key in SYMBOLS) {
        buf += SYMBOLS[key];
        i += key.length;
        continue;
      }
      if (key === "\\{" || key === "\\}") {
        buf += key[1];
        i += 2;
        continue;
      }
      return null; // \sqrt, \sum… → KaTeX
    }
    if (tex[i] === "{" || tex[i] === "}") {
      i++;
      continue;
    }
    if (tex[i] === "_") return null;
    buf += tex[i] === "*" ? "·" : tex[i];
    i++;
  }
  flush();
  return out;
}

const CHAR_W = 0.5; // Kalam average glyph width / font size

function textWidth(s: string, fs: number) {
  let w = 0;
  for (const ch of s) w += ch === " " ? 0.28 : /[·:]/.test(ch) ? 0.32 : /[+=−\-×]/.test(ch) ? 0.62 : CHAR_W;
  return w * fs;
}

export interface ChalkTexLayout {
  nodes: ReactNode;
  width: number;
  height: number;
}

/** Lay out tokens at (x, y) = top-left. */
export function layoutChalkTex(toks: Tok[], x: number, y: number, fs: number, fill: string): ChalkTexLayout {
  const hasFrac = toks.some((t) => t.t === "frac");
  const height = hasFrac ? fs * 2.4 : fs * 1.15;
  const mid = hasFrac ? y + fs * 1.55 : y + fs * 0.88; // baseline for inline text
  let cx = x;
  const nodes: ReactNode[] = [];
  toks.forEach((tk, k) => {
    if (tk.t === "text") {
      // pad operators like the mockup ("1/2  +  1/3")
      const s = tk.s.replace(/\s*([+=−\-×·:≈≠])\s*/g, " $1 ");
      nodes.push(
        <text key={k} x={cx} y={mid} fontSize={fs} fill={fill} xmlSpace="preserve">
          {s}
        </text>,
      );
      cx += textWidth(s, fs);
    } else if (tk.t === "sup") {
      nodes.push(
        <text key={k} x={cx} y={mid - fs * 0.45} fontSize={fs * 0.6} fill={fill}>
          {tk.s}
        </text>,
      );
      cx += textWidth(tk.s, fs * 0.6) + fs * 0.05;
    } else {
      const w = Math.max(textWidth(tk.n, fs), textWidth(tk.d, fs)) + fs * 0.3;
      const c = cx + w / 2;
      nodes.push(
        <g key={k}>
          <text x={c} y={y + fs * 0.95} fontSize={fs} fill={fill} textAnchor="middle">
            {tk.n}
          </text>
          <line x1={cx + fs * 0.05} x2={cx + w - fs * 0.05} y1={y + fs * 1.22} y2={y + fs * 1.22} stroke={fill} strokeWidth={Math.max(3, fs / 12)} strokeLinecap="round" />
          <text x={c} y={y + fs * 2.25} fontSize={fs} fill={fill} textAnchor="middle">
            {tk.d}
          </text>
        </g>,
      );
      cx += w;
    }
  });
  return { nodes, width: cx - x, height };
}
