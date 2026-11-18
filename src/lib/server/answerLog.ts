// Which path answered each live question (pinned / interrupt-cache / llm / rate-limited / llm-failed /
// mock), with the normalized question and the cache key — so "the same answer every time" can be traced.
// One row per question in D1 `answer_log` (created in src/db/client.ts). Never throws.
import { getDb } from "@/db/client";
import { getEnv } from "@/lib/env";

export interface AnswerLogRow {
  userId: string | null;
  skillId: string;
  tutor: string;
  step: number;
  question: string; // normalized
  key: string;
  source: string;
  reason: string;
  display: string;
  segments: number;
  ms: number;
}

export async function logAnswer(r: AnswerLogRow) {
  try {
    await getDb();
    await getEnv()
      .DB.prepare("INSERT INTO answer_log (at, user_id, skill, tutor, step, question, cache_key, source, reason, display, segments, ms) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .bind(Date.now(), r.userId ?? "", r.skillId, r.tutor, r.step, r.question.slice(0, 300), r.key, r.source || "unknown", r.reason.slice(0, 300), r.display, r.segments, r.ms)
      .run();
  } catch (e) {
    console.warn("[answer_log] write failed", (e as Error).message);
  }
}

/** The last answers for one learner (their own session only — questions are the learner's words). */
export async function recentAnswers(userId: string, limit = 30) {
  await getDb();
  const r = await getEnv()
    .DB.prepare("SELECT at, skill, tutor, step, question, cache_key, source, reason, display, segments, ms FROM answer_log WHERE user_id = ? ORDER BY id DESC LIMIT ?")
    .bind(userId, limit)
    .all();
  return r.results;
}
