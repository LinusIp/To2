# To2 — 25 Nov 3D fixes (M1–M5, M8, M7) for the 3 real tutors. Run INSIDE Blender 5.x (Scripting tab).
# Step-by-step guide: docs/3d/reexport-steps.md
#
#   exec(open(r"<repo>\tools\blender\tripo_fix.py", encoding="utf-8").read())
#   stats("blokbek")            # before/after numbers of a GLB: triangles, non-manifold edges, bytes
#   rebuild("blokbek")          # Route A (preferred): raw T-pose → 30k tris → bake (24 px Extend margin) →
#                               #   cut + clean + neck plug + auto smooth → GLB → portraits (AgX)
#   fix_glb("blokbek")          # Route B (fallback, no raw needed): clean the SHIPPING GLB in place
#
# Paths: SRC = where the raw Tripo files live (git-ignored, only in the main checkout).
#        DST = the checkout of branch fix/3d-reexport (GLBs + portraits are written there).
import bpy, bmesh, math, os
import numpy as np

SRC = r"C:\Users\Progress service\Desktop\To2"
DST = r"C:\Users\Progress service\Desktop\To2"   # ← set to your fix/3d-reexport checkout
TOOLS = DST + r"\tools\blender"
SCALE = 770.0            # metres → stage px (tripo_hinged.SCALE)
TARGET = 30000           # M8
RAW = {"blokbek": "blokbek_t", "lola": "lola_t", "ziyo": "ziyo_t"}   # T-pose sources in public/models/raw


def _ns(name):
    ns = {}
    exec(open(TOOLS + "\\" + name, encoding="utf-8").read(), ns)
    return ns


def _paths(*nss):
    for ns in nss:
        if "RAW" in ns: ns["RAW"] = SRC + r"\public\models\raw"
        if "OUT" in ns: ns["OUT"] = DST + r"\public\models\tripo"
        if "ROOT" in ns: ns["ROOT"] = DST


# ---------------------------------------------------------------- texture dilation (M4, belt and braces)
def _tex_node(ob):
    for n in ob.active_material.node_tree.nodes:
        if n.type == "TEX_IMAGE" and n.image: return n
    return None


def uv_mask(obs, W, H):
    """Pixels covered by any UV triangle of these objects (row 0 = bottom, like Image.pixels)."""
    mask = np.zeros((H, W), dtype=bool)
    for ob in obs:
        me = ob.data; me.calc_loop_triangles()
        uv = np.empty(len(me.uv_layers.active.data) * 2, dtype=np.float32)
        me.uv_layers.active.data.foreach_get("uv", uv); uv = uv.reshape(-1, 2)
        lt = np.empty(len(me.loop_triangles) * 3, dtype=np.int32)
        me.loop_triangles.foreach_get("loops", lt)
        for t in uv[lt.reshape(-1, 3)] * np.array([W, H], dtype=np.float32):
            x0, y0 = np.floor(t.min(0)).astype(int); x1, y1 = np.ceil(t.max(0)).astype(int)
            x0, y0 = max(0, x0), max(0, y0); x1, y1 = min(W, x1 + 1), min(H, y1 + 1)
            if x1 <= x0 or y1 <= y0: continue
            xs, ys = np.meshgrid(np.arange(x0, x1) + 0.5, np.arange(y0, y1) + 0.5)
            (ax, ay), (bx, by), (cx, cy) = t
            d = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy)
            if abs(d) < 1e-9: continue
            l1 = ((by - cy) * (xs - cx) + (cx - bx) * (ys - cy)) / d
            l2 = ((cy - ay) * (xs - cx) + (ax - cx) * (ys - cy)) / d
            e = 0.6 / max(1.0, math.sqrt(abs(d)))  # ~half a pixel of slack
            mask[y0:y1, x0:x1] |= (l1 >= -e) & (l2 >= -e) & (1 - l1 - l2 >= -e)
    return mask


def dilate(img, mask, px=24, erode=1):
    """Grow every UV island's edge colour outward by `px` pixels (after shaving `erode` mixed edge pixels)."""
    W, H = img.size
    a = np.empty(W * H * 4, dtype=np.float32); img.pixels.foreach_get(a); a = a.reshape(H, W, 4)
    m = mask.copy()
    for _ in range(erode):
        m &= np.roll(m, 1, 0) & np.roll(m, -1, 0) & np.roll(m, 1, 1) & np.roll(m, -1, 1)
    nb = [(1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (1, -1), (-1, 1), (-1, -1)]
    for _ in range(px + erode):
        acc = np.zeros((H, W, 3), dtype=np.float32); cnt = np.zeros((H, W), dtype=np.float32)
        for dy, dx in nb:
            sm = np.roll(m, (dy, dx), (0, 1)); acc += np.roll(a[..., :3], (dy, dx), (0, 1)) * sm[..., None]; cnt += sm
        grow = (~m) & (cnt > 0)
        if not grow.any(): break
        a[grow, :3] = acc[grow] / cnt[grow, None]; m |= grow
    img.pixels.foreach_set(a.ravel()); img.update()
    if img.packed_file: img.pack()
    return img


# ---------------------------------------------------------------- numbers for REPORT.md
def stats(cid, path=None):
    """Import a GLB into an empty scene and count triangles / open edges per part."""
    path = path or DST + rf"\public\models\tripo\{cid}.glb"
    bpy.ops.wm.read_homefile(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=path)
    hg = _ns("tripo_hinged.py")
    parts = {}
    for o in bpy.data.objects:
        if o.type != "MESH" or not o.name.endswith("_mesh"): continue
        bm = bmesh.new(); bm.from_mesh(o.data)
        bmesh.ops.remove_doubles(bm, verts=bm.verts[:], dist=0.05)  # glTF splits verts at UV/normal seams
        parts[o.name] = {"tris": sum(len(f.verts) - 2 for f in bm.faces), "nonmanifold": hg["nonmanifold"](bm),
                         "islands": len(hg["islands"](bm))}
        bm.free()
    return {"glb": path, "bytes": os.path.getsize(path), "tris": sum(p["tris"] for p in parts.values()),
            "nonmanifold": sum(p["nonmanifold"] for p in parts.values()), "parts": parts}


# ---------------------------------------------------------------- Route A: rebuild from the raw T-pose
def rebuild(cid, portraits=True):
    pl = _ns("tripo_pipeline.py"); hg = _ns("tripo_hinged.py"); _paths(pl, hg)
    raw = pl["load_raw"](RAW[cid])
    low = pl["make_low"](raw, target_tris=TARGET)                    # M8 (+ weld)
    img = pl["bake_colour"](raw, low, cid)                           # M4: 24 px Extend margin
    dilate(img, uv_mask([low], *img.size)); img.save()               # M4: extra dilation, re-save the JPEG
    bpy.data.objects.remove(raw, do_unlink=True)
    low.name = "low"
    res = hg["build_hinged"](cid)                                    # M1 M2 M3 M5 inside; raises if a part is open
    bpy.ops.wm.save_as_mainfile(filepath=SRC + rf"\public\models\raw\{cid}_hinged_v2.blend")
    if portraits: res["portraits"] = render_portraits(cid)
    return res


# ---------------------------------------------------------------- Route B: clean the shipping GLB in place
def _apply_decimate(ob, ratio):
    m = ob.modifiers.new("dec", "DECIMATE"); m.ratio = ratio; m.use_collapse_triangulate = True
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(ob.evaluated_get(dg))
    ob.modifiers.clear(); old = ob.data; ob.data = me
    if old.users == 0: bpy.data.meshes.remove(old)


def fix_glb(cid, target=TARGET):
    hg = _ns("tripo_hinged.py"); _paths(hg)
    S = SCALE
    bpy.ops.wm.read_homefile(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=DST + rf"\public\models\tripo\{cid}.glb", merge_vertices=True)
    root = bpy.data.objects["tutor"]
    parts = [o for o in bpy.data.objects if o.type == "MESH" and o.name.endswith("_mesh")]
    neck_z = bpy.data.objects["head"].matrix_world.translation.z
    px = hg["_px_of"](_tex_node(parts[0]).image)
    hg["PLANES"][:] = []  # cut planes are unknown after export: close every open loop instead

    def clean(ob, plug):
        mw = ob.matrix_world.copy()
        bm = bmesh.new(); bm.from_mesh(ob.data); bm.transform(mw)
        hg["weld"](bm, 0.0001 * S)
        dropped = hg["drop_small_islands"](bm, 0.03 * S)                            # M1
        for _ in range(3):                                                         # M2
            if not hg["_cap"](bm, px, all_open=True): break
            hg["weld"](bm, 0.0001 * S)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
        if plug:                                                                   # M3
            hg["neck_plug"](bm, neck_z, depth=0.015 * S, band=0.07 * S, halfw=0.13 * S)
            bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
        nm = hg["nonmanifold"](bm)
        bm.transform(mw.inverted()); bm.to_mesh(ob.data); bm.free(); ob.data.update()
        return {"dropped": dropped, "nonmanifold": nm}

    report = {o.name: clean(o, o.name == "head_mesh") for o in parts}
    tris = sum(len(p.vertices) - 2 for o in parts for p in o.data.polygons)
    if tris > target:                                                              # M8
        for o in parts: _apply_decimate(o, target / tris)
        report = {o.name: clean(o, False) for o in parts}                          # re-close after collapse
    hg["harden"](parts)                                                            # M5
    img = _tex_node(parts[0]).image
    dilate(img, uv_mask(parts, *img.size))                                         # M4 (no re-bake on this route)
    bad = {k: v["nonmanifold"] for k, v in report.items() if v["nonmanifold"]}
    if bad: raise RuntimeError(f"{cid}: still open after cleaning: {bad} — see docs/3d/reexport-steps.md §M2 by hand")
    out = hg["export"](cid, root)
    return {"glb": out, "bytes": os.path.getsize(out), "tris": sum(len(p.vertices) - 2 for o in parts for p in o.data.polygons), "parts": report}


# ---------------------------------------------------------------- M7: portraits (needs the hinged scene open)
def render_portraits(cid):
    pt = _ns("tripo_portraits.py"); _paths(pt)
    main = {k: v for k, v in pt["POSES"].items() if k != "board"}
    out = pt["render_all"](cid, main)                                   # idle wave thumbs cheer point × full/half/face
    out += pt["render_all"](cid, {"board": pt["POSES"]["board"]}, frames=("full",))
    out += pt["render_all"](cid, pt["THINK"], frames=("half",))         # think1 / think2 (quiz)
    return out
