// Prosody for VoiceLab TTS (no emotion param on v1; v2 "Expressive" takes speech tags).
// A segment's `say` is split into clips; each clip gets its own speed (and tag on lison-v2),
// and the clips are joined with silences sized by the punctuation. Pure + unit-tested.
import type { Emotion } from "./schema";

export type TtsModel = "lison" | "lison-v2";

export interface Clip {
  text: string;
  speed: number;
  /** speech tag prefix for lison-v2 ("" for none) */
  tag: string;
  /** silence after this clip, ms */
  pauseAfter: number;
}

export interface ProsodyPlan {
  lead: number; // silence before the first clip, ms
  clips: Clip[];
}

export const EMOTION_SPEED: Record<Emotion, number> = { neutral: 1.0, happy: 1.06, excited: 1.12, encouraging: 0.97, thinking: 0.9 };
/** lison-v2 tags (measured: [excited] raises pitch a lot, [calm] lowers it); thinking/neutral stay untagged */
export const EMOTION_TAG: Record<Emotion, string> = { neutral: "", happy: "[happy]", excited: "[excited]", encouraging: "[calm]", thinking: "" };
export const PAUSE = { comma: 180, stop: 320, ellipsis: 450 } as const;
export const QUESTION_SPEED = 0.95;
export const ANSWER_LEAD_MS = 250;

/** Short leading clause before a comma ("Voy,", "Hechqisi yo'q,") = interjection → own clip + pause. */
const MAX_INTERJECTION_WORDS = 2;

/** Normalise "..." → "…" and squeeze spaces. */
const tidy = (s: string) => s.replace(/\.{3,}/g, "…").replace(/\s+/g, " ").trim();

/** Split into clips: at . ! ? … always, and after a short interjection followed by a comma. */
export function splitSpeech(say: string): { text: string; end: "," | "." | "!" | "?" | "…" | "" }[] {
  const out: { text: string; end: "," | "." | "!" | "?" | "…" | "" }[] = [];
  const s = tidy(say);
  // sentence pieces, keeping the terminator (runs like "?!" count as one)
  const re = /[^.!?…]+(?:[.!?…]+|$)/g;
  for (const m of s.match(re) ?? []) {
    let piece = m.trim();
    if (!piece) continue;
    // interjection at the start: "Voy, zo'r!" → "Voy," + "zo'r!"
    const c = piece.indexOf(",");
    if (c > 0) {
      const head = piece.slice(0, c).trim();
      const rest = piece.slice(c + 1).trim();
      if (rest && head.split(/\s+/).length <= MAX_INTERJECTION_WORDS && /[\p{L}]/u.test(rest)) {
        out.push({ text: head + ",", end: "," });
        piece = rest;
      }
    }
    const last = piece[piece.length - 1];
    const end = last === "…" ? "…" : last === "?" || piece.endsWith("?!") ? "?" : last === "!" ? "!" : last === "." ? "." : "";
    out.push({ text: piece, end });
  }
  return out;
}

export function prosodyPlan(say: string, emotion: Emotion, model: TtsModel, baseSpeed: number, opts: { answerLead?: boolean } = {}): ProsodyPlan {
  const parts = splitSpeech(say);
  const base = baseSpeed * (EMOTION_SPEED[emotion] ?? 1);
  const tag = model === "lison-v2" ? (EMOTION_TAG[emotion] ?? "") : "";
  const clips: Clip[] = parts.map((p, i) => {
    const lastQ = i === parts.length - 1 && p.end === "?";
    const speed = clampSpeed(base * (lastQ ? QUESTION_SPEED : 1));
    const pauseAfter = i === parts.length - 1 ? 0 : p.end === "," ? PAUSE.comma : p.end === "…" ? PAUSE.ellipsis : PAUSE.stop;
    return { text: p.text, speed, tag, pauseAfter };
  });
  return { lead: opts.answerLead ? ANSWER_LEAD_MS : 0, clips };
}

/** VoiceLab accepts 0.5–2.0; round to 0.01 so cache keys stay stable. */
export const clampSpeed = (v: number) => Math.round(Math.min(2, Math.max(0.5, v)) * 100) / 100;

/** What we send to VoiceLab for one clip. */
export const clipText = (c: Clip) => (c.tag ? `${c.tag} ${c.text}` : c.text);
