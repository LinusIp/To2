"use client";
// Shared game chrome: top bar (× · title · score chip), a polite live region for the screen reader,
// the tutor's reaction (think → cheer, existing pose renders) and the end card with confetti.
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { t } from "@/i18n/uz";
import { CloseIcon } from "@/components/ui/icons";
import QuizThinker from "@/components/lesson/QuizThinker";
import TutorPortrait from "@/components/characters/TutorPortrait";
import Confetti from "@/components/characters/Confetti";
import { GameVoice } from "@/components/a11y/GameVoice"; // a11y-hook: voice-first + hands-free answers
import type { Pose } from "@/components/characters/voxel";
import { play, setSoundOn, soundOn } from "@/lib/games/sfx";

export function GameFrame({ title, chip, calm, announce, children, testId, bleed = false, xp, xpFly }: {
  title: string;
  chip?: React.ReactNode;
  calm: boolean;
  announce: string;
  children: React.ReactNode;
  testId?: string;
  /** full-bleed play area (the game draws its own scene edge to edge); default = padded column */
  bleed?: boolean;
  /** XP counter in the top bar (the +XP flies into it) */
  xp?: number;
  /** bump `key` to fly "+amount XP" from the scene centre (or `from`, viewport px) to the counter */
  xpFly?: { key: number; amount: number; from?: { x: number; y: number } } | null;
}) {
  const counter = useRef<HTMLSpanElement>(null);
  return (
    <main className={`mx-auto flex min-h-dvh max-w-[560px] flex-col bg-ph ${bleed ? "" : "px-[18px] pb-6"} pt-3 ${calm ? "game-calm" : ""}`} data-testid={testId}>
      <div className={`flex h-[52px] flex-none items-center gap-2.5 ${bleed ? "px-[14px]" : ""}`}>
        <Link href="/games" aria-label={t.games.close} title={t.games.close} className="icon-btn bg-white">
          <CloseIcon />
        </Link>
        <h1 className="m-0 min-w-0 flex-1 truncate text-[19px] font-black">{title}</h1>
        {chip}
        {xp != null && (
          <span ref={counter} className="xp-counter rounded-full bg-[#fff3d1] px-2.5 py-1.5 text-[14px] font-black whitespace-nowrap text-[#8a5a00]" data-testid="game-xp" aria-label={t.games.xpEarned(xp)}>
            {xp} XP
          </span>
        )}
        <SoundToggle />
      </div>
      {/* every question and result is read out; one region per game screen */}
      <div aria-live="polite" aria-atomic="true" className="sr-only" data-testid="game-live">
        {announce}
      </div>
      {children}
      {xpFly && xpFly.amount > 0 && <XpFly key={xpFly.key} amount={xpFly.amount} from={xpFly.from} to={counter} calm={calm} />}
    </main>
  );
}

/** Sound on/off (Web Audio cues), remembered per device. */
export function SoundToggle() {
  const [on, setOn] = useState(true);
  useEffect(() => setOn(soundOn()), []);
  return (
    <button
      type="button"
      className="icon-btn bg-white"
      aria-pressed={on}
      aria-label={on ? t.games.soundOff : t.games.soundOn}
      title={on ? t.games.soundOff : t.games.soundOn}
      onClick={() => {
        setSoundOn(!on);
        setOn(!on);
        if (!on) play("tap");
      }}
      data-testid="game-sound"
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M4 9v6h4l5 4V5L8 9z" fill="currentColor" />
        {on ? <path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" /> : <path d="M17 9l5 6M22 9l-5 6" />}
      </svg>
    </button>
  );
}

/** "+5 XP" flying from the scene into the top-bar counter (calm: appears by the counter, no flight). */
function XpFly({ amount, from, to, calm }: { amount: number; from?: { x: number; y: number }; to: React.RefObject<HTMLSpanElement | null>; calm: boolean }) {
  const [style, setStyle] = useState<React.CSSProperties | null>(null);
  useEffect(() => {
    const r = to.current?.getBoundingClientRect();
    const x0 = from?.x ?? window.innerWidth / 2;
    const y0 = from?.y ?? window.innerHeight * 0.45;
    const x1 = r ? r.left + r.width / 2 : window.innerWidth - 60;
    const y1 = r ? r.top + r.height / 2 : 30;
    setStyle(calm ? { left: x1, top: y1 + 26 } : ({ left: x0, top: y0, "--dx": `${x1 - x0}px`, "--dy": `${y1 - y0}px` } as React.CSSProperties));
    const tm = setTimeout(() => {
      const el = to.current;
      if (!el) return;
      el.classList.remove("xp-bump");
      void el.offsetWidth;
      el.classList.add("xp-bump");
    }, calm ? 0 : 650);
    return () => clearTimeout(tm);
  }, [from, to, calm]);
  if (!style) return null;
  return (
    <span className={`xp-fly ${calm ? "xp-fly-calm" : ""}`} style={style} aria-hidden data-testid="xp-fly">
      +{amount} XP
    </span>
  );
}

/** The tutor standing full-body on the scene's ground; `act` = a short body reaction. */
export function FullTutor({ id, pose, act, className, style }: { id: string; pose: Pose; act?: "place" | "wobble" | "cheer" | "run" | null; className?: string; style?: React.CSSProperties }) {
  return (
    <div className={`full-tutor ${act ? `ft-${act}` : ""} ${className ?? ""}`} style={style} aria-hidden data-testid="game-tutor" data-pose={pose}>
      <TutorPortrait id={id} pose={pose} frame="full" alt="" className="h-full w-full object-contain" style={{ objectPosition: "50% 100%" }} />
    </div>
  );
}

/** A speech bubble inside the scene (captions; no voice lines). */
export function Bubble({ children, className, tail = "left" }: { children: React.ReactNode; className?: string; tail?: "left" | "right" | "down" }) {
  return (
    <div className={`scene-bubble tail-${tail} ${className ?? ""}`} aria-hidden>
      {children}
    </div>
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

export function EndCard({ title, line, best, record, xp, characterId, calm, onAgain, extra, hideTutor = false }: { title: string; line: string; best: number; record: boolean; xp: number; characterId: string; calm: boolean; onAgain: () => void; extra?: React.ReactNode; /** the scene already shows the tutor cheering */ hideTutor?: boolean }) {
  const [burst, setBurst] = useState(0);
  useEffect(() => {
    if (!calm) setBurst(Date.now() % 100000);
  }, [calm]);
  return (
    <div className={`relative flex flex-col items-center gap-2 overflow-visible text-center ${hideTutor ? "pt-1" : "card mt-3 p-5"}`} role="status" data-testid="game-end">
      {!calm && <Confetti burst={burst} />}
      {!hideTutor && (
      <div className="relative flex h-[150px] w-[150px] items-end justify-center">
        <span className="absolute inset-x-3 bottom-0 h-2 rounded-full bg-[#dfe6fa]" aria-hidden />
        <FullTutor id={characterId} pose="cheer" act={calm ? null : "cheer"} className="relative h-[150px] w-[120px]" />
      </div>
      )}
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

/**
 * The answer buttons; keys 1–4 also answer (keyboard play). Looks per game (G3):
 *   grid   — 2×2 white cards (Kasb sinovi)
 *   blocks — chunky voxel blocks in the tray, tapped onto the tower (Blok minorasi)
 *   lanes  — race-track pads (Tezkor hisob)
 * Same markup for all: data-testid="game-choice", data-state right/wrong, aria-label "n: answer", and
 * <GameVoice/> mounted here (a11y-hook: questions read aloud, "javob n" via the to2:voice event).
 */
export function Choices({ choices, onPick, disabled, picked, correct, question, variant = "grid" }: { choices: string[]; onPick: (i: number) => void; disabled: boolean; picked: number | null; correct: number | null; /** read aloud in voice-first mode */ question?: string; variant?: "grid" | "blocks" | "lanes" }) {
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
  const cls = variant === "blocks" ? "game-choice vx-choice" : variant === "lanes" ? "game-choice lane-choice" : "game-choice";
  return (
    <>
      <div className={`grid grid-cols-2 ${variant === "grid" ? "gap-2.5" : "gap-2"}`} role="group" aria-label="Javoblar">
        {choices.map((c, i) => {
          const state = picked == null ? undefined : i === correct ? "right" : i === picked ? "wrong" : undefined;
          return (
            <button key={`${i}-${c}`} type="button" className={`${cls} px-2`} data-state={state} data-i={i % 4} disabled={disabled} onClick={() => onPick(i)} aria-label={`${i + 1}: ${c}`} data-testid="game-choice">
              {variant !== "grid" && (
                <span className="choice-key" aria-hidden>
                  {i + 1}
                </span>
              )}
              <span className="choice-text">{c}</span>
            </button>
          );
        })}
      </div>
      <GameVoice question={question} choices={choices} disabled={disabled} onPick={onPick} />
    </>
  );
}
