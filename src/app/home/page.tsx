"use client";
// "Bosh sahifa" (prototype screen 2): today's lesson from the personal roadmap, subjects, progress.
import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { t } from "@/i18n/uz";
import AppShell from "@/components/ui/AppShell";
import TutorPortrait from "@/components/characters/TutorPortrait";
import { Bar, StreakChip } from "@/components/ui/hud";
import { ArrowIcon, BarsIcon, Logo, TriangleIcon, TrophyIcon, GearIcon } from "@/components/ui/icons";
import { SUBJECTS } from "@/config/subjects";
import { getCharacter } from "@/config/characters";
import { useMe } from "@/lib/client/me";

export default function HomePage() {
  const router = useRouter();
  const { user, roadmap, load, loaded } = useMe();
  useEffect(() => {
    void load(true).then((u) => {
      if (!u) router.replace("/onboarding");
    });
  }, [load, router]);

  const cur = roadmap?.nodes.find((n) => n.id === roadmap.currentId);
  const pathNodes = roadmap?.nodes.filter((n) => n.onPath) ?? [];
  const masteredAll = roadmap?.nodes.filter((n) => n.status === "mastered").length ?? 0;
  const totalAll = roadmap?.nodes.length ?? 1;
  const charId = getCharacter(user?.characterId).id;

  return (
    <AppShell>
      <div className="px-[18px] pt-3 md:px-2 md:pt-6">
        {/* mockup v2 (screen s2): avatar · streak + settings, a big hello with the tutor, today's lesson card */}
        <div className="flex h-[52px] items-center justify-between">
          <Link href="/tutors" aria-label={t.home.chooseTutor} title={t.home.chooseTutor} className="h-11 w-11 overflow-hidden rounded-full bg-soft2">
            <TutorPortrait id={charId} pose="idle" frame="face" className="h-11 w-11" alt="" />
          </Link>
          <div className="flex items-center gap-2.5">
            {user && <StreakChip days={user.streak} />}
            <Link href="/settings" aria-label={t.tabs.profile} title={t.tabs.profile} className="icon-btn bg-white">
              <GearIcon size={22} />
            </Link>
          </div>
        </div>
        <div className="relative mt-1 flex h-[150px] items-end justify-between">
          <h1 className="m-0 mb-6 text-[34px] leading-[1.1] font-black">
            Salom,
            <br />
            {user?.nickname ?? ""}!
          </h1>
          <TutorPortrait id={charId} pose="thumbs" frame="half" className="h-[170px] w-[170px]" alt="" style={{ objectPosition: "50% 100%" }} />
        </div>

        {/* today's lesson */}
        {cur ? (
          <div className="relative -mt-3 overflow-hidden rounded-[24px] p-5 shadow-[0_10px_24px_rgba(47,107,255,.15)]" style={{ background: "linear-gradient(140deg,#dbe7ff,#bcd3ff)" }}>
            <div className="text-[14px] font-extrabold text-[#3a4a80]">{t.home.today}</div>
            <div className="mt-1 w-[78%] text-[21px] leading-[1.15] font-black">{cur.title}</div>
            <Bar value={Math.round(cur.p * 100)} className="mt-3 w-[70%] bg-white/60" label={t.practice.mastery} />
            <div className="mt-1 text-[12px] font-extrabold text-[#3a4a80]">
              {Math.round(cur.p * 100)}% · {cur.section}
            </div>
            <Link href={`/lesson/${cur.id}`} className="btn btn-primary mt-3 min-h-11 px-5 text-[15px]">
              {t.lesson.start} <ArrowIcon size={16} />
            </Link>
          </div>
        ) : (
          loaded && (
            <Link href="/diagnostic" className="card mt-2 flex items-center gap-3 p-5 no-underline">
              <div className="flex-1">
                <div className="text-[18px] font-black">{t.home.noPath}</div>
                <div className="mt-3 inline-flex items-center gap-2 font-black text-blue">
                  {t.home.diagnostic} <ArrowIcon size={16} />
                </div>
              </div>
            </Link>
          )
        )}

        {/* O'yinlar: a 5-minute game on today's skill */}
        <Link href={cur ? `/games/tower?skill=${cur.id}` : "/games/tower"} className="card mt-4 flex items-center gap-3.5 p-4 no-underline" data-testid="home-game-card">
          <span className="grid h-[60px] w-[60px] flex-none place-items-center rounded-[18px] shadow-[inset_0_-5px_0_rgba(0,0,0,.14)]" style={{ background: "linear-gradient(160deg,#4d86ff,#2f6bff)" }} aria-hidden>
            <span className="flex flex-col-reverse items-center gap-[2px]">
              {["#22b45a", "#ff8a1f", "#ffc42e"].map((c, i) => (
                <span key={c} className="vx-block block w-[34px]" style={{ background: c, height: 12, marginLeft: (i % 2) * 6 - 3 }} />
              ))}
            </span>
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[17px] font-black">{t.games.homeCard}</span>
            <span className="mt-0.5 block text-[13px] font-bold text-mut">{t.games.homeCardText}</span>
          </span>
          <ArrowIcon size={18} />
        </Link>

        {/* subjects */}
        <div className="mx-0.5 mt-6 mb-2.5 flex items-center justify-between">
          <h2 className="m-0 text-[22px] font-black">{t.home.subjects}</h2>
          <Link href="/roadmap" className="flex items-center gap-1.5 font-extrabold text-ink no-underline">
            {t.home.all} <ArrowIcon size={16} />
          </Link>
        </div>
        <div className="grid grid-cols-3 gap-2.5">
          {SUBJECTS.map((s) => (
            <Link
              key={s.id}
              href={`/roadmap?subject=${s.id}`}
              className="flex h-24 flex-col items-center justify-center gap-1.5 rounded-[20px] text-[14px] font-extrabold text-white no-underline shadow-[inset_0_-4px_0_rgba(0,0,0,.12)]"
              style={{ background: `linear-gradient(160deg,${s.from},${s.to})` }}
            >
              {s.icon === "triangle" ? <TriangleIcon /> : s.icon === "bars" ? <BarsIcon /> : <b className="text-[26px] leading-none font-black">{s.glyph}</b>}
              {s.title}
            </Link>
          ))}
          <div className="flex h-24 items-center justify-center rounded-[20px] bg-[#e6ebf8] text-center text-[13px] font-extrabold text-[#8a92b0]">{t.home.soon}</div>
        </div>

        {/* progress */}
        <Link href="/progress" className="card mt-4 mb-4 flex items-center gap-3.5 p-4 no-underline">
          <TrophyIcon />
          <div className="flex-1">
            <div className="text-[16px] font-black">{t.home.yourProgress}</div>
            <div className="mt-0.5 mb-2 text-[13px] font-bold text-mut">
              {t.home.lessonsOf(masteredAll, totalAll)} · {pathNodes.length ? t.roadmap.steps(pathNodes.filter((n) => n.status === "mastered").length, pathNodes.length) : ""}
            </div>
            <Bar value={masteredAll} max={totalAll} />
          </div>
        </Link>
      </div>
    </AppShell>
  );
}
