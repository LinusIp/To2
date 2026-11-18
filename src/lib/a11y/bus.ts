// The "a11y:command" bus: voice commands are sent as window CustomEvents, so any screen (the town /
// roadmap world, the games) can act on them WITHOUT importing the inclusive mode, and the inclusive
// mode never imports those screens. Contract (stable, documented in docs/INCLUSIVE.md):
//
//   window.addEventListener("a11y:command", (e) => {
//     const { command } = (e as CustomEvent<A11yCommandDetail>).detail; // { type: "nextBuilding" } …
//     if (command.type === "open") { openSelected(); e.preventDefault(); } // preventDefault = "handled"
//   });
//
// Command types: nextBuilding · prevBuilding · open · back · answer {letter "A"–"D", index 0–3} ·
// continue · repeat · slower · faster · confused · home · read · stop.
// When no screen handles "back" / "home", the bus does it itself (history back / the home page).
import type { VoiceCommand } from "./commands";

export const A11Y_COMMAND_EVENT = "a11y:command";

export interface A11yCommandDetail {
  command: VoiceCommand;
  /** what was heard, for display */
  text: string;
}

/** Send a command to every listener. Returns true if a listener handled it (called preventDefault). */
export function dispatchA11yCommand(command: VoiceCommand, text = ""): boolean {
  if (typeof window === "undefined") return false;
  const ev = new CustomEvent<A11yCommandDetail>(A11Y_COMMAND_EVENT, { detail: { command, text }, cancelable: true });
  window.dispatchEvent(ev);
  return ev.defaultPrevented;
}

/** Listen for commands; return true from the handler to mark it handled. Returns the unsubscribe. */
export function onA11yCommand(handler: (command: VoiceCommand, text: string) => boolean | void): () => void {
  if (typeof window === "undefined") return () => {};
  const fn = (e: Event) => {
    const d = (e as CustomEvent<A11yCommandDetail>).detail;
    if (d?.command && handler(d.command, d.text) === true) e.preventDefault();
  };
  window.addEventListener(A11Y_COMMAND_EVENT, fn);
  return () => window.removeEventListener(A11Y_COMMAND_EVENT, fn);
}

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
