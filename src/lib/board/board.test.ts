import { describe, expect, it } from "vitest";
import { parseBoard, parseSegments } from "@/lib/ai/schema";
import { applyAll, applyCommand, clearNotes, emptyBoard, scheduleSegment } from "./model";
import { DEMO_LESSONS } from "@/lib/ai/mock/lessons";

describe("board parser", () => {
  it("drops unknown and invalid ops, never throws", () => {
    const cmds = parseBoard([
      { op: "write", id: "a", x: 10, y: 20, text: "1/2" },
      { op: "explode", id: "b" },
      { op: "rect", id: "c", x: "5", y: 5, w: 10, h: 10, color: "BLUE" },
      { op: "line", id: "d" },
      { op: "fractionbar", id: "e", x: 1, y: 1, w: 100, parts: 3, filled: 1, color: "rainbow" },
    ]);
    expect(cmds.map((c) => c.op)).toEqual(["write", "rect", "fractionbar"]);
    expect((cmds[1] as { color?: string }).color).toBe("blue");
    expect((cmds[2] as { color?: string }).color).toBeUndefined();
    expect(parseBoard("nope")).toEqual([]);
  });

  it("parses fenced LLM replies and fills ids", () => {
    const r = parseSegments('Mana:\n```json\n[{"type":"explain","say":"Salom","emotion":"happy","board":[]}]\n```');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.segments[0].id).toBe("s1");
  });

  it("downgrades ask without expect", () => {
    const r = parseSegments('[{"id":"x","type":"ask","say":"Nechta?","emotion":"neutral","board":[]}]');
    expect(r.ok && r.segments[0].type).toBe("explain");
  });

  it("rejects garbage", () => {
    expect(parseSegments("salom").ok).toBe(false);
  });
});

describe("board model", () => {
  it("applies, replaces, highlights and erases", () => {
    let s = applyCommand(emptyBoard(), { op: "write", id: "a", x: 0, y: 0, text: "1" });
    s = applyCommand(s, { op: "write", id: "a", x: 0, y: 0, text: "2" });
    expect(s.els).toHaveLength(1);
    s = applyCommand(s, { op: "highlight", target: "a" });
    expect(s.els[0].highlight).toBe("yellow");
    s = applyCommand(s, { op: "write", id: "n", x: 0, y: 0, text: "izoh" }, "note");
    expect(s.els.find((e) => e.layer === "note")?.cmd).toMatchObject({ color: "orange" });
    expect(clearNotes(s).els).toHaveLength(1);
    s = applyCommand(s, { op: "erase", target: "all" });
    expect(s.els).toHaveLength(0);
  });

  it("schedules proportionally within the audio", () => {
    const slots = scheduleSegment(
      [
        { op: "write", id: "a", x: 0, y: 0, text: "uzun matn yozilmoqda" },
        { op: "rect", id: "b", x: 0, y: 0, w: 1, h: 1 },
        { op: "pause", ms: 300 },
      ],
      4000,
    );
    expect(slots[0].end - slots[0].start).toBeGreaterThan(slots[1].end - slots[1].start);
    expect(slots[2].end - slots[2].start).toBe(300);
    expect(slots[2].end).toBeLessThanOrEqual(4000);
  });
});

describe("demo lessons", () => {
  it("are valid and every ask has a checkable answer", () => {
    for (const [id, lesson] of Object.entries(DEMO_LESSONS)) {
      expect(lesson.segments.length, id).toBeGreaterThan(2);
      for (const s of lesson.segments) {
        expect(s.say.length).toBeLessThan(260);
        if (s.type === "ask") expect(s.expect?.answer).toBeTruthy();
      }
      const final = applyAll(emptyBoard(), lesson.segments.flatMap((s) => s.board));
      expect(final.els.length).toBeGreaterThan(0);
    }
  });
});

import { fitToBoard } from "./model";
describe("fitToBoard", () => {
  it("shrinks and shifts overflowing text", () => {
    const c = fitToBoard({ op: "write", id: "t", x: 300, y: 50, text: "EKUK: Eng Kichik Umumiy Karrali", size: "l" });
    expect(c.op === "write" && c.x).toBeLessThanOrEqual(60); // shifted left to fit
    const long = fitToBoard({ op: "write", id: "u", x: 0, y: 0, text: "Algoritm: tub ko'paytuvchilarga ajratish va darajalar", size: "l" });
    expect(long.op === "write" && long.size).not.toBe("l"); // too wide even at x=16 → shrunk
  });
  it("clamps shapes into the canvas", () => {
    const c = fitToBoard({ op: "rect", id: "r", x: 950, y: 600, w: 200, h: 100 });
    expect(c.op === "rect" && c.x + c.w).toBeLessThanOrEqual(984);
    expect(c.op === "rect" && c.y + c.h).toBeLessThanOrEqual(609);
  });
});

import { progressOf, rngFrom, strokesFor, writeText } from "@/components/board/handwriting";
import { parseBoard as parse2 } from "@/lib/ai/schema";
describe("handwriting engine", () => {
  it("writes every character of demo text as strokes", () => {
    const r = rngFrom(1);
    const L = writeText("EKUK (2; 3) = 6 bo'laklar har xil!", 10, 10, 44, "ink", r);
    expect(L.strokes.length).toBeGreaterThan(30);
    expect(L.width).toBeGreaterThan(300);
    for (const s of L.strokes) expect(s.len).toBeGreaterThan(0);
  });
  it("stacks fractions (numerator above the bar, denominator below)", () => {
    const s = strokesFor({ op: "latex", id: "q", x: 50, y: 40, tex: String.raw`\frac{1}{2} + \frac{1}{3}`, size: "m" }, rngFrom(2));
    const ys = s.flatMap((k) => k.pts.map((p) => p[1]));
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(80); // two rows tall
  });
  it("progress reveals strokes in order and moves the chalk tip", () => {
    const s = strokesFor({ op: "write", id: "a", x: 0, y: 0, text: "x=4", size: "l" }, rngFrom(3));
    const half = progressOf(s, 0.5);
    expect(half.tip).not.toBeNull();
    expect(half.drawn[0]).toBe(s[0].len);
    expect(half.drawn[half.drawn.length - 1]).toBe(0);
    expect(progressOf(s, 1).tip).toBeNull();
  });
  it("fraction bars are shaded with chalk hatching", () => {
    const s = strokesFor({ op: "fractionbar", id: "f", x: 0, y: 100, w: 400, parts: 3, filled: 1, color: "blue" }, rngFrom(4));
    expect(s.filter((k) => k.color === "blue").length).toBeGreaterThan(3);
  });
  it("supports §5b ops: wipe, circle-around-target, strike, arrow, tick", () => {
    const cmds = parse2([
      { op: "wipe", target: "all" },
      { op: "circle", target: "a" },
      { op: "strike", target: "a" },
      { op: "arrow", from: "a", to: [500, 300] },
      { op: "tick", x: 10, y: 10 },
    ]);
    expect(cmds.map((c) => c.op)).toEqual(["erase", "highlight", "strike", "arrow", "tick"]);
    let st = applyCommand(emptyBoard(), { op: "write", id: "a", x: 100, y: 100, text: "(x+2)" });
    st = applyAll(st, cmds.slice(2));
    const strike = st.els.find((e) => e.cmd.op === "strike");
    expect(strike && strike.cmd.op === "strike" && strike.cmd.from).toBeTruthy();
    expect(st.els.find((e) => e.cmd.op === "arrow")).toBeTruthy();
  });
});

describe("note layer safety", () => {
  it("an interruption answer cannot erase the main explanation", () => {
    let s = applyCommand(emptyBoard(), { op: "write", id: "q", x: 0, y: 0, text: "1/2+1/3" });
    s = applyCommand(s, { op: "write", id: "n1", x: 0, y: 0, text: "izoh" }, "note");
    s = applyCommand(s, { op: "erase", target: "all" }, "note");
    expect(s.els.map((e) => e.id)).toEqual(["q"]);
    s = applyCommand(s, { op: "erase", target: "q" }, "note");
    expect(s.els.map((e) => e.id)).toEqual(["q"]);
  });
});
