// Where the tutor stands when it is NOT writing: never in front of written content.
// The tutor's silhouette is modelled as a box (stage px at scale 1: the hinged GLB tutors are ~750 tall,
// shoulders ±160–167, arms hanging just outside), mapped into board coordinates. Pure + tested.
/** board coords (1000×625) → stage: same as the classroom stage and the animator */
const BOARD = { x: 420, y: 100, s: 1.104 } as const;

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface SpotView {
  x0: number;
  w: number;
  /** tutor scale (phones 0.75) */
  s: number;
}

/** half the tutor's width and its full height, stage px at scale 1 */
export const TUTOR_HALF_W = 210;
export const TUTOR_H = 780;
/** stage y of the floor (feet) */
const FLOOR = 860;

/** The tutor's silhouette in BOARD coordinates when its feet are at stage x `x`. */
export function tutorBox(x: number, s: number): Box {
  const hw = TUTOR_HALF_W * s;
  const top = FLOOR - TUTOR_H * s;
  return { x: (x - hw - BOARD.x) / BOARD.s, y: (top - BOARD.y) / BOARD.s, w: (2 * hw) / BOARD.s, h: (TUTOR_H * s) / BOARD.s };
}

const area = (a: Box, b: Box) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));

/** how much written content the tutor would cover standing at `x` (board units²) */
export function covered(x: number, boxes: Box[], view: SpotView, pad = 8): number {
  const t = tutorBox(x, view.s);
  return boxes.reduce((sum, b) => sum + area(t, { x: b.x - pad, y: b.y - pad, w: b.w + 2 * pad, h: b.h + 2 * pad }), 0);
}

/**
 * Stage x for the tutor while talking: the board's far-left edge if that covers nothing; else further
 * left (partly out of frame), else anywhere along the board that covers nothing; else the least covering.
 */
export function restSpot(boxes: Box[], view: SpotView): number {
  const hw = TUTOR_HALF_W * view.s;
  const preferred = view.x0 + hw * 0.85;
  const lo = view.x0 + hw * 0.3; // at most ~70 % of the tutor out of the frame
  const hi = view.x0 + view.w - hw;
  for (let x = preferred; x >= lo; x -= 8) if (covered(x, boxes, view) === 0) return x;
  for (let x = preferred; x <= hi; x += 8) if (covered(x, boxes, view) === 0) return x;
  let best = preferred;
  let bestC = Infinity;
  for (let x = lo; x <= hi; x += 8) {
    const c = covered(x, boxes, view);
    if (c < bestC - 1) {
      best = x;
      bestC = c;
    }
  }
  return best;
}
