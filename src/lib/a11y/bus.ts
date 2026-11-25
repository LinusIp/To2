// The "to2:voice" bus: hands-free voice commands are sent as window CustomEvents, so other screens
// (the town in feat/roadmap, the games in feat/games) act on them WITHOUT importing the inclusive mode,
// and the inclusive mode imports nothing from them. Wire format (agreed with feat/roadmap's TownScreen):
//
//   window.addEventListener("to2:voice", (e) => {
//     const d = (e as CustomEvent).detail; // { command: "next" | "prev" | "open" | "back" | "continue" | "home" }
//                                          // or, for game answers, { command: "answer", n: 1 | 2 | 3 | 4 }
//   });
//
// A listener MAY call e.preventDefault() to say "handled"; then the app skips its own fallback for
// "back" / "home" (GlobalVoiceCommands).
import type { VoiceCommand } from "./commands";

export const VOICE_EVENT = "to2:voice";

export type VoiceDetail =
  | { command: "next" | "prev" | "open" | "back" | "continue" | "home" }
  | { command: "answer"; n: 1 | 2 | 3 | 4 }
  /** Juftini top: flip card n (1–20) */
  | { command: "card"; n: number };

/** Parsed command → the wire detail; null = not a command other screens know (it isn't sent). */
export function toVoiceDetail(c: VoiceCommand): VoiceDetail | null {
  switch (c.type) {
    case "nextBuilding":
      return { command: "next" };
    case "prevBuilding":
      return { command: "prev" };
    case "open":
    case "back":
    case "continue":
    case "home":
      return { command: c.type };
    case "card":
      return { command: "card", n: c.n };
    case "answer":
      return c.index >= 0 && c.index <= 3 ? { command: "answer", n: (c.index + 1) as 1 | 2 | 3 | 4 } : null;
    default:
      return null;
  }
}

/** Send a command to every listener. Returns true if a listener called preventDefault (handled). */
export function dispatchVoice(c: VoiceCommand): boolean {
  if (typeof window === "undefined") return false;
  const detail = toVoiceDetail(c);
  if (!detail) return false;
  const ev = new CustomEvent<VoiceDetail>(VOICE_EVENT, { detail, cancelable: true });
  window.dispatchEvent(ev);
  return ev.defaultPrevented;
}

/** Listen for voice commands; return true from the handler to mark one handled. Returns the unsubscribe. */
export function onVoice(handler: (d: VoiceDetail) => boolean | void): () => void {
  if (typeof window === "undefined") return () => {};
  const fn = (e: Event) => {
    const d = (e as CustomEvent<VoiceDetail>).detail;
    if (d?.command && handler(d) === true) e.preventDefault();
  };
  window.addEventListener(VOICE_EVENT, fn);
  return () => window.removeEventListener(VOICE_EVENT, fn);
}

/** Screens that handle "back" / "home" themselves without preventDefault (feat/roadmap TownScreen). */
export const handlesBackItself = (path: string) => /^\/town\//.test(path);

// ── who owns the microphone ─────────────────────────────────────────────────────────────────
// The lesson and quiz screens run their own recogniser; the app-wide one (A11yRoot) pauses meanwhile.
let claims = 0;
const subs = new Set<() => void>();
export function claimListening(): () => void {
  claims++;
  subs.forEach((f) => f());
  let done = false;
  return () => {
    if (done) return;
    done = true;
    claims--;
    subs.forEach((f) => f());
  };
}
export const listeningClaimed = () => claims > 0;
export function onClaimsChange(f: () => void): () => void {
  subs.add(f);
  return () => void subs.delete(f);
}
