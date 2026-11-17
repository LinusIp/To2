// Real 3D tutors (public/models/tripo/<id>.glb, see the README there): hinged GLBs with the SAME
// node names and conventions as the makeChar box rig (body, head, legL/legR, shW→elW→chalkW,
// shP→elP; arms hang down at rotation 0; units are stage px). We wrap one as a VoxelChar, so the
// existing turn / walk / IK-writing / applyPose / blink code drives it unchanged. Lip-sync shows
// mouth_0..3 by voice amplitude (mouth_rest when silent) and lid_L/lid_R while blinking.
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import models from "@/config/characterModels.json";
import { PLAYABLE } from "@/config/characters";
import type { VoxelCfg } from "@/config/characters";
import type { VoxelChar } from "./voxel";

const AVAILABLE = new Set<string>(models as string[]);
const PLAYABLE_IDS = new Set<string>(PLAYABLE.map((c) => c.id));
/**
 * Models that exist but must not be used yet. diyorbek.glb currently shows a green-hooded boy
 * with headphones (Ziyo's look), not Diyorbek's lab coat + glasses from his card, so he uses
 * the makeChar voxel rig until the model is re-exported. Remove the id here once it's fixed.
 */
const DISABLED = new Set<string>(["diyorbek"]);

/** Is there a real 3D model for this (playable) tutor? Listed at build time from public/models/tripo/. */
export function hasGlb(id: string) {
  return PLAYABLE_IDS.has(id) && !DISABLED.has(id) && AVAILABLE.has(`${id}.glb`);
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

const REQUIRED = ["tutor", "body", "head", "legL", "legR", "shW", "elW", "chalkW", "shP", "elP", "mouth_rest", "mouth_0", "mouth_1", "mouth_2", "mouth_3", "lid_L", "lid_R"];

/** Load (and cache) a tutor model. Rejects if the hinge/face nodes are missing (→ makeChar fallback). */
export function loadGlb(id: string): Promise<THREE.Group> {
  let p = cache.get(id);
  if (!p) {
    p = getLoader()
      .loadAsync(`/models/tripo/${id}.glb`)
      .then((g) => {
        const missing = REQUIRED.filter((n) => !g.scene.getObjectByName(n));
        if (missing.length) throw new Error(`${id}.glb is missing nodes: ${missing.join(", ")}`);
        g.scene.traverse((o) => {
          const mesh = o as THREE.Mesh;
          if (!mesh.isMesh) return;
          const mats = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) as THREE.MeshStandardMaterial[];
          for (const m of mats) {
            if ("roughness" in m) {
              m.roughness = 0.85;
              m.metalness = 0;
            }
            if (m.map) {
              m.map.colorSpace = THREE.SRGBColorSpace;
              // face frames are pixel art: keep them crisp
              if (/^(mouth_|lid_)/.test(o.name)) {
                m.map.magFilter = THREE.NearestFilter;
                m.map.needsUpdate = true;
              }
            }
          }
          mesh.frustumCulled = false; // hinged parts move a lot; never pop out
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

/** Wrap a loaded model as a VoxelChar (each call gets its own clone, added to `scene`). */
export function makeGlbChar(model: THREE.Group, cfg: VoxelCfg, scene: THREE.Scene): VoxelChar {
  const inst = model.clone(true);
  const root = inst.getObjectByName("tutor") as THREE.Group | undefined;
  if (!root) throw new Error("missing node tutor");
  root.removeFromParent(); // the GLB's own scene wrapper isn't needed
  const g = (n: string) => {
    const o = root.getObjectByName(n);
    if (!o) throw new Error(`missing node ${n}`);
    return o as THREE.Group;
  };
  const body = g("body");
  const shW = g("shW");
  const elW = g("elW");
  const chalkW = g("chalkW");

  // chalk piece in the writing hand, at the chalk-tip node
  const chalkGeo = new THREE.CylinderGeometry(6, 6, 36, 8);
  const chalkMat = new THREE.MeshLambertMaterial({ color: new THREE.Color("#f4f1e8") });
  const chalk = new THREE.Mesh(chalkGeo, chalkMat);
  chalk.position.copy(chalkW.position);
  chalk.position.y += 14;
  chalk.position.z += 12;
  chalk.visible = false;
  elW.add(chalk);

  const rest = g("mouth_rest");
  const mouths = [g("mouth_0"), g("mouth_1"), g("mouth_2"), g("mouth_3")];
  const lids = [g("lid_L"), g("lid_R")];
  rest.visible = true;
  mouths.forEach((m) => (m.visible = false));
  lids.forEach((l) => (l.visible = false));

  scene.add(root);
  return {
    cfg,
    root,
    body,
    head: g("head"),
    legL: g("legL"),
    legR: g("legR"),
    armP: { sh: g("shP"), el: g("elP"), chalk: null },
    armW: { sh: shW, el: elW, chalk },
    faceT: null,
    faceSwap: { rest, mouths, lids },
    // hinge positions come from each model (README: don't hard-code makeChar's)
    rig: { shX: Math.abs(shW.position.x), shY: shW.position.y, L1: elW.position.length(), L2: chalkW.position.length() },
    mouth: -2, // force the first updateFace
    blinkOn: false,
    lastBlink: false,
    look: "",
    blinkAt: 0,
    hop: 0,
    dispose() {
      scene.remove(root);
      chalkGeo.dispose();
      chalkMat.dispose();
      // the loaded model's geometry/textures stay cached for the next lesson
    },
  };
}
