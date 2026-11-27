"use client";
// Juftini top (memory match) on the classroom desk: 12 chalk slates (6 pairs — fraction ↔ chalk picture,
// formula ↔ name, word ↔ translation, the same number two ways). The chalkboard on the wall keeps score and
// writes each found pair; the tutor stands at the desk (full-body) and reacts. Each found pair updates its
// skill's mastery (+XP flies to the counter). Cards are real buttons (Tab + Enter/Space); the live region
// reads every turned card; voice-first reads them aloud and "karta besh" flips card 5 (useCardVoice).
import { useCallback, useEffect, useRef, useState } from "react";
import { t } from "@/i18n/uz";
import { GameFrame, EndCard, FullTutor, Bubble } from "@/components/games/GameKit";
import { CardVoiceHint, useCardVoice } from "@/components/a11y/GameVoice"; // a11y-hook
import { useRound } from "@/components/games/useRound";
import { reportAnswer, saveBest, useGameSettings, type GameSettings } from "@/lib/games/client";
import { deal, flip, memoryDone, memoryStart, PAIR_BY_ID, type Card, type Face, type MemoryState } from "@/lib/games/memory";
import { memoryScore } from "@/lib/games/scoring";
import { play } from "@/lib/games/sfx";
import type { Pose } from "@/components/characters/voxel";

/** the card face, drawn in chalk on the slate */
function FaceView({ f }: { f: Face }) {
  if (f.kind === "text") return <span className={`leading-tight ${f.text.length > 12 ? "text-[14px]" : f.text.length > 6 ? "text-[18px]" : "text-[26px]"}`}>{f.text}</span>;
  // a fraction as a chalk bar: outlined cells, the filled ones hatched in orange chalk
  const w = 64 / f.parts;
  return (
    <svg viewBox="0 0 72 30" className="w-[92%]" aria-hidden>
      {Array.from({ length: f.parts }, (_, i) => (
        <g key={i}>
          {i < f.filled && <rect x={4 + i * w} y={5} width={w} height={20} fill="rgba(255,159,67,.45)" />}
          {i < f.filled && <path d={`M${4 + i * w + 2} 23l${w - 4} -16`} stroke="#ff9f43" strokeWidth={2} strokeLinecap="round" />}
          <rect x={4 + i * w} y={5} width={w} height={20} fill="none" stroke="#f3f0e6" strokeWidth={2} />
        </g>
      ))}
    </svg>
  );
}

const faceText = (f: Face) => (f.kind === "text" ? f.text : t.games.memory.fracbar(f.filled, f.parts));

/** the back of a slate: a chalk "?" in a hand-drawn frame */
function SlateBack({ n }: { n: number }) {
  return (
    <svg viewBox="0 0 60 80" className="h-full w-full" aria-hidden>
      <rect x={7} y={7} width={46} height={66} rx={4} fill="none" stroke="rgba(243,240,230,.35)" strokeWidth={2} strokeDasharray="5 4" />
      <text x={30} y={50} textAnchor="middle" fontSize={30} fill="rgba(243,240,230,.8)" fontFamily="var(--font-chalk), Kalam, cursive" fontWeight={700}>
        ?
      </text>
      <text x={49} y={69} textAnchor="end" fontSize={10} fill="rgba(243,240,230,.55)" fontFamily="var(--font-chalk), Kalam, cursive" fontWeight={700}>
        {n}
      </text>
    </svg>
  );
}

export default function MemoryGame({ settings }: { settings?: GameSettings }) {
  const { calm } = useGameSettings(settings); // a11y-hook
  const { skills, characterId } = useRound();
  const [cards, setCards] = useState<Card[]>([]);
  const [s, setS] = useState<MemoryState>(memoryStart);
  const [announce, setAnnounce] = useState("");
  const [pose, setPose] = useState<Pose>("wave");
  const [act, setAct] = useState<"cheer" | "wobble" | null>(null);
  const [bubble, setBubble] = useState<string | null>(null);
  const [lastPair, setLastPair] = useState<string | null>(null);
  const [xp, setXp] = useState(0);
  const [fly, setFly] = useState<{ key: number; amount: number; from?: { x: number; y: number } } | null>(null);
  const [end, setEnd] = useState<{ best: number; record: boolean } | null>(null);
  const cardEls = useRef<Record<string, HTMLButtonElement | null>>({});

  const start = useCallback(() => {
    setCards(deal({ skillIds: skills ?? [] }));
    setS(memoryStart());
    setXp(0);
    setEnd(null);
    setPose("wave");
    setAct(null);
    setBubble(null);
    setLastPair(null);
    setAnnounce(t.games.memory.desc);
  }, [skills]);
  useEffect(() => {
    if (skills) start();
  }, [skills, start]);

  const done = memoryDone(s, cards);

  const onFlip = (uid: string) => {
    const card = cards.find((c) => c.uid === uid);
    const r = flip(s, cards, uid);
    if (r.event === "none" || !card) return;
    setS(r.state);
    if (r.event === "open") {
      play("flip", { soft: calm });
      setPose("idle");
      setAct(null);
      setBubble(null);
      setAnnounce(faceText(card.face));
    } else if (r.event === "match" && r.pairId) {
      play("match", { soft: calm });
      setPose("cheer");
      setAct("cheer");
      setBubble(t.games.right);
      const label = PAIR_BY_ID[r.pairId]?.label ?? "";
      setLastPair(label);
      setAnnounce(`${faceText(card.face)}. ${t.games.memory.found(label)}`);
      void reportAnswer({ game: "memory", kind: "pair", pairId: r.pairId }).then((x) => {
        if (!x) return;
        setXp((v) => v + x.xp);
        const b = cardEls.current[uid]?.getBoundingClientRect();
        setFly({ key: Date.now(), amount: x.xp, from: b ? { x: b.left + b.width / 2, y: b.top + b.height / 2 } : undefined });
      });
      if (memoryDone(r.state, cards)) {
        setTimeout(() => play("win", { soft: calm }), 400);
        void saveBest("memory", memoryScore(cards.length / 2, r.state.moves)).then(setEnd);
      }
    } else {
      play("flip", { soft: calm });
      setTimeout(() => play("wrong", { soft: true }), 120);
      setPose("point");
      setAct("wobble");
      setBubble(t.games.memory.miss);
      setAnnounce(`${faceText(card.face)}. ${t.games.memory.miss}`);
    }
  };

  // a11y-hook: voice-first reads each turned card; "karta besh" flips card 5
  const voiceOn = useCardVoice(announce, cards.length, (i) => cards[i] && onFlip(cards[i].uid));

  // a mismatched pair closes by itself after a moment (or with the next flip)
  useEffect(() => {
    if (s.open.length !== 2) return;
    const tm = setTimeout(() => setS((x) => (x.open.length === 2 ? { ...x, open: [] } : x)), calm ? 1600 : 1100);
    return () => clearTimeout(tm);
  }, [s.open, calm]);

  const pairs = cards.length / 2;

  return (
    <GameFrame bleed title={t.games.memory.name} calm={calm} announce={announce} testId="game-memory" xp={xp} xpFly={fly}>
      {/* the classroom wall: the chalkboard keeps score and writes the last found pair */}
      <div className="flex-none bg-[#e9dcc4] px-3 pt-1 pb-3">
        <div className="chalk-sign flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-[12px] font-extrabold text-[#cfd8cf]">{t.games.memory.moves(s.moves)}</div>
            <div className="truncate font-chalk text-[20px] leading-snug" data-testid="memory-board">
              {done ? t.games.memory.done(s.moves) : lastPair ? t.games.memory.foundShort(lastPair) : t.games.memory.startShort}
            </div>
          </div>
          <div className="flex-none text-center font-chalk text-[26px] leading-none text-[#f2c94c]" aria-label={t.games.memory.pairs(s.matched.length, pairs)}>
            {s.matched.length}/{pairs}
            <div className="font-sans text-[11px] font-extrabold text-[#cfd8cf]">{t.games.memory.pairsShort}</div>
          </div>
        </div>
      </div>

      {/* the desk: 12 slates */}
      <div className="desk-scene flex flex-col">
        <div className={`grid flex-1 grid-cols-4 grid-rows-3 gap-2 px-3 pt-3 ${done ? "pb-3" : ""}`} role="group" aria-label={t.games.memory.name}>
          {cards.map((c, i) => {
            const isDone = s.matched.includes(c.pairId);
            const open = isDone || s.open.includes(c.uid);
            return (
              <button
                key={c.uid}
                ref={(el) => {
                  cardEls.current[c.uid] = el;
                }}
                type="button"
                className="mem-card mem-slate block h-full min-h-[96px] w-full p-0"
                data-open={open ? "1" : "0"}
                data-done={isDone ? "1" : "0"}
                aria-label={open ? faceText(c.face) : t.games.memory.card(i + 1)}
                aria-pressed={open}
                disabled={isDone}
                onClick={() => onFlip(c.uid)}
                data-testid="mem-card"
              >
                <span className="mem-inner block">
                  <span className="mem-face mem-back slate-back" aria-hidden>
                    <SlateBack n={i + 1} />
                  </span>
                  <span className="mem-face mem-front slate-front" aria-hidden>
                    <FaceView f={c.face} />
                  </span>
                </span>
              </button>
            );
          })}
        </div>
        {!done && (
          <div className="relative flex min-h-[150px] flex-none items-end gap-2 px-3 pt-2">
            {/* the tutor standing at the desk */}
            <FullTutor id={characterId} pose={pose} act={calm ? null : act} className="h-[146px] w-[104px] flex-none" />
            <div className="mb-3 min-w-0 flex-1">
              {bubble && (
                <Bubble className="relative! max-w-full!" tail="left">
                  {bubble}
                </Bubble>
              )}
              {voiceOn && <CardVoiceHint />}
            </div>
          </div>
        )}
      </div>

      {done && (
        <div className="game-tray">
          <EndCard hideTutor title={t.success.title} line={t.games.memory.done(s.moves)} best={end?.best ?? memoryScore(pairs, s.moves)} record={!!end?.record} xp={xp} characterId={characterId} calm={calm} onAgain={start} />
        </div>
      )}
    </GameFrame>
  );
}
