"use client";
// Kasb sinovi finale: the 5 solved step scenes become the panels of the job's finished building, in chalk:
// a sports hall (quruvchi), a domed building (oshxona / Registon), a shop front, a bridge, a train, a tower.
// Steps answered wrong are still built ("birga qurdik") but drawn dashed and faded.
import { ScenePanel } from "./MissionScene";
import type { FinaleKind } from "@/lib/games/mission";
import type { Scene } from "@/lib/games/scenes";

const ST = { fill: "none", stroke: "#f3f0e6", strokeWidth: 2.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
const FONT = "var(--font-chalk), Kalam, 'Comic Sans MS', cursive";

type Panel = { x: number; y: number; w: number };
interface Layout { w: number; h: number; panels: Panel[]; draw: (sign: string) => React.ReactNode }

const Sign = ({ x, y, text, size = 15 }: { x: number; y: number; text: string; size?: number }) => (
  <text x={x} y={y} textAnchor="middle" fontFamily={FONT} fontWeight={700} fontSize={size} fill="#f2c94c">
    {text}
  </text>
);

const LAYOUTS: Record<FinaleKind, Layout> = {
  hall: {
    w: 340, h: 250,
    panels: [{ x: 32, y: 84, w: 88 }, { x: 126, y: 84, w: 88 }, { x: 220, y: 84, w: 88 }, { x: 32, y: 152, w: 88 }, { x: 220, y: 152, w: 88 }],
    draw: (sign) => (
      <g>
        <path d="M14 76L170 20L326 76" {...ST} />
        <rect x={20} y={76} width={300} height={160} {...ST} />
        <path d="M150 236V164h40v72" {...ST} />
        <Sign x={170} y={64} text={sign} />
      </g>
    ),
  },
  dome: {
    w: 340, h: 260,
    panels: [{ x: 70, y: 112, w: 64 }, { x: 138, y: 112, w: 64 }, { x: 206, y: 112, w: 64 }, { x: 70, y: 172, w: 64 }, { x: 206, y: 172, w: 64 }],
    draw: (sign) => (
      <g>
        <path d="M110 76Q170 4 230 76" {...ST} />
        <path d="M170 20v-12" {...ST} />
        <rect x={60} y={76} width={220} height={170} {...ST} />
        <path d="M152 246v-30q18-22 36 0v30" {...ST} />
        <path d="M26 246V60h20v186M294 246V60h20v186M22 60h28M290 60h28" {...ST} />
        <Sign x={170} y={100} text={sign} size={14} />
      </g>
    ),
  },
  shop: {
    w: 340, h: 240,
    panels: [{ x: 30, y: 96, w: 88 }, { x: 126, y: 96, w: 88 }, { x: 222, y: 96, w: 88 }, { x: 30, y: 160, w: 88 }, { x: 222, y: 160, w: 88 }],
    draw: (sign) => (
      <g>
        <rect x={20} y={16} width={300} height={34} rx={4} {...ST} />
        <Sign x={170} y={40} text={sign} size={18} />
        <path d="M14 56h312l-10 28H24z" {...ST} />
        {Array.from({ length: 10 }, (_, i) => <path key={i} d={`M${28 + i * 30} 56l-4 28`} {...ST} opacity={0.5} />)}
        <rect x={20} y={84} width={300} height={142} {...ST} />
        <path d="M146 226v-60h48v60" {...ST} />
      </g>
    ),
  },
  bridge: {
    w: 340, h: 200,
    panels: [{ x: 8, y: 30, w: 62 }, { x: 74, y: 30, w: 62 }, { x: 140, y: 30, w: 62 }, { x: 206, y: 30, w: 62 }, { x: 272, y: 30, w: 62 }],
    draw: (sign) => (
      <g>
        <path d="M4 72H336M4 84H336" {...ST} />
        <path d="M20 190V84M320 190V84" {...ST} />
        <path d="M40 190Q100 100 160 190M180 190Q240 100 300 190" {...ST} />
        <path d="M0 190H340" {...ST} opacity={0.6} />
        <path d="M10 196q20 -6 40 0t40 0t40 0t40 0t40 0t40 0t40 0t40 0" {...ST} stroke="#9cc9ff" opacity={0.7} />
        <Sign x={170} y={22} text={sign} />
      </g>
    ),
  },
  train: {
    w: 340, h: 210,
    panels: [{ x: 120, y: 36, w: 96 }, { x: 226, y: 36, w: 96 }, { x: 14, y: 124, w: 96 }, { x: 120, y: 124, w: 96 }, { x: 226, y: 124, w: 96 }],
    draw: (sign) => (
      <g>
        <path d="M14 96V40h70q26 0 26 30v26z" {...ST} />
        <rect x={26} y={50} width={28} height={20} rx={3} {...ST} />
        <Sign x={62} y={88} text={sign} size={11} />
        {[[116, 30], [222, 30], [10, 118], [116, 118], [222, 118]].map(([x, y], i) => (
          <rect key={i} x={x} y={y} width={104} height={66} rx={6} {...ST} />
        ))}
        {[[30, 102], [90, 102], [140, 102], [200, 102], [246, 102], [306, 102], [34, 190], [94, 190], [140, 190], [200, 190], [246, 190], [306, 190]].map(([cx, cy], i) => (
          <circle key={i} cx={cx} cy={cy} r={6} {...ST} />
        ))}
        <path d="M4 110H336M4 198H336" {...ST} opacity={0.6} />
      </g>
    ),
  },
  tower: {
    w: 340, h: 330,
    panels: [{ x: 96, y: 262, w: 72 }, { x: 172, y: 262, w: 72 }, { x: 96, y: 210, w: 72 }, { x: 172, y: 210, w: 72 }, { x: 134, y: 158, w: 72 }],
    draw: (sign) => (
      <g>
        <rect x={86} y={100} width={168} height={210} {...ST} />
        <path d="M86 100l84-40 84 40" {...ST} />
        <Sign x={170} y={92} text={sign} size={14} />
        {/* the crane that built it */}
        <path d="M300 320V30M300 30H200M300 30h30M300 60l-40-30M300 80l20-50" {...ST} opacity={0.6} />
        <path d="M220 30v40" {...ST} opacity={0.6} />
        <path d="M30 320H320" {...ST} />
        <rect x={106} y={110} width={128} height={40} {...ST} opacity={0.4} />
      </g>
    ),
  },
};

export default function MissionFinale({ kind, sign, steps, results, label }: { kind: FinaleKind; sign: string; steps: { scene: Scene; answer: string }[]; results: boolean[]; label: string }) {
  const L = LAYOUTS[kind] ?? LAYOUTS.hall;
  return (
    <svg viewBox={`0 0 ${L.w} ${L.h}`} className="w-full" role="img" aria-label={label} data-testid="mission-finale">
      <rect x={1} y={1} width={L.w - 2} height={L.h - 2} rx={16} fill="#253a30" stroke="#8a5a2c" strokeWidth={4} />
      {L.draw(sign)}
      {steps.slice(0, L.panels.length).map((s, i) => (
        <g key={i} className="sc-pop" style={{ animationDelay: `${300 + i * 220}ms` }}>
          <ScenePanel scene={s.scene} answer={s.answer} x={L.panels[i].x} y={L.panels[i].y} w={L.panels[i].w} missed={results[i] === false} />
        </g>
      ))}
    </svg>
  );
}
