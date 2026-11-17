// Handwriting engine (CLAUDE.md §5b): every board command becomes single-line chalk STROKES
// (polylines in board coordinates) that are revealed in writing order at hand speed.
// Pure functions — no DOM — so stroke lengths and the chalk-tip position are exact and testable.
import glyphData from "./glyphs.json";
import type { BoardCommand, Color, DrawCommand } from "@/lib/ai/schema";
import { FONT_PX, bbox } from "@/lib/board/model";
import { tokenizeTex } from "./chalkTex";

export type Pt = [number, number];
export interface Stroke {
  pts: Pt[];
  color: Color | "dim";
  width: number;
  len: number;
}

type GlyphTable = Record<string, { w: number; s: Pt[][] }>;
const GLYPHS = glyphData as unknown as GlyphTable;

/** Seeded RNG per element so re-renders don't jitter, but every lesson run looks different. */
export function rngFrom(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export type Rng = () => number;
const between = (r: Rng, a: number, b: number) => a + r() * (b - a);

function polyLen(p: Pt[]) {
  let l = 0;
  for (let i = 1; i < p.length; i++) l += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]);
  return l;
}
const mk = (pts: Pt[], color: Stroke["color"], width = 4): Stroke => ({ pts, color, width, len: Math.max(1, polyLen(pts)) });

// ── extra glyphs not in ASCII (cap height 100, baseline y = 100) ─────────────
const EXTRA: GlyphTable = {
  "−": { w: 62, s: [[[8, 62], [54, 62]]] },
  "×": { w: 58, s: [[[10, 42], [48, 82]], [[48, 42], [10, 82]]] },
  "·": { w: 26, s: [[[13, 60], [13.6, 63]]] },
  "÷": { w: 62, s: [[[8, 62], [54, 62]], [[31, 38], [31.6, 41]], [[31, 82], [31.6, 85]]] },
  "≈": { w: 62, s: [[[6, 54], [18, 48], [31, 54], [44, 60], [56, 54]], [[6, 72], [18, 66], [31, 72], [44, 78], [56, 72]]] },
  "≠": { w: 62, s: [[[8, 52], [54, 52]], [[8, 74], [54, 74]], [[40, 36], [22, 90]]] },
  "≤": { w: 58, s: [[[50, 36], [8, 56], [50, 76]], [[8, 90], [50, 90]]] },
  "≥": { w: 58, s: [[[8, 36], [50, 56], [8, 76]], [[8, 90], [50, 90]]] },
  "√": { w: 70, s: [[[4, 66], [14, 60], [28, 100], [48, 4], [70, 4]]] },
  "π": { w: 64, s: [[[6, 44], [16, 38], [58, 38]], [[22, 38], [20, 70], [14, 100]], [[44, 38], [44, 86], [54, 100]]] },
  "✓": { w: 70, s: [[[6, 60], [24, 86], [66, 20]]] },
  "°": { w: 30, s: [[[15, 4], [6, 10], [6, 20], [15, 26], [24, 20], [24, 10], [15, 4]]] },
  "…": { w: 70, s: [[[10, 96], [10.6, 99]], [[34, 96], [34.6, 99]], [[58, 96], [58.6, 99]]] },
  "—": { w: 90, s: [[[6, 60], [84, 60]]] },
  "–": { w: 70, s: [[[6, 60], [64, 60]]] },
};
const SUPER: Record<string, string> = { "²": "2", "³": "3", "¹": "1" };
const ALIAS: Record<string, string> = { "ʻ": "'", "’": "'", "‘": "'", "`": "'", "ʼ": "'", "«": '"', "»": '"', "“": '"', "”": '"' };

function glyph(ch: string) {
  return EXTRA[ch] ?? GLYPHS[ch] ?? GLYPHS[ALIAS[ch] ?? ""] ?? GLYPHS[ch.normalize("NFD")[0]] ?? null;
}

/** Cap height in px for a font size. */
export const capOf = (fs: number) => fs * 0.8;

export interface TextLayout {
  strokes: Stroke[];
  width: number;
}

/**
 * Lay out handwritten text. (x, top) = top-left of the line box (board convention).
 * Per glyph: rotate ±3°, scale 0.96–1.04, baseline ±2% — "the same lesson never looks identical twice".
 */
export function writeText(text: string, x: number, top: number, fs: number, color: Stroke["color"], r: Rng, width = fs >= 50 ? 5.5 : 4.5): TextLayout {
  const cap = capOf(fs);
  const baseline = top + fs * 0.82;
  const k = cap / 100;
  const out: Stroke[] = [];
  let cx = x;
  for (const ch0 of text) {
    const sup = SUPER[ch0];
    const ch = sup ?? ch0;
    if (ch === " ") {
      cx += fs * 0.32;
      continue;
    }
    const g = glyph(ch);
    if (!g) {
      cx += fs * 0.3;
      continue;
    }
    const s = (sup ? k * 0.58 : k) * between(r, 0.96, 1.04);
    const rot = (between(r, -3, 3) * Math.PI) / 180;
    const by = (sup ? baseline - cap * 0.55 : baseline) + between(r, -0.02, 0.02) * cap;
    const cxg = (g.w / 2) * s;
    const cos = Math.cos(rot);
    const sin = Math.sin(rot);
    for (const st of g.s) {
      const pts: Pt[] = st.map(([gx, gy]) => {
        // glyph space: baseline at y=100 → local y = gy-100 (negative = up)
        const lx = gx * s - cxg;
        const ly = (gy - 100) * s;
        return [cx + cxg + lx * cos - ly * sin, by + lx * sin + ly * cos];
      });
      if (pts.length === 1) pts.push([pts[0][0] + 0.6, pts[0][1] + 1.2]);
      out.push(mk(pts, color, width));
    }
    cx += g.w * (sup ? k * 0.58 : k) + fs * 0.05;
  }
  return { strokes: out, width: cx - x };
}

/** Slightly bent line (hand-drawn). */
export function wobblyLine(a: Pt, b: Pt, r: Rng, bend = 4): Pt[] {
  const mx = (a[0] + b[0]) / 2 + between(r, -bend, bend);
  const my = (a[1] + b[1]) / 2 + between(r, -bend, bend);
  const pts: Pt[] = [];
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    const u = 1 - t;
    pts.push([u * u * a[0] + 2 * u * t * mx + t * t * b[0], u * u * a[1] + 2 * u * t * my + t * t * b[1]]);
  }
  return pts;
}

/** Hand-drawn ellipse that overshoots its closing point. */
export function chalkEllipse(cx: number, cy: number, rx: number, ry: number, r: Rng): Pt[] {
  const n = 46;
  const st = between(r, -0.6, -0.2);
  const pts: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const t = st + (i / n) * Math.PI * 2.18;
    const j = 1 + Math.sin(i * 0.7) * 0.025 + between(r, -0.012, 0.012);
    pts.push([cx + Math.cos(t) * rx * j, cy + Math.sin(t) * ry * j * (1 + (i / n) * 0.06)]);
  }
  return pts;
}

export function arrowHead(from: Pt, to: Pt, L = 18): Pt[] {
  const a = Math.atan2(to[1] - from[1], to[0] - from[0]);
  return [
    [to[0] - L * Math.cos(a - 0.45), to[1] - L * Math.sin(a - 0.45)],
    to,
    [to[0] - L * Math.cos(a + 0.45), to[1] - L * Math.sin(a + 0.45)],
  ];
}

export function tickPts(x: number, y: number): Pt[] {
  return [
    [x, y],
    [x + 14, y + 18],
    [x + 44, y - 26],
  ];
}

const niceStep = (range: number) => {
  const raw = range / 10;
  const mag = 10 ** Math.floor(Math.log10(raw || 1));
  const n = raw / mag;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * mag;
};

/** Hand-lettered math: fractions stacked with a chalk bar, everything else written inline. */
function writeMath(tex: string, x: number, top: number, fs: number, color: Stroke["color"], r: Rng): TextLayout {
  const toks = tokenizeTex(tex);
  if (!toks) {
    const plain = tex
      .replace(/\\frac\{([^}]*)\}\{([^}]*)\}/g, "$1/$2")
      .replace(/\\sqrt\{([^}]*)\}/g, "√$1")
      .replace(/\\(cdot|times)/g, "·")
      .replace(/\\pi/g, "π")
      .replace(/\\[a-zA-Z]+/g, "")
      .replace(/[{}]/g, "");
    return writeText(plain, x, top, fs, color, r);
  }
  const hasFrac = toks.some((t) => t.t === "frac");
  const lineTop = hasFrac ? top + fs * 0.7 : top;
  const strokes: Stroke[] = [];
  let cx = x;
  for (const tk of toks) {
    if (tk.t === "text") {
      const s = tk.s.replace(/\s*([+=−\-×·:≈≠<>])\s*/g, " $1 ").replace(/-/g, "−");
      const L = writeText(s, cx, lineTop, fs, color, r);
      strokes.push(...L.strokes);
      cx += L.width;
    } else if (tk.t === "sup") {
      const L = writeText(tk.s, cx, lineTop - fs * 0.35, fs * 0.58, color, r, 3);
      strokes.push(...L.strokes);
      cx += L.width + fs * 0.05;
    } else {
      const fsF = fs;
      // measure without committing randomness order too much
      const numL = writeText(tk.n, 0, 0, fsF, color, rngFrom(1));
      const denL = writeText(tk.d, 0, 0, fsF, color, rngFrom(2));
      const w = Math.max(numL.width, denL.width) + fs * 0.35;
      const num = writeText(tk.n, cx + (w - numL.width) / 2, top - fs * 0.02, fsF, color, r);
      strokes.push(...num.strokes);
      const barY = top + fs * 1.18;
      strokes.push(mk(wobblyLine([cx + fs * 0.05, barY], [cx + w - fs * 0.05, barY + between(r, -1.5, 1.5)], r, 1.5), color, fs >= 50 ? 5 : 4));
      const den = writeText(tk.d, cx + (w - denL.width) / 2, top + fs * 1.34, fsF, color, r);
      strokes.push(...den.strokes);
      cx += w + fs * 0.08;
    }
  }
  return { strokes, width: cx - x };
}

/** Optional evaluator for `plot` (mathjs, loaded lazily by the Board). */
export type PlotFn = ((x: number) => number) | null;

/** Convert one draw command into strokes, in writing order. */
export function strokesFor(cmd: DrawCommand, r: Rng, plotFn: PlotFn = null): Stroke[] {
  switch (cmd.op) {
    case "write":
      return writeText(cmd.text, cmd.x, cmd.y, FONT_PX[cmd.size ?? "m"], cmd.color ?? "ink", r).strokes;
    case "latex":
      return writeMath(cmd.tex, cmd.x, cmd.y, FONT_PX[cmd.size ?? "m"], cmd.color ?? "ink", r).strokes;
    case "line": {
      const pts = wobblyLine(cmd.from, cmd.to, r);
      const out = [mk(pts, cmd.color ?? "ink")];
      if (cmd.arrow) out.push(mk(arrowHead(pts[pts.length - 3], cmd.to), cmd.color ?? "ink"));
      return out;
    }
    case "rect": {
      const { x, y, w, h } = cmd;
      const o = () => between(r, 2, 7);
      const c = cmd.color ?? "ink";
      const out = [
        mk(wobblyLine([x - o(), y], [x + w + o(), y], r, 2), c),
        mk(wobblyLine([x + w, y - o()], [x + w, y + h + o()], r, 2), c),
        mk(wobblyLine([x + w + o(), y + h], [x - o(), y + h], r, 2), c),
        mk(wobblyLine([x, y + h + o()], [x, y - o()], r, 2), c),
      ];
      if (cmd.fill) out.push(...hatch(x, y, w, h, cmd.fill, r));
      return out;
    }
    case "circle":
    case "ellipse": {
      const rx = cmd.op === "circle" ? Math.min(cmd.w, cmd.h) / 2 : cmd.w / 2;
      const ry = cmd.op === "circle" ? Math.min(cmd.w, cmd.h) / 2 : cmd.h / 2;
      const out = [mk(chalkEllipse(cmd.x + cmd.w / 2, cmd.y + cmd.h / 2, rx, ry, r), cmd.color ?? "ink")];
      if (cmd.fill) out.push(...hatch(cmd.x + cmd.w / 2 - rx * 0.7, cmd.y + cmd.h / 2 - ry * 0.7, rx * 1.4, ry * 1.4, cmd.fill, r));
      return out;
    }
    case "fractionbar": {
      const h = cmd.h ?? 54;
      const pw = cmd.w / cmd.parts;
      const out: Stroke[] = [];
      if (cmd.label) out.push(...writeText(cmd.label, cmd.x, cmd.y - 40, 30, "ink", r, 3.5).strokes);
      out.push(
        mk(wobblyLine([cmd.x - 3, cmd.y], [cmd.x + cmd.w + 3, cmd.y], r, 2), "ink"),
        mk(wobblyLine([cmd.x + cmd.w, cmd.y - 3], [cmd.x + cmd.w, cmd.y + h + 3], r, 2), "ink"),
        mk(wobblyLine([cmd.x + cmd.w + 3, cmd.y + h], [cmd.x - 3, cmd.y + h], r, 2), "ink"),
        mk(wobblyLine([cmd.x, cmd.y + h + 3], [cmd.x, cmd.y - 3], r, 2), "ink"),
      );
      for (let i = 1; i < cmd.parts; i++) out.push(mk(wobblyLine([cmd.x + i * pw, cmd.y + 2], [cmd.x + i * pw, cmd.y + h - 2], r, 1.5), "ink", 3));
      for (let i = 0; i < Math.min(cmd.filled, cmd.parts); i++) out.push(...hatch(cmd.x + i * pw + 5, cmd.y + 5, pw - 10, h - 10, cmd.color ?? "blue", r));
      return out;
    }
    case "numberline": {
      const out: Stroke[] = [mk(wobblyLine([cmd.x, cmd.y], [cmd.x + cmd.w, cmd.y], r, 2), "ink")];
      out.push(mk(arrowHead([cmd.x, cmd.y], [cmd.x + cmd.w + 8, cmd.y], 14), "ink"));
      const step = niceStep(cmd.max - cmd.min);
      const X = (v: number) => cmd.x + ((v - cmd.min) / (cmd.max - cmd.min || 1)) * cmd.w;
      for (let v = Math.ceil(cmd.min / step) * step; v <= cmd.max + 1e-9; v += step) {
        const vv = Math.round(v * 1e6) / 1e6;
        out.push(mk([[X(vv), cmd.y - 10], [X(vv) + between(r, -1, 1), cmd.y + 10]], "ink", 3));
        const lbl = String(vv);
        const L = writeText(lbl, 0, 0, 24, "ink", rngFrom(3));
        out.push(...writeText(lbl, X(vv) - L.width / 2, cmd.y + 18, 24, "ink", r, 3).strokes);
      }
      for (const m of cmd.marks ?? []) {
        out.push(mk(chalkEllipse(X(m), cmd.y, 8, 8, r), "yellow", 4));
        const L = writeText(String(m), 0, 0, 26, "yellow", rngFrom(4));
        out.push(...writeText(String(m), X(m) - L.width / 2, cmd.y - 46, 26, "yellow", r, 3).strokes);
      }
      return out;
    }
    case "plot": {
      const { x, y, w, h, xRange, yRange } = cmd;
      const ax = x + ((0 - xRange[0]) / (xRange[1] - xRange[0])) * w;
      const ay = y + h - ((0 - yRange[0]) / (yRange[1] - yRange[0])) * h;
      const out: Stroke[] = [];
      if (ay >= y && ay <= y + h) out.push(mk(wobblyLine([x, ay], [x + w, ay], r, 2), "ink", 3), mk(arrowHead([x, ay], [x + w + 6, ay], 12), "ink", 3));
      if (ax >= x && ax <= x + w) out.push(mk(wobblyLine([ax, y + h], [ax, y], r, 2), "ink", 3), mk(arrowHead([ax, y + h], [ax, y - 6], 12), "ink", 3));
      if (plotFn) {
        let cur: Pt[] = [];
        for (let i = 0; i <= 80; i++) {
          const xv = xRange[0] + ((xRange[1] - xRange[0]) * i) / 80;
          const yv = plotFn(xv);
          const py = y + h - ((yv - yRange[0]) / (yRange[1] - yRange[0])) * h;
          if (!Number.isFinite(yv) || py < y - 4 || py > y + h + 4) {
            if (cur.length > 1) out.push(mk(cur, cmd.color ?? "yellow", 4));
            cur = [];
            continue;
          }
          cur.push([x + ((xv - xRange[0]) / (xRange[1] - xRange[0])) * w, py]);
        }
        if (cur.length > 1) out.push(mk(cur, cmd.color ?? "yellow", 4));
      }
      return out;
    }
    case "arrow": {
      // targets were resolved to points by the board model
      if (typeof cmd.from === "string" || typeof cmd.to === "string") return [];
      const from: Pt = cmd.from;
      const to: Pt = cmd.to;
      const bend = cmd.bend ?? 40;
      const mx = (from[0] + to[0]) / 2 + bend;
      const my = (from[1] + to[1]) / 2 - bend * 0.3;
      const curve: Pt[] = [];
      for (let i = 0; i <= 14; i++) {
        const t = i / 14;
        const u = 1 - t;
        curve.push([u * u * from[0] + 2 * u * t * mx + t * t * to[0], u * u * from[1] + 2 * u * t * my + t * t * to[1]]);
      }
      return [mk(curve, cmd.color ?? "yellow"), mk(arrowHead(curve[curve.length - 3], to), cmd.color ?? "yellow")];
    }
    case "tick":
      return [mk(tickPts(cmd.x, cmd.y), cmd.color ?? "green", 6)];
    case "divider":
      return [mk(wobblyLine([cmd.x, 40], [cmd.x + 2, 590], r, 3), "dim", 3)];
    case "strike": {
      // resolved by the board model into from/to
      if (!cmd.from || !cmd.to) return [];
      return [mk(wobblyLine(cmd.from, cmd.to, r, 3), cmd.color ?? "orange", 5)];
    }
  }
}

/** Chalk shading: quick diagonal strokes inside a box. */
export function hatch(x: number, y: number, w: number, h: number, color: Color, r: Rng): Stroke[] {
  const out: Stroke[] = [];
  const gap = 11;
  for (let d = gap / 2; d < w + h; d += gap) {
    const a: Pt = [x + Math.max(0, d - h), y + Math.min(h, d)];
    const b: Pt = [x + Math.min(w, d), y + Math.max(0, d - w)];
    if (Math.hypot(b[0] - a[0], b[1] - a[1]) < 4) continue;
    out.push(mk([a, [b[0] + between(r, -1.5, 1.5), b[1] + between(r, -1.5, 1.5)]], color, 3.5));
  }
  return out;
}

/** Smooth polyline → SVG path (midpoint quadratic curves). */
export function pathD(p: Pt[]): string {
  if (p.length < 3) return `M${p[0][0].toFixed(1)},${p[0][1].toFixed(1)}` + p.slice(1).map((q) => ` L${q[0].toFixed(1)},${q[1].toFixed(1)}`).join("");
  let d = `M${p[0][0].toFixed(1)},${p[0][1].toFixed(1)}`;
  for (let i = 1; i < p.length - 1; i++) {
    const mx = (p[i][0] + p[i + 1][0]) / 2;
    const my = (p[i][1] + p[i + 1][1]) / 2;
    d += ` Q${p[i][0].toFixed(1)},${p[i][1].toFixed(1)} ${mx.toFixed(1)},${my.toFixed(1)}`;
  }
  const l = p[p.length - 1];
  return d + ` L${l[0].toFixed(1)},${l[1].toFixed(1)}`;
}

/** Point at length `l` along a polyline. */
export function pointAt(p: Pt[], l: number): Pt {
  let acc = 0;
  for (let i = 1; i < p.length; i++) {
    const seg = Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]);
    if (acc + seg >= l) {
      const t = seg ? (l - acc) / seg : 0;
      return [p[i - 1][0] + (p[i][0] - p[i - 1][0]) * t, p[i - 1][1] + (p[i][1] - p[i - 1][1]) * t];
    }
    acc += seg;
  }
  return p[p.length - 1];
}

/** Pen-lift gap between strokes, in "length units" (so pauses scale with the element's timing). */
const GAP = 18;

/** For progress p∈[0,1] of an element: how much of each stroke is drawn, and where the chalk tip is. */
export function progressOf(strokes: Stroke[], p: number): { drawn: number[]; tip: Pt | null } {
  const total = strokes.reduce((a, s) => a + s.len + GAP, 0);
  let left = p * total;
  const drawn: number[] = [];
  let tip: Pt | null = null;
  for (const s of strokes) {
    if (left <= 0) {
      drawn.push(0);
      continue;
    }
    const d = Math.min(s.len, left);
    drawn.push(d);
    if (d < s.len) tip = pointAt(s.pts, d);
    else if (left - s.len < GAP && p < 1) tip = s.pts[s.pts.length - 1];
    left -= s.len + GAP;
  }
  return { drawn, tip: p >= 1 ? null : tip };
}

/** Bounding box helper re-exported for the board (highlights, strikes). */
export { bbox };
export type { BoardCommand };
