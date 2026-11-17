# Tutor 3D models (Tripo → Blender)

Real 3D versions of the 8 characters in `docs/characters-reference.png`, for the **live tutor on the
lesson stage**. They replace the box-built `makeChar` voxels. Cards, the selection screen and the
splash keep the cut-outs in `public/characters/<id>_sig_*.png`, which match these models.

| id | status |
|---|---|
| blokbek, lola, diyorbek | ✅ `public/models/tripo/<id>.glb` |
| agent-shox, ziyo, sardor, ravshan, shadow | coming (same pipeline) |

Until a character's GLB exists, fall back to the current `makeChar` tutor for that character.

## How they're made

`docs/characters-crops/<id>.png` → Tripo image-to-3D (raw export `public/models/raw/<id>.glb`, ~60 MB,
git-ignored) → `tools/blender/tripo_pipeline.py` → `build_static(id)`: decimate 1.9M → ~86k tris,
fresh UVs, bake Tripo's colours into one 2048 px texture, Draco → **~1–1.25 MB per character**.

## Important: no skeleton, so animate the whole figure

Tripo builds each character as one fused surface in its signature pose (thumbs-up, wave, walk).
Rigging that tears at the shoulders and neck (tested, looked bad), so these GLBs are **one solid
mesh** with no bones. Animate the whole figure (Minecraft-mob / mobile-game style); nothing can tear:

| State | Motion (whole model) |
|---|---|
| idle | slow breathing: scale.y 1 → 1.012, y-bob ±1.5 px, 2.4 s loop |
| talking | bob in time with the voice amplitude (y +0…4 px, tiny rotation.z ±1.5°) |
| turn to board | rotate.y 0 → π over 350 ms (ease-in-out), small hop (y +6 px) mid-turn |
| writing | back to camera; follow the chalk tip with position.x (walk along the board), slight lean toward it (rotation.z ±4°), tiny bob per stroke. Keep the existing chalk-dot/IK line drawn from the shoulder point to the tip |
| walk along board | position.x tween + waddle: rotation.z ±5° and y-bob at 4 Hz |
| listening (barge-in) | turn to learner, lean forward (rotation.x −6°), hold |
| thinking | slow sway rotation.z ±3°, 1.6 s |
| celebrate (correct answer) | squash-and-stretch hop: scale.y 0.92 → 1.08 → 1, y +40 px, spin 360° optional |

The signature pose itself does the "gesture": Blokbek's thumbs-up, Lola's and Diyorbek's wave.

## Loading (three.js)

```ts
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
const draco = new DRACOLoader().setDecoderPath("/draco/"); // copy three/examples/jsm/libs/draco/gltf/* to public/draco/
const gltf = await new GLTFLoader().setDRACOLoader(draco).loadAsync(`/models/tripo/${id}.glb`);
const tutor = gltf.scene; // one mesh "<id>_mesh"
```

- Units: metres, height ≈ 0.98, feet at y = 0, **facing +Z** (toward the camera). Scale ×~100 for the
  stage's px units, or match the old rig's height.
- Material: baked colour texture (sRGB), roughness 0.85, metalness 0. Looks right with the existing
  hemisphere + key light. Don't add a normal map.
- Load lazily on the lesson page only. Preload the selected tutor's GLB after onboarding.
