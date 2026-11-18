"use client";
// Personal roadmap as a vertical list: sections as headers, tiles differ by colour + icon + word.
import Link from "next/link";
import { t } from "@/i18n/uz";
import type { Roadmap, RoadmapNode } from "@/lib/learning/roadmap";
import TutorPortrait from "@/components/characters/TutorPortrait";
import { ArrowIcon, CheckIcon, LockIcon } from "@/components/ui/icons";
import { Bar } from "@/components/ui/hud";
import { subjectOfSection } from "@/config/mathTopics";
import { lockReason } from "@/lib/learning/access";

function Tile({ n, roadmap }: { n: RoadmapNode; roadmap: Roadmap }) {
  if (n.status === "mastered")
    return (
      <Link href={`/practice/${n.id}`} className="card flex w-full items-center gap-3 px-3.5 py-3 no-underline">
        <span className="grid h-9 w-9 flex-none place-items-center rounded-xl bg-green text-white">
          <CheckIcon size={16} />
        </span>
        <span className="flex-1 text-[15px] font-extrabold">{n.title}</span>
        <span className="text-[12px] font-black text-green">{t.roadmap.status.mastered}</span>
      </Link>
    );
  if (n.status === "locked") {
    // say WHY it is locked (same rule as everywhere: src/lib/learning/access.ts)
    const why = lockReason(roadmap, n);
    return (
      <div className="flex w-full items-center gap-3 rounded-[22px] bg-[#e9edf7] px-3.5 py-3 text-[#6b7392]" aria-disabled aria-label={`${n.title}, ${t.roadmap.status.locked}: ${why}`}>
        <span className="grid h-9 w-9 flex-none place-items-center rounded-xl bg-[#dfe4f1]">
          <LockIcon size={16} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-extrabold">{n.title}</span>
          <span className="block text-[12px] font-extrabold">{why}</span>
        </span>
        <span className="text-[12px] font-black">{t.roadmap.status.locked}</span>
      </div>
    );
  }
  const optional = n.status === "optional";
  return (
    <Link href={`/lesson/${n.id}`} className="card flex w-full items-center gap-3 px-3.5 py-3 no-underline">
      <span className={`grid h-9 w-9 flex-none place-items-center rounded-xl text-[15px] font-black ${optional ? "bg-soft text-mut" : "bg-[#fff3d1] text-gold-dark"}`}>{n.order || "+"}</span>
      <span className="flex-1 text-[15px] font-extrabold">{n.title}</span>
      <span className={`text-[12px] font-black ${optional ? "text-mut" : "text-gold-dark"}`}>{n.started ? t.roadmap.resume : optional ? t.roadmap.status.optional : t.roadmap.status.next}</span>
    </Link>
  );
}

function CurrentTile({ n, characterId }: { n: RoadmapNode; characterId: string }) {
  return (
    <div className="node-current relative w-full overflow-hidden rounded-[24px] p-4" style={{ background: "linear-gradient(140deg,#cfe0ff,#a9c6ff)" }}>
      <TutorPortrait id={characterId} pose="point" frame="half" alt="" className="absolute top-1 right-[-14px] h-[130px] w-[130px]" />
      <div className="relative w-[64%]">
        <div className="mb-1.5 flex flex-wrap gap-1.5">
          <span className="rounded-full bg-blue px-2.5 py-0.5 text-[12px] font-black text-white">{t.roadmap.status.current}</span>
          {n.weak && <span className="rounded-full bg-white px-2.5 py-0.5 text-[12px] font-black text-[#c2410c]">{t.roadmap.weak}</span>}
        </div>
        <div className="text-[18px] leading-[1.2] font-black">{n.title}</div>
        <Bar value={Math.round(n.p * 100)} className="mt-3 bg-white/60" label={t.practice.mastery} />
        <div className="mt-1 text-[12px] font-extrabold text-[#3a4a80]">{Math.round(n.p * 100)}%</div>
      </div>
      <Link href={`/lesson/${n.id}`} className="btn btn-primary relative mt-3 w-full">
        {t.roadmap.continue} <ArrowIcon />
      </Link>
    </div>
  );
}

export default function RoadmapList({ roadmap, characterId, subjectSections }: { roadmap: Roadmap; characterId: string; subjectSections?: string[] }) {
  const bySection = new Map<string, RoadmapNode[]>();
  for (const n of roadmap.nodes) {
    if (subjectSections && !subjectSections.includes(n.section)) continue;
    if (!bySection.has(n.section)) bySection.set(n.section, []);
    bySection.get(n.section)!.push(n);
  }
  const pathSections = [...new Set(roadmap.path.map((id) => roadmap.nodes.find((n) => n.id === id)?.section).filter((s): s is string => !!s && bySection.has(s)))];
  const sections = [...pathSections, ...[...bySection.keys()].filter((s) => !pathSections.includes(s))];

  return (
    <div className="flex flex-col gap-6">
      {sections.map((sec) => {
        const nodes = bySection.get(sec)!;
        const m = nodes.filter((n) => n.status === "mastered").length;
        const active = pathSections.includes(sec);
        const sorted = [...nodes].sort((a, b) => (a.order || 99) - (b.order || 99) || a.grade - b.grade);
        const shown = active || subjectSections ? sorted : sorted.slice(0, 3);
        const subj = subjectOfSection(sec);
        return (
          <section key={sec} aria-label={sec} className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between px-0.5">
              <h2 className="m-0 flex items-center gap-2 text-[17px] font-black">
                <span className="h-3 w-3 rounded-full" style={{ background: subj?.bar ?? "#2f6bff" }} aria-hidden />
                {sec}
              </h2>
              <span className="text-[13px] font-extrabold text-mut">
                {m}/{nodes.length}
              </span>
            </div>
            {shown.map((n) => (n.status === "current" ? <CurrentTile key={n.id} n={n} characterId={characterId} /> : <Tile key={n.id} n={n} roadmap={roadmap} />))}
          </section>
        );
      })}
    </div>
  );
}
