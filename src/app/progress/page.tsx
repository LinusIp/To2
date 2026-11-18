"use client";
// "Progress" (prototype screen 5): level + XP, overall bar, per-subject mastery, badges, mastered skills.
import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { t } from "@/i18n/uz";
import AppShell, { ScreenTop } from "@/components/ui/AppShell";
import { Progress } from "@/components/ui/Progress";
import { CountUp } from "@/components/ui/CountUp";
import { IconTile, LinkCard } from "@/components/ui/Card";
import { SkeletonPage } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/States";
import { ui } from "@/i18n/uz-ui";
import { BarsIcon, CheckIcon, FlameIcon, LockIcon, StarIcon, TriangleIcon } from "@/components/ui/icons";
import { SUBJECTS } from "@/config/subjects";
import { SKILLS, SKILL_BY_ID } from "@/data/skills";
import { MASTERED } from "@/lib/learning/mastery";
import { useMe } from "@/lib/client/me";

export default function ProgressPage() {
  const router = useRouter();
  const { user, mastery, lessonsFinished, load } = useMe();
  useEffect(() => {
    void load(true).then((u) => {
      if (!u) router.replace("/onboarding");
    });
  }, [load, router]);

  if (!user)
    return (
      <AppShell>
        <ScreenTop title={t.tabs.progress} back="/home" />
        <SkeletonPage rows={5} />
      </AppShell>
    );

  const mastered = Object.entries(mastery).filter(([, p]) => p >= MASTERED).map(([id]) => id);
  const subj = SUBJECTS.map((s) => {
    const ids = SKILLS.filter((k) => s.sections.includes(k.section)).map((k) => k.id);
    const done = ids.filter((id) => (mastery[id] ?? 0) >= MASTERED).length;
    return { s, pct: Math.round((done / Math.max(1, ids.length)) * 100) };
  });
  const badges = [
    { on: lessonsFinished >= 1, label: t.profile.badgeNames.first },
    { on: user.streak >= 3, label: t.profile.badgeNames.streak3 },
    { on: user.xp >= 100, label: t.profile.badgeNames.xp100 },
    { on: mastered.length >= 1, label: t.profile.badgeNames.master1 },
    { on: mastered.length >= 5, label: t.profile.badgeNames.master5 },
  ];

  return (
    <AppShell>
      <ScreenTop title={t.tabs.progress} back="/home" />
      <div className="flex flex-col gap-4 px-[18px] pb-8 md:px-2">
        <div className="card overflow-hidden">
          <div className="card-head relative px-4 pt-4 pb-5" style={{ ["--hd" as string]: "var(--color-blue)" }}>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-3 rounded-2xl bg-white/15 p-3 shadow-[inset_0_0_0_2px_rgba(255,255,255,.18)]">
                <span className="bounce-in grid h-12 w-12 flex-none place-items-center rounded-2xl bg-white shadow-[0_3px_0_rgba(0,0,0,.15)]">
                  <StarIcon size={32} />
                </span>
                <div>
                  <CountUp value={user.level} className="block text-[32px] leading-none font-black" />
                  <div className="t-small mt-1 opacity-95">{t.profile.level.toLowerCase()}</div>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-2xl bg-white/15 p-3 shadow-[inset_0_0_0_2px_rgba(255,255,255,.18)]">
                <span className="bounce-in grid h-12 w-12 flex-none place-items-center rounded-2xl bg-white shadow-[0_3px_0_rgba(0,0,0,.15)]" style={{ animationDelay: "120ms" }}>
                  <FlameIcon size={28} />
                </span>
                <div>
                  <CountUp value={user.xp} className="block text-[32px] leading-none font-black" />
                  <div className="t-small mt-1 opacity-95">{ui.xp}</div>
                </div>
              </div>
            </div>
          </div>
          <div className="px-4 pt-4 pb-4">
            <Progress value={user.xpInLevel} max={user.xpPerLevel} label="XP" color="linear-gradient(90deg,#ffc42e,#f59e0b)" height={14} />
            <div className="t-small mt-2 flex justify-between text-mut">
              <span className="font-black text-ink">
                <CountUp value={user.xpInLevel} /> / {user.xpPerLevel} XP
              </span>
              <span>{t.profile.streakDays(user.streak)}</span>
            </div>
          </div>
        </div>

        <div className="mx-0.5 mt-2 flex items-center justify-between">
          <h2 className="t-h3 m-0">Mavzular bo&apos;yicha</h2>
          <Link href="/roadmap" className="text-[14px] font-extrabold text-blue no-underline">
            {t.home.all} →
          </Link>
        </div>
        <div className="stagger flex flex-col gap-3">
          {subj.map(({ s, pct }) => (
            <LinkCard key={s.id} href={`/roadmap?subject=${s.id}`} className="flex items-center gap-3.5 p-3.5">
              <IconTile color={s.to}>
                <span className="text-[17px]">{pct === 100 ? <CheckIcon size={20} /> : s.icon === "triangle" ? <TriangleIcon size={22} /> : s.icon === "bars" ? <BarsIcon size={22} /> : s.glyph}</span>
              </IconTile>
              <div className="min-w-0 flex-1">
                <div className="t-body flex justify-between font-extrabold">
                  <span>{s.title}</span>
                  <span style={{ color: pct === 100 ? "#15803d" : undefined }}>{pct}%</span>
                </div>
                <Progress value={pct} className="mt-1.5" color={s.bar} height={10} label={s.title} />
              </div>
            </LinkCard>
          ))}
        </div>

        <div className="mx-0.5 mt-2 flex items-center justify-between">
          <h2 className="t-h3 m-0">{t.profile.badges}</h2>
          <span className="chip chip-soft">{ui.badgesEarned(badges.filter((b) => b.on).length, badges.length)}</span>
        </div>
        <div className="stagger grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {badges.map((b) => (
            <div
              key={b.label}
              className={`flex min-h-[56px] items-center gap-2.5 rounded-2xl px-3 py-2.5 text-[14px] leading-tight font-extrabold ${b.on ? "bg-[#fff4dc] text-[#7a4a00] shadow-[0_3px_0_#f2d488]" : "border-2 border-dashed border-[#cdd5ec] bg-white/70 text-[#5f6788]"}`}
            >
              <span className={`grid h-9 w-9 flex-none place-items-center rounded-xl ${b.on ? "bounce-in bg-white shadow-[0_2px_0_#f2d488]" : "bg-[#eef1f8]"}`}>
                {b.on ? <StarIcon size={20} /> : <LockIcon size={14} />}
              </span>
              {b.label}
            </div>
          ))}
        </div>

        {mastered.length === 0 && (
          <div className="card">
            <EmptyState tutor={user.characterId} text={ui.noBadges} />
          </div>
        )}
        {mastered.length > 0 && (
          <>
            <h2 className="t-h3 mx-0.5 mt-2 mb-0">{t.profile.mastered}</h2>
            <div className="flex flex-col gap-2">
              {mastered.map((id) => (
                <LinkCard key={id} href={`/practice/${id}`} className="flex items-center gap-3 px-3.5 py-3">
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-green text-white">
                    <CheckIcon size={14} />
                  </span>
                  <span className="font-extrabold">{SKILL_BY_ID[id]?.title_uz ?? id}</span>
                </LinkCard>
              ))}
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
