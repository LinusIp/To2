"use client";
// Chalk board that WRITES: every element is revealed stroke by stroke (handwriting.ts),
// with a chalk SVG filter, a chalk piece following the tip, chalk-circle highlights and wipe-outs.
// <BoardInk> is a <g> in the 1000×625 board space (embedded in the classroom stage);
// <Board> wraps it in its own <svg> for standalone use (landing preview, tests).
import { memo, useEffect, useId, useMemo, useRef, useState } from "react";
import type { Color } from "@/lib/ai/schema";
import { BOARD_H, BOARD_W, NOTE_PANEL, bbox, type BoardEl, type BoardState } from "@/lib/board/model";
import { boardFocus, boardTip } from "@/lib/board/tip";
import { chalkEllipse, pathD, progressOf, rngFrom, strokesFor, type PlotFn, type Stroke } from "./handwriting";

export type BoardTheme = "chalk";

const CHALK: Record<Color | "dim", string> = {
  ink: "#f3f0e6",
  blue: "#7cc7ff",
  red: "#ff9bb0",
  green: "#8be28b",
  orange: "#ff9f43",
  purple: "#cdb2ff",
  yellow: "#f2c94c",
  dim: "rgba(243,240,230,.35)",
};

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** One random seed per page load → each run of a lesson looks a little different. */
const SESSION_SEED = Math.floor(Math.random() * 1e9);

// lazily compiled plot functions (mathjs is only loaded when a plot appears)
const plotCache = new Map<string, PlotFn>();
function usePlotFns(els: BoardEl[]) {
  const [, force] = useState(0);
  const fns = els.filter((e) => e.cmd.op === "plot").map((e) => (e.cmd as { fn: string }).fn);
  useEffect(() => {
    const missing = fns.filter((f) => !plotCache.has(f));
    if (!missing.length) return;
    let alive = true;
    import("mathjs").then((m) => {
      for (const f of missing) {
        try {
          const c = m.compile(f.replace(/^y\s*=\s*/i, ""));
          plotCache.set(f, (x: number) => Number(c.evaluate({ x })));
        } catch {
          plotCache.set(f, null);
        }
      }
      if (alive) force((n) => n + 1);
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fns.join("|")]);
  return (fn: string) => plotCache.get(fn) ?? null;
}

const Strokes = memo(function Strokes({ strokes, drawn }: { strokes: Stroke[]; drawn: number[] | null }) {
  return (
    <>
      {strokes.map((s, i) => {
        const d = drawn ? drawn[i] : s.len;
        if (d <= 0) return null;
        const partial = d < s.len;
        return (
          <path
            key={i}
            d={pathD(s.pts)}
            fill="none"
            stroke={CHALK[s.color] ?? CHALK.ink}
            strokeWidth={s.width}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={partial ? `${s.len} ${s.len}` : undefined}
            strokeDashoffset={partial ? s.len - d : undefined}
          />
        );
      })}
    </>
  );
});

function Element({ el, p, plot }: { el: BoardEl; p: number; plot: (fn: string) => PlotFn }) {
  const plotFn = el.cmd.op === "plot" ? plot(el.cmd.fn) : null;
  const strokes = useMemo(
    () => strokesFor(el.cmd, rngFrom(SESSION_SEED ^ hash(el.key + JSON.stringify(el.cmd))), plotFn),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [el.key, JSON.stringify(el.cmd), plotFn],
  );
  const prog = p >= 1 ? null : progressOf(strokes, p);
  return (
    <g data-id={el.id} data-layer={el.layer}>
      <Strokes strokes={strokes} drawn={prog ? prog.drawn : null} />
      {el.highlight && <Highlight el={el} />}
    </g>
  );
}

/** Chalk circle drawn around an element (animates in once). */
function Highlight({ el }: { el: BoardEl }) {
  const b = bbox(el.cmd);
  const d = useMemo(() => pathD(chalkEllipse(b.x + b.w / 2, b.y + b.h / 2, b.w / 2 + 26, b.h / 2 + 16, rngFrom(hash(el.key + "hl")))), [b.x, b.y, b.w, b.h, el.key]);
  // the 3D tutor points at what was just circled
  useEffect(() => {
    boardFocus.x = b.x + b.w / 2;
    boardFocus.y = b.y + b.h / 2;
    boardFocus.count++;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [el.key, el.highlight]);
  return <path d={d} fill="none" stroke={CHALK[el.highlight ?? "yellow"]} strokeWidth={4} strokeLinecap="round" pathLength={1} className="hl-draw" />;
}

export interface BoardInkProps {
  state: BoardState;
  active?: { key: string; p: number } | null;
  /** report the chalk tip to the 3D tutor */
  reportTip?: boolean;
}

export function BoardInk({ state, active, reportTip = false }: BoardInkProps) {
  const uid = useId().replace(/:/g, "");
  const plot = usePlotFns(state.els);

  // erased elements wipe out instead of vanishing
  const prev = useRef<Map<string, BoardEl>>(new Map());
  const [wiping, setWiping] = useState<BoardEl[]>([]);
  useEffect(() => {
    const now = new Map(state.els.map((e) => [e.key, e]));
    const gone = [...prev.current.values()].filter((e) => !now.has(e.key));
    prev.current = now;
    if (gone.length) {
      setWiping((w) => [...w, ...gone]);
      const t = setTimeout(() => setWiping((w) => w.filter((x) => !gone.includes(x))), 520);
      return () => clearTimeout(t);
    }
  }, [state.els]);

  // chalk tip of the element being written
  const activeEl = active ? state.els.find((e) => e.key === active.key) : undefined;
  const tip = useMemo(() => {
    if (!activeEl || !active || active.p >= 1) return null;
    const plotFn = activeEl.cmd.op === "plot" ? plot(activeEl.cmd.fn) : null;
    const strokes = strokesFor(activeEl.cmd, rngFrom(SESSION_SEED ^ hash(activeEl.key + JSON.stringify(activeEl.cmd))), plotFn);
    return progressOf(strokes, active.p).tip;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeEl?.key, activeEl?.cmd, active?.p]);

  useEffect(() => {
    if (!reportTip) return;
    if (tip) {
      boardTip.x = tip[0];
      boardTip.y = tip[1];
      boardTip.active = true;
      boardTip.at = performance.now();
    } else boardTip.active = false;
  }, [tip, reportTip]);
  useEffect(
    () => () => {
      if (reportTip) boardTip.active = false;
    },
    [reportTip],
  );

  const main = state.els.filter((e) => e.layer === "main");
  const notes = state.els.filter((e) => e.layer === "note");
  const hasNoteText = notes.some((e) => e.cmd.op === "write" || e.cmd.op === "latex");

  return (
    <g>
      <defs>
        <filter id={`chalk-${uid}`} x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="1.4" numOctaves="2" seed="3" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="2.2" xChannelSelector="R" yChannelSelector="G" result="d" />
          <feTurbulence type="fractalNoise" baseFrequency="2.6" numOctaves="1" seed="9" result="n2" />
          <feColorMatrix in="n2" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 -1.6 1.25" result="holes" />
          <feComposite in="d" in2="holes" operator="in" />
        </filter>
      </defs>
      <g filter={`url(#chalk-${uid})`}>
        {main.map((el) => (
          <Element key={el.key} el={el} p={active?.key === el.key ? active.p : 1} plot={plot} />
        ))}
        <g opacity={state.noteDim ? 0.3 : 1} style={{ transition: "opacity 400ms" }}>
          {hasNoteText && (
            <rect
              x={NOTE_PANEL.x}
              y={NOTE_PANEL.y}
              width={NOTE_PANEL.w}
              height={NOTE_PANEL.h}
              rx={14}
              fill="#1d3027"
              fillOpacity={0.9}
              stroke={CHALK.orange}
              strokeWidth={3}
              strokeDasharray="10 8"
            />
          )}
          {notes.map((el) => (
            <Element key={el.key} el={el} p={active?.key === el.key ? active.p : 1} plot={plot} />
          ))}
        </g>
        {wiping.map((el) => (
          <g key={`w-${el.key}`} className="wipe-out">
            <Element el={el} p={1} plot={plot} />
          </g>
        ))}
      </g>
      {tip && (
        <g transform={`translate(${tip[0].toFixed(1)},${tip[1].toFixed(1)}) rotate(-35)`} aria-hidden>
          <rect x={-3} y={-22} width={9} height={26} rx={2} fill="#f4f1e8" opacity={0.95} />
          <circle cx={1} cy={2} r={3} fill="#fff" opacity={0.6} />
        </g>
      )}
    </g>
  );
}

/** Standalone chalkboard (its own <svg>). */
export default function Board({ state, active, label, className }: BoardInkProps & { label?: string; className?: string; theme?: BoardTheme }) {
  return (
    <svg
      viewBox={`0 0 ${BOARD_W} ${BOARD_H}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={label ?? "Doska"}
      className={className}
      style={{ display: "block", width: "100%", height: "100%" }}
    >
      <rect width={BOARD_W} height={BOARD_H} fill="#253a30" />
      <defs>
        <radialGradient id="sb-smudge" cx=".5" cy=".5" r=".5">
          <stop offset="0" stopColor="#fff" stopOpacity=".05" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="300" cy="300" rx="380" ry="200" fill="url(#sb-smudge)" />
      <ellipse cx="760" cy="470" rx="260" ry="140" fill="url(#sb-smudge)" />
      <BoardInk state={state} active={active} />
    </svg>
  );
}
