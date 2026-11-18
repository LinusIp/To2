"use client";
// Number that counts up from 0 (ease-out, ~0.9 s). Instant under prefers-reduced-motion.
import { useEffect, useState } from "react";

export function CountUp({ value, ms = 900, className }: { value: number; ms?: number; className?: string }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches || value === 0) {
      setN(value);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const k = Math.min(1, (now - t0) / ms);
      setN(Math.round(value * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, ms]);
  return (
    <span className={className} aria-label={String(value)}>
      <span aria-hidden>{n}</span>
    </span>
  );
}
