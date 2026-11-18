// Headless check of the tutor animator on a real three.js rig with Blokbek's GLB measurements
// (public/models/tripo/README.md): runs the same script as /dev/tutor at 60 fps and measures
// what the eye can't: chalk-to-tip distance, state sequence, foot sliding, joint limits.
import { describe, expect, it } from "vitest";
import * as THREE from "three";
import type { VoxelChar } from "../voxel";
import { BOARD, TutorAnimator, newInput, type AnimInput } from "./animator";

function rig(): VoxelChar {
  const g = (x = 0, y = 0, z = 0, parent?: THREE.Object3D, name = "") => {
    const o = new THREE.Group();
    o.position.set(x, y, z);
    o.name = name;
    parent?.add(o);
    return o;
  };
  const root = g();
  const body = g(0, 0, 0, root);
  const head = g(0, 527.5, 0, body);
  const legL = g(-0.4, 223.3, 20.6, body);
  const legR = g(-0.4, 223.3, 20.6, body);
  const shW = g(-167.1, 481.3, 20.6, body);
  const elW = g(0, -80.1, 0, shW);
  g(0, -118.9, 0, elW, "chalkW");
  const shP = g(167.1, 481.3, 20.6, body);
  const elP = g(0, -80.1, 0, shP);
  return {
    cfg: {} as VoxelChar["cfg"], root, body, head, legL, legR,
    armW: { sh: shW, el: elW, chalk: null },
    armP: { sh: shP, el: elP, chalk: null },
    faceT: null, rig: { shX: 167.1, shY: 481.3, L1: 80.1, L2: 118.9 },
    mouth: -1, blinkOn: false, lastBlink: false, look: "", blinkAt: 0, hop: 0, dispose() {},
  };
}

const PHONE = { x0: 250, w: 1320, s: 0.75, frontX: 330 };
const DESK = { x0: 0, w: 1600, s: 1, frontX: 280 };

/** Synthetic lesson: talk 2 s, write strokes along polylines at 500 board px/s, walk, praise. */
function runScript(view: typeof PHONE, id = "blokbek") {
  const ch = rig();
  let seed = 3;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const a = new TutorAnimator(ch, id, view, { rand });
  const inp: AnimInput = newInput();
  a.prime(inp);
  const chalk = ch.armW.el.getObjectByName("chalkW")!;
  const v = new THREE.Vector3();
  const dt = 1 / 60;
  const states: string[] = [];
  const dist: number[] = [];
  let turning = 0;
  const footSlip: number[] = [];
  let t = 0;
  const step = () => {
    a.update(dt, inp, view);
    ch.root.updateMatrixWorld(true);
    if (states[states.length - 1] !== a.state) states.push(a.state);
    if (inp.tipActive && a.state === "turnToBoard") turning++;
    // only frames where ink is being laid (the board is not holding the chalk for us)
    if (inp.tipActive && !a.holdBoard && (a.state === "write" || a.state === "walkAlongBoard")) {
      chalk.getWorldPosition(v);
      dist.push(Math.hypot(v.x - a.tip3.x, v.y - a.tip3.y));
    }
    t += dt;
  };
  const strokes: [number, number][][] = [
    [[70, 50], [80, 42], [80, 105]],
    [[55, 125], [110, 125]],
    [[58, 150], [70, 140], [88, 142], [92, 156], [60, 190], [96, 190]],
    [[820, 70], [870, 70], [845, 70], [845, 150]],
  ];
  inp.talking = true;
  for (let i = 0; i < 120; i++) {
    inp.amp = Math.abs(Math.sin(i * 0.4)) * 0.8;
    step();
  }
  inp.talking = false;
  inp.amp = 0;
  for (const s of strokes) {
    let [x, y] = s[0];
    inp.tipActive = true;
    inp.tipX = x;
    inp.tipY = y;
    step();
    for (let k = 1; k < s.length; k++) {
      const [tx, ty] = s[k];
      while (Math.hypot(tx - x, ty - y) > 0.5) {
        // the board waits while the tutor turns / walks to the stroke (like the lesson engine)
        if (a.holdBoard) {
          const x0 = a.x;
          const l0 = ch.legL.rotation.x;
          step();
          if ((a as unknown as { walkW: number }).walkW > 0.9) footSlip.push(Math.abs(a.x - x0) / Math.max(1e-6, Math.abs(ch.legL.rotation.x - l0)));
          continue;
        }
        const d = Math.hypot(tx - x, ty - y);
        const st = Math.min(d, 500 * dt);
        x += ((tx - x) / d) * st;
        y += ((ty - y) / d) * st;
        inp.tipActive = true;
        inp.tipX = x;
        inp.tipY = y;
        // foot slip: while walking, the planted (lower) foot should move with the body,
        // i.e. root speed ≈ leg angular speed × hip height; measured below as a ratio
        const x0 = a.x;
        const l0 = ch.legL.rotation.x;
        step();
        const w = (a as unknown as { walkW: number }).walkW;
        if (w > 0.9) footSlip.push(Math.abs(a.x - x0) / Math.max(1e-6, Math.abs(ch.legL.rotation.x - l0)));
      }
    }
    for (let i = 0; i < 4; i++) step(); // pen up
  }
  inp.tipActive = false;
  for (let i = 0; i < 90; i++) step();
  inp.praiseCount++;
  for (let i = 0; i < 150; i++) step();
  return { a, ch, states, dist, footSlip, turning };
}

describe("tutor animator (headless, Blokbek rig)", () => {
  it("runs the lesson script through the expected states", () => {
    const { states } = runScript(PHONE);
    const seq = states.join(">");
    expect(seq).toContain("talk>turnToBoard>write");
    expect(seq).toContain("walkAlongBoard>write");
    expect(seq).toContain("turnToLearner");
    expect(seq.endsWith("praise") || seq.includes("praise>idle")).toBe(true);
  });

  for (const [name, view] of [["phone", PHONE], ["desktop", DESK]] as const) {
    it(`keeps the chalk on the moving tip while writing (${name})`, () => {
      const { dist, turning } = runScript(view);
      const s = [...dist].sort((x, y) => x - y);
      const q = (p: number) => s[Math.floor(p * (s.length - 1))];
      // report for REPORT.md
      console.log(`[anim] ${name}: chalk-to-tip px over ${s.length} frames: p50 ${q(0.5).toFixed(1)} p90 ${q(0.9).toFixed(1)} max ${q(1).toFixed(1)}; ${turning} frames held for the turn`);
      // k≈22 smoothing costs ~2v/k on stroke corners (≈20 stage px ≈ 5 CSS px on a phone)
      expect(q(0.5)).toBeLessThan(25);
      expect(q(0.9)).toBeLessThan(60);
    });
  }

  it("respects joint limits (head pitch ±12°, yaw ±35°, one-way elbows, legs ±35°)", () => {
    const { ch } = runScript(PHONE);
    const D = Math.PI / 180;
    expect(Math.abs(ch.head.rotation.x)).toBeLessThanOrEqual(12 * D + 1e-9);
    expect(Math.abs(ch.head.rotation.y)).toBeLessThanOrEqual(35 * D + 1e-9);
    expect(ch.armW.el.rotation.z).toBeLessThanOrEqual(0.05 + 1e-9);
    expect(ch.armP.el.rotation.z).toBeGreaterThanOrEqual(-0.05 - 1e-9);
    expect(Math.abs(ch.legL.rotation.x)).toBeLessThanOrEqual(35 * D + 1e-9);
  });

  it("walk cycle is driven by distance (stride constant, no foot sliding)", () => {
    const { footSlip } = runScript(DESK);
    expect(footSlip.length).toBeGreaterThan(5);
    // travel per radian of leg swing ≈ hip height (223) × scale: within ±35%
    const s = [...footSlip].sort((x, y) => x - y);
    const med = s[Math.floor(s.length / 2)];
    console.log(`[anim] walk: px of travel per radian of leg swing, median ${med.toFixed(0)} (hip 223)`);
    expect(med).toBeGreaterThan(223 * 0.65);
    expect(med).toBeLessThan(223 * 1.35);
  });

  it("never jumps: a 2 s frame gap is treated as 1/30 s", () => {
    const ch = rig();
    const a = new TutorAnimator(ch, "blokbek", DESK, { rand: () => 0.5 });
    const inp = newInput();
    a.update(1 / 60, inp, DESK);
    inp.tipActive = true;
    inp.tipX = 500;
    inp.tipY = 300;
    const y0 = ch.body.rotation.y;
    a.update(2, inp, DESK);
    expect(Math.abs(ch.body.rotation.y - y0)).toBeLessThan(0.5);
  });

  it("does not allocate per frame in steady state (heap stays flat)", () => {
    const ch = rig();
    const a = new TutorAnimator(ch, "lola", PHONE, { rand: () => 0.5 });
    const inp = newInput();
    inp.talking = true;
    const g = globalThis as unknown as { gc?: () => void };
    for (let i = 0; i < 2000; i++) {
      inp.amp = (i % 7) / 7;
      a.update(1 / 60, inp, PHONE);
    }
    g.gc?.();
    const h0 = process.memoryUsage().heapUsed;
    for (let i = 0; i < 20000; i++) {
      inp.amp = (i % 7) / 7;
      inp.tipActive = i % 400 > 200;
      inp.tipX = 100 + (i % 300);
      inp.tipY = 200;
      a.update(1 / 60, inp, PHONE);
    }
    g.gc?.();
    const grew = process.memoryUsage().heapUsed - h0;
    console.log(`[anim] heap growth over 20k frames: ${(grew / 1024).toFixed(0)} KB${g.gc ? "" : " (no --expose-gc: upper bound)"}`);
    // 20k frames × even 64 bytes would be 1.2 MB; allow GC noise
    expect(grew).toBeLessThan(g.gc ? 200_000 : 4_000_000);
  });

  it("board coords map onto the stage like the classroom board", () => {
    expect(BOARD).toEqual({ x: 420, y: 100, s: 1.104 });
  });
});

describe("tutor stands beside the writing (not in front of it)", () => {
  it("stands left of the element being written, within reach; never closer than before", () => {
    const ch = rig();
    const a = new TutorAnimator(ch, "blokbek", DESK, { rand: () => 0.5 });
    const inp: AnimInput = newInput();
    const reach = 80.1 + 118.9;
    const S = 1;
    inp.tipX = 400;
    a.tip3.x = BOARD.x + 400 * BOARD.s;
    const comfy = a.tip3.x - (167.1 + reach * 0.45) * S;
    const furthest = a.tip3.x - (167.1 + reach * 0.9) * S;
    // unknown element → the old spot
    expect(a.standGoal(inp, DESK, reach, S)).toBeCloseTo(comfy);
    // the element started a little left of the tip → the body is moved left of its left edge
    inp.tipLeft = 400 - 230 / BOARD.s;
    const g = a.standGoal(inp, DESK, reach, S);
    expect(g).toBeLessThan(comfy);
    expect(g).toBeGreaterThanOrEqual(furthest - 1e-6);
    expect(g).toBeCloseTo(BOARD.x + inp.tipLeft * BOARD.s - 70);
    // a long line (started far left) → as far left as the arm still reaches
    inp.tipLeft = 50;
    expect(a.standGoal(inp, DESK, reach, S)).toBeCloseTo(furthest);
  });
});
