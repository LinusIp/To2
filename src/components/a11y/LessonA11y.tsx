"use client";
// Inclusive mode inside the lesson (docs/INCLUSIVE.md). Mounted by LessonPlayer with one line
// (// a11y-hook); renders nothing when no option is on. It only READS the lesson store and calls
// the engine's public actions — the lesson itself is unchanged.
//   • hearing: large live captions, the spoken word highlighted; a big "speaking / thinking /
//     listening" indicator; a vibration on every new step
//   • vision: the new board writing (and quiz options) are spoken when the tutor stops; "Doskani o'qib
//     berish" reads the whole board; everything also goes to the live region for screen readers
//   • motor: always-on voice commands while the lesson waits (browser recogniser), and the lesson mic
//     runs commands too (engine a11y-hook)
//   • focus: calm captions (one sentence at a time) and the chosen speech speed
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { t } from "@/i18n/uz";
import { useA11y, isCalm } from "@/lib/a11y/settings";
import { parseVoiceCommand, letterIndex, type VoiceCommand } from "@/lib/a11y/commands";
import { narrateBoard, narrateQuestion } from "@/lib/a11y/narrator";
import { announce, cue, sayAloud, stopSaying } from "@/lib/a11y/speech";
import { listenForCommands, recognitionSupported } from "@/lib/a11y/recognition";
import { claimListening, dispatchVoice } from "@/lib/a11y/bus";
import {
  a11yNowSpeaking,
  ask,
  continueLesson,
  explainAgain,
  pauseForBackground,
  replayStep,
  resumeFromBackground,
  setA11yCommandHook,
  setRate,
  submitAnswer,
  useLesson,
} from "@/lib/lesson/engine";

/** word index being spoken: words weighted by length (long words take longer to say) */
function wordAt(words: string[], frac: number): number {
  const total = words.reduce((n, w) => n + w.length + 1, 0);
  let acc = 0;
  const target = frac * total;
  for (let i = 0; i < words.length; i++) {
    acc += words[i].length + 1;
    if (acc >= target) return i;
  }
  return words.length - 1;
}

function LiveCaption({ calm }: { calm: boolean }) {
  const caption = useLesson((s) => s.caption);
  const status = useLesson((s) => s.player.status);
  const [frac, setFrac] = useState(-1);
  useEffect(() => {
    setFrac(-1);
    const id = window.setInterval(() => {
      const n = a11yNowSpeaking();
      if (!n || n.text !== caption || !n.dur) return setFrac(-1);
      setFrac(Math.min(1, n.pos / n.dur));
    }, 90);
    return () => window.clearInterval(id);
  }, [caption]);
  const speaking = status === "speaking" || status === "answering";
  // calm mode: one sentence at a time
  const sentences = useMemo(() => caption.match(/[^.!?…]+[.!?…]*\s*/g) ?? [caption], [caption]);
  let text = caption;
  let f = frac;
  if (calm && sentences.length > 1 && frac >= 0) {
    const lens = sentences.map((s) => s.length);
    const total = lens.reduce((a, b) => a + b, 0);
    let acc = 0;
    let i = 0;
    while (i < lens.length - 1 && acc + lens[i] < frac * total) acc += lens[i++];
    text = sentences[i];
    f = Math.min(1, (frac * total - acc) / lens[i]);
  }
  const words = text.split(/\s+/).filter(Boolean);
  const now = speaking && f >= 0 ? wordAt(words, f) : -1;
  if (!caption) return null;
  return (
    <p data-a11y-caption data-testid="a11y-caption" className="m-0 rounded-[18px] bg-[#141a3a] px-4 py-3.5 text-[24px] leading-[1.45] font-extrabold text-white md:text-[28px]" aria-hidden>
      {words.map((w, i) => (
        <span key={i} className={i === now ? "a11y-word-now" : i < now ? "opacity-100" : now >= 0 ? "opacity-70" : ""}>
          {w}{" "}
        </span>
      ))}
    </p>
  );
}

function Indicator() {
  const status = useLesson((s) => s.player.status);
  const writing = useLesson((s) => !!s.active && s.active.p < 1);
  const [label, color, icon] =
    status === "thinking"
      ? [t.a11y.thinking, "#6d3fe0", "M12 3a7 7 0 0 0-4 12.7V18h8v-2.3A7 7 0 0 0 12 3zM9 21h6"]
      : status === "listening" || status === "paused"
        ? [t.a11y.listening, "#b45309", "M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM5 11a7 7 0 0 0 14 0M12 18v3"]
        : status === "speaking" || status === "answering" || writing
          ? [t.a11y.speaking, "#2a5ce8", "M4 9v6h4l5 4V5L8 9zM16 9a4 4 0 0 1 0 6M19 6a8 8 0 0 1 0 12"]
          : [t.a11y.waiting, "#15803d", "M5 12l5 5 9-10"];
  return (
    <div role="status" data-testid="a11y-indicator" className="flex items-center gap-3 rounded-[18px] px-4 py-3 text-[18px] font-black text-white" style={{ background: color }}>
      <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d={icon} />
      </svg>
      {label}
    </div>
  );
}

const WAITING = new Set(["awaiting", "checking", "done"]);

export default function LessonA11y({ voice }: { voice: string }) {
  const router = useRouter();
  const a = useA11y();
  const calm = isCalm(a);
  const status = useLesson((s) => s.player.status);
  const mainIndex = useLesson((s) => s.mainIndex);
  const [pausedByVoice, setPausedByVoice] = useState(false);
  const [micOpen, setMicOpen] = useState(false);
  const [listenWanted, setListenWanted] = useState(true);
  const [heard, setHeard] = useState("");
  const narrated = useRef(new Set<string>());
  const quietUntil = useRef(0);

  // speech speed from the settings
  useEffect(() => {
    if (a.loaded) setRate(a.speechRate);
  }, [a.loaded, a.speechRate]);

  // ── commands (shared by the always-on recogniser and the lesson mic via the engine hook) ──
  const run = (c: VoiceCommand) => {
    const s = useLesson.getState();
    const st = s.player.status;
    switch (c.type) {
      case "continue":
        if (pausedByVoice || st === "paused") {
          setPausedByVoice(false);
          resumeFromBackground();
        } else if (st === "checking") continueLesson();
        else if (st === "awaiting") announce(t.a11y.answerByVoice);
        return;
      case "repeat":
        setPausedByVoice(false);
        replayStep();
        return;
      case "slower":
      case "faster": {
        const r = Math.round((a.speechRate + (c.type === "slower" ? -0.1 : 0.1)) * 100) / 100;
        a.set({ speechRate: Math.min(1.25, Math.max(0.75, r)) });
        return;
      }
      case "confused":
        if (st === "checking") explainAgain();
        else void ask("tushunmadim", true);
        return;
      case "answer": {
        const ch = s.expect?.kind === "choice" ? s.expect.choices?.[letterIndex(c.letter)] : undefined;
        if (st === "awaiting" && ch) void submitAnswer(ch);
        else if (!dispatchVoice(c)) announce(t.a11y.notCommand);
        return;
      }
      case "back":
        if (!dispatchVoice(c)) router.back();
        return;
      case "nextBuilding":
      case "prevBuilding":
      case "open":
        // town / game commands: whatever is on screen handles them ("to2:voice" event)
        dispatchVoice(c);
        return;
      case "home":
        router.push("/home");
        return;
      case "read":
        void speak(narrateBoard(s.board.els) || t.common.loading);
        return;
      case "stop":
        pauseForBackground();
        setPausedByVoice(true);
        return;
    }
  };
  const runRef = useRef(run);
  runRef.current = run;

  const speak = async (text: string) => {
    announce(text);
    if (!a.voiceFirst) return;
    quietUntil.current = Date.now() + 60_000;
    await sayAloud(text, voice);
    quietUntil.current = Date.now() + 700; // don't take our own narration for a command
  };

  // the lesson mic runs commands too
  useEffect(() => {
    if (!a.handsFree && !a.voiceFirst) return;
    setA11yCommandHook((text) => {
      const c = parseVoiceCommand(text);
      return c ? () => runRef.current(c) : null;
    });
    return () => setA11yCommandHook(null);
  }, [a.handsFree, a.voiceFirst]);

  // always-on listening while the lesson waits (never while the tutor talks: it would hear itself)
  // the lesson owns the mic while it is open: the app-wide listener must not hear the tutor
  useEffect(() => {
    if (!a.handsFree) return;
    return claimListening();
  }, [a.handsFree]);
  const canListen = (a.handsFree || a.voiceFirst) && recognitionSupported() && listenWanted && (WAITING.has(status) || pausedByVoice);
  useEffect(() => {
    if (!canListen) return;
    return listenForCommands((text) => {
      if (Date.now() < quietUntil.current) return;
      setHeard(text);
      const c = parseVoiceCommand(text);
      if (c) return runRef.current(c);
      // a real question (≥ 3 words) goes to the tutor; noise is ignored
      if (text.trim().split(/\s+/).length >= 3 && ["awaiting", "checking"].includes(useLesson.getState().player.status)) void ask(text, true);
      else announce(t.a11y.notCommand);
    }, setMicOpen);
  }, [canListen]);

  // new step: vibration + announcement
  const firstStep = useRef(true);
  useEffect(() => {
    if (status === "idle") return;
    if (firstStep.current) {
      firstStep.current = false;
      return;
    }
    if (a.vibrate) cue([40, 40, 40]);
    if (a.bigCaptions || a.voiceFirst) announce(t.a11y.newStep(mainIndex + 1));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mainIndex]);

  // voice-first: when the tutor stops, say what was newly written (+ the options of a question)
  useEffect(() => {
    if (!a.voiceFirst || !WAITING.has(status)) return;
    const s = useLesson.getState();
    const fresh = s.board.els.filter((e) => !narrated.current.has(e.key));
    fresh.forEach((e) => narrated.current.add(e.key));
    let text = fresh.length ? narrateBoard(fresh) : "";
    if (status === "awaiting" && s.expect?.kind === "choice" && s.expect.choices?.length) text += " " + narrateQuestion("", s.expect.choices).trim();
    if (text.trim()) void speak(text.trim());
    return () => stopSaying();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, a.voiceFirst]);

  const anyOn = a.bigCaptions || a.voiceFirst || a.handsFree || a.calm;
  if (!a.loaded || !anyOn || status === "idle") return null;

  return (
    <section aria-label={t.a11y.title} className="flex flex-col gap-2.5" data-testid="lesson-a11y">
      {(a.bigCaptions || a.handsFree || a.voiceFirst) && <Indicator />}
      {(a.bigCaptions || a.calm) && <LiveCaption calm={calm} />}
      {(a.voiceFirst || a.handsFree) && (
        <div className="flex flex-col gap-2">
          {a.voiceFirst && (
            <button type="button" className="btn w-full" onClick={() => run({ type: "read" })}>
              {t.a11y.readBoard}
            </button>
          )}
          {recognitionSupported() && (
            <button
              type="button"
              aria-pressed={listenWanted}
              onClick={() => setListenWanted((x) => !x)}
              className={`btn min-h-[64px] w-full text-[18px] ${micOpen ? "btn-primary" : ""}`}
            >
              {micOpen ? t.a11y.listenOn : t.a11y.listenOff}
            </button>
          )}
          <p className="m-0 text-center text-[13px] font-bold text-[#4a5275]">
            {heard ? t.a11y.heard(heard) + " · " : ""}
            {t.a11y.commands}
          </p>
        </div>
      )}
    </section>
  );
}
