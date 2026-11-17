// Game-HUD bits: XP bar, level chip, streak flame, step pips. Pure presentational.
import { t } from "@/i18n/uz";

export function Flame({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="#e2551b" stroke="#1b1a17" strokeWidth="2" strokeLinejoin="round" aria-hidden>
      <path d="M12 3c1 4 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 1-9z" />
    </svg>
  );
}

export function StreakChip({ days, long = false }: { days: number; long?: boolean }) {
  return (
    <div
      className="flex h-9 items-center gap-1 rounded-[10px] border-[3px] border-ink bg-gold px-2.5 font-pixel text-[16px] font-bold"
      title={t.profile.streakDays(days)}
      aria-label={t.profile.streakDays(days)}
    >
      <Flame />
      {days}
      {long ? ` ${t.common.days}` : ""}
    </div>
  );
}

export function XpChip({ xp }: { xp: number }) {
  return <div className="flex h-9 items-center rounded-[10px] border-[3px] border-ink bg-grass px-2.5 font-pixel text-[15px] font-bold">{xp} XP</div>;
}

export function LevelChip({ level }: { level: number }) {
  return (
    <div className="rounded-lg border-[3px] border-ink bg-grass px-2 py-0.5 font-pixel text-[13px] font-bold whitespace-nowrap">
      {t.common.level} {level}
    </div>
  );
}

export function XpBar({ value, max, className = "" }: { value: number; max: number; className?: string }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div
      className={`flex h-4 overflow-hidden rounded-md border-[3px] border-ink bg-white ${className}`}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-label="XP"
    >
      <div
        style={{ width: `${pct}%`, background: "repeating-linear-gradient(90deg, #3fae49 0 14px, #2f8f3a 14px 16px)", transition: "width 600ms ease" }}
      />
    </div>
  );
}

export function LevelRow({ level, xpInLevel, xpPerLevel }: { level: number; xpInLevel: number; xpPerLevel: number }) {
  return (
    <div className="flex items-center gap-2">
      <LevelChip level={level} />
      <XpBar value={xpInLevel} max={xpPerLevel} className="min-w-16 flex-1" />
      <div className="font-pixel text-[13px] font-medium whitespace-nowrap">
        {xpInLevel}/{xpPerLevel} XP
      </div>
    </div>
  );
}

export function StepPips({ i, n }: { i: number; n: number }) {
  const shown = Math.min(n, 12);
  return (
    <div role="img" aria-label={t.common.step(i, n)} className="flex items-center gap-1">
      {Array.from({ length: shown }, (_, k) => (
        <div
          key={k}
          className="h-2.5 border-[3px] border-ink"
          style={{ width: shown > 8 ? 16 : 28, background: k < i - 1 ? "#3fae49" : k === i - 1 ? "#ffc83d" : "#fff" }}
        />
      ))}
      <span className="ml-1.5 text-[13px] font-extrabold whitespace-nowrap">{t.common.step(i, n)}</span>
    </div>
  );
}

export function Wave({ color = "#f28c28", h = 14 }: { color?: string; h?: number }) {
  return (
    <div aria-label={t.lesson.speaking} role="img" className="flex items-end gap-0.5" style={{ height: h }}>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="wv" style={{ width: 3, height: h, background: color }} />
      ))}
    </div>
  );
}
