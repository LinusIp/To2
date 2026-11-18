// GET /api/english/say?text=I%20am → WAV of an English word/phrase spoken by Gemini TTS.
// GET /api/english/say?check=1      → {enabled} (is pronunciation available? the client hides the button if not).
// Cached by sha256(voice + phrase) in the D1 store, so each phrase is generated once. The key
// (GEMINI_API_KEY, a Wrangler secret) stays on the server and is never logged or returned.
import { getEnv } from "@/lib/env";
import { storeGetBytes, storePut } from "@/lib/server/store";
import { clientKey, json, rateLimit, userIdFor } from "@/lib/server/session";
import { cleanPhrase, geminiRequest, pcmFromGemini, pcmToWav, phraseKey } from "@/lib/english/say";

type GeminiEnv = { GEMINI_API_KEY?: string; GEMINI_TTS_MODEL?: string; GEMINI_TTS_VOICE?: string };

const audio = (bytes: ArrayBuffer, cache: string) =>
  new Response(bytes, { headers: { "content-type": "audio/wav", "cache-control": "public, max-age=31536000, immutable", "x-ensay-cache": cache } });

export async function GET(req: Request) {
  const url = new URL(req.url);
  const env = getEnv() as unknown as GeminiEnv;
  const enabled = !!env.GEMINI_API_KEY;
  if (url.searchParams.get("check") === "1") return json({ enabled }, { headers: { "cache-control": "no-store" } });

  const phrase = cleanPhrase(url.searchParams.get("text"));
  if (!phrase) return json({ error: "bad phrase" }, { status: 400 });
  const voice = env.GEMINI_TTS_VOICE || undefined;
  const key = await phraseKey(phrase, voice);
  const hit = await storeGetBytes(key).catch(() => null);
  if (hit) return audio(hit.bytes, "hit");
  if (!enabled) return json({ error: "unavailable" }, { status: 503 });
  if (!(await rateLimit(`ensay:${clientKey(req, await userIdFor(req))}`, 30))) return json({ error: "rate" }, { status: 429 });

  try {
    const r = geminiRequest(phrase, { model: env.GEMINI_TTS_MODEL, voice });
    const res = await fetch(r.url, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY! },
      body: JSON.stringify(r.body),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      console.warn("[ensay] gemini status", res.status); // status only — never the key or the body
      return json({ error: "unavailable" }, { status: 503 });
    }
    const got = pcmFromGemini(await res.json());
    if (!got) return json({ error: "unavailable" }, { status: 503 });
    const wav = pcmToWav(got.pcm, got.rate);
    await storePut(key, wav, { mime: "audio/wav" }).catch(() => false);
    return audio(wav, "miss");
  } catch {
    console.warn("[ensay] gemini call failed");
    return json({ error: "unavailable" }, { status: 503 });
  }
}
