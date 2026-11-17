# To2 — Tripo GLB → web tutor GLB (Blender 5.x, run inside Blender via MCP or the Text editor).
#
#   raw (1.9M tris, Tripo) → decimate → fresh UVs → bake Tripo's colours onto it (no seam specks)
#   → armature with per-character joints → rigid voxel parts (cut at joints) → Draco GLB
#
# Usage:  exec(open(r"...\tools\blender\tripo_pipeline.py").read()); build("blokbek", JOINTS["blokbek"])
import bpy, bmesh, math, os
from collections import Counter
from mathutils import Vector as V
import numpy as np

ROOT = r"C:\Users\Progress service\Desktop\To2"
RAW = ROOT + r"\public\models\raw"
OUT = ROOT + r"\public\models\tripo"
TEX = 2048

# Joint positions in Blender metres (Tripo models: feet at z=0, facing -Y, ~0.98 m tall).
# R = character's right (screen-left when it faces you).
JOINTS = {
    "blokbek": {
        "hips": ((0.01, 0.03, 0.30), (0.01, 0.03, 0.46)),
        "spine": ((0.01, 0.03, 0.46), (0.01, 0.03, 0.63)),
        "head": ((0.02, 0.02, 0.64), (0.02, 0.02, 0.97)),
        "upperarm.R": ((-0.22, 0.03, 0.60), (-0.23, 0.03, 0.45)),
        "forearm.R": ((-0.23, 0.03, 0.45), (-0.23, 0.03, 0.24)),
        "upperarm.L": ((0.22, 0.03, 0.60), (0.24, 0.04, 0.46)),
        "forearm.L": ((0.24, 0.04, 0.46), (0.24, -0.19, 0.50)),
        "thigh.R": ((-0.11, 0.04, 0.30), (-0.11, 0.04, 0.01)),
        "thigh.L": ((0.13, 0.04, 0.30), (0.13, 0.04, 0.01)),
        # region limits used to classify each face
        "_lim": {"armR_x": -0.146, "armL_x": 0.158, "armR_z": (0.24, 0.645), "armL_z": (0.36, 0.645),
                 "leg_top": 0.30, "leg_split_x": 0.02, "neck": 0.702, "head_halfw": 0.21, "waist": 0.46},
    },
}
PARENT = {"spine": "hips", "head": "spine", "upperarm.R": "spine", "forearm.R": "upperarm.R",
          "upperarm.L": "spine", "forearm.L": "upperarm.L", "thigh.R": "hips", "thigh.L": "hips"}


def _segd(p, a, b):
    a = V(a); b = V(b); ab = b - a
    t = max(0.0, min(1.0, (p - a).dot(ab) / ab.length_squared))
    return (p - (a + ab * t)).length


def _cls(p, J):
    L = J["_lim"]
    if p.x < L["armR_x"] and L["armR_z"][0] < p.z < L["armR_z"][1]:
        return "upperarm.R" if _segd(p, *J["upperarm.R"]) <= _segd(p, *J["forearm.R"]) else "forearm.R"
    if p.x > L["armL_x"] and L["armL_z"][0] < p.z < L["armL_z"][1]:
        return "upperarm.L" if _segd(p, *J["upperarm.L"]) <= _segd(p, *J["forearm.L"]) else "forearm.L"
    if p.z < L["leg_top"]:
        return "thigh.R" if p.x < L["leg_split_x"] else "thigh.L"
    if p.z >= L["neck"] and abs(p.x) < L["head_halfw"]:
        return "head"
    return "spine" if p.z > L["waist"] else "hips"


def _clear():
    for o in list(bpy.data.objects): bpy.data.objects.remove(o, do_unlink=True)
    for coll in (bpy.data.meshes, bpy.data.armatures, bpy.data.materials, bpy.data.images, bpy.data.cameras, bpy.data.lights):
        for d in list(coll):
            if d.users == 0: coll.remove(d)


def load_raw(cid):
    _clear()
    bpy.ops.import_scene.gltf(filepath=f"{RAW}\\{cid}.glb")
    raw = [o for o in bpy.data.objects if o.type == "MESH"][0]
    raw.name = "raw"
    return raw


def make_low(raw, ratio=0.025):
    low = raw.copy(); low.data = raw.data.copy(); low.name = "low"
    bpy.context.scene.collection.objects.link(low)
    m = low.modifiers.new("dec", "DECIMATE"); m.ratio = ratio
    bpy.context.view_layer.objects.active = low
    for o in bpy.context.view_layer.objects: o.select_set(False)
    low.select_set(True)
    bpy.ops.object.modifier_apply(modifier="dec")
    # fresh UVs
    while low.data.uv_layers: low.data.uv_layers.remove(low.data.uv_layers[0])
    low.data.uv_layers.new(name="UV")
    bpy.ops.object.mode_set(mode="EDIT"); bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.006)
    bpy.ops.object.mode_set(mode="OBJECT")
    return low


def bake_colour(raw, low, cid):
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"; sc.cycles.samples = 1
    try:
        sc.cycles.device = "GPU"
    except Exception:
        pass
    img = bpy.data.images.new(f"{cid}_tex", TEX, TEX, alpha=False)
    mat = bpy.data.materials.new(f"{cid}_mat"); mat.use_nodes = True
    nt = mat.node_tree; bsdf = nt.nodes["Principled BSDF"]
    bsdf.inputs["Roughness"].default_value = 0.85; bsdf.inputs["Metallic"].default_value = 0.0
    tn = nt.nodes.new("ShaderNodeTexImage"); tn.image = img
    nt.links.new(tn.outputs["Color"], bsdf.inputs["Base Color"])
    low.data.materials.clear(); low.data.materials.append(mat)
    nt.nodes.active = tn
    for o in bpy.context.view_layer.objects: o.select_set(False)
    raw.select_set(True); low.select_set(True); bpy.context.view_layer.objects.active = low
    bk = sc.render.bake
    bk.use_selected_to_active = True; bk.cage_extrusion = 0.012; bk.max_ray_distance = 0.04
    bk.use_pass_direct = False; bk.use_pass_indirect = False; bk.use_pass_color = True
    bk.margin = 10
    bpy.ops.object.bake(type="DIFFUSE")
    os.makedirs(OUT, exist_ok=True)
    img.filepath_raw = f"{OUT}\\{cid}_tex.jpg"; img.file_format = "JPEG"; img.save()
    return img


def rig(low, cid, J):
    arm = bpy.data.armatures.new(f"{cid}_rig"); ao = bpy.data.objects.new(cid, arm)
    bpy.context.scene.collection.objects.link(ao)
    bpy.context.view_layer.objects.active = ao
    bpy.ops.object.mode_set(mode="EDIT")
    for n in ["hips", "spine", "head", "upperarm.R", "forearm.R", "upperarm.L", "forearm.L", "thigh.R", "thigh.L"]:
        b = arm.edit_bones.new(n); b.head = V(J[n][0]); b.tail = V(J[n][1])
        if n in PARENT: b.parent = arm.edit_bones[PARENT[n]]
    bpy.ops.object.mode_set(mode="OBJECT")
    names = list(PARENT.keys()) + ["hips"]
    for n in names: low.vertex_groups.new(name=n)
    gidx = {g.name: g.index for g in low.vertex_groups}

    # colour of each face (from the baked texture) — skin blocks next to the body belong to the hand
    img = low.data.materials[0].node_tree.nodes["Image Texture"].image
    W, H = img.size
    px = np.empty(W * H * 4, dtype=np.float32); img.pixels.foreach_get(px); px = px.reshape(H, W, 4)

    bm = bmesh.new(); bm.from_mesh(low.data)
    uvl = bm.loops.layers.uv.active
    lay = bm.faces.layers.int.new("g")
    L = J["_lim"]
    for f in bm.faces:
        g = Counter(_cls(v.co, J) for v in f.verts).most_common(1)[0][0]
        c = f.calc_center_median()
        # hand blocks hugging the hip / chest: skin coloured → arm on that side
        if g in ("hips", "spine", "thigh.R", "thigh.L") and L["armR_z"][0] - 0.04 < c.z < L["neck"]:
            u = sum(l[uvl].uv.x for l in f.loops) / len(f.loops); v = sum(l[uvl].uv.y for l in f.loops) / len(f.loops)
            r, gg, b, _ = px[min(H - 1, int(v * H)), min(W - 1, int(u * W))]
            skin = r > 0.35 and r > b * 1.4 and gg > 0.2
            if skin and c.x < L["armR_x"] + 0.06: g = "forearm.R"
            elif skin and c.x > L["armL_x"] - 0.06: g = "forearm.L"
        f[lay] = gidx[g]
    cut = [e for e in bm.edges if len(e.link_faces) >= 2 and len({f[lay] for f in e.link_faces}) > 1]
    bmesh.ops.split_edges(bm, edges=cut)
    loose = [v for v in bm.verts if not v.link_faces]
    bmesh.ops.delete(bm, geom=loose, context="VERTS")
    dl = bm.verts.layers.deform.verify()
    for f in bm.faces:
        for v in f.verts:
            v[dl].clear(); v[dl][f[lay]] = 1.0
    bm.to_mesh(low.data); bm.free()
    low.parent = ao
    md = low.modifiers.new("arm", "ARMATURE"); md.object = ao
    low.name = f"{cid}_mesh"
    return ao


# Real joints bend smoothly; parts that only TOUCH (hand on hip, inner arm on torso side) are cut.
JOINT_PAIRS = {frozenset(p) for p in [("head", "spine"), ("spine", "hips"), ("upperarm.R", "spine"), ("upperarm.L", "spine"),
                                       ("forearm.R", "upperarm.R"), ("forearm.L", "upperarm.L"), ("thigh.R", "hips"), ("thigh.L", "hips"),
                                       ("thigh.R", "thigh.L")]}


def rig_smooth(low, cid, J, smooth_repeat=6, armpit_drop=0.07):
    """Like rig(), but blends weights across real joints instead of cutting there."""
    arm = bpy.data.armatures.new(f"{cid}_rig"); ao = bpy.data.objects.new(cid, arm)
    bpy.context.scene.collection.objects.link(ao)
    bpy.context.view_layer.objects.active = ao
    bpy.ops.object.mode_set(mode="EDIT")
    for n in ["hips", "spine", "head", "upperarm.R", "forearm.R", "upperarm.L", "forearm.L", "thigh.R", "thigh.L"]:
        b = arm.edit_bones.new(n); b.head = V(J[n][0]); b.tail = V(J[n][1])
        if n in PARENT: b.parent = arm.edit_bones[PARENT[n]]
    bpy.ops.object.mode_set(mode="OBJECT")
    names = ["hips"] + list(PARENT.keys())
    for n in names: low.vertex_groups.new(name=n)
    gname = {g.index: g.name for g in low.vertex_groups}
    gidx = {v: k for k, v in gname.items()}

    img = low.data.materials[0].node_tree.nodes["Image Texture"].image
    W, H = img.size
    px = np.empty(W * H * 4, dtype=np.float32); img.pixels.foreach_get(px); px = px.reshape(H, W, 4)
    L = J["_lim"]
    shoulder_z = {"upperarm.R": J["upperarm.R"][0][2], "upperarm.L": J["upperarm.L"][0][2]}

    bm = bmesh.new(); bm.from_mesh(low.data)
    uvl = bm.loops.layers.uv.active
    lay = bm.faces.layers.int.new("g")
    for f in bm.faces:
        g = Counter(_cls(v.co, J) for v in f.verts).most_common(1)[0][0]
        c = f.calc_center_median()
        if g in ("hips", "spine", "thigh.R", "thigh.L") and L["armR_z"][0] - 0.04 < c.z < L["neck"]:
            u = sum(l[uvl].uv.x for l in f.loops) / len(f.loops); v = sum(l[uvl].uv.y for l in f.loops) / len(f.loops)
            r, gg, b, _ = px[min(H - 1, int(v * H)), min(W - 1, int(u * W))]
            skin = r > 0.35 and r > b * 1.4 and gg > 0.2
            if skin and c.x < L["armR_x"] + 0.06: g = "forearm.R"
            elif skin and c.x > L["armL_x"] - 0.06: g = "forearm.L"
        f[lay] = gidx[g]

    def cut_here(e):
        gs = {gname[f[lay]] for f in e.link_faces}
        if len(gs) < 2: return False
        if len(gs) > 2: return True
        pair = frozenset(gs)
        if pair not in JOINT_PAIRS: return True          # hand vs hip, forearm vs torso, ...
        for a in ("upperarm.R", "upperarm.L"):            # arm vs torso: blend only at the shoulder
            if a in gs and "spine" in gs:
                z = (e.verts[0].co.z + e.verts[1].co.z) / 2
                return z < shoulder_z[a] - armpit_drop
        return False

    cut = [e for e in bm.edges if len(e.link_faces) >= 2 and cut_here(e)]
    bmesh.ops.split_edges(bm, edges=cut)
    loose = [v for v in bm.verts if not v.link_faces]
    bmesh.ops.delete(bm, geom=loose, context="VERTS")
    dl = bm.verts.layers.deform.verify()
    for v in bm.verts:
        cnt = Counter(f[lay] for f in v.link_faces)
        tot = sum(cnt.values())
        v[dl].clear()
        for gi, k in cnt.items(): v[dl][gi] = k / tot
    bm.to_mesh(low.data); bm.free()

    # smooth weights along the surface (only across uncut edges → joints blend, cuts stay sharp)
    for o in bpy.context.view_layer.objects: o.select_set(False)
    low.select_set(True); bpy.context.view_layer.objects.active = low
    bpy.ops.object.mode_set(mode="WEIGHT_PAINT")
    bpy.ops.object.vertex_group_smooth(group_select_mode="ALL", factor=0.5, repeat=smooth_repeat)
    bpy.ops.object.vertex_group_limit_total(group_select_mode="ALL", limit=4)
    bpy.ops.object.vertex_group_normalize_all(group_select_mode="ALL", lock_active=False)
    bpy.ops.object.mode_set(mode="OBJECT")

    low.parent = ao
    md = low.modifiers.new("arm", "ARMATURE"); md.object = ao
    low.name = f"{cid}_mesh"
    return ao


def export(cid, ao, low):
    for o in bpy.context.view_layer.objects: o.select_set(False)
    ao.select_set(True); low.select_set(True)
    out = f"{OUT}\\{cid}.glb"
    bpy.ops.export_scene.gltf(filepath=out, use_selection=True, export_format="GLB", export_skins=True,
                              export_animations=False, export_image_format="JPEG", export_jpeg_quality=85,
                              export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=7,
                              export_draco_position_quantization=14, export_draco_texcoord_quantization=12)
    return out


def build(cid, J=None):
    J = J or JOINTS[cid]
    raw = load_raw(cid)
    low = make_low(raw)
    bake_colour(raw, low, cid)
    bpy.data.objects.remove(raw, do_unlink=True)
    ao = rig_smooth(low, cid, J)
    out = export(cid, ao, low)
    bpy.ops.wm.save_as_mainfile(filepath=f"{OUT}\\{cid}.blend")
    return {"glb": out, "bytes": os.path.getsize(out), "tris": sum(len(p.vertices) - 2 for p in low.data.polygons)}



def export_static(cid, low):
    """No skeleton: the tutor moves as one solid figure (turn, walk, bob, bounce) — nothing can tear."""
    low.name = f"{cid}_mesh"
    for o in bpy.data.objects: o.select_set(o == low)
    out = f"{OUT}\\{cid}.glb"
    bpy.ops.export_scene.gltf(filepath=out, use_selection=True, export_format="GLB", export_animations=False,
                              export_image_format="JPEG", export_jpeg_quality=88,
                              export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=7,
                              export_draco_position_quantization=14, export_draco_texcoord_quantization=12)
    return out


def build_static(cid, ratio=0.045):
    raw = load_raw(cid)
    low = make_low(raw, ratio)
    bake_colour(raw, low, cid)
    bpy.data.objects.remove(raw, do_unlink=True)
    out = export_static(cid, low)
    return {"glb": out, "bytes": os.path.getsize(out), "tris": sum(len(p.vertices) - 2 for p in low.data.polygons)}
