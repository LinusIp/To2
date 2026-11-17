"use client";
// "Progress" (prototype screen 5): level + XP, overall bar, per-subject mastery, badges, mastered skills.
import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { t } from "@/i18n/uz";
import AppShell, { ScreenTop } from "@/components/ui/AppShell";
import { Bar } from "@/components/ui/hud";
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
        <div className="p-8 text-center font-extrabold text-mut">{t.common.loading}</div>
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
        <div className="card p-4">
          <div className="grid grid-cols-2 gap-2.5">
            <div className="flex items-center gap-2.5 rounded-2xl bg-[#f6f8fe] p-2.5">
              <StarIcon size={40} />
              <div>
                <div className="text-[28px] leading-none font-black">{user.level}</div>
                <div className="text-[13px] font-bold text-mut">{t.profile.level.toLowerCase()}</div>
              </div>
            </div>
            <div className="flex items-center gap-2.5 rounded-2xl bg-[#f6f8fe] p-2.5">
              <FlameIcon size={36} />
              <div>
                <div className="text-[28px] leading-none font-black">{user.xp}</div>
                <div className="text-[13px] font-bold text-mut">tajriba ochkosi</div>
              </div>
            </div>
          </div>
          <Bar value={user.xpInLevel} max={user.xpPerLevel} className="mt-4" label="XP" />
          <div className="mt-2 text-center font-black">
            {user.xpInLevel} / {user.xpPerLevel} XP · {t.profile.streakDays(user.streak)}
          </div>
        </div>

        <div className="mx-0.5 mt-2 flex items-center justify-between">
          <h2 className="m-0 text-[18px] font-black">Mavzular bo&apos;yicha</h2>
          <Link href="/roadmap" className="text-[14px] font-extrabold text-blue no-underline">
            {t.home.all} →
          </Link>
        </div>
        <div className="flex flex-col gap-2.5">
          {subj.map(({ s, pct }) => (
            <Link key={s.id} href={`/roadmap?subject=${s.id}`} className="card flex items-center gap-3.5 p-3.5 no-underline">
              <span className="grid h-10 w-10 flex-none place-items-center rounded-[11px] text-[16px] font-black text-white" style={{ background: s.to }}>
                {pct === 100 ? <CheckIcon size={18} /> : s.icon === "triangle" ? <TriangleIcon size={20} /> : s.icon === "bars" ? <BarsIcon size={20} /> : s.glyph}
              </span>
              <div className="flex-1">
                <div className="flex justify-between font-extrabold">
                  <span>{s.title}</span>
                  <span style={{ color: pct === 100 ? "#22b45a" : undefined }}>{pct}%</span>
                </div>
                <Bar value={pct} className="mt-2 !h-2" color={s.bar} />
              </div>
            </Link>
          ))}
        </div>

        <h2 className="mx-0.5 mt-2 mb-0 text-[18px] font-black">{t.profile.badges}</h2>
        <div className="flex flex-wrap gap-2">
          {badges.map((b) => (
            <div key={b.label} className={`flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[14px] font-extrabold ${b.on ? "bg-[#fff3d1] text-[#a86b00]" : "bg-[#e9edf7] text-[#8a92b0]"}`}>
              {b.on ? <StarIcon size={16} /> : <LockIcon size={12} />}
              {b.label}
            </div>
          ))}
        </div>

        {mastered.length > 0 && (
          <>
            <h2 className="mx-0.5 mt-2 mb-0 text-[18px] font-black">{t.profile.mastered}</h2>
            <div className="flex flex-col gap-2">
              {mastered.map((id) => (
                <Link key={id} href={`/practice/${id}`} className="card flex items-center gap-3 px-3.5 py-3 no-underline">
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-green text-white">
                    <CheckIcon size={14} />
                  </span>
                  <span className="font-extrabold">{SKILL_BY_ID[id]?.title_uz ?? id}</span>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
