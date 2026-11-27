"use client";
// Tezkor hisob — a race. The tutor (full-body) runs along a chalk-lined track toward the finish flag
// (your record, or 100 m the first time); every right answer is a boost (+10 m × combo), a wrong one is
// a stumble. The question is on the stadium's chalk scoreboard, the clock beside it; the answers are race
// pads in the bottom tray. 60 seconds — or "Vaqtsiz rejim" (20 questions, no clock; forced on by the
// inclusive motor profile: <html data-untimed> → useGameSettings().untimed). Best score per learner.
import { useCallback, useEffect, useRef, useState } from "react";
import { t } from "@/i18n/uz";
import { GameFrame, Choices, EndCard, FullTutor, Bubble } from "@/components/games/GameKit";
import { useRound } from "@/components/games/useRound";
import { fetchQuestions, loadBest, reportQuestion, saveBest, useGameSettings, type GameSettings } from "@/lib/games/client";
import { SPEED_SECONDS, SPEED_UNTIMED_QUESTIONS, comboMultiplier, raceGoal, racePos, speedAnswer, speedStart, type SpeedState } from "@/lib/games/scoring";
import { play } from "@/lib/games/sfx";
import type { GameQuestion } from "@/lib/games/questions";
import type { Pose } from "@/components/characters/voxel";
import { readPref, writePref } from "@/lib/client/prefs";

function Track({ moving, fast }: { moving: boolean; fast: boolean }) {
  return (
    <svg viewBox="0 0 360 320" preserveAspectRatio="xMidYMax slice" aria-hidden>
      {/* the field and the stands, flat colours */}
      <rect x={-200} y={-200} width={760} height={720} fill="#2f5d3a" />
      {/* stands full of fans (voxel heads), a roof line and two banners */}
      <rect x={-200} y={-60} width={760} height={198} fill="#24493a" />
      <path d="M-200 -2H560" stroke="#8a5a2c" strokeWidth={6} />
      {Array.from({ length: 6 }, (_, r) =>
        Array.from({ length: 22 }, (_, i) => (
          <rect key={`${r}-${i}`} x={-24 + i * 19 + (r % 2) * 9} y={12 + r * 21} width={11} height={11} rx={2} fill={["#3f7bff", "#ffc42e", "#ff8a1f", "#f3f0e6", "#7ee0a0"][(i + r * 2) % 5]} opacity={0.5} />
        )),
      )}
      {[0, 1, 2, 3, 4, 5].map((r) => (
        <path key={r} d={`M-200 ${27 + r * 21}H560`} stroke="#1c3a2d" strokeWidth={4} />
      ))}
      {/* the running track with two lanes */}
      <rect x={-200} y={188} width={760} height={96} fill="#b4533a" />
      <path d="M-200 188H560M-200 236H560M-200 284H560" stroke="#f3f0e6" strokeWidth={3} />
      <g className={`race-lines ${moving ? (fast ? "" : "slow") : "stop"}`}>
        {Array.from({ length: 24 }, (_, i) => (
          <path key={i} d={`M${-40 + i * 40} 212h16M${-40 + i * 40} 260h16`} stroke="#f3f0e6" strokeWidth={2} opacity={0.5} />
        ))}
      </g>
      <rect x={-200} y={284} width={760} height={40} fill="#2f5d3a" />
    </svg>
  );
}

export default function SpeedGame({ settings }: { settings?: GameSettings }) {
  const { calm, untimed: a11yUntimed } = useGameSettings(settings); // a11y-hook
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
  const [fly, setFly] = useState<{ key: number; amount: number; from?: { x: number; y: number } } | null>(null);
  const [best, setBest] = useState(0);
  const [goal, setGoal] = useState(100);
  const [end, setEnd] = useState<{ best: number; record: boolean } | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(false);
  const [boost, setBoost] = useState(0); // key of the last boost (speed lines)
  const [stumble, setStumble] = useState(0);
  const shownAt = useRef(0);
  const runner = useRef<HTMLDivElement>(null);
  const sRef = useRef(s);
  sRef.current = s;

  useEffect(() => {
    setUntimed(readPref("games-untimed", "0") === "1");
    void loadBest().then((b) => {
      setBest(b.speed ?? 0);
      setGoal(raceGoal(b.speed ?? 0));
    });
  }, []);
  // a11y-hook: the motor profile ("vaqt cheklovi yo'q") always plays without the timer
  useEffect(() => {
    if (a11yUntimed) setUntimed(true);
  }, [a11yUntimed]);

  const finish = useCallback(() => {
    setPhase("end");
    setAnnounce(t.games.speed.done(sRef.current.score, sRef.current.correct));
    play("win", { soft: calm });
    void saveBest("speed", sRef.current.score).then((r) => {
      setEnd(r);
      setBest(r.best);
    });
  }, [calm]);

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
      setGoal(raceGoal(best));
      setPhase("play");
      play("boost", { soft: calm });
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
        if (n <= 5 && n > 0) play("tick", { soft: calm });
        return n;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, [phase, untimed, calm]);
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
      if (right) {
        setBoost(Date.now());
        play(ns.streak >= 3 ? "combo" : "boost", { soft: calm });
        void reportQuestion("speed", q, q.choices[k], Date.now() - shownAt.current).then((r) => {
          if (!r) return;
          setXp((x) => x + r.xp);
          const b = runner.current?.getBoundingClientRect();
          setFly({ key: Date.now(), amount: r.xp, from: b ? { x: b.left + b.width / 2, y: b.top + 10 } : undefined });
        });
      } else {
        setStumble(Date.now());
        play("stumble", { soft: calm });
      }
      const res = right ? `${t.games.right}${ns.streak >= 3 ? ` ${t.games.combo(comboMultiplier(ns.streak))}` : ""} ${t.games.speed.meters(ns.score)}` : t.games.wrong(q.choices[q.correct]);
      const lastUntimed = untimed && ns.answered >= SPEED_UNTIMED_QUESTIONS;
      setTimeout(
        () => {
          setPicked(null);
          if (lastUntimed || i + 1 >= qs.length) return finish();
          setI((x) => x + 1);
          shownAt.current = Date.now();
          setAnnounce(`${res}. ${qs[(i + 1) % qs.length].q}`);
        },
        right ? 420 : 1100,
      );
      setAnnounce(res);
    },
    [q, picked, phase, s, untimed, i, qs, finish, calm],
  );

  const toggleUntimed = () => {
    setUntimed((u) => {
      writePref("games-untimed", u ? "0" : "1");
      return !u;
    });
  };

  const pct = untimed ? Math.round((s.answered / SPEED_UNTIMED_QUESTIONS) * 100) : Math.round((left / SPEED_SECONDS) * 100);
  const pos = racePos(s.score, goal);
  const right = picked != null && q && picked === q.correct;
  const pose: Pose = phase === "end" ? "cheer" : right ? "cheer" : picked != null ? "point" : phase === "play" ? "thumbs" : "wave";
  const passed = s.score > goal && best > 0;

  return (
    <GameFrame bleed title={t.games.speed.name} calm={calm} announce={announce} testId="game-speed" xp={xp} xpFly={fly}>
      <div className="race-scene">
        <Track moving={phase === "play" && !calm} fast={!!right} />
        {/* scoreboard: the question + the clock */}
        <div className="absolute inset-x-3 top-2 z-[2] flex gap-2">
          <div className="chalk-sign min-w-0 flex-1">
            <div className="text-[12px] font-extrabold text-[#cfd8cf]">{t.games.speed.meters(s.score)}</div>
            <div className="font-chalk text-[26px] leading-tight" data-testid="game-question">
              {phase === "play" && q ? q.q : phase === "end" ? t.games.speed.done(s.score, s.correct) : t.games.speed.ready}
            </div>
          </div>
          <div
            className={`chalk-sign flex w-[76px] flex-none flex-col items-center justify-center ${!untimed && left <= 10 && phase === "play" ? "text-[#ffb3a0]" : ""}`}
            role="progressbar"
            aria-label={untimed ? t.games.speed.untimed : t.games.speed.timeLeft(left)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pct}
            data-testid="speed-clock"
          >
            <span className="font-chalk text-[28px] leading-none">{untimed ? `${s.answered}/${SPEED_UNTIMED_QUESTIONS}` : Math.max(0, left)}</span>
            <span className="text-[11px] font-extrabold text-[#cfd8cf]">{untimed ? t.games.speed.untimedShort : t.games.speed.seconds}</span>
          </div>
        </div>
        {/* finish flag = your record (or 100 m) */}
        <div className="absolute bottom-[104px] z-[1] flex -translate-x-1/2 flex-col items-center" style={{ left: "86%" }} aria-hidden>
          <span className="rounded-md bg-[#f3f0e6] px-1.5 py-0.5 text-[11px] font-black whitespace-nowrap text-[#253a30]">{best > 0 ? t.games.speed.record(goal) : t.games.speed.finish(goal)}</span>
          <span className="h-[64px] w-[3px] bg-[#f3f0e6]" />
          <span className="absolute top-[22px] left-[3px] h-[14px] w-[20px] bg-[repeating-conic-gradient(#253a30_0_25%,#f3f0e6_0_50%)] bg-[length:10px_10px]" />
        </div>
        {/* the runner: the tutor, full-body, on the near lane */}
        <div ref={runner} className="race-runner absolute bottom-[62px] z-[2] h-[132px] w-[96px]" style={{ left: `calc(${4 + pos * 72}% - 10px)` }} data-testid="race-runner" data-pos={pos.toFixed(2)}>
          {boost > 0 && right && (
            <span key={boost} className="race-boost absolute top-[46px] -left-[34px] flex flex-col gap-2" aria-hidden>
              <span className="h-[4px] w-[34px] rounded bg-[#ffe066]" />
              <span className="h-[4px] w-[24px] rounded bg-[#ffe066]" />
              <span className="h-[4px] w-[30px] rounded bg-[#ffe066]" />
            </span>
          )}
          <div key={stumble} className={picked != null && !right && !calm ? "race-stumble h-full w-full" : "h-full w-full"}>
            <FullTutor id={characterId} pose={pose} act={phase === "play" && !calm ? "run" : phase === "end" && !calm ? "cheer" : null} className="h-full w-full" />
          </div>
        </div>
        {picked != null && q && (
          <Bubble className="bottom-[200px] left-[14px]" tail="left">
            {right ? (s.streak >= 3 ? t.games.combo(comboMultiplier(s.streak)) : t.games.speed.boost) : t.games.wrong(q.choices[q.correct])}
          </Bubble>
        )}
        {passed && phase !== "ready" && (
          <Bubble className="right-[14px] bottom-[200px]" tail="right">
            {t.games.newRecord}
          </Bubble>
        )}
      </div>

      <div className="game-tray">
        {phase === "ready" && (
          <div className="flex flex-col gap-2.5">
            <div className="text-[15px] font-extrabold">{t.games.speed.desc}</div>
            <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-2xl bg-soft px-3.5 py-2 font-extrabold">
              <input type="checkbox" className="h-5 w-5 accent-[#2f6bff]" checked={untimed} onChange={toggleUntimed} disabled={a11yUntimed} data-testid="speed-untimed" />
              <span>
                {t.games.speed.untimed}
                <span className="block text-[12px] text-mut">{a11yUntimed ? t.a11y.untimedByProfile : t.games.speed.untimedHint}</span>
              </span>
            </label>
            {err && (
              <div role="alert" className="font-extrabold text-[#c2410c]">
                {t.common.error}
              </div>
            )}
            <button type="button" className="btn btn-primary w-full" onClick={() => void begin()} disabled={!skills || loading} autoFocus>
              {loading ? t.games.loading : `${t.games.speed.start} · ${t.games.best(best)}`}
            </button>
          </div>
        )}
        {phase === "play" && q && <Choices variant="lanes" question={q.q} choices={q.choices} onPick={pick} disabled={picked != null} picked={picked} correct={picked != null ? q.correct : null} />}
        {phase === "end" && (
          <EndCard hideTutor title={passed || end?.record ? t.games.newRecord : t.success.title} line={t.games.speed.done(s.score, s.correct)} best={end?.best ?? Math.max(best, s.score)} record={!!end?.record} xp={xp} characterId={characterId} calm={calm} onAgain={() => void begin()} />
        )}
      </div>
    </GameFrame>
  );
}
