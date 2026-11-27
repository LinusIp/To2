"use client";
// Chalk board that WRITES: every element is revealed stroke by stroke (handwriting.ts),
// with a chalk SVG filter, a chalk piece following the tip, chalk-circle highlights and wipe-outs.
// <BoardInk> is a <g> in the 1000×625 board space (embedded in the classroom stage);
// <Board> wraps it in its own <svg> for standalone use (landing preview, tests).
import { memo, useEffect, useId, useMemo, useRef, useState } from "react";
import type { Color } from "@/lib/ai/schema";
import { BOARD_H, BOARD_W, SIDE_BOARD, SIDE_PAD_X, bbox, type BoardEl, type BoardState } from "@/lib/board/model";
import { boardFocus, boardTip } from "@/lib/board/tip";
import { chalkEllipse, pathD, progressOf, rngFrom, strokesFor, type PlotFn, type Stroke } from "./handwriting";
import { TypedText, isTypedOp, useTypedBoard } from "./typed"; // a11y-hook: typed board (inclusive mode)

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

/**
 * Strokes + their SVG path strings, computed once per element (not per frame). Keyed by the command
 * object (board commands are immutable: a changed element gets a new cmd), then by element key
 * (it seeds the handwriting jitter) and the plot function (null until mathjs has compiled it).
 */
interface Ink {
  strokes: Stroke[];
  ds: string[];
  plotFn: PlotFn;
  /** bounds of the strokes (board coords), for the live element's own filter region */
  box: { x: number; y: number; w: number; h: number };
}
function boundsOf(strokes: Stroke[]) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const s of strokes)
    for (const [x, y] of s.pts) {
      if (x < x0) x0 = x;
      if (y < y0) y0 = y;
      if (x > x1) x1 = x;
      if (y > y1) y1 = y;
    }
  return Number.isFinite(x0) ? { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } : { x: 0, y: 0, w: 0, h: 0 };
}
const inkCache = new WeakMap<object, Map<string, Ink>>();
function inkFor(el: BoardEl, plotFn: PlotFn): Ink {
  let byKey = inkCache.get(el.cmd);
  if (!byKey) inkCache.set(el.cmd, (byKey = new Map()));
  const hit = byKey.get(el.key);
  if (hit && hit.plotFn === plotFn) return hit;
  const strokes = strokesFor(el.cmd, rngFrom(SESSION_SEED ^ hash(el.key + JSON.stringify(el.cmd))), plotFn);
  const ink = { strokes, ds: strokes.map((s) => pathD(s.pts)), plotFn, box: boundsOf(strokes) };
  byKey.set(el.key, ink);
  return ink;
}
const plotOf = (el: BoardEl, plot: (fn: string) => PlotFn): PlotFn => (el.cmd.op === "plot" ? plot(el.cmd.fn) : null);

const Strokes = memo(function Strokes({ ink, drawn }: { ink: Ink; drawn: number[] | null }) {
  const { strokes, ds } = ink;
  return (
    <>
      {strokes.map((s, i) => {
        const d = drawn ? drawn[i] : s.len;
        if (d <= 0) return null;
        const partial = d < s.len;
        return (
          <path
            key={i}
            d={ds[i]}
            fill="none"
            stroke={CHALK[s.color] ?? CHALK.ink}
            strokeWidth={s.width * 1.15}
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

/** One board element. Memoized: finished elements (p = 1, same el, same plotFn) never re-render. */
const Element = memo(function Element({ el, p, plotFn }: { el: BoardEl; p: number; plotFn: PlotFn }) {
  const ink = inkFor(el, plotFn);
  const typed = useTypedBoard() && isTypedOp(el); // a11y-hook: <html data-typed-board> → Lexend text, same place
  if (typed) {
    const c = el.cmd as { color?: Color };
    return (
      <g data-id={el.id} data-layer={el.layer}>
        <TypedText el={el} color={CHALK[c.color ?? "ink"] ?? CHALK.ink} p={p} inkW={ink.box.w} />
        {el.highlight && <Highlight el={el} />}
      </g>
    );
  }
  const prog = p >= 1 ? null : progressOf(ink.strokes, p);
  return (
    <g data-id={el.id} data-layer={el.layer}>
      <Strokes ink={ink} drawn={prog ? prog.drawn : null} />
      {el.highlight && <Highlight el={el} />}
    </g>
  );
});

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
  // yellow chalk; fades out when its step ends (el.hlOff), one highlight at a time (board model)
  return (
    <path
      d={d}
      fill="none"
      stroke={CHALK.yellow}
      strokeWidth={4.5}
      strokeLinecap="round"
      pathLength={1}
      className="hl-draw"
      style={{ opacity: el.hlOff ? 0 : 1, transition: "opacity 700ms ease-out" }}
    />
  );
}

/** "Savolingiz" in chalk at the top of the side board (written once, same strokes every time). */
const SIDE_STROKES = strokesFor({ op: "write", id: "_side", x: SIDE_BOARD.x + SIDE_PAD_X, y: SIDE_BOARD.y + 8, text: "Savolingiz", size: "s", color: "yellow" }, rngFrom(77));
const SIDE_LABEL: Ink = { strokes: SIDE_STROKES, ds: SIDE_STROKES.map((s) => pathD(s.pts)), plotFn: null, box: boundsOf(SIDE_STROKES) };

/**
 * The side board for interruption answers: a small slate hanging over the main board's corner on
 * two pins, wooden frame, "Savolingiz" at the top. Shown while an answer is on the board.
 */
function SideBoard({ show, filter, at }: { show: boolean; filter: string; at?: { x: number; y: number } }) {
  const { x, y, w, h } = SIDE_BOARD;
  // drawn at the default spot, moved to where it hangs for this answer (never over the lesson's writing)
  const dx = at ? at.x - x : 0;
  const dy = at ? at.y - y : 0;
  return (
    <g aria-hidden transform={dx || dy ? `translate(${dx},${dy})` : undefined} style={{ opacity: show ? 1 : 0, transition: "opacity 450ms ease-out" }}>
      {/* strings to two pins above */}
      <g stroke="#c9b48a" strokeWidth={2.5} opacity={0.85}>
        <line x1={x + 70} y1={y - 34} x2={x + 40} y2={y + 2} />
        <line x1={x + 70} y1={y - 34} x2={x + 100} y2={y + 2} />
        <line x1={x + w - 70} y1={y - 34} x2={x + w - 100} y2={y + 2} />
        <line x1={x + w - 70} y1={y - 34} x2={x + w - 40} y2={y + 2} />
      </g>
      <circle cx={x + 70} cy={y - 34} r={6} fill="#d9a441" />
      <circle cx={x + w - 70} cy={y - 34} r={6} fill="#d9a441" />
      {/* drop shadow, frame, slate */}
      <rect x={x - 4} y={y + 6} width={w + 14} height={h + 8} rx={10} fill="#000" opacity={0.28} />
      <rect x={x - 9} y={y - 9} width={w + 18} height={h + 18} rx={10} fill="#8a5a33" />
      <rect x={x - 9} y={y - 9} width={w + 18} height={5} rx={2} fill="#a8774a" />
      <rect x={x} y={y} width={w} height={h} rx={5} fill="#1a2b25" />
      <rect x={x} y={y} width={w} height={h} rx={5} fill="url(#side-sheen)" />
      <g filter={filter}>
        <Strokes ink={SIDE_LABEL} drawn={null} />
      </g>
      <line x1={x + SIDE_PAD_X} y1={y + 40} x2={x + w - SIDE_PAD_X} y2={y + 41} stroke={CHALK.yellow} strokeOpacity={0.35} strokeWidth={2} strokeLinecap="round" />
    </g>
  );
}

export interface BoardInkProps {
  state: BoardState;
  active?: { key: string; p: number } | null;
  /** report the chalk tip to the 3D tutor */
  reportTip?: boolean;
  /**
   * Which ink to draw (the lesson stage stacks them as separate layers so the finished writing is
   * not re-filtered while one element is being written):
   * - "all"  (default): everything, as one board (standalone <Board>)
   * - "done": every element except the one being written (+ side board, wipes, eraser smudges)
   * - "live": only the element being written + the chalk piece, with a filter sized to it
   */
  part?: "all" | "done" | "live";
  /** with part "done": the key of the element being written (drawn by the "live" layer instead) */
  exclude?: string | null;
}

/** The chalk look: rough edges, small gaps, a faint glow. Shared by every chalk filter. */
function ChalkPrims() {
  return (
    <>
      <feTurbulence type="fractalNoise" baseFrequency="1.4" numOctaves="2" seed="3" result="n" />
      <feDisplacementMap in="SourceGraphic" in2="n" scale="2.2" xChannelSelector="R" yChannelSelector="G" result="d" />
      <feTurbulence type="fractalNoise" baseFrequency="2.6" numOctaves="1" seed="9" result="n2" />
      <feColorMatrix in="n2" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 -1.6 1.25" result="holes" />
      <feComposite in="d" in2="holes" operator="in" result="chalk" />
      {/* a subtle glow around the chalk (mockup v2) */}
      <feGaussianBlur in="chalk" stdDeviation="1.8" result="blur" />
      <feComponentTransfer in="blur" result="glow">
        <feFuncA type="linear" slope="0.5" />
      </feComponentTransfer>
      <feMerge>
        <feMergeNode in="glow" />
        <feMergeNode in="chalk" />
      </feMerge>
    </>
  );
}

export function BoardInk({ state, active, reportTip = false, part = "all", exclude = null }: BoardInkProps) {
  const uid = useId().replace(/:/g, "");
  const plot = usePlotFns(state.els);
  const showDone = part !== "live";
  const showLive = part !== "done";

  // erased elements wipe out instead of vanishing
  const prev = useRef<Map<string, BoardEl>>(new Map());
  const [wiping, setWiping] = useState<BoardEl[]>([]);
  // erased main-board writing leaves a faint eraser smudge, like a real board (last 12 kept)
  const [smudges, setSmudges] = useState<{ k: string; x: number; y: number; w: number; h: number }[]>([]);
  // wipe-out timers live until they fire: the board often changes again within the 520 ms (the
  // lesson coming back after "Davom et"), and cancelling them then left erased writing on the board
  const wipeTimers = useRef<number[]>([]);
  useEffect(() => () => wipeTimers.current.forEach((t) => clearTimeout(t)), []);
  useEffect(() => {
    if (!showDone) return;
    const now = new Map(state.els.map((e) => [e.key, e]));
    const gone = [...prev.current.values()].filter((e) => !now.has(e.key));
    prev.current = now;
    const rubbed = gone.filter((e) => e.layer === "main");
    if (rubbed.length)
      setSmudges((sm) => [...sm, ...rubbed.map((e) => ({ k: `${e.key}-${sm.length}`, ...bbox(e.cmd) }))].slice(-12));
    if (gone.length) {
      setWiping((w) => [...w, ...gone]);
      const t = window.setTimeout(() => {
        wipeTimers.current = wipeTimers.current.filter((x) => x !== t);
        setWiping((w) => w.filter((x) => !gone.includes(x)));
      }, 520);
      wipeTimers.current.push(t);
    }
  }, [state.els, showDone]);

  // the element being written and its chalk tip
  const activeEl = showLive && active && active.p < 1 ? state.els.find((e) => e.key === active.key) : undefined;
  const activeInk = activeEl ? inkFor(activeEl, plotOf(activeEl, plot)) : null;
  const tip = useMemo(() => {
    if (!activeInk || !active) return null;
    return progressOf(activeInk.strokes, active.p).tip;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeInk, active?.p]);

  useEffect(() => {
    if (!reportTip) return;
    if (tip) {
      boardTip.x = tip[0];
      boardTip.y = tip[1];
      boardTip.left = activeEl ? bbox(activeEl.cmd).x : NaN;
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

  // "all" draws the active element in place (as before); "done" leaves it to the live layer
  const skip = part === "done" ? exclude : null;
  const main = state.els.filter((e) => e.layer === "main" && e.key !== skip);
  const notes = state.els.filter((e) => e.layer === "note" && e.key !== skip);
  const hasNoteText = state.els.some((e) => e.layer === "note" && (e.cmd.op === "write" || e.cmd.op === "latex"));
  const pOf = (el: BoardEl) => (part === "all" && active?.key === el.key ? active.p : 1);

  // the live element gets its own filter, its region sized to its strokes (in user space, so the
  // chalk noise is exactly the same as on the finished writing): re-filtering stays tiny per frame
  const lb = activeInk?.box;
  const live = part === "live" && activeEl && activeInk && lb && (
    <g filter={`url(#chalk-live-${uid})`} opacity={activeEl.layer === "note" && state.noteDim ? 0 : 1}>
      <Element el={activeEl} p={active!.p} plotFn={activeInk.plotFn} />
    </g>
  );

  return (
    <g>
      <defs>
        {showDone && (
          <filter id={`chalk-${uid}`} x="-5%" y="-5%" width="110%" height="110%">
            <ChalkPrims />
          </filter>
        )}
        {lb && part === "live" && (
          <filter id={`chalk-live-${uid}`} filterUnits="userSpaceOnUse" x={lb.x - 24} y={lb.y - 24} width={lb.w + 48} height={lb.h + 48}>
            <ChalkPrims />
          </filter>
        )}
        {showDone && (
          <>
            <radialGradient id={`smudge-g-${uid}`} cx=".5" cy=".5" r=".5">
              <stop offset="0" stopColor="#fff" stopOpacity=".07" />
              <stop offset="1" stopColor="#fff" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="side-sheen" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#fff" stopOpacity=".05" />
              <stop offset=".5" stopColor="#fff" stopOpacity="0" />
            </linearGradient>
          </>
        )}
      </defs>
      {showDone && (
        <>
          {smudges.map((m) => (
            <ellipse key={m.k} cx={m.x + m.w / 2} cy={m.y + m.h / 2} rx={m.w / 2 + 30} ry={m.h / 2 + 14} fill={`url(#smudge-g-${uid})`} />
          ))}
          <g filter={`url(#chalk-${uid})`}>
            {main.map((el) => (
              <Element key={el.key} el={el} p={pOf(el)} plotFn={plotOf(el, plot)} />
            ))}
          </g>
          {/* the side board hangs OVER the main board; "Davom et" fades it and its notes away */}
          <g opacity={state.noteDim ? 0 : 1} style={{ transition: "opacity 450ms" }}>
            <SideBoard show={hasNoteText} filter={`url(#chalk-${uid})`} at={state.side} />
            <g filter={`url(#chalk-${uid})`}>
              {notes.map((el) => (
                <Element key={el.key} el={el} p={pOf(el)} plotFn={plotOf(el, plot)} />
              ))}
            </g>
          </g>
          <g filter={`url(#chalk-${uid})`}>
            {wiping.map((el) => (
              <g key={`w-${el.key}`} className="wipe-out">
                <Element el={el} p={1} plotFn={plotOf(el, plot)} />
              </g>
            ))}
          </g>
        </>
      )}
      {live}
      {showLive && tip && (
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
