"use client";
// Radial mind map: subject in the centre → sections (branches) → skills (leaves).
// The personal path is drawn as a numbered blue route through the leaves.
// Status = colour + icon (+ the word in the legend / detail card), never colour alone (CLAUDE.md §10 rule 5).
import type { MindMap as MindMapData, MindLeaf, StepStatus } from "@/lib/learning/path";
import { subjectOfSection } from "@/config/subjects";
import { t } from "@/i18n/uz";

const SIZE = 1000;
const C = SIZE / 2;
const R_BRANCH = 235;
const R_NODE = 58;
// leaves alternate between rings so neighbours don't touch (3 rings for big sections)
const RINGS_2 = [345, 430];
const RINGS_3 = [330, 395, 460];

export const STATUS_STYLE: Record<StepStatus, { fill: string; stroke: string; text: string }> = {
  mastered: { fill: "#22b45a", stroke: "#178a43", text: "#fff" },
  current: { fill: "#2f6bff", stroke: "#1d4fd1", text: "#fff" },
  next: { fill: "#ffd25e", stroke: "#f0a400", text: "#5a3b00" },
  locked: { fill: "#dfe4f1", stroke: "#b8c0d8", text: "#6b7392" },
  optional: { fill: "#ffffff", stroke: "#b8c0d8", text: "#6b7392" },
};

/** Small status glyph drawn at (0,0), ~16 units. */
export function StatusGlyph({ status, order, color }: { status: StepStatus; order: number; color: string }) {
  if (status === "mastered") return <path d="M-8 0 l5 6 l11 -12" fill="none" stroke={color} strokeWidth={4.5} strokeLinecap="round" strokeLinejoin="round" />;
  if (status === "locked")
    return (
      <g fill="none" stroke={color} strokeWidth={3.2}>
        <rect x={-7} y={-2} width={14} height={11} rx={2} fill={color} />
        <path d="M-4 -2 v-4 a4 4 0 0 1 8 0 v4" />
      </g>
    );
  if (status === "current" && !order)
    return <path d="M0 -10 L3 -3 L10 -3 L4.5 1.5 L6.5 9 L0 4.5 L-6.5 9 L-4.5 1.5 L-10 -3 L-3 -3 Z" fill={color} />;
  return (
    <text textAnchor="middle" dominantBaseline="central" fontSize={order ? 20 : 24} fontWeight={900} fill={color}>
      {order || "+"}
    </text>
  );
}

function wrap(label: string, max = 11): string[] {
  const words = label.split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if (cur && (cur + " " + w).length > max) {
      lines.push(cur);
      cur = w;
    } else cur = cur ? cur + " " + w : w;
  }
  if (cur) lines.push(cur);
  return lines.slice(0, 3);
}

interface Placed {
  leaf: MindLeaf;
  x: number;
  y: number;
  section: string;
}

export function layoutMindMap(map: MindMapData) {
  // each section gets a slice proportional to its size (+4 so small sections still fit their bubble)
  const weights = map.branches.map((b) => b.leaves.length + 4);
  const total = weights.reduce((a, b) => a + b, 0) || 1;
  let acc = 0;
  const branches = map.branches.map((b, i) => {
    const slice = (2 * Math.PI * weights[i]) / total;
    const a = -Math.PI / 2 + ((acc + weights[i] / 2) / total) * 2 * Math.PI;
    acc += weights[i];
    return { b, a, slice, x: C + R_BRANCH * Math.cos(a), y: C + R_BRANCH * Math.sin(a) };
  });
  const leaves: Placed[] = [];
  for (const br of branches) {
    const k = br.b.leaves.length;
    const spread = br.slice * 0.86;
    const rings = k > 5 ? RINGS_3 : RINGS_2;
    br.b.leaves.forEach((leaf, j) => {
      const a = k === 1 ? br.a : br.a - spread / 2 + (spread * j) / (k - 1);
      const r = rings[j % rings.length];
      leaves.push({ leaf, section: br.b.section, x: C + r * Math.cos(a), y: C + r * Math.sin(a) });
    });
  }
  return { branches, leaves };
}

export default function MindMap({
  map,
  focus,
  selected,
  onFocus,
  onSelect,
}: {
  map: MindMapData;
  focus: string | null;
  selected: string | null;
  onFocus: (section: string | null) => void;
  onSelect: (id: string) => void;
}) {
  const { branches, leaves } = layoutMindMap(map);
  const route = leaves.filter((l) => l.leaf.onPath).sort((a, b) => a.leaf.order - b.leaf.order);
  const dim = (section: string) => (focus && focus !== section ? 0.28 : 1);

  return (
    <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="block h-auto w-full touch-manipulation select-none" role="group" aria-label={t.mindmap.mapLabel(map.title)}>
      {/* centre → branch → leaf links */}
      {branches.map(({ b, x, y }) => {
        const col = subjectOfSection(b.section)?.bar ?? "#2f6bff";
        return (
          <g key={`l-${b.section}`} opacity={dim(b.section)}>
            <path d={`M${C} ${C} Q ${(C + x) / 2 + (y - C) * 0.12} ${(C + y) / 2 - (x - C) * 0.12} ${x} ${y}`} fill="none" stroke={col} strokeWidth={b.active ? 10 : 6} strokeLinecap="round" opacity={0.55} />
            {leaves
              .filter((l) => l.section === b.section)
              .map((l) => (
                <line key={l.leaf.id} x1={x} y1={y} x2={l.x} y2={l.y} stroke={col} strokeWidth={3} opacity={0.4} />
              ))}
          </g>
        );
      })}

      {/* personal path route */}
      {route.length > 1 && (
        <polyline
          points={route.map((l) => `${l.x.toFixed(1)},${l.y.toFixed(1)}`).join(" ")}
          fill="none"
          stroke="#2f6bff"
          strokeWidth={6}
          strokeDasharray="14 10"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="mindmap-route"
        />
      )}

      {/* centre */}
      <g>
        <circle cx={C} cy={C} r={96} fill="#141a3a" />
        <text x={C} y={C - 10} textAnchor="middle" fontSize={map.title.length > 8 ? 27 : 34} fontWeight={900} fill="#fff">
          {map.title}
        </text>
        <text x={C} y={C + 28} textAnchor="middle" fontSize={24} fontWeight={800} fill="#aab4d4">
          {map.mastered}/{map.total}
        </text>
      </g>

      {/* branches */}
      {branches.map(({ b, x, y }) => {
        const col = subjectOfSection(b.section)?.bar ?? "#2f6bff";
        const lines = wrap(b.section);
        const on = focus === b.section;
        return (
          <g
            key={`b-${b.section}`}
            role="button"
            tabIndex={0}
            aria-pressed={on}
            aria-label={`${b.section}: ${b.mastered}/${b.total}`}
            onClick={() => onFocus(on ? null : b.section)}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onFocus(on ? null : b.section))}
            className="cursor-pointer outline-none"
            opacity={dim(b.section)}
          >
            <circle cx={x} cy={y} r={R_NODE} fill="#fff" stroke={col} strokeWidth={on ? 10 : 6} />
            {lines.map((ln, i) => (
              <text key={i} x={x} y={y - 6 + (i - (lines.length - 1) / 2) * 19} textAnchor="middle" fontSize={16} fontWeight={900} fill="#141a3a">
                {ln}
              </text>
            ))}
            <text x={x} y={y + 6 + ((lines.length - 1) / 2) * 19 + 12} textAnchor="middle" fontSize={15} fontWeight={800} fill={col}>
              {b.mastered}/{b.total}
            </text>
          </g>
        );
      })}

      {/* leaves */}
      {leaves.map(({ leaf, x, y, section }) => {
        const st = STATUS_STYLE[leaf.status];
        const sel = selected === leaf.id;
        const r = leaf.status === "current" ? 27 : 22;
        return (
          <g
            key={leaf.id}
            transform={`translate(${x.toFixed(1)} ${y.toFixed(1)})`}
            role="button"
            tabIndex={0}
            aria-label={`${leaf.title}: ${t.roadmap.status[leaf.status]}`}
            onClick={() => onSelect(leaf.id)}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onSelect(leaf.id))}
            className="cursor-pointer outline-none"
            opacity={dim(section)}
          >
            {/* invisible larger hit area */}
            <circle r={32} fill="transparent" />
            {leaf.status === "current" && <circle r={r + 8} fill="none" stroke="#2f6bff" strokeWidth={4} className="mindmap-pulse" />}
            {sel && <circle r={r + 8} fill="none" stroke="#141a3a" strokeWidth={4} />}
            <circle r={r} fill={st.fill} stroke={leaf.onPath && leaf.status !== "current" ? "#2f6bff" : st.stroke} strokeWidth={leaf.onPath ? 5 : 3} />
            <StatusGlyph status={leaf.status} order={leaf.onPath && leaf.status !== "mastered" && leaf.status !== "locked" ? leaf.order : 0} color={st.text} />
          </g>
        );
      })}
    </svg>
  );
}
