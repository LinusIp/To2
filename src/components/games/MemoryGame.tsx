"use client";
// Juftini top (memory match): 12 cards (6 pairs: fraction ↔ picture, formula ↔ name, same number two
// ways). Each found pair updates its skill's mastery. Cards are real buttons (Tab + Enter/Space), and the
// live region reads what was flipped.
import { useCallback, useEffect, useState } from "react";
import { t } from "@/i18n/uz";
import { GameFrame, Chip, EndCard, TutorReaction } from "@/components/games/GameKit";
import { CardVoiceHint, useCardVoice } from "@/components/a11y/GameVoice"; // a11y-hook
import { useRound } from "@/components/games/useRound";
import { reportAnswer, saveBest, useGameSettings, type GameSettings } from "@/lib/games/client";
import { deal, flip, memoryDone, memoryStart, PAIR_BY_ID, type Card, type Face, type MemoryState } from "@/lib/games/memory";
import { memoryScore } from "@/lib/games/scoring";

function FaceView({ f }: { f: Face }) {
  if (f.kind === "text") return <span className={`leading-tight ${f.text.length > 12 ? "text-[13px]" : f.text.length > 6 ? "text-[17px]" : "text-[24px]"}`}>{f.text}</span>;
  // a fraction as a chunky voxel bar
  return (
    <span className="flex w-full flex-col items-center gap-1">
      <span className="flex h-7 w-full overflow-hidden rounded-md border-2 border-[#1f3a8a]">
        {Array.from({ length: f.parts }, (_, i) => (
          <span key={i} className="h-full flex-1" style={{ background: i < f.filled ? "#ff8a1f" : "#fff", borderLeft: i ? "2px solid #1f3a8a" : undefined }} />
        ))}
      </span>
    </span>
  );
}

const faceText = (f: Face) => (f.kind === "text" ? f.text : t.games.memory.fracbar(f.filled, f.parts));

export default function MemoryGame({ settings }: { settings?: GameSettings }) {
  const { calm } = useGameSettings(settings); // a11y-hook
  const { skills, characterId } = useRound();
  const [cards, setCards] = useState<Card[]>([]);
  const [s, setS] = useState<MemoryState>(memoryStart);
  const [announce, setAnnounce] = useState("");
  const [mood, setMood] = useState<"think" | "cheer" | "hint">("think");
  const [xp, setXp] = useState(0);
  const [end, setEnd] = useState<{ best: number; record: boolean } | null>(null);

  const start = useCallback(() => {
    setCards(deal({ skillIds: skills ?? [] }));
    setS(memoryStart());
    setXp(0);
    setEnd(null);
    setMood("think");
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
      setMood("think");
      setAnnounce(faceText(card.face));
    } else if (r.event === "match" && r.pairId) {
      setMood("cheer");
      const label = PAIR_BY_ID[r.pairId]?.label ?? "";
      setAnnounce(`${faceText(card.face)}. ${t.games.memory.found(label)}`);
      void reportAnswer({ game: "memory", kind: "pair", pairId: r.pairId }).then((x) => x && setXp((v) => v + x.xp));
      if (memoryDone(r.state, cards)) void saveBest("memory", memoryScore(cards.length / 2, r.state.moves)).then(setEnd);
    } else {
      setMood("hint");
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

  return (
    <GameFrame title={t.games.memory.name} calm={calm} announce={announce} testId="game-memory" chip={<Chip>{t.games.memory.moves(s.moves)}</Chip>}>
      {!done && (
        <>
          <div className="mb-2 text-[13px] font-extrabold text-mut">{t.games.memory.desc}</div>
          <div className="grid grid-cols-4 gap-2" role="group" aria-label={t.games.memory.name}>
            {cards.map((c, i) => {
              const isDone = s.matched.includes(c.pairId);
              const open = isDone || s.open.includes(c.uid);
              return (
                <button
                  key={c.uid}
                  type="button"
                  className="mem-card block w-full p-0"
                  data-open={open ? "1" : "0"}
                  data-done={isDone ? "1" : "0"}
                  aria-label={open ? faceText(c.face) : t.games.memory.card(i + 1)}
                  aria-pressed={open}
                  disabled={isDone}
                  onClick={() => onFlip(c.uid)}
                  data-testid="mem-card"
                >
                  <span className="mem-inner block">
                    <span className="mem-face mem-back" aria-hidden />
                    <span className="mem-face mem-front" aria-hidden>
                      <FaceView f={c.face} />
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
          {voiceOn && <CardVoiceHint />}
          <div className="mt-auto pt-3">
            <TutorReaction characterId={characterId} mood={mood} bubble={mood === "cheer" ? t.games.right : undefined} />
          </div>
        </>
      )}
      {done && <EndCard title={t.success.title} line={t.games.memory.done(s.moves)} best={end?.best ?? memoryScore(cards.length / 2, s.moves)} record={!!end?.record} xp={xp} characterId={characterId} calm={calm} onAgain={start} />}
    </GameFrame>
  );
}
