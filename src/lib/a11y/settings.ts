// "Inklyuziv rejim" settings (docs/INCLUSIVE.md). Per device, in localStorage (no account data: a
// disability is sensitive personal data — it never leaves the phone). Four presets switch groups of
// options on; every option can also be toggled on its own in Sozlamalar → Qulaylik.
// prefers-reduced-motion / prefers-contrast are respected automatically (applyA11y), even with no settings.
import { create } from "zustand";

export type PresetId = "vision" | "hearing" | "motor" | "focus";

export interface A11ySettings {
  /** blind / low vision: board + quiz are spoken, answers by voice */
  voiceFirst: boolean;
  highContrast: boolean;
  /** 1 = normal, 1.5 = 150 % */
  textScale: 1 | 1.25 | 1.5;
  /** hard of hearing: large word-by-word captions + visual speaking/thinking indicator */
  bigCaptions: boolean;
  /** vibration cue on each new step (navigator.vibrate) */
  vibrate: boolean;
  /** motor: hands-free voice commands while the lesson waits */
  handsFree: boolean;
  /** tap targets ≥ 56 px */
  bigTargets: boolean;
  /** attention: no bouncing / confetti / parallax, one sentence at a time in the captions */
  calm: boolean;
  /** dyslexia-friendly font + wider letter/word/line spacing */
  dyslexiaFont: boolean;
  /** tutor speech speed 0.75–1.25 */
  speechRate: number;
  /** presets the learner picked (for the UI) */
  presets: PresetId[];
  /** the "Sizga qanday qulay?" question was answered or skipped */
  asked: boolean;
}

export const DEFAULTS: A11ySettings = {
  voiceFirst: false,
  highContrast: false,
  textScale: 1,
  bigCaptions: false,
  vibrate: false,
  handsFree: false,
  bigTargets: false,
  calm: false,
  dyslexiaFont: false,
  speechRate: 1,
  presets: [],
  asked: false,
};

/** what each preset switches on */
export const PRESETS: Record<PresetId, Partial<A11ySettings>> = {
  vision: { voiceFirst: true, highContrast: true, textScale: 1.5, bigTargets: true },
  hearing: { bigCaptions: true, vibrate: true },
  motor: { handsFree: true, bigTargets: true },
  focus: { calm: true, dyslexiaFont: true, speechRate: 0.9 },
};

export const RATE_MIN = 0.75;
export const RATE_MAX = 1.25;
export const clampRate = (r: number) => Math.round(Math.min(RATE_MAX, Math.max(RATE_MIN, Number.isFinite(r) ? r : 1)) * 100) / 100;

/** Pure: settings after turning a preset on/off. Turning off resets only the options no other chosen preset needs. */
export function togglePreset(s: A11ySettings, id: PresetId): A11ySettings {
  const on = !s.presets.includes(id);
  const presets = on ? [...s.presets, id] : s.presets.filter((p) => p !== id);
  if (on) return { ...s, ...PRESETS[id], presets, asked: true };
  const next: A11ySettings = { ...s, presets, asked: true };
  for (const k of Object.keys(PRESETS[id]) as (keyof A11ySettings)[]) {
    const keep = presets.some((p) => k in PRESETS[p]);
    if (!keep) (next as unknown as Record<string, unknown>)[k] = DEFAULTS[k];
  }
  return next;
}

const KEY = "to2-a11y";

export function loadSettings(): A11ySettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    const j = JSON.parse(raw) as Partial<A11ySettings>;
    return { ...DEFAULTS, ...j, speechRate: clampRate(j.speechRate ?? 1) };
  } catch {
    return { ...DEFAULTS };
  }
}

function save(s: A11ySettings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* blocked storage: settings last for this visit */
  }
}

interface Store extends A11ySettings {
  loaded: boolean;
  /** OS-level preferences (read live) */
  osReducedMotion: boolean;
  osMoreContrast: boolean;
  set(p: Partial<A11ySettings>): void;
  toggle(id: PresetId): void;
  hydrate(): void;
}

export const useA11y = create<Store>((setS, get) => ({
  ...DEFAULTS,
  loaded: false,
  osReducedMotion: false,
  osMoreContrast: false,
  set(p) {
    setS(p);
    save(pick(get()));
  },
  toggle(id) {
    const next = togglePreset(pick(get()), id);
    setS(next);
    save(next);
  },
  hydrate() {
    if (get().loaded) return;
    setS({ ...loadSettings(), loaded: true });
  },
}));

export function pick(s: A11ySettings): A11ySettings {
  const o = {} as Record<string, unknown>;
  for (const k of Object.keys(DEFAULTS)) o[k] = (s as unknown as Record<string, unknown>)[k];
  return o as unknown as A11ySettings;
}

/** calm = the learner's calm mode OR the OS "reduce motion" setting */
export const isCalm = (s: Pick<Store, "calm" | "osReducedMotion">) => s.calm || s.osReducedMotion;
export const isHighContrast = (s: Pick<Store, "highContrast" | "osMoreContrast">) => s.highContrast || s.osMoreContrast;

/** Outside React (Confetti, three.js animator): is motion to be reduced right now? */
export function reduceMotionNow(): boolean {
  if (typeof document === "undefined") return false;
  if (document.documentElement.dataset.calm === "1") return true;
  return typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

/** Mirror the settings onto <html data-*> so globals.css can restyle the whole app. */
export function applyA11y(s: Store) {
  const d = document.documentElement.dataset;
  const flag = (k: string, on: boolean) => (on ? (d[k] = "1") : delete d[k]);
  flag("calm", isCalm(s));
  flag("contrast", isHighContrast(s));
  flag("big", s.bigTargets);
  flag("dyslexia", s.dyslexiaFont);
  flag("captions", s.bigCaptions);
  if (s.textScale !== 1) d.text = String(Math.round(s.textScale * 100));
  else delete d.text;
}
