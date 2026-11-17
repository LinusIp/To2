# Tutor 3D models: hinged GLBs that drop into the makeChar rig

Real 3D versions of the tutors from `docs/characters-reference.png`, built so they animate **like the
`makeChar` voxel tutors**: separate rigid blocks on hinges (no skinning, so no melting or tearing),
with swappable mouth frames for lip-sync and eyelids for blinking.

| id | file | status |
|---|---|---|
| blokbek | `public/models/tripo/blokbek.glb` (1.1 MB) | ✅ |
| lola | `public/models/tripo/lola.glb` (1.3 MB) | ✅ |
| ziyo (green hood) | `public/models/tripo/ziyo.glb` (1.2 MB) | ✅ |
| the other 5 | — | MVP: locked ("Tez orada"), keep `makeChar` / sig art |

Test renders: `public/models/raw/_B_*.png`, `_L_*.png`, `_d_*.png` (Ziyo) (talk, write, wave, walk, faces).
Source: `tools/blender/tripo_pipeline.py` (decimate and bake) + `tools/blender/tripo_hinged.py` (cut,
hinge, faces, export). Per-character measurements are in `P` there.

## Node tree (same names and conventions as `makeChar`)

```
tutor                       root, origin at the feet, character faces +Z
└─ body                     ≈ makeChar `body`
   ├─ body_mesh
   ├─ legL, legR            hip hinges (legL = screen-left when facing the learner)
   ├─ head                  neck hinge
   │   ├─ head_mesh
   │   ├─ mouth_rest        face as on the sheet (default when not talking)
   │   ├─ mouth_0 … mouth_3 talking frames: closed, small, medium, wide open
   │   └─ lid_L, lid_R      closed eyelids (show only while blinking)
   ├─ shW → elW → chalkW    writing arm (screen-left, like makeChar armW) + chalk-tip node for IK
   └─ shP → elP             pointing / waving arm (screen-right, like makeChar armP)
```

- **Units are stage px**, the same as `makeChar` (shoulders ≈ 440–470, hips ≈ 190–290, height ≈ 750).
  Hinge positions come from each model, so read them from the nodes; don't hard-code makeChar's.
- **Rest pose = arms hanging straight down**, legs straight, head forward: all rotations 0, exactly
  like `makeChar`. So `applyPose` and the existing turn, walk and IK code apply to these groups as-is:
  `sh*.rotation.z` swings the arm sideways (wave / cheer), `sh*.rotation.x` swings it forward (writing,
  pointing), and `el*` bends the elbow the same way.
- **Writing IK:** shoulder = `shW` world position, elbow = `elW`, hand tip = `chalkW`. Segment lengths:
  `|elW|` and `|chalkW|` (local positions). Attach the chalk mesh to `elW` at `chalkW`.

## Face

- On load: show `mouth_rest`, hide `mouth_0..3`, hide `lid_L` and `lid_R`.
- Lip-sync from the voice amplitude (the existing `mouth` 0–3 value): while speaking show
  `mouth_{mouth}` and hide the others. When the sentence ends, go back to `mouth_rest`.
- Blink: show `lid_L` and `lid_R` for about 110 ms every 2.5–5 s (reuse `blinkState`).
- `look` (eye direction) isn't supported on these models; ignore it.
- Frame textures use nearest filtering (pixel style); keep `magFilter = NearestFilter`.

## Loading

```ts
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
const draco = new DRACOLoader().setDecoderPath("/draco/"); // copy three/examples/jsm/libs/draco/gltf/* → public/draco/
const gltf = await new GLTFLoader().setDRACOLoader(draco).loadAsync(`/models/tripo/${id}.glb`);
const g = (n: string) => gltf.scene.getObjectByName(n)!;
// build a VoxelChar-compatible object: { root: g("tutor"), body: g("body"), head: g("head"), legL: g("legL"), legR: g("legR"),
//   armW: { sh: g("shW"), el: g("elW"), chalk }, armP: { sh: g("shP"), el: g("elP"), chalk: null }, face: { rest, mouths[4], lids[2] } }
```

- Materials: baked colour texture (sRGB), roughness 0.85, no normal map. They look right with
  `addLights()`. If they look too dark, convert to `MeshLambertMaterial({ map })` like `makeChar`.
- Lazy-load on the lesson page only, and preload the selected tutor after onboarding.
- Lola's long hair belongs to `head`. Keep head pitch within ±10°, or the hair swings into her back.
  Small yaw (±20°) looks fine.
- Arms swing best within about 150° (full overhead is fine for a cheer). Lifting an arm
  across the body can pass through the torso, as with makeChar.
