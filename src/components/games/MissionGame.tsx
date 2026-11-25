"use client";
// Kasb sinovi (career mission): the learner plays a job for 5 steps; each step is a real-world problem on
// the chosen skill (hand-written bank, no LLM) with a chalk scene that fills in as they answer (bricks fill
// the row, tiles cover the floor…). At the end the 5 solved scenes become the job's finished building.
// A replay picks a different job of the same course. Right answers go through /api/games/answer
// (mathjs re-check, mastery capped). Captions only — no new voice lines.
import { useCallback, useEffect, useState } from "react";
import { t } from "@/i18n/uz";
import { GameFrame, Chip, Choices, EndCard } from "@/components/games/GameKit";
import { useRound } from "@/components/games/useRound";
import TutorPortrait from "@/components/characters/TutorPortrait";
import MissionScene from "@/components/games/MissionScene";
import MissionFinale from "@/components/games/MissionFinale";
import { reportQuestion, saveBest, useGameSettings, type GameSettings } from "@/lib/games/client";
import { courseOf, pickMission, type Job, type MissionStep } from "@/lib/games/mission";

const LAST_JOB = (course: string) => `to2:games:mission:lastJob:${course}`;
const readLast = (course: string) => {
  try {
    return localStorage.getItem(LAST_JOB(course));
  } catch {
    return null;
  }
};
const writeLast = (course: string, id: string) => {
  try {
    localStorage.setItem(LAST_JOB(course), id);
  } catch {
    /* blocked storage: replays may repeat a job */
  }
};

/** the tutor in a frame (not a floating waist-cut figure), with its reaction pose */
function TutorFrame({ id, pose }: { id: string; pose: "idle" | "cheer" | "point" | "wave" }) {
  return (
    <span className="h-14 w-14 flex-none overflow-hidden rounded-2xl border-2 border-line bg-soft2" aria-hidden>
      <TutorPortrait id={id} pose={pose} frame="face" alt="" className="h-14 w-14" />
    </span>
  );
}

export default function MissionGame({ settings }: { settings?: GameSettings }) {
  const { calm } = useGameSettings(settings); // a11y-hook
  const { skills, characterId } = useRound();
  const [job, setJob] = useState<Job | null>(null);
  const [steps, setSteps] = useState<MissionStep[]>([]);
  const [phase, setPhase] = useState<"intro" | "play" | "end">("intro");
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [results, setResults] = useState<boolean[]>([]);
  const [xp, setXp] = useState(0);
  const [announce, setAnnounce] = useState("");
  const [end, setEnd] = useState<{ best: number; record: boolean } | null>(null);

  const setup = useCallback(() => {
    if (!skills) return;
    const q = new URLSearchParams(window.location.search);
    const skillId = q.get("skill") ?? skills[0] ?? null;
    const course = courseOf(skillId);
    const m = pickMission({ skillId, course, jobId: q.get("job") ?? undefined, lastJobId: readLast(course) });
    writeLast(course, m.job.id);
    setJob(m.job);
    setSteps(m.steps);
    setPhase("intro");
    setI(0);
    setPicked(null);
    setResults([]);
    setXp(0);
    setEnd(null);
    setAnnounce(m.job.intro);
  }, [skills]);
  useEffect(() => {
    setup();
  }, [setup]);

  const step = steps[i];
  const correct = results.filter(Boolean).length;
  const begin = () => {
    setPhase("play");
    if (steps[0]) setAnnounce(`${t.games.mission.step(1, steps.length)}. ${steps[0].story} ${steps[0].q}`);
  };

  const finish = () => {
    setPhase("end");
    if (job) setAnnounce(`${job.done} ${t.games.mission.result(correct, steps.length)} ${t.games.mission.built(job.finale.sign)}`);
    void saveBest("mission", correct).then(setEnd);
  };

  const next = () => {
    if (i + 1 >= steps.length) return finish();
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
      setResults((r) => [...r, right]);
      if (right) {
        setAnnounce(`${t.games.right} ${t.games.mission.sceneDone}`);
        void reportQuestion("mission", step, step.choices[k]).then((r) => r && setXp((x) => x + r.xp));
      } else {
        setAnnounce(`${t.games.wrong(step.choices[step.correct])}. ${step.hint}`);
      }
    },
    [step, picked],
  );

  const right = picked != null && step && picked === step.correct;
  const answerOf = (s: MissionStep) => s.choices[s.correct];

  return (
    <GameFrame title={t.games.mission.name} calm={calm} announce={announce} testId="game-mission" chip={job ? <Chip tone="gold">{job.title}</Chip> : undefined}>
      {/* the 5 steps of the job, as blocks: green = done, orange = built with help, yellow = now */}
      {job && phase !== "intro" && (
        <div className="mb-2.5 flex gap-1.5" aria-hidden>
          {steps.map((_, k) => (
            <span key={k} className="vx-block block flex-1" style={{ height: 14, background: k < results.length ? (results[k] ? "#22b45a" : "#ff8a1f") : k === i ? "#ffc42e" : "#dfe6fa" }} />
          ))}
        </div>
      )}

      {phase === "intro" && job && (
        <div className="card mt-2 flex flex-col items-center gap-3 p-5 text-center" data-testid="mission-intro" data-job={job.id}>
          <TutorPortrait id={characterId} pose="wave" frame="half" alt="" className="h-[150px] w-[150px] object-contain" />
          <span className="rounded-full bg-[#fff3d1] px-3 py-1 text-[13px] font-black text-[#8a5a00]">{t.games.mission.job(job.title)}</span>
          <div className="text-[19px] leading-snug font-black">{job.intro}</div>
          <div className="text-[14px] font-bold text-mut">{t.games.mission.goal(job.finale.sign)}</div>
          <button type="button" className="btn btn-primary mt-1 w-full" onClick={begin} autoFocus disabled={!steps.length}>
            {t.games.mission.start}
          </button>
        </div>
      )}

      {phase === "play" && step && (
        <>
          <div className="flex items-center gap-2.5">
            <TutorFrame id={characterId} pose={picked == null ? "idle" : right ? "cheer" : "point"} />
            <div className="min-w-0 flex-1 rounded-[16px] rounded-tl-[4px] bg-white px-3 py-2 shadow-[0_4px_12px_rgba(20,40,100,.08)]">
              <div className="text-[12px] font-extrabold text-mut">{t.games.mission.step(i + 1, steps.length)}</div>
              <div className="text-[15px] leading-tight font-black text-blue">{step.story}</div>
            </div>
          </div>
          <div className="mt-2.5">
            <MissionScene scene={step.scene} solved={picked != null} answer={answerOf(step)} label={`${step.story} ${picked != null ? `${t.games.mission.sceneAnswer} ${answerOf(step)}` : ""}`} className="block w-full" />
          </div>
          <div className="mt-2.5 text-[17px] leading-snug font-extrabold" data-testid="game-question">
            {step.q}
          </div>
          <div className="mt-2.5">
            <Choices choices={step.choices} onPick={pick} disabled={picked != null} picked={picked} correct={picked != null ? step.correct : null} />
          </div>
          {picked != null && (
            <div className={`mt-2.5 rounded-[14px] px-3.5 py-3 text-[14px] font-extrabold ${right ? "bg-[#e6f8ee] text-[#157a3c]" : "bg-[#fff4e8] text-[#c2410c]"}`}>
              {right ? `${t.games.right} ${t.games.mission.sceneDone}` : `${t.games.wrong(step.choices[step.correct])} · ${t.lesson.hint}: ${step.hint}`}
              <button type="button" className="btn btn-primary mt-2.5 w-full" onClick={next} autoFocus data-testid="mission-next">
                {i + 1 >= steps.length ? t.games.mission.finish : t.common.next}
              </button>
            </div>
          )}
        </>
      )}

      {phase === "end" && job && (
        <EndCard
          title={job.done}
          line={t.games.mission.result(correct, steps.length)}
          best={end?.best ?? correct}
          record={!!end?.record}
          xp={xp}
          characterId={characterId}
          calm={calm}
          onAgain={setup}
          extra={
            <div className="mt-1 w-full">
              <MissionFinale kind={job.finale.kind} sign={job.finale.sign} steps={steps.map((s) => ({ scene: s.scene, answer: answerOf(s) }))} results={results} label={t.games.mission.built(job.finale.sign)} />
              <div className="mt-1.5 text-[13px] font-extrabold text-mut">{t.games.mission.built(job.finale.sign)}</div>
            </div>
          }
        />
      )}
    </GameFrame>
  );
}
