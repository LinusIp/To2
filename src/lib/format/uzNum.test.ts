import { describe, expect, it } from "vitest";
import { uzDecimal, uzNum } from "./uzNum";

describe("uzDecimal (display with the Uzbek decimal comma)", () => {
  it("turns a dot between digits into a comma", () => {
    expect(uzDecimal("0.5 + 1.25 = ?")).toBe("0,5 + 1,25 = ?");
    expect(uzDecimal("3.14")).toBe("3,14");
    expect(uzDecimal("-2.5 · 4")).toBe("-2,5 · 4");
  });
  it("leaves sentence dots, ordinals and non-decimals alone", () => {
    expect(uzDecimal("Javob: 12. Yaxshi.")).toBe("Javob: 12. Yaxshi.");
    expect(uzDecimal("1. Birinchi qadam")).toBe("1. Birinchi qadam");
    expect(uzDecimal(".5 va 5.")).toBe(".5 va 5.");
    expect(uzDecimal("1/2 + 1/3")).toBe("1/2 + 1/3");
  });
  it("is idempotent", () => {
    expect(uzDecimal(uzDecimal("0.75"))).toBe("0,75");
  });
  it("formats numbers", () => {
    expect(uzNum(0.5)).toBe("0,5");
    expect(uzNum(2)).toBe("2");
    expect(uzNum(1 / 3)).toBe("0,33");
    expect(uzNum(12.5, 1)).toBe("12,5");
  });
});
