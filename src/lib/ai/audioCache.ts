// TTS audio cache keyed by sha256(voiceId + text). R2 when bound, else KV
// (R2 is not enabled on the hackathon account yet — see REPORT.md).
import type { AppEnv } from "@/lib/env";

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
  const r = await env.KV.getWithMetadata<{ mime?: string }>(key, "arrayBuffer");
  if (!r.value) return null;
  return { audio: r.value, mime: r.metadata?.mime ?? "audio/wav" };
}

export async function putCachedAudio(env: AppEnv, key: string, audio: ArrayBuffer, mime: string) {
  if (env.AUDIO) {
    await env.AUDIO.put(key, audio, { httpMetadata: { contentType: mime } });
    return;
  }
  // KV values ≤ 25 MiB; a 2-sentence WAV is ~250 KB.
  await env.KV.put(key, audio, { metadata: { mime }, expirationTtl: 60 * 60 * 24 * 60 });
}
