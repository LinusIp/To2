"use client";
// Live 3D tutor over the classroom stage. All motion comes from TutorAnimator
// (./anim/animator.ts): states with crossfades, springs on every joint, IK writing, lip-sync.
// This component only owns the renderer and fills the animator's input from shared mutable
// state (boardTip, boardFocus, mouth) and the lesson store — or from a `driver` (dev page).
import { useEffect, useRef } from "react";
import { getCharacter } from "@/config/characters";
import { boardFocus, boardTip, tutorGate } from "@/lib/board/tip";
import { mouth } from "@/lib/audio/lipsync";
import { useLesson } from "@/lib/lesson/engine";
import type { AnimInput, TutorAnimator } from "./anim/animator";
import { restSpot, type Box } from "@/lib/board/tutorSpot";
import { measure } from "@/lib/board/layout";
import { SIDE_BOARD, type BoardState } from "@/lib/board/model";

export interface TutorView {
  x0: number;
  y0: number;
  w: number;
  h: number;
  s: number;
  frontX: number;
}

const FLOOR = 860;

/** What is written on the board right now (main, notes and the side slate) — the tutor must not cover it. */
function boardBoxes(b: BoardState): Box[] {
  const boxes: Box[] = b.els.map((e) => measure(e.cmd));
  if (!b.noteDim && b.els.some((e) => e.layer === "note")) {
    const p = b.side ?? SIDE_BOARD;
    boxes.push({ x: p.x - 10, y: p.y - 40, w: SIDE_BOARD.w + 20, h: SIDE_BOARD.h + 50 });
  }
  return boxes;
}
// the talking spot is recomputed only when the board or the view changes
let spotBoard: BoardState | null = null;
let spotKey = "";
let spotX = NaN;

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
  const key = `${view.x0},${view.w},${view.s}`;
  if (st.board !== spotBoard || key !== spotKey) {
    spotBoard = st.board;
    spotKey = key;
    spotX = restSpot(boardBoxes(st.board), view);
  }
  inp.restX = spotX; // while talking: at the board's left edge, never in front of writing
}

export default function TutorCanvas({
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
      ren.toneMapping = THREE.ACESFilmicToneMapping;
      ren.toneMappingExposure = 1.05;
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
      V.addLights(scene);
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

      const fit = () => {
        const r = canvas.getBoundingClientRect();
        ren.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
        ren.setSize(Math.max(1, r.width), Math.max(1, r.height), false);
      };
      fit();
      const ro = new ResizeObserver(fit);
      ro.observe(canvas);

      const anim = new A.TutorAnimator(ch, characterId, viewRef.current);
      const inp = A.newInput();
      driverRef.current(inp, viewRef.current);
      anim.prime(inp);
      const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
      const onMq = () => (anim.reducedMotion = mq.matches);
      onMq();
      mq.addEventListener("change", onMq);
      readyRef.current?.(anim);

      // dev only: lets tests read the rig state (mouth/lid frames, chalk vs. tip, state) + per-frame work time
      const perf = { ms: new Float32Array(600), i: 0 };
      const dev = process.env.NODE_ENV !== "production";
      if (dev) (window as unknown as { __tutor?: unknown }).__tutor = { ch, anim, inp, boardTip, perf };

      let last = -1;
      const shadow = shadowRef.current;
      const sh = [NaN, NaN, NaN];
      const frame = (now: number) => {
        const w0 = dev ? performance.now() : 0;
        const dt = last < 0 ? 0 : (now - last) / 1000;
        last = now;
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
        ro.disconnect();
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
}
