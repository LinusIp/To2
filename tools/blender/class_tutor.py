# Finish a high-quality hinged tutor inside classroom.blend: render the lesson still and the
# "thinking" quiz poses. Run after the classify step (driver_namespace["_hi"] holds labels).
import bpy, math
R = math.radians
ROOT = r"C:\Users\Progress service\Desktop\To2"
TOOLS = ROOT + r"\tools\blender"

THINK = {
    "think1": ({"shP": (-38, -6, 0), "elP": (-128, 0, 0), "shW": (0, 6, 0), "head": (-6, 9, 10)}, "rest"),   # hand on chin, head tilt
    "think2": ({"shP": (-150, -40, 0), "elP": (-105, 0, 0), "shW": (0, 6, 0), "head": (5, -9, -6)}, "rest"),  # scratching head
}


def finish(cid):
    hs = {}; exec(open(TOOLS + r"\tripo_hinged.py", encoding="utf-8").read(), hs)
    p = hs["P"][cid]; low = bpy.data.objects["low"]; d = bpy.app.driver_namespace["_hi"]
    sw, (alo, ahi), crotch, neck = p["sw"], p["arm"], p["crotch"], p["neck"]; xe = d["xe"]; pad = p.get("arm_pad", 0.025)
    hs["PLANES"][:] = [((sw, 0, 0), (1, 0, 0)), ((-sw, 0, 0), (1, 0, 0)), ((xe, 0, 0), (1, 0, 0)), ((-xe, 0, 0), (1, 0, 0)),
                       ((0, 0, neck), (0, 0, 1)), ((0, 0, crotch), (0, 0, 1)), ((0, 0, alo - pad), (0, 0, 1)), ((0, 0, ahi + pad), (0, 0, 1)), ((0, 0, 0), (1, 0, 0))]
    parts = hs["split_parts"](low, d["lab"]); hinges = hs["hang_arms"](parts, p, xe); root, E = hs["assemble"](parts, hinges, p, [])
    for o in [root] + list(root.children_recursive): o.rotation_mode = "XYZ"
    # 1) lesson still: stand left of the board, point at it
    sc = bpy.context.scene; sc.camera = bpy.data.objects["roomcam"]
    root.location = (-230, 60, 0); root.rotation_euler = (0, 0, R(12))
    E["shP"].rotation_euler = (R(-40), R(-95), 0); E["elP"].rotation_euler = (0, R(-20), 0)
    E["head"].rotation_euler = (R(-2), 0, R(16)); E["shW"].rotation_euler = (0, R(6), 0)
    sc.render.resolution_x, sc.render.resolution_y = 780, 900; sc.render.film_transparent = False
    sc.render.filepath = ROOT + rf"\public\models\raw\_class_{cid}.png"; bpy.ops.render.render(write_still=True)
    # 2) quiz "thinking" poses on transparent background (room hidden)
    keep = set([root] + list(root.children_recursive))
    for o in bpy.data.objects:
        if o not in keep and o.type in ("MESH", "LIGHT"): o.hide_render = True
    for e in E.values(): e.rotation_euler = (0, 0, 0)
    root.location = (0, 0, 0)
    pt = {}; exec(open(TOOLS + r"\tripo_portraits.py", encoding="utf-8").read(), pt)
    for n in ("key", "rim"):
        if n in bpy.data.objects and bpy.data.objects[n].type == "LIGHT": bpy.data.objects[n].name = n + "_room"
    sc.view_settings.view_transform = "Standard"; sc.view_settings.look = "None"; sc.view_settings.exposure = 0
    out = pt["render_all"](cid, THINK, frames=("half",))
    return out
