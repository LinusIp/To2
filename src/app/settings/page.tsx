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
import { toast } from "@/components/ui/Toast";
import { SkeletonPage } from "@/components/ui/Skeleton";
import { ui } from "@/i18n/uz-ui";
import { OptionList, PresetCards } from "@/components/a11y/QulaylikPanel";

function Toggle({ on }: { on: boolean }) {
  return (
    <span className="switch ml-auto" data-on={on} aria-hidden />
  );
}

const Row = ({ children, href, onClick, role, checked }: { children: React.ReactNode; href?: string; onClick?: () => void; role?: string; checked?: boolean }) => {
  const cls =
    "flex min-h-14 w-full items-center gap-3.5 px-4 py-2 text-[16px] font-extrabold text-ink no-underline transition-colors duration-150 hover:bg-[#f6f8fe] active:bg-[#eef2fd] [&+&]:border-t [&+&]:border-line";
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

// one icon style: a tinted rounded tile with a 2.2-px line icon
const Ico = ({ d, c = "#2563eb" }: { d: string; c?: string }) => (
  <span className="grid h-10 w-10 flex-none place-items-center rounded-xl" style={{ background: `color-mix(in srgb, ${c} 12%, #fff)`, color: c }} aria-hidden>
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  </span>
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
    if (r.ok) {
      setUser({ ...user, grade: g });
      toast(ui.gradeSaved(g), "success");
    } else toast(ui.error, "error");
    void load(true);
  };

  const reset = async () => {
    if (!window.confirm(t.profile.reset + "?")) return;
    await fetch("/api/user", { method: "DELETE" });
    await load(true);
    router.replace("/");
  };

  const ch = getCharacter(user?.characterId);

  if (!user)
    return (
      <AppShell>
        <ScreenTop title={t.settings.title} back="/home" />
        <SkeletonPage rows={3} />
      </AppShell>
    );

  return (
    <AppShell>
      <ScreenTop title={t.settings.title} back="/home" />
      <div className="stagger flex flex-col gap-4 px-[18px] pb-8 md:px-2">
        <Link href="/tutors" className="card card-press card-head flex h-[96px] items-center gap-4 px-4 text-white no-underline" style={{ ["--hd" as string]: "var(--color-blue)" }}>
          <span className="h-[64px] w-[64px] flex-none overflow-hidden rounded-2xl bg-white/90 shadow-[0_3px_0_rgba(0,0,0,.15)]">
            <TutorPortrait id={ch.id} pose="idle" frame="face" className="h-[64px] w-[64px]" alt="" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="t-h2 block truncate">{user.nickname}</span>
            <span className="t-small opacity-95">
              {t.common.grade(user.grade)} · {ch.name}
            </span>
          </span>
          <ChevronIcon size={20} />
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
            <Ico d="M4 9v6h4l5 4V5L8 9zM16 9a4 4 0 0 1 0 6" c="#f97316" />
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
            <Ico d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 20a2 2 0 0 0 4 0" c="#8b5cf6" />
            {t.settings.notifications}
            <Toggle on={notif} />
          </Row>
        </div>

        <div className="card px-4 py-3.5">
          <div id="grade-l" className="t-h3 mb-3">
            {t.settings.grade}
          </div>
          <div role="radiogroup" aria-labelledby="grade-l" className="grid grid-cols-5 gap-2">
            {[5, 6, 7, 8, 9].map((g) => (
              <button key={g} type="button" role="radio" aria-checked={user?.grade === g} onClick={() => void setGrade(g)} className={`h-12 rounded-2xl text-[18px] font-black transition-transform duration-100 active:translate-y-[3px] ${user?.grade === g ? "bg-blue text-white shadow-[0_3px_0_var(--color-blue-800)] active:shadow-none" : "bg-soft text-ink shadow-[0_3px_0_var(--color-soft2)] active:shadow-none"}`}>
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
          <Row href="/rewards">
            <Ico d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 20h8M10 17h4" c="#b45309" />
            {t.tabs.rewards}
            <ChevronIcon className="ml-auto text-mut" />
          </Row>
          <Row href="/tutors">
            <Ico d="M12 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" c="#127a37" />
            {t.settings.changeTutor}
            <ChevronIcon className="ml-auto text-mut" />
          </Row>
          <Row href="/diagnostic">
            <Ico d="M9 11l3 3 8-8M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9" />
            Qayta tekshiruv (diagnostika)
            <ChevronIcon className="ml-auto text-mut" />
          </Row>
          <Row href="/maxfiylik">
            <Ico d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" c="#5b6385" />
            {t.privacy.title}
            <ChevronIcon className="ml-auto text-mut" />
          </Row>
          <Row href="/">
            <Ico d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 11v6M12 7h.01" c="#5b6385" />
            {t.settings.about}
            <ChevronIcon className="ml-auto text-mut" />
          </Row>
        </div>

        <button type="button" className="btn btn-danger w-full" onClick={() => void reset()}>
          {t.profile.reset}
        </button>
      </div>
    </AppShell>
  );
}
