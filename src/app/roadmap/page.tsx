"use client";
import { lazy, Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { t } from "@/i18n/uz";
import AppShell from "@/components/ui/AppShell";
import { StreakChip, XpChip } from "@/components/ui/hud";
import RoadmapList from "@/components/roadmap/RoadmapList";
import { useMe } from "@/lib/client/me";
import type { CharacterId } from "@/config/characters";
import { getCharacter } from "@/config/characters";

const RoadmapGraph = lazy(() => import("@/components/roadmap/RoadmapGraph"));

export default function RoadmapPage() {
  const router = useRouter();
  const { user, roadmap, load, loaded } = useMe();
  const [view, setView] = useState<"list" | "graph">("list");

  useEffect(() => {
    void load(true).then((u) => {
      if (!u) router.replace("/onboarding");
    });
  }, [load, router]);

  useEffect(() => {
    if (window.matchMedia("(min-width: 1280px)").matches) setView("graph");
  }, []);

  const ch = getCharacter(user?.characterId);

  return (
    <AppShell>
      <div className="bg-sky px-4 pt-4 pb-3 md:px-6 md:pt-6">
        <div className="mx-auto max-w-[1100px]">
          <div className="flex items-center justify-between gap-2">
            <h1 className="m-0 font-pixel text-[26px] font-bold md:text-[32px]">{t.roadmap.title}</h1>
            {user && (
              <div className="flex gap-1.5">
                <StreakChip days={user.streak} long />
                <XpChip xp={user.xp} />
              </div>
            )}
          </div>
          {roadmap && (
            <div className="mt-2.5 rounded-[14px] border-[3px] border-ink bg-white px-3 py-2.5 text-[14px] leading-[1.35] font-bold">
              {ch.name}: {t.roadmap.summary(roadmap.weakCount)}
            </div>
          )}
          <div className="mt-3 flex gap-2" role="tablist" aria-label="Ko'rinish">
            {(["list", "graph"] as const).map((v) => (
              <button
                key={v}
                type="button"
                role="tab"
                aria-selected={view === v}
                onClick={() => setView(v)}
                className={`btn h-10 text-[14px] ${view === v ? "bg-gold" : ""}`}
              >
                {v === "list" ? t.roadmap.listView : t.roadmap.mapView}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="border-t-[3px] border-ink bg-paper px-4 pt-4 pb-8 md:px-6">
        <div className="mx-auto max-w-[1100px]">
          {!loaded || !roadmap ? (
            <div className="p-6 font-pixel text-[18px]">{t.common.loading}</div>
          ) : view === "list" ? (
            <div className="mx-auto max-w-[560px]">
              <RoadmapList roadmap={roadmap} characterId={(user?.characterId ?? "blokbek") as CharacterId} />
            </div>
          ) : (
            <Suspense fallback={<div className="p-6 font-pixel">{t.common.loading}</div>}>
              <RoadmapGraph roadmap={roadmap} />
            </Suspense>
          )}
          {roadmap && !roadmap.currentId && (
            <div className="mt-4 text-center">
              <Link href="/diagnostic" className="btn btn-primary h-14 text-[18px] no-underline">
                {t.diagnostic.title}
              </Link>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
