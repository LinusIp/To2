// One launcher for the roadmap town pins:
//   openQuest("arena", skillId)    → one of the 3 arena games (Blok minorasi / Tezkor hisob / Juftini top)
//   openQuest("workshop", skillId) → Kasb sinovi (career mission)
// questHref() is pure (tested); openQuest() navigates (pass Next's router.push to keep client navigation).
import type { Rng } from "@/data/problems";

export type QuestKind = "arena" | "workshop";
export const ARENA_GAMES = ["tower", "speed", "memory"] as const;
export type ArenaGame = (typeof ARENA_GAMES)[number];

export function questHref(kind: QuestKind, skillId?: string | null, opts: { rng?: Rng; game?: ArenaGame } = {}): string {
  const q = skillId ? `?skill=${encodeURIComponent(skillId)}` : "";
  if (kind === "workshop") return `/games/mission${q}`;
  const game = opts.game ?? ARENA_GAMES[Math.floor((opts.rng ?? Math.random)() * ARENA_GAMES.length)];
  return `/games/${game}${q}`;
}

export function openQuest(kind: QuestKind, skillId?: string | null, opts: { rng?: Rng; game?: ArenaGame; navigate?: (href: string) => void } = {}): string {
  const href = questHref(kind, skillId, opts);
  if (opts.navigate) opts.navigate(href);
  else if (typeof window !== "undefined") window.location.assign(href);
  return href;
}
