// VoiceLab LLM: OpenAI-compatible POST /v1/chat/completions (stream via SSE `data:` lines).
import type { LLM, Msg } from "../types";
import { vlFetch, type VoiceLabConfig } from "./client";

export function voicelabLLM(cfg: VoiceLabConfig): LLM {
  const body = (messages: Msg[], stream: boolean, o?: { maxTokens?: number; temperature?: number }) =>
    JSON.stringify({
      model: cfg.model,
      messages,
      stream,
      max_tokens: o?.maxTokens ?? 1800,
      temperature: o?.temperature ?? 0.4,
    });

  return {
    async complete(messages, o) {
      const res = await vlFetch(cfg, "/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body(messages, false, o),
        timeoutMs: 45_000,
      });
      const j = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      return j.choices?.[0]?.message?.content ?? "";
    },
    async *stream(messages, o) {
      const res = await vlFetch(cfg, "/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
        body: body(messages, true, o),
        timeoutMs: 60_000,
      });
      if (!res.body) return;
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (value) buf += dec.decode(value, { stream: true });
        let i: number;
        while ((i = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, i).trim();
          buf = buf.slice(i + 1);
          if (!line.startsWith("data:")) continue;
          const data = line.slice(5).trim();
          if (data === "[DONE]") return;
          try {
            const j = JSON.parse(data) as { choices?: { delta?: { content?: string } }[]; error?: { message?: string } };
            if (j.error) throw new Error(j.error.message ?? "llm stream error");
            const d = j.choices?.[0]?.delta?.content;
            if (d) yield d;
          } catch (e) {
            if (e instanceof SyntaxError) continue;
            throw e;
          }
        }
        if (done) return;
      }
    },
  };
}
