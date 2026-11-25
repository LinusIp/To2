"use client";
// Kasb sinovi scene: a small chalk drawing on a board (classroom look, no gradients) for one mission step.
// Before the answer it shows the givens with a "?"; once the learner answers (right or wrong) it fills in:
// bricks pop into the row, tiles cover the floor, the fence draws round the yard, the train drives… and the
// answer is written in yellow chalk. `still` = no animation (finale panels, calm mode does it via CSS).
// Model + values: src/lib/games/scenes.ts (a test checks every solved scene shows the item's answer).
import type { ReactNode } from "react";
import { sceneValue, uzNum, type Icon, type Scene, type SignIcon, type Vehicle } from "@/lib/games/scenes";

export const SCENE_W = 320;
export const SCENE_H = 190;

const C = { chalk: "#f3f0e6", dim: "rgba(243,240,230,.45)", yellow: "#f2c94c", blue: "#9cc9ff", pink: "#ffb3c7", orange: "#ff9f43", green: "#7ee0a0" };
const FONT = "var(--font-chalk), Kalam, 'Comic Sans MS', cursive";

function T({ x, y, children, size = 15, color = C.chalk, anchor = "middle", pop, delay = 0 }: { x: number; y: number; children: ReactNode; size?: number; color?: string; anchor?: "start" | "middle" | "end"; pop?: boolean; delay?: number }) {
  return (
    <text x={x} y={y} fontSize={size} fill={color} textAnchor={anchor} fontFamily={FONT} fontWeight={700} className={pop ? "sc-pop" : undefined} style={pop ? { animationDelay: `${delay}ms` } : undefined}>
      {children}
    </text>
  );
}

/** a pop-in group (staggered) */
const P = ({ on, i = 0, step = 45, children }: { on: boolean; i?: number; step?: number; children: ReactNode }) =>
  on ? (
    <g className="sc-pop" style={{ animationDelay: `${i * step}ms` }}>
      {children}
    </g>
  ) : null;

const stroke = { fill: "none", stroke: C.chalk, strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

/** small chalk icons, drawn in an s × s box at (x, y) */
function Ico({ k, x, y, s = 16, color = C.chalk }: { k: Icon; x: number; y: number; s?: number; color?: string }) {
  const st = { ...stroke, stroke: color, strokeWidth: Math.max(1.3, s / 10) };
  const m = s / 2;
  switch (k) {
    case "brick":
      return <g {...st}><rect x={x} y={y + s * 0.2} width={s} height={s * 0.6} rx={1.5} /><path d={`M${x + m} ${y + s * 0.2}v${s * 0.6}`} /></g>;
    case "tile":
      return <g {...st}><rect x={x + 1} y={y + 1} width={s - 2} height={s - 2} rx={1} /><path d={`M${x + 1} ${y + s - 1}L${x + s - 1} ${y + 1}`} opacity={0.6} /></g>;
    case "window":
      return <g {...st}><rect x={x + 1} y={y + 1} width={s - 2} height={s - 2} rx={1} /><path d={`M${x + m} ${y + 1}v${s - 2}M${x + 1} ${y + m}h${s - 2}`} /></g>;
    case "bag":
    case "sand":
      return <g {...st}><path d={`M${x + s * 0.25} ${y + s * 0.2}h${s * 0.5}l${s * 0.15} ${s * 0.75}h${-s * 0.8}z`} />{k === "sand" ? <path d={`M${x + s * 0.3} ${y + s * 0.65}h${s * 0.4}`} /> : <path d={`M${x + s * 0.35} ${y + s * 0.2}l${s * 0.15} ${-s * 0.12}l${s * 0.15} ${s * 0.12}`} />}</g>;
    case "somsa":
      return <g {...st}><path d={`M${x + 1} ${y + s - 2}L${x + m} ${y + 2}L${x + s - 1} ${y + s - 2}z`} /><path d={`M${x + m} ${y + s * 0.45}v${s * 0.3}`} opacity={0.6} /></g>;
    case "bread":
      return <g {...st}><circle cx={x + m} cy={y + m} r={m - 1} /><circle cx={x + m} cy={y + m} r={m * 0.4} /></g>;
    case "egg":
      return <g {...st}><ellipse cx={x + m} cy={y + m + 1} rx={m * 0.62} ry={m * 0.82} /></g>;
    case "box":
      return <g {...st}><rect x={x + 1} y={y + s * 0.25} width={s - 2} height={s * 0.7} rx={1} /><path d={`M${x + 1} ${y + s * 0.45}h${s - 2}`} /></g>;
    case "rice":
      return <g {...st}><path d={`M${x + 1} ${y + m}h${s - 2}a${m - 1} ${m * 0.8} 0 0 1 ${-(s - 2)} 0z`} /><path d={`M${x + m - 3} ${y + m - 3}l2 -2M${x + m + 2} ${y + m - 4}l1 -2`} /></g>;
    case "water":
      return <g {...st}><path d={`M${x + m} ${y + 1}C${x + 2} ${y + m + 2} ${x + 3} ${y + s - 1} ${x + m} ${y + s - 1}C${x + s - 3} ${y + s - 1} ${x + s - 2} ${y + m + 2} ${x + m} ${y + 1}z`} /></g>;
    case "person":
      return <g {...st}><circle cx={x + m} cy={y + s * 0.25} r={s * 0.18} /><path d={`M${x + m} ${y + s * 0.43}v${s * 0.3}M${x + s * 0.22} ${y + s * 0.55}h${s * 0.56}M${x + m} ${y + s * 0.73}l${-s * 0.22} ${s * 0.25}M${x + m} ${y + s * 0.73}l${s * 0.22} ${s * 0.25}`} /></g>;
    case "onion":
      return <g {...st}><path d={`M${x + m} ${y + 2}C${x + 2} ${y + m} ${x + 2} ${y + s - 1} ${x + m} ${y + s - 1}C${x + s - 2} ${y + s - 1} ${x + s - 2} ${y + m} ${x + m} ${y + 2}z`} /><path d={`M${x + m} ${y + 2}v-2`} /></g>;
    case "shirt":
      return <g {...st}><path d={`M${x + s * 0.3} ${y + 2}l${-s * 0.28} ${s * 0.2}l${s * 0.12} ${s * 0.2}l${s * 0.1} -${s * 0.06}v${s * 0.6}h${s * 0.52}v-${s * 0.6}l${s * 0.1} ${s * 0.06}l${s * 0.12} -${s * 0.2}l-${s * 0.28} -${s * 0.2}q-${s * 0.2} ${s * 0.15} -${s * 0.4} 0z`} /></g>;
    default:
      return <g {...st}><circle cx={x + m} cy={y + m} r={m - 1} /></g>;
  }
}

function SignIco({ k, x, y, s = 56 }: { k: SignIcon; x: number; y: number; s?: number }) {
  const st = { ...stroke, strokeWidth: 2.4 };
  const m = s / 2;
  const at = (dx: number, dy: number) => `${x + dx * s} ${y + dy * s}`;
  switch (k) {
    case "gate":
    case "madrasa":
      return <g {...st}><path d={`M${at(0.1, 1)}V${y + 0.35 * s}H${x + 0.9 * s}V${y + s}`} /><path d={`M${at(0.35, 1)}V${y + 0.6 * s}Q${at(0.5, 0.42)} ${at(0.65, 0.6)}V${y + s}`} /><path d={`M${at(0.3, 0.35)}Q${at(0.5, 0)} ${at(0.7, 0.35)}`} /></g>;
    case "tower":
      return <g {...st}><path d={`M${at(0.38, 1)}L${at(0.42, 0.18)}H${x + 0.58 * s}L${at(0.62, 1)}`} /><path d={`M${at(0.36, 0.18)}h${0.28 * s}M${at(0.5, 0.18)}v${-0.12 * s}`} /><path d={`M${at(0.4, 0.5)}h${0.2 * s}M${at(0.39, 0.75)}h${0.22 * s}`} opacity={0.6} /></g>;
    case "observatory":
      return <g {...st}><path d={`M${at(0.1, 0.95)}H${x + 0.9 * s}`} /><path d={`M${at(0.2, 0.95)}A${0.3 * s} ${0.3 * s} 0 0 1 ${at(0.8, 0.95)}`} /><path d={`M${at(0.5, 0.95)}L${at(0.78, 0.2)}`} /></g>;
    case "clock":
      return <g {...st}><circle cx={x + m} cy={y + m} r={m * 0.85} /><path d={`M${x + m} ${y + m}V${y + m * 0.35}M${x + m} ${y + m}H${x + m * 0.45}`} /></g>;
    case "ticket":
    case "menu":
    case "bill":
      return <g {...st}><rect x={x + 0.1 * s} y={y + 0.22 * s} width={0.8 * s} height={0.56 * s} rx={4} /><path d={`M${at(0.22, 0.4)}h${0.4 * s}M${at(0.22, 0.55)}h${0.3 * s}`} opacity={0.7} /></g>;
    case "wave":
      return <g {...st}><path d={`M${at(0.35, 0.95)}V${y + 0.45 * s}M${at(0.35, 0.6)}V${y + 0.2 * s}M${at(0.47, 0.6)}V${y + 0.12 * s}M${at(0.59, 0.6)}V${y + 0.18 * s}M${at(0.71, 0.65)}V${y + 0.32 * s}`} /><path d={`M${at(0.35, 0.95)}Q${at(0.75, 1)} ${at(0.71, 0.62)}`} /><path d={`M${at(0.12, 0.3)}q${-0.05 * s} ${0.12 * s} 0 ${0.24 * s}M${at(0.88, 0.3)}q${0.05 * s} ${0.12 * s} 0 ${0.24 * s}`} opacity={0.6} /></g>;
    case "bowl":
    case "plate":
      return <g {...st}><path d={`M${at(0.08, 0.5)}H${x + 0.92 * s}A${0.42 * s} ${0.36 * s} 0 0 1 ${at(0.08, 0.5)}z`} /><path d={`M${at(0.35, 0.36)}q${0.05 * s} ${-0.1 * s} 0 ${-0.2 * s}M${at(0.6, 0.36)}q${0.05 * s} ${-0.1 * s} 0 ${-0.2 * s}`} opacity={0.6} /></g>;
    case "cup":
    case "tea":
      return <g {...st}><path d={`M${at(0.18, 0.35)}H${x + 0.7 * s}V${y + 0.7 * s}Q${at(0.7, 0.9)} ${at(0.44, 0.9)}Q${at(0.18, 0.9)} ${at(0.18, 0.7)}z`} /><path d={`M${at(0.7, 0.45)}h${0.1 * s}a${0.08 * s} ${0.08 * s} 0 0 1 0 ${0.16 * s}h${-0.1 * s}`} /><path d={`M${at(0.35, 0.25)}q${0.04 * s} ${-0.08 * s} 0 ${-0.16 * s}M${at(0.52, 0.25)}q${0.04 * s} ${-0.08 * s} 0 ${-0.16 * s}`} opacity={0.6} /></g>;
    case "key":
      return <g {...st}><circle cx={x + 0.3 * s} cy={y + m} r={0.16 * s} /><path d={`M${at(0.46, 0.5)}H${x + 0.9 * s}M${at(0.78, 0.5)}v${0.14 * s}M${at(0.88, 0.5)}v${0.1 * s}`} /></g>;
    case "bed":
      return <g {...st}><path d={`M${at(0.08, 0.85)}V${y + 0.35 * s}M${at(0.08, 0.62)}H${x + 0.92 * s}V${y + 0.85 * s}`} /><rect x={x + 0.14 * s} y={y + 0.46 * s} width={0.2 * s} height={0.14 * s} rx={3} /></g>;
    case "suitcase":
      return <g {...st}><rect x={x + 0.15 * s} y={y + 0.32 * s} width={0.7 * s} height={0.55 * s} rx={5} /><path d={`M${at(0.38, 0.32)}v${-0.12 * s}h${0.24 * s}v${0.12 * s}`} /></g>;
    case "bus":
      return <Veh k="bus" x={x + 0.05 * s} y={y + 0.25 * s} w={0.9 * s} />;
    case "arrow":
      return <g {...st}><path d={`M${at(0.1, 0.5)}H${x + 0.85 * s}M${at(0.65, 0.3)}L${at(0.88, 0.5)}L${at(0.65, 0.7)}`} /></g>;
    case "chef":
    case "hotel":
    case "map":
    default:
      return <g {...st}><path d={`M${at(0.15, 0.2)}L${at(0.38, 0.1)}L${at(0.62, 0.2)}L${at(0.85, 0.1)}V${y + 0.82 * s}L${at(0.62, 0.92)}L${at(0.38, 0.82)}L${at(0.15, 0.92)}z`} /><path d={`M${at(0.38, 0.1)}V${y + 0.82 * s}M${at(0.62, 0.2)}V${y + 0.92 * s}`} opacity={0.6} /></g>;
  }
}

function Veh({ k, x, y, w = 60 }: { k: Vehicle; x: number; y: number; w?: number }) {
  const h = w * 0.45;
  const st = { ...stroke, strokeWidth: 2.2 };
  if (k === "bike")
    return <g {...st}><circle cx={x + w * 0.2} cy={y + h * 0.8} r={h * 0.32} /><circle cx={x + w * 0.8} cy={y + h * 0.8} r={h * 0.32} /><path d={`M${x + w * 0.2} ${y + h * 0.8}L${x + w * 0.45} ${y + h * 0.3}L${x + w * 0.8} ${y + h * 0.8}M${x + w * 0.45} ${y + h * 0.3}h${w * 0.18}`} /></g>;
  const body = k === "train" ? `M${x} ${y + h * 0.75}V${y + h * 0.15}H${x + w * 0.75}Q${x + w} ${y + h * 0.2} ${x + w} ${y + h * 0.75}z` : `M${x} ${y + h * 0.75}V${y + h * 0.1}H${x + w * 0.92}Q${x + w} ${y + h * 0.1} ${x + w} ${y + h * 0.3}V${y + h * 0.75}z`;
  const n = k === "train" ? 3 : 2;
  return (
    <g {...st}>
      <path d={body} />
      {Array.from({ length: n + 1 }, (_, i) => <rect key={i} x={x + w * 0.08 + i * w * 0.2} y={y + h * 0.25} width={w * 0.12} height={h * 0.2} rx={1.5} />)}
      <circle cx={x + w * 0.22} cy={y + h * 0.82} r={h * 0.16} />
      <circle cx={x + w * 0.75} cy={y + h * 0.82} r={h * 0.16} />
      {k === "train" && <path d={`M${x - 6} ${y + h}H${x + w + 6}`} opacity={0.6} />}
    </g>
  );
}

/** "?" before the answer, yellow answer after */
const Ans = ({ x, y, on, text, size = 20, anchor = "middle" }: { x: number; y: number; on: boolean; text: string; size?: number; anchor?: "start" | "middle" | "end" }) =>
  on ? <T x={x} y={y} size={size} color={C.yellow} anchor={anchor} pop delay={250}>{text}</T> : <T x={x} y={y} size={size} color={C.orange} anchor={anchor}>?</T>;

function Body({ s, on }: { s: Scene; on: boolean }) {
  const v = sceneValue(s);
  const vn = v == null ? 0 : Number(v.includes("/") ? 0 : v);
  switch (s.kind) {
    case "row": {
      const n = Math.min(40, Math.round(s.total / s.unit));
      const w = 280 / n;
      return (
        <g>
          <T x={160} y={34}>{`${uzNum(s.total)} ${s.u}`}</T>
          <path d="M20 44H300M20 38v12M300 38v12" {...stroke} />
          {/* the row itself: tall pieces so they read on a phone */}
          <rect x={21} y={66} width={w - 2} height={30} rx={2} fill="rgba(242,201,76,.25)" stroke={C.yellow} strokeWidth={2} />
          <T x={20 + w / 2} y={62} size={11} color={C.yellow} anchor="start">{`${uzNum(s.unit)} ${s.u}`}</T>
          {!on && <rect x={20} y={66} width={280} height={30} rx={2} fill="none" stroke={C.dim} strokeDasharray="5 5" />}
          {Array.from({ length: n - 1 }, (_, i) => <P key={i} on={on} i={i}><rect x={21 + (i + 1) * w} y={66} width={w - 2} height={30} rx={2} fill="rgba(243,240,230,.12)" stroke={C.chalk} strokeWidth={2} /></P>)}
          <path d="M14 110H306" {...stroke} opacity={0.5} />
          <Ans x={160} y={150} on={on} text={`${uzNum(vn)} ta`} size={26} />
        </g>
      );
    }
    case "grid": {
      const cell = Math.min(230 / s.cols, 120 / s.rows);
      const gw = cell * s.cols, gh = cell * s.rows;
      const x0 = 175 - gw / 2, y0 = 42;
      return (
        <g>
          <T x={x0 + gw / 2} y={34}>{s.colsLabel}</T>
          <T x={x0 - 8} y={y0 + gh / 2 + 5} anchor="end">{s.rowsLabel}</T>
          <rect x={x0} y={y0} width={gw} height={gh} {...stroke} strokeDasharray={on ? undefined : "5 5"} />
          {!on && <Ico k={s.icon} x={x0} y={y0} s={cell} color={C.yellow} />}
          {Array.from({ length: s.cols * s.rows }, (_, i) => (
            <P key={i} on={on} i={i} step={Math.max(8, 700 / (s.cols * s.rows))}>
              <Ico k={s.icon} x={x0 + (i % s.cols) * cell} y={y0 + Math.floor(i / s.cols) * cell} s={cell} />
            </P>
          ))}
          <Ans x={x0 + gw / 2} y={y0 + gh + 30} on={on} text={`= ${uzNum(vn)}`} size={24} />
        </g>
      );
    }
    case "fence": {
      const k = Math.min(200 / s.w, 110 / s.h);
      const w = s.w * k, h = s.h * k, x0 = 160 - w / 2, y0 = 40;
      const per = 2 * (w + h);
      return (
        <g>
          <rect x={x0} y={y0} width={w} height={h} fill="rgba(126,224,160,.12)" stroke={C.dim} strokeDasharray="4 6" strokeWidth={1.5} />
          <T x={x0 + w / 2} y={y0 - 8}>{`${uzNum(s.w)} ${s.u}`}</T>
          <T x={x0 + w + 8} y={y0 + h / 2 + 5} anchor="start">{`${uzNum(s.h)} ${s.u}`}</T>
          {on && (
            <g>
              <rect x={x0} y={y0} width={w} height={h} {...stroke} stroke={C.yellow} strokeWidth={3} pathLength={1} className="sc-draw" style={{ strokeDasharray: 1 }} />
              {Array.from({ length: Math.round(per / 16) }, (_, i) => {
                const d = i * 16;
                const [px, py] = d < w ? [x0 + d, y0] : d < w + h ? [x0 + w, y0 + d - w] : d < 2 * w + h ? [x0 + w - (d - w - h), y0 + h] : [x0, y0 + h - (d - 2 * w - h)];
                return <P key={i} on i={i} step={22}><path d={`M${px} ${py - 4}v8`} {...stroke} stroke={C.yellow} /></P>;
              })}
            </g>
          )}
          <Ans x={160} y={y0 + h + 34} on={on} text={`P = ${uzNum(vn)} ${s.u}`} size={22} />
        </g>
      );
    }
    case "percent": {
      const per = s.total / 20;
      const part = Math.round(s.pct / 5);
      return (
        <g>
          <T x={84} y={26} size={13}>{s.find === "part" ? `${uzNum(s.total)} ${s.unit}` : `100% = ?`}</T>
          {Array.from({ length: 20 }, (_, i) => {
            const x = 18 + (i % 5) * 28, y = 34 + Math.floor(i / 5) * 28;
            const isPart = i >= 20 - part;
            if (s.find === "whole" && !isPart) return <P key={i} on={on} i={i}><Ico k={s.icon} x={x} y={y} s={22} /></P>;
            if (s.find === "part" && isPart && on) return <rect key={i} x={x} y={y} width={22} height={22} rx={3} fill="none" stroke={C.dim} strokeDasharray="3 3" />;
            return <Ico key={i} k={s.icon} x={x} y={y} s={22} color={isPart ? C.orange : C.chalk} />;
          })}
          {s.find === "whole" && !on && <T x={84} y={100} size={30} color={C.orange}>?</T>}
          <T x={84} y={160} size={11} color={C.dim}>{`1 belgi = ${uzNum(per)} ${s.unit}`}</T>
          <path d="M162 30V170" {...stroke} opacity={0.4} />
          <T x={240} y={42} color={C.orange}>{`${uzNum(s.pct)}%`}</T>
          {s.find === "part" ? (
            <>
              {Array.from({ length: part }, (_, i) => <P key={i} on={on} i={i} step={90}><Ico k={s.icon} x={190 + (i % 4) * 26} y={56 + Math.floor(i / 4) * 26} s={22} color={C.orange} /></P>)}
              <Ans x={240} y={150} on={on} text={`${uzNum(vn)} ${s.unit}`} size={22} />
            </>
          ) : (
            <>
              <T x={240} y={72} size={14}>{`= ${uzNum((s.total * s.pct) / 100)} ${s.unit}`}</T>
              <T x={240} y={112} size={14}>100% =</T>
              <Ans x={240} y={146} on={on} text={`${uzNum(vn)} ${s.unit}`} size={22} />
            </>
          )}
        </g>
      );
    }
    case "ratio": {
      const nb = Math.min(12, Math.round(vn));
      const na = Math.min(12, s.target);
      return (
        <g>
          <T x={160} y={26} size={14} color={C.blue}>{`${uzNum(s.a)} ${s.nameA}  →  ${uzNum(s.b)} ${s.nameB}`}</T>
          <T x={80} y={52}>{`${uzNum(s.target)} ${s.nameA}`}</T>
          {Array.from({ length: na }, (_, i) => <Ico key={i} k={s.iconA} x={26 + (i % 4) * 28} y={62 + Math.floor(i / 4) * 28} s={22} color={C.blue} />)}
          <path d="M150 100h24M166 92l8 8-8 8" {...stroke} />
          {!on && <T x={240} y={110} size={34} color={C.orange}>?</T>}
          {Array.from({ length: nb }, (_, i) => <P key={i} on={on} i={i} step={80}><Ico k={s.iconB} x={188 + (i % 4) * 28} y={62 + Math.floor(i / 4) * 28} s={22} color={C.pink} /></P>)}
          <Ans x={240} y={176} on={on} text={`${uzNum(vn)} ${s.nameB}`} size={20} />
        </g>
      );
    }
    case "triangle": {
      const k = Math.min(220 / s.base, 100 / s.h);
      const b = s.base * k, h = s.h * k, x0 = 160 - b / 2, yb = 140;
      return (
        <g>
          {on && <path className="sc-pop" d={`M${x0} ${yb}L${160} ${yb - h}L${x0 + b} ${yb}z`} fill="rgba(242,201,76,.25)" />}
          <path d={`M${x0} ${yb}L${160} ${yb - h}L${x0 + b} ${yb}z`} {...stroke} />
          <path d={`M160 ${yb - h}V${yb}`} {...stroke} strokeDasharray="4 5" stroke={C.blue} />
          <T x={168} y={yb - h / 2 + 5} anchor="start" color={C.blue}>{`h = ${uzNum(s.h)} ${s.u}`}</T>
          <T x={160} y={yb + 20}>{`a = ${uzNum(s.base)} ${s.u}`}</T>
          <Ans x={160} y={180} on={on} text={`S = ${uzNum(vn)} ${s.u}²`} size={20} />
        </g>
      );
    }
    case "hyp": {
      const k = Math.min(160 / s.a, 120 / s.b);
      const a = s.a * k, b = s.b * k, xw = 240, yg = 150;
      const steps = 6;
      return (
        <g>
          <path d={`M${xw} ${yg}V${yg - b - 10}M${xw - a - 20} ${yg}H${xw + 20}`} {...stroke} />
          <path d={`M${xw} ${yg - b - 10}h12M${xw} ${yg - b / 2}h12M${xw} ${yg - 10}h12`} {...stroke} opacity={0.4} />
          <T x={xw - a / 2} y={yg + 20}>{`${uzNum(s.a)} ${s.u}`}</T>
          <T x={xw + 16} y={yg - b / 2 + 5} anchor="start">{`${uzNum(s.b)} ${s.u}`}</T>
          <path d={`M${xw - a} ${yg}L${xw} ${yg - b}`} {...stroke} stroke={on ? C.yellow : C.dim} strokeDasharray={on ? undefined : "6 6"} strokeWidth={on ? 3 : 2} />
          {Array.from({ length: steps }, (_, i) => {
            const t = (i + 1) / (steps + 1);
            const px = xw - a + a * t, py = yg - b * t;
            return <P key={i} on={on} i={i} step={70}><path d={`M${px - 5} ${py - 4}l10 8`} {...stroke} stroke={C.yellow} /></P>;
          })}
          <Ans x={xw - a / 2 - 30} y={yg - b / 2 - 4} on={on} text={`c = ${uzNum(vn)} ${s.u}`} size={20} anchor="end" />
        </g>
      );
    }
    case "fraction": {
      const w = 260 / s.parts, x0 = 30, y0 = 62;
      const add = s.add ?? 0;
      return (
        <g>
          <T x={160} y={36}>{s.mode === "sum" ? `${s.have}/${s.parts} + ${add}/${s.parts}` : `${s.label}: ${s.have}/${s.parts} tayyor`}</T>
          {Array.from({ length: s.parts }, (_, i) => {
            const fill = i < s.have ? (s.mode === "sum" ? "rgba(156,201,255,.45)" : "rgba(243,240,230,.35)") : s.mode === "sum" && i < s.have + add ? "rgba(255,179,199,.45)" : "none";
            return <rect key={i} x={x0 + i * w} y={y0} width={w} height={48} fill={fill} {...{ stroke: C.chalk, strokeWidth: 2 }} />;
          })}
          {s.mode === "rest" &&
            Array.from({ length: s.parts - s.have }, (_, i) => <P key={i} on={on} i={i} step={120}><rect x={x0 + (s.have + i) * w + 3} y={y0 + 3} width={w - 6} height={42} fill="rgba(242,201,76,.45)" /></P>)}
          {s.mode === "sum" && on && <rect className="sc-pop" x={x0 - 4} y={y0 - 4} width={(s.have + add) * w + 8} height={56} rx={6} fill="none" stroke={C.yellow} strokeWidth={3} />}
          <Ans x={160} y={160} on={on} text={`${v}${s.mode === "sum" ? ` ${s.label}` : ` ${s.label} qoldi`}`} size={24} />
        </g>
      );
    }
    case "groups": {
      const g = s.groups;
      const cols = Math.min(g, g > 10 ? 10 : 5);
      const bw = Math.min(54, 280 / cols), bh = g > 10 ? 34 : 44;
      const x0 = 160 - (cols * bw) / 2, y0 = 44;
      return (
        <g>
          <T x={160} y={30} size={14}>{s.find === "each" ? `${uzNum(g * s.each)} ta → ${g} ${s.groupLabel}` : `${g} ${s.groupLabel} × ${uzNum(s.each)}`}</T>
          {Array.from({ length: g }, (_, i) => {
            const x = x0 + (i % cols) * bw, y = y0 + Math.floor(i / cols) * (bh + 6);
            return (
              <g key={i}>
                <rect x={x + 3} y={y} width={bw - 6} height={bh} rx={4} {...stroke} />
                <Ico k={s.icon} x={x + 6} y={y + 4} s={Math.min(18, bh - 16)} />
                {s.find === "each" ? (
                  on ? <T x={x + bw / 2} y={y + bh - 5} size={g > 10 ? 10 : 13} color={C.yellow} pop delay={i * 120}>{uzNum(s.each)}</T> : <T x={x + bw / 2} y={y + bh - 5} size={13} color={C.orange}>?</T>
                ) : (
                  <T x={x + bw / 2} y={y + bh - 5} size={g > 10 ? 10 : 12}>{uzNum(s.each)}</T>
                )}
              </g>
            );
          })}
          <Ans x={160} y={176} on={on} text={s.find === "each" ? `har biriga ${uzNum(vn)}` : `= ${uzNum(vn)}`} size={22} />
        </g>
      );
    }
    case "money": {
      return (
        <g>
          {Array.from({ length: s.items }, (_, i) => (
            <g key={i}>
              <Ico k={s.icon} x={24 + i * 46} y={40} s={34} />
              <T x={41 + i * 46} y={96} size={13}>{`${uzNum(s.price)} ${s.u}`}</T>
            </g>
          ))}
          <rect x={196} y={40} width={100} height={52} rx={6} {...stroke} stroke={C.green} />
          <T x={246} y={74} size={18} color={C.green}>{`${uzNum(s.paid)} ${s.u}`}</T>
          <T x={160} y={128} size={15}>{`${uzNum(s.paid)} − ${s.items} · ${uzNum(s.price)} =`}</T>
          {on && <circle className="sc-pop" cx={160} cy={158} r={20} fill="none" stroke={C.yellow} strokeWidth={2.5} />}
          <Ans x={160} y={165} on={on} text={uzNum(vn)} size={22} />
          {on && <T x={196} y={165} size={13} color={C.yellow} anchor="start" pop delay={300}>{`${s.u} qaytim`}</T>}
        </g>
      );
    }
    case "scale": {
      const [a, b] = s.values;
      return (
        <g>
          <path d="M160 40V130M110 150h100M60 60H260" {...stroke} />
          <path d="M60 60l-24 40h48zM260 60l-24 40h48z" {...stroke} />
          <T x={60} y={122} size={15} color={C.blue}>{uzNum(a)}</T>
          <T x={60} y={140} size={12}>{s.labels[0]}</T>
          <T x={260} y={122} size={15} color={C.pink}>{uzNum(b)}</T>
          <T x={260} y={140} size={12}>{s.labels[1]}</T>
          <T x={160} y={32} size={14}>{s.op === "sum" ? `${uzNum(a)} + ${uzNum(b)}` : `${uzNum(a)} · ${uzNum(b)}`}</T>
          <Ans x={160} y={178} on={on} text={`= ${uzNum(vn)} ${s.u}`} size={22} />
        </g>
      );
    }
    case "motion": {
      const sVal = s.v * s.t;
      const label = (k: "v" | "t" | "s", text: string) => (s.find === k ? <Ans x={0} y={0} on={on} text={text} size={16} anchor="start" /> : <T x={0} y={0} size={16} anchor="start">{text}</T>);
      return (
        <g>
          <path d="M20 112H300" {...stroke} />
          {Array.from({ length: 8 }, (_, i) => <path key={i} d={`M${20 + i * 40} 108v8`} {...stroke} opacity={0.5} />)}
          <g className={on ? "sc-drive" : undefined}>
            <Veh k={s.vehicle} x={22} y={76} w={60} />
          </g>
          <path d="M20 132H300M20 126v12M300 126v12" {...stroke} stroke={C.blue} />
          <g transform="translate(118 154)">{label("s", `s = ${uzNum(sVal)} ${s.su}`)}</g>
          <g transform="translate(22 40)">{label("v", `v = ${uzNum(s.v)} ${s.vu}`)}</g>
          <g transform="translate(206 40)">{label("t", `t = ${uzNum(s.t)} ${s.tu}`)}</g>
        </g>
      );
    }
    case "density":
      return (
        <g>
          <path d="M60 70l30-20h70l-30 20zM60 70v70h70V70M130 140l30-20V50" {...stroke} />
          <T x={95} y={112} size={12}>{`V = ${uzNum(s.V)} m³`}</T>
          <T x={220} y={66}>{`m = ${uzNum(s.m)} kg`}</T>
          <T x={220} y={100} size={14} color={C.dim}>ρ = m : V</T>
          <Ans x={220} y={146} on={on} text={`ρ = ${uzNum(vn)} kg/m³`} size={18} />
        </g>
      );
    case "weight":
      return (
        <g>
          <path d="M100 20V54M92 54a8 8 0 1 0 16 0" {...stroke} />
          <rect x={72} y={66} width={56} height={46} rx={4} {...stroke} />
          <T x={100} y={95} size={14}>{`${uzNum(s.m)} kg`}</T>
          {on && <path className="sc-pop" d="M100 116V170M92 160l8 10 8-10" {...stroke} stroke={C.yellow} strokeWidth={3} />}
          <T x={220} y={60} size={14}>{`g = ${uzNum(s.g)} N/kg`}</T>
          <T x={220} y={92} size={14} color={C.dim}>P = m · g</T>
          <Ans x={220} y={140} on={on} text={`P = ${uzNum(vn)} N`} size={20} />
        </g>
      );
    case "pressure":
      return (
        <g>
          <path d="M80 30V80M72 70l8 10 8-10" {...stroke} stroke={C.blue} strokeWidth={3} />
          <T x={92} y={46} anchor="start" color={C.blue}>{`F = ${uzNum(s.F)} N`}</T>
          <rect x={40} y={86} width={80} height={44} rx={3} {...stroke} />
          <path d="M20 130H140" {...stroke} />
          {on && <path className="sc-pop" d="M40 130l10 10M60 130l10 10M80 130l10 10M100 130l10 10" {...stroke} stroke={C.yellow} />}
          <T x={80} y={160}>{`S = ${uzNum(s.S)} m²`}</T>
          <T x={235} y={80} size={14} color={C.dim}>p = F : S</T>
          <Ans x={235} y={124} on={on} text={`p = ${uzNum(vn)} Pa`} size={20} />
        </g>
      );
    case "work":
      return (
        <g>
          <path d="M40 160H150M60 160V30" {...stroke} />
          <path d="M60 30h50" {...stroke} />
          <path d="M140 150V50M134 60l6-10 6 10" {...stroke} stroke={C.blue} />
          <T x={148} y={104} anchor="start" color={C.blue}>{`s = ${uzNum(s.s)} m`}</T>
          <g className={on ? "sc-lift" : undefined}>
            <rect x={86} y={124} width={36} height={34} rx={3} {...stroke} />
            <path d="M104 124V34" {...stroke} opacity={0.5} />
          </g>
          <T x={250} y={60} size={14}>{`F = ${uzNum(s.F)} N`}</T>
          <T x={250} y={92} size={14} color={C.dim}>A = F · s</T>
          <Ans x={250} y={140} on={on} text={`A = ${uzNum(vn)} J`} size={20} />
        </g>
      );
    case "power":
      return (
        <g>
          <rect x={40} y={60} width={80} height={60} rx={6} {...stroke} />
          <circle cx={80} cy={90} r={16} {...stroke} />
          <path d="M120 90h30" {...stroke} />
          <circle cx={80} cy={150} r={18} {...stroke} />
          <path d="M80 150V138M80 150h9" {...stroke} />
          <T x={110} y={156} anchor="start" size={14}>{`t = ${uzNum(s.t)} s`}</T>
          <T x={80} y={46} size={14}>{`A = ${uzNum(s.A)} J`}</T>
          {on && <path className="sc-pop" d="M168 70l-12 22h14l-12 24" {...stroke} stroke={C.yellow} strokeWidth={3} />}
          <T x={250} y={80} size={14} color={C.dim}>N = A : t</T>
          <Ans x={250} y={126} on={on} text={`N = ${uzNum(vn)} W`} size={20} />
        </g>
      );
    case "sign":
      return null; // drawn by SignBody (needs the answer word)
  }
}

function SignBody({ s, on, answer }: { s: Extract<Scene, { kind: "sign" }>; on: boolean; answer: string }) {
  const [pre, post] = s.text.split("___");
  // fit the sentence (with the answer filled in) inside the 196-wide board: Kalam ≈ 0.5 em per char
  const len = s.text.length + Math.max(0, answer.length - 3);
  const size = Math.max(12, Math.min(21, Math.floor(180 / (len * 0.5))));
  return (
    <g>
      <SignIco k={s.icon} x={22} y={42} s={74} />
      <rect x={110} y={46} width={196} height={84} rx={8} {...stroke} />
      <path d="M208 130v40M196 170h24" {...stroke} />
      <text x={208} y={96} fontSize={size} textAnchor="middle" fontFamily={FONT} fontWeight={700} fill={C.chalk}>
        {pre}
        {on ? (
          <tspan fill={C.yellow} className="sc-pop">{answer}</tspan>
        ) : (
          <tspan fill={C.orange}>___</tspan>
        )}
        {post}
      </text>
    </g>
  );
}

export default function MissionScene({ scene, solved, answer, label, className, still }: { scene: Scene; solved: boolean; answer: string; label?: string; className?: string; still?: boolean }) {
  return (
    <svg viewBox={`0 0 ${SCENE_W} ${SCENE_H}`} className={`${className ?? ""} ${still ? "sc-still" : ""}`} role="img" aria-label={label} data-testid="mission-scene" data-solved={solved ? "1" : "0"}>
      <rect x={2} y={2} width={SCENE_W - 4} height={SCENE_H - 4} rx={14} fill="#253a30" stroke="#8a5a2c" strokeWidth={4} />
      {scene.kind === "sign" ? <SignBody s={scene} on={solved} answer={answer} /> : <Body s={scene} on={solved} />}
    </svg>
  );
}

/** nested drawing for finale panels (same scene, solved, no animation) */
export function ScenePanel({ scene, answer, x, y, w, missed }: { scene: Scene; answer: string; x: number; y: number; w: number; missed?: boolean }) {
  const h = (w * SCENE_H) / SCENE_W;
  return (
    <g opacity={missed ? 0.5 : 1}>
      <svg x={x} y={y} width={w} height={h} viewBox={`0 0 ${SCENE_W} ${SCENE_H}`} className="sc-still">
        <rect x={2} y={2} width={SCENE_W - 4} height={SCENE_H - 4} rx={14} fill="#253a30" stroke={missed ? "#f3f0e6" : "#8a5a2c"} strokeWidth={missed ? 6 : 8} strokeDasharray={missed ? "18 14" : undefined} />
        {scene.kind === "sign" ? <SignBody s={scene} on answer={answer} /> : <Body s={scene} on />}
      </svg>
    </g>
  );
}
