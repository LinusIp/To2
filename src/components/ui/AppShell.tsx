"use client";
// App chrome: bottom tabs on phones (Bosh sahifa · Darslar · Progress · Sozlamalar),
// a white sidebar on tablet/desktop with the content in a centred column.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { t } from "@/i18n/uz";
import { useMe } from "@/lib/client/me";
import { BookIcon, ChartIcon, CupIcon, FlameIcon, GearIcon, HomeIcon, Logo, UserIcon } from "./icons";
import TutorPortrait from "@/components/characters/TutorPortrait";

const TABS = [
  { href: "/home", label: t.tabs.home, Icon: HomeIcon, match: ["/home"] },
  { href: "/roadmap", label: t.tabs.lessons, Icon: BookIcon, match: ["/roadmap", "/lesson", "/practice"] },
  { href: "/progress", label: t.tabs.progress, Icon: ChartIcon, match: ["/progress"] },
  { href: "/rewards", label: t.tabs.rewards, Icon: CupIcon, match: ["/rewards"] },
  { href: "/settings", label: t.tabs.profile, Icon: UserIcon, match: ["/settings", "/tutors", "/profile"] },
];

export default function AppShell({ children, wide = false, hideTabs = false }: { children: React.ReactNode; wide?: boolean; hideTabs?: boolean }) {
  const path = usePathname() ?? "";
  const { user, load } = useMe();
  useEffect(() => {
    void load();
  }, [load]);
  const on = (m: string[]) => m.some((p) => path.startsWith(p));

  return (
    <div className="min-h-dvh bg-ph md:flex md:bg-bg">
      <aside className="sticky top-0 hidden h-dvh w-[232px] flex-none flex-col gap-2 bg-white px-4 py-6 shadow-[6px_0_24px_rgba(31,54,120,.05)] md:flex">
        <Link href="/home" className="mb-4 px-2 no-underline" aria-label="To2">
          <Logo size={34} />
        </Link>
        <nav aria-label={t.nav.main} className="flex flex-col gap-1">
          {TABS.map(({ href, label, Icon, match }) => (
            <Link
              key={href}
              href={href}
              aria-current={on(match) ? "page" : undefined}
              className={`flex h-12 items-center gap-3 rounded-xl px-3 text-[15px] font-extrabold no-underline ${on(match) ? "bg-soft text-blue" : "text-[#3a4266] hover:bg-soft"}`}
            >
              <Icon size={22} />
              {label}
            </Link>
          ))}
        </nav>
        {user && (
          <div className="mt-auto flex flex-col gap-3">
            <div className="flex items-center gap-2 rounded-2xl bg-soft px-3 py-2.5 text-[14px] font-extrabold">
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

      <main className={`min-w-0 flex-1 ${hideTabs ? "" : "pb-[96px] md:pb-0"}`}>
        <div className={wide ? "w-full" : "mx-auto w-full max-w-[760px]"}>{children}</div>
      </main>

      {!hideTabs && (
        <nav
          aria-label={t.nav.main}
          className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 bg-white px-1.5 pt-2 shadow-[0_-6px_20px_rgba(31,54,120,.06)] md:hidden"
          style={{ paddingBottom: "max(14px, env(safe-area-inset-bottom))" }}
        >
          {TABS.map(({ href, label, Icon, match }) => (
            <Link
              key={href}
              href={href}
              aria-current={on(match) ? "page" : undefined}
              className={`flex h-[62px] flex-col items-center justify-center gap-1 text-[12px] font-extrabold no-underline ${on(match) ? "text-blue" : "text-[#8a92b0]"}`}
            >
              <Icon size={24} />
              {label}
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
}

/** Screen header used on inner pages: back button · title · right slot. */
export function ScreenTop({ title, back = "/home", right }: { title: string; back?: string | null; right?: React.ReactNode }) {
  return (
    <div className="flex h-[52px] items-center justify-between px-4 pt-3 md:px-2 md:pt-6">
      {back ? (
        <Link href={back} aria-label={t.nav.back} title={t.nav.back} className="icon-btn">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </Link>
      ) : (
        <div className="w-11" />
      )}
      <h1 className="m-0 text-[22px] font-black">{title}</h1>
      <div className="flex min-w-11 justify-end">{right}</div>
    </div>
  );
}
