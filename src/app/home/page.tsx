"use client";
// "Bosh sahifa" (prototype screen 2): today's lesson from the personal roadmap, subjects, progress.
import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { t } from "@/i18n/uz";
import AppShell from "@/components/ui/AppShell";
import TutorPortrait from "@/components/characters/TutorPortrait";
import { Bar, StreakChip } from "@/components/ui/hud";
import { ArrowIcon, TrophyIcon } from "@/components/ui/icons";
import { SUBJECTS } from "@/config/subjects";
import TopicAsk from "@/components/home/TopicAsk";
import { getCharacter } from "@/config/characters";
import { GUEST_NAME } from "@/config/brand";
import { aaFill } from "@/lib/format/color";
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
  const ch = getCharacter(user?.characterId);
  const charId = ch.id;
  // U4: no "Salom, Mehmon!" — a learner without a nickname is greeted by the tutor's own line
  const nick = user?.nickname?.trim() ?? "";
  const guest = !!user && (!nick || nick === GUEST_NAME);

  return (
    <AppShell>
      <div className="px-[18px] pt-3 md:px-2 md:pt-6">
        {/* mockup v2 (screen s2): avatar · streak + settings, a big hello with the tutor, today's lesson card */}
        <div className="flex h-[52px] items-center justify-between">
          <Link href="/tutors" aria-label={t.home.chooseTutor} title={t.home.chooseTutor} className="h-11 w-11 overflow-hidden rounded-full bg-soft2">
            <TutorPortrait id={charId} pose="idle" frame="face" className="h-11 w-11" alt="" />
          </Link>
          <div className="flex items-center gap-2.5">{user && <StreakChip days={user.streak} />}</div>
        </div>
        <div className="relative mt-1 flex h-[150px] items-end justify-between">
          <div className="mb-5 min-w-0">
            <h1 className="m-0 text-[34px] leading-[1.1] font-black">
              {guest || !user ? (
                "Salom!"
              ) : (
                <>
                  Salom,
                  <br />
                  {nick}!
                </>
              )}
            </h1>
            {guest && (
              <p className="m-0 mt-1.5 max-w-[210px] text-[14px] leading-snug font-extrabold text-mut" data-testid="home-tutor-hi">
                {ch.name}: «{ch.hi}»
              </p>
            )}
          </div>
          <TutorPortrait id={charId} pose="thumbs" frame="half" className="h-[170px] w-[170px]" alt="" style={{ objectPosition: "50% 100%" }} />
        </div>

        {/* today's lesson */}
        {cur ? (
          <div className="chalk-card relative -mt-3 overflow-hidden p-5" data-testid="home-today">
            <div className="text-[14px] font-extrabold text-[#cfe3d6]">{t.home.today}</div>
            <div className="mt-1 font-chalk text-[23px] leading-[1.2] text-[#f3f0e6]">{cur.title}</div>
            <Bar value={Math.round(cur.p * 100)} className="mt-3 w-[70%] !bg-white/15" color="#f2c94c" label={t.practice.mastery} />
            <div className="mt-1 text-[12px] font-extrabold text-[#cfe3d6]">
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
          <span className="grid h-[60px] w-[60px] flex-none place-items-center rounded-[18px] shadow-[inset_0_-5px_0_rgba(0,0,0,.14)]" style={{ background: "#2563eb" }} aria-hidden>
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
          {SUBJECTS.map((s) => {
            const body = (
              <>
                <b className={`${s.icon.length > 3 ? "text-[19px]" : "text-[26px]"} leading-none font-black`}>{s.icon}</b>
                <span className="px-1 text-center leading-tight">{s.name}</span>
                {s.status !== "live" && (
                  <span className={`rounded-full px-2 py-[1px] text-[10px] font-black ${s.status === "beta" ? "bg-black/25 text-white" : "bg-white text-[#5f6787]"}`}>
                    {s.status === "beta" ? t.home.beta : t.home.soon}
                  </span>
                )}
              </>
            );
            const cls = "flex h-24 flex-col items-center justify-center gap-1 rounded-[20px] text-[14px] font-extrabold no-underline";
            if (s.status === "soon")
              return (
                <div key={s.id} aria-disabled="true" className={`${cls} bg-[#e6ebf8] text-[#5f6787]`}>
                  {body}
                </div>
              );
            return (
              <Link
                key={s.id}
                href={s.href ?? "#istalgan-mavzu"}
                onClick={s.href ? undefined : () => setTimeout(() => document.getElementById("topic-input")?.focus(), 50)}
                className={`${cls} text-white shadow-[inset_0_-4px_0_rgba(0,0,0,.12)]`}
                style={{ background: aaFill(s.to) }}
              >
                {body}
              </Link>
            );
          })}
        </div>
        <TopicAsk />

        {/* progress */}
        <Link href="/progress" className="card mt-4 mb-4 flex items-center gap-3.5 p-4 no-underline">
          <TrophyIcon />
          <div className="flex-1">
            <div className="text-[16px] font-black">{t.home.yourProgress}</div>
            <div className="mt-0.5 mb-2 text-[13px] font-bold text-mut">
              {t.home.lessonsOf(masteredAll, totalAll)} · {pathNodes.length ? t.roadmap.steps(pathNodes.filter((n) => n.status === "mastered").length, pathNodes.length) : ""}
            </div>
            <Bar value={masteredAll} max={totalAll} label={t.home.yourProgress} />
          </div>
        </Link>
      </div>
    </AppShell>
  );
}
