// Server-only access to Cloudflare bindings + vars.
import { env as cfEnv } from "cloudflare:workers";

export interface AppEnv {
  DB: D1Database;
  KV: KVNamespace;
  AUDIO?: R2Bucket;
  MOCK_AI?: string;
  DEFAULT_LOCALE?: string;
  VOICELAB_API_KEY?: string;
  VOICELAB_BASE_URL?: string;
  VOICELAB_LLM_MODEL?: string;
  VOICELAB_LANG?: string;
  VOICE_IDS?: string;
}

export function getEnv(): AppEnv {
  return cfEnv as unknown as AppEnv;
}

/** Mock mode: explicit MOCK_AI=1, or no API key configured. */
export function isMock(e: AppEnv = getEnv()): boolean {
  return e.MOCK_AI === "1" || !e.VOICELAB_API_KEY;
}
