"use client";
// Vertical roadmap (mobile mockup): sections as chips, tiles by status — colour + icon + word.
import Link from "next/link";
import { Check, Lock, Play, Sparkles } from "lucide-react";
import { t } from "@/i18n/uz";
import type { Roadmap, RoadmapNode } from "@/lib/learning/roadmap";
import Character from "@/components/characters/Character";
import type { CharacterId } from "@/config/characters";

function Tile({ n }: { n: RoadmapNode }) {
  if (n.status === "mastered")
    return (
      <Link href={`/practice/${n.id}`} className="flex w-full items-center gap-2.5 rounded-[14px] border-[3px] border-ink bg-mint px-3 py-2.5 no-underline">
        <span className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-lg border-[3px] border-ink bg-grass">
          <Check size={16} strokeWidth={3.5} aria-hidden />
        </span>
        <span className="flex-1 text-[15px] font-extrabold">{n.title}</span>
        <span className="text-[13px] font-extrabold">{t.roadmap.status.mastered}</span>
      </Link>
    );
  if (n.status === "locked")
    return (
      <div className="flex w-full items-center gap-2.5 rounded-[14px] border-[3px] border-locked-ink bg-locked px-3 py-2.5 text-[#4f4b43]" aria-disabled>
        <span className="flex h-[30px] w-[30px] flex-none items-center justify-center">
          <Lock size={20} strokeWidth={2.6} aria-hidden />
        </span>
        <span className="flex-1 text-[15px] font-extrabold">{n.title}</span>
        <span className="text-[13px] font-extrabold">{t.roadmap.status.locked}</span>
      </div>
    );
  const optional = n.status === "optional";
  return (
    <Link
      href={`/lesson/${n.id}`}
      className={`flex w-full items-center gap-2.5 rounded-[14px] border-[3px] px-3 py-2.5 no-underline ${optional ? "border-dashed border-locked-ink bg-white" : "border-dashed border-ink bg-white"}`}
    >
      <span className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-lg border-[3px] border-ink bg-white font-pixel text-[14px] font-bold">
        {n.order || <Sparkles size={14} aria-hidden />}
      </span>
      <span className="flex-1 text-[15px] font-extrabold">{n.title}</span>
      <span className="text-[13px] font-extrabold text-muted">{optional ? t.roadmap.status.optional : t.roadmap.status.next}</span>
    </Link>
  );
}

function CurrentTile({ n, characterId, steps }: { n: RoadmapNode; characterId: CharacterId; steps: { done: number; total: number } }) {
  return (
    <div className="node-current w-full rounded-2xl border-[3px] border-ink bg-gold p-3 shadow-[4px_4px_0_#1b1a17]">
      <div className="flex items-start gap-2.5">
        <div className="-mt-1.5 flex-none">
          <Character id={characterId} size={52} state="idle" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap gap-1.5">
            <span className="rounded-md bg-ink px-1.5 text-[12px] font-extrabold text-white">{t.roadmap.status.current.toUpperCase()}</span>
            {n.weak && <span className="rounded-md border-2 border-ink bg-white px-1.5 text-[12px] font-extrabold">{t.roadmap.weak}</span>}
          </div>
          <div className="text-[16px] leading-[1.25] font-extrabold">{n.title}</div>
          <div className="mt-0.5 text-[13px] font-bold">
            {t.roadmap.steps(steps.done, steps.total)} · {t.roadmap.minutesLeft(Math.max(3, (steps.total - steps.done) * 3))}
          </div>
        </div>
      </div>
      <Link href={`/lesson/${n.id}`} className="mt-2.5 flex h-12 items-center justify-center gap-2 rounded-xl bg-ink font-pixel text-[17px] font-bold text-white no-underline">
        <Play size={16} fill="#fff" aria-hidden /> {t.roadmap.continue}
      </Link>
    </div>
  );
}

export default function RoadmapList({ roadmap, characterId }: { roadmap: Roadmap; characterId: CharacterId }) {
  const bySection = new Map<string, RoadmapNode[]>();
  for (const n of roadmap.nodes) {
    if (!bySection.has(n.section)) bySection.set(n.section, []);
    bySection.get(n.section)!.push(n);
  }
  // Sections with the learner's path first (in path order), then the rest.
  const pathSections = [...new Set(roadmap.path.map((id) => roadmap.nodes.find((n) => n.id === id)?.section).filter(Boolean) as string[])];
  const rest = [...bySection.keys()].filter((s) => !pathSections.includes(s));
  const sections = [...pathSections, ...rest];
  const pathLen = roadmap.path.length;
  const done = roadmap.nodes.filter((n) => n.onPath && n.status === "mastered").length;

  return (
    <div className="relative flex flex-col items-center gap-3.5">
      <div className="absolute top-0 bottom-0 left-1/2 w-0 border-l-4 border-dashed border-ink opacity-35" aria-hidden />
      {sections.map((sec, si) => {
        const nodes = bySection.get(sec)!;
        const m = nodes.filter((n) => n.status === "mastered").length;
        const active = pathSections.includes(sec);
        const sorted = [...nodes].sort((a, b) => (a.order || 99) - (b.order || 99) || a.grade - b.grade);
        const shown = active ? sorted : sorted.slice(0, 3);
        return (
          <section key={sec} className="relative flex w-full flex-col items-center gap-3" aria-label={sec}>
            <h2 className={`m-0 rounded-lg px-3.5 py-1 font-pixel text-[15px] font-bold text-white uppercase ${active ? "bg-ink" : "bg-locked-ink"}`}>
              {sec} · {m}/{nodes.length}
            </h2>
            {shown.map((n) =>
              n.status === "current" ? (
                <CurrentTile key={n.id} n={n} characterId={characterId} steps={{ done: done, total: Math.max(pathLen, 1) }} />
              ) : (
                <Tile key={n.id} n={n} />
              ),
            )}
            {si === sections.length - 1 ? null : null}
          </section>
        );
      })}
    </div>
  );
}
