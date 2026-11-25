"use client";
// App chrome: bottom tabs on phones (Bosh sahifa · Darslar · O'yinlar · Progress · Profil — Mukofotlar lives
// under Profil), a white sidebar on tablet/desktop with the content in a centred column.
// Bottom padding: ONE rule for every page — the tab bar's real height (measured, so safe-area insets and
// Android text zoom are included) + 16 px, exposed as --tabbar-h. Pages add no padding of their own for it.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { t } from "@/i18n/uz";
import { useMe } from "@/lib/client/me";
import { BlocksIcon, BookIcon, ChartIcon, FlameIcon, HomeIcon, Logo, UserIcon } from "./icons";
import TutorPortrait from "@/components/characters/TutorPortrait";
import { Toaster } from "./Toast";
import { brand } from "@/config/brand";

const TABS = [
  { href: "/home", label: t.tabs.home, Icon: HomeIcon, match: ["/home"] },
  { href: "/towns", label: t.tabs.lessons, Icon: BookIcon, match: ["/towns", "/town", "/map", "/roadmap", "/lesson", "/practice"] },
  { href: "/games", label: t.games.tab, Icon: BlocksIcon, match: ["/games"] },
  { href: "/progress", label: t.tabs.progress, Icon: ChartIcon, match: ["/progress"] },
  { href: "/settings", label: t.tabs.profile, Icon: UserIcon, match: ["/settings", "/tutors", "/profile", "/rewards"] },
];

export default function AppShell({ children, wide = false, hideTabs = false }: { children: React.ReactNode; wide?: boolean; hideTabs?: boolean }) {
  const path = usePathname() ?? "";
  const { user, load } = useMe();
  useEffect(() => {
    void load();
  }, [load]);
  const on = (m: string[]) => m.some((p) => path.startsWith(p));
  const bar = useRef<HTMLElement>(null);
  // publish the tab bar's real height (incl. safe area / text zoom) as --tabbar-h for the shared padding
  useEffect(() => {
    const el = bar.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const root = document.documentElement;
    const set = () => root.style.setProperty("--tabbar-h", `${Math.ceil(el.getBoundingClientRect().height)}px`);
    set();
    const ro = new ResizeObserver(set);
    ro.observe(el, { box: "border-box" });
    return () => {
      ro.disconnect();
      root.style.removeProperty("--tabbar-h");
    };
  }, [hideTabs]);

  return (
    <div className="min-h-dvh bg-ph md:flex md:bg-bg">
      <aside className="sticky top-0 hidden h-dvh w-[232px] flex-none flex-col gap-2 bg-white px-4 py-6 shadow-[6px_0_24px_rgba(31,54,120,.05)] md:flex">
        <Link href="/home" className="mb-4 px-2 no-underline" aria-label={brand.name}>
          <Logo size={34} />
        </Link>
        <nav aria-label={t.nav.main} className="flex flex-col gap-1">
          {TABS.map(({ href, label, Icon, match }) => (
            <Link
              key={href}
              href={href}
              aria-current={on(match) ? "page" : undefined}
              className={`relative flex h-12 items-center gap-3 rounded-2xl px-3 text-[15px] font-extrabold no-underline transition-colors duration-150 ${on(match) ? "bg-blue-50 text-blue-700 shadow-[inset_0_0_0_2px_var(--color-blue-100)]" : "text-[#3a4266] hover:bg-soft"}`}
            >
              <Icon size={22} />
              {label}
            </Link>
          ))}
        </nav>
        {user && (
          <div className="mt-auto flex flex-col gap-3">
            <div className="flex items-center gap-2 rounded-2xl bg-[#fff4dc] px-3 py-2.5 text-[14px] font-extrabold text-[#8a5300] shadow-[0_3px_0_#f7dfa8]">
              <FlameIcon size={20} /> {t.profile.streakDays(user.streak)}
            </div>
            <Link href="/settings" className="flex items-center gap-3 rounded-2xl px-2 py-2 no-underline hover:bg-soft">
              <span className="h-11 w-11 flex-none overflow-hidden rounded-full bg-soft2">
                <TutorPortrait id={user.characterId} pose="idle" frame="face" className="h-11 w-11" alt="" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[15px] font-black">{user.nickname}</span>
                <span className="block text-[12px] font-bold text-mut">{t.common.grade(user.grade)}</span>
              </span>
            </Link>
          </div>
        )}
      </aside>

      <main className={`min-w-0 flex-1 ${hideTabs ? "" : "pb-tabbar md:pb-0"}`}>
        <div key={path} className={`page-in ${wide ? "w-full" : "mx-auto w-full max-w-[760px]"}`}>
          {children}
        </div>
      </main>

      {!hideTabs && (
        <nav
          ref={bar}
          aria-label={t.nav.main}
          className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 rounded-t-[24px] bg-white px-1 pt-2 shadow-[0_-2px_0_rgba(31,54,120,.04),0_-8px_24px_rgba(31,54,120,.08)] md:hidden"
          style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}
        >
          {TABS.map(({ href, label, Icon, match }) => (
            <Link
              key={href}
              href={href}
              aria-current={on(match) ? "page" : undefined}
              className={`group flex h-[62px] min-w-0 flex-col items-center justify-center gap-1 text-[12px] leading-tight font-extrabold whitespace-nowrap no-underline ${on(match) ? "text-blue-700" : "text-[#5f6788]"}`}
            >
              <span className={`grid h-8 w-12 max-w-full flex-none place-items-center rounded-full transition-[background,transform] duration-200 group-active:scale-90 ${on(match) ? "bg-blue-50" : ""}`}>
                <Icon size={24} />
              </span>
              {label}
            </Link>
          ))}
        </nav>
      )}
      <Toaster />
    </div>
  );
}

/** Screen header used on inner pages: back button · title · right slot. */
export function ScreenTop({ title, back = "/home", right }: { title: string; back?: string | null; right?: React.ReactNode }) {
  return (
    <div className="flex min-h-[52px] items-center justify-between gap-2 px-4 pt-3 md:px-2 md:pt-6">
      {back ? (
        <Link href={back} aria-label={t.nav.back} title={t.nav.back} className="icon-btn">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </Link>
      ) : (
        <div className="w-11" />
      )}
      <h1 className="t-h2 m-0 min-w-0 text-center leading-tight">{title}</h1>
      <div className="flex min-w-11 justify-end">{right}</div>
    </div>
  );
}
