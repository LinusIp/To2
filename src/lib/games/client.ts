"use client";
// O'yinlar client helpers: calm-mode detection, screen-reader announcements, answer reporting, best scores.
import { useEffect, useState } from "react";
import type { GameAnswerBody, GameId } from "./answer";
import type { GameQuestion } from "./questions";

/** Settings a game can be given from outside (the inclusive-mode panel), see useGameSettings. */
export interface GameSettings {
  /** no shaking, falling, confetti */
  calm?: boolean;
}

/**
 * a11y-hook: calm = explicit prop || inclusive-mode "calm" (feat/inclusive mirrors it onto
 * <html data-calm>, see its src/lib/a11y/settings.ts) || OS prefers-reduced-motion. Read live, so
 * toggling calm mode mid-game takes effect at once. When src/lib/a11y is merged this can read
 * useA11y() directly; the data attribute keeps it working without a compile-time dependency.
 */
export function useGameSettings(override?: GameSettings): Required<GameSettings> {
  const [calm, setCalm] = useState(false);
  useEffect(() => {
    const html = document.documentElement;
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    const sync = () => setCalm(html.hasAttribute("data-calm") || !!mq?.matches);
    sync();
    mq?.addEventListener?.("change", sync);
    const mo = new MutationObserver(sync);
    mo.observe(html, { attributes: true, attributeFilter: ["data-calm"] });
    return () => {
      mq?.removeEventListener?.("change", sync);
      mo.disconnect();
    };
  }, []);
  return { calm: override?.calm ?? calm };
}

/** Report an answer: server re-checks and updates mastery + XP like a lesson. Fire-and-forget. */
export async function reportAnswer(body: GameAnswerBody): Promise<{ xp: number } | null> {
  try {
    const r = await fetch("/api/games/answer", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    if (!r.ok) return null;
    return (await r.json()) as { xp: number };
  } catch {
    return null;
  }
}

export const reportQuestion = (game: GameId, q: GameQuestion, given: string, msTaken?: number) =>
  reportAnswer({ game, kind: "q", skillId: q.skillId, expect: q.expect, given, question: q.q.slice(0, 300), msTaken });

export async function fetchQuestions(game: "tower" | "speed", skills: string[]): Promise<GameQuestion[]> {
  const r = await fetch(`/api/games?game=${game}&skills=${encodeURIComponent(skills.join(","))}`, { cache: "no-store" });
  if (!r.ok) throw new Error(String(r.status));
  return ((await r.json()) as { questions: GameQuestion[] }).questions;
}

const LS = (g: GameId) => `to2:games:best:${g}`;
function lsGet(g: GameId): number {
  try {
    return Number(localStorage.getItem(LS(g)) ?? 0) || 0;
  } catch {
    return 0;
  }
}
function lsSet(g: GameId, v: number) {
  try {
    localStorage.setItem(LS(g), String(v));
  } catch {
    /* blocked storage: the D1 copy still works */
  }
}

/** Best scores: D1 (per learner) merged with the localStorage fallback. */
export async function loadBest(): Promise<Partial<Record<GameId, number>>> {
  const local = { tower: lsGet("tower"), speed: lsGet("speed"), memory: lsGet("memory") };
  try {
    const r = await fetch("/api/games/best", { cache: "no-store" });
    const j = (await r.json()) as { best: Partial<Record<GameId, number>> };
    return { tower: Math.max(local.tower, j.best.tower ?? 0), speed: Math.max(local.speed, j.best.speed ?? 0), memory: Math.max(local.memory, j.best.memory ?? 0) };
  } catch {
    return local;
  }
}

/** Save a finished round; returns the best score and whether this round set a new record. */
export async function saveBest(game: GameId, score: number): Promise<{ best: number; record: boolean }> {
  const prev = lsGet(game);
  if (score > prev) lsSet(game, score);
  let best = Math.max(prev, score);
  let record = score > prev;
  try {
    const r = await fetch("/api/games/best", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ game, score }) });
    const j = (await r.json()) as { best: Partial<Record<GameId, number>>; record?: boolean };
    const server = j.best[game] ?? 0;
    record = record && score >= server;
    best = Math.max(best, server);
  } catch {
    /* offline → local only */
  }
  return { best, record };
}

/** Skills for a round: ?skill=… (roadmap node button) or the learner's current path. */
export function roundSkills(param: string | null, roadmap: { currentId?: string | null; path?: string[]; nodes: { id: string; status: string }[] } | null): string[] {
  if (param) return [param];
  if (!roadmap) return [];
  const open = new Set(roadmap.nodes.filter((n) => n.status !== "locked").map((n) => n.id));
  const path = (roadmap.path ?? []).filter((id) => open.has(id));
  const cur = roadmap.currentId && open.has(roadmap.currentId) ? [roadmap.currentId] : [];
  const mastered = roadmap.nodes.filter((n) => n.status === "mastered").map((n) => n.id);
  return [...new Set([...cur, ...path, ...mastered])].slice(0, 4);
}
