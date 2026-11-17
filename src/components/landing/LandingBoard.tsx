"use client";
// The finished fractions lesson board, drawn in on load — a live preview of the tutor's chalk.
import { lazy, Suspense, useEffect, useState } from "react";
import { DEMO_LESSONS } from "@/lib/ai/mock/lessons";
import { applyCommand, emptyBoard, isDraw, type BoardState } from "@/lib/board/model";

const Board = lazy(() => import("@/components/board/Board"));
const CMDS = DEMO_LESSONS["frac-add-unlike"].segments.flatMap((s) => s.board).filter(isDraw);
const STEP_MS = 420;

export default function LandingBoard() {
  const [state, setState] = useState<BoardState>(emptyBoard());
  const [active, setActive] = useState<{ key: string; p: number } | null>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setState(CMDS.reduce((s, c) => applyCommand(s, c), emptyBoard()));
      return;
    }
    let k = 0;
    let s = applyCommand(emptyBoard(), CMDS[0]);
    let t0 = performance.now();
    setState(s);
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / STEP_MS);
      setActive({ key: `main:${CMDS[k].id}`, p });
      if (p >= 1) {
        k++;
        if (k >= CMDS.length) {
          setActive(null);
          return;
        }
        s = applyCommand(s, CMDS[k]);
        setState(s);
        t0 = now;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <Suspense fallback={null}>
      <Board state={state} active={active} label="Doska: kasrlarni qo'shish namunasi" />
    </Suspense>
  );
}
