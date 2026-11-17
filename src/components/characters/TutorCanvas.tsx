"use client";
// Live 3D tutor over the classroom stage (ported from the prototype's frame loop):
// - faces the learner while talking, turns his back to the board and walks along it while writing,
// - right arm follows the chalk tip with 2-bone IK, bends for low rows,
// - mouth from the real TTS amplitude (Web Audio), blinks, listens (mic open), thinks, celebrates.
// Inputs are read every frame from shared mutable state (boardTip, mouth) and the lesson store.
import { useEffect, useRef } from "react";
import { getCharacter } from "@/config/characters";
import { boardTip } from "@/lib/board/tip";
import { mouth } from "@/lib/audio/lipsync";
import { useLesson } from "@/lib/lesson/engine";

export interface TutorView {
  x0: number;
  y0: number;
  w: number;
  h: number;
  s: number;
  frontX: number;
}

const FLOOR = 860;
const FRONT_YAW = -0.38;
const BACK_YAW = Math.PI;
const BX = 420;
const BY = 100;
const BS = 1.104;

export default function TutorCanvas({ characterId, view }: { characterId: string; view: TutorView }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const shadowRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef(view);
  viewRef.current = view;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let disposed = false;
    let raf = 0;
    let cleanup = () => {};

    (async () => {
      const THREE = await import("three");
      const V = await import("./voxel");
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
      let camKey = "";
      const syncCam = () => {
        const v = viewRef.current;
        const k = `${v.x0},${v.y0},${v.w},${v.h}`;
        if (k === camKey) return;
        camKey = k;
        // stage y grows down, three's y grows up
        cam.left = v.x0;
        cam.right = v.x0 + v.w;
        cam.top = 900 - v.y0;
        cam.bottom = 900 - (v.y0 + v.h);
        cam.updateProjectionMatrix();
      };
      const scene = new THREE.Scene();
      V.addLights(scene);
      const ch = V.makeChar(getCharacter(characterId).voxel, scene, false);

      const fit = () => {
        const r = canvas.getBoundingClientRect();
        ren.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
        ren.setSize(Math.max(1, r.width), Math.max(1, r.height), false);
      };
      fit();
      const ro = new ResizeObserver(fit);
      ro.observe(canvas);

      const T = { x: viewRef.current.frontX, tx: viewRef.current.frontX, yaw: FRONT_YAW, sy: 1, want: "front" as "front" | "back", lastTip: 0, amp: 0, wave: performance.now() + 1600, cheerUntil: 0, celebrate: useLesson.getState().celebrate, last: performance.now() };

      const frame = (now: number) => {
        raf = requestAnimationFrame(frame);
        if (document.hidden) return;
        const dt = Math.min(50, now - T.last);
        T.last = now;
        syncCam();
        const V0 = viewRef.current;
        const S = V0.s;
        const st = useLesson.getState();
        const status = st.player.status;
        const listening = status === "listening" || status === "paused";
        const thinking = status === "thinking";
        if (st.celebrate !== T.celebrate) {
          T.celebrate = st.celebrate;
          T.cheerUntil = now + 1300;
          ch.hop = now + 600;
        }

        // writing → back to the learner; 600 ms hysteresis so he doesn't flip between strokes
        const tipOn = boardTip.active && !listening && !thinking;
        if (tipOn) T.lastTip = now;
        T.want = tipOn || now - T.lastTip < 600 ? "back" : "front";
        const tip = { x: BX + boardTip.x * BS, y: BY + boardTip.y * BS };
        if (T.want === "back") T.tx = Math.max(V0.x0 + 300 * S, Math.min(V0.x0 + V0.w - 200 * S, tip.x - 265 * S));
        else T.tx = V0.frontX;
        const moving = Math.abs(T.tx - T.x) > 2;
        T.x += (T.tx - T.x) * Math.min(1, (dt / 1000) * 5);
        T.yaw += ((T.want === "back" ? BACK_YAW : FRONT_YAW) - T.yaw) * Math.min(1, dt * 0.012);
        const mode = Math.abs(T.yaw - BACK_YAW) < 0.2 ? "back" : Math.abs(T.yaw - FRONT_YAW) < 0.2 ? "front" : "turning";
        let wantSy = 1;
        if (mode === "back" && tipOn) wantSy = Math.max(0.8, Math.min(1, (FLOOR - (tip.y - 230 * S)) / (455 * S)));
        T.sy += (wantSy - T.sy) * Math.min(1, (dt / 1000) * 6);

        // lip-sync: smoothed amplitude (fast attack, slower release)
        const target = mouth.speaking ? mouth.amp : 0;
        T.amp += (target - T.amp) * (target > T.amp ? Math.min(1, dt / 30) : Math.min(1, dt / 90));
        const talking = mouth.speaking;

        const bob = (moving ? Math.abs(Math.sin(now / 110)) * 8 : Math.sin(now / 900) * 2) * S;
        const hop = ch.hop > now ? Math.sin(((ch.hop - now) / 600) * Math.PI) * 26 * S : 0;
        ch.root.position.set(T.x, 900 - FLOOR + bob + hop, 0);
        ch.root.scale.set(S, T.sy * S, S);
        ch.body.rotation.y = T.yaw;
        ch.root.rotation.z = listening ? 0.035 : 0; // lean toward the learner while listening
        const sw = moving ? Math.sin(now / 110) * 0.5 : 0;
        ch.legL.rotation.x = sw;
        ch.legR.rotation.x = -sw;
        ch.head.rotation.z = thinking ? 0.12 : Math.sin(now / 1300) * 0.03;
        ch.head.rotation.x = talking ? Math.sin(now / 160) * 0.025 * (0.5 + T.amp) : 0;

        const cheering = T.cheerUntil > now;
        const waving = T.wave > now;
        const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
        if (cheering) {
          ch.armP.sh.rotation.z = 2.75;
          ch.armP.el.rotation.z = 0.3 + Math.sin(now / 90) * 0.2;
        } else if (waving) {
          ch.armP.sh.rotation.z = 2.75;
          ch.armP.el.rotation.z = 0.35 + Math.sin(now / 120) * 0.45;
        } else if (thinking) {
          ch.armP.sh.rotation.z = lerp(ch.armP.sh.rotation.z, 2.2, 0.15);
          ch.armP.el.rotation.z = lerp(ch.armP.el.rotation.z, 2.3, 0.15); // hand to chin
        } else if (mode === "front" && talking && !listening) {
          ch.armP.sh.rotation.z = 1.72 + Math.sin(now / 700) * 0.06; // points at the board
          ch.armP.el.rotation.z = 0.18;
        } else {
          ch.armP.sh.rotation.z = lerp(ch.armP.sh.rotation.z, 0.08, 0.3);
          ch.armP.el.rotation.z = lerp(ch.armP.el.rotation.z, 0.05, 0.3);
        }

        if (cheering) {
          ch.armW.sh.rotation.z = -2.75;
          ch.armW.el.rotation.z = -0.3;
        } else if (mode === "back" && tipOn) {
          // 2-bone IK: shoulder → elbow → chalk tip
          const Sh = { x: T.x + 117 * S, y: 900 - FLOOR + bob + 455 * S * T.sy * Math.cos(0.12) };
          const tgt = { x: tip.x + 2, y: 900 - tip.y - 4 };
          const L1 = 145 * S;
          const L2 = 160 * S;
          let dx = tgt.x - Sh.x;
          let dy = tgt.y - Sh.y;
          let d = Math.hypot(dx, dy);
          if (d > L1 + L2 - 1) {
            const k = (L1 + L2 - 1) / d;
            dx *= k;
            dy *= k;
            d = L1 + L2 - 1;
          }
          const a = Math.atan2(dy, dx);
          const th = Math.acos(Math.max(-1, Math.min(1, (L1 * L1 + d * d - L2 * L2) / (2 * L1 * d))));
          const p1 = a - th;
          const E = { x: Sh.x + L1 * Math.cos(p1), y: Sh.y + L1 * Math.sin(p1) };
          const p2 = Math.atan2(Sh.y + dy - E.y, Sh.x + dx - E.x);
          ch.armW.sh.rotation.z = -(p1 + Math.PI / 2);
          ch.armW.el.rotation.z = -(p2 - p1);
        } else {
          ch.armW.sh.rotation.z = lerp(ch.armW.sh.rotation.z, -0.06, 0.35);
          ch.armW.el.rotation.z = lerp(ch.armW.el.rotation.z, -0.05, 0.35);
        }
        if (ch.armW.chalk) ch.armW.chalk.visible = mode !== "front";

        // face: mouth from amplitude (only visible when facing us), blink, look direction
        let m = 0;
        if (talking && mode !== "back") m = T.amp > 0.55 ? 3 : T.amp > 0.3 ? 2 : T.amp > 0.08 ? 1 : 0;
        if (cheering) m = 2;
        const blink = V.blinkState(ch, now);
        V.updateFace(ch, m, blink, listening ? "listen" : talking || mode === "front" ? "learner" : "board");

        if (shadowRef.current) {
          shadowRef.current.style.left = `${((T.x - V0.x0) / V0.w) * 100}%`;
          shadowRef.current.style.top = `${((FLOOR - V0.y0) / V0.h) * 100}%`;
          shadowRef.current.style.width = `${((240 * S) / V0.w) * 100}%`;
        }
        ren.clear();
        ren.render(scene, cam);
      };
      raf = requestAnimationFrame(frame);

      cleanup = () => {
        cancelAnimationFrame(raf);
        ro.disconnect();
        ch.dispose();
        ren.dispose();
      };
    })();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
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
