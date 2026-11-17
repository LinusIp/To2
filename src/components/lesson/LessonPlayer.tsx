"use client";
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Keyboard, Lightbulb, Play, RotateCcw, Send, Volume2, VolumeX } from "lucide-react";
import { t } from "@/i18n/uz";
import { getSkill } from "@/data/skills";
import { getCharacter, type CharacterId } from "@/config/characters";
import { useMe } from "@/lib/client/me";
import {
  ask,
  bargeIn,
  continueLesson,
  disposeLesson,
  explainAgain,
  initLesson,
  replayStep,
  setMuted,
  setRate,
  showMe,
  startLesson,
  startListening,
  stopListening,
  submitAnswer,
  useLesson,
} from "@/lib/lesson/engine";
import Character, { type CharacterState } from "@/components/characters/Character";
import Confetti from "@/components/characters/Confetti";
import { LevelRow, StepPips, StreakChip, Wave } from "@/components/ui/hud";
import AnswerInput from "./AnswerInput";
import MicButton from "./MicButton";

// Code-split the board (rough.js + chalk renderer) to keep first paint small on phones.
const Board = lazy(() => import("@/components/board/Board"));

function BoardFrame({ big = false }: { big?: boolean }) {
  const board = useLesson((s) => s.board);
  const active = useLesson((s) => s.active);
  const skillId = useLesson((s) => s.skillId);
  return (
    <div className={`rounded-[14px] border-[3px] border-ink bg-wood ${big ? "p-[9px] shadow-[5px_5px_0_#1b1a17]" : "p-[7px] shadow-[4px_4px_0_#1b1a17]"}`}>
      <div className="aspect-[1000/625] w-full overflow-hidden rounded-md bg-chalkboard">
        <Suspense fallback={<div className="h-full w-full bg-chalkboard" />}>
          <Board state={board} active={active} label={`Doska: ${getSkill(skillId)?.title_uz ?? ""}`} />
        </Suspense>
      </div>
    </div>
  );
}

function useCharacterState(): { state: CharacterState; pointing: boolean } {
  const status = useLesson((s) => s.player.status);
  const active = useLesson((s) => s.active);
  const emotion = useLesson((s) => s.emotion);
  const celebrate = useLesson((s) => s.celebrate);
  const [party, setParty] = useState(false);
  useEffect(() => {
    if (!celebrate) return;
    setParty(true);
    const tm = setTimeout(() => setParty(false), 1300);
    return () => clearTimeout(tm);
  }, [celebrate]);
  if (party) return { state: "celebrate", pointing: false };
  if (status === "listening") return { state: "listening", pointing: false };
  if (status === "thinking" || status === "paused") return { state: "thinking", pointing: false };
  if (status === "speaking" || status === "answering") return { state: "talking", pointing: !!active && active.p < 1 };
  if (emotion === "excited" || emotion === "happy") return { state: "happy", pointing: false };
  return { state: "idle", pointing: false };
}

function Caption({ name, color }: { name: string; color: string }) {
  const caption = useLesson((s) => s.caption);
  const status = useLesson((s) => s.player.status);
  const track = useLesson((s) => s.track);
  const talking = status === "speaking" || status === "answering";
  return (
    <div className="relative flex-1 rounded-2xl border-[3px] border-ink bg-white px-3 pt-2.5 pb-3 shadow-[3px_3px_0_#1b1a17]" aria-live="polite">
      <div className="mb-1 flex items-center gap-2">
        <span className="rounded-md border-2 border-ink px-1.5 font-pixel text-[12px] font-bold" style={{ background: color }}>
          {name}
        </span>
        {talking && <Wave color={track === "note" ? "#f28c28" : "#f28c28"} />}
        {track === "note" && <span className="text-[12px] font-extrabold text-rust">izoh</span>}
      </div>
      <p className="text-[14px] leading-[1.35] font-bold md:text-[15px]">{caption}</p>
    </div>
  );
}

function Transcript() {
  const items = useLesson((s) => s.transcript);
  const ref = useRef<HTMLDivElement>(null);
  const ch = getCharacter(useLesson((s) => s.characterId));
  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight, behavior: "smooth" });
  }, [items.length]);
  if (!items.length) return null;
  return (
    <div ref={ref} className="flex max-h-[300px] flex-col gap-2.5 overflow-y-auto rounded-2xl border-[3px] border-ink bg-white p-3.5" aria-label="Suhbat">
      {items.slice(-14).map((it, i) =>
        it.who === "me" ? (
          <div key={i} className="max-w-[85%] self-end rounded-[14px_14px_4px_14px] border-[3px] border-ink bg-cream px-3 py-2 text-[14px] leading-[1.35] font-bold">
            <div className="mb-0.5 text-[12px] font-extrabold text-muted">{it.voice ? t.lesson.youVoice : t.lesson.you}</div>
            {it.text}
          </div>
        ) : (
          <div
            key={i}
            className={`max-w-[90%] self-start rounded-[14px_14px_14px_4px] border-[3px] border-ink px-3 py-2 leading-[1.35] ${it.highlight ? "bg-gold text-[15px] font-extrabold" : "bg-paper text-[14px] font-bold"}`}
          >
            {!it.highlight && <div className="mb-0.5 text-[12px] font-extrabold text-rust">{ch.name}</div>}
            {it.text}
          </div>
        ),
      )}
    </div>
  );
}

function QuestionBox({ onClose }: { onClose: () => void }) {
  const [q, setQ] = useState("");
  return (
    <form
      className="flex items-center gap-2 rounded-2xl border-[3px] border-ink bg-white p-2.5"
      onSubmit={(e) => {
        e.preventDefault();
        if (!q.trim()) return;
        void ask(q.trim());
        setQ("");
        onClose();
      }}
    >
      <input
        autoFocus
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => bargeIn()}
        placeholder={t.lesson.typeQuestion}
        aria-label={t.lesson.typeQuestion}
        className="h-11 min-w-0 flex-1 rounded-[10px] border-[3px] border-ink bg-cream px-3 text-[15px] font-bold"
      />
      <button type="submit" className="btn btn-go h-11" aria-label={t.lesson.send}>
        <Send size={18} aria-hidden />
        <span className="max-sm:hidden">{t.lesson.send}</span>
      </button>
    </form>
  );
}

function ActionPanel({ wide }: { wide: boolean }) {
  const status = useLesson((s) => s.player.status);
  const expect = useLesson((s) => s.expect);
  const misses = useLesson((s) => s.misses);
  const feedback = useLesson((s) => s.feedback);
  const [typing, setTyping] = useState(false);
  const [busy, setBusy] = useState(false);

  if (status === "checking") {
    return (
      <div className="flex flex-col gap-2.5">
        <div className="text-center text-[15px] font-extrabold">{t.lesson.understood}</div>
        <div className="flex gap-2.5">
          <button type="button" className="btn btn-go h-14 flex-1 text-[18px]" onClick={continueLesson}>
            <Play size={20} aria-hidden /> {t.lesson.continue}
          </button>
          <button type="button" className="btn h-14 flex-1 text-[16px]" onClick={explainAgain}>
            <RotateCcw size={18} aria-hidden /> {t.lesson.explainAgain}
          </button>
        </div>
      </div>
    );
  }

  const micDisabled = status === "idle" || status === "done" || status === "thinking";
  const listening = status === "listening";

  return (
    <div className="flex flex-col gap-3">
      {expect && status === "awaiting" && (
        <div className="rounded-2xl border-[3px] border-ink bg-white p-3">
          <AnswerInput
            expect={expect}
            disabled={busy}
            onSubmit={async (v) => {
              setBusy(true);
              await submitAnswer(v);
              setBusy(false);
            }}
          />
          {feedback?.kind === "wrong" && (
            <div className="mt-2 flex items-center justify-between gap-2 text-[14px] font-extrabold text-rust">
              <span>{t.lesson.tryAgain}</span>
              {misses >= 2 && (
                <button type="button" className="btn h-10 text-[14px]" onClick={showMe}>
                  {t.lesson.showMe}
                </button>
              )}
            </div>
          )}
        </div>
      )}
      {feedback?.kind === "correct" && status === "speaking" && (
        <div className="rounded-xl border-[3px] border-ink bg-mint px-3 py-2 text-center font-pixel text-[16px] font-bold" role="status">
          {feedback.text} {feedback.xp ? t.lesson.xpGained(feedback.xp) : ""}
        </div>
      )}
      {typing && <QuestionBox onClose={() => setTyping(false)} />}
      {wide ? (
        <>
          <div className="flex gap-2.5">
            <MicButton variant="wide" listening={listening} disabled={micDisabled} onStart={startListening} onStop={() => void stopListening()} />
            <button type="button" aria-label={t.lesson.keyboard} title={t.lesson.keyboard} className="btn h-[60px] w-[60px] rounded-2xl p-0" onClick={() => setTyping((x) => !x)} disabled={micDisabled}>
              <Keyboard size={24} aria-hidden />
            </button>
          </div>
          <div className="text-center text-[12px] font-bold text-muted">{t.lesson.micHintDesktop}</div>
        </>
      ) : (
        <>
          <div className="flex items-center justify-center gap-[18px]">
            <button
              type="button"
              aria-label={t.lesson.hint}
              title={t.lesson.hint}
              className="btn h-[52px] w-[52px] rounded-[14px] p-0"
              disabled={!expect}
              onClick={() => void ask("Maslahat ber, iltimos")}
            >
              <Lightbulb size={24} aria-hidden />
            </button>
            <MicButton listening={listening} disabled={micDisabled} onStart={startListening} onStop={() => void stopListening()} />
            <button type="button" aria-label={t.lesson.keyboard} title={t.lesson.keyboard} className="btn h-[52px] w-[52px] rounded-[14px] p-0" disabled={micDisabled} onClick={() => setTyping((x) => !x)}>
              <Keyboard size={24} aria-hidden />
            </button>
          </div>
          <div className="-mt-1 text-center text-[12px] font-extrabold text-muted">{listening ? t.lesson.listening : t.lesson.micHint}</div>
        </>
      )}
    </div>
  );
}

function Controls() {
  const rate = useLesson((s) => s.rate);
  const muted = useLesson((s) => s.muted);
  const i = useLesson((s) => Math.min(s.mainIndex + 1, Math.max(1, s.main.length)));
  const n = useLesson((s) => Math.max(1, s.main.length));
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" className="btn h-10 font-body text-[13px] font-extrabold md:h-[42px] md:text-[14px]" onClick={replayStep}>
        <RotateCcw size={16} aria-hidden />
        <span className="md:hidden">{t.lesson.replay}</span>
        <span className="hidden md:inline">{t.lesson.replayStep}</span>
      </button>
      <button type="button" className="btn h-10 text-[14px] md:h-[42px]" onClick={() => setRate(rate === 1 ? 0.75 : 1)} aria-label={t.lesson.speedLong(rate)}>
        {t.lesson.speed(rate)}
      </button>
      <button type="button" className="btn h-10 w-10 p-0 md:h-[42px] md:w-[42px]" onClick={() => setMuted(!muted)} aria-label={muted ? "Ovozni yoqish" : "Ovozni o'chirish"} title={muted ? "Ovozni yoqish" : "Ovozni o'chirish"}>
        {muted ? <VolumeX size={18} aria-hidden /> : <Volume2 size={18} aria-hidden />}
      </button>
      <div className="flex-1" />
      <div className="max-md:hidden">
        <StepPips i={i} n={n} />
      </div>
      <div className="text-[12px] font-extrabold text-muted md:hidden">{t.common.step(i, n)}</div>
    </div>
  );
}

function StartCard({ onStart, chName }: { onStart: () => void; chName: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border-[3px] border-ink bg-white p-4 text-center">
      <button type="button" className="btn btn-primary h-16 w-full max-w-sm text-[20px]" onClick={onStart} autoFocus>
        <Play size={22} aria-hidden /> {t.lesson.start}
      </button>
      <div className="text-[13px] font-bold text-muted">
        {chName} · {t.lesson.startHint}
      </div>
    </div>
  );
}

function FinishCard() {
  const xp = useLesson((s) => s.xpGained);
  const skillId = useLesson((s) => s.skillId);
  return (
    <div className="flex flex-col gap-3 rounded-2xl border-[3px] border-ink bg-mint p-4 text-center" role="status">
      <div className="font-pixel text-[22px] font-bold">{t.lesson.finished}</div>
      {xp > 0 && <div className="font-pixel text-[18px]">{t.lesson.xpGained(xp + 20)}</div>}
      <div className="flex gap-2.5">
        <Link href={`/practice/${skillId}`} className="btn btn-primary h-14 flex-1 text-[17px] no-underline">
          {t.lesson.toPractice}
        </Link>
        <Link href="/roadmap" className="btn h-14 flex-1 text-[16px] no-underline">
          {t.lesson.toMap}
        </Link>
      </div>
    </div>
  );
}

export default function LessonPlayer({ skillId }: { skillId: string }) {
  const skill = getSkill(skillId);
  const { user, load, roadmap } = useMe();
  const status = useLesson((s) => s.player.status);
  const error = useLesson((s) => s.error);
  const celebrate = useLesson((s) => s.celebrate);
  const waiting = useLesson((s) => s.waiting);
  const characterId = (user?.characterId ?? "blokbek") as CharacterId;
  const ch = getCharacter(characterId);
  const cs = useCharacterState();

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    initLesson({ skillId, characterId, grade: user?.grade ?? 6, greeting: `${ch.catchphrases_uz[0]} ${t.lesson.start} tugmasini bos.` });
    return () => disposeLesson();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skillId, characterId, user?.grade]);

  // refresh roadmap/XP after the lesson
  useEffect(() => {
    if (status === "done") void load(true);
  }, [status, load]);

  const lessonNo = useMemo(() => {
    const o = roadmap?.nodes.find((n) => n.id === skillId)?.order;
    return o && o > 0 ? o : 1;
  }, [roadmap, skillId]);

  if (!skill) {
    return (
      <div className="p-6">
        <p className="font-bold">Mavzu topilmadi.</p>
        <Link href="/roadmap" className="btn mt-3">
          {t.nav.backToMap}
        </Link>
      </div>
    );
  }

  const header = (
    <div className="flex items-center gap-2.5">
      <Link href="/roadmap" aria-label={t.nav.backToMap} title={t.nav.backToMap} className="btn h-11 w-11 flex-none rounded-xl p-0 shadow-[3px_3px_0_#1b1a17]">
        <ChevronLeft size={24} strokeWidth={3} aria-hidden />
      </Link>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-extrabold text-muted max-md:hidden">
          {skill.section} › {t.lesson.lessonN(lessonNo)}
        </div>
        <h1 className="m-0 truncate font-pixel text-[19px] leading-[1.1] font-bold md:text-[26px] xl:text-[30px]">{skill.title_uz}</h1>
        <div className="text-[13px] font-bold text-muted md:hidden">
          {t.lesson.lessonN(lessonNo)} · {t.common.grade(user?.grade ?? skill.grade)}
        </div>
      </div>
      {user && (
        <div className="flex items-center gap-2">
          <div className="hidden w-[300px] lg:block">
            <LevelRow level={user.level} xpInLevel={user.xpInLevel} xpPerLevel={user.xpPerLevel} />
          </div>
          <StreakChip days={user.streak} />
        </div>
      )}
    </div>
  );

  const started = status !== "idle";
  const characterBlock = (size: number) => (
    <div className="relative flex-none" style={{ width: size, height: size * 1.5 }}>
      <Confetti burst={celebrate} />
      <Character id={characterId} size={size} state={cs.state} pointing={cs.pointing} />
    </div>
  );

  return (
    <div className="mx-auto flex max-w-[1500px] flex-col gap-3 px-3 pt-3.5 pb-3 md:gap-4 md:px-5 md:pt-5">
      {header}
      {user && (
        <div className="lg:hidden">
          <LevelRow level={user.level} xpInLevel={user.xpInLevel} xpPerLevel={user.xpPerLevel} />
        </div>
      )}
      {error && (
        <div role="alert" className="rounded-xl border-[3px] border-ink bg-cream px-3 py-2 text-[14px] font-extrabold">
          {error}
        </div>
      )}
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:gap-5">
        {/* board column */}
        <div className="flex min-w-0 flex-col gap-3 md:flex-[7_1_0%]">
          <BoardFrame big />
          <Controls />
          {waiting && started && status === "speaking" && <div className="text-[13px] font-extrabold text-muted">{t.lesson.thinking}</div>}
        </div>
        {/* character / captions / actions column */}
        <div className="flex min-w-0 flex-col gap-3 md:flex-[3_1_0%] md:min-w-[300px]">
          <div className="flex items-end gap-1 md:rounded-2xl md:border-[3px] md:border-ink md:p-3.5 md:shadow-[5px_5px_0_#1b1a17]" style={{ background: undefined }}>
            <div className="md:hidden">{characterBlock(92)}</div>
            <div className="hidden md:block">{characterBlock(96)}</div>
            <div className="mb-3.5 flex-1">
              <Caption name={ch.name} color={ch.color} />
            </div>
          </div>
          <div className="hidden md:block">
            <Transcript />
          </div>
          {!started ? <StartCard chName={ch.name} onStart={() => void startLesson()} /> : status === "done" ? <FinishCard /> : null}
          {started && status !== "done" && (
            <>
              <div className="md:hidden">
                <ActionPanel wide={false} />
              </div>
              <div className="hidden md:block">
                <ActionPanel wide />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
