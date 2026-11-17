# To2 — voxel tutor builder + renderer for Blender 5.x
# Builds the same 8 characters as makeChar(cfg) in docs/prototypes/*.html and renders
# PNGs with transparent background to public/characters/<id>_<pose>_<frame>.png
# Usage (Blender MCP or Scripting tab): exec(open(this_file).read()); render_char('blokbek')  # ids: see CHARS
import bpy, bmesh, os
from mathutils import Vector

OUT = r"C:\Users\Progress service\Desktop\To2\public\characters"
S = 0.01  # 1 prototype px = 1 cm

CHARS = {
 'blokbek': dict(skin='#c98b5e', hair='#2b1d14', st='messy', top=dict(c='#24262d', side='#1b1d22', kind='hoodie', print=True, hem=True, cuff='#e0873a'), pants=('#34446a','#3d5080'), shoes='#f2f2f2', sole='#3b6fd9', acc=['neckphones']),
 'shox': dict(skin='#d9a273', hair='#17171a', st='slick', eyes='sun', top=dict(c='#2a2d33', side='#1f2126', kind='jacket', collar='#3a3e46'), pants=('#26282e','#2d3037'), shoes='#1a1a1c', sole='#444444', acc=[]),
 'ziyo': dict(skin='#d39a6c', hair='#2b1d14', st='hood', hood='#3c9a3c', top=dict(c='#3c9a3c', side='#2f7d2f', kind='hoodie'), pants=('#2f3a2f','#36433a'), shoes='#f2f2f2', sole='#3c9a3c', acc=['hoodup','headphones']),
 'lola': dict(skin='#d9a273', hair='#241812', st='long', female=True, top=dict(c='#f1ede6', side='#d9d3c8', kind='vest', vest='#e0457b'), pants=('#34446a','#3d5080'), shoes='#ffffff', sole='#e0457b', acc=['longhair','flower']),
 'sardor': dict(skin='#c98b5e', hair='#1e1611', st='cap', cap='#1d1f24', top=dict(c='#1f2a3a', side='#18212e', kind='jacket', collar='#2a374b'), pants=('#23262c','#2a2e35'), shoes='#1a1a1c', sole='#666666', acc=['cap']),
 'ravshan': dict(skin='#e0b08a', hair='#9a4a22', st='volume', top=dict(c='#d9d4cc', side='#bdb7ad', kind='jacket', collar='#ffffff'), pants=('#4a4f5a','#555b67'), shoes='#2a2a2a', sole='#9a4a22', acc=['headphones']),
 'diyorbek': dict(skin='#c98b5e', hair='#2b1d14', st='messy', eyes='glasses', top=dict(c='#f0efea', side='#d6d4cc', kind='labcoat'), pants=('#2b2d33','#33363d'), shoes='#1a1a1c', sole='#777777', acc=['labcoat']),
 'shadow': dict(skin='#15111d', hair='#2a2238', st='hood', hood='#2a2238', eyes='glow', top=dict(c='#2a2238', side='#1f192b', kind='hoodie'), pants=('#1f1a28','#241e2f'), shoes='#1a1622', sole='#7b4dff', acc=['hoodup','glow']),
}

# ---------------- colours / pixel images ----------------
def parse(col):
    if col.startswith('#'):
        h = col[1:]; return (int(h[0:2],16), int(h[2:4],16), int(h[4:6],16), 1.0)
    v = col[col.index('(')+1:col.index(')')].split(',')
    return (int(v[0]), int(v[1]), int(v[2]), float(v[3]))
def lin(c):
    c = c/255.0
    return c/12.92 if c <= 0.04045 else ((c+0.055)/1.055)**2.4
def lcol(col):
    r,g,b,a = parse(col); return (lin(r), lin(g), lin(b), 1.0)

class Img:
    def __init__(s, w, h): s.w, s.h = w, h; s.p = [(0,0,0,1.0)]*(w*h)
    def px(s, col, x, y, w=1, h=1):
        r,g,b,a = parse(col)
        for yy in range(int(y), int(y+h)):
            for xx in range(int(x), int(x+w)):
                if 0 <= xx < s.w and 0 <= yy < s.h:
                    i = yy*s.w+xx; o = s.p[i]
                    s.p[i] = (r,g,b,1.0) if a >= 1 else (o[0]*(1-a)+r*a, o[1]*(1-a)+g*a, o[2]*(1-a)+b*a, 1.0)
    def write(s, im):
        flat = []
        for y in range(s.h-1, -1, -1):
            for x in range(s.w):
                r,g,b,a = s.p[y*s.w+x]; flat += [r/255, g/255, b/255, 1.0]
        im.pixels = flat; im.update(); return im
    def image(s, name):
        im = bpy.data.images.get(name)
        if im: bpy.data.images.remove(im)
        im = bpy.data.images.new(name, s.w, s.h, alpha=False)
        return s.write(im)

MATS = {}
def mcol(col, rough=0.62, emit=None):
    key = (col, rough, emit)
    if key in MATS: return MATS[key]
    m = bpy.data.materials.new('c_'+col); m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = lcol(col); b.inputs['Roughness'].default_value = rough
    if emit:
        b.inputs['Emission Color'].default_value = lcol(emit); b.inputs['Emission Strength'].default_value = 6.0
    MATS[key] = m; return m
def mtex(img, rough=0.6):
    m = bpy.data.materials.new('t_'+img.name); m.use_nodes = True
    nt = m.node_tree; b = nt.nodes['Principled BSDF']
    t = nt.nodes.new('ShaderNodeTexImage'); t.image = img; t.interpolation = 'Closest'
    nt.links.new(t.outputs['Color'], b.inputs['Base Color']); b.inputs['Roughness'].default_value = rough
    return m

# ---------------- geometry ----------------
COL = None
def box(name, w, h, d, mats, x, y, z, parent, bevel=3.0):
    """w=X width, h=height(Z), d=depth(Y); position in three.js coords (x, y=up, z=toward camera)."""
    me = bpy.data.meshes.new(name); ob = bpy.data.objects.new(name, me); COL.objects.link(ob)
    hx, hy, hz = w*S/2, d*S/2, h*S/2
    F = {'front':[(-hx,-hy,-hz),(hx,-hy,-hz),(hx,-hy,hz),(-hx,-hy,hz)],
         'back':[(hx,hy,-hz),(-hx,hy,-hz),(-hx,hy,hz),(hx,hy,hz)],
         'left':[(-hx,hy,-hz),(-hx,-hy,-hz),(-hx,-hy,hz),(-hx,hy,hz)],
         'right':[(hx,-hy,-hz),(hx,hy,-hz),(hx,hy,hz),(hx,-hy,hz)],
         'top':[(-hx,-hy,hz),(hx,-hy,hz),(hx,hy,hz),(-hx,hy,hz)],
         'bottom':[(-hx,hy,-hz),(hx,hy,-hz),(hx,-hy,-hz),(-hx,-hy,-hz)]}
    bm = bmesh.new(); uv = bm.loops.layers.uv.new(); slot = {}
    for k, vs in F.items():
        m = mats.get(k, mats.get('all')) if isinstance(mats, dict) else mats
        if m.name not in slot: me.materials.append(m); slot[m.name] = len(me.materials)-1
        f = bm.faces.new([bm.verts.new(v) for v in vs]); f.material_index = slot[m.name]
        for l, c in zip(f.loops, [(0,0),(1,0),(1,1),(0,1)]): l[uv].uv = c
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
    bm.to_mesh(me); bm.free()
    ob.parent = parent; ob.location = (x*S, -z*S, y*S)
    if bevel:
        bv = ob.modifiers.new('bev', 'BEVEL'); bv.width = bevel*S; bv.segments = 3; bv.harden_normals = True; bv.limit_method = 'ANGLE'
        for p in me.polygons: p.use_smooth = True
    return ob
def empty(name, x, y, z, parent):
    e = bpy.data.objects.new(name, None); COL.objects.link(e); e.parent = parent; e.location = (x*S, -z*S, y*S); return e

# ---------------- face painter (port of paintFace) ----------------
def paint_face(f, mouth=0):
    g = Img(16, 16); H = f['hair']; Sk = f['skin']; px = g.px
    px(Sk, 0, 0, 16, 16)
    if f.get('eyes') == 'glow':
        px('#15111d', 0,0,16,16); px(f['hood'],0,0,16,3); px(f['hood'],0,0,2,16); px(f['hood'],14,0,2,16)
        px('#b26bff',4,7,3,2); px('#b26bff',9,7,3,2); px('#e3c7ff',5,7); px('#e3c7ff',10,7); return g
    st = f['st']
    if st in ('messy','volume'): px(H,0,0,16,3); px(H,0,3,5,2); px(H,7,3,3,1); px(H,11,3,5,2); px(H,0,5,1,4); px(H,15,5,1,4)
    if st == 'slick': px(H,0,0,16,4); px(H,0,4,1,3); px(H,15,4,1,3)
    if st == 'long': px(H,0,0,16,3); px(H,0,3,7,2); px(H,10,3,6,1); px(H,0,3,2,13); px(H,14,3,2,13)
    if st == 'cap': px(f['cap'],0,0,16,4); px('#0f1013',0,4,16,1); px(H,0,5,1,3); px(H,15,5,1,3)
    if st == 'hood': px(f['hood'],0,0,16,3); px(f['hood'],0,0,2,16); px(f['hood'],14,0,2,16); px(H,2,3,12,1); px(H,2,4,3,1)
    if f.get('eyes') != 'sun': px(H,3,5,3,1); px(H,10,5,3,1)
    if f.get('eyes') == 'sun': px('#0e0e10',2,6,12,3); px('#4a4f5a',3,6,2,1); px('#4a4f5a',10,6,2,1)
    else:
        px('#ffffff',3,6,3,3); px('#ffffff',10,6,3,3)
        px('#1d1a1a',4,6,2,3); px('#1d1a1a',11,6,2,3); px('#ffffff',4,6); px('#ffffff',11,6)
        if f.get('female'): px('#1d1a1a',2,6); px('#1d1a1a',13,6)
    if f.get('eyes') == 'glasses':
        for (a,b,c,d) in [(2,5,5,1),(2,9,5,1),(2,5,1,5),(6,5,1,5),(9,5,5,1),(9,9,5,1),(9,5,1,5),(13,5,1,5),(7,6,2,1)]: px('#141414',a,b,c,d)
    px('rgba(0,0,0,.18)',7,9,2,2)
    L = '#9b3048' if f.get('female') else '#5a2318'
    if mouth == 0: px(L,5,12,6,1); px(L,4,11); px(L,11,11)
    else:
        h=[0,2,3,3][mouth]; w=[0,5,6,8][mouth]; x=8-w//2
        px(L,x,11,w,h); px('#ffffff',x,11,w,1)
        if mouth>1: px('#c0504a',x+1,11+h-1,w-2,1)
    return g

GLYPH = {'T':['###','.#.','.#.','.#.','.#.'], 'o':['...','###','#.#','#.#','###'], '2':['###','..#','###','#..','###']}
def hoodie_front(tp):
    g = Img(32, 48); px = g.px; px(tp['c'],0,0,32,48); k = tp['kind']
    if k == 'hoodie': px('rgba(255,255,255,.06)',0,0,32,3); px('#e8e6e0',12,2,1,9); px('#e8e6e0',19,2,1,9); px('rgba(0,0,0,.18)',6,34,20,6)
    if k == 'jacket': px(tp['collar'],10,0,12,6); px('rgba(0,0,0,.35)',15,0,2,48); px('rgba(0,0,0,.18)',3,30,7,2); px('rgba(0,0,0,.18)',22,30,7,2)
    if k == 'vest': px(tp['vest'],0,0,10,48); px(tp['vest'],22,0,10,48); px('#ffffff',10,0,12,48); px('rgba(0,0,0,.12)',15,6,2,30)
    if k == 'labcoat': px('#2b2d33',12,0,8,48); px('#d6d4cc',10,0,2,20); px('#d6d4cc',20,0,2,20); px('#3b6fd9',23,10,3,4)
    if tp.get('print'):
        px('#efece4',9,20,1,6); px('#efece4',9,20,2,1); px('#efece4',9,25,2,1)
        for i,ch in enumerate('To2'):
            for r,row in enumerate(GLYPH[ch]):
                for c,v in enumerate(row):
                    if v == '#': px('#efece4', 12+i*4+c, 20+r)
    return g

# ---------------- character ----------------
def build(cid):
    cfg = dict(CHARS[cid]); tp = cfg['top']; acc = cfg['acc']
    root = empty(cid+'_root', 0,0,0, None); lean = empty('lean',0,0,0,root); lean.rotation_euler = (0.10,0,0)
    body = empty('body',0,0,0,lean); body.rotation_euler = (0,0,-0.32)
    for sgn, col in ((-1,cfg['pants'][0]),(1,cfg['pants'][1])):
        leg = empty('leg',38*sgn,232,0,body)
        box('legm',72,204,72,mcol(col),0,-102,0,leg)
        box('shoe',78,28,90,mcol(cfg['shoes'],0.5),0,-216,6,leg)
        box('sole',80,8,92,mcol(cfg['sole']),0,-228,6,leg, bevel=1.5)
    side = mcol(tp['side'])
    back = Img(32,48); back.px(tp['c'],0,0,32,48)
    if tp['kind']=='hoodie': back.px('rgba(255,255,255,.06)',4,0,24,14)
    if tp['kind']=='vest': back.px(tp['vest'],0,0,32,48)
    box('torso',184,238,104,{'front':mtex(hoodie_front(tp).image(cid+'_front')),'back':mtex(back.image(cid+'_back')),'left':side,'right':side,'all':mcol(tp['c'])},0,350,0,body,bevel=5)
    if tp.get('hem'):
        hem = Img(24,2); cols=['#e0873a','#f2c94c','#a8411a','#e0873a']
        for i in range(24): hem.px(cols[i%4],i,0,1,2)
        box('hem',188,24,108,mtex(hem.image(cid+'_hem')),0,243,0,body,bevel=2)
    if 'labcoat' in acc:
        box('coatL',92,90,108,mcol(tp['c']),-47,200,0,body); box('coatR',92,90,108,mcol(tp['c']),47,200,0,body)
    if 'neckphones' in acc:
        box('np',162,16,112,mcol('#1aa3b8',0.35),0,478,0,body,bevel=2); box('npL',24,36,40,mcol('#0e6f80',0.35),-88,488,0,body); box('npR',24,36,40,mcol('#0e6f80',0.35),88,488,0,body)
    head = empty('head',0,548,0,body)
    faceImg = paint_face(cfg, 0).image(cid+'_face')
    st = cfg['st']; H = cfg['hair']
    sideI = Img(16,16)
    if st == 'hood' or cfg.get('eyes')=='glow': sideI.px(cfg['hood'],0,0,16,16)
    else:
        sideI.px(cfg['skin'],0,0,16,16)
        if st == 'long': sideI.px(H,0,0,16,16); sideI.px(cfg['skin'],7,6,3,4)
        elif st == 'cap': sideI.px(cfg['cap'],0,0,16,4); sideI.px(H,0,4,8,3)
        else: sideI.px(H,0,0,16,5); sideI.px(H,0,5,9,3); sideI.px(H,0,8,4,4)
    topc = cfg['hood'] if st=='hood' else cfg['cap'] if st=='cap' else H
    backI = Img(16,16); backI.px(topc,0,0,16,16)
    if st not in ('hood','long'): backI.px(H,0,4,16,10); backI.px(cfg['skin'],3,15,10,1)
    sm = mtex(sideI.image(cid+'_hside'))
    box('headm',150,150,150,{'front':mtex(faceImg),'left':sm,'right':sm,'top':mcol(topc),'back':mtex(backI.image(cid+'_hback')),'all':mcol(cfg['skin'])},0,0,0,head,bevel=5)
    hair = mcol(H); hair2 = mcol('#b4592b' if st=='volume' else '#3a2719')
    if st == 'messy':
        for a in [(52,30,60,hair,-46,84,30),(58,40,70,hair2,6,92,0),(50,28,60,hair,50,84,-20),(48,26,50,hair2,-30,86,-46)]: box('hair',*a,head)
    if st == 'volume':
        for a in [(160,40,160,hair,0,92,-4),(60,36,70,hair2,-40,118,20),(70,30,60,hair,36,116,-30),(30,60,150,hair,-82,40,-4),(30,60,150,hair,82,40,-4)]: box('hair',*a,head)
    if st == 'slick': box('hair',156,18,156,hair,0,82,-2,head)
    if st == 'long': box('hair',156,16,156,hair,0,82,0,head)
    if 'longhair' in acc:
        box('lh',158,160,26,hair,0,-40,-84,head); box('lhL',16,130,60,hair,-82,-24,-40,head); box('lhR',16,130,60,hair,82,-24,-40,head)
    if 'flower' in acc: box('fl',22,22,22,mcol('#ff8fb1',0.4),-74,58,52,head); box('flc',10,10,24,mcol('#ffd85c'),-74,58,54,head,bevel=1)
    if 'hoodup' in acc: box('hood',168,168,150,mcol(cfg['hood']),0,6,-16,head,bevel=8)
    if 'headphones' in acc:
        box('hp',170,14,34,mcol('#2a2d33',0.35),0,88,0,head,bevel=2); box('hpL',24,50,50,mcol('#1d1f24',0.35),-88,6,0,head); box('hpR',24,50,50,mcol('#1d1f24',0.35),88,6,0,head)
    if 'cap' in acc: box('cap',158,34,158,mcol(cfg['cap']),0,66,0,head); box('brim',130,10,74,mcol(cfg['cap']),0,52,104,head,bevel=2)
    if 'glow' in acc:
        gm = mcol('#c58bff',0.3,emit='#c58bff'); box('gl',26,12,4,gm,-28,-6,77,head,bevel=0); box('gr',26,12,4,gm,28,-6,77,head,bevel=0)
    sleeve = '#f1ede6' if tp['kind']=='vest' else tp['c']
    skin = '#2a2238' if cfg['skin']=='#15111d' else cfg['skin']
    arms = {}
    for nm, xs in (('P',117),('W',-117)):
        sh = empty('sh'+nm, xs,455,0, body)
        box('up',54,150,64,mcol(sleeve),0,-70,0,sh)
        el = empty('el'+nm, 0,-145,0, sh)
        box('fo',50,112,60,mcol(sleeve),0,-52,0,el)
        if tp.get('cuff'): box('cuff',52,16,62,mcol(tp['cuff']),0,-96,0,el,bevel=1.5)
        box('hand',50,44,56,mcol(skin),0,-128,0,el)
        arms[nm] = (sh, el)
    return dict(root=root, body=body, head=head, arms=arms, cfg=cfg, face=faceImg)

def set_face(ch, mouth):
    paint_face(ch['cfg'], mouth).write(ch['face'])

# three.js rotation.z (screen plane) -> Blender rotation about Y with flipped sign
def arm(ch, nm, sh, el):
    s, e = ch['arms'][nm]; s.rotation_euler = (0, -sh, 0); e.rotation_euler = (0, -el, 0)
POSES = {
 'idle':   dict(P=(0.08,0.05), W=(-0.06,-0.05), mouth=0, yaw=-0.32),
 'wave':   dict(P=(2.7,0.45), W=(-0.06,-0.05), mouth=2, yaw=-0.32),
 'point':  dict(P=(1.55,0.12), W=(-0.06,-0.05), mouth=1, yaw=-0.32),
 'thumbs': dict(P=(0.55,2.1), W=(-0.06,-0.05), mouth=0, yaw=-0.32),
 'cheer':  dict(P=(2.75,0.3), W=(-2.75,-0.3), mouth=2, yaw=-0.15),
}
def pose(ch, p):
    d = POSES[p]; arm(ch,'P',*d['P']); arm(ch,'W',*d['W']); ch['body'].rotation_euler = (0,0,d['yaw']); set_face(ch, d['mouth'])

# ---------------- scene, lights, camera ----------------
FRAMES = {  # resolution, camera location, look-at (metres)
 'full': ((600,760), (-2.2,-17.5,5.2), (0,0,3.45)),
 'half': ((600,600), (-1.6,-11.8,5.9), (0,0,4.75)),
 'face': ((256,256), (-0.9,-5.6,6.0), (0,0,5.55)),
}
def setup():
    global COL
    sc = bpy.context.scene
    for o in list(bpy.data.objects): bpy.data.objects.remove(o, do_unlink=True)
    for m in list(bpy.data.meshes): bpy.data.meshes.remove(m)
    for m in list(bpy.data.materials): bpy.data.materials.remove(m)
    MATS.clear()
    COL = bpy.data.collections.get('TO2') or bpy.data.collections.new('TO2')
    if COL.name not in sc.collection.children: sc.collection.children.link(COL)
    eng = [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items]
    sc.render.engine = 'BLENDER_EEVEE_NEXT' if 'BLENDER_EEVEE_NEXT' in eng else 'BLENDER_EEVEE'
    sc.render.film_transparent = True
    sc.render.image_settings.file_format = 'PNG'; sc.render.image_settings.color_mode = 'RGBA'
    try: sc.eevee.taa_render_samples = 48
    except Exception: pass
    for attr in ('use_raytracing', 'use_shadows', 'use_gtao'):
        try: setattr(sc.eevee, attr, True)
        except Exception: pass
    try:
        sc.view_settings.view_transform = 'AgX'; sc.view_settings.look = 'AgX - Punchy'
    except Exception: pass
    w = bpy.data.worlds.get('to2w') or bpy.data.worlds.new('to2w'); sc.world = w; w.use_nodes = True
    bg = w.node_tree.nodes.get('Background'); bg.inputs[0].default_value = (0.78, 0.80, 0.95, 1); bg.inputs[1].default_value = 0.55
    def area(name, loc, power, color, size):
        L = bpy.data.lights.get(name) or bpy.data.lights.new(name, 'AREA'); L.energy = power; L.color = color; L.size = size
        o = bpy.data.objects.new(name, L); COL.objects.link(o); o.location = loc
        d = Vector((0, 0, 4.2)) - Vector(loc); o.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    area('key', (-6, -8, 9), 2600, (1.0, 0.93, 0.84), 6)
    area('fill', (7, -6, 4), 900, (0.75, 0.85, 1.0), 6)
    area('rim', (4, 7, 8), 1800, (1, 1, 1), 4)
    cam = bpy.data.cameras.get('cam') or bpy.data.cameras.new('cam'); cam.lens = 85
    co = bpy.data.objects.new('cam', cam); COL.objects.link(co); sc.camera = co
    return co
def aim(co, frame):
    (rx, ry), loc, at = FRAMES[frame]; sc = bpy.context.scene
    sc.render.resolution_x, sc.render.resolution_y = rx, ry; sc.render.resolution_percentage = 100
    co.location = loc; d = Vector(at) - Vector(loc); co.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()

JOBS = [('idle','half'),('idle','face'),('wave','half'),('wave','full'),('thumbs','half'),('point','full'),('cheer','full')]
def render_char(cid, jobs=JOBS):
    os.makedirs(OUT, exist_ok=True)
    co = setup(); ch = build(cid); done = []
    for p, f in jobs:
        pose(ch, p); aim(co, f)
        path = os.path.join(OUT, f"{'agent-shox' if cid=='shox' else cid}_{p}_{f}.png"); bpy.context.scene.render.filepath = path
        bpy.ops.render.render(write_still=True); done.append(os.path.basename(path))
    return done
