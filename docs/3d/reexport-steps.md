# 3D tutor re-export — step by step (M1–M5, M8, M7)

The fixes for the 25 Nov problem report on the 3 real tutors (Blokbek, Lola, Ziyo).
The agent that was asked to do this could not reach Blender (the Blender MCP add-on wasn't connected on
`localhost:9876`), so this page is for a person at the Blender PC. **The code is already written and committed**
(`tools/blender/*.py`, branch `fix/3d-reexport`). You run it, check the result, and commit the output files.

Not part of this job: M6 (lighting / tone mapping inside the app, `TutorCanvas.tsx`). The To2-Tutor · animation
session does that after these models land.

---

## What changed in the scripts (already done)

| Problem | Fix | Where |
|---|---|---|
| **M1** Lola: floating slivers | After cutting, every part is welded and loose islands with a bounding box under 3 cm (≈ 23 stage px) are deleted ("select linked → delete"); the biggest piece is always kept | `tripo_hinged.py` → `drop_small_islands()`, `ISLAND_MIN` |
| **M2** Lola: open right shoulder | Cut planes are capped as before, then **every remaining open loop** is filled (`_cap(all_open=True)`, up to 3 passes), normals are recalculated, and the build **stops with an error** if any part still has non-manifold edges | `tripo_hinged.py` → `clean_part()`, `nonmanifold()`, check in `build_hinged()` |
| (root cause of many holes) | Vertices are welded (0.1 mm) **before** decimating. The glTF importer splits vertices at Tripo's old UV seams, and the decimator kept those splits as cracks | `tripo_pipeline.py` → `make_low()`, `tripo_hinged.py` → `weld()` |
| **M3** Blokbek: neck gap | The head's bottom lid is extruded **1.5 cm down into the body**, 6 % narrower, so it stays hidden inside the collar and a turn never shows a gap | `tripo_hinged.py` → `neck_plug()`, `NECK_PLUG`, `NECK_SHRINK` |
| **M4** Blokbek: white seam streaks on the sleeves | Bake margin 10 → **24 px, type Extend**; UV island margin 0.006 → 0.012 so there is room; plus a numpy **dilation** pass (shave 1 mixed edge pixel, grow edge colours 24 px) | `tripo_pipeline.py` → `bake_colour()`, `make_low()`; `tripo_fix.py` → `dilate()` |
| **M5** all 3: block edges look soft / dark | **Shade Auto Smooth 30°** written into the mesh data (`shade_smooth()` + `set_sharp_from_angle(30°)`), so the glTF exporter writes split normals with no modifier to apply. Mouth/eyelid quads are not touched | `tripo_hinged.py` → `harden()` |
| **M8** 235k triangles → 7 fps | Decimate to **30,000 triangles per tutor** before the bake (ratio computed from the raw count) | `tripo_pipeline.py` → `TARGET_TRIS`, `make_low(target_tris=…)` |
| **M7** portraits: skin crushed to orange/brown | **AgX** view transform (Filmic if your Blender has no AgX), exposure +0.35, **soft key** (2.6 W, sun angle 30°) + new front **fill** (0.9 W, angle 60°) + rim; brighter world (0.55 → 0.7). `class_tutor.py` no longer forces Standard for the think poses | `tripo_portraits.py` → `VIEW`, `EXPOSURE`, `LIGHTS`, `setup()` |

Node and file names are unchanged: `tutor › body › body_mesh, legL, legR, head › head_mesh, mouth_rest, mouth_0…3, lid_L, lid_R, shW › elW › chalkW, shP › elP`
(the app checks exactly these in `src/components/characters/glbTutor.ts` → `REQUIRED`). Files stay
`public/models/tripo/{blokbek,lola,ziyo}.glb` and `public/characters/<id>_<pose>_<frame>.png`.

---

## 0. Before you start (5 min)

1. Get the branch into a folder of its own, so you don't disturb the main checkout:
   ```powershell
   cd "C:\Users\Progress service\Desktop\To2"
   ```
   ```powershell
   git fetch origin
   ```
   ```powershell
   git worktree add ..\To2-3d fix/3d-reexport
   ```
2. Open `C:\Users\Progress service\Desktop\To2-3d\tools\blender\tripo_fix.py` in a text editor and set line
   `DST = r"C:\Users\Progress service\Desktop\To2-3d"`. Leave `SRC` as it is: the raw Tripo files
   (`public\models\raw\{blokbek_t,lola_t,ziyo_t}.glb`, ~60 MB each, git-ignored) only exist in the main checkout.
3. Start **Blender 5.2** (`C:\Program Files\Blender Foundation\Blender 5.2\blender.exe`).
   *Optional:* enable the MCP add-on (Edit › Preferences › Add-ons › search "MCP" › tick it, then in the 3D
   viewport sidebar press **N › MCP › Start server**). Then an agent can run all of this for you instead.
4. Go to the **Scripting** tab (top bar). In the Python console at the bottom-left, load the tools:
   ```python
   exec(open(r"C:\Users\Progress service\Desktop\To2-3d\tools\blender\tripo_fix.py", encoding="utf-8").read())
   ```
5. Write down the "before" numbers (or copy them from the table at the bottom of this page):
   ```python
   stats("blokbek"); stats("lola"); stats("ziyo")
   ```
   The console prints a dict per tutor: `bytes`, `tris`, `nonmanifold`, and per part `islands`.

## 1. Rebuild each tutor — Route A (preferred, ~3–6 min per tutor)

In the same Python console, one tutor at a time:

```python
r = rebuild("lola"); r["tris"], r["bytes"], r["clean"]
```

What it does: imports `lola_t.glb` → welds → decimates to 30k → new UVs (wider margin) → Cycles bake with a 24 px
Extend margin → dilates the texture → cuts the parts → per part: weld, delete slivers (M1), cap the cut planes,
close every other hole (M2), neck plug on the head (M3) → hangs the arms → face frames → Auto Smooth 30° (M5) →
**refuses to export if any part is still open** → writes `public/models/tripo/lola.glb` → saves
`public/models/raw/lola_hinged_v2.blend` → renders the portraits (M7, step 3).

Expected: `tris` ≈ 30,000–31,000, `bytes` ≈ 0.4–0.5 MB, every `clean[...]["nonmanifold"] == 0`.
Then `rebuild("blokbek")` and `rebuild("ziyo")`.

If you want to check before rendering 50 portraits, call `rebuild("lola", portraits=False)` first, look at it
(step 2), then `render_portraits("lola")` with that scene still open.

**If it stops with "parts still open"**, the message names the part and edge count. Fix it by hand (M2 below), then
in the console run `hg = _ns("tripo_hinged.py"); _paths(hg); hg["export"]("lola", bpy.data.objects["tutor"])`.

### Route B (fallback if the raw files are missing or the bake misbehaves)

```python
r = fix_glb("lola"); r
```

It cleans the **shipping** GLB in place: weld, slivers, close holes, neck plug, decimate to 30k, Auto Smooth,
texture dilation, export. No re-bake, so M4 relies on the dilation alone and the texture keeps its old (narrow)
gaps. Use Route A whenever you can.

## 2. Check each model by eye (2 min per tutor)

With the rebuilt scene open in Blender:

1. **Slivers (M1):** Layout tab → numpad `1` (front), `3` (side), `Ctrl+1` (back). Look for floating specks
   around Lola's hair and arms. If one is left: click it, `Tab` (Edit Mode), hover it, `L` (select linked), `X` › Faces.
2. **Holes (M2):** select a part (e.g. `shP_mesh`, Lola's right shoulder) → `Tab` → `1` (vertex select) →
   `Alt+A` (deselect all) → **Select › Select All by Trait › Non Manifold** (default options). Header stats
   (Overlays ▾ › Statistics) must show **0** selected. If not: `F` fills a single loop; for a bigger opening
   **Face › Grid Fill** or **Edge › Bridge Edge Loops**; then **Mesh › Normals › Recalculate Outside** (`Shift+N`).
3. **Neck (M3, Blokbek):** select the `head` empty → `R` `Z` `40` `Enter`, view from the front and side: no
   light gap at the collar. `Esc`/`Ctrl+Z` to undo the turn.
4. **Seams (M4):** viewport shading **Material Preview** (`Z` › 2), orbit around the sleeves: no white lines on
   the black hoodie. In the Image Editor (`blokbek_tex`) the black space between islands should now be filled
   with the edge colours.
5. **Hard edges (M5):** Object Data properties (green triangle) › Normals: the mesh is smooth-shaded with
   sharp edges marked at 30°. Block edges should look crisp, faces flat-lit.
6. **Size (M8):** Overlays › Statistics → Triangles ≈ 30k for the whole tutor. Zoom so the tutor is 300–400 px
   tall on screen: the silhouette, hair and shoes should still read the same as before. If the head looks
   faceted, raise `TARGET` in `tripo_fix.py` to 40000 and rebuild (≈ 0.6 MB, still 6× lighter).

Manual equivalents (if you ever do this without the scripts):
- M4 bake: Render properties › Bake › Output › **Margin: Type Extend, Size 24 px** (16–32 is fine).
- M5: right-click the object › **Shade Auto Smooth**, angle **30°**, then apply the "Smooth by Angle" modifier
  (or tick *Apply Modifiers* in the glTF export dialog).
- M8: Modifiers › Add › Generate › **Decimate**, Collapse, ratio = 30000 / current triangles, *Triangulate* on,
  apply **before** the bake.
- M3: select the head's bottom faces, `E` then `-0.015` (Blender metres, before the ×770 scale) and `S` `0.94`.

## 3. Portraits (M7)

`rebuild()` already rendered them. To redo just the portraits (after tuning the light), with the hinged scene of
that tutor open:
```python
render_portraits("lola")
```
It writes into `public/characters/`:
- `<id>_{idle,wave,thumbs,cheer,point}_{full,half,face}.png` (15)
- `<id>_board_full.png`, `<id>_think1_half.png`, `<id>_think2_half.png`

Not re-rendered on purpose: `<id>_sig_*.png` are 2D cut-outs from the reference sheet, not 3D renders. The
folders `public/characters/3d/` and `public/characters/blender/` are not used by the app (it only reads
`public/characters/<id>_<pose>_<frame>.png`, see `TutorPortrait.tsx` and `characterRenders.json`).

Check: skin should look like the reference sheet (`docs/characters-crops/<id>.png`), not orange; the hoodie
black should still be black. Too dark overall → raise `EXPOSURE` in `tripo_portraits.py` (0.35 → 0.6); too
flat → lower the fill energy. The WebP twins are made by `pnpm build` (`scripts/characters-manifest.mjs`
re-encodes any WebP older than its PNG), so don't make them by hand.

## 4. Check in the app

From `C:\Users\Progress service\Desktop\To2-3d` (no `.dev.vars` there → mock mode, no VoiceLab credits):

```powershell
pnpm install
```
```powershell
pnpm vitest run
```
```powershell
pnpm build
```
```powershell
pnpm dev --port 5190
```

Open `http://localhost:5190`, phone size 375×812 (browser dev tools › device toolbar):
1. `/tutors` → pick Blokbek → `/lesson/frac-add-unlike`. Screenshot. Repeat for Lola and Ziyo.
2. `/home` and `/tutors`: screenshot the portraits.
3. Save the screenshots as `docs/screenshots/3d/after-<id>-lesson.png`, `after-home.png`, `after-tutors.png`
   (the "before" set: take the same three screens on `main` or the live site first).
4. Optional: dev tools › Performance with CPU 4× slowdown during the lesson: should be well above the 7 fps
   of the 25 Nov report.

## 5. Commit and hand over

```powershell
git add public/models/tripo/blokbek.glb public/models/tripo/lola.glb public/models/tripo/ziyo.glb public/models/tripo/*_tex.jpg public/characters src/config/characterRenders.json docs/screenshots/3d REPORT.md
```
```powershell
git commit -m "fix(3d): re-export Blokbek/Lola/Ziyo (M1-M5, M8) + AgX portraits (M7)"
```
```powershell
git push origin fix/3d-reexport
```

(`.blend` files are git-ignored on purpose — keep them local.) Add a short REPORT.md section with the table
below filled in, then tell the To2-Orchestrator v2 session the branch and commit. Don't deploy.

## Numbers

Before = the GLBs on `main` (release 8bf833a), counted from the GLB JSON (no Blender needed). Fill in "after"
from `stats()`.

| Tutor | Triangles before | Bytes before | Non-manifold before | Triangles after | Bytes after | Non-manifold after |
|---|---|---|---|---|---|---|
| Blokbek | 233,925 | 1,188,048 | (run `stats`) | | | 0 |
| Lola | 250,313 | 1,322,412 | (run `stats`) | | | 0 |
| Ziyo | 238,514 | 1,189,768 | (run `stats`) | | | 0 |

Per part before (triangles): Blokbek head 77k, body 62k, legs 28k+28k, arms 8.7–10.5k each.
Lola head 108k (hair), body 82k. Ziyo head 85k, body 60k, legs 30k+30k.

## Known risks (the scripts have not been run yet)

- Written against the Blender 5.x Python API without a live Blender: `Mesh.set_sharp_from_angle` (4.1+),
  `bake.margin_type` (3.1+), glTF importer `merge_vertices`. If a call fails, the error names it. The manual steps
  above do the same thing.
- `holes_fill` on a large non-planar opening (Blokbek's head bottom, where hoodie faces were moved to the body)
  can make a crumpled lid. It's hidden inside the collar, but check step 2.3.
- 30k is 8× fewer triangles. Faces are textures, so they stay sharp, but check the hair silhouettes at
  300–400 px (step 2.6).
- After this lands, M6 (in-app tone mapping) may need a re-tune because the new normals light differently.
