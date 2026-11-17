"use client";
// "Darslar" tab: the personal roadmap (list, or roadmap.sh-style graph), filterable by subject.
import { lazy, Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { t } from "@/i18n/uz";
import AppShell, { ScreenTop } from "@/components/ui/AppShell";
import RoadmapList from "@/components/roadmap/RoadmapList";
import TutorPortrait from "@/components/characters/TutorPortrait";
import { useMe } from "@/lib/client/me";
import { getCharacter } from "@/config/characters";
import { SUBJECTS, SUBJECT_BY_ID } from "@/config/subjects";

const RoadmapGraph = lazy(() => import("@/components/roadmap/RoadmapGraph"));

export default function RoadmapPage() {
  const router = useRouter();
  const { user, roadmap, load, loaded } = useMe();
  const [view, setView] = useState<"list" | "graph">("list");
  const [subject, setSubject] = useState<string | null>(null);

  useEffect(() => {
    void load(true).then((u) => {
      if (!u) router.replace("/onboarding");
    });
    const s = new URLSearchParams(window.location.search).get("subject");
    if (s && SUBJECT_BY_ID[s]) setSubject(s);
  }, [load, router]);

  const ch = getCharacter(user?.characterId);
  const sections = subject ? SUBJECT_BY_ID[subject].sections : undefined;

  return (
    <AppShell>
      <ScreenTop title={t.roadmap.title} back="/home" />
      <div className="flex flex-col gap-4 px-[18px] pb-8 md:px-2">
        {roadmap && (
          <div className="card flex items-center gap-3 p-3.5">
            <span className="h-12 w-12 flex-none overflow-hidden rounded-full bg-soft2">
              <TutorPortrait id={ch.id} pose="idle" frame="face" className="h-12 w-12" alt="" />
            </span>
            <p className="m-0 text-[14px] leading-[1.35] font-extrabold">
              <span className="text-blue">{ch.name}:</span> {t.roadmap.summary(roadmap.weakCount)}
            </p>
          </div>
        )}
        <div className="no-scrollbar -mx-[18px] flex gap-2 overflow-x-auto px-[18px] md:mx-0 md:px-0" role="tablist" aria-label="Fanlar">
          <button type="button" role="tab" aria-selected={!subject} onClick={() => setSubject(null)} className={`btn min-h-10 flex-none px-4 text-[14px] ${!subject ? "bg-blue text-white" : ""}`}>
            {t.home.all}
          </button>
          {SUBJECTS.map((s) => (
            <button key={s.id} type="button" role="tab" aria-selected={subject === s.id} onClick={() => setSubject(s.id)} className="btn min-h-10 flex-none px-4 text-[14px]" style={subject === s.id ? { background: s.to, color: "#fff" } : undefined}>
              {s.title}
            </button>
          ))}
        </div>
        <div className="flex gap-2" role="tablist" aria-label="Ko'rinish">
          {(["list", "graph"] as const).map((v) => (
            <button key={v} type="button" role="tab" aria-selected={view === v} onClick={() => setView(v)} className={`btn min-h-10 flex-1 text-[14px] ${view === v ? "bg-ink text-white" : "btn-soft"}`}>
              {v === "list" ? t.roadmap.listView : t.roadmap.mapView}
            </button>
          ))}
        </div>
        {!loaded || !roadmap ? (
          <div className="p-6 text-center font-extrabold text-mut">{t.common.loading}</div>
        ) : view === "list" ? (
          <RoadmapList roadmap={roadmap} characterId={ch.id} subjectSections={sections} />
        ) : (
          <Suspense fallback={<div className="p-6 text-center font-extrabold text-mut">{t.common.loading}</div>}>
            <RoadmapGraph roadmap={roadmap} />
          </Suspense>
        )}
        {roadmap && !roadmap.currentId && (
          <Link href="/diagnostic" className="btn btn-primary w-full">
            {t.home.diagnostic}
          </Link>
        )}
      </div>
    </AppShell>
  );
}
