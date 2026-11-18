// Bug 3 ("the tutor blocks the board"): at the end of every segment the tutor stands where its
// silhouette covers NO written stroke. Real lessons (the 4 demo lessons + 3 recorded LLM lessons),
// laid out exactly like the server does (topic line + main layout), measured from the real chalk.
import { describe, expect, it } from "vitest";
import type { LessonSegment } from "@/lib/ai/schema";
import { DEMO_LESSONS } from "@/lib/ai/mock/lessons";
import { layoutMainSegments, measure } from "./layout";
import { applyCommand, emptyBoard, fitToBoard } from "./model";
import { covered, restSpot, tutorBox, type Box } from "./tutorSpot";
import f1 from "./__fixtures__/geo-perimeter-llm-1.json";
import f2 from "./__fixtures__/geo-perimeter-llm-2.json";
import f3 from "./__fixtures__/geo-perimeter-llm-3.json";

// the two stage views of ClassroomStage (phone = COMPACT_VIEW, desktop = FULL_VIEW)
const VIEWS = { phone: { x0: 250, w: 1320, s: 0.75 }, desktop: { x0: 0, w: 1600, s: 1 } };

const withTitle = (segs: LessonSegment[], topic: string): LessonSegment[] =>
  segs.map((s, i) => (i === 0 ? { ...s, board: [{ op: "write", id: "_title", x: 22, y: 10, size: "s", color: "ink", text: `Mavzu: ${topic}` }, ...s.board] } : s));

const lessons: [string, LessonSegment[]][] = [
  ...Object.entries(DEMO_LESSONS).map(([k, l]) => [k, l.segments] as [string, LessonSegment[]]),
  ["llm-1", f1 as unknown as LessonSegment[]],
  ["llm-2", f2 as unknown as LessonSegment[]],
  ["llm-3", f3 as unknown as LessonSegment[]],
];

const hit = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

describe("the tutor never covers writing when it talks", () => {
  for (const [name, raw] of lessons) {
    for (const [view, v] of Object.entries(VIEWS)) {
      it(`${name} · ${view}: free at the end of every segment`, () => {
        const segs = layoutMainSegments(withTitle(raw, "Kasrlar").map((s) => ({ ...s, board: s.board.map(fitToBoard) })));
        let board = emptyBoard();
        segs.forEach((seg, i) => {
          for (const c of seg.board) board = applyCommand(board, c, "main");
          const boxes = board.els.map((e) => measure(e.cmd));
          const x = restSpot(boxes, v);
          const t = tutorBox(x, v.s);
          const blocked = board.els.filter((e, k) => hit(t, boxes[k])).map((e) => e.id);
          expect(blocked, `segment ${i + 1}: tutor at stage x ${Math.round(x)} covers ${blocked.join(", ")}`).toEqual([]);
          expect(covered(x, boxes, v, 0)).toBe(0);
        });
      });
    }
  }

  it("prefers the board's far-left edge", () => {
    expect(restSpot([], VIEWS.desktop)).toBeLessThan(220);
    expect(restSpot([], VIEWS.phone)).toBeLessThan(400);
  });

  it("moves away from writing at the left edge (here: off to the left, partly out of frame)", () => {
    const leftColumn: Box[] = [{ x: 10, y: 150, w: 120, h: 400 }];
    const x = restSpot(leftColumn, VIEWS.phone);
    expect(covered(x, leftColumn, VIEWS.phone, 0)).toBe(0);
  });
});
