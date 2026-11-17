// VoiceLab credit log (TTS): one row per synthesized clip in D1 table credits_log, so we always
// know what the demo costs. Credits = characters × model rate (lison 1, lison-v2 1.5 per char).
// DAILY_CAP: above it, NEW uncached lines are synthesized on lison v1 (cached v2 keeps playing).
import { getDb } from "@/db/client";
import { getEnv } from "@/lib/env";

export const DAILY_CAP = 15_000;
export const RATE: Record<string, number> = { lison: 1, "lison-v2": 1.5 };
export const creditsFor = (model: string, chars: number) => chars * (RATE[model] ?? 1);

/** Tashkent calendar day (UTC+5), e.g. "2026-11-18". */
export const dayOf = (ms = Date.now()) => new Date(ms + 5 * 3600_000).toISOString().slice(0, 10);

export async function logCredits(e: { tutor: string; source: string; model: string; chars: number }): Promise<void> {
  try {
    await getDb();
    const credits = creditsFor(e.model, e.chars);
    await getEnv()
      .DB.prepare("INSERT INTO credits_log (at, day, tutor, source, model, chars, credits) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .bind(Date.now(), dayOf(), e.tutor, e.source, e.model, e.chars, credits)
      .run();
    if (cache && cache.day === dayOf()) cache.total += credits;
  } catch (err) {
    console.warn("[credits] log failed", (err as Error).message);
  }
}

let cache: { day: string; total: number; at: number } | null = null;

/** Today's total (cached 30 s per isolate; counts this isolate's new spend immediately). */
export async function todayCredits(): Promise<number> {
  const day = dayOf();
  if (cache && cache.day === day && Date.now() - cache.at < 30_000) return cache.total;
  try {
    await getDb();
    const r = await getEnv().DB.prepare("SELECT COALESCE(SUM(credits), 0) AS total FROM credits_log WHERE day = ?").bind(day).first<{ total: number }>();
    cache = { day, total: r?.total ?? 0, at: Date.now() };
    return cache.total;
  } catch {
    return cache?.total ?? 0;
  }
}

export async function creditsSummary(day = dayOf()) {
  await getDb();
  const db = getEnv().DB;
  const by = async (col: "tutor" | "source" | "model") =>
    (await db.prepare(`SELECT ${col} AS k, COUNT(*) AS clips, SUM(chars) AS chars, SUM(credits) AS credits FROM credits_log WHERE day = ? GROUP BY ${col} ORDER BY credits DESC`).bind(day).all<{ k: string; clips: number; chars: number; credits: number }>()).results;
  const tot = await db.prepare("SELECT COUNT(*) AS clips, COALESCE(SUM(chars), 0) AS chars, COALESCE(SUM(credits), 0) AS credits FROM credits_log WHERE day = ?").bind(day).first<{ clips: number; chars: number; credits: number }>();
  const all = await db.prepare("SELECT COALESCE(SUM(credits), 0) AS credits, MIN(day) AS since FROM credits_log").first<{ credits: number; since: string | null }>();
  return {
    day,
    today: tot,
    cap: DAILY_CAP,
    overCap: (tot?.credits ?? 0) >= DAILY_CAP,
    byTutor: await by("tutor"),
    bySource: await by("source"),
    byModel: await by("model"),
    allTime: all,
  };
}
