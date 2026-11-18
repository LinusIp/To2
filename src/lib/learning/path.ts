// Personalized learning path + mind map — subject-agnostic (CLAUDE.md §7).
// The subject is an INPUT (a Curriculum): math today, Fizika/Kimyo/... plug in with their own skill graph.
// Pure functions; same rules as roadmap.ts (which stays the math-only engine used by the API).
import type { Skill } from "@/data/skills";
import { INFERRED_PREREQ, MASTERED, P_START } from "./mastery";

export interface Curriculum {
  id: string;
  title: string;
  skills: Skill[];
}

export type StepStatus = "mastered" | "current" | "next" | "locked" | "optional";

/** Why a skill is on the learner's path. */
export type StepReason = { kind: "weak" } | { kind: "prereq"; of: string };

export interface PathStep {
  id: string;
  title: string;
  section: string;
  grade: number;
  p: number;
  status: StepStatus;
  /** 1-based order on the path */
  order: number;
  reason: StepReason;
  /** locked steps: the unmastered prerequisite to finish first */
  lockedBy: string | null;
}

export interface PersonalPath {
  subject: string;
  steps: PathStep[];
  /** ordered skill ids */
  order: string[];
  currentId: string | null;
  weakCount: number;
}

export type MasteryMap = Record<string, number>;

export interface PathOptions {
  /** skills the learner was actually measured on (default: keys of the mastery map) */
  touched?: string[];
  /** lessons the learner opened before (never lock again) */
  started?: string[];
}

export interface GraphIssue {
  kind: "missing-prereq" | "cycle" | "duplicate-id" | "self-prereq";
  id: string;
  detail?: string;
}

/** Check a curriculum's skill graph: unique ids, prereqs exist, no self-loops, no cycles. */
export function validateGraph(skills: Skill[]): GraphIssue[] {
  const issues: GraphIssue[] = [];
  const ids = new Set<string>();
  for (const s of skills) {
    if (ids.has(s.id)) issues.push({ kind: "duplicate-id", id: s.id });
    ids.add(s.id);
  }
  for (const s of skills) {
    for (const p of s.prereqs) {
      if (p === s.id) issues.push({ kind: "self-prereq", id: s.id });
      else if (!ids.has(p)) issues.push({ kind: "missing-prereq", id: s.id, detail: p });
    }
  }
  // DFS colouring for cycles
  const by = new Map(skills.map((s) => [s.id, s]));
  const state = new Map<string, 1 | 2>(); // 1 = on stack, 2 = done
  const visit = (id: string, trail: string[]) => {
    const st = state.get(id);
    if (st === 2) return;
    if (st === 1) {
      issues.push({ kind: "cycle", id, detail: [...trail.slice(trail.indexOf(id)), id].join(" → ") });
      return;
    }
    state.set(id, 1);
    for (const p of by.get(id)?.prereqs ?? []) if (p !== id && by.has(p)) visit(p, [...trail, id]);
    state.set(id, 2);
  };
  for (const s of skills) visit(s.id, []);
  return issues;
}

function index(c: Curriculum) {
  const byId: Record<string, Skill> = Object.fromEntries(c.skills.map((s) => [s.id, s]));
  return byId;
}

/**
 * 1. targets = skills measured weak (p < 0.5) at or below the learner's grade; none → the grade's unmastered skills (max 4)
 * 2. close over unmastered prerequisites (unmeasured skills below the grade count as known)
 * 3. Kahn topological order; among ready skills: lowest mastery, then most-blocking, then lowest grade
 */
export function buildPath(curriculum: Curriculum, mastery: MasteryMap, grade: number, opts: PathOptions = {}): PersonalPath {
  const skills = curriculum.skills;
  const byId = index(curriculum);
  const pOf = (id: string) => mastery[id] ?? P_START;
  const touched = new Set(opts.touched ?? Object.keys(mastery));
  const started = new Set(opts.started ?? []);
  const isMastered = (id: string) => pOf(id) >= MASTERED;
  const needs = (id: string) => (id in mastery ? mastery[id] < INFERRED_PREREQ : (byId[id]?.grade ?? 0) >= grade);
  const maxGrade = skills.reduce((m, s) => Math.max(m, s.grade), 0);

  let targets = skills.filter((s) => s.grade <= grade && touched.has(s.id) && pOf(s.id) < 0.5).map((s) => s.id);
  if (targets.length === 0) {
    const g = Math.min(grade, maxGrade);
    targets = skills.filter((s) => s.grade === g && !isMastered(s.id)).map((s) => s.id).slice(0, 4);
  }
  const weak = new Set(targets);

  // reason: first dependent that pulled the prereq in
  const reasonOf = new Map<string, StepReason>();
  const onPath = new Set<string>();
  const visit = (id: string, from: string) => {
    if (onPath.has(id) || !needs(id)) return;
    onPath.add(id);
    if (!reasonOf.has(id)) reasonOf.set(id, { kind: "prereq", of: from });
    for (const p of byId[id]?.prereqs ?? []) visit(p, id);
  };
  for (const t of targets) {
    onPath.add(t);
    reasonOf.set(t, { kind: "weak" });
  }
  for (const t of targets) for (const p of byId[t]?.prereqs ?? []) visit(p, t);

  const blocking = (id: string) => skills.filter((s) => onPath.has(s.id) && s.prereqs.includes(id)).length;

  const remaining = new Set(onPath);
  const order: string[] = [];
  while (remaining.size) {
    const ready = [...remaining].filter((id) => (byId[id]?.prereqs ?? []).every((p) => !remaining.has(p)));
    if (!ready.length) {
      order.push(...remaining); // cycle guard — validateGraph reports it
      break;
    }
    ready.sort((a, b) => pOf(a) - pOf(b) || blocking(b) - blocking(a) || byId[a].grade - byId[b].grade);
    order.push(ready[0]);
    remaining.delete(ready[0]);
  }

  const currentId = order[0] ?? null;
  const pos = new Map(order.map((id, i) => [id, i + 1]));
  const available = (s: Skill) => s.prereqs.every((p) => !onPath.has(p) || isMastered(p));
  const blocker = (s: Skill): string | null => {
    const open = s.prereqs.filter((p) => (onPath.has(p) ? !isMastered(p) : needs(p)));
    open.sort((a, b) => (pos.get(a) ?? 999) - (pos.get(b) ?? 999));
    return open[0] ?? null;
  };

  const steps: PathStep[] = order.map((id) => {
    const s = byId[id];
    let status: StepStatus;
    if (isMastered(id)) status = "mastered";
    else if (id === currentId) status = "current";
    else status = available(s) ? "next" : "locked";
    if (status === "locked" && started.has(id)) status = "next";
    return {
      id,
      title: s.title_uz,
      section: s.section,
      grade: s.grade,
      p: pOf(id),
      status,
      order: pos.get(id)!,
      reason: reasonOf.get(id) ?? { kind: "weak" },
      lockedBy: status === "locked" ? blocker(s) : null,
    };
  });

  return { subject: curriculum.id, steps, order, currentId, weakCount: targets.filter((t) => !isMastered(t)).length };
}

// ── Mind map ────────────────────────────────────────────────────────────────

export interface MindLeaf {
  id: string;
  title: string;
  grade: number;
  p: number;
  status: StepStatus;
  onPath: boolean;
  /** 0 = not on the path */
  order: number;
  weak: boolean;
}

export interface MindBranch {
  section: string;
  mastered: number;
  total: number;
  /** branch has at least one skill on the personal path */
  active: boolean;
  leaves: MindLeaf[];
}

export interface MindMap {
  subject: string;
  title: string;
  mastered: number;
  total: number;
  branches: MindBranch[];
}

/**
 * Centre (subject) → branches (sections, in curriculum order) → leaves (skills).
 * Skills not on the path get status mastered / optional (all prereqs known) / locked.
 * `maxGrade` hides skills far above the learner (default: all).
 */
export function buildMindMap(curriculum: Curriculum, mastery: MasteryMap, path: PersonalPath, opts: { grade?: number; maxGrade?: number } = {}): MindMap {
  const pOf = (id: string) => mastery[id] ?? P_START;
  const grade = opts.grade ?? 99;
  const byStep = new Map(path.steps.map((s) => [s.id, s]));
  const byId = index(curriculum);
  const needs = (id: string) => (id in mastery ? mastery[id] < INFERRED_PREREQ : (byId[id]?.grade ?? 0) >= grade);

  const sections: string[] = [];
  const leavesBy = new Map<string, MindLeaf[]>();
  for (const s of curriculum.skills) {
    if (opts.maxGrade != null && s.grade > opts.maxGrade) continue;
    if (!leavesBy.has(s.section)) {
      sections.push(s.section);
      leavesBy.set(s.section, []);
    }
    const st = byStep.get(s.id);
    let status: StepStatus;
    if (st) status = st.status;
    else if (pOf(s.id) >= MASTERED) status = "mastered";
    else status = s.prereqs.every((p) => !needs(p)) ? "optional" : "locked";
    leavesBy.get(s.section)!.push({
      id: s.id,
      title: s.title_uz,
      grade: s.grade,
      p: pOf(s.id),
      status,
      onPath: !!st,
      order: st?.order ?? 0,
      weak: st?.reason.kind === "weak",
    });
  }
  const branches: MindBranch[] = sections.map((section) => {
    const leaves = leavesBy.get(section)!;
    return {
      section,
      leaves,
      total: leaves.length,
      mastered: leaves.filter((l) => l.status === "mastered").length,
      active: leaves.some((l) => l.onPath),
    };
  });
  return {
    subject: curriculum.id,
    title: curriculum.title,
    branches,
    total: branches.reduce((n, b) => n + b.total, 0),
    mastered: branches.reduce((n, b) => n + b.mastered, 0),
  };
}
