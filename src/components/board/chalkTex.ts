// Tokeniser for the simple TeX the tutor uses (fractions, + − = · ×, %, powers).
// The handwriting engine writes these tokens stroke by stroke; anything fancier is flattened to text.

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

