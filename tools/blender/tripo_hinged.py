# To2: Tripo T-pose model → hinged voxel tutor that drops into the makeChar rig (Blender 5.x).
#
# Input: an object named "low" (decimated + baked by tripo_pipeline.py: make_low + bake_colour).
# Output GLB (three.js, y-up, units = stage px like makeChar, faces +Z):
#   tutor
#   └─ body                       (pivot at origin, feet at y=0)
#      ├─ body_mesh
#      ├─ legL / legR             (hip hinges; legL = screen-left when facing the learner)
#      ├─ head                    (neck hinge) ── head_mesh, mouth_0..mouth_3, lids
#      ├─ shW ── shW_mesh, elW ── elW_mesh, chalkW   (writing arm, screen-left, holds the chalk)
#      └─ shP ── shP_mesh, elP ── elP_mesh           (pointing / waving arm, screen-right)
# Arms hang straight down at rest (rotation 0), exactly like makeChar.
import bpy, bmesh, math, os
import numpy as np
from mathutils import Matrix, Vector as V

ROOT = r"C:\Users\Progress service\Desktop\To2"
OUT = ROOT + r"\public\models\tripo"
SCALE = 770.0
PLANES = []  # metres → stage px (matches makeChar proportions: shoulder ≈ 455, hips ≈ 232)

# Per-character measurements (Blender metres, T-pose, facing -Y). Measured from front/side renders.
P = {
    "lola": dict(sw=0.14, arm=(0.55, 0.68), crotch=0.24, neck=0.688, tip=0.468, hood_to_body=False, hair_to_head=True, hair_x=0.30, dark_is_hair=0.24, hair_zmin=0.445,
                 mouth=(-0.034, 0.033, 0.711, 0.744), eyes=(-0.085, 0.088, 0.764, 0.814)),
    "ziyo": dict(sw=0.14, arm=(0.54, 0.68), crotch=0.37, neck=0.668, tip=0.49, head_x=0.215, hood_to_body=False, hair_to_head=False,
                     mouth=(-0.036, 0.032, 0.712, 0.743), eyes=(-0.084, 0.084, 0.756, 0.803),
                     mouth_dark=(0.20, 0.10, 0.06), mouth_red=(0.80, 0.33, 0.28)),
    "blokbek": dict(sw=0.152, arm=(0.56, 0.69), crotch=0.29, neck=0.685, hood_to_body=True, hair_to_head=False,
                    mouth=(-0.039, 0.039, 0.709, 0.745), eyes=(-0.078, 0.076, 0.762, 0.801)),
}


def _px_of(img):
    W, H = img.size
    a = np.empty(W * H * 4, dtype=np.float32); img.pixels.foreach_get(a)
    return a.reshape(H, W, 4)


def _face_colour(f, uvl, px):
    H, W = px.shape[:2]
    u = sum(l[uvl].uv.x for l in f.loops) / len(f.loops); v = sum(l[uvl].uv.y for l in f.loops) / len(f.loops)
    return px[min(H - 1, max(0, int(v * H))), min(W - 1, max(0, int(u * W))), :3]


def _is_hoodie_black(c):
    return c.max() < 0.16 and abs(c[0] - c[2]) < 0.035


def _is_hair(c):
    return c.max() < 0.35 and c[0] > c[2] * 1.25 and c[0] > 0.06


def bisect(low, p):
    """Slice along the cut planes so every part boundary is a clean straight edge."""
    sw, (alo, ahi), crotch, neck = p["sw"], p["arm"], p["crotch"], p["neck"]
    xe = (sw + p.get("tip", 0.49)) / 2; pad = p.get("arm_pad", 0.025)
    planes = [((sw, 0, 0), (1, 0, 0)), ((-sw, 0, 0), (1, 0, 0)), ((xe, 0, 0), (1, 0, 0)), ((-xe, 0, 0), (1, 0, 0)),
              ((0, 0, neck), (0, 0, 1)), ((0, 0, crotch), (0, 0, 1)), ((0, 0, alo - pad), (0, 0, 1)), ((0, 0, ahi + pad), (0, 0, 1))]
    global PLANES
    PLANES = planes + [((0, 0, 0), (1, 0, 0))]
    bm = bmesh.new(); bm.from_mesh(low.data)
    for co, no in planes:
        bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], plane_co=V(co), plane_no=V(no), dist=0.0005)
    # legs split at x=0, only below the crotch
    legs = [f for f in bm.faces if f.calc_center_median().z < crotch + 0.01]
    gl = list({v for f in legs for v in f.verts}) + list({e for f in legs for e in f.edges}) + legs
    bmesh.ops.bisect_plane(bm, geom=gl, plane_co=V((0, 0, 0)), plane_no=V((1, 0, 0)), dist=0.0005)
    bm.to_mesh(low.data); bm.free(); low.data.update()


def classify(low, p):
    img = low.data.materials[0].node_tree.nodes["Image Texture"].image
    px = _px_of(img)
    bm = bmesh.new(); bm.from_mesh(low.data); uvl = bm.loops.layers.uv.active
    sw, (alo, ahi), crotch, neck = p["sw"], p["arm"], p["crotch"], p["neck"]
    xe = (sw + p.get("tip", 0.49)) / 2  # elbow halfway along the arm
    lab = {}
    for f in bm.faces:
        c = f.calc_center_median()
        col = None
        if p.get("hair_to_head") and c.z > p.get("hair_zmin", crotch) and abs(c.x) < p.get("hair_x", 0.3):
            col = _face_colour(f, uvl, px)
            if _is_hair(col) or (p.get("dark_is_hair") and col.mean() < p["dark_is_hair"]):
                lab[f.index] = "head"; continue
        if p.get("head_x") and c.z >= neck and abs(c.x) < p["head_x"]:
            lab[f.index] = "head"; continue
        pad = p.get("arm_pad", 0.025)
        if alo - pad < c.z < ahi + pad and abs(c.x) > sw:
            side = "W" if c.x < 0 else "P"
            part = ("sh" if abs(c.x) < xe else "el") + side
        elif c.z < crotch:
            part = "legL" if c.x < 0 else "legR"
        elif c.z >= neck:
            part = "head"
            if p.get("hood_to_body") and c.z < neck + 0.06:
                col = _face_colour(f, uvl, px)
                if _is_hoodie_black(col): part = "body"
        else:
            part = "body"
        lab[f.index] = part
    bm.free()
    return lab, xe


def _on_plane(co, planes, tol=0.0015):
    for pc, pn in planes:
        if abs((co - V(pc)).dot(V(pn))) < tol: return True
    return False


def _cap(bm, px, planes=()):
    """Close every opening with a lid in the part's own dark colour (solid block ends, no hollow tubes)."""
    uvl = bm.loops.layers.uv.active
    H, W = px.shape[:2]
    best = None; lums = []
    for f in bm.faces:
        u = sum(l[uvl].uv.x for l in f.loops) / len(f.loops); v = sum(l[uvl].uv.y for l in f.loops) / len(f.loops)
        c = px[min(H - 1, max(0, int(v * H))), min(W - 1, max(0, int(u * W))), :3]
        if c.max() > 0.02: lums.append((float(c.mean()), (u, v)))
    if lums:
        lums.sort(key=lambda t: t[0]); best = lums[len(lums) // 8][1]  # a dark but real colour of this part
    bnd = [e for e in bm.edges if e.is_boundary and _on_plane(e.verts[0].co, planes) and _on_plane(e.verts[1].co, planes)]
    if not bnd: return
    res = bmesh.ops.holes_fill(bm, edges=bnd, sides=0)
    new = res.get("faces", [])
    if new:
        tri = bmesh.ops.triangulate(bm, faces=new)
        new = tri.get("faces", new)
        if best:
            for f in new:
                for l in f.loops: l[uvl].uv = best


def split_parts(low, lab):
    img = low.data.materials[0].node_tree.nodes["Image Texture"].image
    px = _px_of(img)
    parts = {}
    for name in sorted(set(lab.values())):
        ob = low.copy(); ob.data = low.data.copy(); ob.name = name + "_mesh"
        bpy.context.scene.collection.objects.link(ob)
        bm = bmesh.new(); bm.from_mesh(ob.data); bm.faces.ensure_lookup_table()
        bmesh.ops.delete(bm, geom=[f for f in bm.faces if lab[f.index] != name], context="FACES")
        _cap(bm, px, PLANES)
        bm.to_mesh(ob.data); bm.free()
        parts[name] = ob
    bpy.data.objects.remove(low, do_unlink=True)
    return parts


def _centre_y(ob):
    ys = [v.co.y for v in ob.data.vertices]
    return (min(ys) + max(ys)) / 2


def hang_arms(parts, p, xe):
    """Rotate each T-pose arm down about its shoulder so it hangs; returns hinge points (metres)."""
    sw, (alo, ahi) = p["sw"], p["arm"]
    t = ahi - alo; zc = (alo + ahi) / 2
    hinges = {}
    for side, sgn in (("W", -1), ("P", 1)):
        up, lo = parts.get("sh" + side), parts.get("el" + side)
        yc = _centre_y(up)
        piv = V((sgn * (sw + t / 2), yc, zc))
        ang = math.radians(90 if sgn > 0 else -90)
        R = Matrix.Translation(piv) @ Matrix.Rotation(ang, 4, "Y") @ Matrix.Translation(-piv)
        for ob in (up, lo):
            ob.data.transform(R); ob.data.update()
        elbow = R @ V((sgn * xe, yc, zc))
        zs = [v.co.z for v in lo.data.vertices]
        tip = V((piv.x, yc, min(zs) + 0.015))
        hinges[side] = (piv, elbow, tip)
    return hinges


def _render_face(head_ob, p):
    """Flat-colour front render of the head → numpy (for mouth/eye frames). 2000 px per metre."""
    sc = bpy.context.scene
    keep = {o: o.hide_render for o in bpy.data.objects}
    for o in bpy.data.objects: o.hide_render = (o != head_ob)
    mat = head_ob.data.materials[0]; nt = mat.node_tree
    tex = nt.nodes["Image Texture"]; out = [n for n in nt.nodes if n.type == "OUTPUT_MATERIAL"][0]
    bsdf = [n for n in nt.nodes if n.type == "BSDF_PRINCIPLED"][0]
    em = nt.nodes.new("ShaderNodeEmission")
    nt.links.new(tex.outputs["Color"], em.inputs["Color"]); nt.links.new(em.outputs[0], out.inputs["Surface"])
    cam = bpy.data.cameras.new("facecam"); cam.type = "ORTHO"; cam.ortho_scale = 0.5
    co = bpy.data.objects.new("facecam", cam); sc.collection.objects.link(co)
    zc = (p["eyes"][2] + p["mouth"][3]) / 2
    co.location = (0, -3, zc); co.rotation_euler = (math.radians(90), 0, 0)
    old = (sc.camera, sc.render.resolution_x, sc.render.resolution_y, sc.render.filepath, sc.view_settings.view_transform, sc.render.film_transparent)
    sc.camera = co; sc.render.resolution_x = sc.render.resolution_y = 1000
    sc.view_settings.view_transform = "Standard"; sc.render.film_transparent = True
    path = OUT + r"\_face_tmp.png"; sc.render.filepath = path
    bpy.ops.render.render(write_still=True)
    sc.camera, sc.render.resolution_x, sc.render.resolution_y, sc.render.filepath, sc.view_settings.view_transform, sc.render.film_transparent = old
    nt.links.new(bsdf.outputs[0], out.inputs["Surface"]); nt.nodes.remove(em)
    bpy.data.objects.remove(co, do_unlink=True)
    for o, h in keep.items(): o.hide_render = h
    im = bpy.data.images.load(path, check_existing=False)
    a = _px_of(im)[::-1]  # top row first
    bpy.data.images.remove(im)
    def to_px(x, z): return int(round(500 + x * 2000)), int(round(500 - (z - zc) * 2000))
    return a, to_px


def _img_from(arr, name):
    h, w = arr.shape[:2]
    im = bpy.data.images.new(name, w, h, alpha=True)
    im.pixels.foreach_set(np.ascontiguousarray(arr[::-1]).astype(np.float32).ravel())
    im.pack()
    return im


def _quad(name, x0, x1, z0, z1, y, img, parent_col):
    me = bpy.data.meshes.new(name)
    me.from_pydata([(x0, y, z0), (x1, y, z0), (x1, y, z1), (x0, y, z1)], [], [(0, 1, 2, 3)])
    uv = me.uv_layers.new(name="UV")
    for i, (u, v) in enumerate([(0, 0), (1, 0), (1, 1), (0, 1)]): uv.data[i].uv = (u, v)
    mat = bpy.data.materials.new(name + "_mat"); mat.use_nodes = True
    nt = mat.node_tree; b = nt.nodes["Principled BSDF"]
    b.inputs["Roughness"].default_value = 0.85
    tn = nt.nodes.new("ShaderNodeTexImage"); tn.image = img; tn.interpolation = "Closest"
    nt.links.new(tn.outputs["Color"], b.inputs["Base Color"])
    me.materials.append(mat)
    ob = bpy.data.objects.new(name, me); parent_col.objects.link(ob)
    return ob


def face_parts(head_ob, p):
    """mouth_0..3 (closed → wide open) and lids (blink), sitting 1.5 mm in front of the face."""
    a, to_px = _render_face(head_ob, p)
    mx0, mx1, mz0, mz1 = p["mouth"]; pad = 0.008
    X0, Z1 = to_px(mx0 - pad, mz1 + pad); X1, Z0 = to_px(mx1 + pad, mz0 - pad)
    crop = a[Z1:Z0, X0:X1].copy()
    h, w = crop.shape[:2]
    # skin: the band between the chin seam and the mouth, mouth-wide
    sx0, sz_top = to_px(mx0, mz0 - 0.003); sx1, sz_bot = to_px(mx1, p["neck"] + 0.005)
    skin_patch = a[sz_top:max(sz_top + 2, sz_bot), sx0:sx1, :3].reshape(-1, 3)
    skin_patch = skin_patch[skin_patch.mean(1) > 0.35]
    skin = np.median(skin_patch, axis=0)
    rgb = crop[:, :, :3].reshape(-1, 3); lum = rgb.mean(1)
    dark = rgb[np.argsort(lum)[: max(4, len(lum) // 50)]].mean(0)
    redness = rgb[:, 0] - rgb[:, 1]
    red = rgb[np.argsort(redness)[-max(4, len(lum) // 50):]].mean(0)
    white = rgb[np.argsort(lum)[-max(4, len(lum) // 50):]].mean(0)
    if white.mean() < 0.7: white = np.array([0.95, 0.95, 0.95])
    if p.get("mouth_dark"): dark = np.array(p["mouth_dark"])
    if p.get("mouth_red"): red = np.array(p["mouth_red"])

    def blank():
        f = np.ones((h, w, 4), dtype=np.float32); f[:, :, :3] = skin; return f
    u = max(2, int(round(0.006 * 2000)))  # one "voxel pixel" ≈ 6 mm
    cx, cy = w // 2, h // 2
    def rect(f, x0, y0, x1, y1, c): f[max(0, y0):max(0, y1), max(0, x0):max(0, x1), :3] = c
    mw = int((mx1 - mx0) * 2000)
    f0 = blank(); rect(f0, cx - int(mw * 0.32), cy - u // 2, cx + int(mw * 0.32), cy + u // 2 + 1, dark)
    f1 = blank(); rect(f1, cx - int(mw * 0.26), cy - u, cx + int(mw * 0.26), cy + u, dark)
    rect(f1, cx - int(mw * 0.26) + u // 2, cy - u // 2, cx + int(mw * 0.26) - u // 2, cy + u - u // 2, red)
    f2 = blank(); hh = int(h * 0.22)
    rect(f2, cx - int(mw * 0.36), cy - hh, cx + int(mw * 0.36), cy + hh, dark)
    rect(f2, cx - int(mw * 0.36) + u // 2, cy - hh + u // 2, cx + int(mw * 0.36) - u // 2, cy - hh + u, white)
    rect(f2, cx - int(mw * 0.36) + u // 2, cy - hh + u, cx + int(mw * 0.36) - u // 2, cy + hh - u // 2, red)
    hw = int(h * 0.34)
    f3 = blank()
    rect(f3, cx - int(mw * 0.42), cy - hw, cx + int(mw * 0.42), cy + hw, dark)
    rect(f3, cx - int(mw * 0.42) + u // 2, cy - hw + u // 2, cx + int(mw * 0.42) - u // 2, cy - hw + u, white)
    rect(f3, cx - int(mw * 0.42) + u // 2, cy - hw + u, cx + int(mw * 0.42) - u // 2, cy + hw - u // 2, red)
    rest = crop.copy(); rest[:, :, 3] = 1.0
    ex0, ex1, ez0, ez1 = p["eyes"]
    y = min(v.co.y for v in head_ob.data.vertices if abs(v.co.x) < 0.05 and ez0 < v.co.z < ez1) - 0.0015
    col = head_ob.users_collection[0]
    obs = []
    for k, f in enumerate([f0, f1, f2, f3, rest]):
        nm = f"mouth_{k}" if k < 4 else "mouth_rest"
        obs.append(_quad(nm, mx0 - pad, mx1 + pad, mz0 - pad, mz1 + pad, y - 0.0003 * (k + 1), _img_from(f, nm + "_tex"), col))
    # eyelids: one tight quad per eye (dark blob), skin sampled just under that eye
    LX0, LZ1 = to_px(ex0, ez1); LX1, LZ0 = to_px(ex1, ez0)
    reg = a[LZ1:LZ0, LX0:LX1, :3]
    m_ = reg.mean(2); sat_ = reg.max(2) - reg.min(2)
    dk = (m_ < 0.3) | ((m_ > 0.8) & (sat_ < 0.12))  # pupils + eye whites
    cols = np.where(dk.any(0))[0]
    runs = [r for r in (np.split(cols, np.where(np.diff(cols) > 3)[0] + 1) if len(cols) else []) if len(r) > 8]
    runs = sorted(runs, key=len, reverse=True)[:2]
    for i, r in enumerate(sorted(runs, key=lambda r: r[0])):
        rows = np.where(dk[:, r[0]:r[-1] + 1].any(1))[0]
        x0p, x1p = LX0 + r[0] - 2, LX0 + r[-1] + 3
        z0p, z1p = LZ1 + rows[0] - 2, LZ1 + rows[-1] + 3
        below = a[min(a.shape[0] - 1, z1p + 3):min(a.shape[0], z1p + 9), x0p:x1p, :3].reshape(-1, 3)
        below = below[below.mean(1) > 0.35]
        sk = np.median(below, axis=0) if len(below) else skin
        lh, lw = z1p - z0p, x1p - x0p
        lid = np.ones((lh, lw, 4), dtype=np.float32); lid[:, :, :3] = sk
        ly = int(lh * 0.6); lid[max(0, ly - u // 2):ly + u // 2 + 1, 1:lw - 1, :3] = dark if not p.get("mouth_dark") else np.array(p["mouth_dark"])
        X = lambda px_: (px_ - 500) / 2000
        zc = (p["eyes"][2] + p["mouth"][3]) / 2
        Z = lambda py_: zc + (500 - py_) / 2000
        obs.append(_quad(f"lid_{'L' if i == 0 else 'R'}", X(x0p), X(x1p), Z(z1p), Z(z0p), y - 0.0025, _img_from(lid, f"lid{i}_tex"), col))
    return obs


def _empty(name, loc, parent=None):
    e = bpy.data.objects.new(name, None); bpy.context.scene.collection.objects.link(e)
    e.location = loc; e.empty_display_size = 20
    if parent: e.parent = parent
    return e


def _attach(ob, parent):
    mw = ob.matrix_world.copy(); ob.parent = parent; ob.matrix_world = mw


def assemble(parts, hinges, p, faces):
    S = SCALE
    Sm = Matrix.Scale(S, 4)
    for ob in list(parts.values()) + faces:
        ob.data.transform(Sm); ob.data.update()
    root = _empty("tutor", (0, 0, 0)); body = _empty("body", (0, 0, 0))
    def leg_c(ob):
        xs = [v.co.x for v in ob.data.vertices]; ys = [v.co.y for v in ob.data.vertices]
        return ((min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2)
    E = {"body": body}
    for lg in ("legL", "legR"):
        x, y = leg_c(parts[lg]); E[lg] = _empty(lg, (x, y, p["crotch"] * S))
    E["head"] = _empty("head", (0, _centre_y(parts["head"]), p["neck"] * S))
    for side in ("W", "P"):
        piv, elb, tip = hinges[side]
        E["sh" + side] = _empty("sh" + side, tuple(piv * S))
        E["el" + side] = _empty("el" + side, tuple(elb * S))
    chalk = _empty("chalkW", tuple(hinges["W"][2] * S))
    bpy.context.view_layer.update()
    _attach(body, root)
    for k in ("legL", "legR", "head", "shW", "shP"): _attach(E[k], body)
    _attach(E["elW"], E["shW"]); _attach(E["elP"], E["shP"]); _attach(chalk, E["elW"])
    bpy.context.view_layer.update()
    for name, ob in parts.items(): _attach(ob, E[name])
    for ob in faces:
        _attach(ob, E["head"])
        if ob.name != "mouth_rest": ob.hide_render = True  # default face = as on the sheet, eyes open
    bpy.context.view_layer.update()
    return root, E


def export(cid, root):
    sel = [root] + list(root.children_recursive)
    for o in bpy.data.objects: o.select_set(o in sel)
    out = f"{OUT}\\{cid}.glb"
    bpy.ops.export_scene.gltf(filepath=out, use_selection=True, export_format="GLB", export_animations=False,
                              export_image_format="JPEG", export_jpeg_quality=88, export_yup=True,
                              export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=7,
                              export_draco_position_quantization=14, export_draco_texcoord_quantization=12)
    return out


def build_hinged(cid, p=None):
    p = p or P[cid]
    src = bpy.data.objects["low"]
    low = src.copy(); low.data = src.data.copy(); bpy.context.scene.collection.objects.link(low)
    src.hide_render = True; src.hide_viewport = True; src.name = "low_src"
    bisect(low, p)
    lab, xe = classify(low, p)
    parts = split_parts(low, lab)
    hinges = hang_arms(parts, p, xe)
    faces = face_parts(parts["head"], p)
    root, E = assemble(parts, hinges, p, faces)
    out = export(cid, root)
    return {"glb": out, "bytes": os.path.getsize(out), "parts": {k: len(v.data.polygons) for k, v in parts.items()}}



def measure(low):
    """Arm band, crotch and width profile of a T-pose model (to fill P for a new character)."""
    co = np.empty(len(low.data.vertices) * 3, dtype=np.float32); low.data.vertices.foreach_get("co", co); co = co.reshape(-1, 3)
    xmax = float(np.abs(co[:, 0]).max()); band = []; crotch = None; prof = []
    for z in np.arange(0, 1.0, 0.01):
        s = co[(co[:, 2] >= z) & (co[:, 2] < z + 0.01)]
        if not len(s): continue
        if np.abs(s[:, 0]).max() > 0.8 * xmax: band.append(round(float(z), 2))
        if crotch is None and (np.abs(s[:, 0]) < 0.012).any(): crotch = round(float(z), 2)
        prof.append([round(float(z), 2), round(float(np.abs(s[:, 0]).max()), 3)])
    return {"xmax": round(xmax, 3), "band": [band[0], band[-1] + 0.01] if band else None, "crotch": crotch, "prof": prof}


def analysis_renders(low, prefix, zc=0.75):
    """Flat-colour front + side close-ups of head/shoulders, and full front (2000 px/m for close-ups)."""
    sc = bpy.context.scene
    nt = low.data.materials[0].node_tree
    tex = nt.nodes["Image Texture"]; out = [n for n in nt.nodes if n.type == "OUTPUT_MATERIAL"][0]
    bsdf = [n for n in nt.nodes if n.type == "BSDF_PRINCIPLED"][0]
    em = nt.nodes.new("ShaderNodeEmission")
    nt.links.new(tex.outputs["Color"], em.inputs["Color"]); nt.links.new(em.outputs[0], out.inputs["Surface"])
    ids = [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties["engine"].enum_items]
    sc.render.engine = "BLENDER_EEVEE" if "BLENDER_EEVEE" in ids else "BLENDER_EEVEE_NEXT"
    sc.view_settings.view_transform = "Standard"; sc.render.film_transparent = True
    cam = bpy.data.cameras.new("acam"); cam.type = "ORTHO"; co = bpy.data.objects.new("acam", cam)
    sc.collection.objects.link(co); sc.camera = co
    sc.render.resolution_x = sc.render.resolution_y = 1000
    paths = []
    for nm, loc, rz, sc_ in (("front", (0, -3, zc), 0, 0.5), ("side", (3, 0, zc), 90, 0.5), ("full", (0, -3, 0.5), 0, 1.05)):
        cam.ortho_scale = sc_; co.location = loc; co.rotation_euler = (math.radians(90), 0, math.radians(rz))
        p = ROOT + rf"\public\models\raw\_{prefix}_{nm}.png"; sc.render.filepath = p
        bpy.ops.render.render(write_still=True); paths.append(p)
    nt.links.new(bsdf.outputs[0], out.inputs["Surface"]); nt.nodes.remove(em)
    bpy.data.objects.remove(co, do_unlink=True)
    return paths
