// Adapter factory: VoiceLab in production, mock when MOCK_AI=1 or no key.
import { getEnv, isMock, type AppEnv } from "@/lib/env";
import type { LLM, STT, TTS } from "./types";
import { voicelabConfig } from "./voicelab/client";
import { voicelabLLM } from "./voicelab/llm";
import { voicelabSTT } from "./voicelab/stt";
import { voicelabTTS } from "./voicelab/tts";
import { mockLLM, mockSTT, mockTTS } from "./mock/adapters";

export function getAI(env: AppEnv = getEnv()): { stt: STT; tts: TTS; llm: LLM; mock: boolean } {
  if (isMock(env)) return { stt: mockSTT, tts: mockTTS, llm: mockLLM, mock: true };
  const cfg = voicelabConfig(env);
  return { stt: voicelabSTT(cfg), tts: voicelabTTS(cfg), llm: voicelabLLM(cfg), mock: false };
}

/** Default VoiceLab Uzbek voices per character (overridable with the VOICE_IDS var). */
const DEFAULT_VOICES: Record<string, string> = {
  blokbek: "voice_fa56cecf-9b0b-45ba-9ec3-494efb5b301f", // Javohir — Bright presenter
  "agent-shox": "voice_ba303813-3023-48aa-a454-4b5705669d35", // Jasur — Noir (calm)
  lola: "voice_7b350d91-4e56-4bc3-869c-8cd6ba646c3c", // Gulya — Sweet friendly (female; most expressive female in the A/B)
  ziyo: "voice_be56058a-8f15-48bb-904b-4fe92531d5b1", // Rustam — Anime hero (curious, young)
  sardor: "voice_xdQMoRJkjHbPIB-jounXzKq8", // Sardor — Barqaror · aniq
  ravshan: "voice_5e592ada-eca8-42e3-98fa-469c1c8fc999", // Botir — energetic
  diyorbek: "voice_8bae02c6-d078-4757-9d62-0fce6da23cf7", // Amir — Warm storyteller
  shadow: "voice_OBuMpAaB5iYCUZS0eCc9Fj3k", // Firdavs Urinov
};

export function voiceIdFor(characterOrVoice: string, env: AppEnv = getEnv()): string {
  if (characterOrVoice.startsWith("voice_")) return characterOrVoice;
  let map: Record<string, string> = {};
  try {
    map = JSON.parse(env.VOICE_IDS || "{}");
  } catch {
    /* ignore bad JSON */
  }
  const v = map[characterOrVoice];
  return v && v.startsWith("voice_") && !v.endsWith("...") ? v : (DEFAULT_VOICES[characterOrVoice] ?? DEFAULT_VOICES.blokbek);
}
