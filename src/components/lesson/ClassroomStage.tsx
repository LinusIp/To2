"use client";
// The lesson stage (ported from docs/prototypes/board-handwriting.html):
// warm classroom SVG (1600×900) + the chalk board (1000×625 at translate(420,100) scale(1.104))
// + the live 3D voxel tutor on a transparent canvas above it (TutorCanvas).
import { useEffect, useMemo, useState } from "react";
import { BoardInk } from "@/components/board/Board";
import type { BoardState } from "@/lib/board/model";
import TutorCanvas from "@/components/characters/TutorCanvas";

export const STAGE_W = 1600;
export const STAGE_H = 900;
export const BOARD_X = 420;
export const BOARD_Y = 100;
export const BOARD_S = 1.104;

/** Visible part of the 1600×900 stage + tutor scale. Phones crop to the board so the chalk stays readable. */
export interface StageView {
  x0: number;
  y0: number;
  w: number;
  h: number;
  /** tutor scale */
  s: number;
  /** where the tutor stands when facing the learner */
  frontX: number;
}
export const FULL_VIEW: StageView = { x0: 0, y0: 0, w: 1600, h: 900, s: 1, frontX: 280 };
export const COMPACT_VIEW: StageView = { x0: 250, y0: 70, w: 1320, h: 830, s: 0.75, frontX: 330 };

function useStageView(): StageView {
  const [v, setV] = useState<StageView>(FULL_VIEW);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const set = () => setV(mq.matches ? COMPACT_VIEW : FULL_VIEW);
    set();
    mq.addEventListener("change", set);
    return () => mq.removeEventListener("change", set);
  }, []);
  return v;
}

function Frieze() {
  const c = ["#1e5fa8", "#2fb6c4", "#1e5fa8", "#f1e8d6"];
  const tiles = useMemo(() => Array.from({ length: Math.ceil(1600 / 22) }, (_, i) => i), []);
  return (
    <g>
      {tiles.map((i) => (
        <rect key={i} x={i * 22 + 5} y={586} width={12} height={12} fill={c[i % 4]} transform={`rotate(45 ${i * 22 + 11} 592)`} />
      ))}
    </g>
  );
}

export function Room() {
  return (
    <>
      <defs>
        <filter id="room-soft" x="-2%" y="-2%" width="104%" height="104%">
          <feGaussianBlur stdDeviation="2.2" />
        </filter>
        <radialGradient id="room-sun" cx=".1" cy=".25" r=".9">
          <stop offset="0" stopColor="#ffe2b0" stopOpacity=".35" />
          <stop offset=".6" stopColor="#ffe2b0" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="room-plaster" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#f3e8d3" stopOpacity="0" />
          <stop offset="1" stopColor="#b9a582" stopOpacity=".35" />
        </linearGradient>
        <radialGradient id="board-smudge" cx=".5" cy=".5" r=".5">
          <stop offset="0" stopColor="#fff" stopOpacity=".05" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="room-vig" x1="0" y1="0" x2="0" y2="1">
          <stop offset=".6" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity=".22" />
        </linearGradient>
      </defs>
      <g filter="url(#room-soft)">
        <rect width="1600" height="900" fill="#e6dac3" />
        <rect width="1600" height="900" fill="url(#room-plaster)" />
        {/* Samarkand-blue wainscot + tile frieze */}
        <rect x="0" y="606" width="1600" height="250" fill="#1d4a73" />
        <g fill="#173d61">
          <rect x="0" y="606" width="1600" height="6" />
          <rect x="120" y="640" width="4" height="216" />
          <rect x="380" y="640" width="4" height="216" />
          <rect x="1540" y="640" width="4" height="216" />
        </g>
        <rect x="0" y="578" width="1600" height="30" fill="#f1e8d6" />
        <Frieze />
        <rect x="0" y="576" width="1600" height="3" fill="#c9973f" />
        <rect x="0" y="606" width="1600" height="3" fill="#c9973f" />
        {/* floor */}
        <rect x="0" y="856" width="1600" height="44" fill="#8a5a35" />
        <rect x="0" y="852" width="1600" height="6" fill="#5e3b20" />
        <g fill="#74492a">
          <rect x="0" y="876" width="1600" height="2" />
          <rect x="210" y="858" width="2" height="18" />
          <rect x="620" y="878" width="2" height="22" />
          <rect x="1010" y="858" width="2" height="18" />
          <rect x="1380" y="878" width="2" height="22" />
        </g>
        {/* window */}
        <rect x="40" y="92" width="300" height="338" fill="#7a4f2c" />
        <rect x="54" y="106" width="272" height="310" fill="#a8d8f2" />
        <rect x="54" y="300" width="272" height="116" fill="#cbe9f8" />
        <g fill="#fff">
          <rect x="86" y="150" width="64" height="14" />
          <rect x="100" y="138" width="34" height="14" />
          <rect x="226" y="196" width="70" height="12" />
        </g>
        <rect x="54" y="352" width="272" height="64" fill="#7ab24f" />
        <g fill="#5f9a3f">
          <rect x="150" y="214" width="44" height="44" />
          <rect x="194" y="200" width="44" height="44" />
          <rect x="236" y="222" width="40" height="40" />
          <rect x="170" y="252" width="44" height="40" />
        </g>
        <rect x="204" y="280" width="20" height="74" fill="#6b4421" />
        <rect x="186" y="106" width="8" height="310" fill="#7a4f2c" />
        <rect x="54" y="254" width="272" height="8" fill="#7a4f2c" />
        <rect x="28" y="428" width="324" height="16" fill="#6a4326" />
        <rect x="28" y="428" width="324" height="4" fill="#8c6038" />
        <polygon points="54,416 326,416 820,856 330,856" fill="#fff3d6" opacity=".22" />
        <rect width="1600" height="900" fill="url(#room-sun)" />
        {/* plants */}
        <rect x="1528" y="786" width="58" height="70" fill="#b5653a" />
        <rect x="1528" y="786" width="58" height="8" fill="#c97a4c" />
        <g fill="#4f8f36">
          <rect x="1534" y="722" width="16" height="64" />
          <rect x="1552" y="696" width="16" height="90" />
          <rect x="1570" y="734" width="14" height="52" />
        </g>
        <rect x="58" y="790" width="54" height="66" fill="#2fa3b0" />
        <rect x="58" y="790" width="54" height="8" fill="#47bcc8" />
        <g fill="#4f8f36">
          <rect x="64" y="740" width="14" height="50" />
          <rect x="80" y="716" width="14" height="74" />
          <rect x="96" y="746" width="12" height="44" />
        </g>
      </g>
      {/* board drop shadow */}
      <rect x="408" y="94" width="1150" height="740" fill="#000" opacity=".16" />
    </>
  );
}

export default function ClassroomStage({
  board,
  active,
  characterId,
  label,
}: {
  board: BoardState;
  active: { key: string; p: number } | null;
  characterId: string;
  label: string;
}) {
  const view = useStageView();
  return (
    <div className="relative w-full overflow-hidden" style={{ aspectRatio: `${view.w} / ${view.h}` }}>
      <svg viewBox={`${view.x0} ${view.y0} ${view.w} ${view.h}`} className="absolute inset-0 h-full w-full" role="img" aria-label={label}>
        <Room />
        <g transform={`translate(${BOARD_X},${BOARD_Y}) scale(${BOARD_S})`}>
          <rect x="-18" y="-18" width="1036" height="661" fill="#7a4f2c" />
          <rect x="-18" y="-18" width="1036" height="6" fill="#86603d" />
          <rect x="0" y="0" width="1000" height="625" fill="#253a30" />
          <ellipse cx="300" cy="300" rx="380" ry="200" fill="url(#board-smudge)" />
          <ellipse cx="760" cy="470" rx="260" ry="140" fill="url(#board-smudge)" />
          <BoardInk state={board} active={active} reportTip />
          <rect x="-30" y="643" width="1060" height="16" fill="#5d3d24" />
          <rect x="-30" y="643" width="1060" height="4" fill="#7a5233" />
          <g fill="#efebe0">
            <rect x="120" y="635" width="40" height="9" />
            <rect x="176" y="637" width="26" height="7" />
          </g>
          <rect x="222" y="636" width="30" height="8" fill="#f2c94c" />
          <rect x="880" y="628" width="70" height="16" fill="#3a3f4a" />
          <rect x="880" y="628" width="70" height="6" fill="#c9b79a" />
        </g>
        <rect width="1600" height="900" fill="url(#room-vig)" pointerEvents="none" />
        {/* cinematic light (mockup v2): warm window key from the left, cool fill from the right, a warm
            spot on the board — same directions as the three.js key/fill/rim on the tutor (voxel.ts addLights) */}
        <defs>
          <radialGradient id="cine-key" gradientUnits="userSpaceOnUse" cx="60" cy="250" r="1000">
            <stop offset="0" stopColor="#ffc97a" stopOpacity=".42" />
            <stop offset="1" stopColor="#ffc97a" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="cine-fill" gradientUnits="userSpaceOnUse" cx="1600" cy="520" r="760">
            <stop offset="0" stopColor="#8fb6ff" stopOpacity=".26" />
            <stop offset="1" stopColor="#8fb6ff" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="cine-spot" gradientUnits="userSpaceOnUse" cx={BOARD_X + 520 * BOARD_S} cy={BOARD_Y + 280 * BOARD_S} r="560">
            <stop offset="0" stopColor="#ffe7b4" stopOpacity=".24" />
            <stop offset="1" stopColor="#ffe7b4" stopOpacity="0" />
          </radialGradient>
        </defs>
        <g pointerEvents="none" style={{ mixBlendMode: "soft-light" }}>
          <rect width="1600" height="900" fill="url(#cine-key)" />
          <rect width="1600" height="900" fill="url(#cine-fill)" />
        </g>
        <rect width="1600" height="900" fill="url(#cine-spot)" pointerEvents="none" style={{ mixBlendMode: "screen" }} />
      </svg>
      <TutorCanvas characterId={characterId} view={view} />
      {/* vignette over everything, tutor included (a camera effect) */}
      <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(120% 90% at 45% 40%, transparent 55%, rgba(20,10,0,.35))" }} />
    </div>
  );
}
