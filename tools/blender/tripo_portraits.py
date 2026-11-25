# Render UI portraits of a hinged tutor (open <id>_hinged.blend first). Transparent PNGs:
# public/characters/<id>_<pose>_{full 600x800, half 600x600, face 240x240}.png
import bpy, math, os
R = math.radians
ROOT = r"C:\Users\Progress service\Desktop\To2"

POSES = {
    "idle":   ({"shW": (0, 7, 0), "shP": (0, -7, 0), "head": (0, 0, 6)}, "rest"),
    "wave":   ({"shP": (0, -150, 0), "elP": (0, -22, 0), "shW": (0, 6, 0), "head": (0, 0, 10)}, "rest"),
    "thumbs": ({"shP": (-70, -38, 0), "elP": (-95, 0, 0), "shW": (0, 6, 0), "head": (-3, 0, 8)}, "rest"),
    "cheer":  ({"shP": (0, -162, 0), "elP": (0, -14, 0), "shW": (0, 162, 0), "elW": (0, 14, 0), "head": (-6, 0, 0)}, "rest"),
    "board":  ({"shP": (-40, -95, 0), "elP": (0, -20, 0), "shW": (0, 6, 0), "head": (-2, 0, 16)}, "rest"),
    "point":  ({"shP": (-80, -52, 0), "elP": (-6, 0, 0), "shW": (0, 6, 0), "head": (-4, 0, 10)}, "rest"),
}
FRAMES = {"full": ((600, 800), 960, 450), "half": ((600, 600), 560, 560), "face": ((240, 240), 300, None)}


THINK = {  # same as class_tutor.THINK (quiz "thinking" poses, half frame only)
    "think1": ({"shP": (-38, -6, 0), "elP": (-128, 0, 0), "shW": (0, 6, 0), "head": (-6, 9, 10)}, "rest"),
    "think2": ({"shP": (-150, -40, 0), "elP": (-105, 0, 0), "shW": (0, 6, 0), "head": (5, -9, -6)}, "rest"),
}

# M7 (25 Nov): Standard view + a hard 3.6 W key crushed the skin into orange/brown. AgX keeps skin tones,
# a soft (wide-angle) key + a front fill lift the shadow side. Tune EXPOSURE if a whole set looks dim.
VIEW = "AgX"          # Blender 4.0+; falls back to Filmic on older builds
EXPOSURE = 0.35
LIGHTS = (  # name, energy, rotation, sun angle (softness)
    ("key", 2.6, (R(50), 0, R(-35)), R(30)),
    ("fill", 0.9, (R(75), 0, R(25)), R(60)),
    ("rim", 1.2, (R(60), 0, R(150)), R(10)),
)


def setup():
    sc = bpy.context.scene
    ids = [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties["engine"].enum_items]
    sc.render.engine = "BLENDER_EEVEE" if "BLENDER_EEVEE" in ids else "BLENDER_EEVEE_NEXT"
    vts = [e.identifier for e in sc.view_settings.bl_rna.properties["view_transform"].enum_items]
    sc.view_settings.view_transform = VIEW if VIEW in vts else "Filmic"
    sc.view_settings.look = "None"; sc.view_settings.exposure = EXPOSURE
    sc.render.film_transparent = True
    sc.render.image_settings.file_format = "PNG"; sc.render.image_settings.color_mode = "RGBA"
    w = bpy.data.worlds.get("pw") or bpy.data.worlds.new("pw"); sc.world = w; w.use_nodes = True
    bg = w.node_tree.nodes["Background"]; bg.inputs[1].default_value = 0.7; bg.inputs[0].default_value = (0.9, 0.92, 1.0, 1)
    for n, e, rot, ang in LIGHTS:
        o = bpy.data.objects.get(n)
        if not o or o.type != "LIGHT":
            l = bpy.data.lights.new(n, "SUN")
            o = bpy.data.objects.new(n, l); sc.collection.objects.link(o)
        o.data.energy = e; o.data.angle = ang; o.rotation_euler = rot; o.hide_render = False
    co = bpy.data.objects.get("pcam")
    if not co:
        cam = bpy.data.cameras.new("pcam"); cam.type = "ORTHO"; cam.clip_end = 20000
        co = bpy.data.objects.new("pcam", cam); sc.collection.objects.link(co)
    sc.camera = co
    for o in bpy.data.objects:
        if o.name in ("low_src",) or o.name.startswith("cam"): o.hide_render = True
    return co


def face(m):
    for o in bpy.data.objects:
        if o.type != "MESH": continue
        if o.name.startswith("mouth_"): o.hide_render = o.name != f"mouth_{m}"
        elif o.name.startswith("lid"): o.hide_render = True


def render_all(cid, poses=None, yaw=-18, frames=None):
    co = setup(); sc = bpy.context.scene
    E = {n: bpy.data.objects[n] for n in ["tutor", "body", "head", "shW", "elW", "shP", "elP", "legL", "legR"]}
    for e in E.values(): e.rotation_mode = "XYZ"
    E["tutor"].rotation_euler = (0, 0, R(yaw))  # three-quarter view toward the viewer's right
    head_z = E["head"].matrix_world.translation.z
    out = []
    for pose, (rots, mouth) in (poses or POSES).items():
        for n in ["body", "head", "shW", "elW", "shP", "elP", "legL", "legR"]: E[n].rotation_euler = (0, 0, 0)
        for k, v in rots.items(): E[k].rotation_euler = tuple(R(a) for a in v)
        face(mouth); bpy.context.view_layer.update()
        for fr, ((w, h), scale, cz) in FRAMES.items():
            if frames and fr not in frames: continue
            sc.render.resolution_x, sc.render.resolution_y = w, h
            co.data.ortho_scale = scale
            z = cz if cz is not None else head_z + 95
            co.location = (0, -4000, z); co.rotation_euler = (R(90), 0, 0)
            p = rf"{ROOT}\public\characters\{cid}_{pose}_{fr}.png"
            sc.render.filepath = p; bpy.ops.render.render(write_still=True); out.append(p)
            # WebP twins: `node scripts/characters-manifest.mjs` (runs in `pnpm build`) remakes any WebP older than its PNG
    E["tutor"].rotation_euler = (0, 0, 0)
    return out
