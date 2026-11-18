"use client";
// "Darslar" tab: town picker — one voxel town per course, progress = buildings built.
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { t } from "@/i18n/uz";
import AppShell, { ScreenTop } from "@/components/ui/AppShell";
import { ArrowIcon, LockIcon } from "@/components/ui/icons";
import { Bar } from "@/components/ui/hud";
import { useMe } from "@/lib/client/me";
import { TOWNS, TOWN_DEFAULT_SIZE } from "@/config/towns";
import { CURRICULA } from "@/data/curricula";
import { loadTown, loadTownProgress, resolvePending } from "@/lib/client/town";

export default function TownsPage() {
  const router = useRouter();
  const { load, loaded } = useMe();
  const [progress, setProgress] = useState<Record<string, number[]>>({});
  const [sizes, setSizes] = useState<Record<string, number>>({});
  const [images, setImages] = useState<Record<string, string>>({});

  useEffect(() => {
    void (async () => {
      const u = await load(true);
      if (!u) return router.replace("/onboarding");
      await resolvePending(useMe.getState().mastery); // a quest finished elsewhere still counts
      setProgress(await loadTownProgress());
      const towns = await Promise.all(TOWNS.filter((tw) => CURRICULA[tw.curriculum]).map(async (tw) => [tw.id, await loadTown(tw.id)] as const));
      setSizes(Object.fromEntries(towns.map(([id, d]) => [id, d?.town.quests.length ?? TOWN_DEFAULT_SIZE])));
      setImages(Object.fromEntries(towns.map(([id, d]) => [id, d?.town.image ?? "/ui/island.webp"])));
    })();
  }, [load, router]);

  const cards = useMemo(
    () =>
      TOWNS.map((tw) => {
        const available = !!CURRICULA[tw.curriculum];
        const total = sizes[tw.id] ?? TOWN_DEFAULT_SIZE;
        const done = Math.min(total, progress[tw.id]?.length ?? 0);
        return { ...tw, available, total, done };
      }),
    [sizes, progress],
  );

  return (
    <AppShell>
      <ScreenTop title={t.town.pickerTitle} back="/home" />
      <div className="flex flex-col gap-4 px-[18px] pb-8 md:px-2">
        <p className="m-0 text-[14px] leading-[1.35] font-extrabold text-mut">{t.town.pickerIntro}</p>
        {!loaded ? (
          <div className="p-6 text-center font-extrabold text-mut">{t.common.loading}</div>
        ) : (
          cards.map((c) =>
            c.available ? (
              <Link key={c.id} href={`/town/${c.id}`} className="card flex items-center gap-3 overflow-hidden p-3 no-underline" aria-label={`${c.name}, ${t.town.progress(c.done, c.total)}`}>
                <span className="h-[84px] w-[84px] flex-none overflow-hidden rounded-[18px]" style={{ background: "linear-gradient(180deg,#4f8ff7,#a9d0ff)" }}>
                  <img src={images[c.id] ?? "/ui/island.webp"} alt="" className="h-full w-full object-cover" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[18px] leading-[1.15] font-black">{c.name}</span>
                  <span className="mt-1 block text-[13px] font-extrabold" style={{ color: c.colour }}>
                    {t.town.progress(c.done, c.total)}
                  </span>
                  <Bar value={Math.round((c.done / Math.max(1, c.total)) * 100)} className="mt-2" label={t.town.progress(c.done, c.total)} />
                </span>
                <ArrowIcon />
              </Link>
            ) : (
              <div key={c.id} className="flex items-center gap-3 rounded-[22px] bg-[#e9edf7] p-3 text-[#4f5878]" aria-disabled aria-label={`${c.name}, ${t.town.soon}`}>
                <span className="grid h-[84px] w-[84px] flex-none place-items-center rounded-[18px] bg-[#dfe4f1]">
                  <LockIcon size={22} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[18px] leading-[1.15] font-black">{c.name}</span>
                  <span className="mt-1 block text-[13px] font-extrabold">
                    {t.town.soon} · {t.town.progress(0, c.total)}
                  </span>
                </span>
              </div>
            ),
          )
        )}
        <Link href="/roadmap" className="btn btn-soft min-h-11 w-full text-[14px]">
          {t.roadmap.title} <ArrowIcon />
        </Link>
      </div>
    </AppShell>
  );
}
