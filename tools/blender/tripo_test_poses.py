# Render hinged-tutor test poses (Blender). Coordinates are stage px (feet at z=0, faces -Y).
import bpy, math
R = math.radians
D = r"C:\Users\Progress service\Desktop\To2\public\models\raw"


def setup(res=(520, 600), scale=900):
    sc = bpy.context.scene
    ids = [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties["engine"].enum_items]
    sc.render.engine = "BLENDER_EEVEE" if "BLENDER_EEVEE" in ids else "BLENDER_EEVEE_NEXT"
    sc.view_settings.view_transform = "Standard"; sc.render.film_transparent = False
    w = bpy.data.worlds.get("w") or bpy.data.worlds.new("w"); sc.world = w; w.use_nodes = True
    bg = w.node_tree.nodes["Background"]; bg.inputs[1].default_value = 1.0; bg.inputs[0].default_value = (0.8, 0.8, 0.82, 1)
    if "sun" not in bpy.data.objects:
        sun = bpy.data.lights.new("sun", "SUN"); sun.energy = 3
        so = bpy.data.objects.new("sun", sun); sc.collection.objects.link(so); so.rotation_euler = (R(50), 0, R(-30))
    co = bpy.data.objects.get("cam")
    if not co:
        cam = bpy.data.cameras.new("cam"); cam.type = "ORTHO"; cam.clip_end = 10000
        co = bpy.data.objects.new("cam", cam); sc.collection.objects.link(co)
    co.data.ortho_scale = scale; sc.camera = co
    sc.render.resolution_x, sc.render.resolution_y = res
    return co


def show_face(mouth="rest", blink=False):
    for o in bpy.data.objects:
        if o.type == "MESH":
            if o.name.startswith("mouth_"): o.hide_render = o.name != f"mouth_{mouth}"
            elif o.name.startswith("lid"): o.hide_render = not blink
            elif o.name == "low_src": o.hide_render = True


def E():
    return {n: bpy.data.objects[n] for n in ["body", "head", "shW", "elW", "shP", "elP", "legL", "legR"]}


def reset():
    for e in E().values(): e.rotation_euler = (0, 0, 0)


POSES = {
    "talk": ({"head": (-4, 0, 12), "shP": (-35, -10, 0), "elP": (-50, 0, 0)}, (-900, -2200, 380), -22),
    "write": ({"shW": (-105, 0, -8), "elW": (-15, 0, 0), "head": (8, 0, -10), "body": (0, 0, -6)}, (800, 2200, 380), 160),
    "wave": ({"shP": (0, -150, 0), "elP": (0, -25, 0), "head": (0, 0, 10), "shW": (0, 8, 0)}, (0, -2400, 380), 0),
    "walk": ({"legL": (25, 0, 0), "legR": (-25, 0, 0), "shW": (-25, 0, 0), "shP": (25, 0, 0)}, (-2400, 0, 380), -90),
}


def render_poses(prefix, names=("talk", "write", "wave", "walk")):
    co = setup(); sc = bpy.context.scene; show_face()
    out = []
    for n in names:
        reset(); rots, loc, rz = POSES[n]; e = E()
        for k, (a, b, c) in rots.items(): e[k].rotation_euler = (R(a), R(b), R(c))
        co.location = loc; co.rotation_euler = (R(90), 0, R(rz))
        p = D + rf"\_{prefix}_{n}.png"; sc.render.filepath = p; bpy.ops.render.render(write_still=True); out.append(p)
    reset()
    return out


def render_mouths(prefix, head_z, face_y=-140):
    co = setup(res=(800, 260), scale=260); sc = bpy.context.scene
    co.location = (0, -2400, head_z); co.rotation_euler = (R(90), 0, 0)
    sc.render.resolution_x, sc.render.resolution_y = 260, 260
    out = []
    for k, (m, b) in enumerate([("rest", False), (0, False), (1, False), (2, False), (3, False), ("rest", True)]):
        show_face(m, b); p = D + rf"\_{prefix}_face{k}.png"; sc.render.filepath = p; bpy.ops.render.render(write_still=True); out.append(p)
    show_face()
    return out
