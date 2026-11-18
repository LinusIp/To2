// "Course towns" (core loop): each course is a voxel town, each building on the route is a quest.
// Pure functions: map the learner's personal path (path.ts) onto the town's buildings, in route order.
import type { PersonalPath, PathStep } from "./path";

export type QuestKind = "school" | "arena" | "library" | "workshop" | "temple";
export const QUEST_KINDS: QuestKind[] = ["school", "arena", "library", "workshop", "temple"];

export interface TownQuestDef {
  i: number;
  kind: QuestKind;
  /** pin position, 0..1 of the image */
  marker: [number, number];
  /** point on the route where the building sits (unused by the UI for now) */
  path?: [number, number];
}

export interface TownData {
  course: string;
  image: string;
  quests: TownQuestDef[];
  route: [number, number][];
}

export type QuestStatus = "done" | "current" | "locked";

export interface TownQuest extends TownQuestDef {
  /** 1-based number in route order */
  n: number;
  skillId: string | null;
  topic: string;
  weak: boolean;
  status: QuestStatus;
  href: string | null;
}

/** Validate a town JSON (from public/ui/town-<course>.json); throws a readable error. */
export function parseTown(raw: unknown): TownData {
  const t = raw as Partial<TownData>;
  if (!t || typeof t.course !== "string" || typeof t.image !== "string" || !Array.isArray(t.quests) || !Array.isArray(t.route)) throw new Error("town: bad shape");
  const inUnit = (p: unknown): p is [number, number] => Array.isArray(p) && p.length === 2 && p.every((v) => typeof v === "number" && v >= 0 && v <= 1);
  const quests = [...t.quests]
    .map((q) => {
      if (!QUEST_KINDS.includes(q.kind)) throw new Error(`town: unknown quest kind ${q.kind}`);
      if (!inUnit(q.marker)) throw new Error(`town: quest ${q.i} marker must be [0..1, 0..1]`);
      return { i: Number(q.i), kind: q.kind, marker: q.marker, path: inUnit(q.path) ? q.path : undefined };
    })
    .sort((a, b) => a.i - b.i);
  return { course: t.course, image: t.image, quests, route: t.route.filter(inUnit) };
}

/** Arena games of the games module (feat/games: src/lib/games/quest.ts, ARENA_GAMES). */
export const ARENA_GAMES = ["tower", "speed", "memory"] as const;

/** Stable pick of an arena game per building (same pin → same game; varies across buildings). */
export function arenaGame(skillId: string, n: number): (typeof ARENA_GAMES)[number] {
  let h = n;
  for (const ch of skillId) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return ARENA_GAMES[h % ARENA_GAMES.length];
}

/**
 * Where a quest of this kind opens, for this skill.
 * arena / workshop use the games module's URLs (same as its questHref: /games/<game>?skill=…, /games/mission?skill=…);
 * `questFallback` is the practice stand-in used when /games isn't deployed.
 */
export function questHref(kind: QuestKind, skillId: string, course: string, n: number, opts: { practiceOnly?: boolean } = {}): string {
  const q = `town=${encodeURIComponent(course)}&q=${n}`;
  const sk = encodeURIComponent(skillId);
  // courses whose lessons merge later: school / library / temple → practice (games stay games)
  if (opts.practiceOnly && kind !== "arena" && kind !== "workshop") return `/practice/${sk}?${kind === "temple" ? "final=1&" : ""}${q}`;
  switch (kind) {
    case "school":
      return `/lesson/${sk}?${q}`;
    case "library":
      return `/practice/${sk}?${q}`;
    case "arena":
      return `/games/${arenaGame(skillId, n)}?skill=${sk}&${q}`;
    case "workshop":
      return `/games/mission?skill=${sk}&${q}`;
    case "temple":
      return `/practice/${sk}?final=1&${q}`;
  }
}

export function questFallback(kind: QuestKind, skillId: string, course: string, n: number): string | null {
  if (kind !== "arena" && kind !== "workshop") return null;
  return `/practice/${encodeURIComponent(skillId)}?mode=${kind === "arena" ? "arena" : "career"}&town=${encodeURIComponent(course)}&q=${n}`;
}

/** Inclusive voice commands for the town screen (window event "to2:voice", detail {command}). */
export type TownVoice = "next" | "prev" | "open" | "back";
export function townVoiceCommand(raw: unknown): TownVoice | null {
  const c = typeof raw === "string" ? raw : (raw as { command?: unknown; type?: unknown } | null)?.command ?? (raw as { type?: unknown } | null)?.type;
  switch (c) {
    case "next":
    case "keyingi":
      return "next";
    case "prev":
    case "previous":
    case "oldingi":
      return "prev";
    case "open":
    case "continue": // feat/inclusive VoiceCommand "continue" ("davom et")
    case "och":
      return "open";
    case "back":
    case "home": // feat/inclusive VoiceCommand "home"
    case "ortga":
      return "back";
    default:
      return null;
  }
}

/**
 * Topics for buildings in route order:
 * - walk the personal path; every building takes the current step;
 * - a WEAK step keeps the topic from a school to the next arena (weak topics get school + arena first);
 *   any other building moves on to the next step; past the end the last step repeats;
 * - the temple (final mastery test) always gets the last step of the path (the learner's goal).
 * `done` = building numbers (n) finished; the first unfinished building is current, the rest locked.
 */
export function assignQuests(town: TownData, path: PersonalPath, done: Iterable<number>, opts: { practiceOnly?: boolean } = {}): TownQuest[] {
  const doneSet = new Set(done);
  const steps: PathStep[] = path.steps;
  const last = steps[steps.length - 1];
  let t = 0;
  let current = false;
  return town.quests.map((q, idx) => {
    const n = idx + 1;
    let step: PathStep | undefined;
    if (q.kind === "temple") step = last;
    else {
      step = steps[Math.min(t, steps.length - 1)];
      const next = town.quests[idx + 1]?.kind;
      const keep = q.kind === "school" && step?.reason.kind === "weak" && next === "arena";
      if (!keep) t++;
    }
    let status: QuestStatus;
    if (doneSet.has(n)) status = "done";
    else if (!current) {
      status = "current";
      current = true;
    } else status = "locked";
    return {
      ...q,
      n,
      skillId: step?.id ?? null,
      topic: step?.title ?? "",
      weak: step?.reason.kind === "weak",
      status,
      href: step && status !== "locked" ? questHref(q.kind, step.id, town.course, n, opts) : null,
    };
  });
}

export function townProgress(quests: TownQuest[]) {
  return { done: quests.filter((q) => q.status === "done").length, total: quests.length };
}
