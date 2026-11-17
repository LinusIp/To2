// Pre-rendered tutor portraits for the UI (cards, avatars, splash, success).
// Rendered once in the browser with an offscreen three.js renderer, cached in memory + localStorage.
// Blender renders win: public/characters/<id>_<pose>_<frame>.png listed in characterRenders.json.
import * as THREE from "three";
import { getCharacter } from "@/config/characters";
import { addLights, applyPose, makeChar, type Pose } from "./voxel";

export type Frame = "full" | "half" | "face";

const FRAMES: Record<Frame, { w: number; h: number; fov: number; pos: [number, number, number]; at: [number, number, number] }> = {
  full: { w: 300, h: 380, fov: 24, pos: [-420, 470, 1950], at: [0, 345, 0] },
  half: { w: 300, h: 300, fov: 22, pos: [-330, 600, 1500], at: [0, 470, 0] },
  face: { w: 120, h: 120, fov: 12, pos: [-150, 600, 1050], at: [0, 548, 0] },
};

const VERSION = "v1";
const mem = new Map<string, string>();
let renderer: THREE.WebGLRenderer | null = null;
let failed = false;

function getRenderer(): THREE.WebGLRenderer | null {
  if (renderer || failed) return renderer;
  try {
    const c = document.createElement("canvas");
    renderer = new THREE.WebGLRenderer({ canvas: c, alpha: true, antialias: true, preserveDrawingBuffer: true });
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.setPixelRatio(2);
  } catch {
    failed = true; // no WebGL → caller shows a plain placeholder
  }
  return renderer;
}

export function renderPortrait(id: string, pose: Pose, frame: Frame): string {
  const key = `to2-portrait:${VERSION}:${id}:${pose}:${frame}`;
  const hit = mem.get(key);
  if (hit) return hit;
  try {
    const ls = localStorage.getItem(key);
    if (ls) {
      mem.set(key, ls);
      return ls;
    }
  } catch {
    /* storage blocked */
  }
  const ren = getRenderer();
  if (!ren) return "";
  const F = FRAMES[frame];
  const scene = new THREE.Scene();
  addLights(scene, true);
  const ch = makeChar(getCharacter(id).voxel, scene, false);
  applyPose(ch, pose);
  const cam = new THREE.PerspectiveCamera(F.fov, F.w / F.h, 10, 10000);
  cam.position.set(...F.pos);
  cam.lookAt(new THREE.Vector3(...F.at));
  ren.setSize(F.w, F.h, false);
  ren.setClearColor(0x000000, 0);
  ren.clear();
  ren.render(scene, cam);
  const url = ren.domElement.toDataURL("image/png");
  ch.dispose();
  mem.set(key, url);
  try {
    localStorage.setItem(key, url);
  } catch {
    /* quota — memory cache is enough */
  }
  return url;
}
