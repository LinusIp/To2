// VoiceLab TTS: POST /v1/tts {text, language, voice_id} → WAV bytes (200) or a job (202 → poll).
import type { TTS } from "../types";
import { sleep, vlFetch, type VoiceLabConfig } from "./client";

async function idem(text: string, voiceId: string) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(voiceId + "|" + text));
  return "to2-" + [...new Uint8Array(d)].slice(0, 16).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function voicelabTTS(cfg: VoiceLabConfig): TTS {
  return {
    async synthesize(text, voiceId) {
      const res = await vlFetch(cfg, "/v1/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": await idem(text, voiceId) },
        body: JSON.stringify({ text: text.slice(0, 4900), language: cfg.lang, voice_id: voiceId }),
        timeoutMs: 20_000,
      });
      if (res.status === 200) return { audio: await res.arrayBuffer(), mime: res.headers.get("content-type") ?? "audio/wav" };
      // 202: long generation → poll the job, then download the signed URL (no auth header)
      const job = (await res.json()) as { id: string; status_url?: string };
      for (let i = 0; i < 20; i++) {
        await sleep(700);
        const st = (await (await vlFetch(cfg, `/v1/tts/generations/${job.id}`)).json()) as { status: string; audio_url?: string; error?: string };
        if (st.status === "completed" && st.audio_url) {
          const a = await fetch(st.audio_url);
          return { audio: await a.arrayBuffer(), mime: a.headers.get("content-type") ?? "audio/wav" };
        }
        if (st.status === "failed") throw new Error("TTS failed: " + (st.error ?? ""));
      }
      throw new Error("TTS timeout");
    },
  };
}
