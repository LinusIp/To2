// Adaptive diagnostic (CLAUDE.md §7): start mid-grade, walk DOWN the prereq graph
// on wrong answers and UP on right ones. Pure functions — the API keeps the history.
import { SKILLS, SKILL_BY_ID, allPrereqs, dependents } from "@/data/skills";
import { INFERRED_PREREQ, P_START, clamp } from "./mastery";

export const DIAG_LENGTH = 8;
const MAX_PER_CHAIN = 3;

export interface DiagAnswer {
  skillId: string;
  correct: boolean;
}

/**
 * Anchor skills per grade — one "mid-grade" probe per section, in the order we visit them.
 * Grade 6 starts with adding unlike fractions (the demo script relies on this).
 */
const ANCHORS: Record<number, string[]> = {
  5: ["frac-add-like", "nat-order-ops", "dec-add-sub", "geo-area-rect", "pct-intro", "div-rules"],
  6: ["frac-add-unlike", "eq-one-step", "pct-of-number", "int-add-sub", "geo-area-triangle", "coord-plane"],
  7: ["eq-two-step", "frac-add-unlike", "expr-like-terms", "int-mul-div", "lin-func", "pct-of-number"],
  8: ["eq-both-sides", "lin-graph", "expr-distribute", "frac-div", "geo-pythagoras", "pct-find-whole"],
  9: ["eq-system", "quad-func", "eq-word", "expr-distribute", "geo-pythagoras", "frac-div"],
};

export function anchorsFor(grade: number): string[] {
  return ANCHORS[Math.min(9, Math.max(5, grade))];
}

/** Split history into chains: each chain starts at an anchor. */
function chains(grade: number, history: DiagAnswer[]): DiagAnswer[][] {
  const anchors = new Set(anchorsFor(grade));
  const out: DiagAnswer[][] = [];
  for (const h of history) {
    if (anchors.has(h.skillId) || out.length === 0) out.push([h]);
    else out[out.length - 1].push(h);
  }
  return out;
}

/** Which skill to ask next, or null when the diagnostic is finished. */
export function nextSkill(grade: number, history: DiagAnswer[]): string | null {
  if (history.length >= DIAG_LENGTH) return null;
  const asked = new Set(history.map((h) => h.skillId));
  const anchors = anchorsFor(grade);
  const nextAnchor = () => anchors.find((a) => !asked.has(a)) ?? SKILLS.find((s) => s.grade === grade && !asked.has(s.id))?.id ?? null;

  if (history.length === 0) return anchors[0];

  const cs = chains(grade, history);
  const chain = cs[cs.length - 1];
  const last = chain[chain.length - 1];
  if (chain.length >= MAX_PER_CHAIN) return nextAnchor();

  const skill = SKILL_BY_ID[last.skillId];
  // After a miss on the chain's first skill, probe each of ITS prerequisites
  // (so we know which foundation is actually missing).
  const head = chain[0];
  if (!head.correct && last !== head && last.correct) {
    const sibling = (SKILL_BY_ID[head.skillId]?.prereqs ?? [])
      .filter((p) => !asked.has(p))
      .sort((a, b) => SKILL_BY_ID[b].grade - SKILL_BY_ID[a].grade);
    return sibling[0] ?? nextAnchor();
  }
  if (!last.correct) {
    // DOWN: closest (highest-grade) unasked prerequisite
    const down = (skill?.prereqs ?? [])
      .filter((p) => !asked.has(p))
      .sort((a, b) => SKILL_BY_ID[b].grade - SKILL_BY_ID[a].grade);
    return down[0] ?? nextAnchor();
  }
  // UP: an unasked dependent within reach of the learner's grade; only climb if the chain started correct
  const up = dependents(last.skillId)
    .filter((d) => !asked.has(d.id) && d.grade <= grade + 1)
    .sort((a, b) => a.grade - b.grade);
  // After going down and getting it right, move on rather than climbing back.
  const wentDown = chain.some((c) => !c.correct);
  if (wentDown || !up.length) return nextAnchor();
  return up[0].id;
}

/**
 * Initial mastery from the diagnostic:
 * correct → 0.86 (mastered), wrong → 0.2, prereqs of a correct skill ≥ 0.7,
 * unasked dependents of a wrong skill stay at the start value.
 */
export function diagnosticMastery(history: DiagAnswer[]): Record<string, number> {
  const m: Record<string, number> = {};
  for (const h of history) {
    if (h.correct) {
      m[h.skillId] = Math.max(m[h.skillId] ?? 0, 0.86);
      for (const p of allPrereqs(h.skillId)) m[p] = Math.max(m[p] ?? P_START, INFERRED_PREREQ);
    }
  }
  // wrong answers win over inference
  for (const h of history) if (!h.correct) m[h.skillId] = 0.2;
  for (const k of Object.keys(m)) m[k] = clamp(m[k]);
  return m;
}
