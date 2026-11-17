import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";
import { getEnv } from "@/lib/env";

// Idempotent bootstrap so a fresh D1 (local or remote) works even before
// `drizzle/` migrations are applied. Mirrors drizzle/0000_init.sql.
const BOOTSTRAP = [
  `CREATE TABLE IF NOT EXISTS users (id text PRIMARY KEY NOT NULL, nickname text NOT NULL, grade integer NOT NULL, character_id text DEFAULT 'blokbek' NOT NULL, xp integer DEFAULT 0 NOT NULL, streak_days integer DEFAULT 0 NOT NULL, last_active_at integer NOT NULL, created_at integer NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS skill_mastery (user_id text NOT NULL, skill_id text NOT NULL, p_mastery real NOT NULL, attempts integer DEFAULT 0 NOT NULL, correct integer DEFAULT 0 NOT NULL, updated_at integer NOT NULL, PRIMARY KEY(user_id, skill_id))`,
  `CREATE TABLE IF NOT EXISTS attempts (id text PRIMARY KEY NOT NULL, user_id text NOT NULL, skill_id text NOT NULL, problem_json text NOT NULL, answer text NOT NULL, is_correct integer NOT NULL, hint_used integer DEFAULT false NOT NULL, ms_taken integer, created_at integer NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS attempts_user_idx ON attempts (user_id, created_at)`,
  `CREATE TABLE IF NOT EXISTS lessons (id text PRIMARY KEY NOT NULL, user_id text NOT NULL, skill_id text NOT NULL, started_at integer NOT NULL, finished_at integer, segments_json text)`,
  `CREATE TABLE IF NOT EXISTS roadmaps (user_id text PRIMARY KEY NOT NULL, nodes_json text NOT NULL, generated_at integer NOT NULL)`,
  // key-value store (sessions, caches, TTS audio): KV allows only 1,000 writes/day on our plan, D1 100,000
  `CREATE TABLE IF NOT EXISTS kv_store (key text PRIMARY KEY NOT NULL, value blob NOT NULL, mime text, expires_at integer)`,
  // VoiceLab TTS spend, one row per synthesized clip (src/lib/server/credits.ts)
  `CREATE TABLE IF NOT EXISTS credits_log (id integer PRIMARY KEY AUTOINCREMENT, at integer NOT NULL, day text NOT NULL, tutor text NOT NULL, source text NOT NULL, model text NOT NULL, chars integer NOT NULL, credits real NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS credits_day_idx ON credits_log (day)`,
];

let bootstrapped: Promise<void> | null = null;

export async function getDb() {
  const env = getEnv();
  if (!bootstrapped) {
    bootstrapped = env.DB.batch(BOOTSTRAP.map((s) => env.DB.prepare(s)))
      .then(() => undefined)
      .catch((e) => {
        bootstrapped = null;
        throw e;
      });
  }
  await bootstrapped;
  return drizzle(env.DB, { schema });
}

export { schema };
