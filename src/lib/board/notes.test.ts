// BUG 2: interruption answers wrote into the same spot of the note box (2 rows, extra rows clamped
// onto the last one, and every request restarted at row 0) → overlapping, unreadable chalk.
// Notes are now laid out from the actual board state on the "Savolingiz" side board.
import { describe, expect, it } from "vitest";
import type { BoardCommand } from "@/lib/ai/schema";
import { SIDE_BOARD, SIDE_ROWS, applyCommand, emptyBoard, fadeHighlights, wrapNote, type BoardState } from "./model";
import { noteLayouter } from "./model";
import { rngFrom, strokesFor } from "@/components/board/handwriting";

type Box = { x: number; y: number; w: number; h: number };
/** real chalk extent of a drawn element */
function inkBox(cmd: Parameters<typeof strokesFor>[0]): Box {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const s of strokesFor(cmd, rngFrom(3)))
    for (const [x, y] of s.pts) {
      x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
    }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}
const hit = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const inside = (a: Box, r: Box) => a.x >= r.x && a.y >= r.y && a.x + a.w <= r.x + r.w && a.y + a.h <= r.y + r.h;

/** one interrupt answer as the server sends it (note layouter) and the engine applies it */
function answer(state: BoardState, n: number, texts: string[]): BoardState {
  const lay = noteLayouter(); // a fresh layouter per request, exactly like /api/tutor
  const seg = lay({ board: texts.map((text, i): BoardCommand => ({ op: "write", id: `n${n}_${i}`, x: 0, y: 0, text, size: "m", color: "orange" })) });
  return seg.board.reduce((s, c) => applyCommand(s, c, "note"), state);
}

function notesOk(state: BoardState) {
  const notes = state.els.filter((e) => e.layer === "note").map((e) => ({ id: e.id, box: inkBox(e.cmd) }));
  for (const n of notes) expect(inside(n.box, SIDE_BOARD), `${n.id} inside the side board`).toBe(true);
  for (let i = 0; i < notes.length; i++)
    for (let j = i + 1; j < notes.length; j++) expect(hit(notes[i].box, notes[j].box), `${notes[i].id} vs ${notes[j].id}`).toBe(false);
  return notes.length;
}

describe("side-board notes", () => {
  it("3 interrupts × 3 notes: no two notes overlap, every note is inside the side board", () => {
    let s = emptyBoard();
    const answers = [
      ["EKUK (2; 3) = 6", "6 : 2 = 3", "6 : 3 = 2"],
      ["bir xil bo'laklar kerak", "1/2 = 3/6", "1/3 = 2/6"],
      ["EKUB (6; 8) = 2", "8 = 2 · 2 · 2", "6 = 2 · 3"],
    ];
    answers.forEach((texts, n) => {
      // before every answer the engine clears the previous one (wipe animation)
      s = { ...s, els: s.els.filter((e) => e.layer !== "note") };
      s = answer(s, n, texts);
      expect(notesOk(s)).toBe(3);
    });
  });

  it("the SAME answer's notes never share a row, even without clearing (e.g. 'Yana tushuntir' adds more)", () => {
    let s = emptyBoard();
    for (let n = 0; n < 3; n++) {
      s = answer(s, n, ["birinchi", "ikkinchi", "uchinchi"]);
      expect(notesOk(s)).toBeGreaterThan(0); // a full board was wiped and started at the top
    }
  });

  it("a long note wraps to 2 rows (never past the edge); an over-long one ends with …", () => {
    expect(wrapNote("Olti ikkiga ham, uchga ham bo'linadi va u eng kichigi")).toHaveLength(2);
    const w = wrapNote("a".repeat(200));
    expect(w).toHaveLength(2);
    expect(w[1].endsWith("…")).toBe(true);
    let s = answer(emptyBoard(), 0, ["Olti ikkiga ham, uchga ham bo'linadi va u eng kichigi", "qisqa"]);
    const long = s.els.find((e) => e.id === "n0_0")!;
    expect(long.rows).toBe(2);
    expect(s.els.find((e) => e.id === "n0_1")!.row).toBe(2);
    notesOk(s);
    s = answer(s, 1, ["yana bir uzun izoh: bu ham ikki qatorga bo'linishi kerak"]); // no room → wipe → top
    expect(s.els.filter((e) => e.layer === "note").map((e) => e.row)).toEqual([0]);
    notesOk(s);
  });

  it(`the side board has ${SIDE_ROWS} rows`, () => {
    expect(SIDE_ROWS).toBe(3);
  });
});

describe("highlights", () => {
  it("one at a time, yellow, fading when the step ends", () => {
    let s = emptyBoard();
    s = applyCommand(s, { op: "write", id: "a", x: 10, y: 10, text: "1/2" });
    s = applyCommand(s, { op: "write", id: "b", x: 10, y: 90, text: "1/3" });
    s = applyCommand(s, { op: "highlight", target: "a", color: "orange" }, "note");
    s = applyCommand(s, { op: "highlight", target: "b" });
    expect(s.els.filter((e) => e.highlight).map((e) => [e.id, e.highlight])).toEqual([["b", "yellow"]]);
    s = fadeHighlights(s);
    expect(s.els.find((e) => e.id === "b")?.hlOff).toBe(true);
    s = applyCommand(s, { op: "highlight", target: "missing" });
    expect(s.els.find((e) => e.id === "b")?.hlOff).toBe(true); // unknown target: nothing changes
  });
});

describe("the side slate never covers the lesson", () => {
  const write = (id: string, x: number, y: number, text = "1/2 + 1/3 = 5/6") => ({ op: "write" as const, id, x, y, text, size: "m" as const });
  it("hangs bottom-right when that corner is free, elsewhere when it isn't, and returns null when nothing is free", async () => {
    const { sideSpot, SIDE_SPOTS } = await import("./model");
    let s = emptyBoard();
    s = applyCommand(s, write("t", 40, 40));
    expect(sideSpot(s)).toEqual(SIDE_SPOTS[0]); // bottom-right free
    s = applyCommand(s, write("br", 620, 520));
    const spot = sideSpot(s)!;
    expect(spot).not.toEqual(SIDE_SPOTS[0]);
    s = applyCommand(s, write("bm", 320, 520));
    s = applyCommand(s, write("rm", 620, 300));
    expect(sideSpot(s)).toBeNull(); // → the engine takes the main-board path (wipe, restore on "Davom et")
  });
  it("notes go where the slate hangs", () => {
    const s = applyCommand({ ...emptyBoard(), side: { x: 284, y: 430 } }, { op: "write", id: "n", x: 0, y: 0, text: "EKUK = 12" }, "note");
    const n = s.els.find((e) => e.layer === "note")!;
    expect((n.cmd as { x: number }).x).toBeGreaterThanOrEqual(284);
    expect((n.cmd as { x: number }).x).toBeLessThan(284 + SIDE_BOARD.w);
  });
});
