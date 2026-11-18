"use client";
// "Qulaylik": the 4 big presets + every option on its own. Used in Sozlamalar and on /qulaylik
// (the "Sizga qanday qulay?" step after onboarding).
import { t } from "@/i18n/uz";
import { RATE_MAX, RATE_MIN, clampRate, useA11y, type A11ySettings, type PresetId } from "@/lib/a11y/settings";

const PRESET_ICONS: Record<PresetId, string> = {
  // eye · ear · hand · leaf (simple line icons, aria-hidden — the title says it)
  vision: "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z",
  hearing: "M6 8.5a6 6 0 0 1 12 0c0 3-2 4-3 5.5s-1 4.5-4 4.5a3 3 0 0 1-3-3M9.5 9a2.5 2.5 0 0 1 5 0",
  motor: "M8 13V5.5a1.5 1.5 0 0 1 3 0V12M11 11.5v-2a1.5 1.5 0 0 1 3 0V12M14 10.5a1.5 1.5 0 0 1 3 0V15a6 6 0 0 1-6 6h-1a6 6 0 0 1-5-2.7L3 15a1.6 1.6 0 0 1 2.6-1.8L8 15",
  focus: "M5 19c0-8 5-14 14-14 0 9-6 14-14 14zM5 19l7-7",
};
const COLORS: Record<PresetId, string> = { vision: "#2a5ce8", hearing: "#15803d", motor: "#c2410c", focus: "#6d3fe0" };
const ORDER: PresetId[] = ["vision", "hearing", "motor", "focus"];

function Switch({ k, label }: { k: keyof A11ySettings; label: string }) {
  const on = useA11y((s) => !!s[k]);
  const set = useA11y((s) => s.set);
  return (
    <button type="button" role="switch" aria-checked={on} onClick={() => set({ [k]: !on } as Partial<A11ySettings>)} className="flex min-h-14 w-full cursor-pointer items-center gap-3 border-0 bg-transparent px-4 text-left font-[inherit] text-[16px] font-extrabold text-ink [&+&]:border-t [&+&]:border-line">
      <span className="flex-1">{label}</span>
      <span className={`relative h-[30px] w-[50px] flex-none rounded-full transition-colors ${on ? "bg-blue" : "bg-[#8d96b5]"}`} aria-hidden>
        <span className="absolute top-[3px] h-6 w-6 rounded-full bg-white shadow-[0_2px_4px_rgba(0,0,0,.2)] transition-all" style={{ left: on ? 23 : 3 }} />
      </span>
    </button>
  );
}

export function PresetCards() {
  const presets = useA11y((s) => s.presets);
  const toggle = useA11y((s) => s.toggle);
  return (
    <div className="grid gap-3 sm:grid-cols-2" role="group" aria-label={t.a11y.ask}>
      {ORDER.map((id) => {
        const on = presets.includes(id);
        const p = t.a11y.presets[id];
        return (
          <button
            key={id}
            type="button"
            aria-pressed={on}
            onClick={() => toggle(id)}
            data-testid={`preset-${id}`}
            className={`card flex min-h-[112px] cursor-pointer items-start gap-3.5 border-[3px] p-4 text-left font-[inherit] ${on ? "border-blue bg-soft" : "border-transparent"}`}
          >
            <span className="grid h-14 w-14 flex-none place-items-center rounded-2xl text-white" style={{ background: COLORS[id] }} aria-hidden>
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d={PRESET_ICONS[id]} />
              </svg>
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[18px] leading-tight font-black text-ink">{p.title}</span>
              <span className="mt-1 block text-[14px] leading-snug font-bold text-[#4a5275]">{p.body}</span>
            </span>
            <span className={`mt-1 grid h-7 w-7 flex-none place-items-center rounded-full border-2 ${on ? "border-blue bg-blue text-white" : "border-[#8d96b5]"}`} aria-hidden>
              {on && (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5">
                  <path d="M5 12l5 5 9-10" />
                </svg>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function OptionList() {
  const rate = useA11y((s) => s.speechRate);
  const scale = useA11y((s) => s.textScale);
  const set = useA11y((s) => s.set);
  return (
    <>
      <h2 className="m-0 mt-2 text-[18px] font-black">{t.a11y.options}</h2>
      <div className="card overflow-hidden">
        <Switch k="voiceFirst" label={t.a11y.voiceFirst} />
        <Switch k="highContrast" label={t.a11y.highContrast} />
        <Switch k="bigCaptions" label={t.a11y.bigCaptions} />
        <Switch k="vibrate" label={t.a11y.vibrate} />
        <Switch k="handsFree" label={t.a11y.handsFree} />
        <Switch k="bigTargets" label={t.a11y.bigTargets} />
        <Switch k="calm" label={t.a11y.calm} />
        <Switch k="dyslexiaFont" label={t.a11y.dyslexiaFont} />
      </div>
      <div className="card px-4 py-3.5">
        <div id="a11y-scale" className="mb-2.5 text-[16px] font-extrabold">
          {t.a11y.textScale}
        </div>
        <div role="radiogroup" aria-labelledby="a11y-scale" className="grid grid-cols-3 gap-2">
          {([1, 1.25, 1.5] as const).map((v) => (
            <button key={v} type="button" role="radio" aria-checked={scale === v} onClick={() => set({ textScale: v })} className={`h-12 rounded-xl text-[17px] font-black ${scale === v ? "bg-blue text-white" : "bg-soft text-ink"}`}>
              {t.a11y.scale(v)}
            </button>
          ))}
        </div>
      </div>
      <div className="card px-4 py-3.5">
        <label htmlFor="a11y-rate" className="mb-2 flex items-center justify-between text-[16px] font-extrabold">
          {t.a11y.speechRate} <span className="text-blue">{rate.toFixed(2)}×</span>
        </label>
        <input
          id="a11y-rate"
          type="range"
          min={RATE_MIN}
          max={RATE_MAX}
          step={0.05}
          value={rate}
          aria-valuetext={`${rate.toFixed(2)} marta`}
          onChange={(e) => set({ speechRate: clampRate(Number(e.target.value)) })}
          className="h-11 w-full accent-[#2f6bff]"
        />
      </div>
      <div className="card px-4 py-3.5 text-[14px] leading-snug font-bold text-[#4a5275]">
        <div className="mb-1 text-[16px] font-black text-ink">{t.a11y.commandsTitle}</div>
        {t.a11y.commands}
        <p className="mt-2 mb-0">{t.a11y.osNote}</p>
      </div>
    </>
  );
}
