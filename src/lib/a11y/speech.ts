// Output channels of the inclusive mode (browser only):
//  • announce() → the app-wide live region (screen readers: TalkBack, VoiceOver, NVDA read it)
//  • sayAloud() → spoken narration for voice-first mode. It NEVER generates new VoiceLab audio:
//    a line plays in the tutor's voice only if /api/tts?check=1 says it is already cached (0 credits);
//    otherwise the device's own speech synthesiser (uz-UZ, else tr/ru voice) reads it, else nothing
//    (the live region still carries the text).
//  • cue() → a short vibration (hard-of-hearing mode: "a new step started").
import { ttsUrl } from "@/lib/audio/player";
import { useA11y } from "./settings";

const LIVE_ID = "a11y-live";

/** Put text into the polite live region (cleared first so the same text is re-announced). */
export function announce(text: string) {
  if (typeof document === "undefined" || !text) return;
  const el = document.getElementById(LIVE_ID);
  if (!el) return;
  el.textContent = "";
  window.setTimeout(() => (el.textContent = text), 60);
}

let current: { stop(): void } | null = null;
/** the app is speaking a narration until this time: recognisers ignore what they hear meanwhile */
let quietUntil = 0;
export const narrating = () => Date.now() < quietUntil;

export function stopSaying() {
  current?.stop();
  current = null;
}

function pickVoice(): SpeechSynthesisVoice | null {
  const vs = window.speechSynthesis?.getVoices?.() ?? [];
  return vs.find((v) => v.lang.toLowerCase().startsWith("uz")) ?? vs.find((v) => v.lang.toLowerCase().startsWith("tr")) ?? null;
}

function saySynth(text: string, rate: number): Promise<void> {
  return new Promise((res) => {
    const ss = typeof window !== "undefined" ? window.speechSynthesis : undefined;
    if (!ss || typeof SpeechSynthesisUtterance === "undefined") return res();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "uz-UZ";
    const v = pickVoice();
    if (v) u.voice = v;
    u.rate = rate;
    u.onend = u.onerror = () => res();
    current = { stop: () => (ss.cancel(), res()) };
    ss.cancel();
    ss.speak(u);
  });
}

/** Speak a narration line. Cached tutor voice if available (free), else the device voice. */
export async function sayAloud(text: string, voice?: string): Promise<void> {
  if (typeof window === "undefined" || !text.trim()) return;
  stopSaying();
  quietUntil = Date.now() + 60_000;
  try {
    await sayInner(text, voice);
  } finally {
    quietUntil = Date.now() + 700; // the tail of our own voice is not a command
  }
}

async function sayInner(text: string, voice?: string): Promise<void> {
  const rate = useA11y.getState().speechRate;
  if (voice) {
    try {
      const r = await fetch(ttsUrl(text, voice) + "&check=1", { cache: "no-store" });
      const j = (await r.json()) as { cached?: boolean };
      if (j.cached) {
        const a = new Audio(ttsUrl(text, voice));
        a.playbackRate = rate;
        await new Promise<void>((res) => {
          a.onended = a.onerror = () => res();
          current = { stop: () => (a.pause(), res()) };
          void a.play().catch(() => res());
        });
        return;
      }
    } catch {
      /* fall through to the device voice */
    }
  }
  await saySynth(text, rate);
}

/** Vibration cue (Android; iOS has no vibrate API → the visual indicator is the cue there). */
export function cue(pattern: number | number[] = 60) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* unsupported */
  }
}
