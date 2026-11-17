# To2 cinematic classroom (Blender). Units = stage px (tutor ≈ 750 tall, feet z=0, faces -Y).
import bpy, bmesh, math, random
from mathutils import Vector as V
R = math.radians
ROOT = r"C:\Users\Progress service\Desktop\To2"


def lin(c): return tuple(v ** 2.2 for v in c) + (1,)


def mat(name, col, rough=0.8, emit=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = lin(col); b.inputs["Roughness"].default_value = rough
    if emit:
        b.inputs["Emission Color"].default_value = lin(col); b.inputs["Emission Strength"].default_value = emit
    return m


def board_mat():
    m = bpy.data.materials.new("chalkboard"); m.use_nodes = True
    nt = m.node_tree; b = nt.nodes["Principled BSDF"]; b.inputs["Roughness"].default_value = 0.93
    tc = nt.nodes.new("ShaderNodeTexCoord")
    n1 = nt.nodes.new("ShaderNodeTexNoise"); n1.inputs["Scale"].default_value = 3.0; n1.inputs["Detail"].default_value = 6
    n2 = nt.nodes.new("ShaderNodeTexNoise"); n2.inputs["Scale"].default_value = 0.9; n2.inputs["Detail"].default_value = 3
    w = nt.nodes.new("ShaderNodeTexWave"); w.wave_type = "RINGS"; w.inputs["Scale"].default_value = 0.6; w.inputs["Distortion"].default_value = 6
    for n in (n1, n2, w): nt.links.new(tc.outputs["Object"], n.inputs["Vector"])
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].position = 0.45; ramp.color_ramp.elements[0].color = lin((0.10, 0.20, 0.15))
    ramp.color_ramp.elements[1].position = 0.85; ramp.color_ramp.elements[1].color = lin((0.27, 0.36, 0.31))
    mix = nt.nodes.new("ShaderNodeMath"); mix.operation = "MULTIPLY"
    nt.links.new(n1.outputs["Fac"], mix.inputs[0]); nt.links.new(w.outputs["Fac"], mix.inputs[1])
    add = nt.nodes.new("ShaderNodeMath"); add.operation = "ADD"
    nt.links.new(mix.outputs[0], add.inputs[0]); nt.links.new(n2.outputs["Fac"], add.inputs[1])
    sc_ = nt.nodes.new("ShaderNodeMath"); sc_.operation = "MULTIPLY"; sc_.inputs[1].default_value = 0.62
    nt.links.new(add.outputs[0], sc_.inputs[0]); nt.links.new(sc_.outputs[0], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], b.inputs["Base Color"])
    return m


def box(name, size, loc, m, bev=0.0, rot=(0, 0, 0)):
    bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1)
    bmesh.ops.scale(bm, vec=V(size), verts=bm.verts)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(ob)
    ob.location = loc; ob.rotation_euler = rot; me.materials.append(m)
    if bev:
        b = ob.modifiers.new("b", "BEVEL"); b.width = bev; b.segments = 3; b.limit_method = "ANGLE"
    return ob


def cyl(name, r, h, loc, m, rot=(0, 0, 0), verts=24):
    bm = bmesh.new(); bmesh.ops.create_cone(bm, cap_ends=True, segments=verts, radius1=r, radius2=r, depth=h)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(ob)
    ob.location = loc; ob.rotation_euler = rot; me.materials.append(m)
    return ob


def build_room():
    rnd = random.Random(4)
    wall = mat("wall", (0.95, 0.86, 0.70), 0.9); pan = mat("panel", (0.52, 0.33, 0.20), 0.6); trim = mat("trim", (0.42, 0.26, 0.15), 0.5)
    box("wall", (5000, 20, 2600), (0, 450, 1200), wall)
    box("wainscot", (5000, 30, 400), (0, 432, 200), pan, 4)
    box("rail", (5000, 50, 26), (0, 420, 404), trim, 4)
    box("crown", (5000, 50, 40), (0, 425, 1640), trim, 4)
    for i in range(-12, 13):
        box(f"pl{i}", (8, 34, 330), (i * 200, 418, 200), trim)
    # wooden floor planks
    for i in range(-14, 15):
        c = (0.56 + rnd.uniform(-0.05, 0.05), 0.37 + rnd.uniform(-0.04, 0.04), 0.22)
        box(f"floor{i}", (170, 2600, 20), (i * 172, -800, -10), mat(f"fl{i}", c, 0.55), 2)
    # chalkboard
    wood = mat("bwood", (0.46, 0.28, 0.14), 0.5)
    box("bframe_t", (1320, 50, 46), (620, 410, 1160), wood, 8); box("bframe_b", (1320, 50, 46), (620, 410, 360), wood, 8)
    box("bframe_l", (46, 50, 846), (-17, 410, 760), wood, 8); box("bframe_r", (46, 50, 846), (1257, 410, 760), wood, 8)
    box("board", (1240, 30, 760), (620, 418, 760), board_mat())
    box("tray", (1300, 90, 22), (620, 380, 330), wood, 5)
    chalk = mat("chalk", (0.97, 0.96, 0.92), 0.95)
    for i, (x, rz) in enumerate([(300, 8), (340, -12), (1050, 4)]):
        cyl(f"chalk{i}", 7, 60, (x, 372, 348), chalk, rot=(0, R(90), R(rz)), verts=12)
    box("eraser_w", (120, 46, 24), (820, 372, 352), mat("erw", (0.55, 0.36, 0.2), 0.6), 4)
    box("eraser_f", (120, 46, 14), (820, 372, 336), mat("erf", (0.3, 0.3, 0.32), 1.0), 3)
    # board lamp
    metal = mat("lamp", (0.18, 0.2, 0.24), 0.35)
    box("lamp_arm", (16, 140, 16), (620, 340, 1240), metal); box("lamp_head", (520, 60, 40), (620, 270, 1230), metal, 10)
    box("lamp_glow", (500, 10, 12), (620, 270, 1208), mat("glow", (1.0, 0.9, 0.7), 0.3, 6.0))
    # window (left), sky glows
    wf = mat("wframe", (0.97, 0.96, 0.93), 0.6)
    box("win_frame", (460, 40, 600), (-700, 425, 1000), wf, 6)
    box("win_sky", (410, 44, 550), (-700, 420, 1000), mat("sky", (0.70, 0.86, 1.0), 0.3, 1.6))
    box("win_bar_v", (16, 48, 550), (-700, 416, 1000), wf); box("win_bar_h", (410, 48, 16), (-700, 416, 1000), wf)
    box("sill", (500, 80, 24), (-700, 400, 700), wf, 4)
    # shelf + books under the window
    box("shelf", (520, 160, 24), (-700, 360, 560), wood, 4)
    cols = [(0.85, 0.30, 0.25), (0.25, 0.45, 0.80), (0.95, 0.75, 0.25), (0.30, 0.65, 0.35), (0.60, 0.35, 0.70), (0.9, 0.5, 0.2)]
    x = -930
    for i, c in enumerate(cols):
        h = 110 + (i * 37) % 50; wdt = 34 + (i * 13) % 14
        box(f"book{i}", (wdt, 120, h), (x, 360, 572 + h / 2), mat(f"bk{i}", c, 0.6), 2, rot=(0, R(-6 if i == 5 else 0), 0)); x += wdt + 6
    cyl("globe", 55, 110, (-520, 360, 640), mat("globe", (0.3, 0.6, 0.9), 0.4), verts=32)
    # clock + poster
    cyl("clock", 70, 16, (-120, 432, 1320), mat("clockf", (0.98, 0.97, 0.94), 0.5), rot=(R(90), 0, 0), verts=40)
    cyl("clockr", 78, 12, (-120, 436, 1320), trim, rot=(R(90), 0, 0), verts=40)
    box("hand1", (6, 4, 52), (-120, 422, 1340), metal, rot=(0, R(30), 0)); box("hand2", (6, 4, 40), (-120, 420, 1312), metal, rot=(0, R(-60), 0))
    box("poster", (230, 10, 300), (1560, 440, 1050), mat("poster", (0.98, 0.94, 0.82), 0.8), 3)
    box("poster_pi", (120, 12, 150), (1560, 436, 1070), mat("pi", (0.25, 0.45, 0.9), 0.5), 4)
    # plant
    box("pot", (150, 150, 160), (1500, 260, 80), mat("pot", (0.80, 0.45, 0.30), 0.6), 10)
    leaf = mat("leaf", (0.24, 0.58, 0.26), 0.6)
    for i, (dx, dy, h, rx) in enumerate([(0, 0, 300, 0), (-40, 10, 230, 14), (40, -10, 250, -12), (10, 30, 200, 20), (-20, -30, 210, -18)]):
        box(f"leaf{i}", (34, 34, h), (1500 + dx, 260 + dy, 160 + h / 2), leaf, 8, rot=(R(rx), R(rx * .6), 0))


def lights_camera(res=(780, 900)):
    sc = bpy.context.scene
    ids = [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties["engine"].enum_items]
    sc.render.engine = "BLENDER_EEVEE" if "BLENDER_EEVEE" in ids else "BLENDER_EEVEE_NEXT"
    try:
        sc.view_settings.view_transform = "AgX"; sc.view_settings.look = "AgX - Medium High Contrast"
    except Exception:
        sc.view_settings.view_transform = "Filmic"
    sc.view_settings.exposure = 0.35
    try:
        sc.eevee.use_raytracing = True; sc.eevee.use_shadows = True; sc.eevee.fast_gi_method = "GLOBAL_ILLUMINATION"
    except Exception:
        pass
    w = bpy.data.worlds.new("roomw"); sc.world = w; w.use_nodes = True
    bg = w.node_tree.nodes["Background"]; bg.inputs[0].default_value = (0.55, 0.62, 0.8, 1); bg.inputs[1].default_value = 0.18
    def light(name, kind, energy, loc, rot, col=(1, 1, 1), size=None, spot=None):
        l = bpy.data.lights.new(name, kind); l.energy = energy; l.color = col
        if size is not None: l.size = size
        if spot: l.spot_size = R(spot); l.spot_blend = 0.6
        o = bpy.data.objects.new(name, l); sc.collection.objects.link(o); o.location = loc; o.rotation_euler = rot
        return o
    # warm window key from the left, cool fill from the right, board lamp, rim behind the tutor
    light("key", "AREA", 3.2e7, (-1500, -900, 1500), (R(55), 0, R(-55)), (1.0, 0.82, 0.62), size=900)
    light("fill", "AREA", 6e6, (1700, -1600, 900), (R(70), 0, R(45)), (0.65, 0.78, 1.0), size=1400)
    light("boardlamp", "SPOT", 1.6e7, (620, 250, 1200), (R(20), 0, 0), (1.0, 0.88, 0.7), spot=95)
    light("rim", "SPOT", 1.2e7, (-150, 700, 1300), (R(-40), 0, R(180)), (1.0, 0.9, 0.8), spot=40)
    cam = bpy.data.cameras.new("roomcam"); cam.lens = 35; cam.clip_end = 30000
    cam.dof.use_dof = True; cam.dof.aperture_fstop = 5.6; cam.dof.focus_distance = 1750
    co = bpy.data.objects.new("roomcam", cam); sc.collection.objects.link(co); sc.camera = co
    co.location = (260, -1600, 700); tgt = V((300, 300, 680)); co.rotation_euler = (tgt - co.location).to_track_quat("-Z", "Y").to_euler()
    sc.render.resolution_x, sc.render.resolution_y = res
    sc.render.film_transparent = False
    return co


def board_corners(co):
    from bpy_extras.object_utils import world_to_camera_view
    sc = bpy.context.scene
    return {k: [round(v.x, 4), round(1 - v.y, 4)] for k, v in
            {k: world_to_camera_view(sc, co, V(p)) for k, p in {"tl": (0, 403, 1140), "br": (1240, 403, 380)}.items()}.items()}
