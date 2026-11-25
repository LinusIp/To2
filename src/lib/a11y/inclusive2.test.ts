// feat/inclusive-2: real text scaling, game narration + voice answers, Juftini top cards, typed board, profiles.
import { describe, expect, it } from "vitest";
import postcss from "postcss";
import textScale, { isFontSizeProp, scaleFontSize } from "../../../scripts/postcss/text-scale.mjs";
import { parseSmallNumber, parseVoiceCommand } from "./commands";
import { toVoiceDetail } from "./bus";
import { boardLines, narrateGameQuestion, typedEl } from "./narrator";
import { DEFAULTS, PRESETS, togglePreset } from "./settings";
import type { BoardEl } from "@/lib/board/model";

describe("text scaling (PostCSS) — font sizes scale, layout does not", () => {
  it("scales px / rem font sizes and Tailwind --text-* tokens", () => {
    expect(scaleFontSize("16px")).toBe("calc(16px * var(--ts, 1))");
    expect(scaleFontSize(".875rem")).toBe("calc(.875rem * var(--ts, 1))");
    expect(scaleFontSize("1.2em")).toBe("1.2em"); // relative to the already-scaled parent
    expect(scaleFontSize("inherit")).toBe("inherit");
    expect(isFontSizeProp("--text-sm")).toBe(true);
    expect(isFontSizeProp("--text-sm--line-height")).toBe(false);
    expect(isFontSizeProp("width")).toBe(false);
  });
  it("rewrites real CSS: font-size and px line-height, never widths/heights/padding", async () => {
    const css = `.a{font-size:16px;line-height:24px;width:360px;height:52px;padding:8px}.b{line-height:1.35}:root{--text-sm:.875rem;--text-sm--line-height:1.4}`;
    const out = (await postcss([textScale()]).process(css, { from: undefined })).css;
    expect(out).toContain("font-size:calc(16px * var(--ts, 1))");
    expect(out).toContain("line-height:calc(24px * var(--ts, 1))");
    expect(out).toContain("width:360px");
    expect(out).toContain("height:52px");
    expect(out).toContain("line-height:1.35");
    expect(out).toContain("--text-sm:calc(.875rem * var(--ts, 1))");
    expect(out).toContain("--text-sm--line-height:1.4");
    // idempotent: a second pass changes nothing
    expect((await postcss([textScale()]).process(out, { from: undefined })).css).toBe(out);
  });
});

describe("games by voice", () => {
  it("reads a game question with numbered choices", () => {
    expect(narrateGameQuestion("1/2 + 1/4 = ?", ["3/4", "2/6"])).toBe(
      "ikkidan bir qo'shuv to'rtdan bir nechaga teng? Birinchi javob: to'rtdan uch. Ikkinchi javob: oltidan ikki. Raqamini ayting, masalan: «javob bir».",
    );
  });
  it('"javob bir…to\'rt" and "javob A–D" → {command:"answer", n}', () => {
    const wire = (s: string) => toVoiceDetail(parseVoiceCommand(s)!);
    expect(wire("javob bir")).toEqual({ command: "answer", n: 1 });
    expect(wire("javob to'rt")).toEqual({ command: "answer", n: 4 });
    expect(wire("javob C")).toEqual({ command: "answer", n: 3 });
  });
  it('Juftini top: "karta …" flips a card', () => {
    expect(parseVoiceCommand("karta besh")).toEqual({ type: "card", n: 5 });
    expect(parseVoiceCommand("karta o'n ikki")).toEqual({ type: "card", n: 12 });
    expect(parseVoiceCommand("kartochka 16")).toEqual({ type: "card", n: 16 });
    expect(toVoiceDetail({ type: "card", n: 7 })).toEqual({ command: "card", n: 7 });
    expect(parseVoiceCommand("karta")).toBeNull();
    expect(parseSmallNumber(["on", "olti"])).toBe(16);
    expect(parseSmallNumber(["yuz"])).toBeNull();
  });
});

describe("typed board", () => {
  const el = (id: string, layer: "main" | "note", cmd: Record<string, unknown>) => ({ id, layer, cmd: { id, ...cmd } }) as unknown as BoardEl;
  it("shows what is written, in reading order, one row per line", () => {
    const b = [
      el("c", "note", { op: "write", x: 600, y: 460, text: "6 = 2 · 3" }),
      el("b", "main", { op: "write", x: 400, y: 62, text: "= 5/6" }),
      el("a", "main", { op: "write", x: 40, y: 60, text: "1/2 + 1/3" }),
      el("d", "main", { op: "fractionbar", x: 40, y: 160, w: 300, parts: 6, filled: 3 }),
      el("e", "main", { op: "line", from: [0, 0], to: [10, 10] }),
    ];
    expect(boardLines(b)).toEqual({ main: ["1/2 + 1/3   = 5/6", "▭ 3/6"], note: ["6 = 2 · 3"] });
    expect(typedEl({ cmd: { op: "latex", id: "x", x: 0, y: 0, tex: "\\frac{1}{2} \\cdot 3" } as never })).toBe("1/2 · 3");
  });
});

describe("profiles", () => {
  it("motor → untimed games; dyslexia and vision → typed board", () => {
    expect(PRESETS.motor.untimed).toBe(true);
    expect(togglePreset(DEFAULTS, "focus").typedBoard).toBe(true);
    expect(togglePreset(DEFAULTS, "vision").typedBoard).toBe(true);
    expect(togglePreset(togglePreset(DEFAULTS, "motor"), "motor").untimed).toBe(false);
  });
});
