// Small HUD pieces in the light design: streak chip, progress bar, step pips, voice wave.
import { t } from "@/i18n/uz";
import { FlameIcon } from "./icons";

export function StreakChip({ days }: { days: number }) {
  return (
    <div className="chip" title={t.profile.streakDays(days)} aria-label={t.profile.streakDays(days)}>
      <FlameIcon />
      {days}
    </div>
  );
}

export function Bar({ value, max = 100, color, className = "", label }: { value: number; max?: number; color?: string; className?: string; label?: string }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className={`bar ${className}`} role="progressbar" aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} aria-label={label}>
      <b style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

export function StepPips({ i, n }: { i: number; n: number }) {
  const shown = Math.min(n, 12);
  return (
    <div role="img" aria-label={t.common.step(i, n)} className="flex items-center gap-1.5">
      {Array.from({ length: shown }, (_, k) => (
        <div key={k} className="h-1.5 rounded-full" style={{ width: shown > 8 ? 18 : 30, background: k < i - 1 ? "#22b45a" : k === i - 1 ? "#2f6bff" : "#dfe6fa" }} />
      ))}
      <span className="ml-1.5 text-[13px] font-extrabold whitespace-nowrap text-mut">{t.common.step(i, n)}</span>
    </div>
  );
}

export function Wave({ color = "#2f6bff", h = 14 }: { color?: string; h?: number }) {
  return (
    <div aria-label={t.lesson.speaking} role="img" className="flex items-end gap-0.5" style={{ height: h }}>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="wv rounded-sm" style={{ width: 3, height: h, background: color }} />
      ))}
    </div>
  );
}
