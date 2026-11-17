// VoiceLab STT: POST /v1/stt multipart (audio, language) → 202 job → poll /v1/stt/transcriptions/{id}.
import type { STT } from "../types";
import { sleep, vlFetch, type VoiceLabConfig } from "./client";

export function voicelabSTT(cfg: VoiceLabConfig): STT {
  return {
    async transcribe(audio, mime) {
      const fd = new FormData();
      const ext = mime.includes("mp4") ? "m4a" : mime.includes("ogg") ? "ogg" : mime.includes("wav") ? "wav" : "webm";
      fd.append("audio", new Blob([audio], { type: mime || "audio/webm" }), `q.${ext}`);
      fd.append("language", cfg.lang);
      const res = await vlFetch(cfg, "/v1/stt", {
        method: "POST",
        headers: { "Idempotency-Key": crypto.randomUUID() },
        body: fd,
        timeoutMs: 20_000,
      });
      const job = (await res.json()) as { id: string; status: string; transcript?: string };
      if (job.status === "completed") return { text: job.transcript ?? "" };
      // Short clips usually finish in 1–3 s. Poll ~every 400ms (docs: respect Retry-After, else ~1s).
      const deadline = Date.now() + 20_000;
      let wait = 350;
      while (Date.now() < deadline) {
        await sleep(wait);
        wait = Math.min(1000, wait + 150);
        const r = await vlFetch(cfg, `/v1/stt/transcriptions/${job.id}`);
        const st = (await r.json()) as { status: string; transcript?: string; error?: { message?: string } };
        if (st.status === "completed") return { text: (st.transcript ?? "").trim() };
        if (st.status === "failed") throw new Error("STT failed: " + (st.error?.message ?? ""));
        const ra = Number(r.headers.get("retry-after"));
        if (ra > 0) wait = Math.min(1500, ra * 1000);
      }
      throw new Error("STT timeout");
    },
  };
}
