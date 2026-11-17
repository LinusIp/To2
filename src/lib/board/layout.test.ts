import { describe, expect, it } from "vitest";
import type { BoardCommand, DrawCommand } from "@/lib/ai/schema";
import { DEMO_LESSONS } from "@/lib/ai/mock/lessons";
import { layoutMainSegments, measure, mainLayouter, segBoxDist } from "./layout";
import { BOARD_H, BOARD_W, NOTE_PANEL, isDraw } from "./model";

type Seg = { board: BoardCommand[]; layer?: string };
const overlaps = (a: { x: number; y: number; w: number; h: number }, b: typeof a) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/** Replay the segments and return every pair of content drawings that overlap on screen. */
function collisions(segs: Seg[]) {
  let on = new Map<string, DrawCommand>();
  const bad: string[] = [];
  for (const s of segs)
    for (const c of s.board) {
      if (c.op === "erase") {
        if (c.target === "all") on = new Map();
        else on.delete(c.target);
        continue;
      }
      if (!isDraw(c) || c.op === "strike" || c.op === "arrow" || c.op === "tick" || c.op === "divider") continue;
      const b = measure(c);
      if (["write", "latex", "numberline", "fractionbar", "plot"].includes(c.op))
        for (const [id, o] of on) if (id !== c.id && overlaps(b, measure(o)) && !["circle", "ellipse"].includes(o.op)) bad.push(`${c.id}×${id}`);
      on.set(c.id, c);
    }
  return bad;
}

// What the LLM produced in the perimeter lesson (screenshot 17 Nov): a rectangle with side labels,
// then "P = 5 + 3 + 5 + 3 sm?" written straight across it.
const PERIMETER: Seg[] = [
  { board: [{ op: "write", id: "t", x: 260, y: 40, text: "Perimetr nima?", size: "l" }] },
  {
    board: [
      { op: "rect", id: "r", x: 460, y: 150, w: 150, h: 110 },
      { op: "write", id: "a", x: 500, y: 100, text: "5 sm", size: "s", color: "red" },
      { op: "write", id: "b", x: 500, y: 280, text: "5 sm", size: "s", color: "red" },
    ],
  },
  { board: [{ op: "write", id: "eq", x: 240, y: 180, text: "P = 5 + 3 + 5 + 3 sm?", size: "m" }] },
];

describe("main-layer layout", () => {
  it("reproduces the bug without layout", () => {
    expect(collisions(PERIMETER).length).toBeGreaterThan(0);
  });

  it("moves the equation off the rectangle and keeps the diagram intact", () => {
    const out = layoutMainSegments(PERIMETER);
    expect(collisions(out)).toEqual([]);
    // the rectangle and its labels did not move relative to each other
    const [r, a] = out[1].board as DrawCommand[];
    expect([(a as { x: number }).x - (r as { x: number }).x]).toEqual([40]);
  });

  it("keeps everything on the board and out of the note panel", () => {
    const out = layoutMainSegments(PERIMETER);
    for (const s of out)
      for (const c of s.board) {
        if (!isDraw(c)) continue;
        const b = measure(c);
        expect(b.x).toBeGreaterThanOrEqual(0);
        expect(b.y).toBeGreaterThanOrEqual(0);
        expect(b.x + b.w).toBeLessThanOrEqual(BOARD_W);
        expect(b.y + b.h).toBeLessThanOrEqual(BOARD_H);
        expect(overlaps(b, NOTE_PANEL)).toBe(false);
      }
  });

  it("wipes the board (new page) when there is no room left", () => {
    const rows: Seg[] = Array.from({ length: 14 }, (_, k) => ({
      board: [{ op: "write", id: `l${k}`, x: 40, y: 40, text: `Qator ${k}: 12 + 30 = 42`, size: "m" }],
    }));
    const out = layoutMainSegments(rows);
    expect(collisions(out)).toEqual([]);
    expect(out.some((s) => s.board.some((c) => c.op === "erase" && c.target === "all"))).toBe(true);
  });

  it("leaves a circle drawn around an existing answer where it is", () => {
    const lay = mainLayouter();
    lay({ board: [{ op: "write", id: "ans", x: 300, y: 300, text: "16 sm", size: "m" }] });
    const s = lay({ board: [{ op: "circle", id: "c", x: 280, y: 285, w: 150, h: 80, color: "yellow" }] });
    expect(s.board[0]).toMatchObject({ x: 280, y: 285 });
  });

  it("does not move the hand-made demo lessons", () => {
    for (const [, lesson] of Object.entries(DEMO_LESSONS)) {
      const before = collisions(lesson.segments as Seg[]).length;
      const out = layoutMainSegments(lesson.segments as Seg[]);
      expect(collisions(out).length).toBeLessThanOrEqual(before);
    }
  });

  // Live geo-perimeter lesson (LLM, 17 Nov): segments p1 and p5 exactly as cached in KV.
  const GEO_P1: Seg = {
    board: [
      { op: "write", id: "title", x: 50, y: 40, text: "Ko'pburchak perimetri", size: "l", color: "ink" },
      { op: "rect", id: "shape1", x: 400, y: 100, w: 200, h: 150, color: "blue" },
      { op: "write", id: "p_def", x: 50, y: 120, text: "Perimetr (P) = hamma tomonlar yig'indisi", size: "m", color: "green" },
    ],
  };
  const GEO_P5: Seg = {
    board: [
      { op: "erase", target: "all" },
      { op: "rect", id: "sq", x: 400, y: 100, w: 150, h: 150, color: "purple" },
      { op: "write", id: "sq_side", x: 450, y: 80, text: "4 sm", size: "s", color: "ink" },
      { op: "write", id: "sq_note", x: 50, y: 100, text: "Kvadrat: barcha tomonlar teng", size: "m", color: "purple" },
    ],
  };
  /** every drawing (shapes too) against everything already on the board */
  function anyOverlap(segs: Seg[]) {
    let on = new Map<string, DrawCommand>();
    const bad: string[] = [];
    for (const s of segs)
      for (const c of s.board) {
        if (c.op === "erase") {
          if (c.target === "all") on = new Map();
          else on.delete(c.target);
          continue;
        }
        if (!isDraw(c)) continue;
        for (const [id, o] of on) if (id !== c.id && overlaps(measure(c), measure(o))) bad.push(`${c.id}×${id}`);
        on.set(c.id, c);
      }
    return bad;
  }

  it("shrinks a line that is wider than the board instead of leaving it on top of things", () => {
    expect(measure(GEO_P1.board[2] as DrawCommand).w).toBeGreaterThan(BOARD_W); // the bug
    const out = layoutMainSegments([GEO_P1]);
    expect(anyOverlap(out)).toEqual([]);
    const def = out[0].board.find((c) => isDraw(c) && c.id === "p_def") as DrawCommand;
    expect(measure(def).w).toBeLessThanOrEqual(BOARD_W - 32);
  });

  it("does not glue a full line of text to the shape it overlaps; labels stay with the shape", () => {
    expect(anyOverlap([GEO_P5]).length).toBeGreaterThan(0); // the bug
    const out = layoutMainSegments([GEO_P5]);
    expect(anyOverlap(out)).toEqual([]);
    const sq = out[0].board.find((c) => isDraw(c) && c.id === "sq") as { x: number; y: number };
    const lbl = out[0].board.find((c) => isDraw(c) && c.id === "sq_side") as { x: number; y: number };
    // "4 sm" stays with the square: same x, just above its top edge
    expect(lbl.x - sq.x).toBe(50);
    const lb = measure(out[0].board.find((c) => isDraw(c) && c.id === "sq_side") as DrawCommand);
    expect(lb.y + lb.h).toBeLessThanOrEqual(sq.y);
    expect(sq.y - (lb.y + lb.h)).toBeLessThan(12);
  });

  it("keeps triangle side labels off the (diagonal) sides — measured against the real chalk", () => {
    // geo-perimeter p5 from the second live LLM run: a triangle drawn as 3 lines + side labels
    const TRI: Seg = {
      board: [
        { op: "line", id: "l1", from: [400, 339], to: [500, 139], color: "blue" },
        { op: "line", id: "l2", from: [500, 139], to: [600, 339], color: "blue" },
        { op: "line", id: "l3", from: [600, 339], to: [400, 339], color: "blue" },
        { op: "write", id: "side1", x: 370, y: 219, text: "3 sm", size: "s", color: "red" },
        { op: "write", id: "side2", x: 530, y: 219, text: "4 sm", size: "s", color: "red" },
        { op: "write", id: "side3", x: 480, y: 349, text: "5 sm", size: "s", color: "red" },
      ],
    };
    const lines = TRI.board.filter((c) => c.op === "line") as Extract<DrawCommand, { op: "line" }>[];
    const minGap = (segs: Seg[]) => {
      const labels = segs[0].board.filter((c) => c.op === "write") as DrawCommand[];
      return Math.min(...labels.flatMap((l) => lines.map((ln) => segBoxDist(ln.from, ln.to, measure(l)))));
    };
    expect(minGap([TRI])).toBeLessThan(2); // the bug: "4 sm" sits on the diagonal
    const out = layoutMainSegments([TRI]);
    expect(minGap(out)).toBeGreaterThanOrEqual(8);
    // labels only stepped aside, they still sit next to their side
    for (const id of ["side1", "side2", "side3"]) {
      const before = TRI.board.find((c) => isDraw(c) && c.id === id) as { x: number; y: number };
      const after = out[0].board.find((c) => isDraw(c) && c.id === id) as { x: number; y: number };
      expect(Math.hypot(after.x - before.x, after.y - before.y)).toBeLessThan(40);
    }
  });

  it("geo-perimeter p1 then p5 lays out cleanly as one lesson", () => {
    expect(anyOverlap(layoutMainSegments([GEO_P1, GEO_P5]))).toEqual([]);
  });

  it("passes note-layer segments through untouched", () => {
    const n: Seg = { layer: "note", board: [{ op: "write", id: "n", x: 600, y: 520, text: "eslatma", size: "s" }] };
    expect(mainLayouter()(n)).toBe(n);
  });
});
