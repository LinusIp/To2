// Canned lessons for any skill (fallback when the LLM fails, or mock mode without a demo lesson).
// Built from the problem generators, so answers are always correct.
import { generateProblem, seeded } from "@/data/problems";
import type { Skill } from "@/data/skills";
import type { LessonSegment } from "./schema";

export function cannedLesson(skill: Skill, seed = 7): LessonSegment[] {
  const r = seeded(seed);
  const p1 = generateProblem(skill.id, r);
  const p2 = generateProblem(skill.id, r);
  const short = (s: string) => (s.length > 34 ? s.slice(0, 33) + "…" : s);
  return [
    {
      id: "c1",
      type: "explain",
      emotion: "happy",
      say: `Salom! Bugun "${skill.title_uz}" mavzusini o'rganamiz.`,
      board: [
        { op: "write", id: "title", x: 50, y: 40, text: skill.title_uz.slice(0, 40), size: "m", color: "yellow" },
        { op: "line", id: "ul", from: [50, 100], to: [Math.min(950, 50 + skill.title_uz.length * 22), 100], color: "yellow" },
      ],
    },
    {
      id: "c2",
      type: "explain",
      emotion: "thinking",
      say: `Avval qoidani eslaymiz: ${p1.hint}`,
      board: [{ op: "write", id: "rule", x: 50, y: 150, text: short(p1.hint), size: "s" }],
    },
    {
      id: "c3",
      type: "ask",
      emotion: "encouraging",
      say: p1.q.length < 160 ? p1.q : "Doskadagi misolni yech.",
      board: [{ op: "write", id: "q1", x: 50, y: 250, text: short(p1.q), size: "s", color: "blue" }],
      expect: p1.expect,
    },
    { id: "c4", type: "praise", emotion: "excited", say: "Barakalla! Yana bittasini yechamiz.", board: [{ op: "write", id: "a1", x: 50, y: 300, text: `= ${p1.expect.answer}`, size: "s", color: "green" }] },
    {
      id: "c5",
      type: "ask",
      emotion: "encouraging",
      say: p2.q.length < 160 ? p2.q : "Endi bu misolni yech.",
      board: [{ op: "write", id: "q2", x: 50, y: 380, text: short(p2.q), size: "s", color: "blue" }],
      expect: p2.expect,
    },
    { id: "c6", type: "praise", emotion: "excited", say: "Zo'r! Bu mavzuni mashqda mustahkamlaymiz.", board: [{ op: "write", id: "a2", x: 50, y: 430, text: `= ${p2.expect.answer}`, size: "s", color: "green" }] },
  ];
}
