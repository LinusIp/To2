"use client";
// Mockup v2 roadmap (screen s3): the learner's current section as an island (public/ui/island.webp)
// with lesson badges on the dotted route — done / current / open / locked, and a trophy at the end.
// Badge positions and the route are the prototype's NODES / ROUTE (docs/prototypes/mobile-app-v2).
import Link from "next/link";
import type { Roadmap, RoadmapNode } from "@/lib/learning/roadmap";
import { isOpen, lockReason } from "@/lib/learning/access";
import { CheckIcon, LockIcon } from "@/components/ui/icons";

const NODES: [number, number][] = [[0.174, 0.714], [0.448, 0.754], [0.618, 0.661], [0.421, 0.491], [0.335, 0.305], [0.662, 0.336]];
const ROUTE = "17.4,71.4 23.0,72.0 28.4,72.9 33.8,73.9 39.3,74.8 44.8,75.4 50.4,75.1 55.6,73.8 59.8,71.4 61.8,66.1 60.3,62.7 57.5,59.5 54.2,56.6 50.5,53.9 46.3,51.5 42.1,49.1 37.9,46.7 34.0,44.1 31.0,41.1 28.7,37.8 28.7,32.2 33.5,30.5 39.1,30.0 44.7,30.0 50.3,30.3 55.6,31.5 60.8,32.8 66.2,33.6";

/** the section to show: the current lesson's, else the first section on the path */
function sectionNodes(rm: Roadmap): { section: string; nodes: RoadmapNode[]; all: RoadmapNode[] } | null {
  const cur = rm.nodes.find((n) => n.id === rm.currentId) ?? rm.nodes.find((n) => n.onPath);
  if (!cur) return null;
  const all = rm.nodes.filter((n) => n.section === cur.section);
  const rank = (n: RoadmapNode) => (n.status === "mastered" ? 0 : n.id === rm.currentId ? 1 : n.order > 0 ? 2 + n.order : 100 + n.grade);
  const nodes = [...all].sort((a, b) => rank(a) - rank(b)).slice(0, 5);
  return { section: cur.section, nodes, all };
}

export default function IslandMap({ roadmap }: { roadmap: Roadmap }) {
  const s = sectionNodes(roadmap);
  if (!s) return null;
  const done = s.all.filter((n) => n.status === "mastered").length;
  const cur = s.nodes.find((n) => n.id === roadmap.currentId) ?? s.nodes.find((n) => isOpen(n) && n.status !== "mastered");
  return (
    <section aria-label={s.section} className="relative -mx-[18px] overflow-hidden rounded-b-[28px] pb-24 md:mx-0 md:rounded-[28px]" style={{ background: "linear-gradient(180deg,#4f8ff7 0%,#77b0ff 45%,#a9d0ff 100%)" }}>
      <span className="absolute top-[18%] -right-6 h-6 w-28 rounded-full bg-white/75" aria-hidden />
      <span className="absolute bottom-[26%] -left-5 h-5 w-24 rounded-full bg-white/75" aria-hidden />
      <div className="relative mx-[-14px] mt-1">
        <img src="/ui/island.webp" alt={`${s.section} oroli`} className="block w-full" style={{ filter: "drop-shadow(0 22px 22px rgba(0,30,90,.28))" }} />
        <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
          <polyline points={ROUTE} fill="none" stroke="#fff" strokeWidth="0.9" strokeDasharray="0.1 2.2" strokeLinecap="round" opacity=".95" />
        </svg>
        {NODES.map(([x, y], i) => {
          const style = { left: `${x * 100}%`, top: `${y * 100}%` };
          if (i === 5)
            return (
              <span key="goal" className="island-node goal" style={style} aria-label="Bo'lim yakuni">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="#fff" aria-hidden>
                  <path d="M7 4h10v5a5 5 0 01-10 0zM4 5h3v3a3 3 0 01-3-3zM20 5h-3v3a3 3 0 003-3zM10 15h4v3h3v3H7v-3h3z" />
                </svg>
              </span>
            );
          const n = s.nodes[i];
          if (!n) return null;
          const k = n.status === "mastered" ? "done" : n.id === cur?.id ? "cur" : isOpen(n) ? "open" : "lock";
          const label = `${i + 1}. ${n.title}${k === "lock" ? ` — ${lockReason(roadmap, n)}` : ""}`;
          const inner =
            k === "done" ? <CheckIcon size={18} color="#fff" /> : k === "cur" ? <span className="text-[24px] leading-none">★</span> : k === "open" ? i + 1 : (
              <span className="flex flex-col items-center leading-none">
                {i + 1}
                <LockIcon size={11} />
              </span>
            );
          return k === "lock" ? (
            <span key={n.id} className={`island-node ${k}`} style={style} aria-label={label} title={label}>
              {inner}
            </span>
          ) : (
            <Link key={n.id} href={`/lesson/${n.id}`} className={`island-node ${k}`} style={style} aria-label={label} title={label}>
              {inner}
            </Link>
          );
        })}
      </div>
      {cur && (
        <Link href={`/lesson/${cur.id}`} className="absolute inset-x-4 bottom-5 flex items-center gap-3 rounded-[22px] bg-white px-4 py-3.5 no-underline shadow-[0_12px_24px_rgba(0,30,90,.2)]">
          <span className="grid h-11 w-11 flex-none place-items-center rounded-xl font-black text-white" style={{ background: "linear-gradient(135deg,#4f8dff,#2753d6)", boxShadow: "inset -4px -4px 0 rgba(0,0,0,.15)" }}>
            {s.nodes.indexOf(cur) + 1}
          </span>
          <span className="min-w-0 flex-1 text-left">
            <span className="block truncate text-[16px] font-black text-ink">{cur.title}</span>
            <span className="block text-[12.5px] font-bold text-mut">
              {s.section} · {done}/{s.all.length} dars
            </span>
          </span>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#101735" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      )}
    </section>
  );
}
