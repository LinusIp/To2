// Lesson player state machine (CLAUDE.md §3 "barge-in").
//   idle → speaking → paused → listening → thinking → answering → checking → (resume) speaking
// plus `awaiting` (an `ask` segment waits for the learner's answer) and `done`.
// Pure: the engine (src/lib/lesson/engine.ts) performs side effects for each state.

export type PlayerStatus =
  | "idle"
  | "speaking" // main lesson segment playing (audio + chalk)
  | "awaiting" // main `ask` segment finished, waiting for the learner's answer
  | "paused" // learner barged in; everything frozen
  | "listening" // mic is recording / learner typing
  | "thinking" // question sent to /api/tutor, waiting
  | "answering" // tutor is playing the interrupt answer on the note layer
  | "checking" // "Tushunarli bo'ldimi?" — [Davom et] / [Yana tushuntir]
  | "done";

export interface PlayerState {
  status: PlayerStatus;
  /** what we return to after the interruption is resolved */
  resumeTo: "speaking" | "awaiting" | null;
  /** 0 = normal lesson, 1 = inside an interruption answer (max nesting 1) */
  depth: 0 | 1;
}

export type PlayerEvent =
  | { type: "START" }
  | { type: "SEGMENT_END"; nextIsAsk?: boolean; isLast?: boolean }
  | { type: "ASK_REACHED" }
  | { type: "ANSWER_CORRECT" }
  | { type: "BARGE_IN" } // mic pressed / typing started
  | { type: "LISTEN" }
  | { type: "CANCEL" } // learner released mic without a question
  | { type: "QUESTION_SENT" }
  | { type: "REPLY_READY" }
  | { type: "REPLY_FAILED" }
  | { type: "REPLY_END" } // last note segment (the check) finished
  | { type: "CONTINUE" } // [Davom et]
  | { type: "EXPLAIN_AGAIN" } // [Yana tushuntir]
  | { type: "FINISH" }
  | { type: "RESET" };

export const initialPlayer: PlayerState = { status: "idle", resumeTo: null, depth: 0 };

const INTERRUPTIBLE: PlayerStatus[] = ["speaking", "awaiting", "answering", "checking"];

export function canBargeIn(s: PlayerState): boolean {
  return INTERRUPTIBLE.includes(s.status);
}

export function transition(s: PlayerState, e: PlayerEvent): PlayerState {
  switch (e.type) {
    case "RESET":
      return initialPlayer;
    case "START":
      return s.status === "idle" || s.status === "done" ? { status: "speaking", resumeTo: null, depth: 0 } : s;
    case "SEGMENT_END":
      if (s.status !== "speaking") return s;
      if (e.isLast) return { ...s, status: "done" };
      return s; // engine moves to the next segment; stays speaking
    case "ASK_REACHED":
      return s.status === "speaking" ? { ...s, status: "awaiting" } : s;
    case "ANSWER_CORRECT":
      return s.status === "awaiting" ? { ...s, status: "speaking" } : s;
    case "BARGE_IN": {
      if (!canBargeIn(s)) return s;
      // Interrupting the tutor's answer keeps the ORIGINAL resume point (nesting max 1).
      const inside = s.status === "answering" || s.status === "checking";
      return {
        status: "paused",
        resumeTo: inside ? s.resumeTo : (s.status as "speaking" | "awaiting"),
        depth: inside ? 1 : 0,
      };
    }
    case "LISTEN":
      return s.status === "paused" ? { ...s, status: "listening" } : s;
    case "CANCEL":
      if (s.status !== "paused" && s.status !== "listening") return s;
      return { status: s.resumeTo ?? "speaking", resumeTo: null, depth: 0 };
    case "QUESTION_SENT":
      return s.status === "listening" || s.status === "paused" || s.status === "checking" ? { ...s, status: "thinking" } : s;
    case "REPLY_READY":
      return s.status === "thinking" ? { ...s, status: "answering" } : s;
    case "REPLY_FAILED":
      return s.status === "thinking" ? { status: s.resumeTo ?? "speaking", resumeTo: null, depth: 0 } : s;
    case "REPLY_END":
      return s.status === "answering" ? { ...s, status: "checking" } : s;
    case "CONTINUE":
      if (s.status !== "checking" && s.status !== "answering") return s;
      return { status: s.resumeTo ?? "speaking", resumeTo: null, depth: 0 };
    case "EXPLAIN_AGAIN":
      return s.status === "checking" ? { ...s, status: "thinking" } : s;
    case "FINISH":
      return { ...s, status: "done" };
  }
}
