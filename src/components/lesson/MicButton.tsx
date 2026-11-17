"use client";
// Push-to-talk: hold to speak, release to send. A quick tap toggles (tap again to send).
// Space bar works on desktop.
import { useEffect, useRef, useState } from "react";
import { Mic, Square } from "lucide-react";
import { t } from "@/i18n/uz";

export default function MicButton({
  onStart,
  onStop,
  listening,
  disabled,
  variant = "round",
}: {
  onStart: () => Promise<boolean> | void;
  onStop: () => void;
  listening: boolean;
  disabled?: boolean;
  variant?: "round" | "wide";
}) {
  const downAt = useRef(0);
  const [toggled, setToggled] = useState(false);
  const active = useRef(false);

  const start = async () => {
    if (disabled || active.current) return;
    active.current = true;
    downAt.current = performance.now();
    const ok = await onStart();
    if (ok === false) active.current = false;
  };
  const stop = () => {
    if (!active.current) return;
    active.current = false;
    setToggled(false);
    onStop();
  };

  // Space = push-to-talk (not while typing in an input)
  useEffect(() => {
    const isTyping = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
    };
    const down = (e: KeyboardEvent) => {
      if (e.code !== "Space" || e.repeat || isTyping(e)) return;
      e.preventDefault();
      void start();
    };
    const up = (e: KeyboardEvent) => {
      if (e.code !== "Space" || isTyping(e)) return;
      e.preventDefault();
      stop();
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  });

  const handlers = {
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      if (toggled) {
        stop();
        return;
      }
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
      void start();
    },
    onPointerUp: () => {
      if (!active.current) return;
      if (performance.now() - downAt.current < 350) {
        setToggled(true); // quick tap → keep listening until next tap
        return;
      }
      stop();
    },
    onPointerCancel: () => stop(),
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  };

  const label = listening ? t.lesson.listening : variant === "wide" ? t.lesson.micLong : t.lesson.mic;
  const bg = listening ? "#f28c28" : "#ffc83d";

  if (variant === "wide") {
    return (
      <button
        type="button"
        aria-label={label}
        aria-pressed={listening}
        disabled={disabled}
        className="btn btn-primary h-[60px] flex-1 touch-none rounded-2xl text-[18px] select-none"
        style={{ background: bg }}
        {...handlers}
      >
        {listening ? <Square size={24} strokeWidth={2.6} aria-hidden /> : <Mic size={26} strokeWidth={2.4} aria-hidden />}
        {label}
      </button>
    );
  }
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={listening}
      disabled={disabled}
      className="btn btn-primary h-[76px] w-[76px] touch-none rounded-[22px] p-0 select-none"
      style={{ background: bg }}
      {...handlers}
    >
      {listening ? <Square size={30} strokeWidth={2.6} aria-hidden /> : <Mic size={34} strokeWidth={2.4} aria-hidden />}
    </button>
  );
}
