// English pronunciation via Gemini TTS — pure helpers (validation, request, response → WAV).
// The Uzbek tutor voice (VoiceLab) keeps explaining; only English words on the board use this.
// Server-only use: the key is passed in by the route from env.GEMINI_API_KEY and never logged.

export const MAX_PHRASE = 60;
const ALLOWED = /^[A-Za-z' .?!]+$/;

/** Normalise + validate a phrase: ≤ 60 chars of A–Z, spaces, ' . ? !  → null when not allowed. */
export function cleanPhrase(input: string | null | undefined): string | null {
  const s = (input ?? "").replace(/[’‘]/g, "'").replace(/\s+/g, " ").trim();
  if (!s || s.length > MAX_PHRASE || !ALLOWED.test(s) || !/[A-Za-z]/.test(s)) return null;
  return s;
}

/**
 * English parts of a board text the learner can hear: "I am = I'm" → ["I am", "I'm"],
 * "he / she / it is" → ["he she it is"]; gaps ("___"), Uzbek (o', g', sh-words after "=") and
 * anything outside the whitelist are dropped.
 */
export function sayableParts(text: string): string[] {
  return text
    .split("=")
    .map((p) => p.replace(/\//g, " ").replace(/\s+/g, " ").trim())
    .filter((p) => !/_/.test(p) && !/\b[A-Za-z]*[og]'/i.test(p) && !/\.\./.test(p))
    .map((p) => cleanPhrase(p))
    .filter((p): p is string => !!p);
}

export const GEMINI_TTS_MODEL = "gemini-2.5-flash-preview-tts";
export const GEMINI_VOICE = "Kore";

export function geminiRequest(phrase: string, opts: { model?: string; voice?: string } = {}) {
  const model = opts.model || GEMINI_TTS_MODEL;
  return {
    url: `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    body: {
      contents: [{ parts: [{ text: `Say slowly and clearly, in a friendly teacher's voice: ${phrase}` }] }],
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: opts.voice || GEMINI_VOICE } } },
      },
    },
  };
}

/** Gemini returns base64 PCM (audio/L16; rate=24000, mono 16-bit) → bytes + sample rate. */
export function pcmFromGemini(json: unknown): { pcm: Uint8Array; rate: number } | null {
  const parts = (json as { candidates?: { content?: { parts?: { inlineData?: { data?: string; mimeType?: string } }[] } }[] })?.candidates?.[0]?.content?.parts ?? [];
  const inline = parts.find((p) => p.inlineData?.data)?.inlineData;
  if (!inline?.data) return null;
  const rate = Number(/rate=(\d+)/.exec(inline.mimeType ?? "")?.[1] ?? 24000);
  const bin = atob(inline.data);
  const pcm = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) pcm[i] = bin.charCodeAt(i);
  return pcm.length ? { pcm, rate } : null;
}

/** 16-bit mono PCM → WAV file bytes */
export function pcmToWav(pcm: Uint8Array, rate = 24000): ArrayBuffer {
  const buf = new ArrayBuffer(44 + pcm.length);
  const v = new DataView(buf);
  const str = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, "RIFF");
  v.setUint32(4, 36 + pcm.length, true);
  str(8, "WAVE");
  str(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  str(36, "data");
  v.setUint32(40, pcm.length, true);
  new Uint8Array(buf, 44).set(pcm);
  return buf;
}

export async function phraseKey(phrase: string, voice = GEMINI_VOICE): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${voice}|${phrase.toLowerCase()}`));
  return "ensay:v1:" + [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
