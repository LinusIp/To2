"use client";
// "Sizga qanday qulay?" — offered once right after onboarding (and reachable any time from Sozlamalar).
// ?next=/diagnostic|/home = where the learner goes on.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { t } from "@/i18n/uz";
import { useA11y } from "@/lib/a11y/settings";
import { OptionList, PresetCards } from "@/components/a11y/QulaylikPanel";
import { ArrowIcon } from "@/components/ui/icons";

const SAFE_NEXT = new Set(["/diagnostic", "/home", "/settings"]);

export default function QulaylikPage() {
  const router = useRouter();
  const [next, setNext] = useState("/home");
  const [more, setMore] = useState(false);
  const any = useA11y((s) => s.presets.length > 0);
  useEffect(() => {
    useA11y.getState().hydrate();
    const n = new URLSearchParams(window.location.search).get("next") ?? "/home";
    setNext(SAFE_NEXT.has(n) ? n : "/home");
  }, []);
  const go = () => {
    useA11y.getState().set({ asked: true });
    router.push(next);
  };
  return (
    <main className="mx-auto flex min-h-dvh max-w-[720px] flex-col gap-4 bg-ph px-[18px] pt-6 pb-8">
      <div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-blue px-3 py-1 text-[13px] font-black text-white">{t.a11y.badge}</span>
        <h1 className="mt-3 mb-1 text-[28px] leading-tight font-black">{t.a11y.ask}</h1>
        <p className="m-0 text-[15px] leading-snug font-bold text-[#4a5275]">{t.a11y.askSub}</p>
      </div>
      <PresetCards />
      {more ? (
        <OptionList />
      ) : (
        <button type="button" className="btn w-full" onClick={() => setMore(true)}>
          {t.a11y.options}
        </button>
      )}
      <div className="mt-auto pt-2">
        <button type="button" className="btn btn-primary w-full" onClick={go} data-testid="a11y-continue">
          {any ? t.a11y.done : t.a11y.allGood} <ArrowIcon />
        </button>
      </div>
    </main>
  );
}
