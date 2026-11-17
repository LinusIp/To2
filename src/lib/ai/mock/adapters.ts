// MOCK_AI=1: no network calls. The demo must fully work like this.
import type { LLM, STT, TTS } from "../types";

export class MockAudioUnavailable extends Error {}

export const mockSTT: STT = {
  async transcribe() {
    return { text: "Nega maxrajlarni oltiga keltirdik?" };
  },
};

/** No audio in mock mode → /api/tts returns 204 and the client plays a silent, captioned timer. */
export const mockTTS: TTS = {
  async synthesize() {
    throw new MockAudioUnavailable("mock tts");
  },
};

/** The tutor route answers from canned lessons in mock mode; this is only a safety net. */
export const mockLLM: LLM = {
  async complete() {
    return JSON.stringify([
      { id: "m1", type: "explain", layer: "note", emotion: "happy", say: "Yaxshi savol! Keling, shu qadamni sekinroq ko'ramiz.", board: [] },
      { id: "m2", type: "check", layer: "note", emotion: "encouraging", say: "Tushunarli bo'ldimi? Davom etamizmi?", board: [] },
    ]);
  },
  async *stream(m, o) {
    yield await this.complete(m, o);
  },
};
