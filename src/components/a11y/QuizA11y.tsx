"use client";
// Inclusive mode on quiz screens (practice + diagnostic): in voice-first mode the question and its
// options are read aloud ("A javob: …"); in voice-first / hands-free mode the learner answers by voice
// ("javob B", "be", "birinchisi"), "qaytar" repeats, "bosh sahifa" leaves. No time limits anywhere.
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { t } from "@/i18n/uz";
import { useA11y } from "@/lib/a11y/settings";
import { letterIndex, parseVoiceCommand } from "@/lib/a11y/commands";
import { narrateQuestion } from "@/lib/a11y/narrator";
import { announce, sayAloud, stopSaying } from "@/lib/a11y/speech";
import { listenForCommands, recognitionSupported } from "@/lib/a11y/recognition";

export default function QuizA11y({
  questionKey,
  question,
  choices,
  voice,
  onAnswer,
  busy,
  skipQuestion = false,
}: {
  questionKey: string;
  question: string;
  choices?: string[];
  voice: string;
  onAnswer: (value: string) => void;
  busy?: boolean;
  /** the tutor already reads the question (diagnostic): only the options are narrated, after it */
  skipQuestion?: boolean;
}) {
  const router = useRouter();
  const a = useA11y();
  const [heard, setHeard] = useState("");
  const [micOpen, setMicOpen] = useState(false);
  const quietUntil = useRef(0);
  const text = skipQuestion ? (choices?.length ? narrateQuestion("", choices).trim() : t.a11y.answerByVoice) : narrateQuestion(question, choices);

  const read = async () => {
    announce(text);
    if (!a.voiceFirst) return;
    quietUntil.current = Date.now() + 60_000;
    await sayAloud(text, voice);
    quietUntil.current = Date.now() + 700;
  };
  const readRef = useRef(read);
  readRef.current = read;

  useEffect(() => {
    if (!a.loaded || !question) return;
    const id = window.setTimeout(() => void readRef.current(), skipQuestion ? 3500 : 0);
    return () => {
      window.clearTimeout(id);
      stopSaying();
    };
  }, [a.loaded, questionKey, question]);

  const onText = useRef((s: string) => {});
  onText.current = (s: string) => {
    if (Date.now() < quietUntil.current || busy) return;
    setHeard(s);
    const c = parseVoiceCommand(s);
    if (!c) {
      // a spoken number answers a number question ("12", "3/4" — what the recogniser writes)
      const v = s.trim().replace(/\s+/g, "");
      if (!choices?.length && /^-?\d+([.,/]\d+)?$/.test(v)) return onAnswer(v);
      return announce(t.a11y.notCommand);
    }
    if (c.type === "answer" && choices?.[letterIndex(c.letter)]) onAnswer(choices[letterIndex(c.letter)]);
    else if (c.type === "repeat" || c.type === "read") void readRef.current();
    else if (c.type === "home") router.push("/home");
    else announce(t.a11y.answerByVoice);
  };

  const listening = (a.voiceFirst || a.handsFree) && recognitionSupported();
  useEffect(() => {
    if (!listening) return;
    return listenForCommands((s) => onText.current(s), setMicOpen);
  }, [listening]);

  if (!a.loaded || !(a.voiceFirst || a.handsFree)) return null;
  return (
    <div className="card flex flex-col gap-2 p-3.5" data-testid="quiz-a11y">
      <button type="button" className="btn w-full" onClick={() => void read()}>
        {t.a11y.readBoard}
      </button>
      <p className="m-0 text-center text-[13px] font-bold text-[#4a5275]" role="status">
        {micOpen ? t.a11y.listenOn : t.a11y.answerByVoice}
        {heard ? ` · ${t.a11y.heard(heard)}` : ""}
      </p>
    </div>
  );
}
