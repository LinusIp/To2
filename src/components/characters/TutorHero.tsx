"use client";
// TutorHero — the selected tutor, large and live in 3D (CLAUDE.md §6: "idle animation, waves on select").
// A self-contained building block for the tutor picker / onboarding (#5 places it):
//
//   <TutorHero id={characterId} speaking={speech} wave={nonce} className="h-[300px] w-[225px]" />
//
// - id:        tutor id (blokbek, lola, ziyo, …). Non-playable ids fall back like everywhere (getCharacter).
// - speaking:  the Speech playing this tutor's greeting (from speak() in src/lib/audio/player), or null.
//              While it plays the mouth follows the real audio (the shared lip-sync amplitude); when it
//              ends the tutor goes back to idle by itself.
// - wave:      a number; change it (e.g. +1 when the learner selects this tutor) to wave hello.
//              Calm mode and prefers-reduced-motion: no wave, no bounce — idle only.
// - className / style: size it like an image (transparent background, 3:4 frame, feet on a floor line
//              with a soft shadow, the whole body in frame, room for the raised arm).
//
// Cheap by design: ONE canvas, reusing the lesson's TutorCanvas (animator, springs, lights, adaptive
// pixel ratio ≤ 1.5, paused when the tab is hidden). The canvas is mounted only while the hero is on
// screen (IntersectionObserver). The static portrait shows until the 3D model has drawn its first
// frame, and stays if WebGL is missing or the model fails to load.
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import TutorCanvas, { type TutorView } from "./TutorCanvas";
import TutorPortrait from "./TutorPortrait";
import type { AnimInput, TutorAnimator } from "./anim/animator";
import type { Speech } from "@/lib/audio/player";
import { mouth } from "@/lib/audio/lipsync";
import { useA11y } from "@/lib/a11y/settings";

/** A 3:4 frame around one standing tutor (stage px): feet at the stage floor (860), head + raised arm in frame. */
export const HERO_VIEW: TutorView = { x0: 280 - 315, y0: 60, w: 630, h: 840, s: 1, frontX: 280 };

export interface TutorHeroProps {
  id: string;
  speaking?: Speech | null;
  wave?: number;
  className?: string;
  style?: CSSProperties;
}

function calmNow() {
  if (typeof window === "undefined") return true;
  return useA11y.getState().calm || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export default function TutorHero({ id, speaking = null, wave = 0, className, style }: TutorHeroProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [ready, setReady] = useState(false); // the 3D tutor has drawn → hide the portrait

  // mount the canvas only while on screen
  useEffect(() => {
    const el = boxRef.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver((es) => setVisible(es.some((e) => e.isIntersecting)), { rootMargin: "120px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  useEffect(() => {
    if (!visible) setReady(false);
  }, [visible]);
  useEffect(() => setReady(false), [id]); // a new model loads: portrait until it draws

  // the greeting: lip-sync only while THIS speech plays
  const speechRef = useRef<Speech | null>(null);
  useEffect(() => {
    speechRef.current = speaking;
    if (!speaking) return;
    let alive = true;
    void speaking.ended.then(() => {
      if (alive && speechRef.current === speaking) speechRef.current = null;
    });
    return () => {
      alive = false;
    };
  }, [speaking]);

  // wave on every change of `wave` (not on mount); never in calm / reduced motion
  const waveRef = useRef(0);
  const lastWave = useRef(wave);
  useEffect(() => {
    if (wave === lastWave.current) return;
    lastWave.current = wave;
    if (!calmNow()) waveRef.current++;
  }, [wave]);

  const driver = useCallback((inp: AnimInput) => {
    const talking = speechRef.current !== null && mouth.speaking;
    inp.talking = talking;
    inp.amp = talking ? mouth.amp : 0;
    inp.listening = false;
    inp.thinking = false;
    inp.emotion = "happy";
    inp.tipActive = false;
    inp.waveCount = waveRef.current;
    inp.restX = HERO_VIEW.frontX;
  }, []);

  const onReady = useCallback((a: TutorAnimator) => {
    void a;
    // wait until the first frames are on the canvas, then cross-fade from the portrait
    requestAnimationFrame(() => requestAnimationFrame(() => setReady(true)));
  }, []);

  return (
    <div ref={boxRef} className={`relative ${className ?? ""}`} style={{ aspectRatio: `${HERO_VIEW.w} / ${HERO_VIEW.h}`, ...style }} data-testid="tutor-hero" data-ready={ready ? "1" : "0"}>
      <div className="absolute inset-0 transition-opacity duration-300" style={{ opacity: ready ? 0 : 1 }} aria-hidden={ready}>
        <TutorPortrait id={id} pose="idle" frame="full" className="h-full w-full object-contain" />
      </div>
      {visible && (
        <div className="absolute inset-0 transition-opacity duration-300" style={{ opacity: ready ? 1 : 0 }}>
          <TutorCanvas key={id} characterId={id} view={HERO_VIEW} driver={driver} onReady={onReady} />
        </div>
      )}
    </div>
  );
}
