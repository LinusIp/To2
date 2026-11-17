// Is a cached value there? Without reading it: decoding a WAV just to test for a hit costs CPU
// (Workers free plan ≈ 10 ms/request — see the base64 note in store.ts).
import { getDb } from "@/db/client";
import { getEnv } from "@/lib/env";

export async function cachedExists(key: string): Promise<boolean> {
  try {
    await getDb();
    const r = await getEnv()
      .DB.prepare("SELECT 1 AS ok FROM kv_store WHERE key = ? AND typeof(value) <> 'blob' AND (expires_at IS NULL OR expires_at > ?)")
      .bind(key, Math.floor(Date.now() / 1000))
      .first<{ ok: number }>();
    if (r) return true;
  } catch {
    /* fall through to KV */
  }
  try {
    // older entries live in KV; a stream read doesn't buffer the value
    const v = await getEnv().KV.get(key, "stream");
    if (v) {
      await v.cancel();
      return true;
    }
  } catch {
    /* treat as missing */
  }
  return false;
}
