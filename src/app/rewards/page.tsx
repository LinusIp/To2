"use client";
// "Mukofotlar" tab (mockup v2 bottom bar): badges earned so far + the tutor collection (unlocks).
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { t } from "@/i18n/uz";
import AppShell, { ScreenTop } from "@/components/ui/AppShell";
import TutorPortrait from "@/components/characters/TutorPortrait";
import { LockIcon, StarIcon, TrophyIcon } from "@/components/ui/icons";
import { CHARACTERS, isUnlocked, lockText } from "@/config/characters";
import { MASTERED } from "@/lib/learning/mastery";
import { useMe } from "@/lib/client/me";

export default function RewardsPage() {
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

  const mastered = Object.values(mastery).filter((p) => p >= MASTERED).length;
  const badges = [
    { on: lessonsFinished >= 1, label: t.profile.badgeNames.first, need: "1 ta dars" },
    { on: user.streak >= 3, label: t.profile.badgeNames.streak3, need: "3 kun ketma-ket" },
    { on: user.xp >= 100, label: t.profile.badgeNames.xp100, need: "100 XP" },
    { on: mastered >= 1, label: t.profile.badgeNames.master1, need: "1 mavzu" },
    { on: mastered >= 5, label: t.profile.badgeNames.master5, need: "5 mavzu" },
  ];
  const got = badges.filter((b) => b.on).length;

  return (
    <AppShell>
      <ScreenTop title={t.tabs.rewards} back="/home" />
      <div className="flex flex-col gap-4 px-[18px] pb-8 md:px-2">
        <div className="card flex items-center gap-4 p-4">
          <TrophyIcon size={52} />
          <div>
            <div className="text-[28px] leading-none font-black">
              {got}/{badges.length}
            </div>
            <div className="text-[13px] font-bold text-mut">{t.profile.badges}</div>
          </div>
          <div className="ml-auto text-right">
            <div className="text-[22px] leading-none font-black">{user.xp}</div>
            <div className="text-[13px] font-bold text-mut">XP</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          {badges.map((b) => (
            <div key={b.label} className={`flex flex-col items-center gap-1.5 rounded-[20px] p-4 text-center ${b.on ? "bg-[#fff3d1] text-[#7a4d00]" : "bg-[#e9edf7] text-[#6b7392]"}`}>
              {b.on ? <StarIcon size={34} /> : <LockIcon size={22} />}
              <div className="text-[14px] font-black">{b.label}</div>
              {!b.on && <div className="text-[12px] font-extrabold">{b.need}</div>}
            </div>
          ))}
        </div>

        <h2 className="mx-0.5 mt-2 mb-0 text-[18px] font-black">{t.tutors.title}</h2>
        <div className="grid grid-cols-4 gap-2">
          {CHARACTERS.map((c) => {
            const open = isUnlocked(c.id, user.xp, user.streak);
            return (
              <div key={c.id} className="flex flex-col items-center gap-1 text-center" aria-label={open ? c.name : `${c.name}: ${lockText(c, user.xp)}`}>
                <div className={`h-[72px] w-[72px] overflow-hidden rounded-[18px] ${open ? "bg-[#dbe6ff]" : "bg-[#e9edf7]"}`}>
                  <TutorPortrait id={c.id} pose="idle" frame="face" alt="" className="h-full w-full" style={open ? undefined : { opacity: 0.45, filter: "saturate(.4)" }} />
                </div>
                <div className="text-[12px] font-black">{c.name}</div>
                {!open && <div className="text-[11px] font-extrabold text-mut">{lockText(c, user.xp)}</div>}
              </div>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}
