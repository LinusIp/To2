"use client";
// Celebratory micro-animation: a burst of coloured blocks from the centre of its parent (position: relative).
// Fires whenever `fire` changes to a truthy value. Hidden under prefers-reduced-motion (CSS).
import { useEffect, useState } from "react";

const COLORS = ["#ffc42e", "#2563eb", "#22c55e", "#f97316", "#8b5cf6", "#ef4444"];

export function Burst({ fire, count = 12 }: { fire: number; count?: number }) {
  const [key, setKey] = useState(0);
  useEffect(() => {
    if (!fire) return;
    setKey(fire);
    const t = setTimeout(() => setKey(0), 750);
    return () => clearTimeout(t);
  }, [fire]);
  if (!key) return null;
  return (
    <span key={key} aria-hidden className="pointer-events-none absolute inset-0 overflow-visible">
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          className="burst-dot"
          style={{ background: COLORS[i % COLORS.length], ["--a" as string]: `${(360 / count) * i}deg`, ["--d" as string]: `${-50 - (i % 3) * 14}px` }}
        />
      ))}
    </span>
  );
}
