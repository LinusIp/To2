"use client";
// Tutor animation bench: pick a tutor, poke every animation state, slow time down, and run a
// short scripted "lesson" (talk → turn → write 3 strokes → walk → turn back → praise) with a
// synthetic chalk tip moving at hand speed. The strokes are drawn on the board so you can see
// whether the chalk stays on the line.
import { useCallback, useEffect, useRef, useState } from "react";
import TutorCanvas from "@/components/characters/TutorCanvas";
import LipsyncDebug from "./LipsyncDebug";
import { mouth } from "@/lib/audio/lipsync";
import { BOARD_S, BOARD_X, BOARD_Y, COMPACT_VIEW, FULL_VIEW, Room, type StageView } from "@/components/lesson/ClassroomStage";
import type { AnimInput, AnimState, Emotion, TutorAnimator } from "@/components/characters/anim/animator";

type Pt = [number, number];
const TUTORS = [
  { id: "blokbek", label: "Blokbek" },
  { id: "lola", label: "Lola" },
  { id: "ziyo", label: "Ziyo" },
  { id: "agent-shox", label: "makeChar (fallback)" },
];

// strokes in board coords (1000×625): "1/2 + 1/3" on the first row, then one far to the right
const ROW1: Pt[][] = [
  [[70, 50], [80, 42], [80, 105]], // 1
  [[55, 125], [110, 125]], // fraction bar
  [[58, 150], [70, 140], [88, 142], [92, 156], [60, 190], [96, 190]], // 2
];
const FAR: Pt[][] = [[[820, 70], [870, 70], [845, 70], [845, 150]]]; // T on the right
const LOW: Pt[][] = [[[120, 520], [260, 520]]]; // low row (bend)

interface Sim {
  t: number;
  speed: number;
  talking: boolean;
  listening: boolean;
  thinking: boolean;
  emotion: Emotion;
  tipActive: boolean;
  tip: Pt;
  focusCount: number;
  focus: Pt;
  praiseCount: number;
  queue: Pt[][]; // strokes still to write
  seg: number; // index into the current stroke's points
  pause: number; // ms of pen-up left before the next stroke
}

const newSim = (): Sim => ({
  t: 0, speed: 1, talking: false, listening: false, thinking: false, emotion: "neutral",
  tipActive: false, tip: [0, 0], focusCount: 0, focus: [0, 0], praiseCount: 0, queue: [], seg: 0, pause: 0,
});

export default function DevTutor() {
  const [tutor, setTutor] = useState("blokbek");
  const realVoice = useRef(false);
  const [view, setView] = useState<StageView>(FULL_VIEW);
  const [speed, setSpeed] = useState(1);
  const [state, setState] = useState<AnimState>("idle");
  const [ink, setInk] = useState<Pt[][]>([]);
  const [running, setRunning] = useState(false);
  const sim = useRef<Sim>(newSim());
  const anim = useRef<TutorAnimator | null>(null);
  const inkRef = useRef<Pt[][]>([]);
  const scriptGen = useRef(0);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const set = () => setView(mq.matches ? COMPACT_VIEW : FULL_VIEW);
    set();
    mq.addEventListener("change", set);
    return () => mq.removeEventListener("change", set);
  }, []);

  // simulation loop: advances the chalk tip along the queued strokes at ~500 board px/s
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const s = sim.current;
      const dt = Math.min(1 / 30, (now - last) / 1000) * s.speed;
      last = now;
      s.t += dt * 1000;
      if (s.queue.length && anim.current?.holdBoard && s.seg > 0) {
        s.tipActive = true; // the tutor asked the board to wait (turning / walking to the stroke)
      } else if (s.queue.length) {
        if (s.pause > 0) {
          s.pause -= dt * 1000;
          s.tipActive = true; // pen-up between strokes: the tip still "belongs" to the writing
          return;
        }
        const stroke = s.queue[0];
        if (s.seg === 0) {
          s.tip = [stroke[0][0], stroke[0][1]];
          inkRef.current = [...inkRef.current, [[stroke[0][0], stroke[0][1]]]];
          s.seg = 1;
        }
        let step = 500 * dt;
        while (step > 0 && s.seg < stroke.length) {
          const [tx, ty] = stroke[s.seg];
          const dx = tx - s.tip[0];
          const dy = ty - s.tip[1];
          const d = Math.hypot(dx, dy);
          if (d <= step) {
            s.tip = [tx, ty];
            step -= d;
            s.seg++;
          } else {
            s.tip = [s.tip[0] + (dx / d) * step, s.tip[1] + (dy / d) * step];
            step = 0;
          }
        }
        const cur = inkRef.current[inkRef.current.length - 1];
        inkRef.current = [...inkRef.current.slice(0, -1), [...cur, [s.tip[0], s.tip[1]]]];
        setInk(inkRef.current);
        s.tipActive = true;
        if (s.seg >= stroke.length) {
          s.queue.shift();
          s.seg = 0;
          s.pause = 60;
        }
      } else s.tipActive = false;
    };
    raf = requestAnimationFrame(tick);
    const poll = setInterval(() => anim.current && setState(anim.current.state), 100);
    return () => {
      cancelAnimationFrame(raf);
      clearInterval(poll);
    };
  }, []);

  const driver = useCallback((inp: AnimInput) => {
    const s = sim.current;
    if (realVoice.current) {
      // a real voice line is playing (lip-sync overlay): the mouth follows its audio
      inp.talking = mouth.speaking;
      inp.amp = mouth.amp;
    } else {
      inp.talking = s.talking;
      // synthetic voice: syllable-like bursts with short gaps
      const ph = s.t / 1000;
      const syl = Math.abs(Math.sin(ph * 9.5)) * (0.55 + 0.45 * Math.abs(Math.sin(ph * 2.3 + 1)));
      inp.amp = s.talking ? (Math.sin(ph * 1.7) > -0.85 ? syl : 0) : 0;
    }
    inp.listening = s.listening;
    inp.thinking = s.thinking;
    inp.emotion = s.emotion;
    inp.tipActive = s.tipActive;
    inp.tipX = s.tip[0];
    inp.tipY = s.tip[1];
    inp.focusCount = s.focusCount;
    inp.focusX = s.focus[0];
    inp.focusY = s.focus[1];
    inp.praiseCount = s.praiseCount;
  }, []);

  const onReady = useCallback((a: TutorAnimator) => {
    anim.current = a;
    a.speed = sim.current.speed;
  }, []);

  const setSpd = (v: number) => {
    setSpeed(v);
    sim.current.speed = v;
    if (anim.current) anim.current.speed = v;
  };

  const reset = () => {
    scriptGen.current++;
    setRunning(false);
    const s = sim.current;
    Object.assign(s, { talking: false, listening: false, thinking: false, emotion: "neutral", queue: [], seg: 0, pause: 0, tipActive: false });
  };
  const clearInk = () => {
    inkRef.current = [];
    setInk([]);
  };
  const write = (strokes: Pt[][]) => {
    sim.current.queue.push(...strokes.map((st) => st.map((p) => [p[0], p[1]] as Pt)));
  };

  /** wait in simulated time (respects the speed slider) */
  const wait = (ms: number, gen: number) =>
    new Promise<void>((res) => {
      const end = sim.current.t + ms;
      const iv = setInterval(() => {
        if (sim.current.t >= end || gen !== scriptGen.current) {
          clearInterval(iv);
          res();
        }
      }, 16);
    });
  const until = (f: () => boolean, gen: number) =>
    new Promise<void>((res) => {
      const iv = setInterval(() => {
        if (f() || gen !== scriptGen.current) {
          clearInterval(iv);
          res();
        }
      }, 16);
    });

  const playScript = async () => {
    reset();
    clearInk();
    const gen = ++scriptGen.current;
    setRunning(true);
    const s = sim.current;
    s.talking = true; // talk
    await wait(2200, gen);
    s.talking = false;
    write(ROW1); // turn → write 3 strokes
    await until(() => !s.queue.length, gen);
    await wait(250, gen);
    write(FAR); // walk along the board, write
    await until(() => !s.queue.length, gen);
    await wait(1500, gen); // turn back
    s.praiseCount++; // praise
    await wait(2200, gen);
    if (gen === scriptGen.current) setRunning(false);
  };

  const s = sim.current;
  const btn = "rounded-full bg-white px-3 py-2 text-[13px] font-bold shadow-[0_2px_8px_rgba(0,0,0,.1)] active:scale-95";
  return (
    <main className="mx-auto max-w-[1100px] p-3">
      <h1 className="mb-2 text-[18px] font-black">Tutor animation bench</h1>
      <div className="mb-2 flex flex-wrap gap-2">
        {TUTORS.map((t) => (
          <button key={t.id} type="button" className={`${btn} ${tutor === t.id ? "!bg-blue text-white" : ""}`} onClick={() => setTutor(t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      <div className="relative w-full overflow-hidden rounded-[16px]" style={{ aspectRatio: `${view.w} / ${view.h}` }}>
        <svg viewBox={`${view.x0} ${view.y0} ${view.w} ${view.h}`} className="absolute inset-0 h-full w-full">
          <Room />
          <g transform={`translate(${BOARD_X},${BOARD_Y}) scale(${BOARD_S})`}>
            <rect x="-18" y="-18" width="1036" height="661" fill="#7a4f2c" />
            <rect x="0" y="0" width="1000" height="625" fill="#253a30" />
            {ink.map((pl, i) => (
              <polyline key={i} points={pl.map((p) => p.join(",")).join(" ")} fill="none" stroke="#f4f1e8" strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
            ))}
            {s.tipActive && <circle cx={s.tip[0]} cy={s.tip[1]} r={6} fill="#ffcc4d" />}
          </g>
        </svg>
        <TutorCanvas key={tutor} characterId={tutor} view={view} driver={driver} onReady={onReady} />
        <div className="absolute top-2 left-2 rounded-full bg-black/70 px-3 py-1 font-mono text-[13px] text-white" data-testid="anim-state">
          {state}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className={`${btn} !bg-blue text-white`} onClick={() => void playScript()} disabled={running}>
          {running ? "Playing…" : "Play lesson script"}
        </button>
        <button type="button" className={btn} onClick={() => { reset(); clearInk(); }}>idle (reset)</button>
        <button type="button" className={btn} onClick={() => (s.talking = !s.talking)}>talk</button>
        <button type="button" className={btn} onClick={() => (s.listening = !s.listening)}>listen</button>
        <button type="button" className={btn} onClick={() => (s.thinking = !s.thinking)}>think</button>
        <button type="button" className={btn} onClick={() => write(ROW1)}>turnToBoard + write</button>
        <button type="button" className={btn} onClick={() => write(FAR)}>walkAlongBoard (far)</button>
        <button type="button" className={btn} onClick={() => write(LOW)}>write low row</button>
        <button type="button" className={btn} onClick={() => (s.queue = [])}>turnToLearner</button>
        <button
          type="button"
          className={btn}
          onClick={() => {
            s.focus = [520, 300];
            s.focusCount++;
          }}
        >
          point
        </button>
        <button type="button" className={btn} onClick={() => s.praiseCount++}>praise</button>
        <button type="button" className={btn} onClick={() => (s.emotion = s.emotion === "excited" ? "neutral" : "excited")}>excited</button>
        <button type="button" className={btn} onClick={clearInk}>clear board</button>
      </div>
      <LipsyncDebug tutor={tutor} onVoice={(on) => (realVoice.current = on)} />
      <label className="mt-3 flex items-center gap-3 text-[14px] font-bold">
        Speed {speed.toFixed(2)}×
        <input type="range" min={0.25} max={1} step={0.05} value={speed} onChange={(e) => setSpd(Number(e.target.value))} />
      </label>
    </main>
  );
}
