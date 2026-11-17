import { describe, expect, it } from "vitest";
import { resolveStart } from "./resume";

const seg = (type: "explain" | "ask" | "praise" | "hint" | "check") => ({ type });
const LESSON = [seg("explain"), seg("explain"), seg("explain"), seg("ask"), seg("praise"), seg("explain")];

describe("lesson start point (refresh / back from the quiz)", () => {
  it("starts at 0 as soon as the first segment arrives", () => {
    expect(resolveStart([], 0, false)).toBeNull();
    expect(resolveStart(LESSON.slice(0, 1), 0, false)).toBe(0);
  });
  it("resumes at the saved segment, waiting until it has streamed in", () => {
    expect(resolveStart(LESSON.slice(0, 3), 4, false)).toBeNull();
    expect(resolveStart(LESSON, 4, false)).toBe(4);
    // a shorter lesson than saved (e.g. regenerated): the last segment, once the stream is done
    expect(resolveStart(LESSON.slice(0, 3), 4, true)).toBe(2);
  });
  it("'explain' = the first explanation after the greeting", () => {
    expect(resolveStart(LESSON.slice(0, 1), "explain", false)).toBeNull();
    expect(resolveStart(LESSON, "explain", false)).toBe(1);
    expect(resolveStart([seg("explain"), seg("ask")], "explain", true)).toBe(0);
  });
});
