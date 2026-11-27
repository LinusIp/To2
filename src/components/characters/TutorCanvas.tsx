"use client";
// Live 3D tutor over the classroom stage. All motion comes from TutorAnimator
// (./anim/animator.ts): states with crossfades, springs on every joint, IK writing, lip-sync.
// This component only owns the renderer and fills the animator's input from shared mutable
// state (boardTip, boardFocus, mouth) and the lesson store — or from a `driver` (dev page).
import { memo, useEffect, useRef } from "react";
import { getCharacter } from "@/config/characters";
import { boardFocus, boardTip, tutorGate } from "@/lib/board/tip";
import { mouth } from "@/lib/audio/lipsync";
import { useLesson } from "@/lib/lesson/engine";
import type { AnimInput, TutorAnimator } from "./anim/animator";
import { covered, restSpot, type Box } from "@/lib/board/tutorSpot";
import { measure } from "@/lib/board/layout";
import { SIDE_BOARD, type BoardState } from "@/lib/board/model";
import { useA11y } from "@/lib/a11y/settings";
import { newDpr, resetDpr, stepDpr } from "@/lib/anim/pixelRatio";

export interface TutorView {
  x0: number;
  y0: number;
  w: number;
  h: number;
  s: number;
  frontX: number;
}

const FLOOR = 860;

/**
 * Lesson light presets (intensities ×π, like voxel.ts addLights). "aces" is the rig before M6, kept
 * for comparison. The portraits are rendered in Blender with AgX "Medium High Contrast", a soft key
 * and a front fill; three.js has no MHC look, so Neutral + a soft rig is the closest match.
 */
type LightName = "aces" | "neutral" | "agx";
interface LightPreset {
  tone: LightName;
  exposure: number;
  /** hemisphere sky / ground colour and intensity */
  sky: number;
  ground: number;
  hemi: number;
  keyColor: number;
  key: number;
  fill: number;
  rim: number;
}
const WARM = { sky: 0xfff1dc, ground: 0x6a5440, keyColor: 0xffe0b5 }; // the pre-M6 colours
const LESSON_LIGHT: Record<LightName, LightPreset> = {
  aces: { tone: "aces", exposure: 1.05, ...WARM, hemi: 0.95, key: 1.25, fill: 0.32, rim: 0.35 },
  // like the Blender portraits: a near-white, slightly cool ambient (world 0.9/0.92/1.0), a soft
  // key that only shapes the blocks, and no extra warmth (the classroom overlay already adds it)
  neutral: { tone: "neutral", exposure: 1.18, sky: 0xf7f6f3, ground: 0x8a8580, hemi: 1.45, keyColor: 0xfff3e4, key: 0.6, fill: 0.32, rim: 0.4 },
  agx: { tone: "agx", exposure: 1.3, sky: 0xf4f5ff, ground: 0x8c8278, hemi: 1.45, keyColor: 0xfff3e4, key: 0.6, fill: 0.32, rim: 0.4 },
};
const DEFAULT_LIGHT: LightName = "neutral";

/** What is written on the board right now (main, notes and the side slate) — the tutor must not cover it. */
function boardBoxes(b: BoardState): Box[] {
  const boxes: Box[] = b.els.map((e) => measure(e.cmd));
  if (!b.noteDim && b.els.some((e) => e.layer === "note")) {
    const p = b.side ?? SIDE_BOARD;
    boxes.push({ x: p.x - 10, y: p.y - 40, w: SIDE_BOARD.w + 20, h: SIDE_BOARD.h + 50 });
  }
  return boxes;
}
// the talking spot is recomputed only when the board, the view or the controls over the stage change
let spotBoard: BoardState | null = null;
let spotKey = "";
let spotX = NaN;

/**
 * Controls drawn OVER the stage (on phones: the back button top-left, the tools top-right), in stage
 * coordinates. Measured from the DOM by the canvas (once a second + on resize), never hard-coded.
 */
let controls: Box[] = [];
let controlsVer = 0;
/** the tutor's head incl. hair, rig px relative to the feet (GLB tutors ~750 tall, head block ~240) */
const HEAD = { halfW: 125, from: 500, to: 790 };
const headHits = (x: number, s: number, cs: Box[]) => {
  const l = x - HEAD.halfW * s;
  const r = x + HEAD.halfW * s;
  const t = FLOOR - HEAD.to * s;
  const b = FLOOR - HEAD.from * s;
  return cs.some((c) => c.x < r && c.x + c.w > l && c.y < b && c.y + c.h > t);
};
/**
 * The rest spot, moved just far enough that the tutor's head is not under a control (the lesson's
 * back button sat on the tutor's head on phones). Prefers a spot that still covers no writing.
 */
function clearOfControls(x0: number, boxes: Box[], view: TutorView): number {
  if (!controls.length || !headHits(x0, view.s, controls)) return x0;
  const hw = 210 * view.s; // tutorSpot's TUTOR_HALF_W
  const lo = view.x0 + hw * 0.3;
  const hi = view.x0 + view.w - hw;
  let fallback = NaN;
  for (let d = 8; d < view.w; d += 8)
    for (const x of [x0 + d, x0 - d]) {
      if (x < lo || x > hi || headHits(x, view.s, controls)) continue;
      if (covered(x, boxes, view) === 0) return x;
      if (Number.isNaN(fallback)) fallback = x;
    }
  return Number.isNaN(fallback) ? x0 : fallback;
}
/** Measure the links/buttons over the stage (`stage` = the stage element) into `controls`. */
function measureControls(stage: Element, view: TutorView) {
  const sr = stage.getBoundingClientRect();
  if (sr.width < 1 || sr.height < 1) return;
  const next: Box[] = [];
  for (const el of document.querySelectorAll("a[href], button")) {
    if (stage.contains(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.right <= sr.left || r.left >= sr.right || r.bottom <= sr.top || r.top >= sr.bottom) continue;
    // stage coordinates, padded 6 css px
    const k = view.w / sr.width;
    next.push({ x: view.x0 + (r.left - 6 - sr.left) * k, y: view.y0 + (r.top - 6 - sr.top) * k, w: (r.width + 12) * k, h: (r.height + 12) * k });
  }
  const same = next.length === controls.length && next.every((b, i) => Math.abs(b.x - controls[i].x) < 2 && Math.abs(b.y - controls[i].y) < 2);
  if (!same) {
    controls = next;
    controlsVer++;
  }
}

/** Fill the animator input from the live lesson (the default driver). */
function lessonDriver(inp: AnimInput, view: TutorView) {
  const st = useLesson.getState();
  const status = st.player.status;
  inp.talking = mouth.speaking;
  inp.amp = mouth.amp;
  inp.listening = status === "listening" || status === "paused";
  inp.thinking = status === "thinking";
  inp.emotion = st.emotion;
  inp.tipActive = boardTip.active;
  inp.tipX = boardTip.x;
  inp.tipY = boardTip.y;
  inp.tipLeft = boardTip.left;
  inp.focusCount = boardFocus.count;
  inp.focusX = boardFocus.x;
  inp.focusY = boardFocus.y;
  inp.praiseCount = st.celebrate;
  const key = `${view.x0},${view.w},${view.s},${controlsVer}`;
  if (st.board !== spotBoard || key !== spotKey) {
    spotBoard = st.board;
    spotKey = key;
    const bb = boardBoxes(st.board);
    spotX = clearOfControls(restSpot(bb, view), bb, view);
  }
  inp.restX = spotX; // while talking: at the board's left edge, never in front of writing or under a button
}

export default memo(function TutorCanvas({
  characterId,
  view,
  driver = lessonDriver,
  onReady,
}: {
  characterId: string;
  view: TutorView;
  /** fills the input every frame (default: the live lesson) */
  driver?: (inp: AnimInput, view: TutorView) => void;
  /** gives the dev page access to the animator (speed, state) */
  onReady?: (a: TutorAnimator) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const shadowRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef(view);
  viewRef.current = view;
  const driverRef = useRef(driver);
  driverRef.current = driver;
  const readyRef = useRef(onReady);
  readyRef.current = onReady;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let disposed = false;
    let cleanup = () => {};

    (async () => {
      const THREE = await import("three");
      const V = await import("./voxel");
      const A = await import("./anim/animator");
      if (disposed) return;
      let ren: import("three").WebGLRenderer;
      try {
        ren = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
      } catch {
        return; // no WebGL: the board + captions still work
      }
      // M6 light: the baked textures already carry painted shading, so the lesson uses a soft rig
      // (raised hemisphere, softer key) and Neutral tone mapping instead of ACES on top of it.
      // Dev only: `?light=aces|neutral|agx` switches presets for side-by-side checks.
      const pick = process.env.NODE_ENV !== "production" ? new URLSearchParams(location.search).get("light") : null;
      const L = LESSON_LIGHT[pick as LightName] ?? LESSON_LIGHT[DEFAULT_LIGHT];
      ren.toneMapping = L.tone === "aces" ? THREE.ACESFilmicToneMapping : L.tone === "agx" ? THREE.AgXToneMapping : THREE.NeutralToneMapping;
      ren.toneMappingExposure = L.exposure;
      const cam = new THREE.OrthographicCamera(0, 1600, 900, 0, -3000, 3000);
      cam.position.set(0, 0, 1000);
      let cx0 = NaN, cy0 = NaN, cw = NaN, chh = NaN;
      const syncCam = () => {
        const v = viewRef.current;
        if (v.x0 === cx0 && v.y0 === cy0 && v.w === cw && v.h === chh) return;
        cx0 = v.x0;
        cy0 = v.y0;
        cw = v.w;
        chh = v.h;
        // stage y grows down, three's y grows up
        cam.left = v.x0;
        cam.right = v.x0 + v.w;
        cam.top = 900 - v.y0;
        cam.bottom = 900 - (v.y0 + v.h);
        cam.updateProjectionMatrix();
      };
      const scene = new THREE.Scene();
      // same light directions as before (warm window key from the left, cool fill from the right, rim
      // from behind — they match the classroom's painted light), only the balance changed
      const PI = Math.PI;
      scene.add(new THREE.HemisphereLight(L.sky, L.ground, L.hemi * PI));
      const key = new THREE.DirectionalLight(L.keyColor, L.key * PI);
      key.position.set(-700, 900, 900);
      const fill = new THREE.DirectionalLight(0x9fc3ff, L.fill * PI);
      fill.position.set(900, 200, 600);
      const rim = new THREE.DirectionalLight(0xffffff, L.rim * PI);
      rim.position.set(300, 600, -900);
      scene.add(key, fill, rim);
      A.setFaceUpdater(V.updateFace);

      // real hinged 3D model (public/models/tripo/<id>.glb) when it exists, else the box-built
      // voxel rig. Both are a VoxelChar, so the animator drives either one.
      const cfg = getCharacter(characterId).voxel;
      const G = await import("./glbTutor");
      let ch: import("./voxel").VoxelChar | null = null;
      if (G.hasGlb(characterId)) {
        try {
          const model = await G.loadGlb(characterId);
          if (disposed) return;
          ch = G.makeGlbChar(model, cfg, scene);
        } catch (e) {
          console.warn("[tutor] GLB failed, using voxel rig", e);
        }
      }
      if (disposed) {
        ch?.dispose();
        return;
      }
      if (!ch) ch = V.makeChar(cfg, scene, false);

      // adaptive pixel ratio: ≤ 1.5×, stepped down while the frame rate stays low (src/lib/anim/pixelRatio.ts)
      const dpr = newDpr(window.devicePixelRatio || 1);
      const fit = () => {
        const r = canvas.getBoundingClientRect();
        ren.setPixelRatio(dpr.ratio);
        ren.setSize(Math.max(1, r.width), Math.max(1, r.height), false);
      };
      fit();
      // lesson only: keep the tutor's head out from under the controls over the stage (measured, not hard-coded)
      const stageEl = canvas.parentElement;
      const ctl = driverRef.current === lessonDriver && stageEl ? () => measureControls(stageEl, viewRef.current) : null;
      ctl?.();
      const ctlTimer = ctl ? window.setInterval(ctl, 1000) : 0;
      const ro = new ResizeObserver(() => {
        fit();
        ctl?.();
      });
      ro.observe(canvas);

      const anim = new A.TutorAnimator(ch, characterId, viewRef.current);
      const inp = A.newInput();
      driverRef.current(inp, viewRef.current);
      anim.prime(inp);
      if (Number.isFinite(inp.restX)) anim.x = inp.restX; // start where it will stand, no walk-in
      const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
      const onMq = () => (anim.reducedMotion = mq.matches || useA11y.getState().calm); // + the calm mode
      onMq();
      mq.addEventListener("change", onMq);
      const offCalm = useA11y.subscribe(onMq);
      readyRef.current?.(anim);

      // dev only: lets tests read the rig state (mouth/lid frames, chalk vs. tip, state) + per-frame work time
      const perf = { ms: new Float32Array(600), i: 0 };
      const dev = process.env.NODE_ENV !== "production";
      if (dev) (window as unknown as { __tutor?: unknown }).__tutor = { ch, anim, inp, boardTip, perf, dpr };

      let last = -1;
      const shadow = shadowRef.current;
      const sh = [NaN, NaN, NaN];
      const frame = (now: number) => {
        const w0 = dev ? performance.now() : 0;
        const dt = last < 0 ? 0 : (now - last) / 1000;
        last = now;
        if (dt > 0 && stepDpr(dpr, dt * 1000)) fit();
        syncCam();
        const v = viewRef.current;
        driverRef.current(inp, viewRef.current);
        anim.update(dt, inp, v);
        tutorGate.hold = anim.holdBoard;
        if (shadow) {
          // touch the DOM only when the (rounded) value changes: no string garbage per frame
          const l = Math.round(((anim.x - v.x0) / v.w) * 1000);
          const tp = Math.round(((FLOOR - v.y0) / v.h) * 1000);
          const w = Math.round(((240 * v.s) / v.w) * 1000);
          if (l !== sh[0]) shadow.style.left = `${(sh[0] = l) / 10}%`;
          if (tp !== sh[1]) shadow.style.top = `${(sh[1] = tp) / 10}%`;
          if (w !== sh[2]) shadow.style.width = `${(sh[2] = w) / 10}%`;
        }
        ren.render(scene, cam);
        if (dev) perf.ms[perf.i++ % perf.ms.length] = performance.now() - w0;
      };
      // pause the loop while the tab is hidden; the first frame after it comes back has dt = 0
      const onVis = () => {
        if (document.hidden) {
          ren.setAnimationLoop(null);
          tutorGate.hold = false; // never stall the board while we are not drawing
        }
        else {
          last = -1;
          resetDpr(dpr); // the hidden time says nothing about how fast we draw
          ren.setAnimationLoop(frame);
        }
      };
      document.addEventListener("visibilitychange", onVis);
      onVis();

      cleanup = () => {
        tutorGate.hold = false;
        ren.setAnimationLoop(null);
        document.removeEventListener("visibilitychange", onVis);
        mq.removeEventListener("change", onMq);
        offCalm();
        ro.disconnect();
        clearInterval(ctlTimer);
        if (ctl) {
          controls = [];
          controlsVer++;
        }
        ch?.dispose();
        ren.dispose();
      };
    })();

    return () => {
      disposed = true;
      cleanup();
    };
  }, [characterId]);

  return (
    <>
      <div
        ref={shadowRef}
        aria-hidden
        className="pointer-events-none absolute"
        style={{ left: `${((view.frontX - view.x0) / view.w) * 100}%`, top: `${((FLOOR - view.y0) / view.h) * 100}%`, width: "15%", height: "3%", transform: "translate(-50%,-50%)", borderRadius: "50%", background: "rgba(0,0,0,.3)" }}
      />
      <canvas ref={canvasRef} aria-hidden className="pointer-events-none absolute inset-0 h-full w-full" />
    </>
  );
});
