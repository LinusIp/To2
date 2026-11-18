import { describe, expect, it } from "vitest";
import { parseVoiceCommand } from "./commands";
import { DEFAULTS, clampRate, togglePreset } from "./settings";

const type = (s: string) => parseVoiceCommand(s)?.type ?? null;

describe("parseVoiceCommand", () => {
  it("lesson commands", () => {
    expect(type("Davom et")).toBe("continue");
    expect(type("iltimos davom eting")).toBe("continue");
    expect(type("keyingi")).toBe("continue");
    expect(type("Qaytar")).toBe("repeat");
    expect(type("yana bir marta ayting")).toBe("repeat");
    expect(type("sekinroq")).toBe("slower");
    expect(type("Sekinroq gapiring iltimos")).toBe("slower");
    expect(type("tezroq")).toBe("faster");
    expect(type("Tushunmadim")).toBe("confused");
    expect(type("yana tushuntir")).toBe("confused");
    expect(type("to'xta")).toBe("stop");
    expect(type("toxta")).toBe("stop");
    expect(type("doskani o'qib ber")).toBe("read");
    expect(type("Bosh sahifa")).toBe("home");
    expect(type("bosh sahifaga qayt")).toBe("home");
  });
  it("answers A/B/C/D, said in many ways", () => {
    const letter = (s: string) => {
      const c = parseVoiceCommand(s);
      return c?.type === "answer" ? c.letter : null;
    };
    expect(letter("javob A")).toBe("A");
    expect(letter("A javob")).toBe("A");
    expect(letter("B")).toBe("B");
    expect(letter("be")).toBe("B");
    expect(letter("menimcha C")).toBe("C");
    expect(letter("si")).toBe("C");
    expect(letter("D variant")).toBe("D");
    expect(letter("bni tanlayman")).toBe("B");
    expect(letter("birinchisi")).toBe("A");
    expect(letter("javob to'rtinchi")).toBe("D");
  });
  it("questions for the tutor are not commands", () => {
    for (const q of ["Nega maxrajlarni ko'paytirdik?", "a bilan b nima", "Kasr nima degani", "bu yerda nima uchun olti", ""]) expect(parseVoiceCommand(q), q).toBeNull();
  });
});

describe("settings presets", () => {
  it("a preset switches its options on, and off again only if no other preset needs them", () => {
    const v = togglePreset(DEFAULTS, "vision");
    expect(v).toMatchObject({ voiceFirst: true, highContrast: true, textScale: 1.5, bigTargets: true, asked: true });
    const vm = togglePreset(v, "motor");
    const m = togglePreset(vm, "vision");
    expect(m.voiceFirst).toBe(false);
    expect(m.bigTargets).toBe(true); // motor still wants big targets
    expect(m.handsFree).toBe(true);
  });
  it("speech rate is clamped to 0.75–1.25", () => {
    expect(clampRate(2)).toBe(1.25);
    expect(clampRate(0.1)).toBe(0.75);
    expect(clampRate(NaN)).toBe(1);
  });
});
