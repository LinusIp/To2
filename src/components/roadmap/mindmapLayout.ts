// Pure geometry for the mind map (MindMap.tsx): radial placement of sections and skills + overlap relaxation.
import type { MindLeaf, MindMap as MindMapData } from "@/lib/learning/path";

export const SIZE = 1000;
export const C = SIZE / 2;
const R_BRANCH = 235;
export const R_NODE = 58;
// leaves alternate between rings so neighbours don't touch (3 rings for big sections)
const RINGS_2 = [345, 430];
const RINGS_3 = [330, 395, 460];

export interface Placed {
  leaf: MindLeaf;
  x: number;
  y: number;
  section: string;
}

export const MIN_LEAF_GAP = 56;
const R_MIN = 312;
const R_MAX = 466;

/** Push touching leaves apart (a few passes), keeping them inside the leaf band. Deterministic. */
function relax(leaves: Placed[]) {
  for (let pass = 0; pass < 60; pass++) {
    let moved = false;
    for (let i = 0; i < leaves.length; i++) {
      for (let j = i + 1; j < leaves.length; j++) {
        const a = leaves[i];
        const b = leaves[j];
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let d = Math.hypot(dx, dy);
        if (d >= MIN_LEAF_GAP) continue;
        if (d < 0.01) {
          dx = 1;
          dy = 0;
          d = 1;
        }
        const push = (MIN_LEAF_GAP - d) / 2 + 0.5;
        a.x -= (dx / d) * push;
        a.y -= (dy / d) * push;
        b.x += (dx / d) * push;
        b.y += (dy / d) * push;
        moved = true;
      }
    }
    for (const l of leaves) {
      const r = Math.hypot(l.x - C, l.y - C);
      const k = Math.min(R_MAX, Math.max(R_MIN, r)) / (r || 1);
      l.x = C + (l.x - C) * k;
      l.y = C + (l.y - C) * k;
    }
    if (!moved) break;
  }
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
  relax(leaves);
  return { branches, leaves };
}
