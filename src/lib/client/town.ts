"use client";
// Course towns on the client: load the town JSON + progress, and detect a finished quest.
// A quest counts as finished when the learner comes back and the quest topic's mastery went UP
// since the pin was tapped (a finished lesson / right quiz answers raise it; wrong ones lower it).
// That needs no change to the lesson / practice screens (code freeze).
import { parseTown, type TownData } from "@/lib/learning/town";
import { TOWN_DEFAULT_SIZE } from "@/config/towns";
import { P_START } from "@/lib/learning/mastery";

const PENDING = "to2-town-pending";

interface Pending {
  town: string;
  n: number;
  skillId: string;
  p0: number;
  at: number;
}

/** public/ui/town-<id>.json; falls back to the math placeholder (island image) until the team's file lands */
export async function loadTown(id: string): Promise<{ town: TownData; placeholder: boolean } | null> {
  for (const file of [`/ui/town-${id}.json`, "/ui/town-math.json"]) {
    try {
      const r = await fetch(file, { cache: "no-store" });
      if (!r.ok || !(r.headers.get("content-type") ?? "").includes("json")) continue;
      const raw = (await r.json()) as { placeholder?: boolean };
      const town = parseTown(raw);
      const placeholder = !!raw.placeholder || file !== `/ui/town-${id}.json`;
      return { town: { ...town, course: id }, placeholder };
    } catch {
      /* try the fallback */
    }
  }
  return null;
}

export async function loadTownProgress(): Promise<Record<string, number[]>> {
  try {
    const r = await fetch("/api/town", { cache: "no-store" });
    if (!r.ok) return {};
    return ((await r.json()) as { progress: Record<string, number[]> }).progress ?? {};
  } catch {
    return {};
  }
}

export async function markDone(town: string, n: number): Promise<number[] | null> {
  try {
    const r = await fetch("/api/town", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ town, n }) });
    if (!r.ok) return null;
    return ((await r.json()) as { done: number[] }).done;
  } catch {
    return null;
  }
}

export function setPending(p: Omit<Pending, "at">) {
  try {
    sessionStorage.setItem(PENDING, JSON.stringify({ ...p, at: Date.now() }));
  } catch {
    /* private mode: completion just won't be detected */
  }
}

/** If the pending quest's topic improved, mark it done (D1) and return it. */
export async function resolvePending(mastery: Record<string, number>): Promise<{ town: string; n: number; done: number[] } | null> {
  let p: Pending | null = null;
  try {
    p = JSON.parse(sessionStorage.getItem(PENDING) ?? "null") as Pending | null;
  } catch {
    return null;
  }
  if (!p) return null;
  const now = mastery[p.skillId] ?? P_START;
  if (now <= p.p0 + 1e-6) return null;
  const done = await markDone(p.town, p.n);
  if (!done) return null;
  try {
    sessionStorage.removeItem(PENDING);
  } catch {
    /* ignore */
  }
  return { town: p.town, n: p.n, done };
}

export { TOWN_DEFAULT_SIZE };
