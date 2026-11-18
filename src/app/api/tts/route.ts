// GET /api/tts?voice=<characterId|voice_…>&text=…&emotion=<emotion>&lead=1&wait=long → one WAV.
// Expressive speech without an emotion param: the text is split into clips (sentences, plus short
// interjections like "Voy,"), each clip is synthesized with its own speed (character base ×
// emotion) and, on lison-v2, an emotion tag; clips are joined with punctuation-sized silences.
// Every clip is cached in KV by sha256(voice + model + speed + text), so repeated phrases are
// instant and free; the joined WAV is cached too. 204 = no audio (mock / TTS down) → captions only.
//
// Latency: lison-v2 ("Expressive") takes ~7 s per clip (p90 11 s) vs ~0.7 s for lison v1. A live
// request waits at most V2_BUDGET_MS (11 s) for v2 (one retry on failure); if it isn't ready, that line
// is captions only (204) while v2 keeps generating in the background (after() → waitUntil) and is
// cached for the next time. A tutor never switches to v1 (one voice model per tutor, team rule).
//
// Budget: every synthesized clip is logged (credits_log, see /dev/credits). Over the warning cap
// (15,000 a day; 40,000 on the demo days 18–19 Nov) generation continues with a logged warning; over
// HARD_CAP (60,000 a day) new uncached lines are captions only. Cached audio always plays. &check=1 = dry run:
// says whether the line is cached and what it would cost, without generating anything.
// &src=warm|… labels the spend (default: prefetch for wait=long, answer for lead=1, else live).
import { after } from "next/server";
import { getEnv } from "@/lib/env";
import { getAI, voiceIdFor } from "@/lib/ai";
import { audioKey, getCachedAudio, putCachedAudio } from "@/lib/ai/audioCache";
import { clipText, prosodyPlan, type ProsodyPlan, type TtsModel } from "@/lib/ai/prosody";
import { EMOTIONS, type Emotion } from "@/lib/ai/schema";
import { CHARACTER_BY_ID, DEFAULT_TTS, type CharacterId } from "@/config/characters";
import { joinWav } from "@/lib/audio/wav";
import { clientKey, rateLimit, userIdFor } from "@/lib/server/session";
import { HARD_CAP, creditsFor, dayOf, logCredits, todayCredits, warnCapFor } from "@/lib/server/credits";
import { cachedExists } from "@/lib/server/exists";
import { storeGetText, storePut } from "@/lib/server/store";
import { ENV_STEP_MS, computeEnvelope, encodeEnvelope } from "@/lib/audio/envelope";
import type { AppEnv } from "@/lib/env";
import type { TTS } from "@/lib/ai/types";

// v2 never finished under 4.8 s in our A/B (0/18 clips), so a live request only waits long enough
// for the all-clips-in-KV path; a miss goes straight to v1 (+ v2 in the background)
// a live line waits this long for v2 before showing captions only (v2 ~5–11 s per clip; cached: ~0.3 s)
const V2_BUDGET_MS = 11_000;
const V2_BUDGET_PREFETCH_MS = 45_000;

/**
 * Lip-sync envelope of exactly the audio we serve (one byte per 20 ms, see src/lib/audio/envelope.ts),
 * sent as the x-tts-env header. For cached segments it's stored next to the audio (envKey); the
 * v1 stand-ins get it computed on the fly.
 */
async function envelopeFor(audio: ArrayBuffer, envKey?: string): Promise<string> {
  if (envKey) {
    const s = await storeGetText(envKey);
    if (s) return s;
  }
  try {
    const e = encodeEnvelope(computeEnvelope(audio));
    if (envKey) await storePut(envKey, e, { ttlSec: 60 * 60 * 24 * 60 });
    return e;
  } catch {
    return "";
  }
}

const audioResponse = async (audio: ArrayBuffer, cache: string, info: { clips?: number; model?: string; final?: boolean; envKey?: string } = {}) =>
  new Response(audio, {
    headers: {
      "content-type": "audio/wav",
      "x-tts-env": await envelopeFor(audio, info.envKey),
      "x-tts-env-step": String(ENV_STEP_MS),
      // a v1 stand-in must not stick in the browser cache: the expressive version is on its way
      "cache-control": info.final === false ? "no-store" : "public, max-age=31536000, immutable",
      "x-tts-cache": cache,
      ...(info.clips ? { "x-tts-clips": String(info.clips) } : {}),
      ...(info.model ? { "x-tts-model": info.model } : {}),
    },
  });

const clipKey = (voiceId: string, model: TtsModel, text: string, speed: number) => audioKey(voiceId, `clip|${model}|${speed}|${text}`);

/** One clip: cache hit, else synthesize (logged in credits_log) + cache. Returns the audio. */
async function clipAudio(env: AppEnv, tts: TTS, voiceId: string, model: TtsModel, text: string, speed: number, who: { tutor: string; source: string }) {
  const key = await clipKey(voiceId, model, text, speed);
  try {
    const hit = await getCachedAudio(env, key);
    if (hit) return { audio: hit.audio, cached: true };
  } catch {
    /* treat as a miss */
  }
  const { audio, mime } = await tts.synthesize(text, voiceId, { model, speed });
  await logCredits({ tutor: who.tutor, source: who.source, model, chars: text.length, text });
  try {
    await putCachedAudio(env, key, audio, mime);
  } catch (e) {
    console.warn("[tts] clip cache write failed", (e as Error).message);
  }
  return { audio, cached: false };
}

function join(plan: ProsodyPlan, clips: ArrayBuffer[]) {
  const parts: (ArrayBuffer | number)[] = [];
  if (plan.lead) parts.push(plan.lead);
  clips.forEach((a, i) => {
    parts.push(a);
    if (plan.clips[i].pauseAfter) parts.push(plan.clips[i].pauseAfter);
  });
  return joinWav(parts);
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const text = (url.searchParams.get("text") ?? "").trim().slice(0, 600);
  const voice = url.searchParams.get("voice") ?? "blokbek";
  const em = url.searchParams.get("emotion") ?? "neutral";
  const emotion: Emotion = (EMOTIONS as readonly string[]).includes(em) ? (em as Emotion) : "neutral";
  const answerLead = url.searchParams.get("lead") === "1";
  const budget = url.searchParams.get("wait") === "long" ? V2_BUDGET_PREFETCH_MS : V2_BUDGET_MS;
  const source = (url.searchParams.get("src") ?? (url.searchParams.get("wait") === "long" ? "prefetch" : answerLead ? "answer" : "live")).slice(0, 20);
  if (!text) return new Response(null, { status: 204 });

  const env = getEnv();
  const voiceId = voiceIdFor(voice, env);
  const cfg = CHARACTER_BY_ID[voice as CharacterId]?.tts ?? DEFAULT_TTS;
  const model = cfg.model as TtsModel;
  const plan = prosodyPlan(text, emotion, model, cfg.speed, { answerLead });

  // whole-segment cache (fast path)
  const segKey = await audioKey(voiceId, `seg2|${model}|${cfg.speed}|${emotion}|${answerLead ? 1 : 0}|${text}`);
  const dryRun = url.searchParams.get("check") === "1";
  if (dryRun && (await cachedExists(segKey))) {
    return Response.json({ cached: true, clips: plan.clips.length, missingClips: 0, chars: 0, credits: 0, model }, { headers: { "cache-control": "no-store" } });
  }
  try {
    const cached = dryRun ? null : await getCachedAudio(env, segKey);
    if (cached) return audioResponse(cached.audio, "hit", { model, envKey: segKey + ":env" });
  } catch (e) {
    console.warn("[tts] cache read failed", (e as Error).message);
  }

  // the joined segment wasn't cached: which clips are?
  const v2Keys = await Promise.all(plan.clips.map((c) => clipKey(voiceId, model, clipText(c), c.speed)));
  const missing: number[] = [];
  for (let i = 0; i < v2Keys.length; i++) {
    if (!(await cachedExists(v2Keys[i]))) missing.push(i);
  }

  // dry run: is it cached, and what would generating it cost?
  if (dryRun) {
    const chars = missing.reduce((n, i) => n + clipText(plan.clips[i]).length, 0);
    return Response.json({ cached: missing.length === 0, clips: plan.clips.length, missingClips: missing.length, chars, credits: creditsFor(model, chars), model }, { headers: { "cache-control": "no-store" } });
  }

  const ai = getAI(env);
  if (ai.mock) return new Response(null, { status: 204 });
  if (!(await rateLimit(`tts:${clientKey(req, await userIdFor(req))}`, 60))) return new Response(null, { status: 204 });

  // One voice model per tutor, always (team rule, 18 Nov): never a v1 stand-in for a v2 tutor.
  const who = { tutor: voice.startsWith("voice_") ? "other" : voice, source };
  const captionsOnly = (why: string) => new Response(null, { status: 204, headers: { "x-tts-error": why, "x-tts-cache": why } });
  // budget: over the warning cap keep generating (log a warning); over the hard cap: captions only
  if (missing.length > 0) {
    const spent = await todayCredits();
    if (spent >= HARD_CAP) {
      console.warn(`[tts] daily spend ${spent} ≥ hard cap ${HARD_CAP}: captions only`);
      return captionsOnly("budget");
    }
    if (spent >= warnCapFor(dayOf())) console.warn(`[tts] daily spend ${spent} over the warning cap ${warnCapFor(dayOf())} — still generating (v2)`);
  }

  // the expressive version, cached as it completes; one retry if VoiceLab fails or times out
  const makeFull = () =>
    Promise.all(plan.clips.map((c) => clipAudio(env, ai.tts, voiceId, model, clipText(c), c.speed, who))).then(async (r) => {
      const audio = join(plan, r.map((x) => x.audio));
      try {
        await putCachedAudio(env, segKey, audio, "audio/wav");
      } catch (e) {
        console.warn("[tts] cache write failed", (e as Error).message);
      }
      return { audio, fromCache: r.filter((x) => x.cached).length };
    });
  const full = makeFull().catch((e) => {
    console.warn("[tts] v2 failed, retrying once:", (e as Error).message);
    return makeFull();
  });

  try {
    const timeout = new Promise<null>((res) => setTimeout(() => res(null), budget));
    const r = await Promise.race([full, timeout]);
    if (r) return audioResponse(r.audio, r.fromCache === plan.clips.length ? "clips" : r.fromCache ? "partial" : "miss", { clips: plan.clips.length, model, envKey: segKey + ":env" });
    // not ready in time: this line shows captions only (the mouth still moves); v2 finishes in the
    // background (with its retry) and is cached, so the next time the line plays it has the voice
    after(full.catch((e) => console.warn("[tts] background v2 failed after retry", (e as Error).message)));
    return captionsOnly("v2-pending");
  } catch (e) {
    console.error("[tts] v2 failed after retry:", (e as Error).message);
    return captionsOnly("v2-failed");
  }
}
