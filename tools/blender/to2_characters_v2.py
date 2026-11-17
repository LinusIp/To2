# To2 — detailed voxel tutors (v2), matched to docs/characters-reference.png
# Builds 8 characters with named pivots (root/body/head/shP/elP/shW/elW/legL/legR),
# renders previews and exports GLB for three.js (public/models/<id>.glb).
import bpy, bmesh, os, random, math
from mathutils import Vector

ROOT_DIR = r"C:\Users\Progress service\Desktop\To2"
OUT_IMG = os.path.join(ROOT_DIR, "public", "characters", "3d")
OUT_GLB = os.path.join(ROOT_DIR, "public", "models")
S = 0.01

SKIN = '#efb88e'
C = {
 'blokbek': dict(hair=('#2a1a12','#3d281b'), hairStyle='curly', face=dict(mouth='grin'),
                 top=dict(kind='hoodie', c='#1f2026', c2='#2a2b33', print=True), pants='#1b1c22', shoes=('#2b3249','#e9e9ee'), pose='thumbs'),
 'agent-shox': dict(hair=('#141418','#24242b'), hairStyle='curly', face=dict(mouth='smirk', eyes='sun'),
                 top=dict(kind='trench', c='#232329', c2='#2e2e36', inner='#2a2a33'), pants='#1b1c22', shoes=('#18181c','#e9e9ee'), pose='cross'),
 'diyorbek': dict(hair=('#3a2114','#53301c'), hairStyle='curly', face=dict(mouth='grin', eyes='glasses'),
                 top=dict(kind='labcoat', c='#ecebe8', c2='#d9d7d2', inner='#1f2a44'), pants='#1b1c22', shoes=('#18181c','#e9e9ee'), pose='finger', prop='book'),
 'lola': dict(hair=('#2a1712','#3c2219'), hairStyle='long', face=dict(mouth='grin', female=True), flower=True,
                 top=dict(kind='cardigan', c='#f4f1ee', c2='#f08cb6', inner='#f4f1ee'), skirt='#1f2033', socks='#f2f2f2', pants=None, shoes=('#f0a3c3','#f4f4f6'), pose='wave'),
 'sardor': dict(hair=('#1d1612','#2b211b'), hairStyle='cap', cap=('#1f2440','#2a3054'), face=dict(mouth='smile'),
                 top=dict(kind='jacket', c='#1f2c5c', c2='#2a3a75', inner='#f1f1f1'), pants='#1e1f26', cargo=True, shoes=('#25305a','#e9e9ee'), pose='cross'),
 'ravshan': dict(hair=('#c4531f','#e0702e'), hairStyle='curly', face=dict(mouth='smile'), headphones=True,
                 top=dict(kind='hoodie', c='#c8c7c5', c2='#b3b1ae'), pants='#25262c', cargo=True, shoes=('#1d1d22','#e9e9ee'), pose='chin'),
 'ziyo': dict(hair=('#2a1a12','#3d281b'), hairStyle='hood', hood=('#43a83a','#358c2e'), face=dict(mouth='grin'), headphones=True,
                 top=dict(kind='hoodie', c='#43a83a', c2='#358c2e', inner='#9fd19a'), pants='#1d1e24', shoes=('#3d9a3a','#f0f0f2'), pose='wave', walk=True),
 'shadow': dict(hair=('#3b2468','#4a2e82'), hairStyle='hood', hood=('#3b2468','#4a2e82'), face=dict(eyes='glow'),
                 top=dict(kind='cloak', c='#3b2468', c2='#4a2e82'), pants='#21173a', shoes=('#2b1c48','#3b2468'), gloves='#1a1424', pose='offer'),
}

# ---------- colour + pixel images ----------
def parse(col):
    if col.startswith('#'):
        h = col[1:]; return (int(h[0:2],16), int(h[2:4],16), int(h[4:6],16), 1.0)
    v = col[col.index('(')+1:col.index(')')].split(','); return (int(v[0]),int(v[1]),int(v[2]),float(v[3]))
def lin(c):
    c = c/255.0; return c/12.92 if c <= 0.04045 else ((c+0.055)/1.055)**2.4
def lcol(col):
    r,g,b,a = parse(col); return (lin(r),lin(g),lin(b),1.0)
def shade(col, k):
    r,g,b,a = parse(col); f=lambda v: max(0,min(255,int(v*k)))
    return '#%02x%02x%02x' % (f(r),f(g),f(b))

class Img:
    def __init__(s, w, h, bg=None):
        s.w, s.h = w, h; s.p = [(0,0,0,1.0)]*(w*h)
        if bg: s.px(bg,0,0,w,h)
    def px(s, col, x, y, w=1, h=1):
        r,g,b,a = parse(col)
        for yy in range(int(y), int(y+h)):
            for xx in range(int(x), int(x+w)):
                if 0 <= xx < s.w and 0 <= yy < s.h:
                    i = yy*s.w+xx; o = s.p[i]
                    s.p[i] = (r,g,b,1.0) if a >= 1 else (o[0]*(1-a)+r*a, o[1]*(1-a)+g*a, o[2]*(1-a)+b*a, 1.0)
    def image(s, name):
        im = bpy.data.images.get(name)
        if im: bpy.data.images.remove(im)
        im = bpy.data.images.new(name, s.w, s.h, alpha=False); flat = []
        for y in range(s.h-1,-1,-1):
            for x in range(s.w):
                r,g,b,a = s.p[y*s.w+x]; flat += [r/255,g/255,b/255,1.0]
        im.pixels = flat; im.update(); im.pack(); return im

MATS = {}
def mcol(col, rough=0.7, emit=None):
    key = (col, rough, emit)
    if key in MATS: return MATS[key]
    m = bpy.data.materials.new('c'+col); m.use_nodes = True; b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = lcol(col); b.inputs['Roughness'].default_value = rough
    if emit: b.inputs['Emission Color'].default_value = lcol(emit); b.inputs['Emission Strength'].default_value = 8.0
    MATS[key] = m; return m
def mtex(img, rough=0.7):
    m = bpy.data.materials.new('t_'+img.name); m.use_nodes = True; nt = m.node_tree; b = nt.nodes['Principled BSDF']
    t = nt.nodes.new('ShaderNodeTexImage'); t.image = img; t.interpolation = 'Closest'
    nt.links.new(t.outputs['Color'], b.inputs['Base Color']); b.inputs['Roughness'].default_value = rough; return m

# ---------- geometry ----------
COL = None
def box(name, w, h, d, mats, x, y, z, parent, bevel=3.0, rot=None):
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
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6); bm.to_mesh(me); bm.free()
    ob.parent = parent; ob.location = (x*S, -z*S, y*S)
    if rot: ob.rotation_euler = rot
    if bevel:
        bv = ob.modifiers.new('bev','BEVEL'); bv.width = bevel*S; bv.segments = 2; bv.harden_normals = True; bv.limit_method = 'ANGLE'
        for p in me.polygons: p.use_smooth = True
    return ob
def empty(name, x, y, z, parent):
    e = bpy.data.objects.new(name, None); COL.objects.link(e); e.parent = parent; e.location = (x*S, -z*S, y*S)
    e.empty_display_size = 0.2; return e

# ---------- face (16x16) ----------
def face_img(cfg, mouth=None):
    f = cfg['face']; g = Img(16,16,SKIN); px = g.px; H = cfg['hair'][0]
    mouth = mouth or f.get('mouth','smile')
    if f.get('eyes') == 'glow':
        px('#0d0a14',0,0,16,16)
        for (x,y) in [(3,7),(4,7),(5,7),(4,8),(5,8),(10,7),(11,7),(12,7),(10,8),(11,8)]: px('#b56cff',x,y)
        return g
    px(shade(SKIN,0.9),0,14,16,2)                       # chin shadow
    px(H,0,0,16,2); px(H,0,2,4,1); px(H,6,2,3,1); px(H,12,2,4,1)   # fringe line (voxel hair covers the rest)
    if f.get('eyes') == 'sun':
        px('#0b0b0d',2,6,12,3); px('#0b0b0d',7,5,2,1); px('#3d4048',3,6,2,1); px('#3d4048',10,6,2,1)
    else:
        px(H,3,4,3,1); px(H,10,4,3,1)                   # brows
        px('#16131a',4,6,2,3); px('#16131a',10,6,2,3)   # eyes
        px('#ffffff',4,6); px('#ffffff',10,6)
        if f.get('female'): px('#16131a',3,6); px('#16131a',12,6)
    if f.get('eyes') == 'glasses':
        k = '#121214'
        for (a,b,c,d) in [(2,5,5,1),(2,9,5,1),(2,5,1,5),(6,5,1,5),(9,5,5,1),(9,9,5,1),(9,5,1,5),(13,5,1,5),(7,6,2,1)]: px(k,a,b,c,d)
    px(shade(SKIN,0.86),7,9,2,2)                        # nose
    L = '#8c2f3c' if f.get('female') else '#5a2318'
    if mouth == 'grin': px(L,5,11,6,3); px('#ffffff',5,11,6,1); px('#d65a5a',6,13,4,1)
    elif mouth == 'smile': px(L,5,12,6,1); px(L,4,11); px(L,11,11)
    elif mouth == 'smirk': px(L,7,12,4,1); px(L,11,11)
    elif mouth == 'open': px(L,6,11,4,3); px('#ffffff',6,11,4,1)
    return g

# ---------- hair voxels ----------
def hair_voxels(head, cfg, rnd):
    dark, light = cfg['hair']; st = cfg['hairStyle']; md, ml = mcol(dark, 0.8), mcol(light, 0.75)
    def v(x,y,z,s=24): s=s*1.3; box('hv', s, s, s, md if rnd.random()<0.62 else ml, x, y, z, head, bevel=3)
    if st in ('curly','long'):
        # top cap
        for x in range(-84, 90, 24):
            for z in range(-84, 90, 24):
                v(x+rnd.uniform(-5,5), 84+rnd.uniform(-4,14), z+rnd.uniform(-5,5), rnd.choice([24,26,28]))
        # second puffy layer
        for _ in range(16): v(rnd.uniform(-70,70), 104+rnd.uniform(0,12), rnd.uniform(-70,60), rnd.choice([22,26]))
        # sides + back
        for y in range(-20 if st=='curly' else -150, 80, 24):
            for z in range(-84, 70, 24):
                for sx in (-1,1): v(sx*(80+rnd.uniform(0,6)), y+rnd.uniform(-4,4), z+rnd.uniform(-4,4), rnd.choice([22,24,26]))
            for x in range(-84, 90, 24): v(x+rnd.uniform(-4,4), y+rnd.uniform(-4,4), -82-rnd.uniform(0,6), rnd.choice([22,24,26]))
        # fringe over forehead (irregular)
        for x in range(-78, 84, 20):
            drop = rnd.choice([0,0,10,18,26])
            v(x+rnd.uniform(-3,3), 66-drop/2, 78, rnd.choice([20,22,24]))
        if st == 'long':   # strands in front of shoulders
            for sx in (-1,1):
                for y in range(-150, 40, 22): v(sx*(72+rnd.uniform(0,8)), y, 52+rnd.uniform(-6,6), 22)
    if st == 'cap':
        cd, cl = cfg['cap']
        box('cap',160,40,160,{'front':mtex(cap_front(cfg).image('cap_front')),'all':mcol(cd)},0,72,0,head,bevel=6)
        box('capT',150,10,150,mcol(cl),0,96,0,head,bevel=4)
        box('brim',150,10,92,mcol(cd),0,54,112,head,bevel=3)
        for z in range(-80, 60, 22):
            for sx in (-1,1): v(sx*80, 30+rnd.uniform(-4,4), z, 22)
        for x in range(-80, 90, 22): v(x, 30+rnd.uniform(-6,4), -82, 22)
    if st == 'hood':
        hd, hl = cfg['hood']; mh, mh2 = mcol(hd, 0.85), mcol(hl, 0.85)
        box('hoodback',176,176,150,mh,0,8,-22,head,bevel=10)
        box('hoodtop',150,22,40,mh2,0,92,70,head,bevel=6)
        box('hoodL',22,170,44,mh,-86,0,62,head,bevel=6); box('hoodR',22,170,44,mh,86,0,62,head,bevel=6)
        if cfg['face'].get('eyes') != 'glow':
            for x in range(-58, 64, 22): v(x, 64, 78, 20)   # fringe under hood

def cap_front(cfg):
    g = Img(16,8,cfg['cap'][0]); g.px('#f2f2f2',6,2,4,4); g.px(cfg['cap'][0],7,3,2,2); return g

# ---------- torso ----------
GLYPH = {'[':['##.','#..','#..','#..','##.'], 'T':['###','.#.','.#.','.#.','.#.'], 'o':['...','###','#.#','#.#','###'], '2':['###','..#','###','#..','###'], ']':['.##','..#','..#','..#','.##']}
def torso_front(tp):
    g = Img(32,48,tp['c']); px = g.px; k = tp['kind']
    if k == 'hoodie':
        px(shade(tp['c'],1.15),0,0,32,2); px('#e8e6e0',12,1,1,10); px('#e8e6e0',19,1,1,10)
        px(shade(tp['c'],0.8),6,34,20,7); px(shade(tp['c'],0.7),6,34,20,1)
        if tp.get('inner'): px(tp['inner'],13,0,6,12)
        if tp.get('print'):
            x = 8
            for ch in '[To2]':
                for r,row in enumerate(GLYPH[ch]):
                    for c,v in enumerate(row):
                        if v == '#': px('#f1efe8', x+c, 19+r)
                x += 4 if ch not in '[]' else 3
    if k == 'trench':
        px(tp['inner'],12,0,8,48); px(shade(tp['c'],0.75),11,0,1,48); px(shade(tp['c'],0.75),20,0,1,48)
        px(tp['c2'],8,0,4,10); px(tp['c2'],20,0,4,10); px('#0d0d10',15,6,2,2); px(shade(tp['c'],0.7),0,30,32,2)
    if k == 'labcoat':
        px(tp['inner'],11,0,10,48); px(tp['c2'],9,0,2,22); px(tp['c2'],21,0,2,22); px('#9aa0aa',22,12,4,1)
    if k == 'cardigan':
        px(tp['inner'],0,0,32,48); px(tp['c2'],0,0,9,48); px(tp['c2'],23,0,9,48)
        for y in range(4,48,6): px(shade(tp['c2'],0.85),2,y,5,1); px(shade(tp['c2'],0.85),25,y,5,1)
        px('#f2b6cf',11,8,10,4)
    if k == 'jacket':
        px(tp['inner'],12,0,8,48); px(tp['c2'],10,0,2,48); px(tp['c2'],20,0,2,48)
        px(shade(tp['c'],0.8),3,26,6,6); px(shade(tp['c'],0.8),23,26,6,6); px(tp['c2'],0,0,32,2)
    if k == 'cloak':
        px(shade(tp['c'],0.75),15,0,2,48); px(tp['c2'],12,0,8,14); px('#2a1a4d',0,40,32,8)
    return g
def torso_back(tp):
    g = Img(32,48,tp['c'])
    if tp['kind'] in ('hoodie','cloak'): g.px(tp.get('c2',tp['c']),5,0,22,16); g.px(shade(tp['c'],0.8),5,0,22,2)
    return g

# ---------- build ----------
def build(cid):
    cfg = C[cid]; tp = cfg['top']; rnd = random.Random(cid)
    root = empty('root', 0,0,0, None); root.name = 'root'
    body = empty('body', 0,0,0, root)
    pants = cfg.get('pants') or '#1f2033'
    for nm, sx, sh in (('legL',-1,1.0),('legR',1,0.92)):
        leg = empty(nm, 38*sx, 232, 0, body)
        if cfg.get('skirt'):
            box('sock',70,110,70,mcol(cfg['socks']),0,-150,0,leg)
            box('knee',72,94,72,mcol(SKIN),0,-50,0,leg)
        else:
            box('legm',72,204,72,mcol(shade(pants, sh)),0,-102,0,leg)
            if cfg.get('cargo'): box('pocket',10,44,40,mcol(shade(pants,1.25)),37*sx,-90,0,leg,bevel=1.5)
        up, wh = cfg['shoes']
        box('shoe',80,30,96,{'top':mcol(up),'front':mcol(wh),'all':mcol(up)},0,-212,8,leg,bevel=5)
        box('sole',84,12,100,mcol(wh,0.5),0,-226,8,leg,bevel=3)
        box('lace',40,6,30,mcol('#c9ccd4'),0,-195,30,leg,bevel=1)
    if cfg.get('skirt'):
        sk = Img(32,8,cfg['skirt'])
        for x in range(0,32,4): sk.px(shade(cfg['skirt'],0.75),x,0,1,8)
        box('skirt',200,70,120,{'all':mtex(sk.image(cid+'_skirt')),'top':mcol(cfg['skirt']),'bottom':mcol(cfg['skirt'])},0,215,0,body,bevel=4)
    side = mcol(tp.get('c2', tp['c'])) if tp['kind'] in ('cardigan',) else mcol(shade(tp['c'],0.88))
    box('torso',184,238,104,{'front':mtex(torso_front(tp).image(cid+'_tf')),'back':mtex(torso_back(tp).image(cid+'_tb')),'left':side,'right':side,'all':mcol(tp['c'])},0,350,0,body,bevel=6)
    if tp['kind'] == 'hoodie' and cfg['hairStyle'] != 'hood':
        box('hood',150,46,40,mcol(tp.get('c2',tp['c'])),0,478,-50,body,bevel=8)
    if tp['kind'] in ('trench','labcoat','cloak'):
        L = {'trench':150, 'labcoat':110, 'cloak':190}[tp['kind']]
        cm = mcol(tp['c']); cm2 = mcol(tp['c2'])
        box('coatFL',90,L,16,cm,-50,232-L/2,52,body,bevel=4); box('coatFR',90,L,16,cm,50,232-L/2,52,body,bevel=4)
        box('coatB',190,L,16,cm,0,232-L/2,-52,body,bevel=4)
        box('coatSL',16,L,104,cm2,-96,232-L/2,0,body,bevel=4); box('coatSR',16,L,104,cm2,96,232-L/2,0,body,bevel=4)
        if tp['kind'] == 'trench':
            box('collarL',30,60,70,cm2,-70,480,30,body,bevel=6,rot=(0,0.25,0)); box('collarR',30,60,70,cm2,70,480,30,body,bevel=6,rot=(0,-0.25,0))
        if tp['kind'] == 'labcoat':
            box('lapelL',20,70,10,mcol(tp['c2']),-28,430,54,body,bevel=2); box('lapelR',20,70,10,mcol(tp['c2']),28,430,54,body,bevel=2)
    if tp['kind'] == 'jacket':
        box('hood',160,40,40,mcol(tp['c2']),0,476,-48,body,bevel=8)
    # head
    head = empty('head', 0, 560, 0, body); head.scale = (1.24,1.24,1.24)
    fimg = face_img(cfg).image(cid+'_face')
    sideI = Img(16,16,SKIN); sideI.px(cfg['hair'][0],0,0,16,6); sideI.px(shade(SKIN,0.9),6,8,3,3)
    box('headm',150,150,150,{'front':mtex(fimg),'left':mtex(sideI.image(cid+'_hs')),'right':mtex(sideI.image(cid+'_hs2')),'top':mcol(cfg['hair'][0]),'back':mcol(cfg['hair'][0]),'all':mcol(SKIN)},0,0,0,head,bevel=6)
    hair_voxels(head, cfg, rnd)
    if cfg.get('flower'):
        for (dx,dy) in ((0,12),(12,0),(0,-12),(-12,0)): box('pet',16,16,16,mcol('#f5a3c4',0.5),-70+dx,70+dy,64,head,bevel=3)
        box('fc',10,10,18,mcol('#ffd25c'),-70,70,68,head,bevel=2)
    if cfg.get('headphones'):
        box('hpband',176,16,30,mcol('#1a1a1e',0.35),0,112 if cfg['hairStyle']!='hood' else 106,0,head,bevel=4)
        for sx in (-1,1):
            box('hpcup',30,64,64,mcol('#1a1a1e',0.35),sx*96,8,0,head,bevel=8)
            box('hpcap',8,40,40,mcol('#3a3a42',0.35),sx*112,8,0,head,bevel=3)
    if cfg['face'].get('eyes') == 'glow':
        gm = mcol('#b56cff',0.3,emit='#b56cff'); box('eyeL',30,10,4,gm,-30,-10,77,head,bevel=0); box('eyeR',30,10,4,gm,30,-10,77,head,bevel=0)
    # arms
    sleeve = tp['c2'] if tp['kind'] == 'cardigan' else tp['c']
    hand_c = cfg.get('gloves', SKIN)
    arms = {}
    for nm, xs in (('P',124),('W',-124)):
        sh = empty('sh'+nm, xs, 455, 0, body)
        box('up',64,150,72,mcol(sleeve),0,-70,0,sh,bevel=6)
        el = empty('el'+nm, 0, -145, 0, sh)
        box('fo',60,108,68,mcol(sleeve),0,-50,0,el,bevel=6)
        if tp['kind'] == 'cardigan': box('cuff',54,16,64,mcol('#f4f1ee'),0,-98,0,el,bevel=2)
        if tp['kind'] in ('hoodie','jacket'): box('cuff',54,14,64,mcol(shade(sleeve,0.75)),0,-100,0,el,bevel=2)
        hand = empty('hand'+nm, 0, -128, 0, el)
        box('palm',56,50,62,mcol(hand_c),0,0,0,hand,bevel=6)
        th = empty('thumb'+nm, 26*(1 if nm=='P' else -1), 8, 14, hand)
        box('thumbm',14,30,16,mcol(hand_c),0,10,0,th,bevel=3)
        arms[nm] = dict(sh=sh, el=el, hand=hand, thumb=th)
    prop = None
    if cfg.get('prop') == 'book':
        prop = empty('book', 0, -40, 30, arms['W']['el'])
        box('bookm',70,96,22,{'all':mcol('#1f3f8a',0.5),'right':mcol('#f1efe8'),'left':mcol('#183370')},0,0,0,prop,bevel=3)
    return dict(root=root, body=body, head=head, arms=arms, cfg=cfg, face=fimg, prop=prop)

# ---------- poses (angles in radians; P = arm on screen-right when facing camera) ----------
def rot(o, x=0, y=0, z=0): o.rotation_euler = (x, y, z)
def apply_pose(ch, p):
    A = ch['arms']; P, W = A['P'], A['W']
    for a in (P, W): rot(a['sh']); rot(a['el']); rot(a['thumb'])
    rot(ch['body'], 0, 0, -0.38)
    rot(P['sh'], 0, -0.12, 0); rot(W['sh'], 0, 0.12, 0)
    if p == 'thumbs':
        rot(P['sh'], 0, -0.35, 0); rot(P['el'], 0, -2.6, 0)
        rot(P['thumb'], 0, 2.95, 0); P['thumb'].location = (0.0, -0.03, 0.0); P['thumb'].scale = (1.4, 1.4, 1.6)
    if p == 'cross':
        rot(P['sh'], -0.55, 0.25, 0); rot(P['el'], -1.35, 0, -1.25)
        rot(W['sh'], -0.55, -0.25, 0); rot(W['el'], -1.35, 0, 1.25)
    if p == 'finger':
        rot(P['sh'], -0.3, -0.45, 0); rot(P['el'], -1.9, 0, 0)
        rot(W['sh'], -0.35, 0.1, 0); rot(W['el'], -1.2, 0, 0.6)
    if p == 'wave':
        rot(P['sh'], 0, -2.55, 0); rot(P['el'], 0, -0.45, 0)
    if p == 'chin':
        rot(P['sh'], -0.45, 0.35, 0); rot(P['el'], -2.55, 0, 0.55)
    if p == 'offer':
        rot(P['sh'], -0.4, -0.55, 0); rot(P['el'], -1.0, 0, 0)
    if p == 'idle': pass
    if ch['cfg'].get('walk'):
        legs = [o for o in ch['body'].children if o.name.startswith('leg')]
        for o in legs: rot(o, 0.35 if o.name.startswith('legL') else -0.25, 0, 0)

# ---------- scene ----------
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
    sc.render.film_transparent = True; sc.render.image_settings.file_format = 'PNG'; sc.render.image_settings.color_mode = 'RGBA'
    try: sc.eevee.taa_render_samples = 64
    except Exception: pass
    for a in ('use_raytracing','use_shadows','use_gtao'):
        try: setattr(sc.eevee, a, True)
        except Exception: pass
    try: sc.view_settings.view_transform = 'Standard'; sc.view_settings.look = 'None'; sc.view_settings.exposure = 0.0
    except Exception: pass
    w = bpy.data.worlds.get('to2w') or bpy.data.worlds.new('to2w'); sc.world = w; w.use_nodes = True
    bg = w.node_tree.nodes.get('Background'); bg.inputs[0].default_value = (0.85,0.86,0.95,1); bg.inputs[1].default_value = 0.42
    def area(name, loc, power, color, size):
        L = bpy.data.lights.get(name) or bpy.data.lights.new(name,'AREA'); L.energy = power; L.color = color; L.size = size
        o = bpy.data.objects.new(name, L); COL.objects.link(o); o.location = loc
        o.rotation_euler = (Vector((0,0,4.0)) - Vector(loc)).to_track_quat('-Z','Y').to_euler()
    area('key', (-6,-8,9), 1500, (1.0,0.94,0.86), 6); area('fill', (7,-6,4), 520, (0.8,0.87,1.0), 6); area('rim', (4,7,8), 1500, (1,1,1), 4)
    cam = bpy.data.cameras.get('cam') or bpy.data.cameras.new('cam'); cam.lens = 85
    co = bpy.data.objects.new('cam', cam); COL.objects.link(co); sc.camera = co
    return co
def aim(co, frame):
    F = {'full': ((640,860),(-2.6,-21.5,5.8),(0,0,4.0)), 'half': ((640,640),(-1.8,-13.5,6.4),(0,0,5.1)), 'face': ((256,256),(-1.0,-7.2,6.4),(0,0,6.0))}
    (rx,ry), loc, at = F[frame]; sc = bpy.context.scene
    sc.render.resolution_x, sc.render.resolution_y = rx, ry; sc.render.resolution_percentage = 100
    co.location = loc; co.rotation_euler = (Vector(at)-Vector(loc)).to_track_quat('-Z','Y').to_euler()

def render_char(cid, frames=('full',)):
    os.makedirs(OUT_IMG, exist_ok=True); co = setup(); ch = build(cid); apply_pose(ch, C[cid]['pose']); out = []
    for f in frames:
        aim(co, f); path = os.path.join(OUT_IMG, f'{cid}_sig_{f}.png'); bpy.context.scene.render.filepath = path
        bpy.ops.render.render(write_still=True); out.append(path)
    return out

def export_glb(cid):
    os.makedirs(OUT_GLB, exist_ok=True); setup(); ch = build(cid); apply_pose(ch, 'idle')
    ch['body'].rotation_euler = (0,0,0)
    # apply bevel modifiers on export, keep hierarchy + names for the three.js rig
    bpy.ops.object.select_all(action='DESELECT')
    for o in COL.objects:
        if o.type in ('MESH','EMPTY'): o.select_set(True)
    path = os.path.join(OUT_GLB, f'{cid}.glb')
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, export_apply=True, export_yup=True,
                              export_cameras=False, export_lights=False, export_image_format='AUTO')
    return path
