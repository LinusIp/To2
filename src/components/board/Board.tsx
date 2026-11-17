"use client";
// SVG board: renders BoardState in a fixed 1000×625 viewBox (scales on every screen).
// Strokes animate in via stroke-dashoffset (pathLength=1); text reveals left→right via clipPath.
import { memo, useEffect, useMemo, useState } from "react";
import rough from "roughjs";
import type { Color } from "@/lib/ai/schema";
import { BOARD_H, BOARD_W, FONT_PX, bbox, type BoardEl, type BoardState } from "@/lib/board/model";
import { layoutChalkTex, tokenizeTex } from "./chalkTex";
import { PALETTE, type BoardTheme } from "./palette";

const gen = rough.generator();

function seedOf(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0) % 2 ** 31;
}

const safeId = (k: string) => k.replace(/[^a-zA-Z0-9_-]/g, "_");

type Pal = (typeof PALETTE)["chalk"];
const col = (pal: Pal, c: Color | undefined, d: Color = "ink") => pal[c ?? d] ?? pal.ink;

/** rough.js drawable → animated <path>s */
function RoughPaths({ drawable, p, width = 3.2 }: { drawable: ReturnType<typeof gen.rectangle>; p: number; width?: number }) {
  const paths = useMemo(() => gen.toPaths(drawable), [drawable]);
  return (
    <>
      {paths.map((ps, i) => (
        <path
          key={i}
          d={ps.d}
          stroke={ps.stroke === "none" ? undefined : ps.stroke}
          strokeWidth={ps.stroke === "none" ? 0 : width}
          fill={ps.fill ?? "none"}
          strokeLinecap="round"
          strokeLinejoin="round"
          pathLength={1}
          strokeDasharray={ps.stroke === "none" ? undefined : 1}
          strokeDashoffset={ps.stroke === "none" ? undefined : 1 - p}
          opacity={ps.stroke === "none" ? p : 1}
        />
      ))}
    </>
  );
}

function Reveal({ id, x, y, w, h, p, children }: { id: string; x: number; y: number; w: number; h: number; p: number; children: React.ReactNode }) {
  if (p >= 1) return <>{children}</>;
  const cid = `clip-${safeId(id)}`;
  return (
    <>
      <clipPath id={cid}>
        <rect x={x - 10} y={y - 10} width={Math.max(0, (w + 20) * p)} height={h + 40} />
      </clipPath>
      <g clipPath={`url(#${cid})`}>{children}</g>
    </>
  );
}

function niceStep(range: number) {
  const raw = range / 10;
  const mag = 10 ** Math.floor(Math.log10(raw || 1));
  const n = raw / mag;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * mag;
}

function Katex({ tex, x, y, fs, color, p }: { tex: string; x: number; y: number; fs: number; color: string; p: number }) {
  const [html, setHtml] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    Promise.all([import("katex"), import("katex/dist/katex.min.css")]).then(([k]) => {
      if (alive) setHtml(k.default.renderToString(tex, { throwOnError: false, output: "html" }));
    });
    return () => {
      alive = false;
    };
  }, [tex]);
  const w = Math.max(200, tex.length * fs * 0.4);
  return (
    <Reveal id={`k-${x}-${y}`} x={x} y={y} w={w} h={fs * 2.4} p={p}>
      <foreignObject x={x} y={y} width={w} height={fs * 2.6}>
        <div style={{ color, fontSize: fs * 0.8, lineHeight: 1.2 }} dangerouslySetInnerHTML={{ __html: html ?? tex }} />
      </foreignObject>
    </Reveal>
  );
}

function Plot({ el, pal, p }: { el: Extract<BoardEl["cmd"], { op: "plot" }>; pal: Pal; p: number }) {
  const [pts, setPts] = useState<string>("");
  const { x, y, w, h, fn, xRange, yRange } = el;
  useEffect(() => {
    let alive = true;
    import("mathjs").then((m) => {
      try {
        const f = m.compile(fn.replace(/^y\s*=\s*/i, ""));
        const out: string[] = [];
        for (let i = 0; i <= 120; i++) {
          const xv = xRange[0] + ((xRange[1] - xRange[0]) * i) / 120;
          const yv = Number(f.evaluate({ x: xv }));
          if (!Number.isFinite(yv)) continue;
          const px = x + ((xv - xRange[0]) / (xRange[1] - xRange[0])) * w;
          const py = y + h - ((yv - yRange[0]) / (yRange[1] - yRange[0])) * h;
          if (py < y - 5 || py > y + h + 5) continue;
          out.push(`${out.length ? "L" : "M"}${px.toFixed(1)},${py.toFixed(1)}`);
        }
        if (alive) setPts(out.join(" "));
      } catch {
        console.warn("[board] bad plot fn", fn);
      }
    });
    return () => {
      alive = false;
    };
  }, [fn, x, y, w, h, xRange, yRange]);
  const ax = x + ((0 - xRange[0]) / (xRange[1] - xRange[0])) * w;
  const ay = y + h - ((0 - yRange[0]) / (yRange[1] - yRange[0])) * h;
  const c = col(pal, el.color, "yellow");
  return (
    <g>
      <g stroke={pal.ink} strokeWidth={2.5} opacity={0.8} strokeDasharray={1} pathLength={1}>
        {ay >= y && ay <= y + h && <line x1={x} x2={x + w} y1={ay} y2={ay} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - Math.min(1, p * 3)} />}
        {ax >= x && ax <= x + w && <line x1={ax} x2={ax} y1={y} y2={y + h} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - Math.min(1, p * 3)} />}
      </g>
      {pts && <path d={pts} fill="none" stroke={c} strokeWidth={4} strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - Math.max(0, (p - 0.3) / 0.7)} />}
    </g>
  );
}

const Element = memo(function Element({ el, p, pal }: { el: BoardEl; p: number; pal: Pal }) {
  const c = el.cmd;
  const seed = seedOf(el.key);
  let body: React.ReactNode = null;

  switch (c.op) {
    case "write": {
      const fs = FONT_PX[c.size ?? "m"];
      const b = bbox(c);
      body = (
        <Reveal id={el.key} x={b.x} y={b.y} w={b.w} h={b.h} p={p}>
          <text x={c.x} y={c.y + fs * 0.88} fontSize={fs} fill={col(pal, c.color)} xmlSpace="preserve">
            {c.text}
          </text>
        </Reveal>
      );
      break;
    }
    case "latex": {
      const fs = FONT_PX[c.size ?? "m"];
      const toks = tokenizeTex(c.tex);
      if (!toks) {
        body = <Katex tex={c.tex} x={c.x} y={c.y} fs={fs} color={col(pal, c.color)} p={p} />;
        break;
      }
      const lay = layoutChalkTex(toks, c.x, c.y, fs, col(pal, c.color));
      body = (
        <Reveal id={el.key} x={c.x} y={c.y} w={lay.width} h={lay.height} p={p}>
          {lay.nodes}
        </Reveal>
      );
      break;
    }
    case "line": {
      const stroke = col(pal, c.color);
      const d = gen.line(c.from[0], c.from[1], c.to[0], c.to[1], { seed, stroke, roughness: 0.9, bowing: 0.6 });
      const ang = Math.atan2(c.to[1] - c.from[1], c.to[0] - c.from[0]);
      body = (
        <>
          <RoughPaths drawable={d} p={p} />
          {c.arrow && p >= 0.95 && (
            <path
              d={`M${c.to[0] - 18 * Math.cos(ang - 0.45)},${c.to[1] - 18 * Math.sin(ang - 0.45)} L${c.to[0]},${c.to[1]} L${c.to[0] - 18 * Math.cos(ang + 0.45)},${c.to[1] - 18 * Math.sin(ang + 0.45)}`}
              stroke={stroke}
              strokeWidth={3.5}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
        </>
      );
      break;
    }
    case "rect":
    case "circle":
    case "ellipse": {
      const stroke = col(pal, c.color);
      const fill = c.fill ? col(pal, c.fill) : undefined;
      const opts = { seed, stroke, roughness: 1.1, fill, fillStyle: "solid" as const, fillWeight: 2 };
      const d =
        c.op === "rect"
          ? gen.rectangle(c.x, c.y, c.w, c.h, opts)
          : gen.ellipse(c.x + c.w / 2, c.y + c.h / 2, c.op === "circle" ? Math.min(c.w, c.h) : c.w, c.op === "circle" ? Math.min(c.w, c.h) : c.h, opts);
      body = (
        <g opacity={fill ? 0.95 : 1}>
          <RoughPaths drawable={d} p={p} />
        </g>
      );
      break;
    }
    case "fractionbar": {
      const h = c.h ?? 54;
      const stroke = pal.ink;
      const fill = col(pal, c.color, "blue");
      const outlineP = Math.min(1, p * 1.6);
      const fillP = Math.max(0, (p - 0.55) / 0.45);
      const pw = c.w / c.parts;
      const outline = gen.rectangle(c.x, c.y, c.w, h, { seed, stroke, roughness: 0.8 });
      body = (
        <g>
          {c.label && (
            <text x={c.x} y={c.y - 10} fontSize={26} fill={pal.ink} opacity={0.85 * outlineP}>
              {c.label}
            </text>
          )}
          {Array.from({ length: Math.min(c.filled, c.parts) }, (_, i) => (
            <rect key={i} x={c.x + i * pw + 2} y={c.y + 2} width={pw - 4} height={h - 4} fill={fill} opacity={0.85 * fillP} />
          ))}
          <RoughPaths drawable={outline} p={outlineP} width={3.5} />
          {Array.from({ length: c.parts - 1 }, (_, i) => (
            <line
              key={i}
              x1={c.x + (i + 1) * pw}
              x2={c.x + (i + 1) * pw}
              y1={c.y}
              y2={c.y + h}
              stroke={stroke}
              strokeWidth={3}
              pathLength={1}
              strokeDasharray={1}
              strokeDashoffset={1 - Math.max(0, Math.min(1, (p - 0.35) * 3))}
            />
          ))}
        </g>
      );
      break;
    }
    case "numberline": {
      const stroke = pal.ink;
      const step = niceStep(c.max - c.min);
      const ticks: number[] = [];
      for (let v = Math.ceil(c.min / step) * step; v <= c.max + 1e-9; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
      const X = (v: number) => c.x + ((v - c.min) / (c.max - c.min || 1)) * c.w;
      const lineP = Math.min(1, p * 1.5);
      const tickP = Math.max(0, (p - 0.4) / 0.6);
      body = (
        <g>
          <RoughPaths drawable={gen.line(c.x, c.y, c.x + c.w, c.y, { seed, stroke, roughness: 0.6 })} p={lineP} />
          {ticks.map((v, i) => (
            <g key={v} opacity={tickP >= i / ticks.length ? 1 : 0}>
              <line x1={X(v)} x2={X(v)} y1={c.y - 10} y2={c.y + 10} stroke={stroke} strokeWidth={3} />
              <text x={X(v)} y={c.y + 40} fontSize={24} fill={stroke} textAnchor="middle">
                {v}
              </text>
            </g>
          ))}
          {(c.marks ?? []).map((m) => (
            <g key={`m${m}`} opacity={tickP >= 0.95 ? 1 : 0}>
              <circle cx={X(m)} cy={c.y} r={9} fill={pal.yellow} />
              <text x={X(m)} y={c.y - 18} fontSize={26} fill={pal.yellow} textAnchor="middle">
                {m}
              </text>
            </g>
          ))}
        </g>
      );
      break;
    }
    case "plot":
      body = <Plot el={c} pal={pal} p={p} />;
      break;
  }

  // Highlight: a hand-drawn ellipse around the element.
  let hl: React.ReactNode = null;
  if (el.highlight) {
    const b = bbox(c);
    const pad = 14;
    hl = (
      <g className="chalk-glow">
        <RoughPaths
          drawable={gen.ellipse(b.x + b.w / 2, b.y + b.h / 2, b.w + pad * 3, b.h + pad * 2, { seed: seed + 7, stroke: col(pal, el.highlight), roughness: 1.4 })}
          p={1}
          width={3}
        />
      </g>
    );
  }

  return (
    <g data-id={el.id} data-layer={el.layer}>
      {body}
      {hl}
    </g>
  );
});

/** Where the chalk tip is for the element currently being drawn. */
function tipPos(el: BoardEl, p: number): [number, number] {
  const c = el.cmd;
  if (c.op === "line") return [c.from[0] + (c.to[0] - c.from[0]) * p, c.from[1] + (c.to[1] - c.from[1]) * p];
  const b = bbox(c);
  if (c.op === "write" || c.op === "latex") return [b.x + b.w * p, b.y + b.h * 0.75];
  // walk the outline: top → right → bottom → left
  const per = 2 * (b.w + b.h);
  let d = per * p;
  if (d < b.w) return [b.x + d, b.y];
  d -= b.w;
  if (d < b.h) return [b.x + b.w, b.y + d];
  d -= b.h;
  if (d < b.w) return [b.x + b.w - d, b.y + b.h];
  d -= b.w;
  return [b.x, b.y + b.h - d];
}

export interface BoardProps {
  state: BoardState;
  /** key of the element currently drawing + its progress 0..1 */
  active?: { key: string; p: number } | null;
  theme?: BoardTheme;
  label?: string;
  className?: string;
}

export default function Board({ state, active, theme = "chalk", label, className }: BoardProps) {
  const pal = PALETTE[theme];
  const activeEl = active ? state.els.find((e) => e.key === active.key) : undefined;
  const tip = activeEl && active && active.p < 1 ? tipPos(activeEl, active.p) : null;

  return (
    <svg
      viewBox={`0 0 ${BOARD_W} ${BOARD_H}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={label ?? "Doska"}
      className={className}
      style={{ display: "block", width: "100%", height: "100%", fontFamily: "var(--font-chalk)", fontWeight: 700 }}
    >
      <rect width={BOARD_W} height={BOARD_H} fill={pal.bg} />
      {/* faint chalk dust grid */}
      <g stroke={pal.grid} strokeWidth={1}>
        {Array.from({ length: 9 }, (_, i) => (
          <line key={`h${i}`} x1={0} x2={BOARD_W} y1={(i + 1) * 62.5} y2={(i + 1) * 62.5} />
        ))}
      </g>
      <g>
        {state.els
          .filter((e) => e.layer === "main")
          .map((el) => (
            <Element key={el.key} el={el} pal={pal} p={active?.key === el.key ? active.p : 1} />
          ))}
      </g>
      <g opacity={state.noteDim ? 0.3 : 1} style={{ transition: "opacity 400ms" }}>
        {state.els
          .filter((e) => e.layer === "note")
          .map((el) => (
            <Element key={el.key} el={el} pal={pal} p={active?.key === el.key ? active.p : 1} />
          ))}
      </g>
      {tip && <circle cx={tip[0]} cy={tip[1]} r={8} fill={pal.yellow} className="chalk-glow" />}
    </svg>
  );
}
