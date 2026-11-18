"use client";
// The lesson screen: classroom stage (handwriting board + live 3D tutor), speech bubble,
// steps/transcript card and the actions. All behaviour comes from the lesson engine.
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { t } from "@/i18n/uz";
import { getSkill } from "@/data/skills";
import { getCharacter } from "@/config/characters";
import { useMe } from "@/lib/client/me";
import { readPref } from "@/lib/client/prefs";
import {
  ask,
  bargeIn,
  continueLesson,
  disposeLesson,
  explainAgain,
  forgetProgress,
  initLesson,
  pauseForBackground,
  resumeFromBackground,
  savedProgress,
  replayStep,
  retryStream,
  setMuted,
  setRate,
  showMe,
  startLesson,
  startListening,
  stopListening,
  submitAnswer,
  useLesson,
} from "@/lib/lesson/engine";
import { StepPips, StreakChip, Wave } from "@/components/ui/hud";
import { ArrowIcon, BackIcon, KeyboardIcon, ReplayIcon, SpeakerIcon } from "@/components/ui/icons";
import SuccessScreen from "@/components/ui/SuccessScreen";
import type { StartAt } from "@/lib/lesson/resume";
import AnswerInput from "./AnswerInput";
import MicButton from "./MicButton";
import LessonA11y from "@/components/a11y/LessonA11y"; // a11y-hook

// three.js + handwriting engine are code-split: the page shell paints first on phones.
const ClassroomStage = lazy(() => import("./ClassroomStage"));

function Stage({ characterId }: { characterId: string }) {
  const board = useLesson((s) => s.board);
  const active = useLesson((s) => s.active);
  const skillId = useLesson((s) => s.skillId);
  return (
    <div data-a11y-stage className="overflow-hidden bg-[#e3d6bd] md:rounded-[24px] md:shadow-[0_10px_30px_rgba(31,54,120,.18)]"> {/* a11y-hook: keeps its scale at 150 % text */}
      <Suspense fallback={<div className="w-full bg-[#e3d6bd]" style={{ aspectRatio: "16 / 9" }} />}>
        <ClassroomStage board={board} active={active} characterId={characterId} label={`Sinfxona: ustoz doskada "${getSkill(skillId)?.title_uz ?? ""}" mavzusini tushuntirmoqda`} />
      </Suspense>
    </div>
  );
}

function stateLabel(status: string, writing: boolean, speaking: boolean) {
  if (status === "listening" || status === "paused") return t.lessonUi.listeningState;
  if (status === "thinking") return t.lessonUi.thinkingState;
  if (writing) return t.lessonUi.writing;
  if (speaking) return t.lessonUi.talking;
  return t.lessonUi.waiting;
}

function Bubble({ name }: { name: string }) {
  const caption = useLesson((s) => s.caption);
  const status = useLesson((s) => s.player.status);
  const track = useLesson((s) => s.track);
  const writing = useLesson((s) => !!s.active && s.active.p < 1);
  const speaking = status === "speaking" || status === "answering";
  return (
    <div className="card flex items-center gap-3 px-3.5 py-3" aria-live="polite">
      <div className={`grid h-[42px] w-[42px] flex-none place-items-center rounded-full text-white shadow-[0_6px_14px_rgba(47,107,255,.35)] ${track === "note" ? "bg-note" : "bg-blue"}`} aria-hidden>
        <SpeakerIcon size={22} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-0.5 flex items-center gap-2 text-[12px] font-extrabold text-mut">
          <span className="text-ink">{name}</span>· {stateLabel(status, writing, speaking)}
          {speaking && <Wave color={track === "note" ? "#ff9f43" : "#2f6bff"} h={12} />}
        </div>
        <p className="m-0 text-[15px] leading-[1.35] font-extrabold md:text-[16px]">{caption}</p>
      </div>
    </div>
  );
}

function Steps() {
  const items = useLesson((s) => s.transcript);
  const i = useLesson((s) => Math.min(s.mainIndex + 1, Math.max(1, s.main.length)));
  const n = useLesson((s) => Math.max(1, s.main.length));
  const ch = getCharacter(useLesson((s) => s.characterId));
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight, behavior: "smooth" });
  }, [items.length]);
  return (
    <div className="card px-4 py-3.5">
      <StepPips i={i} n={n} />
      {items.length > 0 && (
        <div ref={ref} className="no-scrollbar mt-3 flex max-h-[220px] flex-col gap-2 overflow-y-auto md:max-h-[300px]" aria-label="Suhbat">
          {items.slice(-12).map((it, k) =>
            it.who === "me" ? (
              <div key={k} className="max-w-[85%] self-end rounded-[16px_16px_4px_16px] bg-blue px-3 py-2 text-[14px] leading-[1.35] font-extrabold text-white">
                <div className="text-[11px] font-bold opacity-80">{it.voice ? t.lesson.youVoice : t.lesson.you}</div>
                {it.text}
              </div>
            ) : (
              <div key={k} className={`max-w-[92%] self-start rounded-[16px_16px_16px_4px] px-3 py-2 text-[14px] leading-[1.35] font-bold ${it.highlight ? "bg-[#fff6d6] font-extrabold" : "bg-soft"}`}>
                <div className="text-[11px] font-extrabold text-blue">{ch.name}</div>
                {it.text}
              </div>
            ),
          )}
        </div>
      )}
    </div>
  );
}

function QuestionBox({ onClose }: { onClose: () => void }) {
  const [q, setQ] = useState("");
  return (
    <form
      className="card flex items-center gap-2 p-2"
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
        className="field h-12 min-w-0 flex-1 text-[16px]"
      />
      <button type="submit" className="btn btn-primary h-12 min-h-12 px-5 text-[16px]">
        {t.lesson.send}
      </button>
    </form>
  );
}

function Actions() {
  const status = useLesson((s) => s.player.status);
  const expect = useLesson((s) => s.expect);
  const misses = useLesson((s) => s.misses);
  const feedback = useLesson((s) => s.feedback);
  const [typing, setTyping] = useState(false);
  const [busy, setBusy] = useState(false);
  // the tutor's stream broke and playback caught up: one clear way on ("Davom etamizmi?")
  const stuck = useLesson((s) => !!s.broken && s.waiting && (s.track === s.broken || s.main.length === 0));

  if (stuck) {
    return (
      <div className="flex flex-col gap-2.5">
        <button type="button" className="btn btn-primary w-full" data-testid="stream-retry" onClick={() => void retryStream()} autoFocus>
          {t.lesson.retry} <ArrowIcon />
        </button>
      </div>
    );
  }

  if (status === "checking") {
    return (
      <div className="flex flex-col gap-2.5">
        <button type="button" className="btn btn-primary w-full" onClick={continueLesson} autoFocus>
          {t.lesson.continue} <ArrowIcon />
        </button>
        <button type="button" className="btn w-full" onClick={explainAgain}>
          {t.lesson.explainAgain}
        </button>
      </div>
    );
  }
  const micDisabled = status === "idle" || status === "done" || status === "thinking";
  return (
    <div className="flex flex-col gap-3">
      {expect && status === "awaiting" && (
        <div className="card p-3.5">
          <AnswerInput
            expect={expect}
            disabled={busy}
            wrong={feedback?.kind === "wrong"}
            onSubmit={async (v) => {
              setBusy(true);
              await submitAnswer(v);
              setBusy(false);
            }}
          />
          {feedback?.kind === "wrong" && (
            <div className="mt-3 flex items-center justify-between gap-2 rounded-[14px] bg-[#fff4e8] px-3.5 py-2.5 text-[14px] font-extrabold text-[#c2410c]">
              <span>{t.lesson.tryAgain}</span>
              {misses >= 2 && (
                <button type="button" className="btn min-h-10 px-4 text-[14px]" onClick={showMe}>
                  {t.lesson.showMe}
                </button>
              )}
            </div>
          )}
        </div>
      )}
      {feedback?.kind === "correct" && status === "speaking" && (
        <div className="rounded-2xl bg-[#e7f8ee] px-4 py-2.5 text-center text-[16px] font-black text-green" role="status">
          {feedback.text} {feedback.xp ? t.lesson.xpGained(feedback.xp) : ""}
        </div>
      )}
      {typing && <QuestionBox onClose={() => setTyping(false)} />}
      <div className="flex gap-2.5">
        <MicButton listening={status === "listening"} disabled={micDisabled} onStart={startListening} onStop={() => void stopListening()} />
        <button type="button" aria-label={t.lesson.keyboard} title={t.lesson.keyboard} className="btn h-[58px] w-[58px] flex-none p-0" disabled={micDisabled} onClick={() => setTyping((x) => !x)}>
          <KeyboardIcon />
        </button>
      </div>
      <div className="-mt-1 text-center text-[12px] font-bold text-mut">
        <span className="md:hidden">{t.lessonUi.askHint}</span>
        <span className="hidden md:inline">{t.lesson.micHintDesktop}</span>
      </div>
    </div>
  );
}

function Toolbar() {
  const rate = useLesson((s) => s.rate);
  const muted = useLesson((s) => s.muted);
  return (
    <div className="flex items-center gap-1.5">
      <button type="button" className="icon-btn bg-white/85" onClick={replayStep} aria-label={t.lesson.replayStep} title={t.lesson.replayStep}>
        <ReplayIcon />
      </button>
      <button type="button" className="icon-btn bg-white/85 text-[13px] font-black" onClick={() => setRate(rate === 1 ? 0.75 : 1)} aria-label={t.lesson.speedLong(rate)} title={t.lesson.speedLong(rate)}>
        {rate}×
      </button>
      <button type="button" className="icon-btn bg-white/85" onClick={() => setMuted(!muted)} aria-label={muted ? "Ovozni yoqish" : "Ovozni o'chirish"} title={muted ? "Ovozni yoqish" : "Ovozni o'chirish"}>
        <span style={{ opacity: muted ? 0.35 : 1 }}>
          <SpeakerIcon size={18} />
        </span>
      </button>
    </div>
  );
}

export default function LessonPlayer({ skillId }: { skillId: string }) {
  const skill = getSkill(skillId);
  const { user, load, roadmap, loaded } = useMe();
  const status = useLesson((s) => s.player.status);
  const error = useLesson((s) => s.error);
  const xpGained = useLesson((s) => s.xpGained);
  const characterId = getCharacter(user?.characterId).id;
  const ch = getCharacter(characterId);
  const [doneSeen, setDoneSeen] = useState(false);
  // where Start begins: saved segment after a refresh, or the explanation step when coming back from the quiz
  const [startAt, setStartAt] = useState<StartAt>(0);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    // set up once the user is known: re-initialising when it arrives would reset a lesson that was
    // already started (and drop the "resume at the explanation" flag) — e2e "refresh mid-lesson"
    if (!loaded) return;
    initLesson({ skillId, characterId, grade: user?.grade ?? 6, greeting: ch.hi });
    setMuted(readPref("sound", "1") === "0");
    setDoneSeen(false);
    let at: StartAt = savedProgress(skillId, characterId);
    try {
      const flag = `to2:lesson-at:${skillId}`;
      if (new URLSearchParams(window.location.search).get("at") === "explain" || sessionStorage.getItem(flag) === "explain") at = "explain";
      sessionStorage.removeItem(flag);
    } catch {
      /* no storage: start normally */
    }
    setStartAt(at);
    return () => disposeLesson();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skillId, characterId, user?.grade, loaded]);

  useEffect(() => {
    if (status === "done") void load(true);
  }, [status, load]);

  // leaving the app (tab switch, phone lock) pauses the lesson at the same spot; coming back resumes it
  useEffect(() => {
    const onVis = () => (document.hidden ? pauseForBackground() : resumeFromBackground());
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  const lessonNo = useMemo(() => {
    const o = roadmap?.nodes.find((n) => n.id === skillId)?.order;
    return o && o > 0 ? o : 1;
  }, [roadmap, skillId]);

  if (!skill) {
    return (
      <div className="p-6">
        <p className="font-bold">Mavzu topilmadi.</p>
        <Link href="/roadmap" className="btn">
          {t.nav.backToMap}
        </Link>
      </div>
    );
  }

  const started = status !== "idle";

  return (
    <div className="mx-auto flex max-w-[1500px] flex-col md:gap-4 md:px-6 md:pt-6 md:pb-6">
      {/* desktop title row */}
      <div className="hidden items-center gap-3 md:flex">
        <Link href="/roadmap" aria-label={t.nav.backToMap} title={t.nav.backToMap} className="icon-btn bg-white shadow-[0_4px_12px_rgba(31,54,120,.07)]">
          <BackIcon />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-extrabold text-mut">
            {skill.section} · {t.lesson.lessonN(lessonNo)} · {t.common.grade(user?.grade ?? skill.grade)}
          </div>
          <h1 className="m-0 truncate text-[26px] font-black xl:text-[30px]">{skill.title_uz}</h1>
        </div>
        <Toolbar />
        {user && <StreakChip days={user.streak} />}
      </div>

      <div className="flex flex-col lg:flex-row lg:items-start lg:gap-5">
        <div className="relative min-w-0 lg:flex-[7_1_0%]">
          <Stage characterId={characterId} />
          {/* mobile overlay: back + tools */}
          <div className="absolute inset-x-3 top-3 flex items-start justify-between md:hidden" style={{ paddingTop: "env(safe-area-inset-top)" }}>
            <Link href="/roadmap" aria-label={t.nav.backToMap} className="icon-btn bg-white/85">
              <BackIcon />
            </Link>
            <Toolbar />
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-3 px-4 pb-6 lg:flex-[3_1_0%] lg:px-0 lg:pb-0 lg:min-w-[320px]">
          <div className="relative z-10 mt-3 md:mt-0">
            <Bubble name={ch.name} />
          </div>
          <LessonA11y voice={characterId} /> {/* a11y-hook: inclusive mode (renders nothing when off) */}
          <div className="md:hidden">
            <div className="text-[12px] font-extrabold text-mut">
              {skill.section} · {t.lesson.lessonN(lessonNo)}
            </div>
            <h1 className="m-0 text-[20px] leading-tight font-black">{skill.title_uz}</h1>
          </div>
          {error && (
            <div role="alert" className="rounded-[14px] bg-[#fff4e8] px-3.5 py-2.5 text-[14px] font-extrabold text-[#c2410c]">
              {error}
            </div>
          )}
          {started && <Steps />}
          {!loaded ? (
            <div className="btn w-full opacity-60" aria-busy="true">
              {t.common.loading}
            </div>
          ) : !started ? (
            <div className="flex flex-col gap-2">
              <button type="button" className="btn btn-primary w-full" onClick={() => void startLesson(startAt)} autoFocus>
                {startAt === "explain" ? t.lesson.reviewExplain : typeof startAt === "number" && startAt > 0 ? t.lesson.resumeAt(startAt + 1) : t.lesson.start} <ArrowIcon />
              </button>
              {startAt !== 0 && (
                <button
                  type="button"
                  className="btn w-full"
                  onClick={() => {
                    forgetProgress(skillId, characterId);
                    void startLesson(0);
                  }}
                >
                  {t.lesson.fromStart}
                </button>
              )}
            </div>
          ) : status !== "done" ? (
            <Actions />
          ) : null}
          {!started && <div className="text-center text-[13px] font-bold text-mut">{t.lesson.startHint}</div>}
        </div>
      </div>

      {status === "done" && !doneSeen && (
        <SuccessScreen
          title={t.success.title}
          subtitle={`${t.success.lessonDone} ${t.lesson.xpGained(xpGained + 20)}`}
          characterId={characterId}
          primary={{ label: t.lesson.toPractice, href: `/practice/${skillId}?from=lesson` }}
          secondary={{ label: t.lesson.toMap, onClick: () => setDoneSeen(true) }}
        />
      )}
      {status === "done" && doneSeen && (
        <div className="flex gap-3 px-4 pb-6 md:px-0">
          <Link href={`/practice/${skillId}?from=lesson`} className="btn btn-primary flex-1">
            {t.lesson.toPractice}
          </Link>
          <Link href="/roadmap" className="btn flex-1">
            {t.lesson.toMap}
          </Link>
        </div>
      )}
    </div>
  );
}
