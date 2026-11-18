// Main-layer auto-layout (CLAUDE.md §5b): the LLM picks coordinates, but it can't see the board,
// so it often writes on top of what is already there. This pass runs on the server for every
// lesson segment (LLM, KV cache, demo) and moves new drawings into free space before they reach
// the client, the way a real teacher would write the next line underneath.
//
// Rules
// - Sizes come from the real handwriting strokes, not character-count estimates.
// - Drawings of one segment that sit close together (a rectangle and its "5 sm" labels) form a
//   cluster and move together, so the diagram stays intact.
// - Annotations (rect/circle/ellipse/line/arrow/tick) that touch something already on the board
//   are deliberate (circle around an answer, underline) and stay where they are.
// - A cluster that overlaps existing content moves to the nearest free spot, preferring "below".
// - If the board is full, the board is wiped first (new "page"), like a teacher would.
// - The bottom-right note panel stays free for interruption answers.
import type { BoardCommand, DrawCommand, Place } from "@/lib/ai/schema";
import { strokesFor, rngFrom } from "@/components/board/handwriting";
import { BOARD_H, BOARD_W, NOTE_PANEL, bbox, isDraw } from "./model";

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

const M = 16; // board margin
const GAP = 14; // min clear space between drawings
const CLUSTER_GAP = 34; // drawings closer than this in one segment belong together

const CONTENT = new Set(["write", "latex", "numberline", "fractionbar", "plot"]);
const ANNOT = new Set(["rect", "circle", "ellipse", "line", "arrow", "tick"]);
// a text this small is a label ("5 sm", "a") and belongs to the shape next to it;
// anything bigger is a line of its own and must never sit on the shape
const LABEL_W = 160;
const LABEL_H = 64;
const SIZES = ["l", "m", "s"] as const;
const SHAPE_OPS = new Set(["rect", "circle", "ellipse", "line"]);

/** clearance a label keeps from a chalk line (lines wobble up to ±4 px) */
const LINE_CLEAR = 8;

/** Shortest distance between segment a–b and a box (0 if the segment crosses it). */
export function segBoxDist(a: [number, number], b: [number, number], box: Box): number {
  let best = Infinity;
  for (let i = 0; i <= 24; i++) {
    const t = i / 24;
    const x = a[0] + (b[0] - a[0]) * t;
    const y = a[1] + (b[1] - a[1]) * t;
    const dx = Math.max(box.x - x, 0, x - (box.x + box.w));
    const dy = Math.max(box.y - y, 0, y - (box.y + box.h));
    best = Math.min(best, Math.hypot(dx, dy));
  }
  return best;
}

const isLabel = (op: string, b: Box) => (op === "write" || op === "latex") && b.w <= LABEL_W && b.h <= LABEL_H;

/**
 * Real handwriting is wider than the model's estimate, so a long line can be wider than the
 * board and then fits nowhere. Step its size down (l → m → s) until it fits the board width.
 */
export function fitWidth(cmd: DrawCommand): DrawCommand {
  if (cmd.op !== "write" && cmd.op !== "latex") return cmd;
  let c = cmd;
  let i = SIZES.indexOf(c.size ?? "m");
  while (measure(c).w > BOARD_W - 2 * M && i < SIZES.length - 1) c = { ...c, size: SIZES[++i] };
  return c;
}

/** Exact-ish box of a drawing from its chalk strokes (falls back to the model estimate). */
export function measure(cmd: DrawCommand): Box {
  if (cmd.op === "divider") return { x: cmd.x - 4, y: 40, w: 10, h: 550 };
  if ((cmd.op === "arrow" && (typeof cmd.from === "string" || typeof cmd.to === "string")) || cmd.op === "strike") return bbox(cmd);
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  try {
    for (const s of strokesFor(cmd, rngFrom(7)))
      for (const [px, py] of s.pts) {
        if (px < minX) minX = px;
        if (px > maxX) maxX = px;
        if (py < minY) minY = py;
        if (py > maxY) maxY = py;
      }
  } catch {
    /* fall through */
  }
  const est = bbox(cmd);
  if (!Number.isFinite(minX)) return est;
  // plot strokes depend on the function; its frame is the declared box
  if (cmd.op === "plot") return est;
  return { x: minX - 3, y: minY - 3, w: maxX - minX + 6, h: maxY - minY + 6 };
}

const hit = (a: Box, b: Box, pad = 0) =>
  a.x < b.x + b.w + pad && b.x < a.x + a.w + pad && a.y < b.y + b.h + pad && b.y < a.y + a.h + pad;

const union = (bs: Box[]): Box => {
  const x = Math.min(...bs.map((b) => b.x));
  const y = Math.min(...bs.map((b) => b.y));
  return { x, y, w: Math.max(...bs.map((b) => b.x + b.w)) - x, h: Math.max(...bs.map((b) => b.y + b.h)) - y };
};

/** Move a drawing by (dx, dy). Target-relative ops (strike, id arrows) are left alone. */
export function shift(cmd: DrawCommand, dx: number, dy: number): DrawCommand {
  if (!dx && !dy) return cmd;
  const p = (q: [number, number]): [number, number] => [Math.round(q[0] + dx), Math.round(q[1] + dy)];
  switch (cmd.op) {
    case "line":
      return { ...cmd, from: p(cmd.from), to: p(cmd.to) };
    case "arrow":
      return { ...cmd, from: typeof cmd.from === "string" ? cmd.from : p(cmd.from), to: typeof cmd.to === "string" ? cmd.to : p(cmd.to) };
    case "strike":
      return cmd;
    case "divider":
      return { ...cmd, x: Math.round(cmd.x + dx) };
    default:
      return { ...cmd, x: Math.round(cmd.x + dx), y: Math.round(cmd.y + dy) } as DrawCommand;
  }
}

const NOTE_BOX: Box = { x: NOTE_PANEL.x - 6, y: NOTE_PANEL.y - 6, w: NOTE_PANEL.w + 6, h: NOTE_PANEL.h + 6 };

/**
 * Stateful layouter for one lesson stream. Call it on every main-layer segment in order.
 * Note-layer segments are passed through untouched (noteLayouter handles them).
 */
/**
 * `opts.top`: y of the first row (a live answer on the wiped board starts below the phone toolbar);
 * `opts.reserve`: extra areas kept free (the toolbar that sits over the board top-right on phones).
 */
export function mainLayouter(opts: { top?: number; reserve?: Box[] } = {}) {
  const TOP = opts.top ?? 40;
  // what is on the board right now (main layer), by element id
  let placed = new Map<string, Box>();
  // what kind of drawing each id is (an op never changes for an id within a lesson)
  const opOf = new Map<string, string>();
  // how far the layout moved each element from the LLM's coordinates
  const delta = new Map<string, [number, number]>();
  // top of the most recently written content: moved drawings go at or below it
  let cursor = 0;

  const fits = (boxes: Box[], dx: number, dy: number, obs: Box[]) => {
    for (const b of boxes) {
      const m = { x: b.x + dx, y: b.y + dy, w: b.w, h: b.h };
      if (m.x < M || m.y < M || m.x + m.w > BOARD_W - M || m.y + m.h > BOARD_H - M) return false;
      for (const o of obs) if (hit(m, o, GAP)) return false;
    }
    return true;
  };

  /** Nearest free offset for a cluster; prefers moving down, then the other column. */
  const findSpot = (boxes: Box[], obs: Box[], cursor = 0): [number, number] | null => {
    if (fits(boxes, 0, 0, obs)) return [0, 0];
    const u = union(boxes);
    let best: [number, number] | null = null;
    let bestCost = Infinity;
    const xs = new Set<number>([u.x]);
    for (let x = M + 8; x <= BOARD_W - M - u.w; x += 20) xs.add(x);
    for (const x of xs) {
      for (let y = M + 8; y <= BOARD_H - M - u.h; y += 8) {
        const dx = x - u.x;
        const dy = y - u.y;
        // reading order: below is cheap, above is expensive, sideways in between
        // and nothing new goes above the line that was written last
        const cost = Math.abs(dx) * 1.2 + (dy >= 0 ? dy : -dy * 3) + (y < cursor ? 600 : 0);
        if (cost >= bestCost) continue;
        if (fits(boxes, dx, dy, obs)) {
          best = [dx, dy];
          bestCost = cost;
        }
      }
    }
    return best;
  };

  const forget = (target: string) => {
    if (target === "all") {
      placed = new Map();
      delta.clear();
      cursor = 0;
    } else if (target !== "note") {
      placed.delete(target);
      delta.delete(target);
    }
  };

  // the last content drawn on the main layer ("row: same" continues it)
  let lastId: string | null = null;

  /**
   * Relative placement → absolute x/y. The LLM can't see the board, so instead of guessing
   * coordinates it may say `place: { row: "next" }` (new line under everything), `row: "same"`
   * (continue the last line), or `rightOf / leftOf / below / above: <id>`. Collision checks
   * still run afterwards as the safety net.
   */
  const resolvePlace = (cmds: BoardCommand[]): BoardCommand[] => {
    const local = new Map<string, Box>();
    const boxOf = (tid: string | undefined) => (tid ? (local.get(tid) ?? placed.get(tid)) : undefined);
    const bottom = () => Math.max(0, ...[...placed.values(), ...local.values()].map((b) => b.y + b.h));
    return cmds.map((c0) => {
      if (c0.op === "erase") {
        if (c0.target === "all") {
          local.clear();
          lastId = null;
        } else local.delete(c0.target);
      }
      if (!isDraw(c0)) return c0;
      const c1 = c0 as DrawCommand & { place?: Place };
      let c: DrawCommand = c1;
      const p = c1.place;
      if (p && "x" in c1 && "y" in c1) {
        const { place: _drop, ...rest } = c1;
        c = fitWidth(rest as DrawCommand);
        // measure at the origin to know the drawing's size and where its box sits relative to x/y
        const b = measure({ ...c, x: 0, y: 0 } as DrawCommand);
        const at = (left: number, top: number) => {
          c = { ...c, x: Math.round(left - b.x), y: Math.round(top - b.y) } as DrawCommand;
        };
        const textual = (tid: string) => CONTENT.has(opOf.get(tid) ?? localOp.get(tid) ?? "");
        const t =
          (p.rightOf && boxOf(p.rightOf) && (["rightOf", p.rightOf] as const)) ||
          (p.leftOf && boxOf(p.leftOf) && (["leftOf", p.leftOf] as const)) ||
          (p.below && boxOf(p.below) && (["below", p.below] as const)) ||
          (p.above && boxOf(p.above) && (["above", p.above] as const)) ||
          null;
        const last = boxOf(lastId ?? undefined);
        if (t) {
          const tb = boxOf(t[1])!;
          const midY = tb.y + tb.h / 2 - b.h / 2;
          const alignX = textual(t[1]) ? tb.x : tb.x + tb.w / 2 - b.w / 2; // text rows left-align, shapes centre
          if (t[0] === "rightOf") at(tb.x + tb.w + 24, midY);
          else if (t[0] === "leftOf") at(tb.x - b.w - 24, midY);
          else if (t[0] === "below") at(alignX, tb.y + tb.h + 18);
          else at(alignX, tb.y - b.h - 18);
        } else if (p.row === "same" && last) {
          at(last.x + last.w + 24, last.y + last.h / 2 - b.h / 2);
        } else {
          const y = bottom();
          // board full → start again at the top (the layouter then wipes for a new page)
          at(50, y === 0 || y + 22 + b.h > BOARD_H - M ? TOP : y + 22);
        }
      }
      const box = measure(c);
      local.set(c.id, box);
      localOp.set(c.id, c.op);
      if (CONTENT.has(c.op)) lastId = c.id;
      return c;
    });
  };
  const localOp = new Map<string, string>();

  return <T extends { board: BoardCommand[]; layer?: string }>(seg: T): T => {
    if (seg.layer === "note") return seg;
    const cmds = resolvePlace(seg.board);

    // erases that come before the first drawing apply first ("erase all" = new page)
    const firstDraw = cmds.findIndex((c) => isDraw(c));
    cmds.forEach((c, i) => {
      if (c.op === "erase" && (firstDraw < 0 || i < firstDraw)) forget(c.target);
    });

    // 1) drawings we may move
    type Item = { i: number; cmd: DrawCommand; box: Box; anchored: boolean };
    const items: Item[] = [];
    const replaced = new Set<string>();
    const resized = new Map<number, DrawCommand>();
    const anchorDelta = new Map<string, [number, number]>();
    for (let i = 0; i < cmds.length; i++) {
      const c0 = cmds[i];
      if (!isDraw(c0)) continue;
      if (c0.op === "strike" || c0.op === "divider" || (c0.op === "arrow" && (typeof c0.from === "string" || typeof c0.to === "string"))) continue;
      const c = fitWidth(c0);
      if (c !== c0) resized.set(i, c);
      if (placed.has(c.id)) replaced.add(c.id); // same id = rewrite in place
      const box = measure(c);
      opOf.set(c.id, c.op);
      // a frame (rect/circle/ellipse) is an annotation only if it surrounds what it touches —
      // a new rectangle that merely grazes old text is a new diagram and may be moved;
      // lines/arrows/ticks are annotations when they touch (underline, connector, check mark)
      const frame = c.op === "rect" || c.op === "circle" || c.op === "ellipse";
      // lines that meet other new lines end-to-end are a drawn shape (triangle, polygon), not an underline
      const polygon =
        c.op === "line" &&
        cmds.some(
          (o, j) =>
            j !== i &&
            o.op === "line" &&
            [o.from, o.to].some((p) => [c.from, c.to].some((q) => Math.hypot(p[0] - q[0], p[1] - q[1]) < 8)),
        );
      // Annotations are recognised in the LLM's own coordinates: compare against where each
      // element was ORIGINALLY drawn (placed box minus the shift the layout gave it). The
      // annotation then gets the same shift, so a trace around a moved rectangle follows it.
      const target = !ANNOT.has(c.op)
        ? undefined
        : [...placed.entries()].find(([id, pb]) => {
          if (replaced.has(id)) return false;
          const [sx, sy] = delta.get(id) ?? [0, 0];
          const b = { x: pb.x - sx, y: pb.y - sy, w: pb.w, h: pb.h };
          const op = opOf.get(id) ?? "";
          // a polygon is an annotation only when it traces an existing shape (perimeter drawn
          // around a rectangle); touching old text just means it landed in the wrong place
          if (polygon) {
            if (!SHAPE_OPS.has(op) || c.op !== "line") return false;
            // traced = both ends of this side lie on that shape's outline
            const onEdge = (p: [number, number]) =>
              p[0] > b.x - 12 && p[0] < b.x + b.w + 12 && p[1] > b.y - 12 && p[1] < b.y + b.h + 12 &&
              Math.min(Math.abs(p[0] - b.x), Math.abs(p[0] - (b.x + b.w)), Math.abs(p[1] - b.y), Math.abs(p[1] - (b.y + b.h))) < 12;
            return onEdge(c.from) && onEdge(c.to);
          }
          if (!frame) return hit(box, b, 4);
          // frames go around content (an answer, a number), never around another line or shape
          if (!CONTENT.has(op)) return false;
          const cx = b.x + b.w / 2;
          const cy = b.y + b.h / 2;
          return cx > box.x && cx < box.x + box.w && cy > box.y && cy < box.y + box.h;
        })?.[0];
      let cmd = c;
      let ibox = box;
      if (target) {
        const [sx, sy] = delta.get(target) ?? [0, 0];
        if (sx || sy) {
          cmd = shift(c, sx, sy);
          ibox = { ...box, x: box.x + sx, y: box.y + sy };
          resized.set(i, cmd);
        }
        anchorDelta.set(c.id, [sx, sy]);
      }
      items.push({ i, cmd, box: ibox, anchored: !!target });
    }

    // 1b) a label that cuts into the shape it labels ("4 sm" written on the square's edge) is
    //     nudged just outside, along the shortest way out
    const shapes = items.filter((it) => it.cmd.op === "rect" || it.cmd.op === "circle" || it.cmd.op === "ellipse");
    for (const it of items) {
      if (!isLabel(it.cmd.op, it.box)) continue;
      for (const sh of shapes) {
        const a = it.box;
        const b = sh.box;
        if (!hit(a, b)) continue;
        const moves: [number, number][] = [
          [0, b.y - (a.y + a.h) - 4], // up
          [0, b.y + b.h - a.y + 4], // down
          [b.x - (a.x + a.w) - 4, 0], // left
          [b.x + b.w - a.x + 4, 0], // right
        ];
        const [dx, dy] = moves.sort((p, q) => Math.abs(p[0]) + Math.abs(p[1]) - (Math.abs(q[0]) + Math.abs(q[1])))[0];
        it.cmd = shift(it.cmd, dx, dy);
        it.box = { ...a, x: a.x + dx, y: a.y + dy };
        resized.set(it.i, it.cmd);
      }
      // sides drawn as lines (a triangle): bounding boxes of diagonals are useless, so measure
      // the distance to the segment itself and step the label away along the line's normal
      // (one loop over all lines: stepping away from one side must not push it into another)
      const lines = items.filter((ln) => ln.cmd.op === "line").map((ln) => ln.cmd as Extract<DrawCommand, { op: "line" }>);
      let mx = 0;
      let my = 0;
      for (let k = 0; k < 24 && lines.length; k++) {
        let near: (typeof lines)[number] | null = null;
        let nd = LINE_CLEAR;
        for (const ln of lines) {
          const d = segBoxDist(ln.from, ln.to, it.box);
          if (d < nd) {
            nd = d;
            near = ln;
          }
        }
        if (!near) break;
        const { from: a, to: b } = near;
        const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
        let nx = -(b[1] - a[1]) / len;
        let ny = (b[0] - a[0]) / len;
        const cx = it.box.x + it.box.w / 2;
        const cy = it.box.y + it.box.h / 2;
        if ((cx - a[0]) * nx + (cy - a[1]) * ny < 0) {
          nx = -nx;
          ny = -ny;
        }
        it.box = { ...it.box, x: it.box.x + nx * 4, y: it.box.y + ny * 4 };
        mx += nx * 4;
        my += ny * 4;
      }
      if (mx || my) {
        it.cmd = shift(it.cmd, Math.round(mx), Math.round(my));
        resized.set(it.i, it.cmd);
      }
    }

    // 2) cluster the free drawings of this segment (union-find on proximity)
    const free = items.filter((it) => !it.anchored);
    const parent = free.map((_, k) => k);
    const find = (k: number): number => (parent[k] === k ? k : (parent[k] = find(parent[k])));
    for (let a = 0; a < free.length; a++)
      for (let b = a + 1; b < free.length; b++) {
        const A = free[a], B = free[b];
        // two text lines stay independent rows; shapes stick together, and a shape keeps only
        // its small labels — a full line of text next to a shape is its own row and gets moved
        const aC = CONTENT.has(A.cmd.op);
        const bC = CONTENT.has(B.cmd.op);
        const glue = (!aC && !bC) || (aC !== bC && (aC ? isLabel(A.cmd.op, A.box) : isLabel(B.cmd.op, B.box)));
        if (glue && hit(A.box, B.box, CLUSTER_GAP)) parent[find(a)] = find(b);
      }
    const clusters = new Map<number, Item[]>();
    free.forEach((it, k) => {
      const r = find(k);
      clusters.set(r, [...(clusters.get(r) ?? []), it]);
    });
    const ordered = [...clusters.values()].sort((a, b) => a[0].i - b[0].i);

    // 3) place clusters in drawing order; if the board is full, wipe it once and lay the
    //    whole segment out on a fresh board
    const place = (base: Map<string, Box>, strict: boolean, cur0: number) => {
      const board = new Map(base);
      let cur = cur0;
      const off = new Map<number, [number, number]>();
      for (const cl of ordered) {
        const obs: Box[] = [NOTE_BOX, ...(opts.reserve ?? [])];
        for (const [id, b] of board) if (!replaced.has(id) || !cl.some((it) => it.cmd.id === id)) obs.push(b);
        // this segment's annotations stay where they are, so nothing else may land on them
        if (strict) for (const it of items) if (it.anchored) obs.push(it.box);
        const boxes = cl.map((it) => it.box);
        const spot = findSpot(boxes, obs, cur) ?? (strict ? null : clampOffset(union(boxes)));
        if (!spot) return null;
        if (cl.some((it) => CONTENT.has(it.cmd.op))) cur = Math.max(cur, union(boxes).y + spot[1]);
        for (const it of cl) {
          off.set(it.i, spot);
          board.set(it.cmd.id, { x: it.box.x + spot[0], y: it.box.y + spot[1], w: it.box.w, h: it.box.h });
        }
      }
      return { board, off, cur };
    };
    let wipe = false;
    let res = place(placed, true, cursor);
    if (!res) {
      wipe = true;
      res = place(new Map(), false, 0)!;
      for (const it of items) if (it.anchored) it.anchored = false; // their targets are gone
    }
    placed = res.board;
    cursor = res.cur;
    if (wipe) delta.clear();
    for (const it of items) {
      const o = res.off.get(it.i);
      const r = resized.get(it.i) !== undefined && it.anchored ? (anchorDelta.get(it.cmd.id) ?? [0, 0]) : [0, 0];
      // total shift from the LLM's coordinates = pre-shift (anchored follow) + placement offset
      delta.set(it.cmd.id, [r[0] + (o?.[0] ?? 0), r[1] + (o?.[1] ?? 0)]);
      if (it.anchored) placed.set(it.cmd.id, it.box);
    }

    // 4) emit
    const out: BoardCommand[] = [];
    for (let i = 0; i < cmds.length; i++) {
      const c = cmds[i];
      if (wipe && i === firstDraw) out.push({ op: "erase", target: "all" });
      if (c.op === "erase" && firstDraw >= 0 && i > firstDraw) forget(c.target);
      if (!isDraw(c)) {
        out.push(c);
        continue;
      }
      const o = res.off.get(i);
      const d = resized.get(i) ?? c;
      out.push(o ? shift(d, o[0], o[1]) : d);
    }
    return { ...seg, board: out };
  };
}

function clampOffset(u: Box): [number, number] {
  const x = Math.min(Math.max(M, u.x), Math.max(M, BOARD_W - M - u.w));
  const y = Math.min(Math.max(M, u.y), Math.max(M, BOARD_H - M - u.h));
  return [x - u.x, y - u.y];
}

export function layoutMainSegments<T extends { board: BoardCommand[]; layer?: string }>(segs: T[]): T[] {
  const lay = mainLayouter();
  return segs.map((s) => lay(s));
}
