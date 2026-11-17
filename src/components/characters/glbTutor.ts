// Real 3D tutors from Tripo → Blender (public/models/tripo/<id>.glb, see the README there).
// One fused mesh per character, NO skeleton → we animate the whole figure (per the README):
// breathing, talk-bob from the voice amplitude, hop-turn to the board, lean toward the chalk tip,
// waddle while walking, lean in while listening, sway while thinking, squash-and-stretch on a win.
// Because there is no arm, a thin pointer stick goes from the shoulder to the chalk tip while writing.
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import models from "@/config/characterModels.json";

const AVAILABLE = new Set<string>(models as string[]);

/** Is there a real 3D model for this tutor? (listed at build time from public/models/tripo/) */
export function hasGlb(id: string) {
  return AVAILABLE.has(`${id}.glb`);
}

let loader: GLTFLoader | null = null;
const cache = new Map<string, Promise<THREE.Group>>();

function getLoader() {
  if (!loader) {
    const draco = new DRACOLoader().setDecoderPath("/draco/");
    loader = new GLTFLoader().setDRACOLoader(draco);
  }
  return loader;
}

/** Load (and cache) a tutor model. Model units: metres, ~0.98 tall, feet at y=0, facing +Z. */
export function loadGlb(id: string): Promise<THREE.Group> {
  let p = cache.get(id);
  if (!p) {
    p = getLoader()
      .loadAsync(`/models/tripo/${id}.glb`)
      .then((g) => {
        g.scene.traverse((o) => {
          const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
          if (m && "roughness" in m) {
            m.roughness = 0.85;
            m.metalness = 0;
            if (m.map) m.map.colorSpace = THREE.SRGBColorSpace;
          }
        });
        return g.scene;
      });
    p.catch(() => cache.delete(id));
    cache.set(id, p);
  }
  return p;
}

/** Warm the cache (e.g. right after the learner picks a tutor). */
export function preloadGlb(id: string) {
  if (hasGlb(id)) void loadGlb(id).catch(() => {});
}

/** Model height in stage units, matched to the old voxel rig (~650 px tall at scale 1). */
const HEIGHT = 650;

export interface GlbTutor {
  root: THREE.Group;
  /** the scaled model, rotated/squashed for the animation */
  body: THREE.Group;
  stick: THREE.Mesh;
  dispose(): void;
}

export function makeGlbTutor(model: THREE.Group, scene: THREE.Scene): GlbTutor {
  const root = new THREE.Group();
  const body = new THREE.Group();
  const inst = model.clone(true);
  const box = new THREE.Box3().setFromObject(inst);
  const h = Math.max(0.01, box.max.y - box.min.y);
  inst.scale.setScalar(HEIGHT / h);
  inst.position.y = -box.min.y * (HEIGHT / h);
  body.add(inst);
  root.add(body);
  // pointer stick (wood) from the shoulder to the chalk tip while writing
  const stickGeo = new THREE.CylinderGeometry(4, 4, 1, 8);
  stickGeo.translate(0, 0.5, 0); // pivot at one end
  const stick = new THREE.Mesh(stickGeo, new THREE.MeshLambertMaterial({ color: new THREE.Color("#a0662e") }));
  stick.visible = false;
  scene.add(root);
  scene.add(stick);
  return {
    root,
    body,
    stick,
    dispose() {
      scene.remove(root);
      scene.remove(stick);
      stickGeo.dispose();
      (stick.material as THREE.Material).dispose();
      // the loaded model's geometry/textures stay cached for the next lesson
    },
  };
}

export interface GlbFrame {
  now: number;
  x: number; // stage x of the feet
  floorY: number; // three.js y of the floor
  yaw: number;
  mode: "front" | "back" | "turning";
  /** progress of the current turn 0..1 (for the mid-turn hop) */
  turnK: number;
  s: number; // view scale (phones: 0.75)
  sy: number; // bend for low rows
  moving: boolean;
  talking: boolean;
  amp: number; // 0..1 voice amplitude
  listening: boolean;
  thinking: boolean;
  /** time when the celebrate hop ends (0 = none) */
  cheerUntil: number;
  writing: boolean;
  /** chalk tip in three.js coords (y up) */
  tip: { x: number; y: number } | null;
}

/** Apply one frame of whole-figure animation (README table in public/models/tripo/). */
export function poseGlb(t: GlbTutor, f: GlbFrame) {
  const { body, root, stick } = t;
  const S = f.s;
  let y = f.floorY;
  let sy = f.sy;
  let sx = 1;
  let rz = 0;
  let rx = 0;

  // idle: slow breathing + tiny bob (2.4 s loop)
  const breath = Math.sin((f.now / 2400) * Math.PI * 2);
  sy *= 1 + 0.012 * (0.5 + 0.5 * breath);
  y += breath * 1.5 * S;

  // talking: bob in time with the voice
  if (f.talking && !f.writing) {
    y += f.amp * 4 * S;
    rz += Math.sin(f.now / 140) * 0.026 * f.amp;
  }
  // walking along the board: waddle at 4 Hz
  if (f.moving) {
    rz += Math.sin((f.now / 1000) * Math.PI * 2 * 4) * 0.087;
    y += Math.abs(Math.sin((f.now / 1000) * Math.PI * 4)) * 4 * S;
  }
  // writing: lean slightly toward the chalk tip
  if (f.writing && f.tip) rz += Math.max(-0.07, Math.min(0.07, (f.x - f.tip.x) / 2000));
  // turning: small hop mid-turn
  if (f.mode === "turning") y += Math.sin(f.turnK * Math.PI) * 6 * S;
  // listening: lean toward the learner and hold
  if (f.listening) rx = -0.105;
  // thinking: slow sway
  if (f.thinking) rz += Math.sin((f.now / 1600) * Math.PI * 2) * 0.052;
  // celebrate: squash-and-stretch hop
  if (f.cheerUntil > f.now) {
    const k = 1 - (f.cheerUntil - f.now) / 900; // 0 → 1
    if (k >= 0) {
      const s = k < 0.25 ? 1 - 0.32 * (k / 0.25) : k < 0.6 ? 0.92 + 0.16 * ((k - 0.25) / 0.35) : 1.08 - 0.08 * ((k - 0.6) / 0.4);
      sy *= s;
      sx = 1 / Math.sqrt(Math.max(0.5, s));
      y += Math.sin(Math.min(1, k / 0.8) * Math.PI) * 40 * S;
    }
  }

  root.position.set(f.x, y, 0);
  root.rotation.set(0, 0, 0);
  body.rotation.set(rx, f.yaw, rz);
  body.scale.set(S * sx, S * sy, S * sx);

  // pointer stick from the shoulder to the chalk tip
  if (f.writing && f.tip && f.mode === "back") {
    const sh = new THREE.Vector3(f.x + 70 * S, y + HEIGHT * 0.72 * S * f.sy, 30);
    const tip = new THREE.Vector3(f.tip.x, f.tip.y, 30);
    const d = tip.clone().sub(sh);
    stick.position.copy(sh);
    stick.scale.set(S, d.length(), S);
    stick.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
    stick.visible = true;
  } else stick.visible = false;
}
