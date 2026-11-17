import Link from "next/link";
import { t } from "@/i18n/uz";
import { brand } from "@/config/brand";
import { CHARACTERS } from "@/config/characters";
import TutorPortrait from "@/components/characters/TutorPortrait";
import SplashCta from "@/components/landing/SplashCta";
import LandingBoard from "@/components/landing/LandingBoard";

const PILLAR_COLORS = ["#2f6bff", "#22b45a", "#ff8a1f", "#8a5cf6"];

export default function Landing() {
  return (
    <main className="bg-ph">
      {/* 1 · splash */}
      <section className="relative flex min-h-dvh flex-col items-center overflow-hidden text-white" style={{ background: "linear-gradient(170deg,#3f80ff 0%,#2a5fe8 55%,#1f4fd0 100%)" }}>
        <div aria-hidden className="pointer-events-none absolute inset-0 font-black text-white/90">
          <span className="absolute left-[7%] top-[36%] text-[52px]">+</span>
          <span className="absolute right-[10%] top-[30%] text-[44px]">÷</span>
          <span className="absolute right-[8%] top-[49%] font-serif text-[56px]">π</span>
          <span className="absolute right-[18%] top-[56%] text-[40px]">÷</span>
          <span className="absolute left-[15%] top-[13%] h-[26px] w-[26px] rotate-45 bg-white/20" />
          <span className="absolute left-[12%] top-[62%] text-[36px]">x²</span>
        </div>
        <div className="relative z-10 flex w-full max-w-[1100px] flex-1 flex-col items-center px-6 md:flex-row md:items-center md:justify-between md:gap-10">
          <div className="mt-[11vh] text-center md:mt-0 md:text-left">
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
          <TutorPortrait id="blokbek" pose="wave" frame="full" alt="Blokbek qo'l silkitmoqda" className="mt-2 h-[min(44dvh,420px)] w-auto md:h-[560px]" />
        </div>
        <div className="relative z-10 w-full max-w-[420px] px-6 pb-10 md:hidden">
          <SplashCta />
        </div>
      </section>

      {/* 2 · what it does (task #3 in its own words) */}
      <section className="mx-auto max-w-[1100px] px-5 py-12">
        <div className="mb-2 text-[13px] font-extrabold text-blue">{t.landing.kicker}</div>
        <h2 className="m-0 mb-6 text-[30px] leading-tight font-black md:text-[38px]">{t.landing.title}</h2>
        <div className="grid gap-4 md:grid-cols-[1.1fr_1fr] md:items-center">
          <div className="grid gap-3 sm:grid-cols-2">
            {t.landing.pillars.map((p, i) => (
              <div key={p.title} className="card p-4">
                <div className="mb-2 grid h-10 w-10 place-items-center rounded-xl text-[18px] font-black text-white" style={{ background: PILLAR_COLORS[i] }}>
                  {i + 1}
                </div>
                <h3 className="m-0 text-[18px] font-black">{p.title}</h3>
                <p className="mt-1 mb-0 text-[14px] leading-[1.45] font-bold text-mut">{p.body}</p>
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
          <h2 className="m-0 mb-5 text-[28px] font-black">{t.landing.charactersTitle}</h2>
          <div className="no-scrollbar -mx-5 flex gap-3 overflow-x-auto px-5 pb-2">
            {CHARACTERS.filter((c) => c.unlock !== "streak").map((c) => (
              <div key={c.id} className="card relative flex h-[210px] w-[160px] flex-none flex-col items-center justify-end overflow-hidden">
                <TutorPortrait id={c.id} pose="idle" frame="half" className="absolute top-0 left-1/2 h-[160px] w-[160px] -translate-x-1/2" />
                <div className="relative w-full px-2 pt-6 pb-3 text-center" style={{ background: "linear-gradient(to top,#fff 62%,rgba(255,255,255,0))" }}>
                  <b className="block text-[16px] font-black">{c.name}</b>
                  <span className="text-[12px] font-bold text-mut">{c.tag}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 4 · parents & schools */}
      <section className="mx-auto max-w-[1100px] px-5 py-12">
        <h2 className="m-0 mb-5 text-[28px] font-black">{t.landing.forWhoTitle}</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {t.landing.forWho.map((f, i) => (
            <div key={f.title} className="card p-5">
              <h3 className="m-0 text-[20px] font-black">{f.title}</h3>
              <p className="mt-1.5 mb-3 text-[15px] leading-[1.45] font-bold text-mut">{f.body}</p>
              {i === 1 && (
                <Link href="/teacher" className="font-black text-blue">
                  {t.teacher.title} →
                </Link>
              )}
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
