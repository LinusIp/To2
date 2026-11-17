// Tutor animator: one state machine for every tutor (Tripo GLB rigs and the makeChar fallback —
// both are a VoxelChar with the same joints). Runs once per frame and allocates nothing.
//
// How the motion stays smooth
// 1. The current STATE writes a target pose (`st`). On a state change the blended target is
//    snapshotted (`prev`) and the new state fades in over 220 ms (ease-in-out).
// 2. Every joint's CURRENT value follows its target with a critically damped spring
//    (src/lib/anim/spring.ts). Stiffness: arms 14, elbows 11 (they lag the shoulders),
//    head 10, body/root 8, the writing arm 22 while it follows the chalk (IK).
// 3. Periodic motion (breathing, weight shift, walk cycle, hops, praise jumps, the 3 Hz wave)
//    is ADDED on top of the springs as smooth functions of time, scaled by weights that are
//    themselves smoothed. A k=8 spring would flatten a 380 ms hop or a 3 Hz wave to nothing.
// 4. Joint limits are applied last (head pitch ±12°, Lola ±8° because her hair is on the head;
//    head yaw ±35°; elbows bend one way only; legs ±35°).
import type { VoxelChar } from "../voxel";
import { DEG, clamp, clampDt, easeInOut, follow, springStep } from "@/lib/anim/spring";
import { newMouth, stepMouth } from "@/lib/anim/mouth";
import { forceBlink, newBlink, stepBlink } from "@/lib/anim/blink";

/** Stage geometry (1600×900, y down). three.js y = 900 − stage y. */
export const FLOOR = 860;
export const BOARD = { x: 420, y: 100, s: 1.104 }; // board coords (1000×625) → stage
export const FRONT_YAW = -0.38;
export const BACK_YAW = Math.PI;

export type AnimState = "idle" | "talk" | "listen" | "think" | "turnToBoard" | "write" | "walkAlongBoard" | "turnToLearner" | "point" | "praise";
export type Emotion = "neutral" | "happy" | "thinking" | "excited" | "encouraging";

/** Filled by the caller every frame (reuse one object). Board coords for the tip/focus. */
export interface AnimInput {
  talking: boolean;
  amp: number;
  listening: boolean;
  thinking: boolean;
  emotion: Emotion;
  /** chalk tip of the stroke being written right now (board coords) */
  tipActive: boolean;
  tipX: number;
  tipY: number;
  /** a highlighted board element (board coords); bump `focusCount` to point at it */
  focusCount: number;
  focusX: number;
  focusY: number;
  /** bump to play the praise move */
  praiseCount: number;
}

export const newInput = (): AnimInput => ({
  talking: false, amp: 0, listening: false, thinking: false, emotion: "neutral",
  tipActive: false, tipX: 0, tipY: 0, focusCount: 0, focusX: 0, focusY: 0, praiseCount: 0,
});

export interface AnimView {
  x0: number;
  w: number;
  s: number;
  frontX: number;
}

// ---- joints -------------------------------------------------------------------------------
const J = {
  rootY: 0, rootRz: 1, rootRx: 2, yaw: 3, headRx: 4, headRy: 5, headRz: 6,
  shWz: 7, shWx: 8, elWz: 9, shPz: 10, shPx: 11, elPz: 12, legL: 13, legR: 14,
  scale: 15, bend: 16, lift: 17,
} as const;
const N = 18;
const K = new Float64Array(N);
K.fill(8);
K[J.headRx] = K[J.headRy] = K[J.headRz] = 10;
K[J.shWz] = K[J.shWx] = K[J.shPz] = K[J.shPx] = 14;
K[J.elWz] = K[J.elPz] = 11;
K[J.legL] = K[J.legR] = 14;
K[J.yaw] = 16; // the turn curve itself carries the overshoot; the spring only rounds it off
K[J.scale] = 9;
K[J.bend] = K[J.lift] = 6;

const FADE_MS = 220;
const TURN_DIP_MS = 80;
const TURN_MS = 380;
const TURN_SETTLE_MS = 140;
const POINT_MS = 1500;
const MAX_HOLD_MS = 1600; // never keep the board waiting longer than this per turn / walk
const WALK_EASE = 1 / 0.05; // velocity follows its target in ~150 ms
const LEG_SWING = 22 * DEG;
const ARM_SWING = 14 * DEG;

type PraiseStyle = "thumbs" | "wave" | "jump";
const PRAISE: Record<string, PraiseStyle> = { blokbek: "thumbs", lola: "wave", ziyo: "jump" };
const PRAISE_MS: Record<PraiseStyle, number> = { thumbs: 1400, wave: 1700, jump: 1250 };

export class TutorAnimator {
  readonly ch: VoxelChar;
  /** current state (read by the dev page / tests) */
  state: AnimState = "idle";
  /** playback speed (dev slider), scales the internal clock */
  speed = 1;
  reducedMotion = false;

  // joint arrays
  private tgt = new Float64Array(N);
  private st = new Float64Array(N);
  private prev = new Float64Array(N);
  private cur = new Float64Array(N);
  private vel = new Float64Array(N);

  private t = 0; // internal clock, ms
  private fadeT0 = -1e9;
  private stateT0 = 0;
  private facing: "front" | "board" = "front";
  private turnFrom = FRONT_YAW;
  private turnTo = FRONT_YAW;

  // locomotion
  x: number;
  private v = 0;
  private walkTarget: number;
  private walkW = 0;
  private phase = 0;
  private stride: number;

  // writing
  private lastTipAt = -1e9;
  private writeW = 0;
  /** chalk tip in three.js coords, for the IK and the dev hook */
  tip3 = { x: 0, y: 0 };

  // layers / timers
  private praiseStyle: PraiseStyle;
  private praiseSeen: number;
  private praiseReqAt = -1e9;
  private praiseT0 = -1e9;
  private focusSeen: number;
  private pointUntil = -1e9;
  private focus3 = { x: 0, y: 0 };
  private glanceAt = 0;
  private glanceUntil = 0;
  private glanceY = 0;
  private glanceX = 0;
  private gestureAt = 0;
  private gesture = -1;
  private gestureUntil = 0;
  private nod = 0; // syllable nod impulse (decays)
  private envSlow = 0;
  private lastPeakAt = 0;
  private waveW = 0;
  private bounceW = 0;
  private mouth = newMouth();
  private blink = newBlink();
  private headPitchMax: number;
  private rnd: () => number;

  constructor(ch: VoxelChar, id: string, view: AnimView, opts?: { rand?: () => number }) {
    this.ch = ch;
    this.rnd = opts?.rand ?? Math.random;
    this.praiseStyle = PRAISE[id] ?? "jump";
    this.headPitchMax = (id === "lola" ? 8 : 12) * DEG;
    this.x = this.walkTarget = view.frontX;
    // stride (px of travel per radian of walk phase) from leg length: one cycle = two steps of
    // 2·hip·sin(22°) each, so the planted foot doesn't slide
    const hip = Math.max(120, ch.legL.position.y);
    this.stride = (4 * hip * Math.sin(LEG_SWING)) / (2 * Math.PI);
    this.praiseSeen = 0;
    this.focusSeen = 0;
    // start relaxed, facing the learner, at the view's scale
    this.writeState("idle", view);
    this.cur.set(this.st);
    this.tgt.set(this.st);
    this.prev.set(this.st);
  }

  /** Sync the event counters without triggering (call once after the first input fill). */
  prime(inp: AnimInput) {
    this.praiseSeen = inp.praiseCount;
    this.focusSeen = inp.focusCount;
  }

  private setState(s: AnimState) {
    if (s === this.state) return;
    this.prev.set(this.tgt);
    this.fadeT0 = this.t;
    this.stateT0 = this.t;
    this.state = s;
    if (s === "turnToBoard" || s === "turnToLearner") {
      this.turnFrom = this.cur[J.yaw];
      this.turnTo = s === "turnToBoard" ? BACK_YAW : FRONT_YAW;
      forceBlink(this.blink, this.t);
    }
    if (s === "talk") this.gestureAt = this.t + 400;
  }

  /** Advance one frame. `dtSec` = real frame delta (clamped to 1/30 s), `view` = stage view. */
  update(dtSec: number, inp: AnimInput, view: AnimView) {
    const dt = clampDt(dtSec) * this.speed;
    const dms = dt * 1000;
    this.t += dms;
    const t = this.t;
    const ch = this.ch;
    const rig = ch.rig;
    const reach = rig.L1 + rig.L2;
    const S = this.cur[J.scale];

    // ---- events ----
    if (inp.praiseCount !== this.praiseSeen) {
      this.praiseSeen = inp.praiseCount;
      this.praiseReqAt = t;
    }
    if (inp.focusCount !== this.focusSeen) {
      this.focusSeen = inp.focusCount;
      this.pointUntil = t + POINT_MS;
      this.focus3.x = BOARD.x + inp.focusX * BOARD.s;
      this.focus3.y = 900 - (BOARD.y + inp.focusY * BOARD.s);
    }
    const tipOn = inp.tipActive && !inp.listening && !inp.thinking;
    if (tipOn) {
      const nx = BOARD.x + inp.tipX * BOARD.s;
      const ny = 900 - (BOARD.y + inp.tipY * BOARD.s);
      // tip velocity (px/s), for the IK lead; a jump (new stroke) resets it
      if (dt > 0 && t - this.lastTipAt < 100) {
        const jx = nx - this.tip3.x;
        const jy = ny - this.tip3.y;
        if (Math.hypot(jx, jy) > 40) {
          this.tipVx = this.tipVy = 0;
          this.strokeAt = t;
        }
        else {
          this.tipVx = follow(this.tipVx, jx / dt, 20, dt);
          this.tipVy = follow(this.tipVy, jy / dt, 20, dt);
        }
      } else {
        this.tipVx = this.tipVy = 0;
        this.strokeAt = t;
      }
      this.lastTipAt = t;
      this.tip3.x = nx;
      this.tip3.y = ny;
    } else {
      this.tipVx = follow(this.tipVx, 0, 20, dt);
      this.tipVy = follow(this.tipVy, 0, 20, dt);
    }
    const wantBoard = tipOn || t - this.lastTipAt < 700;

    // ---- state selection ----
    const inTurn = this.state === "turnToBoard" || this.state === "turnToLearner";
    if (inTurn) {
      if (t - this.stateT0 >= TURN_DIP_MS + TURN_MS) {
        this.facing = this.state === "turnToBoard" ? "board" : "front";
        this.setState(this.facing === "board" ? "write" : "idle");
      }
    }
    if (!(this.state === "turnToBoard" || this.state === "turnToLearner")) {
      if (this.facing === "front") {
        if (wantBoard) this.setState("turnToBoard");
        else {
          const praising = this.praiseT0 > 0 && t - this.praiseT0 < PRAISE_MS[this.praiseStyle];
          if (!praising && t - this.praiseReqAt < 2000 && this.praiseT0 < this.praiseReqAt) this.praiseT0 = t;
          const praiseNow = this.praiseT0 > 0 && t - this.praiseT0 < PRAISE_MS[this.praiseStyle];
          const thinking = inp.thinking || inp.emotion === "thinking";
          this.setState(
            praiseNow ? "praise"
            : inp.listening ? "listen"
            : thinking ? "think"
            : t < this.pointUntil ? "point"
            : inp.talking ? "talk"
            : "idle",
          );
        }
      } else if (!wantBoard) this.setState("turnToLearner");
      else {
        // walk first when the chalk is out of comfortable reach (60%)
        const shX = this.x - rig.shX * Math.cos(this.cur[J.yaw]) * S;
        // ...but only if walking helps (the stage edge may stop him: then he reaches from where he is)
        const goal = clamp(this.tip3.x - (rig.shX + reach * 0.45) * S, view.x0 + 140 * view.s, view.x0 + view.w - 200 * view.s);
        // 60% of reach when a new stroke starts (walk first), 75% mid-stroke (no shuffling)
        const lim = t - this.strokeAt < 150 ? 0.6 : 0.75;
        const far = Math.abs(this.tip3.x - shX) > lim * reach * S && Math.abs(goal - this.x) > 24 * S;
        if (this.state !== "walkAlongBoard" && far) this.setState("walkAlongBoard");
        // arrived (a tip that keeps moving away keeps him walking along, writing as he goes)
        else if (this.state === "walkAlongBoard" && Math.abs(this.walkTarget - this.x) < 12 * S) this.setState("write");
        else if (this.state !== "walkAlongBoard") this.setState("write");
      }
    }

    // ---- locomotion (root x) ----
    const standOff = rig.shX + reach * 0.45;
    if (this.facing === "board" || this.state === "turnToBoard") {
      if (this.state === "walkAlongBoard" || this.state === "turnToBoard")
        this.walkTarget = clamp(this.tip3.x - standOff * S, view.x0 + 140 * view.s, view.x0 + view.w - 200 * view.s);
    } else this.walkTarget = view.frontX;
    const vMax = 560 * Math.max(S, 0.6);
    const vWant = clamp((this.walkTarget - this.x) * 7, -vMax, vMax);
    this.v = follow(this.v, Math.abs(this.walkTarget - this.x) < 1.5 ? 0 : vWant, WALK_EASE, dt);
    const dx = this.v * dt;
    this.x += dx;
    this.phase += Math.abs(dx) / (this.stride * S);
    this.walkW = follow(this.walkW, Math.abs(this.v) > 25 ? 1 : 0, 20, dt);

    // ---- state target pose ----
    this.writeState(this.state, view, inp);
    const k = easeInOut((t - this.fadeT0) / FADE_MS);
    for (let i = 0; i < N; i++) this.tgt[i] = this.prev[i] + (this.st[i] - this.prev[i]) * k;

    // ---- springs ----
    const writing = (this.state === "write" || this.state === "walkAlongBoard") && tipOn;
    this.writeW = follow(this.writeW, writing ? 1 : 0, 14, dt);
    for (let i = 0; i < N; i++) {
      const kk = writing && (i === J.shWz || i === J.elWz) ? 22 : K[i];
      springStep(this.cur, this.vel, i, this.tgt[i], kk, dt);
    }

    // ---- ask the board to wait until the chalk is really at the tip ("walk first, then write") ----
    // Latches when we start turning to the board or walking to a stroke out of reach; releases
    // once the arm's chalk (forward kinematics of the CURRENT joints) is on the tip, or after
    // MAX_HOLD_MS so speech and drawing never drift far apart.
    this.fkChalk();
    const chalkOff = Math.hypot(this.chalk3.x - this.tip3.x, this.chalk3.y - this.tip3.y);
    const S2 = this.cur[J.scale];
    const shWx = this.x - rig.shX * Math.cos(this.cur[J.yaw]) * S2;
    const outOfReach = Math.abs(this.tip3.x - shWx) > 0.75 * reach * S2;
    if (tipOn && this.holdT0 < 0 && (this.state === "turnToBoard" || (this.state === "walkAlongBoard" && outOfReach))) this.holdT0 = t;
    if (this.holdT0 >= 0) {
      const facingBoard = Math.abs(this.cur[J.yaw] - BACK_YAW) < 0.1;
      const there = facingBoard && chalkOff < 14 * S2 && this.state !== "turnToBoard";
      if (!tipOn || there || t - this.holdT0 >= MAX_HOLD_MS) this.holdT0 = -1;
    }
    this.holdBoard = this.holdT0 >= 0;

    // ---- layers on top ----
    this.apply(dt, inp, view);
  }

  /** true while the board should hold the chalk (we're turning / walking to the stroke) */
  holdBoard = false;
  private holdT0 = -1;
  private tipVx = 0;
  private tipVy = 0;
  private strokeAt = -1e9;
  /** where the writing arm's chalk tip is now (three.js coords, forward kinematics) */
  chalk3 = { x: 0, y: 0 };
  private rootY3 = 900 - FLOOR;
  private rootSy = 1;

  /** 2D forward kinematics of the writing arm from the CURRENT joint values (back view). */
  private fkChalk() {
    const rig = this.ch.rig;
    const c = this.cur;
    const S = c[J.scale];
    const sx = this.x - rig.shX * Math.cos(c[J.yaw]) * S;
    const sy = this.rootY3 + rig.shY * S * this.rootSy;
    const p1 = -c[J.shWz] - Math.PI / 2;
    const p2 = p1 - c[J.elWz];
    this.chalk3.x = sx + rig.L1 * S * Math.cos(p1) + rig.L2 * S * Math.cos(p2);
    this.chalk3.y = sy + rig.L1 * S * Math.sin(p1) + rig.L2 * S * Math.sin(p2);
  }

  /** Target pose for a state, written into `st`. */
  private writeState(s: AnimState, view: AnimView, inp?: AnimInput) {
    const st = this.st;
    const t = this.t;
    const rig = this.ch.rig;
    const reach = rig.L1 + rig.L2;
    const excited = inp?.emotion === "excited";
    // relaxed base
    st[J.rootY] = 0;
    st[J.rootRz] = 0;
    st[J.rootRx] = 0;
    st[J.yaw] = this.facing === "board" ? BACK_YAW : FRONT_YAW;
    st[J.headRx] = 0;
    st[J.headRy] = 0;
    st[J.headRz] = 0;
    st[J.shWz] = -0.06;
    st[J.shWx] = 0;
    st[J.elWz] = -0.05;
    st[J.shPz] = 0.08;
    st[J.shPx] = 0;
    st[J.elPz] = 0.05;
    st[J.legL] = 0;
    st[J.legR] = 0;
    st[J.scale] = view.s;
    st[J.bend] = 1;
    st[J.lift] = 0;

    switch (s) {
      case "idle": {
        st[J.rootRz] = 1.2 * DEG * Math.sin((t / 4100) * 2 * Math.PI); // weight shift
        if (t > this.glanceAt) {
          this.glanceAt = t + 3000 + this.rnd() * 3000;
          this.glanceUntil = t + 900;
          this.glanceY = (this.rnd() * 2 - 1) * 0.35;
          this.glanceX = (this.rnd() * 2 - 1) * 0.08;
        }
        if (t < this.glanceUntil) {
          st[J.headRy] = this.glanceY;
          st[J.headRx] = this.glanceX;
        }
        break;
      }
      case "talk": {
        st[J.headRy] = 0.1; // toward the learner
        if (t > this.gestureAt) {
          this.gesture = Math.floor(this.rnd() * 3);
          this.gestureUntil = t + 800 + this.rnd() * 400;
          this.gestureAt = t + 1500 + this.rnd() * 1500;
        }
        const big = excited ? 1.35 : 1;
        if (t < this.gestureUntil) {
          if (this.gesture === 0) {
            // open palm toward the learner
            st[J.shPz] = 0.55 * big;
            st[J.shPx] = -0.55 * big;
            st[J.elPz] = 0.9;
          } else if (this.gesture === 1) {
            // point at the board
            st[J.shPz] = 1.6 * Math.min(big, 1.15);
            st[J.elPz] = 0.15;
          } else {
            // beat
            st[J.shPz] = 0.35 * big;
            st[J.elPz] = 1.4;
          }
        }
        break;
      }
      case "listen":
        st[J.rootRx] = 6 * DEG; // lean toward the learner
        st[J.headRz] = 8 * DEG;
        st[J.headRx] = 0.04 * Math.sin((t / 1600) * 2 * Math.PI); // slow nods
        break;
      case "think":
        st[J.shPz] = 2.2; // hand to chin
        st[J.elPz] = 2.3;
        st[J.headRz] = 0.12;
        st[J.headRx] = -0.1; // eyes/head up
        st[J.rootRz] = 2 * DEG * Math.sin((t / 2500) * 2 * Math.PI);
        break;
      case "point": {
        // aim the pointing arm at the highlighted element (straight-down = 0, sideways = π/2)
        const S = this.cur[J.scale];
        const sx = this.x + rig.shX * Math.cos(this.cur[J.yaw]) * S;
        const sy = 900 - FLOOR + rig.shY * S;
        const a = Math.atan2(this.focus3.x - sx, sy - this.focus3.y);
        st[J.shPz] = clamp(a, 0.3, 2.9);
        st[J.elPz] = 0.1;
        st[J.headRy] = 0.35;
        break;
      }
      case "praise":
        if (this.praiseStyle === "thumbs") {
          st[J.shPz] = 0.55;
          st[J.elPz] = 2.1;
        } else if (this.praiseStyle === "wave") {
          st[J.shPz] = 2.7;
          st[J.elPz] = 0.45;
          st[J.headRz] = 8 * DEG;
        } else {
          st[J.shPz] = 2.75;
          st[J.elPz] = 0.3;
          st[J.shWz] = -2.75;
          st[J.elWz] = -0.3;
        }
        break;
      case "turnToBoard":
      case "turnToLearner": {
        const e = t - this.stateT0;
        const u = clamp((e - TURN_DIP_MS) / TURN_MS, 0, 1);
        const dir = Math.sign(this.turnTo - this.turnFrom) || 1;
        // overshoot by 4° near the end, settling back during TURN_SETTLE_MS
        const ov = clamp((e - TURN_DIP_MS - TURN_MS * 0.65) / (TURN_MS * 0.35 + TURN_SETTLE_MS), 0, 1);
        st[J.yaw] = this.turnFrom + (this.turnTo - this.turnFrom) * easeInOut(u) + dir * 4 * DEG * Math.sin(ov * Math.PI);
        if (e < TURN_DIP_MS) st[J.rootY] = -6; // anticipation dip
        // second half of the turn to the board: the writing arm already reaches for the chalk
        if (s === "turnToBoard" && u > 0.5 && t - this.lastTipAt < 700) this.ikTargets(st);
        break;
      }
      case "write":
      case "walkAlongBoard": {
        st[J.yaw] = BACK_YAW;
        const tp = this.tip3;
        // phones: grow toward full size + tiptoe for rows the short arm can't reach
        const above = tp.y - (900 - FLOOR);
        const need = (above - 45 * view.s) / (rig.shY + reach * 0.95);
        const sc = clamp(need, view.s, 1);
        st[J.scale] = sc;
        st[J.bend] = clamp((above + reach * 0.75 * sc) / (rig.shY * sc), 0.8, 1);
        st[J.lift] = clamp(above - (rig.shY + reach * 0.8) * sc, 0, 45 * view.s);
        // head follows the chalk (seen from behind: up = negative pitch, right = negative yaw)
        const S = this.cur[J.scale];
        const headY = 900 - FLOOR + this.cur[J.lift] + this.ch.head.position.y * S * this.cur[J.bend];
        st[J.headRx] = -Math.atan2(tp.y - headY, 400);
        st[J.headRy] = -Math.atan2(tp.x - this.x, 400);
        this.ikTargets(st);
        break;
      }
    }
  }

  /** 2-bone IK for the writing arm toward the chalk tip, from the CURRENT shoulder position. */
  private ikTargets(st: Float64Array) {
    const rig = this.ch.rig;
    const S = this.cur[J.scale];
    const shX = this.x - rig.shX * Math.cos(this.cur[J.yaw]) * S;
    // shoulder height as actually rendered (incl. breathing scale and bob/hop layers, last frame)
    const shY = this.rootY3 + rig.shY * S * this.rootSy;
    const L1 = rig.L1 * S;
    const L2 = rig.L2 * S;
    // aim slightly ahead along the stroke: a k=22 critically damped spring trails a moving
    // target by ~2v/k, so leading by 2/k puts the smoothed chalk ON the moving tip
    const lead = 2 / 22;
    let dx = this.tip3.x + (this.tipVx - this.v) * lead - shX; // relative to the walking body
    let dy = this.tip3.y + this.tipVy * lead - shY;
    let d = Math.hypot(dx, dy);
    if (d > L1 + L2 - 1) {
      const k = (L1 + L2 - 1) / d;
      dx *= k;
      dy *= k;
      d = L1 + L2 - 1;
    }
    if (d < 1) d = 1;
    const a = Math.atan2(dy, dx);
    const th = Math.acos(clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1));
    const p1 = a - th;
    const ex = shX + L1 * Math.cos(p1);
    const ey = shY + L1 * Math.sin(p1);
    const p2 = Math.atan2(shY + dy - ey, shX + dx - ex);
    st[J.shWz] = -(p1 + Math.PI / 2);
    st[J.elWz] = -(p2 - p1);
    // keep the shoulder angle continuous (the IK wraps at ±π)
    while (st[J.shWz] - this.cur[J.shWz] > Math.PI) st[J.shWz] -= 2 * Math.PI;
    while (st[J.shWz] - this.cur[J.shWz] < -Math.PI) st[J.shWz] += 2 * Math.PI;
    st[J.shWx] = 0;
  }

  /** Periodic layers + limits, then write everything to the rig. */
  private apply(dt: number, inp: AnimInput, view: AnimView) {
    const ch = this.ch;
    const c = this.cur;
    const t = this.t;
    const rm = this.reducedMotion ? 0 : 1;
    const S = c[J.scale];
    const w = this.walkW;
    const e = t - this.stateT0;

    // talking: nod + small bob on stressed syllables (envelope peaks above its slow average)
    this.envSlow = follow(this.envSlow, inp.talking ? inp.amp : 0, 4, dt);
    if (inp.talking && inp.amp > this.envSlow + 0.18 && t - this.lastPeakAt > 180) {
      this.lastPeakAt = t;
      this.nod = inp.emotion === "excited" ? 1.4 : 1;
    }
    this.nod = follow(this.nod, 0, 9, dt);
    const talkW = this.state === "talk" ? 1 : 0;

    // praise layers
    const pe = t - this.praiseT0;
    const praising = this.state === "praise";
    this.waveW = follow(this.waveW, praising && this.praiseStyle === "wave" ? 1 : 0, 12, dt);
    this.bounceW = follow(this.bounceW, this.state === "talk" && inp.emotion === "excited" ? 1 : 0, 6, dt);
    let hop = 0;
    let squash = 1;
    if (praising && this.praiseStyle === "thumbs" && pe < 1000) hop = 12 * Math.abs(Math.sin((pe / 500) * Math.PI));
    if (praising && this.praiseStyle === "jump") {
      // two jumps of 420 ms, squash-and-stretch 0.9 → 1.08 → 1 on each landing
      for (let j = 0; j < 2; j++) {
        const u = (pe - j * 460) / 420;
        if (u >= 0 && u < 1) hop = 46 * Math.sin(u * Math.PI);
        const l = (pe - j * 460 - 420) / 260;
        if (l >= 0 && l < 1) squash = l < 0.3 ? 1 - 0.1 * (l / 0.3) : l < 0.65 ? 0.9 + 0.18 * ((l - 0.3) / 0.35) : 1.08 - 0.08 * ((l - 0.65) / 0.35);
      }
    }
    // turn hop
    if (this.state === "turnToBoard" || this.state === "turnToLearner") {
      const u = (e - TURN_DIP_MS) / TURN_MS;
      if (u > 0 && u < 1) hop = Math.max(hop, 28 * Math.sin(u * Math.PI));
    }
    const breath = 1 + 0.012 * (0.5 - 0.5 * Math.cos((t / 2600) * 2 * Math.PI));
    const bob =
      w * 5 * (0.5 - 0.5 * Math.cos(2 * this.phase)) + // walk: 2× the step frequency
      this.nod * talkW * 2 + // syllable peaks
      this.bounceW * 5 * Math.abs(Math.sin((t / 360) * Math.PI)); // excited talk bounce

    // root
    const sy = c[J.bend] * breath * (rm ? squash : 1);
    const sx = rm ? 1 / Math.sqrt(squash) : 1;
    this.rootY3 = 900 - FLOOR + c[J.rootY] + c[J.lift] + rm * (hop + bob) * S;
    this.rootSy = sy;
    ch.root.position.set(this.x, this.rootY3, 0);
    ch.root.scale.set(S * sx, S * sy, S * sx);
    ch.root.rotation.set(c[J.rootRx], 0, c[J.rootRz]);
    ch.body.rotation.set(0, c[J.yaw], 0);

    // head: lags the body's turn (follow-through), nods, limits
    const pitchMax = this.headPitchMax;
    const yawVel = this.vel[J.yaw];
    const hx = clamp(c[J.headRx] + this.nod * talkW * 0.09 * rm, -pitchMax, pitchMax);
    const hy = clamp(c[J.headRy] - clamp(yawVel * 0.05, -0.25, 0.25), -35 * DEG, 35 * DEG);
    ch.head.rotation.set(hx, hy, clamp(c[J.headRz], -15 * DEG, 15 * DEG));

    // legs: walk cycle by distance (feet don't slide)
    const sw = Math.sin(this.phase) * LEG_SWING * w;
    ch.legL.rotation.x = clamp(c[J.legL] + sw, -35 * DEG, 35 * DEG);
    ch.legR.rotation.x = clamp(c[J.legR] - sw, -35 * DEG, 35 * DEG);

    // arms: opposite swing while walking (the writing arm stays on the IK)
    const armSw = Math.sin(this.phase) * ARM_SWING * w;
    const wave = this.waveW * 25 * DEG * Math.sin((t / 1000) * 3 * 2 * Math.PI);
    ch.armP.sh.rotation.set(c[J.shPx] + armSw, 0, c[J.shPz]);
    ch.armP.el.rotation.z = clamp(c[J.elPz] + wave, -0.05, 2.7);
    ch.armW.sh.rotation.set(c[J.shWx] - armSw * (1 - this.writeW), 0, c[J.shWz]);
    ch.armW.el.rotation.z = clamp(c[J.elWz], -2.7, 0.05);
    if (ch.armW.chalk) ch.armW.chalk.visible = this.facing === "board" || this.state === "turnToBoard";

    // face: mouth frames from the real audio amplitude; rest face when turned away
    const facingUs = Math.abs(c[J.yaw] - BACK_YAW) > 1.2;
    const m = stepMouth(this.mouth, t, dt * 1000, inp.talking && facingUs, inp.amp, this.reducedMotion);
    const blink = stepBlink(this.blink, t, this.rnd);
    const look = this.state === "listen" ? "listen" : this.facing === "board" ? "board" : "learner";
    updateFaceFn?.(ch, m, blink, look);
    void view;
  }
}

// voxel.ts imports three; keep this module importable in tests by injecting updateFace
let updateFaceFn: ((ch: VoxelChar, m: number, blink: boolean, look: "learner" | "board" | "listen") => void) | null = null;
export function setFaceUpdater(f: typeof updateFaceFn) {
  updateFaceFn = f;
}
