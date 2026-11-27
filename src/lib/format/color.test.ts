import { describe, expect, it } from "vitest";
import { aaFill, contrastWithWhite } from "./color";

describe("aaFill (flat tile colour readable with white text)", () => {
  it("leaves colours that already pass alone", () => {
    expect(aaFill("#1d4ed8")).toBe("#1d4ed8");
  });
  it("darkens light accents until white text passes AA", () => {
    for (const c of ["#ff8019", "#9d79ff", "#50b390", "#2f6bff", "#159a6b", "#ffc42e"]) {
      const out = aaFill(c);
      expect(contrastWithWhite(out)).toBeGreaterThanOrEqual(4.5);
    }
  });
  it("matches the known ratio for the primary blue", () => {
    expect(contrastWithWhite("#2563eb")).toBeCloseTo(5.17, 1);
  });
});
