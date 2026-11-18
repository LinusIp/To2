// Causes: a zod-failed segment must be dropped without stalling the rest; a broken LLM stream is
// continued (not regenerated) from the segments the learner already has.
import { describe, expect, it } from "vitest";
import { continuationMessages, segmentFromLLM, type SegState } from "./llmSegments";
import type { LessonSegment } from "./schema";

const ok = (id: string, extra: Record<string, unknown> = {}) => JSON.stringify({ id, type: "explain", say: "Salom!", emotion: "happy", board: [], ...extra });

describe("segmentFromLLM", () => {
  it("drops an invalid segment and keeps accepting the next ones", () => {
    const st: SegState = { count: 0, seen: new Set(), note: false };
    const objs = [ok("a"), JSON.stringify({ id: "b", type: "explain", emotion: "happy", board: [] }), "{oops", ok("c")];
    const res = objs.map((o) => segmentFromLLM(o, st));
    expect(res.map((r) => r.ok)).toEqual([true, false, false, true]);
    expect(res.filter((r) => r.ok).map((r) => (r.ok ? r.seg.id : ""))).toEqual(["a", "c"]);
    expect(st.count).toBe(2);
  });

  it("an 'ask' without an expected answer becomes an explanation (never waits for an answer it can't check)", () => {
    const r = segmentFromLLM(ok("q", { type: "ask" }), { count: 0, seen: new Set(), note: false });
    expect(r.ok && r.seg.type).toBe("explain");
  });

  it("continuation keeps ids unique against what the learner already has", () => {
    const st: SegState = { count: 3, seen: new Set(["s1", "s2", "s3"]), note: false };
    const r = segmentFromLLM(ok("s2"), st);
    expect(r.ok && r.seg.id).toBe("s2_3");
    const auto = segmentFromLLM(JSON.stringify({ type: "explain", say: "x", emotion: "neutral", board: [] }), st);
    expect(auto.ok && auto.seg.id).toBe("s5");
  });

  it("interrupt answers always land on the note layer", () => {
    const r = segmentFromLLM(ok("n1"), { count: 0, seen: new Set(), note: true });
    expect(r.ok && r.seg.layer).toBe("note");
  });
});

describe("continuationMessages", () => {
  it("replays what the learner has as the assistant's reply, then asks for the rest only", () => {
    const prior = [JSON.parse(ok("s1")), JSON.parse(ok("s2"))] as LessonSegment[];
    const m = continuationMessages([{ role: "system", content: "sys" }, { role: "user", content: "dars" }], prior);
    expect(m.map((x) => x.role)).toEqual(["system", "user", "assistant", "user"]);
    expect(JSON.parse(m[2].content).map((s: LessonSegment) => s.id)).toEqual(["s1", "s2"]);
    expect(m[3].content).toMatch(/QOLGAN/);
  });
});
