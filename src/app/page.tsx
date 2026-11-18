import Link from "next/link";
import { t } from "@/i18n/uz";
import { brand } from "@/config/brand";
import { CHARACTERS } from "@/config/characters";
import TutorPortrait from "@/components/characters/TutorPortrait";
import SplashCta from "@/components/landing/SplashCta";
import LandingBoard from "@/components/landing/LandingBoard";

// subject accent tokens (globals.css): math blue · biology green · physics orange · chemistry purple
const PILLAR_COLORS = ["var(--color-subj-math)", "var(--color-subj-biology)", "var(--color-subj-physics)", "var(--color-subj-chemistry)"];

export default function Landing() {
  return (
    <main className="bg-ph">
      {/* 1 · splash */}
      <section className="relative flex min-h-dvh flex-col items-center overflow-hidden text-white" style={{ background: "radial-gradient(120% 70% at 50% 0%, #4f86f7 0%, rgba(79,134,247,0) 60%), linear-gradient(170deg,#2f6ef0 0%,#2358dc 55%,#1d47b8 100%)" }}>
        <div aria-hidden className="pointer-events-none absolute inset-0 font-black text-white/90">
          <span className="absolute left-[7%] top-[36%] text-[52px]">+</span>
          <span className="absolute right-[10%] top-[30%] text-[44px]">÷</span>
          <span className="absolute right-[8%] top-[49%] font-serif text-[56px]">π</span>
          <span className="absolute right-[18%] top-[56%] text-[40px]">÷</span>
          <span className="absolute left-[15%] top-[13%] h-[26px] w-[26px] rotate-45 bg-white/20" />
          <span className="absolute left-[12%] top-[62%] text-[36px]">x²</span>
        </div>
        <div className="relative z-10 flex w-full max-w-[1100px] flex-1 flex-col items-center px-6 md:flex-row md:items-center md:justify-between md:gap-10">
          <div className="stagger mt-[11vh] text-center md:mt-0 md:text-left">
            <div className="text-[96px] leading-none font-black tracking-[-2px] [text-shadow:0_6px_0_rgba(0,0,0,.12)] md:text-[120px]">{brand.name}</div>
            <div className="mt-2.5 text-[20px] leading-[1.3] font-extrabold opacity-95 md:text-[26px]">
              {t.splash.tagline1}
              <br />
              {t.splash.tagline2}
            </div>
            <p className="mx-auto mt-4 hidden max-w-[460px] text-[17px] leading-normal font-bold opacity-90 md:block">{t.landing.subtitle}</p>
            <div className="mt-8 hidden w-[340px] md:block">
              <SplashCta />
            </div>
          </div>
          <div className="relative mt-2">
            <div aria-hidden className="absolute inset-x-[12%] bottom-[2%] h-[14%] rounded-[50%] bg-[#0b2a7a]/35 blur-md" />
            <TutorPortrait id="blokbek" pose="point" frame="full" alt="Blokbek" className="bounce-in relative h-[min(44dvh,420px)] w-auto md:h-[560px]" />
          </div>
        </div>
        <div className="relative z-10 w-full max-w-[420px] px-6 pb-10 md:hidden">
          <SplashCta />
        </div>
      </section>

      {/* 2 · what it does (task #3 in its own words) */}
      <section className="mx-auto max-w-[1100px] px-5 py-12">
        <div className="chip chip-soft mb-3">{t.landing.kicker}</div>
        <h2 className="t-h1 m-0 mb-6 md:text-[38px] md:leading-[44px]">{t.landing.title}</h2>
        <div className="grid gap-4 md:grid-cols-[1.1fr_1fr] md:items-center">
          <div className="stagger grid gap-4 sm:grid-cols-2">
            {t.landing.pillars.map((p, i) => (
              <div key={p.title} className="card card-press p-4">
                <span className="icon-tile mb-3 text-[20px]" style={{ ["--tile" as string]: PILLAR_COLORS[i] }} aria-hidden>
                  {i + 1}
                </span>
                <h3 className="t-h3 m-0">{p.title}</h3>
                <p className="t-small mt-1 mb-0 text-mut">{p.body}</p>
              </div>
            ))}
          </div>
          <div className="overflow-hidden rounded-[22px] border-[10px] border-[#7a4f2c] shadow-[0_12px_30px_rgba(31,54,120,.2)]">
            <div className="aspect-[1000/625] bg-chalkboard">
              <LandingBoard />
            </div>
          </div>
        </div>
      </section>

      {/* 3 · tutors */}
      <section className="bg-bg py-12">
        <div className="mx-auto max-w-[1100px] px-5">
          <h2 className="t-h1 m-0 mb-5">{t.landing.charactersTitle}</h2>
          <div className="no-scrollbar stagger -mx-5 flex gap-4 overflow-x-auto px-5 pt-1 pb-3">
            {CHARACTERS.map((c) => (
              <div key={c.id} className="card card-press relative flex h-[210px] w-[160px] flex-none flex-col items-center justify-end overflow-hidden" style={{ background: "linear-gradient(180deg,#e4ecff 0%,#fff 70%)" }}>
                <TutorPortrait id={c.id} pose="sig" frame="half" alt={c.name} className="absolute top-0 left-1/2 h-[160px] w-[160px] -translate-x-1/2" style={c.status === "soon" ? { opacity: 0.5 } : undefined} />
                <div className="relative w-full px-2 pt-6 pb-3 text-center" style={{ background: "linear-gradient(to top,#fff 62%,rgba(255,255,255,0))" }}>
                  <b className="block text-[16px] font-black">{c.name}</b>
                  <span className="t-caption text-mut">{c.status === "soon" ? t.tutors.soon : c.tag}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 4 · parents & schools */}
      <section className="mx-auto max-w-[1100px] px-5 py-12">
        <h2 className="t-h1 m-0 mb-5">{t.landing.forWhoTitle}</h2>
        <div className="stagger grid gap-4 md:grid-cols-2">
          {t.landing.forWho.map((f, i) => (
            <div key={f.title} className="card overflow-hidden">
              <div className="card-head px-5 py-4" style={{ ["--hd" as string]: i === 0 ? "var(--color-subj-math)" : "var(--color-subj-chemistry)" }}>
                <h3 className="t-h2 m-0">{f.title}</h3>
              </div>
              <div className="px-5 pt-3 pb-5">
                <p className="t-body mt-0 mb-3 text-mut">{f.body}</p>
                {i === 1 && (
                  <Link href="/teacher" className="btn btn-secondary">
                    {t.teacher.title} →
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      <footer className="bg-ink text-white">
        <div className="mx-auto flex max-w-[1100px] flex-wrap items-center justify-between gap-3 px-5 py-6 text-[14px] font-bold">
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
