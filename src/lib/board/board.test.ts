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
