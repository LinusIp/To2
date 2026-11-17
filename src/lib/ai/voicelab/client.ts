// Thin fetch client for https://api.voicelab.uz (Bearer vlk_… key, server-side only).
import type { AppEnv } from "@/lib/env";

export interface VoiceLabConfig {
  baseUrl: string;
  apiKey: string;
  lang: string;
  model: string;
}

export function voicelabConfig(env: AppEnv): VoiceLabConfig {
  return {
    baseUrl: (env.VOICELAB_BASE_URL || "https://api.voicelab.uz").replace(/\/+$/, ""),
    apiKey: env.VOICELAB_API_KEY ?? "",
    lang: env.VOICELAB_LANG || "uz",
    model: env.VOICELAB_LLM_MODEL || "aisha-gemma-4",
  };
}

export class VoiceLabError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export async function vlFetch(cfg: VoiceLabConfig, path: string, init: RequestInit & { timeoutMs?: number } = {}): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), init.timeoutMs ?? 30_000);
  try {
    const res = await fetch(cfg.baseUrl + path, {
      ...init,
      signal: ctrl.signal,
      headers: { Authorization: `Bearer ${cfg.apiKey}`, ...(init.headers ?? {}) },
    });
    if (!res.ok && res.status !== 202) {
      let code = "http_" + res.status;
      let msg = res.statusText;
      try {
        const j = (await res.json()) as { message?: string; error?: { code?: string; message?: string } };
        code = j.error?.code ?? code;
        msg = j.error?.message ?? j.message ?? msg;
      } catch {
        /* non-JSON error (e.g. gateway HTML) */
      }
      throw new VoiceLabError(res.status, code, `VoiceLab ${path}: ${msg}`);
    }
    return res;
  } finally {
    clearTimeout(timer);
  }
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
