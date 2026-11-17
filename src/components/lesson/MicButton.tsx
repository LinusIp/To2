"use client";
// "Savol berish": hold to speak, release to send; a quick tap toggles (tap again to send). Space bar on desktop.
import { useEffect, useRef, useState } from "react";
import { t } from "@/i18n/uz";
import { MicIcon } from "@/components/ui/icons";

export default function MicButton({
  onStart,
  onStop,
  listening,
  disabled,
}: {
  onStart: () => Promise<boolean> | void;
  onStop: () => void;
  listening: boolean;
  disabled?: boolean;
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

  useEffect(() => {
    const typing = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
    };
    const down = (e: KeyboardEvent) => {
      if (e.code !== "Space" || e.repeat || typing(e)) return;
      e.preventDefault();
      void start();
    };
    const up = (e: KeyboardEvent) => {
      if (e.code !== "Space" || typing(e)) return;
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

  return (
    <button
      type="button"
      aria-label={listening ? t.lessonUi.stop : t.lesson.mic}
      title={t.lessonUi.askHint}
      aria-pressed={listening}
      disabled={disabled}
      className="btn btn-primary min-w-0 flex-1 touch-none select-none"
      style={listening ? { background: "#ff8a1f", boxShadow: "0 0 0 6px rgba(255,138,31,.25), 0 10px 22px rgba(255,138,31,.35)" } : undefined}
      onPointerDown={(e) => {
        e.preventDefault();
        if (toggled) return stop();
        (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
        void start();
      }}
      onPointerUp={() => {
        if (!active.current) return;
        if (performance.now() - downAt.current < 350) return setToggled(true);
        stop();
      }}
      onPointerCancel={stop}
      onContextMenu={(e) => e.preventDefault()}
    >
      <MicIcon size={22} />
      {listening ? t.lessonUi.listening : t.lessonUi.ask}
    </button>
  );
}
