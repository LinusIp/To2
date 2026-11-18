"use client";
// Quiz after a lesson (prototype "Savol" + "A'lo!" screens): QUIZ_LEN generated problems, checked on the
// server (mathjs), XP + mastery per answer, then a score. No dead ends (REPORT.md "Lesson ↔ quiz flow"):
//   • 2 wrong tries on a question → "Darsni qayta ko'rish" / "Yana urinish" / "Keyingi savol"
//   • score < 60 % → the tutor encourages: back to the lesson's explanation, or a quick easier review
//   • × always works (confirm → lesson or roadmap); browser back = plain history (no traps, no loops)
//   • pass → "Keyingi dars" = next open lesson (src/lib/learning/access.ts), else the roadmap
// ?mode=review = the quick review (REVIEW_LEN easier questions from the prerequisites);
// ?from=lesson = we came from the lesson page, so "back to the lesson" is a history step (no duplicates).
import { use, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { t } from "@/i18n/uz";
import AnswerInput from "@/components/lesson/AnswerInput";
import SuccessScreen from "@/components/ui/SuccessScreen";
import TutorPortrait from "@/components/characters/TutorPortrait";
import QuizThinker from "@/components/lesson/QuizThinker";
import QuizA11y from "@/components/a11y/QuizA11y";
import { Bar } from "@/components/ui/hud";
import { CloseIcon } from "@/components/ui/icons";
import { getSkill } from "@/data/skills";
import { getCharacter } from "@/config/characters";
import { useMe } from "@/lib/client/me";
import { OFFER_LESSON_AFTER, QUIZ_LEN, REVIEW_LEN, nextLesson, quizPassed, quizScore, type QuizResult } from "@/lib/learning/access";
import type { Problem } from "@/data/problems";

export default function QuizPage({ params }: { params: Promise<{ skillId: string }> }) {
  const { skillId } = use(params);
  const skill = getSkill(skillId);
  const router = useRouter();
  const { user, load } = useMe();
  const ch = getCharacter(user?.characterId);

  const [mode, setMode] = useState<"quiz" | "review">("quiz");
  const [fromLesson, setFromLesson] = useState(false);
  const total = mode === "review" ? REVIEW_LEN : QUIZ_LEN;
  const [p, setP] = useState<Problem | null>(null);
  const [results, setResults] = useState<QuizResult[]>([]);
  const [tries, setTries] = useState(0);
  const [wrong, setWrong] = useState(false);
  const [busy, setBusy] = useState(false);
  const [xp, setXp] = useState(0);
  const [flash, setFlash] = useState(false); // short "correct" moment before the next question
  const [leaving, setLeaving] = useState(false);
  const [next, setNext] = useState<string | null | undefined>(undefined);
  const startedAt = useRef(0);
  const done = results.length >= total;

  // read ?mode / ?from once (client only)
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    setMode(q.get("mode") === "review" ? "review" : "quiz");
    setFromLesson(q.get("from") === "lesson");
  }, []);

  const fetchProblem = useCallback(async () => {
    setWrong(false);
    setTries(0);
    setP(null);
    const review = new URLSearchParams(window.location.search).get("mode") === "review";
    const r = await fetch(`/api/practice?skillId=${encodeURIComponent(skillId)}${review ? "&review=1" : ""}`, { cache: "no-store" });
    if (r.ok) {
      setP(((await r.json()) as { problem: Problem }).problem);
      startedAt.current = Date.now();
    }
  }, [skillId]);

  useEffect(() => {
    void load();
    void fetchProblem();
  }, [load, fetchProblem]);

  // when the quiz ends: refresh mastery/roadmap, then work out the next lesson
  useEffect(() => {
    if (!done) return;
    void load(true).then(() => {
      const rm = useMe.getState().roadmap;
      setNext(rm ? nextLesson(rm, skillId) : null);
    });
  }, [done, load, skillId]);

  const record = (r: QuizResult) => {
    setResults((x) => [...x, r]);
    if (results.length + 1 < total) void fetchProblem();
  };

  const submit = async (given: string) => {
    if (!p || busy) return;
    setBusy(true);
    try {
      const r = await fetch("/api/answer", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ skillId: p.skillId ?? skillId, expect: p.expect, given, question: p.q, source: "practice", firstTry: tries === 0, hintUsed: tries > 0, msTaken: Date.now() - startedAt.current }),
      });
      const j = (await r.json()) as { correct: boolean; xp: number; unreadable?: boolean };
      if (j.unreadable) return;
      setXp((x) => x + (j.xp ?? 0));
      if (j.correct) {
        setFlash(true);
        setTimeout(() => {
          setFlash(false);
          record(tries === 0 ? "first" : "retry");
        }, 700);
      } else {
        setWrong(true);
        setTries((x) => x + 1);
        setTimeout(() => setWrong(false), 400);
      }
    } finally {
      setBusy(false);
    }
  };

  /** Back to the lesson. `explain` = start at the explanation step. History step if we came from it. */
  const toLesson = (explain: boolean) => {
    try {
      if (explain) sessionStorage.setItem(`to2:lesson-at:${skillId}`, "explain");
    } catch {
      /* the lesson then just offers its normal start */
    }
    if (fromLesson && window.history.length > 1) router.back();
    else router.replace(`/lesson/${skillId}`);
  };
  const toMap = () => router.replace("/roadmap");
  const restart = (m: "quiz" | "review") => {
    setResults([]);
    setXp(0);
    setNext(undefined);
    setMode(m);
    router.replace(`/practice/${skillId}?${m === "review" ? "mode=review&" : ""}${fromLesson ? "from=lesson" : ""}`);
    void fetchProblem();
  };

  if (!skill) return null;
  const score = quizScore(results);
  const pct = Math.round(score * 100);
  const qNo = Math.min(results.length + 1, total);

  return (
    <main className="mx-auto flex min-h-dvh max-w-[640px] flex-col bg-ph px-[18px] pt-4 pb-6">
      <div className="flex h-[52px] items-center gap-3.5">
        <button type="button" aria-label={t.quiz.close} title={t.quiz.close} className="icon-btn" onClick={() => (done ? toMap() : setLeaving(true))}>
          <CloseIcon />
        </button>
        <Bar value={Math.round((results.length / total) * 100)} className="flex-1" label={t.quiz.progress(qNo, total)} />
        <div className="font-extrabold text-mut" data-testid="quiz-progress">
          {t.quiz.progress(qNo, total)}
        </div>
      </div>
      <div className="mt-1 mb-3 text-[13px] font-extrabold text-mut">
        {mode === "review" ? t.quiz.review : t.quiz.title} · {skill.title_uz}
      </div>

      {!done && (
        <div className="flex flex-col gap-3">
          <div className="card p-5">
            <div className="text-[19px] font-black">{p?.expect.kind === "choice" ? "To'g'ri javobni tanlang:" : "Misolni yeching:"}</div>
            <div className="mt-2.5 text-center font-chalk text-[26px] leading-snug" data-testid="quiz-question" data-key={p?.key ?? ""}>
              {p ? p.q : t.common.loading}
            </div>
            {flash && <div className="mt-2 text-center text-[16px] font-black text-green">{t.lesson.correct}</div>}
          </div>
          {p && !flash && <AnswerInput key={p.key} expect={p.expect} disabled={busy} wrong={wrong} onSubmit={(v) => void submit(v)} />}
          {p && !flash && <QuizA11y questionKey={p.key} question={p.q} choices={p.expect.kind === "choice" ? p.expect.choices : undefined} voice={ch.id} busy={busy} onAnswer={(v) => void submit(v)} />}
          {tries > 0 && p && !flash && (
            <div className="rounded-[14px] bg-[#fff4e8] px-3.5 py-3 text-[14px] font-extrabold text-[#c2410c]" role="status">
              {t.lesson.hint}: {p.hint}
              {tries >= OFFER_LESSON_AFTER && (
                <div className="mt-3 flex flex-col gap-2">
                  <button type="button" className="btn btn-primary w-full" onClick={() => toLesson(true)}>
                    {t.quiz.reviewLesson}
                  </button>
                  <div className="flex gap-2">
                    <button type="button" className="btn flex-1" onClick={() => setTries(0)}>
                      {t.quiz.retry}
                    </button>
                    <button type="button" className="btn flex-1" onClick={() => record("skipped")}>
                      {t.quiz.skip}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* the tutor thinks along (cheers on a correct answer) — bottom-right, never over the answers */}
      {!done && (
        <div className="mt-auto pt-3">
          <QuizThinker characterId={ch.id} happy={flash} />
        </div>
      )}

      {/* end: passed */}
      {done && quizPassed(results) && next !== undefined && (
        <SuccessScreen
          title={t.success.title}
          subtitle={t.quiz.passText(pct, xp)}
          characterId={ch.id}
          primary={
            mode === "review"
              ? { label: t.quiz.title, onClick: () => restart("quiz") }
              : next
                ? { label: t.quiz.nextLesson, onClick: () => router.replace(`/lesson/${next}`) }
                : { label: t.quiz.toMap, onClick: toMap }
          }
          secondary={next && mode !== "review" ? { label: t.quiz.toMap, onClick: toMap } : { label: t.quiz.backToLesson, onClick: () => toLesson(false) }}
        />
      )}

      {/* end: under 60 % → encourage, back to the explanation or a quick review */}
      {done && !quizPassed(results) && (
        <div className="card mt-4 flex flex-col items-center gap-3 p-5 text-center" role="status" data-testid="quiz-fail">
          <TutorPortrait id={ch.id} pose="point" frame="half" alt={ch.name} className="h-[160px] w-[160px]" />
          <div className="text-[20px] font-black">{t.quiz.failTitle}</div>
          <div className="text-[14px] font-extrabold text-mut">{t.quiz.failText(pct)}</div>
          <button type="button" className="btn btn-primary w-full" onClick={() => toLesson(true)}>
            {t.quiz.backToLesson}
          </button>
          <button type="button" className="btn w-full" onClick={() => restart("review")}>
            {t.quiz.review}
          </button>
        </div>
      )}

      {/* × confirmation (an in-page sheet, not a browser dialog) */}
      {leaving && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label={t.quiz.leaveTitle}>
          <div className="card w-full max-w-[480px] p-5">
            <div className="text-[19px] font-black">{t.quiz.leaveTitle}</div>
            <div className="mt-1 text-[14px] font-bold text-mut">{t.quiz.leaveText}</div>
            <div className="mt-4 flex flex-col gap-2">
              <button type="button" className="btn btn-primary w-full" onClick={() => setLeaving(false)} autoFocus>
                {t.quiz.stay}
              </button>
              <button type="button" className="btn w-full" onClick={() => toLesson(false)}>
                {t.quiz.backToLesson}
              </button>
              <button type="button" className="btn w-full" onClick={toMap}>
                {t.quiz.toMap}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
