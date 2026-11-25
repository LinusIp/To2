"use client";
// Inclusive mode in the games (Blok minorasi, Tezkor hisob, Kasb sinovi via GameKit <Choices>;
// Juftini top via useCardVoice). Mounted by the shared game input layer, never by a scene:
//   • voice-first: the question and the numbered choices are read aloud with the DEVICE speech engine
//     only (0 VoiceLab credits: game lines are never cached, so /api/tts is not called at all)
//   • voice-first / hands-free: "javob bir…to'rt" / "javob A–D" arrive as "to2:voice" {command:"answer", n}
//     events from GlobalVoiceCommands and pick that button. The quiz page has its own submitter
//     (QuizA11y) and no <Choices>, so an answer is never submitted twice.
//   • no speech recognition on this browser (iOS Safari, many Androids): a clear line says so.
import { useEffect, useRef } from "react";
import { t } from "@/i18n/uz";
import { useA11y } from "@/lib/a11y/settings";
import { onVoice } from "@/lib/a11y/bus";
import { narrateGameQuestion } from "@/lib/a11y/narrator";
import { sayAloud, stopSaying } from "@/lib/a11y/speech";
import { recognitionSupported } from "@/lib/a11y/recognition";

export function GameVoice({ question, choices, disabled, onPick }: { question?: string; choices: string[]; disabled: boolean; onPick: (i: number) => void }) {
  const voiceFirst = useA11y((s) => s.loaded && s.voiceFirst);
  const handsFree = useA11y((s) => s.loaded && s.handsFree);
  const live = useRef({ disabled, onPick, n: choices.length });
  live.current = { disabled, onPick, n: choices.length };
  const key = `${question ?? ""}|${choices.join("|")}`;

  // read each new question aloud (device voice)
  useEffect(() => {
    if (!voiceFirst || !choices.length) return;
    void sayAloud(narrateGameQuestion(question ?? "", choices));
    return () => stopSaying();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voiceFirst, key]);

  // spoken answers
  useEffect(() => {
    if (!voiceFirst && !handsFree) return;
    return onVoice((d) => {
      const c = live.current;
      if (d.command !== "answer" || c.disabled || d.n > c.n) return false;
      c.onPick(d.n - 1);
      return true;
    });
  }, [voiceFirst, handsFree]);

  if (!voiceFirst && !handsFree) return null;
  const ok = recognitionSupported();
  return (
    <p
      className={`m-0 mt-2.5 rounded-[14px] px-3.5 py-2.5 text-[14px] font-extrabold ${ok ? "bg-soft text-ink" : "bg-[#fff4e8] text-[#9a3412]"}`}
      data-testid="game-voice-hint"
    >
      {ok ? t.a11y.gameHint : t.a11y.noRecognition}
    </p>
  );
}

/**
 * Juftini top (cards, not choices): voice-first reads every turned card aloud; "karta besh" flips
 * card 5 ("to2:voice" {command:"card", n}).
 */
export function useCardVoice(announceText: string, count: number, flipIndex: (i: number) => void) {
  const voiceFirst = useA11y((s) => s.loaded && s.voiceFirst);
  const handsFree = useA11y((s) => s.loaded && s.handsFree);
  const live = useRef({ count, flipIndex });
  live.current = { count, flipIndex };
  useEffect(() => {
    if (voiceFirst && announceText) void sayAloud(announceText);
  }, [voiceFirst, announceText]);
  useEffect(() => {
    if (!voiceFirst && !handsFree) return;
    return onVoice((d) => {
      if (d.command !== "card" || d.n < 1 || d.n > live.current.count) return false;
      live.current.flipIndex(d.n - 1);
      return true;
    });
  }, [voiceFirst, handsFree]);
  return voiceFirst || handsFree;
}

export function CardVoiceHint() {
  const ok = recognitionSupported();
  return (
    <p
      className={`m-0 mt-2.5 rounded-[14px] px-3.5 py-2.5 text-[14px] font-extrabold ${ok ? "bg-soft text-ink" : "bg-[#fff4e8] text-[#9a3412]"}`}
      data-testid="game-voice-hint"
    >
      {ok ? t.a11y.cardHint : t.a11y.noRecognition}
    </p>
  );
}
