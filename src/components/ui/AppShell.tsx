"use client";
// Responsive shell: bottom tab bar (<768), side rail (768–1279), sidebar + mini roadmap (≥1280).
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { Map as MapIcon, Presentation, Target, User } from "lucide-react";
import { t } from "@/i18n/uz";
import { brand } from "@/config/brand";
import { useMe } from "@/lib/client/me";
import { Flame } from "./hud";

const TABS = [
  { href: "/roadmap", label: t.nav.roadmap, long: t.nav.roadmapLong, Icon: MapIcon, match: "/roadmap" },
  { href: "/lesson", label: t.nav.lesson, long: t.nav.lesson, Icon: Presentation, match: "/lesson" },
  { href: "/practice", label: t.nav.practice, long: t.nav.practice, Icon: Target, match: "/practice" },
  { href: "/profile", label: t.nav.profile, long: t.nav.profile, Icon: User, match: "/profile" },
];

function MiniRoadmap() {
  const rm = useMe((s) => s.roadmap);
  if (!rm?.currentId) return null;
  const cur = rm.nodes.find((n) => n.id === rm.currentId);
  if (!cur) return null;
  const sec = rm.nodes.filter((n) => n.section === cur.section).slice(0, 6);
  const done = sec.filter((n) => n.status === "mastered").length;
  const sw = (s: string) =>
    s === "mastered" ? "bg-grass border-ink" : s === "current" ? "bg-gold border-ink" : s === "locked" ? "bg-locked border-locked-ink" : "bg-white border-ink";
  return (
    <div className="rounded-[14px] border-[3px] border-ink bg-paper p-3.5">
      <div className="mb-2.5 font-pixel text-[15px] font-bold uppercase">
        {cur.section} · {done}/{sec.length}
      </div>
      <ul className="flex flex-col gap-2 text-[14px] font-extrabold">
        {sec.map((n) => (
          <li key={n.id}>
            <Link href={`/lesson/${n.id}`} className={`flex items-center gap-2 no-underline ${n.status === "locked" || n.status === "optional" ? "text-muted" : ""}`}>
              <span className={`h-4 w-4 flex-none border-[3px] ${sw(n.status)}`} aria-hidden />
              <span className="truncate">{n.title}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function AppShell({ children, hideMobileNav = false }: { children: React.ReactNode; hideMobileNav?: boolean }) {
  const path = usePathname() ?? "";
  const { user, load } = useMe();
  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="min-h-dvh bg-paper md:flex">
      {/* tablet rail / desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh flex-none flex-col gap-4 border-r-[3px] border-ink bg-white px-2 py-4 md:flex md:w-[92px] xl:w-[270px] xl:px-4 xl:py-5">
        <Link href="/" className="flex items-center gap-2.5 no-underline" aria-label={brand.name}>
          <div className="flex h-12 w-12 flex-none items-center justify-center rounded-xl border-[3px] border-ink bg-grass font-pixel text-[19px] font-bold shadow-[3px_3px_0_#1b1a17] max-xl:mx-auto">
            {brand.shortName}
          </div>
          {user && (
            <div className="hidden min-w-0 xl:block">
              <div className="truncate font-pixel text-[18px] font-bold">{user.nickname}</div>
              <div className="text-[13px] font-bold text-muted">
                {t.common.grade(user.grade)} · {t.profile.level} {user.level}
              </div>
            </div>
          )}
        </Link>
        <nav aria-label={t.nav.main} className="flex flex-col gap-1.5">
          {TABS.map(({ href, long, label, Icon, match }) => {
            const on = path.startsWith(match);
            return (
              <Link
                key={href}
                href={href}
                aria-current={on ? "page" : undefined}
                title={long}
                className={`flex min-h-[46px] items-center gap-2.5 rounded-xl px-3 text-[15px] font-extrabold no-underline max-xl:flex-col max-xl:justify-center max-xl:gap-0.5 max-xl:px-1 max-xl:py-1.5 max-xl:text-[12px] ${
                  on ? "border-[3px] border-ink bg-gold" : "border-[3px] border-transparent hover:bg-paper"
                }`}
              >
                <Icon size={22} strokeWidth={2.4} aria-hidden />
                <span className="xl:hidden">{label}</span>
                <span className="hidden xl:inline">{long}</span>
              </Link>
            );
          })}
        </nav>
        <div className="hidden flex-col gap-4 xl:flex">
          <MiniRoadmap />
          {user && (
            <div className="flex items-center gap-2.5 rounded-[14px] border-[3px] border-ink bg-gold px-3.5 py-3 text-[14px] font-extrabold">
              <Flame size={22} />
              {t.streakToday(user.streak)}
            </div>
          )}
        </div>
      </aside>

      <div className={`min-w-0 flex-1 ${hideMobileNav ? "" : "pb-[74px] md:pb-0"}`}>{children}</div>

      {/* mobile bottom tabs */}
      {!hideMobileNav && (
        <nav
          aria-label={t.nav.main}
          className="fixed inset-x-0 bottom-0 z-30 grid h-[66px] grid-cols-4 border-t-[3px] border-ink bg-white md:hidden"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          {TABS.map(({ href, label, Icon, match }) => {
            const on = path.startsWith(match);
            return (
              <Link
                key={href}
                href={href}
                aria-current={on ? "page" : undefined}
                className={`flex flex-col items-center justify-center gap-0.5 text-[12px] font-extrabold no-underline ${on ? "bg-gold text-ink" : "text-muted"}`}
              >
                <Icon size={22} strokeWidth={2.4} aria-hidden />
                {label}
              </Link>
            );
          })}
        </nav>
      )}
    </div>
  );
}
