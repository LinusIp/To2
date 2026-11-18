"use client";
// Shared game chrome: top bar (× · title · score chip), a polite live region for the screen reader,
// the tutor's reaction (think → cheer, existing pose renders) and the end card with confetti.
import Link from "next/link";
import { useEffect, useState } from "react";
import { t } from "@/i18n/uz";
import { CloseIcon } from "@/components/ui/icons";
import QuizThinker from "@/components/lesson/QuizThinker";
import TutorPortrait from "@/components/characters/TutorPortrait";
import Confetti from "@/components/characters/Confetti";

export function GameFrame({ title, chip, calm, announce, children, testId }: { title: string; chip?: React.ReactNode; calm: boolean; announce: string; children: React.ReactNode; testId?: string }) {
  return (
    <main className={`mx-auto flex min-h-dvh max-w-[560px] flex-col bg-ph px-[18px] pt-3 pb-6 ${calm ? "game-calm" : ""}`} data-testid={testId}>
      <div className="flex h-[52px] items-center gap-3">
        <Link href="/games" aria-label={t.games.close} title={t.games.close} className="icon-btn bg-white">
          <CloseIcon />
        </Link>
        <h1 className="m-0 flex-1 text-[20px] font-black">{title}</h1>
        {chip}
      </div>
      {/* every question and result is read out; one region per game screen */}
      <div aria-live="polite" aria-atomic="true" className="sr-only" data-testid="game-live">
        {announce}
      </div>
      {children}
    </main>
  );
}

export function Chip({ children, tone = "blue" }: { children: React.ReactNode; tone?: "blue" | "gold" }) {
  return <span className={`rounded-full px-3 py-1.5 text-[14px] font-black ${tone === "gold" ? "bg-[#fff3d1] text-[#8a5a00]" : "bg-white text-blue shadow-[0_4px_12px_rgba(47,107,255,.12)]"}`}>{children}</span>;
}

/** The tutor reacting: thinking while you answer, cheering on a right answer, pointing at the hint. */
export function TutorReaction({ characterId, mood, bubble }: { characterId: string; mood: "think" | "cheer" | "hint"; bubble?: string }) {
  return (
    <div className="relative flex items-end justify-end gap-2">
      {bubble && (
        <div className="mb-10 max-w-[70%] rounded-[18px] rounded-br-[4px] bg-white px-3.5 py-2.5 text-[14px] font-extrabold text-[#3c4466] shadow-[0_6px_16px_rgba(20,40,100,.12)]" aria-hidden>
          {bubble}
        </div>
      )}
      {mood === "hint" ? (
        <TutorPortrait id={characterId} pose="point" frame="half" alt="" className="h-[140px] w-[130px] flex-none object-contain" style={{ objectPosition: "50% 100%" }} />
      ) : (
        <QuizThinker characterId={characterId} happy={mood === "cheer"} />
      )}
    </div>
  );
}

export function EndCard({ title, line, best, record, xp, characterId, calm, onAgain, extra }: { title: string; line: string; best: number; record: boolean; xp: number; characterId: string; calm: boolean; onAgain: () => void; extra?: React.ReactNode }) {
  const [burst, setBurst] = useState(0);
  useEffect(() => {
    if (!calm) setBurst(Date.now() % 100000);
  }, [calm]);
  return (
    <div className="card relative mt-3 flex flex-col items-center gap-2 overflow-visible p-5 text-center" role="status" data-testid="game-end">
      {!calm && <Confetti burst={burst} />}
      <TutorPortrait id={characterId} pose="cheer" frame="half" alt="" className="h-[150px] w-[150px] object-contain" />
      <div className="text-[26px] font-black">{title}</div>
      <div className="text-[16px] font-extrabold">{line}</div>
      {extra}
      <div className="mt-1 flex flex-wrap justify-center gap-2">
        {record && <Chip tone="gold">{t.games.newRecord}</Chip>}
        <Chip>{t.games.best(best)}</Chip>
        {xp > 0 && <Chip tone="gold">{t.games.xpEarned(xp)}</Chip>}
      </div>
      <button type="button" className="btn btn-primary mt-3 w-full" onClick={onAgain} autoFocus>
        {t.games.again}
      </button>
      <Link href="/games" className="btn w-full no-underline">
        {t.games.toGames}
      </Link>
    </div>
  );
}

/** Four big answer buttons; keys 1–4 also answer (keyboard play). */
export function Choices({ choices, onPick, disabled, picked, correct }: { choices: string[]; onPick: (i: number) => void; disabled: boolean; picked: number | null; correct: number | null }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (disabled || e.altKey || e.ctrlKey || e.metaKey) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      const i = Number(e.key) - 1;
      if (i >= 0 && i < choices.length) {
        e.preventDefault();
        onPick(i);
      }
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [choices.length, disabled, onPick]);
  return (
    <div className="grid grid-cols-2 gap-2.5" role="group" aria-label="Javoblar">
      {choices.map((c, i) => {
        const state = picked == null ? undefined : i === correct ? "right" : i === picked ? "wrong" : undefined;
        return (
          <button key={`${i}-${c}`} type="button" className="game-choice px-2" data-state={state} disabled={disabled} onClick={() => onPick(i)} aria-label={`${i + 1}: ${c}`} data-testid="game-choice">
            {c}
          </button>
        );
      })}
    </div>
  );
}
