import { describe, expect, it } from "vitest";
import { CANONICAL, allPinned, matchPinned, normalizeQuestion, pinnedAnswer, type PinnedId } from "./pinned";
import { LessonSegment } from "./schema";
import { DEMO_LESSONS } from "./mock/lessons";

describe("pinned demo answers", () => {
  it("normalizes case, punctuation and apostrophe variants — keeping word boundaries and Uzbek letters", () => {
    expect(normalizeQuestion("  Nega maxrajlarni KOʻPAYTIRDIK?! ")).toBe("nega maxrajlarni ko'paytirdik");
    expect(normalizeQuestion("nega   ko’paytirdik")).toBe(normalizeQuestion("Nega ko'paytirdik?"));
    expect(normalizeQuestion("O‘n ikki nega?")).toBe("o'n ikki nega");
    expect(normalizeQuestion("on ikki nega")).not.toBe(normalizeQuestion("o'n ikki nega"));
    expect(normalizeQuestion("'EKUK' nima?")).toBe("ekuk nima");
  });

  it("never matches single words or other real questions (negative cases)", () => {
    for (const q of ["nega", "Nega?", "tushuntir", "boshidan", "EKUK", "maxraj"]) expect(matchPinned("frac-add-unlike", q), q).toBeNull();
    const real = [
      "Nega 12?",
      "Kasrlarni ayirganda ham umumiy maxraj kerakmi?",
      "Nega maxrajlarni qo'shmadik?",
      "Surat nima?",
      "Bir ikkidan birni o'nli kasrga qanday aylantiramiz?",
      "EKUB bilan EKUK farqi nima?",
      "Nega oltiga bo'lmadik?",
      "Uchdan bir nega ikkidan birdan kichik?",
      "Javob nechchi chiqdi?",
      "Nega pushti chiziq qisqa?",
    ];
    for (const q of real) expect(matchPinned("frac-add-unlike", q), q).toBeNull();
  });

  it("matches the 3 demo questions and close variants (as STT may write them)", () => {
    const cases: [string, PinnedId][] = [
      ["Nega maxrajlarni ko'paytirdik?", "why-multiply"],
      ["nega maxrajlarni koʻpaytirdik", "why-multiply"],
      ["Nega maxrajlarni kopaytirdik", "why-multiply"],
      ["Nega maxrajlarni oltiga keltirdik?", "why-six"],
      ["nega oltiga?", "why-six"],
      ["Nega 6 ga?", "why-six"],
      ["Nega aynan olti?", "why-six"],
      ["EKUK nima?", "what-lcm"],
      ["ekuk degani nima", "what-lcm"],
    ];
    for (const [q, id] of cases) expect(matchPinned("frac-add-unlike", q), q).toBe(id);
  });

  it("leaves other questions (and other skills) to the live LLM", () => {
    expect(matchPinned("frac-add-unlike", "Kasr nima?")).toBeNull();
    expect(matchPinned("frac-add-unlike", "Nega maxrajlarni qo'shmadik?")).toBeNull();
    expect(matchPinned("eq-two-step", "EKUK nima?")).toBeNull();
  });

  const demoIds = new Set(DEMO_LESSONS["frac-add-unlike"].segments.flatMap((s) => s.board.map((c) => ("id" in c ? c.id : ""))));

  for (const { characterId, question, segments } of allPinned()) {
    it(`${characterId} · ${question}: valid, speech-ready, on the demo board`, () => {
      expect(segments).toHaveLength(3);
      expect(segments.at(-1)!.type).toBe("check");
      for (const s of segments) {
        const r = LessonSegment.safeParse(s);
        expect(r.success, JSON.stringify(r.error?.issues)).toBe(true);
        expect(s.layer).toBe("note");
        // speech-ready: ≤ 12 words per phrase, no digits or maths symbols in `say`
        for (const p of s.say.split(/(?<=[.!?…])\s+/)) expect(p.split(/\s+/).length, p).toBeLessThanOrEqual(12);
        expect(s.say).not.toMatch(/[0-9+=/%()*#:—]/);
        for (const c of s.board) {
          if (c.op === "highlight") expect(demoIds.has(c.target), c.target).toBe(true);
          if (c.op === "write") expect(c.text.length, c.text).toBeLessThanOrEqual(30); // note panel row
        }
      }
    });
  }

  it("every playable tutor has its own answers; others fall back to Blokbek", () => {
    const ids = new Set(allPinned().map((p) => p.characterId));
    expect([...ids].sort()).toEqual(["blokbek", "lola", "ziyo"]);
    expect(pinnedAnswer("what-lcm", "diyorbek")).toEqual(pinnedAnswer("what-lcm", "blokbek"));
    expect(Object.keys(CANONICAL)).toHaveLength(3);
  });
});
