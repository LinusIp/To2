"use client";
// Block-particle confetti burst, re-triggered whenever `burst` changes.
import { useEffect, useState } from "react";

const COLORS = ["#3fae49", "#ffc83d", "#f28c28", "#7cc7ff", "#ff9bb0", "#ffffff"];

export default function Confetti({ burst }: { burst: number }) {
  const [pieces, setPieces] = useState<{ id: number; dx: number; dy: number; rot: number; c: string; s: number }[]>([]);
  useEffect(() => {
    if (!burst) return;
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const ps = Array.from({ length: 22 }, (_, i) => ({
      id: burst * 100 + i,
      dx: (Math.random() - 0.5) * 260,
      dy: -60 - Math.random() * 160,
      rot: (Math.random() - 0.5) * 540,
      c: COLORS[i % COLORS.length],
      s: 8 + Math.floor(Math.random() * 3) * 4,
    }));
    setPieces(ps);
    const tm = setTimeout(() => setPieces([]), 1100);
    return () => clearTimeout(tm);
  }, [burst]);
  if (!pieces.length) return null;
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-20 overflow-visible">
      {pieces.map((p) => (
        <span
          key={p.id}
          style={
            {
              position: "absolute",
              left: "50%",
              top: "40%",
              width: p.s,
              height: p.s,
              background: p.c,
              border: "2px solid #1b1a17",
              animation: "confetti-fall 1s ease-out forwards",
              "--dx": `${p.dx}px`,
              "--dy": `${p.dy}px`,
              "--rot": `${p.rot}deg`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
