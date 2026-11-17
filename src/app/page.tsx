import Link from "next/link";
import { t } from "@/i18n/uz";
import { brand } from "@/config/brand";
import { CHARACTERS } from "@/config/characters";
import Character from "@/components/characters/Character";
import LandingCta from "@/components/landing/LandingCta";
import LandingBoard from "@/components/landing/LandingBoard";

function Skyline() {
  // Blocky Samarkand-style domes + grass blocks (original pixel art).
  return (
    <svg viewBox="0 0 1200 160" preserveAspectRatio="xMidYMax slice" className="absolute inset-x-0 bottom-0 h-[160px] w-full" shapeRendering="crispEdges" aria-hidden>
      <g fill="#7cc7ff" opacity="0.55">
        <rect x="80" y="70" width="90" height="60" />
        <rect x="95" y="40" width="60" height="30" />
        <rect x="110" y="24" width="30" height="16" />
        <rect x="900" y="60" width="120" height="70" />
        <rect x="920" y="30" width="80" height="30" />
        <rect x="945" y="14" width="30" height="16" />
        <rect x="860" y="20" width="18" height="110" />
        <rect x="1040" y="20" width="18" height="110" />
      </g>
      <rect x="0" y="128" width="1200" height="32" fill="#3fae49" />
      <rect x="0" y="128" width="1200" height="6" fill="#2f8f3a" />
      {Array.from({ length: 30 }, (_, i) => (
        <rect key={i} x={i * 40 + (i % 2) * 12} y={142 + (i % 3) * 5} width="8" height="8" fill="#7a5230" />
      ))}
    </svg>
  );
}

export default function Landing() {
  return (
    <main className="bg-paper">
      <header className="relative overflow-hidden border-b-[3px] border-ink bg-sky">
        <nav className="relative z-10 mx-auto flex max-w-[1200px] items-center justify-between px-4 py-4 md:px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border-[3px] border-ink bg-grass font-pixel text-[17px] font-bold shadow-[3px_3px_0_#1b1a17]">{brand.shortName}</div>
            <span className="font-pixel text-[22px] font-bold">{brand.name}</span>
          </div>
          <Link href="/teacher" className="text-[14px] font-extrabold">
            {t.teacher.title}
          </Link>
        </nav>
        <div className="relative z-10 mx-auto grid max-w-[1200px] items-center gap-6 px-4 pt-4 pb-[150px] md:grid-cols-[1.1fr_1fr] md:px-6 md:pb-[170px]">
          <div>
            <div className="mb-3 inline-block rounded-lg border-[3px] border-ink bg-white px-2.5 py-1 text-[12px] font-extrabold">{t.landing.kicker}</div>
            <h1 className="m-0 font-pixel text-[34px] leading-[1.05] font-bold md:text-[52px]">{t.landing.title}</h1>
            <p className="mt-3 mb-5 max-w-[560px] text-[16px] leading-[1.45] font-bold md:text-[18px]">{t.landing.subtitle}</p>
            <LandingCta />
          </div>
          <div className="rounded-[16px] border-[3px] border-ink bg-wood p-[9px] shadow-[5px_5px_0_#1b1a17]">
            <div className="aspect-[1000/625] overflow-hidden rounded-lg bg-chalkboard">
              <LandingBoard />
            </div>
          </div>
        </div>
        <div className="absolute bottom-[26px] left-1/2 z-10 flex -translate-x-1/2 items-end gap-3 md:gap-8">
          {CHARACTERS.map((c, i) => (
            <Character key={c.id} id={c.id} size={i === 0 ? 84 : 66} state={i === 0 ? "happy" : "idle"} />
          ))}
        </div>
        <Skyline />
      </header>

      <section className="mx-auto max-w-[1200px] px-4 py-10 md:px-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {t.landing.pillars.map((p, i) => (
            <div key={p.title} className="rounded-2xl border-[3px] border-ink bg-white p-4">
              <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg border-[3px] border-ink font-pixel text-[18px] font-bold" style={{ background: ["#ffc83d", "#7cc7ff", "#3fae49", "#f28c28"][i] }}>
                {i + 1}
              </div>
              <h2 className="m-0 font-pixel text-[20px] font-bold">{p.title}</h2>
              <p className="mt-1.5 mb-0 text-[14px] leading-[1.45] font-bold text-muted">{p.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-y-[3px] border-ink bg-white">
        <div className="mx-auto max-w-[1200px] px-4 py-10 md:px-6">
          <h2 className="m-0 mb-5 font-pixel text-[28px] font-bold">{t.landing.charactersTitle}</h2>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {CHARACTERS.map((c) => (
              <div key={c.id} className="flex flex-col items-center gap-2 rounded-2xl border-[3px] border-ink p-4 text-center" style={{ background: c.world }}>
                <Character id={c.id} size={90} state="idle" />
                <div className="font-pixel text-[20px] font-bold">{c.name}</div>
                <div className="text-[13px] font-bold text-muted">{c.vibe}</div>
                <div className="text-[13px] font-extrabold">&ldquo;{c.catchphrases_uz[0]}&rdquo;</div>
                {c.unlockXp > 0 && <div className="rounded-md border-2 border-ink bg-white px-1.5 text-[12px] font-extrabold">{c.unlockXp} XP</div>}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1200px] px-4 py-10 md:px-6">
        <h2 className="m-0 mb-5 font-pixel text-[28px] font-bold">{t.landing.forWhoTitle}</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {t.landing.forWho.map((f) => (
            <div key={f.title} className="rounded-2xl border-[3px] border-ink bg-white p-5">
              <h3 className="m-0 font-pixel text-[20px] font-bold">{f.title}</h3>
              <p className="mt-1.5 mb-0 text-[15px] leading-[1.45] font-bold text-muted">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t-[3px] border-ink bg-ink text-white">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-3 px-4 py-6 text-[14px] font-bold md:px-6">
          <span>
            {brand.name} · {t.landing.footer}
          </span>
          <Link href="/maxfiylik" className="text-white underline">
            {t.landing.privacy}
          </Link>
        </div>
      </footer>
    </main>
  );
}
