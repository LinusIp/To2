import { describe, expect, it } from "vitest";
import { DEFAULT_SUBJECT, SUBJECTS, getSubject, subjectOfSkill, subjectSkills } from "./subjects";
import { PHYSICS_SKILLS, SKILLS, cleanTopic, getSkill, isTopicSkill, topicSkillId, topoOrder } from "@/data/skills";
import { TOPIC_REFUSAL, boardSpec, interruptMessages, lessonMessages } from "@/lib/ai/prompts/tutor.uz";
import { getCharacter } from "./characters";
import { DEMO_LESSONS, demoLessonFor } from "@/lib/ai/mock/lessons";
import { LessonSegment } from "@/lib/ai/schema";
import { checkAnswer } from "@/lib/learning/checker";
import { cannedLesson } from "@/lib/ai/canned";

const ch = getCharacter("blokbek");

describe("subjects config", () => {
  it("loads: unique ids, matematika is the default, live subjects have a graph + flavour", () => {
    expect(new Set(SUBJECTS.map((s) => s.id)).size).toBe(SUBJECTS.length);
    expect(DEFAULT_SUBJECT).toBe("matematika");
    expect(getSubject(undefined).id).toBe("matematika");
    expect(getSubject("nope").id).toBe("matematika");
    for (const s of SUBJECTS.filter((x) => x.status === "live")) {
      expect(s.flavour.length, s.id).toBeGreaterThan(20);
      expect(s.href, s.id).toBeTruthy();
      expect(s.graphFile, s.id).toMatch(/^src\/data\/.+\.json$/);
      expect(subjectSkills(s.id).length, s.id).toBeGreaterThan(0);
      expect(s.boardOps).toContain("write");
    }
    expect(subjectSkills("matematika")).toBe(SKILLS);
    expect(SUBJECTS.find((s) => s.id === "any")?.status).toBe("beta");
    // the other subjects are honestly "Tez orada": no graph, no link
    for (const s of SUBJECTS.filter((x) => x.status === "soon")) {
      expect(s.href).toBeUndefined();
      expect(subjectSkills(s.id)).toEqual([]);
    }
  });

  it("maps skills to subjects (missing subject = matematika)", () => {
    expect(subjectOfSkill(getSkill("frac-add-unlike")!).id).toBe("matematika");
    expect(subjectOfSkill(getSkill("fiz-tezlik")!).id).toBe("fizika");
    expect(subjectOfSkill(getSkill("t:Fotosintez")!).id).toBe("any");
    // the maths graph (diagnostic, roadmap) has no physics skills in it
    expect(SKILLS.some((s) => s.id.startsWith("fiz-"))).toBe(false);
  });
});

describe("physics skill graph", () => {
  it("has 8–10 grade-7 skills with the core topics", () => {
    expect(PHYSICS_SKILLS.length).toBeGreaterThanOrEqual(8);
    expect(PHYSICS_SKILLS.length).toBeLessThanOrEqual(10);
    const titles = PHYSICS_SKILLS.map((s) => s.title_uz.toLowerCase()).join(" ");
    for (const w of ["tezlik", "masofa", "vaqt", "kuch", "massa", "zichlik", "bosim", "ish", "quvvat"]) expect(titles).toContain(w);
    for (const s of PHYSICS_SKILLS) {
      expect(s.grade).toBe(7);
      expect(s.subject).toBe("fizika");
    }
  });

  it("is a DAG: prereqs exist, no cycles, unique ids", () => {
    expect(new Set(PHYSICS_SKILLS.map((s) => s.id)).size).toBe(PHYSICS_SKILLS.length);
    const order = topoOrder(PHYSICS_SKILLS).map((s) => s.id);
    expect(order).toHaveLength(PHYSICS_SKILLS.length);
    for (const s of PHYSICS_SKILLS) for (const p of s.prereqs) expect(order.indexOf(p)).toBeLessThan(order.indexOf(s.id));
    expect(getSkill("fiz-tezlik")?.prereqs).toContain("fiz-masofa-vaqt");
  });

  it("topoOrder catches a cycle and a missing prereq", () => {
    const a = { id: "a", title_uz: "A", grade: 7, section: "x", prereqs: ["b"] };
    const b = { id: "b", title_uz: "B", grade: 7, section: "x", prereqs: ["a"] };
    expect(() => topoOrder([a, b])).toThrow(/cycle/);
    expect(() => topoOrder([{ ...a, prereqs: ["zzz"] }])).toThrow(/unknown prereq/);
  });

  it("the pinned 'Tezlik' lesson is valid, has diagram + formula + units + worked examples, answers check", () => {
    const l = demoLessonFor("fiz-tezlik");
    expect(l?.skillId).toBe("fiz-tezlik");
    const segs = l!.segments;
    for (const s of segs) expect(LessonSegment.safeParse(s).success, s.id).toBe(true);
    const ops = segs.flatMap((s) => s.board);
    expect(ops.some((c) => c.op === "rect")).toBe(true); // the car
    expect(ops.some((c) => c.op === "line" && "arrow" in c && c.arrow)).toBe(true); // motion arrow
    expect(JSON.stringify(ops)).toContain("\\frac{s}{t}");
    expect(JSON.stringify(ops)).toContain("km/soat");
    const asks = segs.filter((s) => s.type === "ask");
    expect(asks.map((s) => s.expect?.answer)).toEqual(["60", "15"]);
    expect(checkAnswer(asks[0].expect!, "60").correct).toBe(true);
    expect(checkAnswer(asks[1].expect!, "15").correct).toBe(true);
    // TTS: no symbols in what is spoken
    for (const s of segs) expect(s.say, s.id).not.toMatch(/[+=/%()*#:]/);
    expect(DEMO_LESSONS["fiz-tezlik"]).toBeDefined();
  });

  it("non-maths canned fallback never uses the maths generators", () => {
    const c = cannedLesson(getSkill("fiz-bosim")!);
    expect(c).toHaveLength(1);
    expect(c[0].say).toContain("Bosim");
  });
});

describe("prompt includes the subject flavour", () => {
  const msgs = (id: string) => lessonMessages({ ch, skill: getSkill(id)!, grade: 7, mastery: 0.3, mistakes: [] });

  it("fizika: role, flavour, physics example, no maths-only board ops", () => {
    const sys = msgs("fiz-bosim")[0].content;
    const fiz = getSubject("fizika");
    expect(sys).toContain(fiz.flavour);
    expect(sys).toContain("fizika ustozi");
    expect(sys).toContain("Namuna (Fizika — Tezlik)");
    expect(sys).not.toContain('"op":"fractionbar"');
    expect(sys).not.toContain("Kasrlarni qo'shish");
    expect(msgs("fiz-bosim")[1].content).toContain("Fan: Fizika");
  });

  it("matematika stays as before (fractions example, all board ops)", () => {
    const sys = msgs("frac-add-unlike")[0].content;
    expect(sys).toContain("matematika ustozi");
    expect(sys).toContain(getSubject("matematika").flavour);
    expect(sys).toContain('"op":"fractionbar"');
    expect(sys).toContain("Namuna (Kasrlarni qo'shish)");
  });

  it("istalgan mavzu: guardrails, short lesson, refusal line, the topic", () => {
    const m = msgs("t:Amir Temur");
    expect(m[0].content).toContain(getSubject("any").flavour);
    expect(m[0].content).toContain("CHEGARALAR");
    expect(m[0].content).toContain(TOPIC_REFUSAL);
    expect(m[0].content).toContain("5–6 segment");
    expect(m[0].content).not.toContain('"op":"plot"');
    expect(m[1].content).toContain('"Amir Temur"');
  });

  it("interrupt prompt is subject-aware too", () => {
    const m = interruptMessages({ ch, skill: getSkill("fiz-tezlik")!, grade: 7, question: "Nega bo'lamiz?", segment: "", board: [], history: [], simpler: false });
    expect(m[0].content).toContain(getSubject("fizika").flavour);
    expect(m[0].content).toContain("fizikaga aloqasiz");
  });

  it("boardSpec offers only the subject's ops", () => {
    const spec = boardSpec(getSubject("any"));
    expect(spec).toContain('"op":"write"');
    expect(spec).not.toContain('"op":"numberline"');
  });
});

describe("istalgan mavzu ids", () => {
  it("cleans and guards topics", () => {
    expect(topicSkillId("  Fotosintez?  ")).toBe("t:Fotosintez");
    expect(isTopicSkill("t:Fotosintez")).toBe(true);
    expect(getSkill("t:Present Simple")?.title_uz).toBe("Present Simple");
    expect(cleanTopic("ab")).toBeNull();
    expect(cleanTopic("x".repeat(81))).toBeNull();
    expect(cleanTopic("<script>")).toBeNull();
    expect(cleanTopic("bomba yasash")).toBeNull();
    expect(cleanTopic("Amir Temur davlati")).toBe("Amir Temur davlati");
    expect(cleanTopic("O'zbekiston daryolari")).toBe("O'zbekiston daryolari");
  });
});

describe("physics question bank (games shape)", async () => {
  const { PHYSICS_QUESTIONS, PHYSICS_BANK } = await import("@/data/questions.fizika");
  it("every physics skill has ≥ 3 questions; answer ∈ choices; unique choices and ids", () => {
    expect(new Set(PHYSICS_QUESTIONS.map((q) => q.id)).size).toBe(PHYSICS_QUESTIONS.length);
    for (const s of PHYSICS_SKILLS) expect(PHYSICS_QUESTIONS.filter((q) => q.skillId === s.id).length, s.id).toBeGreaterThanOrEqual(3);
    for (const q of PHYSICS_QUESTIONS) {
      expect(getSkill(q.skillId)?.subject, q.id).toBe("fizika");
      expect(q.choices).toContain(q.answer);
      expect(new Set(q.choices).size, q.id).toBe(q.choices.length);
      expect(q.choices.length).toBeGreaterThanOrEqual(3);
    }
  });
  it("the Bank generators give a checkable choice question (right answer accepted, a wrong one not)", () => {
    let seed = 7;
    const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (const [skillId, gens] of Object.entries(PHYSICS_BANK)) {
      expect(gens.length, skillId).toBeGreaterThanOrEqual(3);
      for (const g of gens) {
        const p = g(r);
        expect(p.expect.choices).toContain(p.expect.answer);
        expect(checkAnswer(p.expect, p.expect.answer).correct).toBe(true);
        const wrong = p.expect.choices!.find((c) => c !== p.expect.answer)!;
        expect(checkAnswer(p.expect, wrong).correct, `${skillId}: ${wrong}`).toBe(false);
      }
    }
  });
});
