"use client";
// Typed board (inclusive mode, docs/INCLUSIVE.md): with <html data-typed-board> (dyslexia / low-vision
// profiles, set by A11yRoot) the board's WRITING is shown as clear typed Lexend text instead of
// handwriting. Shapes, fraction bars, highlights, wipes, timing and the stroke cache are unchanged:
// Board.tsx still computes the strokes (the chalk tip and the tutor's arm follow them), it only swaps
// what a write/latex element paints. Off = Board renders exactly as before.
import { useSyncExternalStore } from "react";
import type { BoardEl } from "@/lib/board/model";
import { FONT_PX, LINE_GAP } from "@/lib/board/model";

const ATTR = "data-typed-board";
const subs = new Set<() => void>();
let observer: MutationObserver | null = null;

function subscribe(cb: () => void) {
  subs.add(cb);
  if (!observer && typeof document !== "undefined") {
    observer = new MutationObserver(() => subs.forEach((f) => f()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: [ATTR] });
  }
  return () => {
    subs.delete(cb);
  };
}
const isTyped = () => typeof document !== "undefined" && document.documentElement.hasAttribute(ATTR);

/** true while the typed-board option is on (live: toggling it re-renders only board elements) */
export const useTypedBoard = () => useSyncExternalStore(subscribe, isTyped, () => false);

/** elements that are writing (the rest — shapes, bars, plots — stay as chalk strokes) */
export const isTypedOp = (el: BoardEl) => el.cmd.op === "write" || el.cmd.op === "latex";

/** latex → plain readable math ("\frac{1}{2} \cdot 3" → "1/2 · 3") */
export function plainMath(tex: string): string {
  return tex
    .replace(/\\frac\{([^}]*)\}\{([^}]*)\}/g, "$1/$2")
    .replace(/\\sqrt\{([^}]*)\}/g, "√$1")
    .replace(/\\(cdot|times)/g, "·")
    .replace(/\\pi/g, "π")
    .replace(/\^\{?2\}?/g, "²")
    .replace(/\^\{?3\}?/g, "³")
    .replace(/[{}\\]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Lexend: cap height ≈ 0.70 em, average advance ≈ 0.56 em (Latin text + digits)
const CAP_EM = 0.7;
const ADVANCE_EM = 0.56;

/**
 * One write/latex element as typed text, at the handwriting's position: same top-left, the same cap
 * height (capOf = 0.8 × size) and baseline (top + 0.82 × size). If the typed line would be wider
 * than the handwriting it replaces (`inkW`), it is fitted to that width, so it never overlaps
 * anything the board layout placed next to it. While being written (p < 1) it fades in.
 */
export function TypedText({ el, color, p, inkW }: { el: BoardEl; color: string; p: number; inkW: number }) {
  const c = el.cmd as { op: string; x: number; y: number; size?: "s" | "m" | "l"; text?: string; tex?: string };
  const fs = FONT_PX[c.size ?? "m"];
  const fontSize = (fs * 0.8) / CAP_EM;
  const lines = c.op === "latex" ? [plainMath(c.tex ?? "")] : (c.text ?? "").split("\n");
  return (
    <g aria-hidden opacity={p >= 1 ? 1 : Math.min(1, Math.max(0, p * 2.5))}>
      {lines.map((line, i) => {
        const natural = line.length * fontSize * ADVANCE_EM;
        const fit = inkW > 0 && natural > inkW && lines.length === 1;
        return (
          <text
            key={i}
            x={c.x}
            y={c.y + i * fs * LINE_GAP + fs * 0.82}
            fill={color}
            fontFamily="Lexend, Verdana, system-ui, sans-serif"
            fontWeight={500}
            fontSize={fontSize}
            textLength={fit ? inkW : undefined}
            lengthAdjust={fit ? "spacingAndGlyphs" : undefined}
            data-typed=""
          >
            {line}
          </text>
        );
      })}
    </g>
  );
}
