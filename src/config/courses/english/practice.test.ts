import { describe, expect, it } from "vitest";
import { seeded, generateProblem } from "@/data/problems";
import { checkAnswer } from "@/lib/learning/checker";
import { getSkill } from "@/data/skills";
import { ENGLISH_SKILLS, EN_PAIRS, generateEnglishProblem } from ".";
import { EN_GENERATORS } from "./practice";

describe("English practice", () => {
  it("every course skill has a generator, reachable through the shared generateProblem + getSkill", () => {
    for (const s of ENGLISH_SKILLS) {
      expect(EN_GENERATORS[s.id]?.length, s.id).toBeGreaterThan(0);
      expect(getSkill(s.id)?.title_uz).toBe(s.title_uz);
      expect(generateProblem(s.id, seeded(1)).skillId).toBe(s.id);
    }
    expect(generateEnglishProblem("frac-add-unlike")).toBeNull();
  });
  it("problems are 4-choice, the answer is a choice, and the server checker accepts only it", () => {
    for (const s of ENGLISH_SKILLS) {
      const r = seeded(42);
      for (let i = 0; i < 60; i++) {
        const p = generateEnglishProblem(s.id, r)!;
        expect(p.expect.kind).toBe("choice");
        const ch = p.expect.choices!;
        expect(ch, `${s.id}: ${p.q}`).toHaveLength(4);
        expect(new Set(ch.map((c) => c.toLowerCase())).size, `${s.id}: ${ch}`).toBe(4);
        expect(ch).toContain(p.expect.answer);
        expect(checkAnswer(p.expect, p.expect.answer).correct).toBe(true);
        for (const w of ch.filter((c) => c !== p.expect.answer)) expect(checkAnswer(p.expect, w).correct, `${p.q} ${w}`).toBe(false);
        expect(p.q.length).toBeGreaterThan(5);
        expect(p.hint.length).toBeGreaterThan(5);
      }
    }
  });
  it("word ↔ translation pairs are unique both ways (memory game needs that)", () => {
    expect(EN_PAIRS.length).toBeGreaterThanOrEqual(12);
    expect(new Set(EN_PAIRS.map((p) => p.en)).size).toBe(EN_PAIRS.length);
    expect(new Set(EN_PAIRS.map((p) => p.uz)).size).toBe(EN_PAIRS.length);
  });
});
