"use client";
// Mounted once in the root layout: loads the inclusive-mode settings, follows the OS preferences
// (prefers-reduced-motion, prefers-contrast) live, mirrors everything onto <html data-*> for
// globals.css, loads the dyslexia font only when needed, and owns the app-wide live region.
import { useEffect } from "react";
import { applyA11y, useA11y } from "@/lib/a11y/settings";
import GlobalVoiceCommands from "./GlobalVoiceCommands";

export default function A11yRoot() {
  const s = useA11y();
  useEffect(() => {
    useA11y.getState().hydrate();
    const rm = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    const mc = window.matchMedia?.("(prefers-contrast: more)");
    const sync = () => useA11y.setState({ osReducedMotion: !!rm?.matches, osMoreContrast: !!mc?.matches });
    sync();
    rm?.addEventListener?.("change", sync);
    mc?.addEventListener?.("change", sync);
    return () => {
      rm?.removeEventListener?.("change", sync);
      mc?.removeEventListener?.("change", sync);
    };
  }, []);

  useEffect(() => {
    if (!s.loaded) return;
    applyA11y(s); // Lexend is self-hosted (globals.css @font-face): loaded only when the dyslexia mode uses it
  }, [s]);

  return (
    <>
      <div id="a11y-live" aria-live="polite" aria-atomic="true" className="sr-only" />
      <GlobalVoiceCommands />
    </>
  );
}
