"use client";
// "O'yinlar" tab: three short learning games on the learner's own skills (current roadmap path),
// each with its best score. ?skill=<id> (from a roadmap node) is passed through to the game.
import { useEffect, useState } from "react";
import Link from "next/link";
import { t } from "@/i18n/uz";
import AppShell, { ScreenTop } from "@/components/ui/AppShell";
import TutorPortrait from "@/components/characters/TutorPortrait";
import { ArrowIcon } from "@/components/ui/icons";
import { useRound } from "@/components/games/useRound";
import { loadBest } from "@/lib/games/client";
import type { GameId } from "@/lib/games/answer";
import { getSkill } from "@/data/skills";

const GAMES: { id: GameId; href: string; from: string; to: string; art: React.ReactNode }[] = [
  {
    id: "tower",
    href: "/games/tower",
    from: "#4d86ff",
    to: "#2f6bff",
    art: (
      <span className="flex flex-col-reverse items-center gap-[3px]" aria-hidden>
        {["#22b45a", "#ff8a1f", "#ffc42e", "#8a5cf6"].map((c, i) => (
          <span key={c} className="vx-block block w-[46px]" style={{ background: c, height: 16, marginLeft: (i % 2) * 8 - 4 }} />
        ))}
      </span>
    ),
  },
  {
    id: "speed",
    href: "/games/speed",
    from: "#ffb02e",
    to: "#ff8a1f",
    art: <span className="text-[40px] leading-none font-black text-white" aria-hidden>60″</span>,
  },
  {
    id: "memory",
    href: "/games/memory",
    from: "#2fc98a",
    to: "#22b45a",
    art: (
      <span className="grid grid-cols-2 gap-1" aria-hidden>
        {["½", "", "", "π"].map((x, i) => (
          <span key={i} className={`grid h-[26px] w-[22px] place-items-center rounded-md text-[13px] font-black ${x ? "bg-white text-ink" : "bg-white/35"}`}>{x}</span>
        ))}
      </span>
    ),
  },
  {
    id: "mission",
    href: "/games/mission",
    from: "#a07bff",
    to: "#8a5cf6",
    art: (
      <span className="flex flex-col items-center" aria-hidden>
        <span className="block h-[14px] w-[44px] rounded-t-[10px] bg-[#ffc42e] shadow-[inset_0_-3px_0_rgba(0,0,0,.15)]" />
        <span className="block h-[5px] w-[54px] rounded-sm bg-[#f0a400]" />
        <span className="mt-1.5 grid grid-cols-3 gap-[2px]">
          {[0, 1, 2, 3, 4, 5].map((k) => (
            <span key={k} className="block h-[8px] w-[14px] rounded-[2px] bg-white/80" />
          ))}
        </span>
      </span>
    ),
  },
];

export default function GamesPage() {
  const { skills, characterId } = useRound();
  const [best, setBest] = useState<Partial<Record<GameId, number>>>({});
  const [skillParam, setSkillParam] = useState<string | null>(null);
  useEffect(() => {
    setSkillParam(new URLSearchParams(window.location.search).get("skill"));
    void loadBest().then(setBest);
  }, []);
  const names = { tower: t.games.tower, speed: t.games.speed, memory: t.games.memory, mission: t.games.mission };
  const topic = skills?.length === 1 ? getSkill(skills[0])?.title_uz : null;
  const q = skillParam ? `?skill=${encodeURIComponent(skillParam)}` : "";

  return (
    <AppShell>
      <ScreenTop title={t.games.title} back={null} />
      <div className="px-[18px] pb-4 md:px-2">
        <div className="relative flex items-end gap-2 overflow-hidden rounded-[24px] bg-white p-4 shadow-[0_10px_24px_rgba(47,107,255,.10)]">
          <div className="min-w-0 flex-1 pb-1">
            <div className="text-[15px] font-extrabold text-[#3a4266]">{t.games.subtitle}</div>
            <div className="mt-2 inline-block rounded-full bg-soft px-3 py-1 text-[12px] font-black text-blue">{topic ? t.games.topic(topic) : t.games.mixed}</div>
          </div>
          <TutorPortrait id={characterId} pose="wave" frame="half" alt="" className="h-[110px] w-[100px] flex-none object-contain" style={{ objectPosition: "50% 100%" }} />
        </div>

        <ul className="m-0 mt-4 flex list-none flex-col gap-3 p-0">
          {GAMES.map((g) => (
            <li key={g.id}>
              <Link href={`${g.href}${q}`} className="card flex items-center gap-3.5 p-3.5 no-underline" data-testid={`game-card-${g.id}`}>
                <span className="grid h-[76px] w-[76px] flex-none place-items-center rounded-[20px] shadow-[inset_0_-5px_0_rgba(0,0,0,.14)]" style={{ background: `linear-gradient(160deg,${g.from},${g.to})` }}>
                  {g.art}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[18px] font-black">{names[g.id].name}</span>
                  <span className="mt-0.5 block text-[13px] leading-snug font-bold text-mut">{names[g.id].desc}</span>
                  <span className="mt-1.5 block text-[12px] font-black text-gold-dark">{t.games.best(best[g.id] ?? 0)}</span>
                </span>
                <span className="grid h-11 w-11 flex-none place-items-center rounded-full bg-blue text-white" aria-hidden>
                  <ArrowIcon size={18} />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </AppShell>
  );
}
