// Personal roadmap generation (CLAUDE.md §7). Pure functions.
import { SKILLS, SKILL_BY_ID, type Skill } from "@/data/skills";
import { INFERRED_PREREQ, MASTERED, P_START } from "./mastery";

export type NodeStatus = "mastered" | "current" | "next" | "locked" | "optional";

export interface RoadmapNode {
  id: string;
  title: string;
  section: string;
  grade: number;
  status: NodeStatus;
  p: number;
  /** on the learner's personal path (weak target or its unmastered prereq) */
  onPath: boolean;
  /** one of the diagnosed weak targets */
  weak: boolean;
  /** order on the path (1-based), 0 = not on path */
  order: number;
  prereqs: string[];
}

export interface Roadmap {
  nodes: RoadmapNode[];
  path: string[]; // ordered skill ids to learn
  currentId: string | null;
  weakCount: number;
}

export type MasteryMap = Record<string, number>;

const pOf = (m: MasteryMap, id: string) => m[id] ?? P_START;

/**
 * 1. targets = weak skills at the learner's grade (and below, if diagnosed)
 * 2. add all transitive unmastered prereqs
 * 3. topological order; among available skills prefer lowest mastery and most-blocking
 */
export function buildRoadmap(mastery: MasteryMap, grade: number, opts: { touched?: string[] } = {}): Roadmap {
  const touched = new Set(opts.touched ?? Object.keys(mastery));
  const isMastered = (id: string) => pOf(mastery, id) >= MASTERED;
  // Does the learner still need to learn this skill? Unmeasured skills BELOW the learner's
  // grade are assumed known (otherwise every grade-6 roadmap would start at grade-5 basics).
  const needs = (id: string) => {
    if (id in mastery) return mastery[id] < INFERRED_PREREQ;
    return (SKILL_BY_ID[id]?.grade ?? 0) >= grade;
  };

  // Targets: skills that were measured weak (p < 0.5) at or below grade, else the grade's unmastered skills.
  let targets = SKILLS.filter((s) => s.grade <= grade && touched.has(s.id) && pOf(mastery, s.id) < 0.5).map((s) => s.id);
  if (targets.length === 0) {
    targets = SKILLS.filter((s) => s.grade === Math.min(grade, 8) && !isMastered(s.id)).map((s) => s.id).slice(0, 4);
  }
  const weak = new Set(targets);

  // Close over unmastered prereqs.
  const onPath = new Set<string>();
  const visit = (id: string) => {
    if (onPath.has(id) || !needs(id)) return;
    onPath.add(id);
    for (const p of SKILL_BY_ID[id]?.prereqs ?? []) visit(p);
  };
  targets.forEach((t) => {
    onPath.add(t); // a target is always on the path, even if a prereq check says otherwise
    for (const p of SKILL_BY_ID[t]?.prereqs ?? []) visit(p);
  });

  // How many path skills each skill (transitively) unblocks.
  const blocking = (id: string): number => SKILLS.filter((s) => onPath.has(s.id) && s.prereqs.includes(id)).length;

  // Kahn's algorithm restricted to the path.
  const remaining = new Set(onPath);
  const path: string[] = [];
  while (remaining.size) {
    const ready = [...remaining].filter((id) => (SKILL_BY_ID[id]?.prereqs ?? []).every((p) => !remaining.has(p)));
    if (!ready.length) {
      path.push(...remaining); // cycle guard (should not happen in a DAG)
      break;
    }
    ready.sort((a, b) => pOf(mastery, a) - pOf(mastery, b) || blocking(b) - blocking(a) || SKILL_BY_ID[a].grade - SKILL_BY_ID[b].grade);
    const nxt = ready[0];
    path.push(nxt);
    remaining.delete(nxt);
  }

  const currentId = path[0] ?? null;
  const order = new Map(path.map((id, i) => [id, i + 1]));
  const available = (s: Skill) => s.prereqs.every((p) => !onPath.has(p) || isMastered(p));

  const nodes: RoadmapNode[] = SKILLS.filter((s) => s.grade <= Math.max(grade, 6) + 1).map((s) => {
    let status: NodeStatus;
    if (isMastered(s.id)) status = "mastered";
    else if (s.id === currentId) status = "current";
    else if (onPath.has(s.id)) status = available(s) ? "next" : "locked";
    else status = s.prereqs.every((p) => !needs(p)) ? "optional" : "locked";
    return {
      id: s.id,
      title: s.title_uz,
      section: s.section,
      grade: s.grade,
      status,
      p: pOf(mastery, s.id),
      onPath: onPath.has(s.id),
      weak: weak.has(s.id),
      order: order.get(s.id) ?? 0,
      prereqs: s.prereqs,
    };
  });

  return { nodes, path, currentId, weakCount: targets.filter((t) => !isMastered(t)).length };
}
