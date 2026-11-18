import { describe, expect, it } from "vitest";
import { buildMindMap, buildPath, validateGraph, type Curriculum } from "./path";
import { buildRoadmap } from "./roadmap";
import { CURRICULA, getCurriculum } from "@/data/curricula";
import type { Skill } from "@/data/skills";

const math = CURRICULA.matematika;

const CASES: { name: string; m: Record<string, number>; grade: number }[] = [
  { name: "fresh grade 6", m: {}, grade: 6 },
  { name: "demo: weak fractions", m: { "frac-add-unlike": 0.4, "frac-equivalent": 0.86, lcm: 0.86, "frac-intro": 0.86 }, grade: 6 },
  { name: "several weak", m: { lcm: 0.2, gcd: 0.3, "frac-add-unlike": 0.4, primes: 0.45 }, grade: 6 },
  { name: "grade 5 one weak", m: { "nat-div": 0.3 }, grade: 5 },
  { name: "grade 7 mixed", m: { "frac-add-unlike": 0.9, lcm: 0.4 }, grade: 7 },
];

describe("validateGraph", () => {
  it("math graph is a valid DAG", () => {
    expect(validateGraph(math.skills)).toEqual([]);
  });
  it("finds cycles, missing prereqs, duplicates, self-loops", () => {
    const bad: Skill[] = [
      { id: "a", title_uz: "A", grade: 7, prereqs: ["c"], section: "S" },
      { id: "b", title_uz: "B", grade: 7, prereqs: ["a"], section: "S" },
      { id: "c", title_uz: "C", grade: 7, prereqs: ["b", "zzz"], section: "S" },
      { id: "d", title_uz: "D", grade: 7, prereqs: ["d"], section: "S" },
      { id: "d", title_uz: "D2", grade: 7, prereqs: [], section: "S" },
    ];
    const kinds = validateGraph(bad).map((i) => i.kind).sort();
    expect(kinds).toEqual(["cycle", "duplicate-id", "missing-prereq", "self-prereq"]);
  });
});

describe("buildPath (maths)", () => {
  for (const c of CASES) {
    it(`same order as buildRoadmap — ${c.name}`, () => {
      const p = buildPath(math, c.m, c.grade);
      const r = buildRoadmap(c.m, c.grade);
      expect(p.order).toEqual(r.path);
      expect(p.currentId).toBe(r.currentId);
      expect(p.weakCount).toBe(r.weakCount);
    });
    it(`prereqs come before dependents — ${c.name}`, () => {
      const p = buildPath(math, c.m, c.grade);
      const at = new Map(p.order.map((id, i) => [id, i]));
      for (const s of p.steps) {
        for (const pre of math.skills.find((k) => k.id === s.id)!.prereqs) {
          if (at.has(pre)) expect(at.get(pre)!).toBeLessThan(at.get(s.id)!);
        }
      }
    });
  }

  it("statuses + reasons on the demo path", () => {
    const p = buildPath(math, CASES[1].m, 6);
    expect(p.currentId).toBe("frac-add-unlike");
    const s = p.steps[0];
    expect(s.status).toBe("current");
    expect(s.reason).toEqual({ kind: "weak" });
    expect(s.order).toBe(1);
  });

  it("prereq reason names the skill that pulled it in; locked steps name a blocker", () => {
    const p = buildPath(math, CASES[2].m, 6);
    const ids = new Set(p.order);
    for (const s of p.steps) {
      if (s.reason.kind === "prereq") expect(ids.has(s.reason.of)).toBe(true);
      if (s.status === "locked") expect(s.lockedBy).toBeTruthy();
    }
    expect(p.steps.filter((s) => s.status === "current")).toHaveLength(1);
  });

  it("a started lesson never locks", () => {
    const m = CASES[2].m;
    const locked = buildPath(math, m, 6).steps.find((s) => s.status === "locked");
    expect(locked).toBeTruthy();
    const again = buildPath(math, m, 6, { started: [locked!.id] }).steps.find((s) => s.id === locked!.id)!;
    expect(again.status).toBe("next");
  });

  it("getCurriculum falls back to maths", () => {
    expect(getCurriculum("nope").id).toBe("matematika");
    expect(getCurriculum(null).id).toBe("matematika");
  });
});

describe("buildMindMap", () => {
  it("every skill lands on exactly one branch; counts add up", () => {
    const m = CASES[1].m;
    const mm = buildMindMap(math, m, buildPath(math, m, 6), { grade: 6 });
    const leaves = mm.branches.flatMap((b) => b.leaves);
    expect(leaves).toHaveLength(math.skills.length);
    expect(new Set(leaves.map((l) => l.id)).size).toBe(math.skills.length);
    expect(mm.total).toBe(math.skills.length);
    expect(mm.mastered).toBe(leaves.filter((l) => l.status === "mastered").length);
    expect(mm.branches.map((b) => b.section)).toEqual([...new Set(math.skills.map((s) => s.section))]);
  });
  it("path skills are marked with their order; current one is unique", () => {
    const m = CASES[2].m;
    const p = buildPath(math, m, 6);
    const mm = buildMindMap(math, m, p, { grade: 6 });
    const on = mm.branches.flatMap((b) => b.leaves).filter((l) => l.onPath);
    expect(on.map((l) => l.id).sort()).toEqual([...p.order].sort());
    expect(on.every((l) => l.order > 0)).toBe(true);
    expect(mm.branches.flatMap((b) => b.leaves).filter((l) => l.status === "current")).toHaveLength(1);
    expect(mm.branches.filter((b) => b.active).length).toBeGreaterThan(0);
  });
  it("maxGrade hides higher skills", () => {
    const p = buildPath(math, {}, 5);
    const mm = buildMindMap(math, {}, p, { grade: 5, maxGrade: 5 });
    expect(mm.branches.flatMap((b) => b.leaves).every((l) => l.grade <= 5)).toBe(true);
  });
});

describe("another subject plugs in (fake Fizika)", () => {
  const fizika: Curriculum = {
    id: "fizika",
    title: "Fizika",
    skills: [
      { id: "fiz-massa", title_uz: "Massa", grade: 7, prereqs: [], section: "Mexanika" },
      { id: "fiz-tezlik", title_uz: "Tezlik", grade: 7, prereqs: [], section: "Mexanika" },
      { id: "fiz-kuch", title_uz: "Kuch", grade: 7, prereqs: ["fiz-massa"], section: "Mexanika" },
      { id: "fiz-zichlik", title_uz: "Zichlik", grade: 7, prereqs: ["fiz-massa"], section: "Modda" },
      { id: "fiz-bosim", title_uz: "Bosim", grade: 7, prereqs: ["fiz-kuch"], section: "Modda" },
      { id: "fiz-ish", title_uz: "Ish", grade: 8, prereqs: ["fiz-kuch"], section: "Energiya" },
    ],
  };
  it("valid graph, path ordered by prereqs", () => {
    expect(validateGraph(fizika.skills)).toEqual([]);
    const p = buildPath(fizika, { "fiz-bosim": 0.3 }, 7);
    expect(p.subject).toBe("fizika");
    expect(p.order).toEqual(["fiz-massa", "fiz-kuch", "fiz-bosim"]);
    expect(p.steps.map((s) => s.reason.kind)).toEqual(["prereq", "prereq", "weak"]);
    expect(p.steps.map((s) => s.status)).toEqual(["current", "locked", "locked"]);
    const mm = buildMindMap(fizika, { "fiz-bosim": 0.3 }, p, { grade: 7 });
    expect(mm.branches.map((b) => b.section)).toEqual(["Mexanika", "Modda", "Energiya"]);
    expect(mm.total).toBe(6);
  });
  it("no measurements → the grade's skills (max 4) are the targets", () => {
    const p = buildPath(fizika, {}, 8);
    expect(p.order).toContain("fiz-ish");
  });
});
