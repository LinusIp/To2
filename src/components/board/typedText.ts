// Pure helpers of the typed board (inclusive mode): the <html data-typed-board> switch, which
// elements are typed, and latex → plain math. Kept JSX-free so vitest (node) can test them.
import { useSyncExternalStore } from "react";
import type { BoardEl } from "@/lib/board/model";

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
