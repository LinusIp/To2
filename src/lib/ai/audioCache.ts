// TTS audio cache keyed by sha256(voiceId + text). Stored through src/lib/server/store.ts:
// D1 for writes (KV's 1,000 writes/day ran out), D1 then KV for reads (older entries live in KV).
// R2 would be the natural home (not enabled on the hackathon account — see REPORT.md).
import type { AppEnv } from "@/lib/env";
import { storeGetBytes, storePut } from "@/lib/server/store";

export async function audioKey(voiceId: string, text: string) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(voiceId + text));
  return "tts/" + [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function getCachedAudio(env: AppEnv, key: string): Promise<{ audio: ArrayBuffer; mime: string } | null> {
  if (env.AUDIO) {
    const o = await env.AUDIO.get(key);
    if (!o) return null;
    return { audio: await o.arrayBuffer(), mime: o.httpMetadata?.contentType ?? "audio/wav" };
  }
  const r = await storeGetBytes(key);
  return r ? { audio: r.bytes, mime: r.mime || "audio/wav" } : null;
}

export async function putCachedAudio(env: AppEnv, key: string, audio: ArrayBuffer, mime: string) {
  if (env.AUDIO) {
    await env.AUDIO.put(key, audio, { httpMetadata: { contentType: mime } });
    return;
  }
  // D1 rows hold up to 2 MB; a joined segment WAV is ~0.2–0.8 MB.
  if (audio.byteLength > 1_900_000) return;
  await storePut(key, audio, { mime, ttlSec: 60 * 60 * 24 * 60 });
}
