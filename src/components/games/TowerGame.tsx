"use client";
// Blok minorasi (Block Tower) — a building site. The question hangs on a chalk sign; the crane holds the
// next block; the answers are voxel blocks in the bottom tray. Tap a block → right: the crane lowers it
// onto the tower (thud, +XP flies to the counter, combo ×2/×3 = a taller gold block); wrong: it lands,
// wobbles and falls off, and the tutor (full-body, standing on the ground) points at the hint.
// The tower grows toward the goal line (10 blocks); the camera zooms out as it gets taller.
// 10 questions; height = score. Keys 1–4 / voice "javob n" answer (Choices → GameVoice); calm = no motion.
import { useCallback, useEffect, useRef, useState } from "react";
import { t } from "@/i18n/uz";
import { GameFrame, Choices, EndCard, FullTutor, Bubble } from "@/components/games/GameKit";
import { useRound } from "@/components/games/useRound";
import { fetchQuestions, reportQuestion, saveBest, useGameSettings, type GameSettings } from "@/lib/games/client";
import { TOWER_QUESTIONS, comboMultiplier, towerAnswer, towerStart, type TowerState } from "@/lib/games/scoring";
import { play } from "@/lib/games/sfx";
import type { GameQuestion } from "@/lib/games/questions";
import { getSkill } from "@/data/skills";
import type { Pose } from "@/components/characters/voxel";

const COLORS = ["#2f66e0", "#178a45", "#c65f08", "#6f45d8", "#0f8ea0", "#d1366e"];
const GOLD = "#f5b000";
const GOLD3 = "#e8780c";

/** world units (SVG viewBox 360 × 440) */
const W = 360, H = 440, GROUND = 392, BLOCK = 22, BW = 96, TX = 222, GOAL = 10;

const shade = (hex: string, k: number) => {
  const n = parseInt(hex.slice(1), 16);
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(k > 0 ? c + (255 - c) * k : c * (1 + k))));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
};

/** a voxel block: front face, lit top, shaded side, a little pixel texture */
function Voxel({ x, y, w, h, color, label, className, style }: { x: number; y: number; w: number; h: number; color: string; label?: string; className?: string; style?: React.CSSProperties }) {
  const d = 9;
  return (
    <g className={className} style={style}>
      <path d={`M${x} ${y}l${d} ${-d * 0.7}h${w}l${-d} ${d * 0.7}z`} fill={shade(color, 0.35)} />
      <path d={`M${x + w} ${y}l${d} ${-d * 0.7}v${h}l${-d} ${d * 0.7}z`} fill={shade(color, -0.3)} />
      <rect x={x} y={y} width={w} height={h} fill={color} />
      <rect x={x + 6} y={y + 4} width={8} height={4} fill={shade(color, 0.18)} />
      <rect x={x + w - 22} y={y + h - 8} width={10} height={4} fill={shade(color, -0.15)} />
      {label && (
        <text x={x + w / 2} y={y + h / 2 + 5} textAnchor="middle" fontSize={14} fontWeight={900} fill="#fff" style={{ paintOrder: "stroke" }} stroke="rgba(0,0,0,.25)" strokeWidth={2}>
          {label}
        </text>
      )}
    </g>
  );
}

function Site({ blocks, height, pending, falling, calm, tutor, act }: { blocks: (1 | 2 | 3)[]; height: number; pending: string | null; falling: string | null; calm: boolean; tutor: { id: string; pose: Pose }; act: "place" | "wobble" | "cheer" | null }) {
  const top = GROUND - height * BLOCK;
  // zoom out (around the tower's foot) so the tower + the crane's hanging block stay below the sign
  const zoom = Math.max(0.42, Math.min(1, (GROUND - 120) / (height * BLOCK + 80)));
  const goalY = GROUND - GOAL * BLOCK;
  const hookY = Math.min(top - 70, 150);
  let y = GROUND;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMax meet" aria-hidden data-testid="tower-site">
      {/* flat sky with two voxel clouds */}
      <rect x={-400} y={-400} width={W + 800} height={H + 800} fill="#d6e4ff" />
      <g fill="#fff" opacity={0.9}>
        <rect x={24} y={128} width={54} height={12} />
        <rect x={36} y={118} width={30} height={12} />
        <rect x={286} y={110} width={46} height={10} />
      </g>
      <g className="tower-world" style={{ transform: `translate(${TX}px, ${GROUND}px) scale(${zoom}) translate(${-TX}px, ${-GROUND}px)` }}>
        {/* ground: grass voxels on dirt */}
        <rect x={-600} y={GROUND} width={W + 1200} height={220} fill="#8a5a2c" />
        <rect x={-600} y={GROUND} width={W + 1200} height={10} fill="#4caf50" />
        {Array.from({ length: 40 }, (_, i) => (
          <rect key={i} x={-600 + i * 40 + (i % 3) * 7} y={GROUND + 18 + (i % 4) * 12} width={10} height={8} fill="#6e4520" />
        ))}
        {/* goal line */}
        <path d={`M${TX - BW / 2 - 100} ${goalY}H${TX + 120}`} stroke="#c2410c" strokeWidth={3} strokeDasharray="8 6" />
        <rect x={TX - BW / 2 - 100} y={goalY - 22} width={92} height={18} rx={4} fill="#c2410c" />
        <text x={TX - BW / 2 - 54} y={goalY - 9} textAnchor="middle" fontSize={11} fontWeight={900} fill="#fff">
          {t.games.tower.goal(GOAL)}
        </text>
        {/* scaffold behind the tower */}
        <g stroke="#7a8094" strokeWidth={3} opacity={0.55}>
          <path d={`M${TX - BW / 2 - 14} ${GROUND}V${Math.min(goalY, top) - 10}M${TX + BW / 2 + 22} ${GROUND}V${Math.min(goalY, top) - 10}`} />
          {Array.from({ length: Math.ceil((GROUND - Math.min(goalY, top)) / 44) }, (_, i) => (
            <path key={i} d={`M${TX - BW / 2 - 14} ${GROUND - i * 44}H${TX + BW / 2 + 22}`} />
          ))}
        </g>
        {/* crane: lattice mast, jib, cable, hook with the next block */}
        <g>
          <path d={`M${TX + 112} ${GROUND}V${Math.min(60, top - 120)}`} stroke="#e0a100" strokeWidth={10} />
          <path d={`M${TX + 112} ${GROUND}V${Math.min(60, top - 120)}`} stroke="#8a6400" strokeWidth={10} strokeDasharray="2 12" />
          <path d={`M${TX - 70} ${Math.min(60, top - 120)}H${TX + 140}`} stroke="#e0a100" strokeWidth={8} />
          <rect x={TX + 120} y={Math.min(60, top - 120) - 4} width={22} height={18} fill="#5b6070" />
          <path d={`M${TX} ${Math.min(60, top - 120)}V${hookY}`} stroke="#3a3f52" strokeWidth={2} />
          {pending != null && <Voxel x={TX - BW / 2} y={hookY} w={BW} h={BLOCK} color="#9aa3bd" label={pending} />}
        </g>
        {/* the tower */}
        <rect x={TX - BW / 2 - 6} y={GROUND - 6} width={BW + 12} height={8} fill="#5b6070" />
        {blocks.map((m, i) => {
          y -= m * BLOCK;
          const isNew = i === blocks.length - 1;
          return <Voxel key={i} x={TX - BW / 2} y={y} w={BW} h={m * BLOCK - 2} color={m === 3 ? GOLD3 : m === 2 ? GOLD : COLORS[i % COLORS.length]} label={m > 1 ? `×${m}` : undefined} className={isNew && !calm ? "vx-g-drop" : undefined} />;
        })}
        {falling != null && <Voxel key={`f-${falling}`} x={TX - BW / 2} y={top - BLOCK} w={BW} h={BLOCK - 2} color="#8a90a8" label={falling} className="vx-g-fall" />}
        <rect x={TX + BW / 2 + 14} y={GROUND + 14} width={62} height={20} rx={5} fill="#5b3a1a" />
        <text x={TX + BW / 2 + 45} y={GROUND + 28} textAnchor="middle" fontSize={12} fontWeight={900} fill="#ffe7a3" data-testid="tower-height">
          {t.games.tower.blocks(height)}
        </text>
        {/* the tutor stands on the ground (full-body render) */}
        <foreignObject x={6} y={GROUND - 168} width={120} height={170}>
          <FullTutor id={tutor.id} pose={tutor.pose} act={calm ? null : act} className="h-[170px] w-[120px]" />
        </foreignObject>
      </g>
    </svg>
  );
}

export default function TowerGame({ settings }: { settings?: GameSettings }) {
  const { calm } = useGameSettings(settings); // a11y-hook
  const { skills, characterId } = useRound();
  const [qs, setQs] = useState<GameQuestion[] | null>(null);
  const [err, setErr] = useState(false);
  const [s, setS] = useState<TowerState>(towerStart);
  const [picked, setPicked] = useState<number | null>(null);
  const [shown, setShown] = useState(0); // the question on screen (s.index moves on at the answer)
  const [falling, setFalling] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [pose, setPose] = useState<Pose>("idle");
  const [act, setAct] = useState<"place" | "wobble" | "cheer" | null>(null);
  const [bubble, setBubble] = useState<string | null>(null);
  const [announce, setAnnounce] = useState("");
  const [xp, setXp] = useState(0);
  const [fly, setFly] = useState<{ key: number; amount: number; from?: { x: number; y: number } } | null>(null);
  const [end, setEnd] = useState<{ best: number; record: boolean } | null>(null);
  const started = useRef(0);
  const scene = useRef<HTMLDivElement>(null);

  const start = useCallback(async () => {
    if (!skills) return;
    setQs(null);
    setErr(false);
    setS(towerStart());
    setShown(0);
    setPicked(null);
    setHint(null);
    setPose("idle");
    setAct(null);
    setBubble(null);
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
      setBubble(null);
      setPose("idle");
      setAct(null);
      setShown(ns.index);
      started.current = Date.now();
      const nq = qs?.[ns.index];
      if (nq) setAnnounce(`${t.games.question(ns.index + 1, total)}. ${nq.q}`);
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
      play("tap", { soft: calm });
      if (right) {
        const m = comboMultiplier(ns.streak);
        setPose(m > 1 ? "cheer" : "point");
        setAct(m > 1 ? "cheer" : "place");
        setBubble(m > 1 ? t.games.combo(m) : t.games.right);
        setTimeout(() => play(m > 1 ? "combo" : "place", { soft: calm }), calm ? 0 : 420);
        setAnnounce(`${t.games.right} ${t.games.tower.placed(m)} ${t.games.tower.height(ns.height)}`);
        void reportQuestion("tower", q, q.choices[i], Date.now() - started.current).then((r) => {
          if (!r) return;
          setXp((x) => x + r.xp);
          const b = scene.current?.getBoundingClientRect();
          setFly({ key: Date.now(), amount: r.xp, from: b ? { x: b.left + b.width * 0.62, y: b.top + b.height * 0.55 } : undefined });
        });
        setTimeout(() => next(ns), calm ? 800 : 1100);
      } else {
        setFalling(q.choices[i]);
        setPose("point");
        setAct("wobble");
        setHint(q.hint);
        setBubble(q.hint);
        play("wrong", { soft: calm });
        setTimeout(() => play("fall", { soft: calm }), calm ? 0 : 450);
        setAnnounce(`${t.games.wrong(q.choices[q.correct])}. ${t.games.tower.fell} ${q.hint}`);
        setTimeout(() => setFalling(null), 1150);
      }
      if (ns.done) {
        setTimeout(() => play("win", { soft: calm }), 900);
        void saveBest("tower", ns.height).then(setEnd);
      }
    },
    [q, picked, s, total, calm, next],
  );

  const skillTitle = skills?.length === 1 ? getSkill(skills[0])?.title_uz : null;
  const pending = !s.done && q ? (picked == null ? "?" : null) : null;

  return (
    <GameFrame bleed title={t.games.tower.name} calm={calm} announce={announce} testId="game-tower" xp={xp} xpFly={fly}>
      <div ref={scene} className="tower-scene">
        <Site blocks={s.blocks} height={s.height} pending={pending} falling={falling} calm={calm} tutor={{ id: characterId, pose }} act={act} />
        {/* the question on the site's chalk sign */}
        <div className="chalk-sign tower-sign">
          <div className="flex items-center justify-between gap-2 text-[12px] font-extrabold text-[#cfd8cf]">
            <span className="truncate">{skillTitle ? t.games.topic(skillTitle) : t.games.mixed}</span>
            {!s.done && <span className="flex-none">{t.games.question(Math.min(shown + 1, total), total)}</span>}
          </div>
          <div className="mt-0.5 font-chalk text-[22px] leading-snug" data-testid="game-question">
            {s.done ? t.games.tower.done(s.height) : q ? q.q : qs && !qs.length ? t.games.noQuestions : t.games.loading}
          </div>
        </div>
        {bubble && !s.done && (
          <Bubble className="bottom-[188px] left-[12px]" tail="left">
            {bubble}
          </Bubble>
        )}
      </div>

      {/* the tray: block pile to pick from (or the end card) */}
      <div className="game-tray">
        {err && (
          <div className="p-2 text-center font-extrabold" role="alert">
            {t.common.error}
            <button type="button" className="btn btn-primary mt-3 w-full" onClick={() => void start()}>
              {t.common.retry}
            </button>
          </div>
        )}
        {!s.done && !err && q && (
          <>
            {hint && (
              <div className="mb-2 flex items-center gap-2 rounded-[14px] bg-[#fff4e8] px-3 py-2 text-[14px] font-extrabold text-[#9a3412]">
                <span className="min-w-0 flex-1">{t.games.wrong(q.choices[q.correct])}</span>
                <button type="button" className="btn btn-primary min-h-11 flex-none px-5" onClick={() => next(s)} autoFocus>
                  {t.common.next}
                </button>
              </div>
            )}
            <Choices variant="blocks" question={q.q} choices={q.choices} onPick={pick} disabled={picked != null} picked={picked} correct={picked != null ? q.correct : null} />
          </>
        )}
        {s.done && (
          <EndCard
            hideTutor
            title={s.height >= GOAL ? t.games.tower.goalReached : t.success.title}
            line={t.games.tower.done(s.height)}
            best={end?.best ?? s.height}
            record={!!end?.record}
            xp={xp}
            characterId={characterId}
            calm={calm}
            onAgain={() => void start()}
          />
        )}
      </div>
    </GameFrame>
  );
}
