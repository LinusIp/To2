"use client";
// Tezkor hisob (60-second speed round): short questions from the course bank, combo streak, timer bar.
// "Vaqtsiz rejim" turns the timer off (20 questions instead). Best score per learner (D1 + localStorage).
import { useCallback, useEffect, useRef, useState } from "react";
import { t } from "@/i18n/uz";
import { GameFrame, Chip, Choices, EndCard, TutorReaction } from "@/components/games/GameKit";
import { useRound } from "@/components/games/useRound";
import { fetchQuestions, loadBest, reportQuestion, saveBest, useGameSettings, type GameSettings } from "@/lib/games/client";
import { SPEED_SECONDS, SPEED_UNTIMED_QUESTIONS, comboMultiplier, speedAnswer, speedStart, type SpeedState } from "@/lib/games/scoring";
import type { GameQuestion } from "@/lib/games/questions";
import { readPref, writePref } from "@/lib/client/prefs";

export default function SpeedGame({ settings }: { settings?: GameSettings }) {
  const { calm } = useGameSettings(settings); // a11y-hook
  const { skills, characterId } = useRound();
  const [phase, setPhase] = useState<"ready" | "play" | "end">("ready");
  const [untimed, setUntimed] = useState(false);
  const [qs, setQs] = useState<GameQuestion[]>([]);
  const [i, setI] = useState(0);
  const [s, setS] = useState<SpeedState>(speedStart);
  const [left, setLeft] = useState(SPEED_SECONDS);
  const [picked, setPicked] = useState<number | null>(null);
  const [announce, setAnnounce] = useState("");
  const [xp, setXp] = useState(0);
  const [best, setBest] = useState(0);
  const [end, setEnd] = useState<{ best: number; record: boolean } | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(false);
  const shownAt = useRef(0);
  const sRef = useRef(s);
  sRef.current = s;

  useEffect(() => {
    setUntimed(readPref("games-untimed", "0") === "1");
    void loadBest().then((b) => setBest(b.speed ?? 0));
  }, []);

  const finish = useCallback(() => {
    setPhase("end");
    setAnnounce(t.games.speed.done(sRef.current.score, sRef.current.correct));
    void saveBest("speed", sRef.current.score).then((r) => {
      setEnd(r);
      setBest(r.best);
    });
  }, []);

  const begin = async () => {
    if (!skills) return;
    setLoading(true);
    setErr(false);
    try {
      const q = await fetchQuestions("speed", skills);
      setQs(q);
      setI(0);
      setS(speedStart());
      setLeft(SPEED_SECONDS);
      setPicked(null);
      setXp(0);
      setEnd(null);
      setPhase("play");
      shownAt.current = Date.now();
      if (q[0]) setAnnounce(q[0].q);
    } catch {
      setErr(true);
    } finally {
      setLoading(false);
    }
  };

  // the clock (paused while the tab is hidden — it is a timer, not a punishment)
  useEffect(() => {
    if (phase !== "play" || untimed) return;
    const iv = setInterval(() => {
      if (document.hidden) return;
      setLeft((x) => {
        const n = x - 1;
        if (n === 10) setAnnounce(t.games.speed.timeLeft(10));
        return n;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, [phase, untimed]);
  useEffect(() => {
    if (phase === "play" && !untimed && left <= 0) finish();
  }, [left, phase, untimed, finish]);

  const q = qs[i % Math.max(1, qs.length)];

  const pick = useCallback(
    (k: number) => {
      if (!q || picked != null || phase !== "play") return;
      const right = k === q.correct;
      const ns = speedAnswer(s, right);
      setS(ns);
      setPicked(k);
      if (right) void reportQuestion("speed", q, q.choices[k], Date.now() - shownAt.current).then((r) => r && setXp((x) => x + r.xp));
      const res = right ? `${t.games.right}${ns.streak >= 3 ? ` ${t.games.combo(comboMultiplier(ns.streak))}` : ""}` : t.games.wrong(q.choices[q.correct]);
      const lastUntimed = untimed && ns.answered >= SPEED_UNTIMED_QUESTIONS;
      setTimeout(
        () => {
          setPicked(null);
          if (lastUntimed || i + 1 >= qs.length) return finish();
          setI((x) => x + 1);
          shownAt.current = Date.now();
          setAnnounce(`${res}. ${qs[(i + 1) % qs.length].q}`);
        },
        right ? 380 : 1100,
      );
      setAnnounce(res);
    },
    [q, picked, phase, s, untimed, i, qs, finish],
  );

  const toggleUntimed = () => {
    setUntimed((u) => {
      writePref("games-untimed", u ? "0" : "1");
      return !u;
    });
  };

  const pct = untimed ? Math.round((s.answered / SPEED_UNTIMED_QUESTIONS) * 100) : Math.round((left / SPEED_SECONDS) * 100);

  return (
    <GameFrame title={t.games.speed.name} calm={calm} announce={announce} testId="game-speed" chip={<Chip>{t.games.speed.score(s.score)}</Chip>}>
      {phase === "ready" && (
        <div className="card mt-2 flex flex-col gap-3 p-5">
          <div className="text-[16px] font-extrabold">{t.games.speed.desc}</div>
          <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-2xl bg-soft px-3.5 py-2.5 font-extrabold">
            <input type="checkbox" className="h-5 w-5 accent-[#2f6bff]" checked={untimed} onChange={toggleUntimed} data-testid="speed-untimed" />
            <span>
              {t.games.speed.untimed}
              <span className="block text-[12px] text-mut">{t.games.speed.untimedHint}</span>
            </span>
          </label>
          <div className="text-[14px] font-extrabold text-mut">{t.games.best(best)}</div>
          {err && <div role="alert" className="font-extrabold text-[#c2410c]">{t.common.error}</div>}
          <button type="button" className="btn btn-primary w-full" onClick={() => void begin()} disabled={!skills || loading} autoFocus>
            {loading ? t.games.loading : t.games.speed.start}
          </button>
          <div className="mt-1">
            <TutorReaction characterId={characterId} mood="think" />
          </div>
        </div>
      )}

      {phase === "play" && q && (
        <>
          <div className={`timer-bar mt-1 ${!untimed && left <= 10 ? "low" : ""}`} role="progressbar" aria-label={untimed ? t.games.speed.untimed : t.games.speed.timeLeft(left)} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
            <span style={{ width: `${pct}%` }} />
          </div>
          <div className="mt-1.5 flex justify-between text-[13px] font-extrabold text-mut">
            <span>{untimed ? `${s.answered}/${SPEED_UNTIMED_QUESTIONS}` : t.games.speed.timeLeft(Math.max(0, left))}</span>
            {s.streak >= 3 && (
              <span key={s.streak} className="combo-pop rounded-full bg-gold px-2.5 text-[13px] font-black text-[#5a3b00]">
                {t.games.combo(comboMultiplier(s.streak))}
              </span>
            )}
          </div>
          <div className="card mt-3 p-5">
            <div className="text-center font-chalk text-[30px] leading-snug" data-testid="game-question">
              {q.q}
            </div>
          </div>
          <div className="mt-3">
            <Choices choices={q.choices} onPick={pick} disabled={picked != null} picked={picked} correct={picked != null ? q.correct : null} />
          </div>
          <div className="mt-auto pt-2">
            <TutorReaction characterId={characterId} mood={picked == null ? "think" : picked === q.correct ? "cheer" : "hint"} />
          </div>
        </>
      )}

      {phase === "end" && (
        <EndCard title={t.success.title} line={t.games.speed.done(s.score, s.correct)} best={end?.best ?? Math.max(best, s.score)} record={!!end?.record} xp={xp} characterId={characterId} calm={calm} onAgain={() => void begin()} />
      )}
    </GameFrame>
  );
}
