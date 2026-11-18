import { describe, expect, it } from "vitest";
import { LessonSegment } from "@/lib/ai/schema";
import { checkAnswer } from "@/lib/learning/checker";
import { applyAll, emptyBoard, isDraw } from "@/lib/board/model";
import { layoutMainSegments } from "@/lib/board/layout";
import { ENGLISH, ENGLISH_SKILLS, englishSkill } from ".";
import { courseFlavourPrompt, courseLessonRequest, filterBoardOps } from "./prompt";
import type { CourseSkill } from "./types";

/** prerequisites-first order; throws on a cycle or an unknown prerequisite */
function topo(graph: CourseSkill[]): string[] {
  const by = new Map(graph.map((s) => [s.id, s]));
  const state = new Map<string, number>();
  const out: string[] = [];
  const visit = (id: string, path: string[]) => {
    if (state.get(id) === 2) return;
    if (state.get(id) === 1) throw new Error(`cycle: ${[...path, id].join(" → ")}`);
    const s = by.get(id);
    if (!s) throw new Error(`unknown prerequisite ${id} (from ${path.at(-1)})`);
    state.set(id, 1);
    for (const p of s.prereqs) visit(p, [...path, id]);
    state.set(id, 2);
    out.push(id);
  };
  for (const s of graph) visit(s.id, []);
  return out;
}

describe("English course config", () => {
  it("loads: 8–10 skills, unique en- ids, grades 5–9, Uzbek titles and sections", () => {
    expect(ENGLISH.id).toBe("ingliz");
    expect(ENGLISH_SKILLS.length).toBeGreaterThanOrEqual(8);
    expect(ENGLISH_SKILLS.length).toBeLessThanOrEqual(10);
    expect(new Set(ENGLISH_SKILLS.map((s) => s.id)).size).toBe(ENGLISH_SKILLS.length);
    for (const s of ENGLISH_SKILLS) {
      expect(s.id).toMatch(/^en-[a-z-]+$/);
      expect(s.grade).toBeGreaterThanOrEqual(5);
      expect(s.grade).toBeLessThanOrEqual(9);
      expect(s.title_uz.length).toBeGreaterThan(3);
      expect(s.section.length).toBeGreaterThan(2);
    }
    expect(englishSkill(ENGLISH.demo.skillId)?.title_uz).toBe("To be: am / is / are");
  });

  it("skill graph is a DAG with known prerequisites", () => {
    const order = topo(ENGLISH_SKILLS);
    expect(order).toHaveLength(ENGLISH_SKILLS.length);
    // every prerequisite comes before the skill that needs it
    for (const s of ENGLISH_SKILLS) for (const p of s.prereqs) expect(order.indexOf(p)).toBeLessThan(order.indexOf(s.id));
  });

  it("the cycle check really catches cycles", () => {
    expect(() => topo([{ id: "a", title_uz: "a", grade: 5, prereqs: ["b"], section: "x" }, { id: "b", title_uz: "b", grade: 5, prereqs: ["a"], section: "x" }])).toThrow(/cycle/);
    expect(() => topo([{ id: "a", title_uz: "a", grade: 5, prereqs: ["zz"], section: "x" }])).toThrow(/unknown/);
  });
});

describe("English prompt flavour", () => {
  const p = courseFlavourPrompt(ENGLISH);
  it("includes the subject, teacher, exactness rule, terms, board use and rules", () => {
    expect(p).toContain("Fan: Ingliz tili");
    expect(p).toContain(ENGLISH.flavour.teacher);
    expect(p).toContain(ENGLISH.flavour.exact);
    expect(p).toContain(ENGLISH.flavour.terms);
    expect(p).toContain(ENGLISH.flavour.board);
    for (const r of ENGLISH.flavour.rules) expect(p).toContain(r);
    expect(p).toContain("ingliz tiliga aloqasiz");
  });
  it("lists only the allowed board commands (no maths-only ones)", () => {
    expect(p).toContain(ENGLISH.boardOps.join(", "));
    for (const op of ["fractionbar", "numberline", "plot", "latex"]) expect(ENGLISH.boardOps).not.toContain(op);
    const kept = filterBoardOps(ENGLISH, [{ op: "write" }, { op: "fractionbar" }, { op: "plot" }, { op: "arrow" }]);
    expect(kept.map((c) => c.op)).toEqual(["write", "arrow"]);
  });
  it("lesson request names the course and the skill", () => {
    const r = courseLessonRequest(ENGLISH, englishSkill("en-present-simple")!, 6);
    expect(r).toContain("Ingliz tili");
    expect(r).toContain("Present Simple");
  });
});

describe("English demo lesson (en-to-be)", () => {
  const segs = ENGLISH.demo.segments;
  it("is valid against the LLM contract", () => {
    for (const s of segs) expect(LessonSegment.safeParse(s).success, s.id).toBe(true);
    expect(new Set(segs.map((s) => s.id)).size).toBe(segs.length);
  });
  it("uses only the course's board commands", () => {
    const ops = new Set<string>(ENGLISH.boardOps);
    for (const s of segs) for (const c of s.board) expect(ops.has(c.op), `${s.id}: ${c.op}`).toBe(true);
  });
  it("speech is TTS-ready: short, no symbols or digits", () => {
    for (const s of segs) {
      expect(s.say.length, s.id).toBeLessThan(160);
      expect(s.say, s.id).not.toMatch(/[0-9+=/%()*#:_]/);
    }
  });
  it("every ask is a choice whose answer is one of the choices and checks as correct", () => {
    const asks = segs.filter((s) => s.type === "ask");
    expect(asks.length).toBeGreaterThanOrEqual(2);
    for (const s of asks) {
      expect(s.expect?.kind).toBe("choice");
      expect(s.expect?.choices).toContain(s.expect?.answer);
      expect(checkAnswer(s.expect!, s.expect!.answer).correct).toBe(true);
      for (const wrong of s.expect!.choices!.filter((c) => c !== s.expect!.answer)) expect(checkAnswer(s.expect!, wrong).correct).toBe(false);
      // the next segment praises it
      expect(segs[segs.indexOf(s) + 1]?.type).toBe("praise");
    }
  });
  it("draws on the board and survives the server's auto-layout", () => {
    const final = applyAll(emptyBoard(), segs.flatMap((s) => s.board));
    expect(final.els.length).toBeGreaterThan(5);
    const laid = layoutMainSegments(segs);
    for (const s of laid)
      for (const c of s.board.filter(isDraw))
        if ("x" in c && "y" in c) {
          expect(c.x).toBeGreaterThanOrEqual(0);
          expect(c.y).toBeGreaterThanOrEqual(0);
          expect(c.x).toBeLessThanOrEqual(1000);
          expect(c.y).toBeLessThanOrEqual(625);
        }
  });
});
