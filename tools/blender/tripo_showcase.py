# To2: showcase animation of the hinged Tripo tutors (Blender). Loads the exported GLBs, so it also
# proves the files work. Renders PNG frames to public/models/raw/_show/.
import bpy, math, random, os
R = math.radians
ROOT = r"C:\Users\Progress service\Desktop\To2"
NODES = ["tutor", "body", "head", "shW", "elW", "shP", "elP", "legL", "legR"]


def clear():
    for o in list(bpy.data.objects): bpy.data.objects.remove(o, do_unlink=True)


def load(cid, x):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=rf"{ROOT}\public\models\tripo\{cid}.glb")
    new = [o for o in bpy.data.objects if o not in before]
    def base(n): return n.split(".")[0]
    C = {base(o.name): o for o in new}
    for n in NODES: C[n].rotation_mode = "XYZ"; C[n].rotation_euler = (0, 0, 0)
    C["tutor"].location = (x, 0, 0)
    C["mouths"] = [C[f"mouth_{k}"] for k in range(4)] + [C["mouth_rest"]]
    C["lids"] = [C["lid_L"], C["lid_R"]]
    return C


def stage():
    sc = bpy.context.scene
    ids = [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties["engine"].enum_items]
    sc.render.engine = "BLENDER_EEVEE" if "BLENDER_EEVEE" in ids else "BLENDER_EEVEE_NEXT"
    sc.view_settings.view_transform = "Standard"; sc.render.film_transparent = False
    w = bpy.data.worlds.get("w") or bpy.data.worlds.new("w"); sc.world = w; w.use_nodes = True
    bg = w.node_tree.nodes["Background"]; bg.inputs[1].default_value = 0.9; bg.inputs[0].default_value = (0.86, 0.85, 0.9, 1)
    sun = bpy.data.lights.new("sun", "SUN"); sun.energy = 3.2
    so = bpy.data.objects.new("sun", sun); sc.collection.objects.link(so); so.rotation_euler = (R(50), 0, R(-25))
    # chalkboard behind the tutors (they face -Y; the board is at +Y)
    def box(name, size, loc, col):
        me = bpy.data.meshes.new(name)
        import bmesh
        bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1.0); bm.to_mesh(me); bm.free()
        ob = bpy.data.objects.new(name, me); sc.collection.objects.link(ob)
        ob.scale = size; ob.location = loc
        m = bpy.data.materials.new(name + "_m"); m.use_nodes = True
        m.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = col
        m.node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value = 0.9
        me.materials.append(m)
        return ob
    box("frame", (2700, 30, 880), (0, 330, 640), (0.36, 0.22, 0.12, 1))
    box("board", (2600, 30, 780), (0, 312, 640), (0.08, 0.2, 0.15, 1))
    box("floor", (4000, 2000, 10), (0, 0, -5), (0.78, 0.74, 0.7, 1))
    cam = bpy.data.cameras.new("cam"); cam.type = "ORTHO"; cam.ortho_scale = 2500; cam.clip_end = 20000
    co = bpy.data.objects.new("cam", cam); sc.collection.objects.link(co); sc.camera = co
    co.location = (0, -4000, 900); co.rotation_euler = (R(84), 0, 0)
    sc.render.resolution_x, sc.render.resolution_y = 1280, 720
    sc.frame_start, sc.frame_end, sc.render.fps = 1, 216, 24


def choreograph(C, style, off, seed):
    rnd = random.Random(seed)
    T = C["tutor"]; x0 = T.location.x
    def K(f, n, rot=None, loc=None):
        f = max(1, f + off); o = C[n]
        if rot is not None: o.rotation_euler = tuple(R(a) for a in rot); o.keyframe_insert("rotation_euler", frame=f)
        if loc is not None: o.location = loc; o.keyframe_insert("location", frame=f)
    def rest(f, keep=()):
        for n in NODES[1:]:
            if n not in keep: K(f, n, rot=(0, 0, 0))
    def face(f, m, blink=False):
        f = max(1, f + off)
        for i, o in enumerate(C["mouths"]):
            o.hide_render = not ((m == "rest" and i == 4) or m == i); o.keyframe_insert("hide_render", frame=f)
        for o in C["lids"]: o.hide_render = not blink; o.keyframe_insert("hide_render", frame=f)
    def talk(a, b):
        f = a
        while f < b - 3:
            face(f, rnd.choice([0, 1, 2, 3, 2, 1])); f += rnd.choice([3, 3, 4, 5])
        face(b, "rest")
    def blink(f):
        face(f, "rest", True); face(f + 3, "rest", False)
    # 1–48: talk to the learner
    K(1, "tutor", rot=(0, 0, 0), loc=(x0, 0, 0)); rest(1)
    talk(4, 46); blink(26)
    K(12, "shP", rot=(-40, -10, 0)); K(12, "elP", rot=(-60, 0, 0)); K(12, "head", rot=(-4, 0, 10))
    K(26, "shP", rot=(-28, -6, 0)); K(26, "elP", rot=(-45, 0, 0)); K(26, "head", rot=(3, 0, -8))
    K(40, "shP", rot=(-45, -14, 0)); K(40, "elP", rot=(-70, 0, 0)); K(40, "head", rot=(-3, 0, 6))
    rest(50)
    # 50–62: hop round to the board
    K(50, "tutor", rot=(0, 0, 0), loc=(x0, 0, 0)); K(56, "tutor", rot=(0, 0, 90), loc=(x0, 0, 40)); K(62, "tutor", rot=(0, 0, 180), loc=(x0, 0, 0))
    K(56, "legL", rot=(-20, 0, 0)); K(56, "legR", rot=(15, 0, 0)); K(62, "legL", rot=(0, 0, 0)); K(62, "legR", rot=(0, 0, 0))
    # 62–134: write on the board (arm up and forward, small strokes), shuffle along
    K(66, "shW", rot=(-115, 0, -4)); K(66, "elW", rot=(-12, 0, 0)); K(66, "head", rot=(6, 0, 0))
    for i, f in enumerate(range(70, 130, 5)):
        K(f, "shW", rot=(-115 + (5 if i % 2 else -5), 0, -4 + (i % 4 - 1.5) * 5)); K(f, "elW", rot=(-12 + (8 if i % 2 else 0), 0, 0))
        K(f, "head", rot=(6, 0, (i % 4 - 1.5) * 3))
    K(96, "tutor", rot=(0, 0, 180), loc=(x0, 0, 0)); K(104, "tutor", rot=(0, 0, 180), loc=(x0 + 90, 0, 0))
    K(98, "legL", rot=(18, 0, 0)); K(102, "legL", rot=(0, 0, 0)); K(100, "legR", rot=(-18, 0, 0)); K(104, "legR", rot=(0, 0, 0))
    K(130, "shW", rot=(-115, 0, -4)); rest(136, keep=())
    # 136–150: turn back
    K(136, "tutor", rot=(0, 0, 180), loc=(x0 + 90, 0, 0)); K(143, "tutor", rot=(0, 0, 270), loc=(x0 + 90, 0, 35)); K(150, "tutor", rot=(0, 0, 360), loc=(x0 + 90, 0, 0))
    face(150, "rest")
    # 150–216: celebrate
    if style == "thumbs":
        K(158, "shP", rot=(-80, 0, 0)); K(158, "elP", rot=(-80, 0, 0)); K(158, "head", rot=(-6, 0, 12))
        for f in (170, 182, 194, 206): K(f, "shP", rot=(-85, 0, 0)); K(f + 6, "shP", rot=(-75, 0, 0))
        face(158, 3); face(172, "rest"); blink(186); face(196, 3); face(208, "rest")
    elif style == "wave":
        K(158, "shP", rot=(0, -150, 0)); K(158, "elP", rot=(0, -10, 0)); K(158, "head", rot=(0, 0, 14))
        for i, f in enumerate(range(162, 214, 6)): K(f, "elP", rot=(0, -10 + (30 if i % 2 else -15), 0))
        talk(160, 200); blink(206)
    else:  # cheer jump
        K(158, "shP", rot=(0, -165, 0)); K(158, "shW", rot=(0, 165, 0)); K(158, "elP", rot=(0, -10, 0)); K(158, "elW", rot=(0, 10, 0))
        for f in (162, 186):
            K(f, "tutor", rot=(0, 0, 360), loc=(x0 + 90, 0, 0)); K(f + 7, "tutor", rot=(0, 0, 360), loc=(x0 + 90, 0, 110)); K(f + 14, "tutor", rot=(0, 0, 360), loc=(x0 + 90, 0, 0))
            K(f + 7, "legL", rot=(-25, 0, 0)); K(f + 7, "legR", rot=(-25, 0, 0)); K(f + 14, "legL", rot=(0, 0, 0)); K(f + 14, "legR", rot=(0, 0, 0))
        face(160, 3); face(178, 2); face(186, 3); face(204, "rest")
    K(216, "tutor", rot=(0, 0, 360), loc=(x0 + 90, 0, 0))


def build():
    clear(); stage()
    cast = [("blokbek", -820, "thumbs", 0), ("lola", 0, "wave", 4), ("diyorbek", 820, "cheer", 8)]
    for i, (cid, x, style, off) in enumerate(cast):
        C = load(cid, x); choreograph(C, style, off, seed=i + 1)


def render():
    sc = bpy.context.scene
    d = ROOT + r"\public\models\raw\_show"; os.makedirs(d, exist_ok=True)
    sc.render.image_settings.file_format = "PNG"; sc.render.filepath = d + r"\f_"
    bpy.ops.render.render(animation=True)
