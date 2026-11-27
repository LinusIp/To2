"use client";
// O'yinlar sound cues — a tiny Web Audio synth (no files, no VoiceLab, 0 credits). Every cue is a few
// oscillator notes with a short envelope, so it costs nothing to load and works offline.
// Sound is on by default and remembered per device (prefs "games-sound"); calm mode plays softer cues.
// Nothing here throws: no AudioContext (old browser, tests, autoplay block) → silent.
import { readPref, writePref } from "@/lib/client/prefs";

export type Cue = "tap" | "place" | "fall" | "right" | "wrong" | "combo" | "boost" | "stumble" | "flip" | "match" | "win" | "tick";

type Note = { f: number; at: number; dur: number; type?: OscillatorType; vol?: number; slide?: number };

/** the notes of each cue (pure; tested) */
export const CUES: Record<Cue, Note[]> = {
  tap: [{ f: 660, at: 0, dur: 0.05, type: "square", vol: 0.15 }],
  place: [{ f: 140, at: 0, dur: 0.12, type: "triangle", vol: 0.6, slide: 70 }, { f: 520, at: 0.02, dur: 0.06, type: "square", vol: 0.12 }],
  fall: [{ f: 520, at: 0, dur: 0.45, type: "triangle", vol: 0.35, slide: 90 }, { f: 90, at: 0.45, dur: 0.15, type: "triangle", vol: 0.5, slide: 50 }],
  right: [{ f: 660, at: 0, dur: 0.09, type: "square", vol: 0.18 }, { f: 990, at: 0.09, dur: 0.14, type: "square", vol: 0.18 }],
  wrong: [{ f: 260, at: 0, dur: 0.14, type: "triangle", vol: 0.3 }, { f: 200, at: 0.13, dur: 0.2, type: "triangle", vol: 0.3 }],
  combo: [523, 659, 784, 1047].map((f, i) => ({ f, at: i * 0.07, dur: 0.09, type: "square" as const, vol: 0.16 })),
  boost: [{ f: 300, at: 0, dur: 0.28, type: "sawtooth", vol: 0.12, slide: 900 }],
  stumble: [{ f: 180, at: 0, dur: 0.08, type: "square", vol: 0.2 }, { f: 140, at: 0.1, dur: 0.12, type: "square", vol: 0.2 }],
  flip: [{ f: 880, at: 0, dur: 0.04, type: "triangle", vol: 0.2, slide: 1200 }],
  match: [{ f: 784, at: 0, dur: 0.1, type: "triangle", vol: 0.3 }, { f: 1175, at: 0.1, dur: 0.18, type: "triangle", vol: 0.3 }],
  win: [523, 659, 784, 1047, 784, 1047].map((f, i) => ({ f, at: i * 0.11, dur: i === 5 ? 0.4 : 0.12, type: "square" as const, vol: 0.16 })),
  tick: [{ f: 1200, at: 0, dur: 0.03, type: "square", vol: 0.08 }],
};

let ctx: AudioContext | null = null;
function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx ??= new AC();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

export const soundOn = () => readPref("games-sound", "1") === "1";
export const setSoundOn = (on: boolean) => writePref("games-sound", on ? "1" : "0");

/** Play a cue. `soft` (calm mode) = quieter. */
export function play(cue: Cue, opts: { soft?: boolean } = {}) {
  if (!soundOn()) return;
  const a = audio();
  if (!a) return;
  try {
    const t0 = a.currentTime + 0.01;
    const master = a.createGain();
    master.gain.value = opts.soft ? 0.35 : 0.8;
    master.connect(a.destination);
    for (const n of CUES[cue]) {
      const o = a.createOscillator();
      const g = a.createGain();
      o.type = n.type ?? "sine";
      o.frequency.setValueAtTime(n.f, t0 + n.at);
      if (n.slide) o.frequency.exponentialRampToValueAtTime(n.slide, t0 + n.at + n.dur);
      const v = n.vol ?? 0.2;
      g.gain.setValueAtTime(0.0001, t0 + n.at);
      g.gain.exponentialRampToValueAtTime(v, t0 + n.at + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + n.at + n.dur);
      o.connect(g);
      g.connect(master);
      o.start(t0 + n.at);
      o.stop(t0 + n.at + n.dur + 0.02);
    }
  } catch {
    /* audio is a nice-to-have */
  }
}
