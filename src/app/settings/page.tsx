"use client";
// "Sozlamalar" (prototype screen 8).
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { t } from "@/i18n/uz";
import AppShell, { ScreenTop } from "@/components/ui/AppShell";
import TutorPortrait from "@/components/characters/TutorPortrait";
import { ChevronIcon } from "@/components/ui/icons";
import { getCharacter } from "@/config/characters";
import { useMe } from "@/lib/client/me";
import { readPref, writePref } from "@/lib/client/prefs";
import { OptionList, PresetCards } from "@/components/a11y/QulaylikPanel";

function Toggle({ on }: { on: boolean }) {
  return (
    <span className={`relative ml-auto h-[30px] w-[50px] flex-none rounded-full transition-colors ${on ? "bg-blue" : "bg-[#cdd4ea]"}`} aria-hidden>
      <span className="absolute top-[3px] h-6 w-6 rounded-full bg-white shadow-[0_2px_4px_rgba(0,0,0,.2)] transition-all" style={{ left: on ? 23 : 3 }} />
    </span>
  );
}

const Row = ({ children, href, onClick, role, checked }: { children: React.ReactNode; href?: string; onClick?: () => void; role?: string; checked?: boolean }) => {
  const cls = "flex h-14 w-full items-center gap-3.5 px-4 text-[16px] font-extrabold text-ink no-underline [&+&]:border-t [&+&]:border-line";
  return href ? (
    <Link href={href} className={cls}>
      {children}
    </Link>
  ) : (
    <button type="button" className={`${cls} cursor-pointer border-0 bg-transparent text-left font-[inherit]`} onClick={onClick} role={role} aria-checked={checked}>
      {children}
    </button>
  );
};

const Ico = ({ d }: { d: string }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#141a3a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d={d} />
  </svg>
);

export default function SettingsPage() {
  const router = useRouter();
  const { user, load, setUser } = useMe();
  const [sound, setSound] = useState(true);
  const [notif, setNotif] = useState(true);
  useEffect(() => {
    void load().then((u) => {
      if (!u) router.replace("/onboarding");
    });
    setSound(readPref("sound", "1") === "1");
    setNotif(readPref("notif", "1") === "1");
  }, [load, router]);

  const setGrade = async (g: number) => {
    if (!user) return;
    const r = await fetch("/api/user", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ grade: g }) });
    if (r.ok) setUser({ ...user, grade: g });
    void load(true);
  };

  const reset = async () => {
    if (!window.confirm(t.profile.reset + "?")) return;
    await fetch("/api/user", { method: "DELETE" });
    await load(true);
    router.replace("/");
  };

  const ch = getCharacter(user?.characterId);

  return (
    <AppShell>
      <ScreenTop title={t.settings.title} back="/home" />
      <div className="flex flex-col gap-3.5 px-[18px] pb-8 md:px-2">
        <Link href="/tutors" className="card flex h-[86px] items-center gap-3.5 px-4 no-underline">
          <span className="h-[58px] w-[58px] flex-none overflow-hidden rounded-2xl bg-soft2">
            <TutorPortrait id={ch.id} pose="idle" frame="face" className="h-[58px] w-[58px]" alt="" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[19px] font-black">{user?.nickname ?? "…"}</span>
            <span className="text-[14px] font-bold text-mut">
              {user ? t.common.grade(user.grade) : ""} · {ch.name}
            </span>
          </span>
          <ChevronIcon size={18} className="text-mut" />
        </Link>

        <div className="card overflow-hidden">
          <Row>
            <Ico d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18" />
            {t.settings.language}
            <span className="ml-auto flex items-center gap-1.5 font-bold text-mut">{t.settings.languageVal}</span>
          </Row>
          <Row
            role="switch"
            checked={sound}
            onClick={() => {
              setSound((s) => {
                writePref("sound", s ? "0" : "1");
                return !s;
              });
            }}
          >
            <Ico d="M4 9v6h4l5 4V5L8 9zM16 9a4 4 0 0 1 0 6" />
            {t.settings.sound}
            <Toggle on={sound} />
          </Row>
          <Row
            role="switch"
            checked={notif}
            onClick={() => {
              setNotif((s) => {
                writePref("notif", s ? "0" : "1");
                return !s;
              });
            }}
          >
            <Ico d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 20a2 2 0 0 0 4 0" />
            {t.settings.notifications}
            <Toggle on={notif} />
          </Row>
        </div>

        <div className="card px-4 py-3.5">
          <div id="grade-l" className="mb-2.5 text-[16px] font-extrabold">
            {t.settings.grade}
          </div>
          <div role="radiogroup" aria-labelledby="grade-l" className="grid grid-cols-5 gap-2">
            {[5, 6, 7, 8, 9].map((g) => (
              <button key={g} type="button" role="radio" aria-checked={user?.grade === g} onClick={() => void setGrade(g)} className={`h-11 rounded-xl text-[18px] font-black ${user?.grade === g ? "bg-blue text-white" : "bg-soft text-ink"}`}>
                {g}
              </button>
            ))}
          </div>
        </div>

        <section aria-labelledby="qulaylik" className="flex flex-col gap-3">
          <h2 id="qulaylik" className="m-0 mt-1 text-[20px] font-black">
            {t.a11y.title}
          </h2>
          <PresetCards />
          <OptionList />
        </section>

        <div className="card overflow-hidden">
          <Row href="/tutors">
            <Ico d="M12 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
            {t.settings.changeTutor}
            <ChevronIcon className="ml-auto text-mut" />
          </Row>
          <Row href="/diagnostic">
            <Ico d="M9 11l3 3 8-8M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9" />
            Qayta tekshiruv (diagnostika)
            <ChevronIcon className="ml-auto text-mut" />
          </Row>
          <Row href="/maxfiylik">
            <Ico d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />
            {t.privacy.title}
            <ChevronIcon className="ml-auto text-mut" />
          </Row>
          <Row href="/">
            <Ico d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 11v6M12 7h.01" />
            {t.settings.about}
            <ChevronIcon className="ml-auto text-mut" />
          </Row>
        </div>

        <button type="button" className="btn w-full text-[#c2410c]" onClick={() => void reset()}>
          {t.profile.reset}
        </button>
      </div>
    </AppShell>
  );
}
