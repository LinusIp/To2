"use client";
// Blok minorasi (Block Tower): 10 four-choice questions from the course bank. Right → a voxel block
// drops onto the tower with a bounce (combo ×2/×3 = a bigger golden block); wrong → the block wobbles
// and falls off and the tutor points at the hint. Height = score. Keys 1–4 answer; aria-live reads all.
import { useCallback, useEffect, useRef, useState } from "react";
import { t } from "@/i18n/uz";
import { GameFrame, Chip, Choices, EndCard, TutorReaction } from "@/components/games/GameKit";
import { useRound } from "@/components/games/useRound";
import { fetchQuestions, reportQuestion, saveBest, useGameSettings, type GameSettings } from "@/lib/games/client";
import { TOWER_QUESTIONS, comboMultiplier, towerAnswer, towerStart, type TowerState } from "@/lib/games/scoring";
import type { GameQuestion } from "@/lib/games/questions";
import { getSkill } from "@/data/skills";

const COLORS = ["#4d86ff", "#22b45a", "#ff8a1f", "#8a5cf6", "#2fb8c9", "#ff6b9a"];
const GOLD = "#ffc42e";
const GOLD3 = "#ff9f1c";

export default function TowerGame({ settings }: { settings?: GameSettings }) {
  const { calm } = useGameSettings(settings); // a11y-hook
  const { skills, characterId } = useRound();
  const [qs, setQs] = useState<GameQuestion[] | null>(null);
  const [err, setErr] = useState(false);
  const [s, setS] = useState<TowerState>(towerStart);
  const [picked, setPicked] = useState<number | null>(null);
  const [shown, setShown] = useState(0); // the question on screen (s.index moves on at the answer)
  const [falling, setFalling] = useState<number | null>(null); // key of the falling block
  const [hint, setHint] = useState<string | null>(null);
  const [mood, setMood] = useState<"think" | "cheer" | "hint">("think");
  const [announce, setAnnounce] = useState("");
  const [xp, setXp] = useState(0);
  const [end, setEnd] = useState<{ best: number; record: boolean } | null>(null);
  const started = useRef(0);

  const start = useCallback(async () => {
    if (!skills) return;
    setQs(null);
    setErr(false);
    setS(towerStart());
    setShown(0);
    setPicked(null);
    setHint(null);
    setMood("think");
    setXp(0);
    setEnd(null);
    try {
      const q = await fetchQuestions("tower", skills);
      setQs(q);
      started.current = Date.now();
      if (q[0]) setAnnounce(`${t.games.question(1, q.length)}. ${q[0].q}`);
    } catch {
      setErr(true);
    }
  }, [skills]);

  useEffect(() => {
    void start();
  }, [start]);

  const total = qs ? Math.min(TOWER_QUESTIONS, qs.length) : TOWER_QUESTIONS;
  const q = qs?.[shown];

  const next = useCallback(
    (ns: TowerState) => {
      if (ns.done) return;
      setPicked(null);
      setHint(null);
      setMood("think");
      setShown(ns.index);
      started.current = Date.now();
      const nq = qs?.[ns.index];
      if (!ns.done && nq) setAnnounce(`${t.games.question(ns.index + 1, total)}. ${nq.q}`);
    },
    [qs, total],
  );

  const pick = useCallback(
    (i: number) => {
      if (!q || picked != null || s.done) return;
      const right = i === q.correct;
      const ns = towerAnswer(s, right, total);
      setPicked(i);
      setS(ns);
      if (right) {
        const m = comboMultiplier(ns.streak);
        setMood("cheer");
        setAnnounce(`${t.games.right} ${t.games.tower.placed(m)} ${t.games.tower.height(ns.height)}`);
        void reportQuestion("tower", q, q.choices[i], Date.now() - started.current).then((r) => r && setXp((x) => x + r.xp));
        setTimeout(() => next(ns), calm ? 700 : 950);
      } else {
        setFalling(ns.index);
        setMood("hint");
        setHint(q.hint);
        setAnnounce(`${t.games.wrong(q.choices[q.correct])}. ${t.games.tower.fell} ${q.hint}`);
        setTimeout(() => setFalling(null), 1000);
      }
      if (ns.done) void saveBest("tower", ns.height).then(setEnd);
    },
    [q, picked, s, total, calm, next],
  );

  const skillTitle = skills?.length === 1 ? getSkill(skills[0])?.title_uz : null;
  const blocks = s.blocks;

  return (
    <GameFrame title={t.games.tower.name} calm={calm} announce={announce} testId="game-tower" chip={<Chip>{t.games.tower.height(s.height)}</Chip>}>
      <div className="mb-2 text-[13px] font-extrabold text-mut">{skillTitle ? t.games.topic(skillTitle) : t.games.mixed}</div>

      {/* the tower */}
      <div className={`relative flex h-[230px] flex-none items-end justify-center overflow-hidden rounded-[22px] ${picked != null && q && picked !== q.correct ? "tower-shake" : ""}`} style={{ background: "linear-gradient(180deg,#dbe7ff 0%,#eef3ff 70%,#cfe3c4 70%,#b9d8a8 100%)" }} aria-hidden>
        <div className="absolute right-3 top-2 flex gap-1.5">
          {s.streak >= 3 && (
            <span key={s.streak} className="combo-pop rounded-full bg-gold px-3 py-1 text-[14px] font-black text-[#5a3b00]">
              {t.games.combo(comboMultiplier(s.streak))}
            </span>
          )}
        </div>
        <div className="relative mb-[18%] flex w-[150px] flex-col-reverse items-stretch gap-[3px]">
          {/* show the newest 5 blocks; taller towers scroll down (the count is in the chip) */}
          {blocks.slice(-5).map((m, i, arr) => {
            const idx = blocks.length - arr.length + i;
            const isNew = idx === blocks.length - 1 && picked != null;
            return (
              <div key={idx} className={`vx-block ${isNew ? "vx-drop" : ""}`} style={{ background: m === 3 ? GOLD3 : m === 2 ? GOLD : COLORS[idx % COLORS.length], height: 20 + m * 6, marginLeft: (idx % 3) * 4 - 4 }}>
                {m > 1 && <span className="vx-tag">×{m}</span>}
              </div>
            );
          })}
          {falling != null && <div key={`f${falling}`} className="vx-block vx-fall absolute bottom-full left-0 right-0" style={{ background: "#ff6b6b" }} />}
        </div>
        <div className="absolute bottom-[14%] left-1/2 h-[10px] w-[190px] -translate-x-1/2 rounded-md bg-[#8a5a2c] shadow-[inset_0_-3px_0_rgba(0,0,0,.2)]" />
      </div>

      {err && (
        <div className="card mt-3 p-4 text-center font-extrabold" role="alert">
          {t.common.error}
          <button type="button" className="btn btn-primary mt-3 w-full" onClick={() => void start()}>
            {t.common.retry}
          </button>
        </div>
      )}

      {!s.done && !err && (
        <>
          <div className="card mt-3 p-4">
            <div className="text-[13px] font-extrabold text-mut">{t.games.question(Math.min(shown + 1, total), total)}</div>
            <div className="mt-1 text-center font-chalk text-[24px] leading-snug" data-testid="game-question">
              {q ? q.q : qs && !qs.length ? t.games.noQuestions : t.games.loading}
            </div>
          </div>
          {q && (
            <div className="mt-3">
              <Choices choices={q.choices} onPick={pick} disabled={picked != null} picked={picked} correct={picked != null ? q.correct : null} />
            </div>
          )}
          {hint && q && (
            <div className="mt-3 rounded-[14px] bg-[#fff4e8] px-3.5 py-3 text-[14px] font-extrabold text-[#c2410c]">
              {t.games.wrong(q.choices[q.correct])} · {t.lesson.hint}: {hint}
              <button type="button" className="btn btn-primary mt-2.5 w-full" onClick={() => next(s)} autoFocus>
                {t.common.next}
              </button>
            </div>
          )}
          <div className="mt-auto pt-2">
            <TutorReaction characterId={characterId} mood={mood} bubble={mood === "cheer" ? t.games.right : undefined} />
          </div>
        </>
      )}

      {s.done && (
        <>
          {/* wrong last answer: show its hint above the result */}
          {hint && q && <div className="mt-3 rounded-[14px] bg-[#fff4e8] px-3.5 py-3 text-[14px] font-extrabold text-[#c2410c]">{t.games.wrong(q.choices[q.correct])} · {hint}</div>}
          <EndCard title={t.success.title} line={t.games.tower.done(s.height)} best={end?.best ?? s.height} record={!!end?.record} xp={xp} characterId={characterId} calm={calm} onAgain={() => void start()} />
        </>
      )}
    </GameFrame>
  );
}
