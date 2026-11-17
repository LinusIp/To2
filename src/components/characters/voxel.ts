// Voxel tutor rig — ported from docs/prototypes/board-handwriting.html `makeChar(cfg)`.
// One rig for all 8 tutors: ~20 boxes with 16×16 / 32×48 pixel canvas textures.
// Used live in the lesson stage (TutorStage) and offscreen for UI portraits (portraits.ts).
// three.js r180: colours are sRGB-managed automatically; light intensities are ×π vs the r128 prototype.
import * as THREE from "three";
import type { VoxelCfg } from "@/config/characters";

const PI = Math.PI;

type G2D = CanvasRenderingContext2D;
const px = (g: G2D, col: string, x: number, y: number, w = 1, h = 1) => {
  g.fillStyle = col;
  g.fillRect(x, y, w, h);
};

function canvasTex(w: number, h: number, paint: (g: G2D) => void): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d")!;
  g.imageSmoothingEnabled = false;
  paint(g);
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.colorSpace = THREE.SRGBColorSpace;
  t.userData = { g };
  return t;
}

export type Look = "learner" | "board" | "listen";

/** Paint the 16×16 face: hair fringe, brows, eyes (blink/look), mouth 0–3. */
export function paintFace(g: G2D, f: VoxelCfg, mouth: number, blink: boolean, look: Look) {
  const H = f.hair;
  px(g, f.skin, 0, 0, 16, 16);
  if (f.eyes === "glow") {
    const hood = f.hood ?? H;
    px(g, "#15111d", 0, 0, 16, 16);
    px(g, hood, 0, 0, 16, 3);
    px(g, hood, 0, 0, 2, 16);
    px(g, hood, 14, 0, 2, 16);
    px(g, "#b26bff", 4, 7, 3, 2);
    px(g, "#b26bff", 9, 7, 3, 2);
    px(g, "#e3c7ff", 5, 7, 1, 1);
    px(g, "#e3c7ff", 10, 7, 1, 1);
    return;
  }
  const st = f.hairStyle;
  if (st === "messy" || st === "volume") {
    px(g, H, 0, 0, 16, 3);
    px(g, H, 0, 3, 5, 2);
    px(g, H, 7, 3, 3, 1);
    px(g, H, 11, 3, 5, 2);
    px(g, H, 0, 5, 1, 4);
    px(g, H, 15, 5, 1, 4);
  }
  if (st === "slick") {
    px(g, H, 0, 0, 16, 4);
    px(g, H, 0, 4, 1, 3);
    px(g, H, 15, 4, 1, 3);
  }
  if (st === "long") {
    px(g, H, 0, 0, 16, 3);
    px(g, H, 0, 3, 7, 2);
    px(g, H, 10, 3, 6, 1);
    px(g, H, 0, 3, 2, 13);
    px(g, H, 14, 3, 2, 13);
  }
  if (st === "cap") {
    px(g, f.cap ?? H, 0, 0, 16, 4);
    px(g, "#0f1013", 0, 4, 16, 1);
    px(g, H, 0, 5, 1, 3);
    px(g, H, 15, 5, 1, 3);
  }
  if (st === "hood") {
    const hood = f.hood ?? H;
    px(g, hood, 0, 0, 16, 3);
    px(g, hood, 0, 0, 2, 16);
    px(g, hood, 14, 0, 2, 16);
    px(g, H, 2, 3, 12, 1);
    px(g, H, 2, 4, 3, 1);
  }
  if (f.eyes !== "sun") {
    px(g, H, 3, 5, 3, 1);
    px(g, H, 10, 5 - (look === "listen" ? 1 : 0), 3, 1);
  }
  if (f.eyes === "sun") {
    px(g, "#0e0e10", 2, 6, 12, 3);
    px(g, "#4a4f5a", 3, 6, 2, 1);
    px(g, "#4a4f5a", 10, 6, 2, 1);
  } else if (blink) {
    px(g, "#7a4c2e", 3, 7, 3, 1);
    px(g, "#7a4c2e", 10, 7, 3, 1);
  } else {
    px(g, "#ffffff", 3, 6, 3, 3);
    px(g, "#ffffff", 10, 6, 3, 3);
    const o = look === "board" ? 1 : 0;
    px(g, "#1d1a1a", 4 + o, 6, 2, 3);
    px(g, "#1d1a1a", 11 + o, 6, 2, 3);
    px(g, "#ffffff", 4 + o, 6, 1, 1);
    px(g, "#ffffff", 11 + o, 6, 1, 1);
    if (f.female) {
      px(g, "#1d1a1a", 2, 6, 1, 1);
      px(g, "#1d1a1a", 13, 6, 1, 1);
    }
  }
  if (f.eyes === "glasses") {
    const k = "#141414";
    px(g, k, 2, 5, 5, 1);
    px(g, k, 2, 9, 5, 1);
    px(g, k, 2, 5, 1, 5);
    px(g, k, 6, 5, 1, 5);
    px(g, k, 9, 5, 5, 1);
    px(g, k, 9, 9, 5, 1);
    px(g, k, 9, 5, 1, 5);
    px(g, k, 13, 5, 1, 5);
    px(g, k, 7, 6, 2, 1);
  }
  px(g, "rgba(0,0,0,.18)", 7, 9, 2, 2);
  const L = f.female ? "#9b3048" : "#5a2318";
  if (mouth <= 0) {
    px(g, L, 5, 12, 6, 1);
    px(g, L, 4, 11, 1, 1);
    px(g, L, 11, 11, 1, 1);
  } else {
    const h = [0, 2, 3, 3][mouth];
    const w = [0, 5, 6, 8][mouth];
    const x = 8 - w / 2;
    px(g, L, x, 11, w, h);
    px(g, "#ffffff", x, 11, w, 1);
    if (mouth > 1) px(g, "#c0504a", x + 1, 11 + h - 1, w - 2, 1);
  }
}

export interface Arm {
  sh: THREE.Group;
  el: THREE.Group;
  chalk: THREE.Mesh | null;
}

export interface FaceSwap {
  rest: THREE.Object3D;
  mouths: THREE.Object3D[];
  lids: THREE.Object3D[];
}

export interface Rig {
  /** |x| of the writing shoulder (at -shX facing the learner, +shX with the back turned) */
  shX: number;
  /** shoulder height above the feet */
  shY: number;
  /** shoulder → elbow, elbow → chalk tip */
  L1: number;
  L2: number;
}

export interface VoxelChar {
  cfg: VoxelCfg;
  root: THREE.Group;
  body: THREE.Group;
  head: THREE.Group;
  legL: THREE.Group;
  legR: THREE.Group;
  /** left (screen-left when facing the learner) arm: points / waves */
  armP: Arm;
  /** writing arm, holds the chalk */
  armW: Arm;
  /** painted 16×16 face (box rig); null for the real 3D models, which swap mouth/lid meshes */
  faceT: THREE.CanvasTexture | null;
  /** real 3D models (public/models/tripo): mouth frames + eyelids to show/hide */
  faceSwap?: FaceSwap;
  /** writing-arm measurements for the IK (stage px, at scale 1) */
  rig: Rig;
  mouth: number;
  blinkOn: boolean;
  lastBlink: boolean;
  look: Look | "";
  blinkAt: number;
  hop: number;
  dispose(): void;
}

/** Build a voxel tutor and add it to `scene`. Units: 1 ≈ 1 px of the 1600×900 stage at scale 1. */
export function makeChar(cfg: VoxelCfg, scene: THREE.Scene, silhouette = false): VoxelChar {
  const mats: THREE.Material[] = [];
  const texs: THREE.Texture[] = [];
  const geos: THREE.BufferGeometry[] = [];
  const SIL = new THREE.MeshLambertMaterial({ color: new THREE.Color("#2b2530") });
  mats.push(SIL);
  const M = (c: string) => {
    if (silhouette) return SIL;
    const m = new THREE.MeshLambertMaterial({ color: new THREE.Color(c) });
    mats.push(m);
    return m;
  };
  const MT = (t: THREE.Texture) => {
    if (silhouette) return SIL;
    texs.push(t);
    const m = new THREE.MeshLambertMaterial({ map: t });
    mats.push(m);
    return m;
  };
  const box = (w: number, h: number, d: number, m: THREE.Material | THREE.Material[], x: number, y: number, z: number, parent: THREE.Object3D) => {
    const g = new THREE.BoxGeometry(w, h, d);
    geos.push(g);
    const b = new THREE.Mesh(g, m);
    b.position.set(x, y, z);
    parent.add(b);
    return b;
  };

  const root = new THREE.Group();
  const lean = new THREE.Group();
  const body = new THREE.Group();
  lean.rotation.x = 0.12;
  root.add(lean);
  lean.add(body);
  scene.add(root);

  const legL = new THREE.Group();
  legL.position.set(-38, 232, 0);
  body.add(legL);
  const legR = new THREE.Group();
  legR.position.set(38, 232, 0);
  body.add(legR);
  (
    [
      [legL, cfg.pants[0]],
      [legR, cfg.pants[1]],
    ] as const
  ).forEach(([lg, col]) => {
    box(72, 204, 72, M(col), 0, -102, 0, lg);
    box(78, 28, 90, M(cfg.shoes), 0, -216, 6, lg);
    box(80, 8, 92, M(cfg.sole), 0, -228, 6, lg);
  });

  const tp = cfg.top;
  const front = canvasTex(32, 48, (g) => {
    px(g, tp.c, 0, 0, 32, 48);
    if (tp.kind === "hoodie") {
      px(g, "rgba(255,255,255,.06)", 0, 0, 32, 3);
      px(g, "#e8e6e0", 12, 2, 1, 9);
      px(g, "#e8e6e0", 19, 2, 1, 9);
      px(g, "rgba(0,0,0,.18)", 6, 34, 20, 6);
    }
    if (tp.kind === "jacket") {
      px(g, tp.collar ?? tp.side, 10, 0, 12, 6);
      px(g, "rgba(0,0,0,.35)", 15, 0, 2, 48);
      px(g, "rgba(0,0,0,.18)", 3, 30, 7, 2);
      px(g, "rgba(0,0,0,.18)", 22, 30, 7, 2);
    }
    if (tp.kind === "vest") {
      px(g, tp.vest ?? tp.c, 0, 0, 10, 48);
      px(g, tp.vest ?? tp.c, 22, 0, 10, 48);
      px(g, "#ffffff", 10, 0, 12, 48);
      px(g, "rgba(0,0,0,.12)", 15, 6, 2, 30);
    }
    if (tp.kind === "labcoat") {
      px(g, "#2b2d33", 12, 0, 8, 48);
      px(g, "#d6d4cc", 10, 0, 2, 20);
      px(g, "#d6d4cc", 20, 0, 2, 20);
      px(g, "#3b6fd9", 23, 10, 3, 4);
    }
    if (tp.print) {
      px(g, "#efece4", 9, 20, 1, 6);
      px(g, "#efece4", 9, 20, 2, 1);
      px(g, "#efece4", 9, 25, 2, 1);
      g.fillStyle = "#efece4";
      g.font = "bold 8px monospace";
      g.textBaseline = "top";
      g.fillText(tp.print, 12, 19);
    }
  });
  const back = canvasTex(32, 48, (g) => {
    px(g, tp.c, 0, 0, 32, 48);
    if (tp.kind === "hoodie") {
      px(g, "rgba(255,255,255,.06)", 4, 0, 24, 14);
      px(g, "rgba(0,0,0,.2)", 4, 0, 24, 2);
    }
    if (tp.kind === "vest") px(g, tp.vest ?? tp.c, 0, 0, 32, 48);
  });
  const side = M(tp.side);
  const torsoGeo = new THREE.BoxGeometry(184, 238, 104);
  geos.push(torsoGeo);
  const torso = new THREE.Mesh(torsoGeo, [side, side, M(tp.c), M(tp.c), MT(front), MT(back)]);
  torso.position.set(0, 350, 0);
  body.add(torso);
  if (tp.hem) {
    const hemT = canvasTex(24, 2, (g) => {
      const c = ["#e0873a", "#f2c94c", "#a8411a", "#e0873a"];
      for (let i = 0; i < 24; i++) px(g, c[i % 4], i, 0, 1, 2);
    });
    box(188, 24, 108, MT(hemT), 0, 243, 0, body);
  }
  if (cfg.acc.includes("labcoat")) {
    box(92, 90, 108, M(tp.c), -47, 200, 0, body);
    box(92, 90, 108, M(tp.c), 47, 200, 0, body);
  }
  if (cfg.acc.includes("neckphones")) {
    box(162, 16, 112, M("#1aa3b8"), 0, 478, 0, body);
    box(24, 36, 40, M("#0e6f80"), -88, 488, 0, body);
    box(24, 36, 40, M("#0e6f80"), 88, 488, 0, body);
  }

  // head
  const head = new THREE.Group();
  head.position.set(0, 548, 0);
  body.add(head);
  const faceT = canvasTex(16, 16, (g) => paintFace(g, cfg, 0, false, "learner"));
  const H = cfg.hair;
  const st = cfg.hairStyle;
  const hood = cfg.hood ?? H;
  const sideT = canvasTex(16, 16, (g) => {
    if (st === "hood" || cfg.eyes === "glow") {
      px(g, hood, 0, 0, 16, 16);
      return;
    }
    px(g, cfg.skin, 0, 0, 16, 16);
    if (st === "long") {
      px(g, H, 0, 0, 16, 16);
      px(g, cfg.skin, 7, 6, 3, 4);
      return;
    }
    if (st === "cap") {
      px(g, cfg.cap ?? H, 0, 0, 16, 4);
      px(g, H, 0, 4, 8, 3);
    } else {
      px(g, H, 0, 0, 16, 5);
      px(g, H, 0, 5, 9, 3);
      px(g, H, 0, 8, 4, 4);
    }
    px(g, "rgba(0,0,0,.12)", 7, 8, 1, 2);
  });
  const backT = canvasTex(16, 16, (g) => {
    px(g, st === "hood" ? hood : st === "cap" ? (cfg.cap ?? H) : H, 0, 0, 16, 16);
    if (st !== "hood" && st !== "long") {
      px(g, H, 0, 4, 16, 10);
      px(g, cfg.skin, 3, 15, 10, 1);
    }
    px(g, "rgba(255,255,255,.06)", 3, 3, 4, 1);
  });
  const topT = canvasTex(16, 16, (g) => {
    px(g, st === "hood" ? hood : st === "cap" ? (cfg.cap ?? H) : H, 0, 0, 16, 16);
    px(g, "rgba(255,255,255,.07)", 3, 3, 4, 2);
  });
  const sideM = MT(sideT);
  const headGeo = new THREE.BoxGeometry(150, 150, 150);
  geos.push(headGeo);
  head.add(new THREE.Mesh(headGeo, [sideM, sideM, MT(topT), M(cfg.skin), MT(faceT), MT(backT)]));
  const hairM = M(H);
  const hairM2 = M(st === "volume" ? "#b4592b" : "#3a2719");
  if (st === "messy") {
    box(52, 30, 60, hairM, -46, 84, 30, head);
    box(58, 40, 70, hairM2, 6, 92, 0, head);
    box(50, 28, 60, hairM, 50, 84, -20, head);
    box(48, 26, 50, hairM2, -30, 86, -46, head);
  }
  if (st === "volume") {
    box(160, 40, 160, hairM, 0, 92, -4, head);
    box(60, 36, 70, hairM2, -40, 118, 20, head);
    box(70, 30, 60, hairM, 36, 116, -30, head);
    box(30, 60, 150, hairM, -82, 40, -4, head);
    box(30, 60, 150, hairM, 82, 40, -4, head);
  }
  if (st === "slick") box(156, 18, 156, hairM, 0, 82, -2, head);
  if (st === "long") box(156, 16, 156, hairM, 0, 82, 0, head);
  if (cfg.acc.includes("longhair")) {
    box(158, 160, 26, hairM, 0, -40, -84, head);
    box(16, 130, 60, hairM, -82, -24, -40, head);
    box(16, 130, 60, hairM, 82, -24, -40, head);
  }
  if (cfg.acc.includes("flower")) {
    box(22, 22, 22, M("#ff8fb1"), -74, 58, 52, head);
    box(10, 10, 24, M("#ffd85c"), -74, 58, 54, head);
  }
  if (cfg.acc.includes("hoodup")) box(168, 168, 150, M(hood), 0, 6, -16, head);
  if (cfg.acc.includes("headphones")) {
    box(170, 14, 34, M("#2a2d33"), 0, 88, 0, head);
    box(24, 50, 50, M("#1d1f24"), -88, 6, 0, head);
    box(24, 50, 50, M("#1d1f24"), 88, 6, 0, head);
  }
  if (cfg.acc.includes("cap")) {
    box(158, 34, 158, M(cfg.cap ?? H), 0, 66, 0, head);
    box(130, 10, 74, M(cfg.cap ?? H), 0, 52, 104, head);
  }
  if (cfg.acc.includes("glow") && !silhouette) {
    const gm = new THREE.MeshBasicMaterial({ color: 0xc58bff });
    mats.push(gm);
    box(26, 12, 4, gm, -28, -6, 77, head);
    box(26, 12, 4, gm, 28, -6, 77, head);
  }
  if (silhouette) {
    const q = new THREE.MeshBasicMaterial({ color: 0x6b6375 });
    mats.push(q);
    box(14, 14, 4, q, -28, 0, 77, head);
    box(14, 14, 4, q, 28, 0, 77, head);
  }

  const sleeve = tp.kind === "vest" ? "#f1ede6" : tp.c;
  const hand = cfg.skin === "#15111d" ? "#2a2238" : cfg.skin;
  function arm(xs: number, chalk: boolean): Arm {
    const sh = new THREE.Group();
    sh.position.set(xs, 455, 0);
    body.add(sh);
    box(54, 150, 64, M(sleeve), 0, -70, 0, sh);
    const el = new THREE.Group();
    el.position.set(0, -145, 0);
    sh.add(el);
    box(50, 112, 60, M(sleeve), 0, -52, 0, el);
    if (tp.cuff) box(52, 16, 62, M(tp.cuff), 0, -96, 0, el);
    box(50, 44, 56, M(hand), 0, -128, 0, el);
    let ch: THREE.Mesh | null = null;
    if (chalk) {
      const cg = new THREE.CylinderGeometry(6, 6, 36, 8);
      geos.push(cg);
      ch = new THREE.Mesh(cg, M("#f4f1e8"));
      ch.position.set(0, -158, 12);
      el.add(ch);
    }
    return { sh, el, chalk: ch };
  }

  return {
    cfg,
    root,
    body,
    head,
    legL,
    legR,
    armP: arm(117, false),
    armW: arm(-117, !silhouette),
    faceT,
    rig: { shX: 117, shY: 455, L1: 145, L2: 160 },
    mouth: -1,
    blinkOn: false,
    lastBlink: false,
    look: "",
    blinkAt: 0,
    hop: 0,
    dispose() {
      scene.remove(root);
      geos.forEach((g) => g.dispose());
      mats.forEach((m) => m.dispose());
      texs.forEach((t) => t.dispose());
      faceT.dispose();
    },
  };
}

/**
 * Update the face only when something changed. mouth: -1 = not talking (rest face), 0–3 = talking
 * frames (closed, small, open, wide). Box rig: repaint the 16×16 texture. 3D models: show one mouth
 * mesh (mouth_rest when silent) and the eyelids while blinking; `look` isn't supported there.
 */
export function updateFace(ch: VoxelChar, mouth: number, blink: boolean, look: Look) {
  if (mouth === ch.mouth && blink === ch.lastBlink && look === ch.look) return;
  ch.mouth = mouth;
  ch.lastBlink = blink;
  ch.look = look;
  if (ch.faceSwap) {
    const { rest, mouths, lids } = ch.faceSwap;
    const m = Math.min(3, Math.round(mouth));
    rest.visible = m < 0;
    mouths.forEach((o, i) => (o.visible = i === m));
    lids.forEach((o) => (o.visible = blink));
    return;
  }
  if (!ch.faceT) return;
  paintFace((ch.faceT.userData as { g: G2D }).g, ch.cfg, Math.max(0, mouth), blink, look);
  ch.faceT.needsUpdate = true;
}

/** Random blink every 2.5–5 s (120 ms). Returns whether the eyes are closed now. */
export function blinkState(ch: VoxelChar, now: number): boolean {
  // first call: schedule the first blink (blinkAt starts at 0, which used to mean "never")
  if (!ch.blinkAt) ch.blinkAt = now + 1200 + Math.random() * 2500;
  if (ch.blinkOn) {
    if (now > ch.blinkAt + 120) {
      ch.blinkOn = false;
      ch.blinkAt = now + 2500 + Math.random() * 2500;
    }
  } else if (now >= ch.blinkAt) ch.blinkOn = true;
  return ch.blinkOn;
}

/** Warm classroom lighting (key + cool fill + rim). */
export function addLights(scene: THREE.Scene, studio = false) {
  scene.add(new THREE.HemisphereLight(studio ? 0xfff4e6 : 0xfff1dc, studio ? 0x8a7ab0 : 0x6a5440, (studio ? 1.0 : 0.95) * PI));
  const key = new THREE.DirectionalLight(studio ? 0xfff0dc : 0xffe0b5, (studio ? 1.35 : 1.25) * PI);
  key.position.set(-700, 900, studio ? 1200 : 900);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0x9fc3ff, (studio ? 0.45 : 0.32) * PI);
  fill.position.set(900, 200, 600);
  scene.add(fill);
  const rim = new THREE.DirectionalLight(0xffffff, (studio ? 0.6 : 0.35) * PI);
  rim.position.set(studio ? 500 : 300, 600, -900);
  scene.add(rim);
}

export type Pose = "idle" | "wave" | "point" | "thumbs" | "cheer" | "sig" | "think1" | "think2";

/** Static poses for portraits (from the mobile prototype). */
export function applyPose(ch: VoxelChar, p: Pose) {
  const { armP, armW, body } = ch;
  body.rotation.y = p === "cheer" ? -0.15 : -0.32;
  armP.sh.rotation.z = 0.08;
  armP.el.rotation.z = 0.05;
  armW.sh.rotation.z = -0.06;
  armW.el.rotation.z = -0.05;
  if (p === "wave" || p === "sig") {
    armP.sh.rotation.z = 2.7;
    armP.el.rotation.z = 0.45;
  }
  if (p === "point") {
    armP.sh.rotation.z = 1.55;
    armP.el.rotation.z = 0.12;
  }
  if (p === "thumbs") {
    armP.sh.rotation.z = 0.55;
    armP.el.rotation.z = 2.1;
  }
  if (p === "cheer") {
    armP.sh.rotation.z = 2.75;
    armP.el.rotation.z = 0.3;
    armW.sh.rotation.z = -2.75;
    armW.el.rotation.z = -0.3;
  }
  if (armW.chalk) armW.chalk.visible = false;
  const happy = p === "wave" || p === "cheer" || p === "sig";
  ch.mouth = -1;
  // the 3D models' rest face already smiles (as on the character sheet)
  updateFace(ch, ch.faceSwap ? -1 : happy ? 2 : 0, false, "learner");
}
