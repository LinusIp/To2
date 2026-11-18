"use client";
// Progress bar that fills from 0 on mount (glossy game-HUD look). Transition is off under reduced motion (CSS).
import { useEffect, useState } from "react";

export function Progress({ value, max = 100, color, className = "", label, height = 12 }: { value: number; max?: number; color?: string; className?: string; label?: string; height?: number }) {
  const pct = Math.max(0, Math.min(100, (value / Math.max(1, max)) * 100));
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(pct));
    return () => cancelAnimationFrame(id);
  }, [pct]);
  return (
    <div className={`bar ${className}`} style={{ height }} role="progressbar" aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} aria-label={label}>
      <b style={{ width: `${shown}%`, background: color, minWidth: shown > 0 ? height : 0 }} />
    </div>
  );
}
