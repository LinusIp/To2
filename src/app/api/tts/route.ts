// GET /api/tts?voice=<characterId|voice_…>&text=… → audio (cached by sha256(voiceId+text)).
// 204 = no audio available (mock mode / TTS down) → client plays captions with a silent timer.
import { getEnv } from "@/lib/env";
import { getAI, voiceIdFor } from "@/lib/ai";
import { audioKey, getCachedAudio, putCachedAudio } from "@/lib/ai/audioCache";
import { clientKey, rateLimit, userIdFor } from "@/lib/server/session";

const audioResponse = (audio: ArrayBuffer, mime: string, hit: boolean) =>
  new Response(audio, {
    headers: {
      "content-type": mime,
      "cache-control": "public, max-age=31536000, immutable",
      "x-tts-cache": hit ? "hit" : "miss",
    },
  });

export async function GET(req: Request) {
  const url = new URL(req.url);
  const text = (url.searchParams.get("text") ?? "").trim().slice(0, 600);
  const voice = url.searchParams.get("voice") ?? "blokbek";
  if (!text) return new Response(null, { status: 204 });
  const env = getEnv();
  const voiceId = voiceIdFor(voice, env);
  const key = await audioKey(voiceId, text);

  try {
    const cached = await getCachedAudio(env, key);
    if (cached) return audioResponse(cached.audio, cached.mime, true);
  } catch (e) {
    console.warn("[tts] cache read failed", (e as Error).message);
  }

  const ai = getAI(env);
  if (ai.mock) return new Response(null, { status: 204 });
  if (!(await rateLimit(`tts:${clientKey(req, await userIdFor(req))}`, 60))) return new Response(null, { status: 204 });

  try {
    const { audio, mime } = await ai.tts.synthesize(text, voiceId);
    try {
      await putCachedAudio(env, key, audio, mime);
    } catch (e) {
      console.warn("[tts] cache write failed", (e as Error).message);
    }
    return audioResponse(audio, mime, false);
  } catch (e) {
    console.error("[tts] synth failed", (e as Error).message);
    return new Response(null, { status: 204, headers: { "x-tts-error": "1" } });
  }
}
