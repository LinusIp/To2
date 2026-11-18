// Where a live answer is written: one short note → the side slate; more notes, any formula or any
// drawing → the main board (wiped first, restored on "Davom et").
import { describe, expect, it } from "vitest";
import { answerDisplay } from "./answers";
import type { LessonSegment } from "./schema";

const seg = (board: LessonSegment["board"], layer?: "main" | "note"): LessonSegment => ({ id: "n1", type: "explain", layer, say: "x", emotion: "neutral", board });

describe("answerDisplay", () => {
  it("one short note → slate", () => {
    expect(answerDisplay(seg([{ op: "write", id: "a", x: 0, y: 0, text: "eng kichik umumiy karrali" }]))).toBe("note");
    expect(answerDisplay(seg([]))).toBe("note");
    expect(answerDisplay(seg([{ op: "highlight", target: "lcm" }]))).toBe("note");
  });
  it("more than one note, a formula or a drawing → main board", () => {
    expect(answerDisplay(seg([{ op: "write", id: "a", x: 0, y: 0, text: "3: 3, 6, 9, 12" }, { op: "write", id: "b", x: 0, y: 0, text: "4: 4, 8, 12" }]))).toBe("main");
    expect(answerDisplay(seg([{ op: "write", id: "a", x: 0, y: 0, text: "EKUK (3; 4) = 12" }]))).toBe("main");
    expect(answerDisplay(seg([{ op: "write", id: "a", x: 0, y: 0, text: "12 : 3 = 4" }]))).toBe("main");
    expect(answerDisplay(seg([{ op: "latex", id: "a", x: 0, y: 0, tex: "\\frac{1}{2}" }]))).toBe("main");
    expect(answerDisplay(seg([{ op: "numberline", id: "n", x: 0, y: 0, w: 300, min: 0, max: 12 }]))).toBe("main");
  });
  it("the LLM can ask for the main board; pinned demo answers stay on the slate", () => {
    expect(answerDisplay(seg([], "main"))).toBe("main");
    expect(answerDisplay(seg([{ op: "write", id: "a", x: 0, y: 0, text: "EKUK (2; 3) = 6" }]), true)).toBe("note");
  });
});
