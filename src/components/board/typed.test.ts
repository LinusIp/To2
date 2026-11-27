import { describe, expect, it } from "vitest";
import { isTypedOp, plainMath } from "./typedText";
import type { BoardEl } from "@/lib/board/model";

describe("typed board", () => {
  it("latex becomes plain readable math", () => {
    expect(plainMath(String.raw`\frac{1}{2} + \frac{1}{3}`)).toBe("1/2 + 1/3");
    expect(plainMath(String.raw`x^2 - 5x \cdot 2`)).toBe("x² - 5x · 2");
    expect(plainMath(String.raw`\sqrt{16} = 4`)).toBe("√16 = 4");
    expect(plainMath(String.raw`2\pi r`)).toBe("2π r");
  });
  it("only writing is typed; shapes, fraction bars and plots stay chalk", () => {
    const el = (op: string) => ({ cmd: { op } }) as unknown as BoardEl;
    expect(isTypedOp(el("write"))).toBe(true);
    expect(isTypedOp(el("latex"))).toBe(true);
    for (const op of ["fractionbar", "rect", "line", "plot", "numberline", "arrow", "tick"]) expect(isTypedOp(el(op)), op).toBe(false);
  });
});
