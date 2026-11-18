"use client";
// Kasb sinovi (career mission): the learner plays a job for 5 steps; each step is a real-world problem on
// the chosen skill (hand-written bank, no LLM). The tutor tells the story and reacts (wave → think →
// cheer / point). Right answers go through /api/games/answer (mathjs re-check, mastery capped).
import { useCallback, useEffect, useState } from "react";
import { t } from "@/i18n/uz";
import { GameFrame, Chip, Choices, EndCard, TutorReaction } from "@/components/games/GameKit";
import { useRound } from "@/components/games/useRound";
import TutorPortrait from "@/components/characters/TutorPortrait";
import { reportQuestion, saveBest, useGameSettings, type GameSettings } from "@/lib/games/client";
import { pickMission, type Career, type MissionStep } from "@/lib/games/mission";

export default function MissionGame({ settings }: { settings?: GameSettings }) {
  const { calm } = useGameSettings(settings); // a11y-hook
  const { skills, characterId } = useRound();
  const [career, setCareer] = useState<Career | null>(null);
  const [steps, setSteps] = useState<MissionStep[]>([]);
  const [phase, setPhase] = useState<"intro" | "play" | "end">("intro");
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [correct, setCorrect] = useState(0);
  const [xp, setXp] = useState(0);
  const [announce, setAnnounce] = useState("");
  const [end, setEnd] = useState<{ best: number; record: boolean } | null>(null);

  const setup = useCallback(() => {
    if (!skills) return;
    const param = new URLSearchParams(window.location.search).get("skill");
    const m = pickMission({ skillId: param ?? skills[0] ?? null });
    setCareer(m.career);
    setSteps(m.steps);
    setPhase("intro");
    setI(0);
    setPicked(null);
    setCorrect(0);
    setXp(0);
    setEnd(null);
    setAnnounce(m.career.intro);
  }, [skills]);
  useEffect(() => {
    setup();
  }, [setup]);

  const step = steps[i];
  const begin = () => {
    setPhase("play");
    if (steps[0]) setAnnounce(`${t.games.mission.step(1, steps.length)}. ${steps[0].story} ${steps[0].q}`);
  };

  const finish = (c: number) => {
    setPhase("end");
    if (career) setAnnounce(`${career.done} ${t.games.mission.result(c, steps.length)}`);
    void saveBest("mission", c).then(setEnd);
  };

  const next = () => {
    if (i + 1 >= steps.length) return finish(correct);
    const n = steps[i + 1];
    setI(i + 1);
    setPicked(null);
    setAnnounce(`${t.games.mission.step(i + 2, steps.length)}. ${n.story} ${n.q}`);
  };

  const pick = useCallback(
    (k: number) => {
      if (!step || picked != null) return;
      setPicked(k);
      const right = k === step.correct;
      if (right) {
        setCorrect((c) => c + 1);
        setAnnounce(t.games.right);
        void reportQuestion("mission", step, step.choices[k]).then((r) => r && setXp((x) => x + r.xp));
      } else {
        setAnnounce(`${t.games.wrong(step.choices[step.correct])}. ${step.hint}`);
      }
    },
    [step, picked],
  );

  const right = picked != null && step && picked === step.correct;

  return (
    <GameFrame title={t.games.mission.name} calm={calm} announce={announce} testId="game-mission" chip={career ? <Chip tone="gold">{career.title}</Chip> : undefined}>
      {/* the 5 steps of the job, as blocks */}
      {career && phase !== "intro" && (
        <div className="mb-3 flex gap-1.5" aria-hidden>
          {steps.map((_, k) => (
            <span key={k} className="vx-block block flex-1" style={{ height: 14, background: k < i || (k === i && phase === "end") ? "#22b45a" : k === i ? "#ffc42e" : "#dfe6fa" }} />
          ))}
        </div>
      )}

      {phase === "intro" && career && (
        <div className="card mt-2 flex flex-col items-center gap-3 p-5 text-center">
          <TutorPortrait id={characterId} pose="wave" frame="half" alt="" className="h-[170px] w-[170px] object-contain" />
          <span className="rounded-full bg-[#fff3d1] px-3 py-1 text-[13px] font-black text-[#8a5a00]">{t.games.mission.job(career.title)}</span>
          <div className="text-[19px] leading-snug font-black">{career.intro}</div>
          <div className="text-[14px] font-bold text-mut">{t.games.mission.desc}</div>
          <button type="button" className="btn btn-primary mt-1 w-full" onClick={begin} autoFocus disabled={!steps.length}>
            {t.games.mission.start}
          </button>
        </div>
      )}

      {phase === "play" && step && (
        <>
          <div className="text-[13px] font-extrabold text-mut">{t.games.mission.step(i + 1, steps.length)}</div>
          <div className="card mt-1.5 p-4">
            <div className="text-[15px] font-black text-blue">{step.story}</div>
            <div className="mt-1.5 text-[18px] leading-snug font-extrabold" data-testid="game-question">
              {step.q}
            </div>
          </div>
          <div className="mt-3">
            <Choices choices={step.choices} onPick={pick} disabled={picked != null} picked={picked} correct={picked != null ? step.correct : null} />
          </div>
          {picked != null && (
            <div className={`mt-3 rounded-[14px] px-3.5 py-3 text-[14px] font-extrabold ${right ? "bg-[#e6f8ee] text-[#157a3c]" : "bg-[#fff4e8] text-[#c2410c]"}`}>
              {right ? t.games.right : `${t.games.wrong(step.choices[step.correct])} · ${t.lesson.hint}: ${step.hint}`}
              <button type="button" className="btn btn-primary mt-2.5 w-full" onClick={next} autoFocus data-testid="mission-next">
                {t.common.next}
              </button>
            </div>
          )}
          <div className="mt-auto pt-2">
            <TutorReaction characterId={characterId} mood={picked == null ? "think" : right ? "cheer" : "hint"} />
          </div>
        </>
      )}

      {phase === "end" && career && (
        <EndCard title={career.done} line={t.games.mission.result(correct, steps.length)} best={end?.best ?? correct} record={!!end?.record} xp={xp} characterId={characterId} calm={calm} onAgain={setup} />
      )}
    </GameFrame>
  );
}
