import { describe, expect, it } from "vitest";
import { checkAnswer } from "./checker";
import { level, nextStreak, updateMastery } from "./mastery";
import { buildRoadmap } from "./roadmap";
import { DIAG_LENGTH, diagnosticMastery, nextSkill, type DiagAnswer } from "./diagnostic";
import { GENERATORS, generateProblem, missingGenerators, seeded } from "@/data/problems";
import { SKILLS } from "@/data/skills";

describe("mastery", () => {
  it("follows the BKT-lite rules", () => {
    expect(updateMastery(0.3, true)).toBeCloseTo(0.475);
    expect(updateMastery(0.5, false)).toBeCloseTo(0.3);
    expect(updateMastery(0.3, true, true)).toBeLessThan(updateMastery(0.3, true));
    expect(level(0.9)).toBe("mastered");
    expect(level(0.6)).toBe("progress");
    expect(level(0.2)).toBe("weak");
  });
  it("streaks", () => {
    const day = 86_400_000;
    const t = Date.UTC(2026, 10, 17, 6);
    expect(nextStreak(3, t, t + 1000)).toBe(3);
    expect(nextStreak(3, t, t + day)).toBe(4);
    expect(nextStreak(3, t, t + 3 * day)).toBe(1);
    expect(nextStreak(0, t, t)).toBe(1);
  });
});

describe("answer checker", () => {
  const n = (answer: string) => ({ kind: "number" as const, answer });
  it("numbers, decimal comma, units, x=", () => {
    expect(checkAnswer(n("0.5"), "0,5").correct).toBe(true);
    expect(checkAnswer(n("12"), "12 sm").correct).toBe(true);
    expect(checkAnswer(n("4"), "x = 4").correct).toBe(true);
    expect(checkAnswer(n("-3"), "−3").correct).toBe(true);
    expect(checkAnswer(n("4"), "5").correct).toBe(false);
    expect(checkAnswer(n("4"), "").unreadable).toBe(true);
  });
  it("fractions accept equivalents and mixed numbers", () => {
    const f = { kind: "fraction" as const, answer: "5/6" };
    expect(checkAnswer(f, "5/6").correct).toBe(true);
    expect(checkAnswer(f, "10/12").correct).toBe(true);
    expect(checkAnswer(f, "2/5").correct).toBe(false);
    expect(checkAnswer({ kind: "fraction", answer: "3/2" }, "1 1/2").correct).toBe(true);
  });
  it("expressions compare by value", () => {
    const e = { kind: "expression" as const, answer: "5x + 3" };
    expect(checkAnswer(e, "3 + 5x").correct).toBe(true);
    expect(checkAnswer(e, "5*x+3").correct).toBe(true);
    expect(checkAnswer(e, "5x + 4").correct).toBe(false);
    expect(checkAnswer({ kind: "expression", answer: "2m" }, "2m").correct).toBe(true);
  });
  it("choices", () => {
    expect(checkAnswer({ kind: "choice", answer: "Ha", choices: ["Ha", "Yo'q"] }, "ha").correct).toBe(true);
    expect(checkAnswer({ kind: "choice", answer: "Yo'q", choices: ["Ha", "Yo'q"] }, "Yo’q").correct).toBe(true);
  });
});

describe("problem generators", () => {
  it("cover every skill", () => {
    expect(missingGenerators()).toEqual([]);
  });
  it("produce answers the checker accepts", () => {
    const r = seeded(42);
    for (const s of SKILLS) {
      for (let i = 0; i < 12; i++) {
        const p = generateProblem(s.id, r);
        expect(p.q.length).toBeGreaterThan(3);
        expect(checkAnswer(p.expect, p.expect.answer).correct, `${s.id}: ${p.q} → ${p.expect.answer}`).toBe(true);
        if (p.expect.kind === "choice") expect(p.expect.choices).toContain(p.expect.answer);
      }
    }
    expect(Object.keys(GENERATORS).length).toBeGreaterThanOrEqual(SKILLS.length);
  });
});

describe("diagnostic", () => {
  it("starts at fractions for grade 6 and walks down on a miss", () => {
    expect(nextSkill(6, [])).toBe("frac-add-unlike");
    const n = nextSkill(6, [{ skillId: "frac-add-unlike", correct: false }]);
    expect(["frac-equivalent", "lcm", "frac-add-like"]).toContain(n);
  });
  it("finishes after DIAG_LENGTH answers and never repeats", () => {
    const h: DiagAnswer[] = [];
    let i = 0;
    for (;;) {
      const s = nextSkill(6, h);
      if (!s) break;
      expect(h.map((x) => x.skillId)).not.toContain(s);
      h.push({ skillId: s, correct: i++ % 3 !== 0 });
    }
    expect(h.length).toBe(DIAG_LENGTH);
  });
  it("demo path: missing fractions produces a roadmap with it current-or-near", () => {
    const h: DiagAnswer[] = [];
    for (;;) {
      const s = nextSkill(6, h);
      if (!s) break;
      h.push({ skillId: s, correct: s !== "frac-add-unlike" });
    }
    const m = diagnosticMastery(h);
    expect(m["frac-add-unlike"]).toBe(0.4);
    const rm = buildRoadmap(m, 6, { touched: h.map((x) => x.skillId) });
    expect(rm.path).toContain("frac-add-unlike");
    expect(rm.currentId).toBe("frac-add-unlike");
    expect(rm.nodes.find((x) => x.id === "frac-add-unlike")?.status).toBe("current");
  });
});

describe("roadmap", () => {
  it("adds unmastered prereqs before targets (topological)", () => {
    const rm = buildRoadmap({ "frac-add-unlike": 0.2, lcm: 0.2, "frac-equivalent": 0.9, "frac-add-like": 0.9, gcd: 0.9, primes: 0.9, "frac-intro": 0.9, "nat-div": 0.9, "div-rules": 0.9, "nat-mul": 0.9, "nat-add-sub": 0.9, "nat-place-value": 0.9 }, 6);
    expect(rm.path.indexOf("lcm")).toBeLessThan(rm.path.indexOf("frac-add-unlike"));
    expect(rm.currentId).toBe("lcm");
    expect(rm.nodes.find((n) => n.id === "frac-add-unlike")?.status).toBe("locked");
    expect(rm.nodes.find((n) => n.id === "frac-equivalent")?.status).toBe("mastered");
  });
});
