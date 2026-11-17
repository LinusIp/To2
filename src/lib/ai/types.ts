// Provider-neutral AI adapters (CLAUDE.md §8). Only src/lib/ai/voicelab/* knows VoiceLab.
export interface Msg {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface STT {
  transcribe(audio: ArrayBuffer, mime: string): Promise<{ text: string }>;
}

export interface TTS {
  synthesize(text: string, voiceId: string): Promise<{ audio: ArrayBuffer; mime: string }>;
}

export interface LLM {
  complete(messages: Msg[], opts?: { maxTokens?: number; temperature?: number }): Promise<string>;
  /** Streams text deltas. */
  stream(messages: Msg[], opts?: { maxTokens?: number; temperature?: number }): AsyncIterable<string>;
}
