import raw from "./skills.uz.json";
import fizikaRaw from "./skills.fizika.uz.json";

export interface Skill {
  id: string;
  title_uz: string;
  grade: number;
  prereqs: string[];
  section: string;
  /** subject id (src/config/subjects.ts); missing = "matematika" */
  subject?: string;
}

/** Maths skill graph: the diagnostic, roadmap, practice generators and mastery use these. */
export const SKILLS: Skill[] = raw as Skill[];
/** Fizika (grade 7) skill graph: lessons only (no diagnostic / generators yet). */
export const PHYSICS_SKILLS: Skill[] = fizikaRaw as Skill[];
/** skill graphs by subject id */
export const SKILL_GRAPHS: Record<string, Skill[]> = { matematika: SKILLS, fizika: PHYSICS_SKILLS };

export const SKILL_BY_ID: Record<string, Skill> = Object.fromEntries(SKILLS.map((s) => [s.id, s]));
const ANY_SKILL_BY_ID: Record<string, Skill> = Object.fromEntries([...SKILLS, ...PHYSICS_SKILLS].map((s) => [s.id, s]));
export const SECTIONS: string[] = [...new Set(SKILLS.map((s) => s.section))];

/** "Istalgan mavzu" (any topic, beta): the topic text is the skill id, after this prefix. */
export const TOPIC_PREFIX = "t:";
export const TOPIC_MAX = 80;

/** Obvious non-school / unsafe topics, refused before the LLM (the prompt has the full guardrail). */
const BLOCKED_TOPIC = /(?:^|[^\p{L}])(porn|sex|seks|18\+|narkot|giyoh|bomba|qurol yasash|portlovchi|o'z joniga|suicide|kazino|casino|stavka|qimor)/iu;

/** Trim + collapse spaces; null if it is not a usable topic (length, characters). */
export function cleanTopic(text: string): string | null {
  const s = text.replace(/\s+/g, " ").replace(/^[\s"'«»]+|[\s"'«»?.!]+$/g, "").trim();
  if (s.length < 3 || s.length > TOPIC_MAX) return null;
  if (!/^[\p{L}\p{N} ,.'ʻʼ’‘\-–—:;()?!+]+$/u.test(s)) return null;
  if (BLOCKED_TOPIC.test(s)) return null;
  return s;
}

export function topicSkillId(text: string): string | null {
  const s = cleanTopic(text);
  return s ? TOPIC_PREFIX + s : null;
}

export function isTopicSkill(id: string) {
  return id.startsWith(TOPIC_PREFIX);
}

export function getSkill(id: string): Skill | undefined {
  if (isTopicSkill(id)) {
    const title = cleanTopic(id.slice(TOPIC_PREFIX.length));
    return title ? { id: TOPIC_PREFIX + title, title_uz: title, grade: 7, prereqs: [], section: "Istalgan mavzu", subject: "any" } : undefined;
  }
  return ANY_SKILL_BY_ID[id];
}

/** Skills that list `id` as a prerequisite. */
export function dependents(id: string): Skill[] {
  return SKILLS.filter((s) => s.prereqs.includes(id));
}

/** All transitive prerequisites of a skill. */
export function allPrereqs(id: string, acc = new Set<string>()): Set<string> {
  for (const p of ANY_SKILL_BY_ID[id]?.prereqs ?? []) {
    if (!acc.has(p)) {
      acc.add(p);
      allPrereqs(p, acc);
    }
  }
  return acc;
}

/** Topological order of a skill graph (prerequisites first); throws on a cycle or a missing prereq. */
export function topoOrder(graph: Skill[]): Skill[] {
  const byId = new Map(graph.map((s) => [s.id, s]));
  const state = new Map<string, 1 | 2>();
  const out: Skill[] = [];
  const visit = (s: Skill, path: string[]) => {
    if (state.get(s.id) === 2) return;
    if (state.get(s.id) === 1) throw new Error(`cycle: ${[...path, s.id].join(" → ")}`);
    state.set(s.id, 1);
    for (const p of s.prereqs) {
      const ps = byId.get(p);
      if (!ps) throw new Error(`${s.id}: unknown prereq ${p}`);
      visit(ps, [...path, s.id]);
    }
    state.set(s.id, 2);
    out.push(s);
  };
  for (const s of graph) visit(s, []);
  return out;
}
