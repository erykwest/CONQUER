"""CONQUER civic builder (Blender 5.x): church, tavern, market, piazza, town hall and
guild at three levels, the civic annexes and the church cemetery.

Low-poly, flat-coloured models in real metres on the game footprints of
civicLocalParts() / CIVIC_ANNEX_CATALOG (1 U = 3.5 m). Model axes are the game's
local axes: x, y as in houseLocalToWorld(s,x,y), the front (entrance) at -Y,
+Z up, origin on the ground at the structure centre. Parts are painted as
units by the 2.5D canvas painter; WebGL draws the same triangles with a depth
buffer. Faces are shaded in game like the castle. Palette keys starting with
'roof' turn white in winter.

Run inside Blender (BlenderMCP execute_code):
    CQ_DIR = r"...\\ASSETS\\blender"; CIVIC_OUT = r"...\\src\\assets\\civic-models.js"
    exec(open(CQ_DIR + r"\\build_civic.py", encoding="utf-8").read())
"""
import json, math, os, sys, importlib, random
from mathutils import Vector, Matrix
_here = os.path.dirname(os.path.abspath(__file__)) if '__file__' in globals() else CQ_DIR
if _here not in sys.path:
    sys.path.insert(0, _here)
import cq_blender
importlib.reload(cq_blender)
from cq_blender import Part, fresh_collection, export_part_indexed

S = 3.5   # metres per game unit
COLORS = {
    # ground
    'dirt': '#8a7354', 'gravel': '#b7ae9c', 'paving': '#b9ad97', 'pavingDark': '#9d927f', 'cobble': '#a59a87',
    'kerb': '#8c8476', 'lawn': '#7f9655', 'lawnDark': '#6a8247', 'soil': '#6e5539',
    # masonry
    'stoneRough': '#8f897d', 'stoneRoughDark': '#6f6a61', 'stone': '#b0a794', 'stoneTrim': '#958c7a',
    'stoneLight': '#cdc3ad', 'plaster': '#e2d6bc', 'plasterWarm': '#dcc196', 'brick': '#9a5a3e',
    # timber
    'wood': '#9a6a3f', 'woodLight': '#ba8a55', 'woodDark': '#6a4529', 'beam': '#4d3423',
    # roofs (winter: white)
    'roofShingle': '#76563c', 'roofShingleDark': '#5f442f', 'roofSlate': '#535a66', 'roofSlateDark': '#454b56',
    'roofTile': '#a5573a', 'roofTileDark': '#88452e', 'roofThatch': '#c4a35e', 'roofThatchDark': '#a8884a',
    'roofLead': '#5f6970',
    # details
    'dark': '#211d1a', 'glass': '#3e5b74', 'glassRed': '#8e3b3b', 'gold': '#d8b14a', 'iron': '#4f5357',
    'lamp': '#f2c14e', 'clock': '#ebe3cb', 'bronze': '#6f8466',
    'water': '#5d93aa', 'waterLight': '#8fc0cf',
    'hedge': '#4d6d39', 'leaf': '#5f8a42', 'leafDark': '#41622f', 'herb': '#6f9450',
    'flowerRed': '#c84a40', 'flowerYellow': '#e2bb47', 'flowerPurple': '#8d5ca6', 'flowerWhite': '#efe9d8',
    'hay': '#d4b35b', 'sack': '#cdb88c', 'barrel': '#8b5e35',
    'canvasRed': '#b4473a', 'canvasBlue': '#4f7091', 'canvasYellow': '#d4a645', 'canvasGreen': '#6f8046',
    'canvasWhite': '#e8dec6',
    'produceRed': '#c0453a', 'produceGreen': '#7da047', 'produceOrange': '#df8a35', 'cloth': '#7f5b8c',
}
KEYS = list(COLORS.keys())
COLL_NAME = 'CONQUER_Civic'
rng = random.Random(11)


class Model:
    def __init__(self, root, name, offset):
        self.root, self.name, self.offset, self.parts = root, name, offset, {}

    def part(self, key):
        return Part(self.root, key, COLORS, self.offset, prefix=self.name + '_')

    def done(self, key, p):
        self.parts[key] = p.finish()


# ------------------------------------------------------------------ primitives
def rect(cx, cy, w, d):
    return [(cx - w / 2, cy - d / 2), (cx + w / 2, cy - d / 2), (cx + w / 2, cy + d / 2), (cx - w / 2, cy + d / 2)]


def circ(cx, cy, r, n, a0=0.0):
    return [(cx + math.cos(a0 + 2 * math.pi * i / n) * r, cy + math.sin(a0 + 2 * math.pi * i / n) * r) for i in range(n)]


def prism(p, pts, z0, z1, key, top=None, bottom=False):
    n = len(pts)
    vs = [(x, y, z0) for x, y in pts] + [(x, y, z1) for x, y in pts]
    p.quads(vs, [(i, (i + 1) % n, n + (i + 1) % n, n + i) for i in range(n)], key)
    p.quads(vs, [tuple(range(n, 2 * n))], top or key)
    if bottom:
        p.quads(vs, [tuple(range(n - 1, -1, -1))], key)


def slab(p, top, th, key):
    """Quad slab (roof plane, awning) hanging th below its four top corners."""
    bot = [(x, y, z - th) for x, y, z in top]
    p.quads(list(top) + bot, [(0, 1, 2, 3), (7, 6, 5, 4), (0, 4, 5, 1), (1, 5, 6, 2), (2, 6, 7, 3), (3, 7, 4, 0)], key)


def plate(p, o, n, pts, key, d0=0.0, d1=.06):
    """Flat polygon (u, z) on a wall: o = point on the wall surface, n = outward normal."""
    tx, ty = -n[1], n[0]
    vs = []
    for d in (d0, d1):
        for uu, z in pts:
            vs.append((o[0] + tx * uu + n[0] * d, o[1] + ty * uu + n[1] * d, z))
    k = len(pts)
    faces = [tuple(range(k)), tuple(range(2 * k - 1, k - 1, -1))] + [(i, (i + 1) % k, k + (i + 1) % k, k + i) for i in range(k)]
    p.quads(vs, faces, key)


def arch_pts(w, h, z0, pointed=False, seg=4):
    r = w / 2
    if pointed:
        spring = z0 + h - r * 1.25
        return [(-r, z0), (r, z0), (r, spring), (r * .55, spring + r * .8), (0, z0 + h), (-r * .55, spring + r * .8), (-r, spring)]
    spring = z0 + h - r
    pts = [(-r, z0), (r, z0), (r, spring)]
    for k in range(1, seg):
        a = math.pi * k / seg
        pts.append((r * math.cos(a), spring + r * math.sin(a)))
    pts.append((-r, spring))
    return pts


def rect_pts(w, h, z0):
    return [(-w / 2, z0), (w / 2, z0), (w / 2, z0 + h), (-w / 2, z0 + h)]


def opening(p, o, n, w, h, z0, key='dark', frame=None, arch=None):
    """Window or door: optional frame plate behind a darker opening plate."""
    pts = (lambda ww, hh, zz: arch_pts(ww, hh, zz, pointed=(arch == 'pointed'))) if arch else rect_pts
    if frame:
        plate(p, o, n, pts(w + .3, h + .18 - max(0, .1 - z0), max(0, z0 - .1)), frame, 0, .05)
    plate(p, o, n, pts(w, h, z0), key, 0, .09)


def shutters(p, o, n, w, h, z0, key='woodDark'):
    tx, ty = -n[1], n[0]
    for s in (-1, 1):
        c = (o[0] + tx * s * (w / 2 + .22), o[1] + ty * s * (w / 2 + .22))
        plate(p, c, n, rect_pts(.4, h, z0), key, 0, .07)


def gable_roof(p, cx, cy, length, width, eave, ridge, axis, keys, over=.45, end_over=.35, th=.2, gable_key=None,
               ends=(True, True)):
    """Two roof slabs over a length x width block; ridge along 'x' or 'y'."""
    half = width / 2
    slope = (ridge - eave) / half
    L0 = -length / 2 - (end_over if ends[0] else 0)
    L1 = length / 2 + (end_over if ends[1] else 0)
    W, zo = half + over, eave - over * slope
    T = (lambda a, c, z: (cx + a, cy + c, z)) if axis == 'x' else (lambda a, c, z: (cx + c, cy + a, z))
    for s, key in ((-1, keys[0]), (1, keys[1])):
        slab(p, [T(L0, s * W, zo), T(L1, s * W, zo), T(L1, 0, ridge), T(L0, 0, ridge)], th, key)
    if gable_key:
        for e, on in ((-1, ends[0]), (1, ends[1])):
            if on:
                a = e * length / 2
                p.quads([T(a, -half, eave), T(a, half, eave), T(a, 0, ridge - th)], [(0, 1, 2)], gable_key)


def pyramid(p, cx, cy, w, d, z0, apex, keys, n=4, r=None, cap=None):
    base = [(x, y, z0) for x, y in (rect(cx, cy, w, d) if n == 4 else circ(cx, cy, r, n, math.pi / n))]
    top = (cx, cy, apex)
    for i in range(len(base)):
        p.quads([base[i], base[(i + 1) % len(base)], top], [(0, 1, 2)], keys[i % 2])
    p.quads(base[::-1], [tuple(range(len(base)))], cap or keys[1])


def cross(p, x, y, z, h, key='gold', axis='x'):
    t = h * .09
    p.box((x, y, z + h / 2), (t, t, h), key)
    p.box((x, y, z + h * .68), (h * .55, t, t) if axis == 'x' else (t, h * .55, t), key)


def tree(p, x, y, h, r, leaf='leaf', trunk='woodDark', n=7):
    p.box((x, y, h * .2), (r * .22, r * .22, h * .4), trunk)
    p.cylinder(0, 0, leaf, n=n, axis='z', center=(x, y, 0), radii=[r * .5, r, r * .85, r * .4, .03],
               along=[h * .3, h * .5, h * .72, h * .9, h])


def cypress(p, x, y, h, r, leaf='leafDark'):
    p.box((x, y, .3), (.18, .18, .6), 'woodDark')
    p.cylinder(0, 0, leaf, n=7, axis='z', center=(x, y, 0), radii=[r * .6, r, r * .75, .03], along=[h * .1, h * .35, h * .7, h])


def bush(p, x, y, r, h, key):
    p.cylinder(0, 0, key, n=6, axis='z', center=(x, y, 0), radii=[r * .8, r, r * .5], along=[0, h * .55, h])


def blob(p, cx, cy, r, z0, h, key, n=7, jitter=.15, top_scale=.55):
    base, top = [], []
    for i in range(n):
        a = 2 * math.pi * i / n
        rr = r * (1 + rng.uniform(-jitter, jitter))
        base.append((cx + math.cos(a) * rr, cy + math.sin(a) * rr, z0))
        top.append((cx + math.cos(a) * rr * top_scale, cy + math.sin(a) * rr * top_scale, z0 + h))
    p.quads(base + top, [(i, (i + 1) % n, n + (i + 1) % n, n + i) for i in range(n)] + [tuple(range(2 * n - 1, n - 1, -1))], key)


def barrel(p, x, y, z=0, r=.38, h=.95, lying=False):
    if lying:
        p.cylinder(r, 0, 'barrel', n=8, axis='x', center=(x, y, z + r), radii=[r * .85, r, r * .85], along=[-h / 2, 0, h / 2], cap_key='woodLight')
    else:
        p.cylinder(r, 0, 'barrel', n=8, axis='z', center=(x, y, z + h / 2), radii=[r * .85, r, r * .85], along=[-h / 2, 0, h / 2], cap_key='woodLight')
        p.cylinder(r * 1.01, .05, 'iron', n=8, axis='z', center=(x, y, z + h * .78))


def crate(p, x, y, z=0, s=.6, a=0.0):
    p.box((x, y, z + s / 2), (s, s, s), 'woodLight', rot=Matrix.Rotation(a, 3, 'Z') if a else None)


def sack(p, x, y, z=0):
    p.cylinder(.26, 0, 'sack', n=6, axis='z', center=(x, y, z), radii=[.24, .3, .2, .08], along=[0, .25, .55, .62])


def bench(p, x, y, length, axis='x'):
    w, d = (length, .45) if axis == 'x' else (.45, length)
    p.box((x, y, .45), (w, d, .08), 'woodLight')
    for k in (-1, 1):
        lx, ly = (x + k * (length / 2 - .2), y) if axis == 'x' else (x, y + k * (length / 2 - .2))
        p.box((lx, ly, .21), (.1 if axis == 'x' else .4, .4 if axis == 'x' else .1, .42), 'woodDark')


def lamp_post(p, x, y, h=3.2):
    p.box((x, y, h / 2), (.14, .14, h), 'iron')
    p.box((x, y, h + .18), (.36, .36, .36), 'lamp')
    pyramid(p, x, y, .5, .5, h + .36, h + .62, ('iron', 'iron'))


class Frame:
    """Local placement (rotation about Z + offset) for props built in their own axes."""
    def __init__(self, cx=0.0, cy=0.0, ang=0.0):
        self.c, self.ang, self.rot = Vector((cx, cy, 0)), ang, Matrix.Rotation(ang, 3, 'Z')

    def pt(self, x, y, z):
        v = self.rot @ Vector((x, y, z)) + self.c
        return (v.x, v.y, v.z)

    def box(self, p, c, size, key):
        p.box(self.pt(*c), size, key, rot=self.rot if self.ang else None)

    def slab(self, p, top, th, key):
        slab(p, [self.pt(*v) for v in top], th, key)


def stall(p, F, w=3.8, d=2.2, canvas=('canvasRed', 'canvasWhite'), goods=('produceRed', 'produceGreen', 'produceOrange')):
    """Market stall in frame F: counter at the local front (-y), striped awning."""
    for sx in (-1, 1):
        for sy, h in ((-1, 2.2), (1, 2.7)):
            F.box(p, (sx * (w / 2 - .1), sy * (d / 2 - .1), h / 2), (.12, .12, h), 'woodDark')
    F.box(p, (0, -d / 2 + .35, .45), (w - .2, .6, .9), 'wood')
    F.box(p, (0, -d / 2 + .3, .93), (w, .78, .06), 'woodLight')
    n = 6
    for i in range(n):
        x0, x1 = -w / 2 - .1 + i * (w + .2) / n, -w / 2 - .1 + (i + 1) * (w + .2) / n
        F.slab(p, [(x0, -d / 2 - .45, 2.12), (x1, -d / 2 - .45, 2.12), (x1, d / 2 + .1, 2.78), (x0, d / 2 + .1, 2.78)], .05, canvas[i % 2])
    for i, g in enumerate(goods):
        gx = -w / 2 + .6 + i * (w - 1.2) / max(1, len(goods) - 1)
        c = F.pt(gx, -d / 2 + .3, .96)
        p.cylinder(.3, 0, 'woodLight', n=7, axis='z', center=c, radii=[.24, .32], along=[0, .16])
        blob(p, c[0], c[1], .26, c[2] + .14, .14, g, n=6, top_scale=.5)
    c = F.pt(-w / 2 + .5, d / 2 - .4, 0)
    crate(p, c[0], c[1], 0, .55, F.ang)
    c = F.pt(w / 2 - .5, d / 2 - .45, 0)
    sack(p, c[0], c[1])


def timber_wall(p, a, b, z0, z1, n, key='beam', step=1.7, d=.07, braces=True, rail=True):
    """Half-timber framing on a wall face from a to b (2D, on the surface), outward normal n."""
    ax, ay = a
    L = math.hypot(b[0] - ax, b[1] - ay)
    tx, ty = (b[0] - ax) / L, (b[1] - ay) / L
    P = lambda uu, z: (ax + tx * uu + n[0] * d / 2, ay + ty * uu + n[1] * d / 2, z)
    rot = Matrix.Rotation(math.atan2(ty, tx), 3, 'Z')
    for z in (z0 + .08, z1 - .08) + (((z0 + z1) / 2,) if rail else ()):
        p.beam(P(0, z), P(L, z), d, .15, key)
    k = max(1, round(L / step))
    for i in range(k + 1):
        uu = min(L - .08, max(.08, i * L / k))
        p.box(P(uu, (z0 + z1) / 2), (.16, d, z1 - z0), key, rot=rot)
    if braces and k >= 2:
        bay = L / k
        p.beam(P(.15, z0 + .15), P(bay - .1, z1 - .15), d, .14, key)
        p.beam(P(L - .15, z0 + .15), P(L - bay + .1, z1 - .15), d, .14, key)


# ------------------------------------------------------------------ church
# civicLocalParts: nave 2.9 x 6.2 U at cy .25, transept 5.2 x 1.65 U at cy .35, tower 1.85 U at cy -2.65.
def church(m, L):
    """L1 small chapel, L2 parish church, L3 cathedral with twin towers and a portal porch."""
    wall = {1: 'stoneRough', 2: 'stone', 3: 'stoneLight'}[L]
    trim = {1: 'stoneRoughDark', 2: 'stoneTrim', 3: 'stoneTrim'}[L]
    roof = ('roofShingle', 'roofShingleDark') if L == 1 else ('roofSlate', 'roofSlateDark')
    glass = 'dark' if L == 1 else 'glass'
    wx = {1: 3.3, 2: 4.35, 3: 4.35}[L]
    wh = {1: 4.4, 2: 6.2, 3: 8.2}[L]
    pitch = 1.3 if L == 3 else .95
    rise = wx * pitch
    R, k = wh + rise, pitch
    y0, y1 = (-7.4, 5.0) if L == 1 else (-9.6, 9.0)
    ar = 2.0 if L == 1 else 2.55
    apse_h = wh - (1.1 if L < 3 else 1.9)
    cyt, hd, tx = .35 * S, 2.6, 8.6         # transept centre, half depth, arm end
    te = wh - (.3 if L == 2 else .8)
    tr = te + hd * pitch

    # Nave with plinth and apse.
    p = m.part('nave')
    p.box((0, (y0 + y1) / 2, wh / 2), (2 * wx, y1 - y0, wh), wall)
    p.box((0, (y0 + y1) / 2, .25), (2 * wx + .2, y1 - y0 + .1, .5), trim)
    apse = [(math.cos(a) * ar, y1 + math.sin(a) * ar) for a in [math.pi * i / 6 for i in range(7)]]
    prism(p, apse, 0, apse_h, wall)
    ys = (-4.6, -2.2, .8, 3.2) if L == 1 else (-5.4, -3.0, 5.6, 7.8)
    for sx in (-1, 1):
        for i, y in enumerate(ys):
            o, n = (sx * wx, y), (sx, 0)
            if L == 1:
                opening(p, o, n, .6, 1.4, 2.0, glass, arch='round')
            else:
                opening(p, o, n, .85 if L == 2 else 1.0, 2.7 if L == 2 else 4.2, 2.2,
                        'glassRed' if L == 3 and i % 2 else glass, frame=trim, arch='pointed')
    for a in (math.pi * .25, math.pi * .5, math.pi * .75):
        n = (math.cos(a), math.sin(a))
        opening(p, (n[0] * ar * .97, y1 + n[1] * ar * .97), n, .45 if L == 1 else .5, 1.3 if L == 1 else 2.0, 1.6 if L == 1 else 2.0, glass,
                arch='round' if L < 3 else 'pointed')
    if L >= 2:   # stepped buttresses between the bays
        for sx in (-1, 1):
            for y in (-7.4, -4.2, 4.5, 6.7, 8.8):
                if L == 3 and y < -6.2:
                    continue
                p.box((sx * (wx + .33), y, wh * .28), (.66, .6, wh * .56), trim)
                p.box((sx * (wx + .2), y, wh * .7), (.4, .5, wh * .3), trim)
    if L == 3:   # rose window in the west gable, above the porch
        plate(p, (0, y0), (0, -1), circ(0, wh + 1.9, 1.5, 12), trim, 0, .06)
        plate(p, (0, y0), (0, -1), circ(0, wh + 1.9, 1.2, 12), 'glassRed', 0, .1)
        plate(p, (0, y0), (0, -1), circ(0, wh + 1.9, .45, 8), 'gold', 0, .13)
    m.done('nave', p)

    p = m.part('naveRoof')
    # The cathedral roof stops flush with the west front between the towers.
    gable_roof(p, 0, (y0 + y1) / 2, y1 - y0, 2 * wx, wh, R, 'y', roof, gable_key=wall, ends=(L < 3, True))
    if L == 3:
        p.quads([(-wx, y0, wh), (wx, y0, wh), (0, y0, R - .2)], [(0, 1, 2)], wall)
    rim = [(math.cos(a) * (ar + .35), y1 + math.sin(a) * (ar + .35), apse_h - .15) for a in [math.pi * i / 6 for i in range(7)]]
    apex = (0, y1, apse_h + 2.0)
    for i in range(6):
        p.quads([rim[i], rim[i + 1], apex], [(0, 1, 2)], roof[i % 2])
    if L >= 2:
        cross(p, 0, y1 + .1, R - .1, 1.4, 'gold' if L == 3 else 'iron')
    if L == 3:   # fleche over the crossing
        p.box((0, cyt, R + .3), (1.1, 1.1, .9), 'stoneTrim')
        pyramid(p, 0, cyt, 0, 0, R + .75, R + 5.0, ('roofLead', 'roofSlateDark'), n=8, r=.8)
        cross(p, 0, cyt, R + 4.9, .9)
    m.done('naveRoof', p)

    # Transept arms (separate parts so each sorts on its own side of the nave).
    if L >= 2:
        over = .45
        zo_t = te - over * pitch
        x_r = (R - tr) / k
        x_e = min((R - zo_t) / k, wx + over)
        for sg, name in ((-1, 'armL'), (1, 'armR')):
            p = m.part(name)
            xm = sg * (wx + tx) / 2
            p.box((xm, cyt, te / 2), (tx - wx + .1, 2 * hd, te), wall)
            p.box((xm, cyt, .25), (tx - wx + .3, 2 * hd + .2, .5), trim)
            o, n = (sg * tx, cyt), (sg, 0)
            if L == 2:
                opening(p, o, n, 1.3, 3.4, 1.8, glass, frame=trim, arch='pointed')
            else:
                opening(p, o, n, 1.2, 3.4, 1.4, glass, frame=trim, arch='pointed')
                plate(p, o, n, circ(0, te + .9, 1.25, 8, math.pi / 8), trim, 0, .06)
                plate(p, o, n, circ(0, te + .9, 1.0, 8, math.pi / 8), 'glassRed', 0, .1)
            for s, key in ((-1, roof[0]), (1, roof[1])):
                slab(p, [(sg * x_e, cyt + s * (hd + over), zo_t), (sg * (tx + .35), cyt + s * (hd + over), zo_t),
                         (sg * (tx + .35), cyt, tr), (sg * x_r, cyt, tr)], .2, key)
            p.quads([(sg * tx, cyt - hd, te), (sg * tx, cyt + hd, te), (sg * tx, cyt, tr - .2)], [(0, 1, 2)], wall)
            m.done(name, p)

    if L < 3:
        # West tower with the door (the designated front, local -Y).
        p = m.part('tower')
        ty, th, tz = (-8.8, 1.9, 6.6) if L == 1 else (-2.65 * S, 3.0, 12.0)
        p.box((0, ty, tz / 2), (2 * th, 2 * th, tz), wall)
        p.box((0, ty, .3), (2 * th + .25, 2 * th + .25, .6), trim)
        front = (0, ty - th)
        door_w, door_h = (1.3, 2.4) if L == 1 else (1.9, 3.3)
        opening(p, front, (0, -1), door_w, door_h, 0, 'woodDark', frame=trim, arch='round')
        p.box((0, ty - th - .3, .1), (door_w + 1.2, .6, .2), trim)
        if L == 1:   # path to the street front of the plot
            p.box((0, (ty - th - .6 - 12.4) / 2, .03), (1.3, 12.4 + ty - th - .6, .06), 'gravel')
        else:
            p.box((0, ty, 8.4), (2 * th + .2, 2 * th + .2, .3), trim)
        for n in ((0, -1), (0, 1), (1, 0), (-1, 0)):
            o = (n[0] * th, ty + n[1] * th)
            if L == 1:
                opening(p, o, n, .3, .9, 3.8, 'dark')
            else:
                for u_ in (-1.0, 1.0):
                    c = (o[0] - n[1] * u_, o[1] + n[0] * u_)
                    opening(p, c, n, .9, 2.2, tz - 2.9, 'dark', frame=trim, arch='round')
                if n != (0, -1):
                    opening(p, o, n, .4, 1.2, 5.0, glass)
        m.done('tower', p)

        p = m.part('belfry')
        if L == 1:   # timber belfry under a shingled pyramid
            p.box((0, ty, tz + 1.0), (2 * th + .2, 2 * th + .2, 2.0), 'wood')
            for n in ((0, -1), (0, 1), (1, 0), (-1, 0)):
                o = (n[0] * (th + .1), ty + n[1] * (th + .1))
                plate(p, o, n, rect_pts(1.4, 1.2, tz + .4), 'dark', 0, .06)
                plate(p, o, n, rect_pts(2 * th + .2, .14, tz + .05), 'woodDark', 0, .05)
            pyramid(p, 0, ty, 2 * th + .8, 2 * th + .8, tz + 2.0, tz + 5.0, roof)
            cross(p, 0, ty, tz + 4.9, .9, 'iron')
        else:
            p.box((0, ty, tz + .15), (2 * th + .5, 2 * th + .5, .3), trim)
            pyramid(p, 0, ty, 2 * th + .7, 2 * th + .7, tz + .3, tz + 6.0, roof)
            cross(p, 0, ty, tz + 5.9, 1.3)
        m.done('belfry', p)
        return

    # Cathedral: twin towers on the nave's front corners and a portal porch between them.
    for sx, name in ((-1, 'towerL'), (1, 'towerR')):
        p = m.part(name)
        cx, cy, h, tz = sx * 3.35, -7.95, 1.68, 16.0
        p.box((cx, cy, tz / 2), (2 * h, 2 * h, tz), wall)
        p.box((cx, cy, .3), (2 * h + .2, 2 * h + .2, .6), trim)
        for z in (6.0, 11.2):
            p.box((cx, cy, z), (2 * h + .16, 2 * h + .16, .28), trim)
        for n in ((0, -1), (0, 1), (1, 0), (-1, 0)):
            o = (cx + n[0] * h, cy + n[1] * h)
            opening(p, o, n, .75, 2.8, 12.3, 'dark', frame=trim, arch='pointed')
            opening(p, o, n, .45, 1.7, 7.4, glass, arch='pointed')
        if sx < 0:
            plate(p, (cx, cy - h), (0, -1), circ(0, 9.2, .75, 8, math.pi / 8), 'clock', 0, .08)
            p.box((cx, cy - h - .1, 9.45), (.07, .06, .5), 'dark')
            p.box((cx + .16, cy - h - .1, 9.2), (.36, .06, .07), 'dark')
        p.box((cx, cy, tz + .2), (2 * h + .35, 2 * h + .35, .4), trim)
        for px in (-1, 1):
            for py in (-1, 1):
                qx, qy = cx + px * (h - .05), cy + py * (h - .05)
                p.box((qx, qy, tz + .8), (.42, .42, .8), wall)
                pyramid(p, qx, qy, .5, .5, tz + 1.2, tz + 2.4, ('roofLead', 'roofSlateDark'))
        pyramid(p, cx, cy, 0, 0, tz + .4, tz + 10.0, ('roofLead', 'roofSlateDark'), n=8, r=1.75)
        cross(p, cx, cy, tz + 9.9, 1.2)
        m.done(name, p)
    p = m.part('porch')
    py0 = -12.2
    pc, pd = (py0 + y0) / 2, y0 - py0
    p.box((0, pc, 2.6), (3.3, pd, 5.2), wall)
    p.box((0, pc, .3), (3.5, pd + .1, .6), trim)
    opening(p, (0, py0), (0, -1), 1.9, 3.7, 0, 'woodDark', frame=trim, arch='pointed')
    gable_roof(p, 0, pc, pd, 3.3, 5.2, 7.4, 'y', roof, over=.2, end_over=.2, th=.15, gable_key=wall, ends=(True, False))
    cross(p, 0, py0 - .1, 7.3, 1.0)
    p.box((0, py0 - .25, .1), (3.0, .5, .2), trim)
    m.done('porch', p)


# ------------------------------------------------------------------ tavern
# civicLocalParts: spine 2.2 x 5.0 U, front and back wings 4.6 x 1.55 U at cy -/+1.72 U.
def table_set(p, x, y, n_mugs=2):
    """Trestle table along x with a bench on each side and a few tankards."""
    p.box((x, y, .74), (1.8, .8, .07), 'woodLight')
    for k in (-1, 1):
        p.box((x + k * .7, y, .37), (.1, .6, .7), 'woodDark')
        bench(p, x, y + k * .75, 1.8)
    for i in range(n_mugs):
        p.cylinder(.07, 0, 'woodLight' if i % 2 else 'iron', n=6, axis='z', center=(x - .5 + i * .55, y + (.15 if i % 2 else -.15), 0),
                   radii=[.07, .07], along=[.775, .93])


def tavern(m, L):
    """L1 single-storey L plan, L2 two-storey T plan, L3 tall H plan (inside the H footprint)."""
    wwx, wcy, whd, sx_ = 4.6 * S / 2, 1.72 * S, 1.55 * S / 2, 2.2 * S / 2
    yb = 5.0 * S / 2
    inset = .3 if L == 3 else 0
    floor1 = {1: 3.4, 2: 3.0, 3: 3.0}[L]
    eave = {1: 3.4, 2: 6.0, 3: 7.6}[L]
    lower = 'stoneRough' if L < 3 else 'stone'
    upper = {1: 'wood', 2: 'plaster', 3: 'plasterWarm'}[L]
    roof = {1: ('roofThatch', 'roofThatchDark'), 2: ('roofShingle', 'roofShingleDark'), 3: ('roofSlate', 'roofSlateDark')}[L]
    over, th = (.4, .3) if L == 1 else (.4, .2)
    kw = {1: 1.0, 2: 1.05, 3: 1.2}[L]
    R = eave + whd * kw
    ks = (R - eave) / sx_
    wings = {1: [(-1, -sx_, wwx)], 2: [(-1, -wwx, wwx)], 3: [(-1, -wwx, wwx), (1, -wwx, wwx)]}[L]
    back_wing = L == 3
    rows = {1: [], 2: [floor1 + .9], 3: [floor1 + .9, floor1 + 3.1]}[L]

    for sgn, x0, x1 in wings:
        name = 'wingFront' if sgn < 0 else 'wingBack'
        p = m.part(name)
        cy, xc, ln = sgn * wcy, (x0 + x1) / 2, x1 - x0
        if L == 1:
            p.box((xc, cy, .35), (ln, 2 * whd, .7), 'stoneRough')
            p.box((xc, cy, (eave + .7) / 2), (ln - .2, 2 * whd - .2, eave - .7), 'wood')
            for x in [x0 + .6 + i * 1.2 for i in range(int((ln - 1.2) / 1.2) + 1)]:   # board battens
                for yy, n in ((cy - whd + .1, (0, -1)), (cy + whd - .1, (0, 1))):
                    if n[1] < 0 or x > sx_ + .3:
                        plate(p, (x, yy), n, rect_pts(.12, eave - .7, .7), 'woodDark', 0, .04)
        else:
            p.box((xc, cy, floor1 / 2), (ln - 2 * inset, 2 * (whd - inset), floor1), lower)
            p.box((xc, cy, (floor1 + eave) / 2), (ln, 2 * whd, eave - floor1), upper)
            yo_, yi_ = cy + sgn * whd, cy - sgn * whd
            faces = [((0, sgn), (x0, yo_), (x1, yo_)), ((1, 0), (x1, cy - whd), (x1, cy + whd)), ((-1, 0), (x0, cy + whd), (x0, cy - whd))]
            if x0 < -sx_ - .1:
                faces.append(((0, -sgn), (x0, yi_), (-sx_, yi_)))
            if x1 > sx_ + .1:
                faces.append(((0, -sgn), (sx_, yi_), (x1, yi_)))
            for n, a, b in faces:
                timber_wall(p, a, b, floor1, eave, n)
            if L == 3:   # jetty beam ends under the upper floor
                for x in [x0 + .4 + i * 1.0 for i in range(int((ln - .8) / 1.0) + 1)]:
                    p.box((x, cy + sgn * (whd - .15), floor1 - .1), (.16, .4, .16), 'beam')
        yo = cy + sgn * whd
        n = (0, sgn)
        for x in (-6.0, -3.0, 3.0, 6.0) if sgn < 0 else (-6.0, -2.0, 2.0, 6.0):
            if not (x0 + .9 < x < x1 - .9):
                continue
            z0 = 1.2 if L == 1 else 1.0
            opening(p, (x, yo - n[1] * inset), n, .9, 1.1, z0, 'dark', frame='woodDark')
            if L == 1:
                shutters(p, (x, yo), n, .9, 1.1, z0)
            for zr in rows:
                opening(p, (x, yo), n, .9, 1.2, zr, 'glass' if L == 3 else 'dark', frame='woodDark')
                shutters(p, (x, yo), n, .9, 1.2, zr)
                if L == 3:
                    p.box((x, yo + sgn * .15, zr - .12), (1.2, .28, .22), 'woodDark')
                    p.box((x, yo + sgn * .15, zr + .05), (1.1, .22, .16), 'flowerRed')
        for ex in (x0, x1):
            if abs(ex) > sx_ + .1:
                en = (1 if ex > 0 else -1, 0)
                opening(p, (ex - en[0] * inset, cy), en, .9, 1.1, 1.2 if L == 1 else 1.0, 'dark', frame='woodDark')
                for zr in rows:
                    opening(p, (ex, cy), en, .9, 1.2, zr, 'dark', frame='woodDark')
        if sgn < 0:   # front door, sign, bench, barrel
            fy = yo + inset
            opening(p, (0, fy), (0, -1), 1.6, 2.6, 0, 'woodDark', frame='stoneTrim' if L > 1 else 'beam', arch='round')
            p.box((0, fy - .2, .08), (2.4, .4, .16), 'stoneTrim')
            p.box((2.0, yo - .2, floor1 + (-.6 if L == 1 else -.3)), (.08, .4, .08), 'iron')
            plate(p, (2.0, yo - .25), (1, 0), rect_pts(.4, .55, floor1 + (-1.25 if L == 1 else -.95)),
                  {1: 'woodLight', 2: 'canvasRed', 3: 'gold'}[L], -.03, .03)
            bench(p, -2.4 if L == 1 else -3.6, fy - .2, 2.0 if L == 1 else 2.2)
            barrel(p, 4.0, fy - .12, r=.3, h=.85)
            if L == 3:
                for lx in (-1.3, 1.3):
                    p.box((lx, yo - .15, 2.9), (.08, .3, .08), 'iron')
                    p.box((lx, yo - .26, 2.65), (.26, .26, .4), 'lamp')
        gable_roof(p, xc, cy, ln, 2 * whd, eave, R, 'x', roof, over=over, th=th, gable_key=upper)
        if L == 3:   # dormers on the outer slope
            for x in (-4.6, 4.6):
                dy = yo - sgn * 1.0
                p.box((x, dy - sgn * .7, eave + .6), (1.7, 1.4, 1.4), upper)
                opening(p, (x, dy), (0, sgn), .8, .9, eave + .15, 'glass', frame='woodDark')
                gable_roof(p, x, dy - sgn * .7, 1.4, 1.7, eave + 1.3, eave + 2.1, 'y', roof, over=.15, end_over=.15, th=.12, gable_key=upper)
        m.done(name, p)

    # Spine: from the front wing back to the back wing (H) or to its own gable end (L, T).
    p = m.part('spine')
    ys = wcy - whd + .05
    ye = ys if back_wing else yb
    yc, yl = (ye - ys) / 2, ye + ys
    if L == 1:
        p.box((0, yc, .35), (2 * sx_, yl, .7), 'stoneRough')
        p.box((0, yc, (eave + .7) / 2), (2 * sx_ - .2, yl, eave - .7), 'wood')
    else:
        p.box((0, yc, floor1 / 2), (2 * (sx_ - inset), yl, floor1), lower)
        p.box((0, yc, (floor1 + eave) / 2), (2 * sx_, yl, eave - floor1), upper)
        for sxx in (-1, 1):
            a, b = ((sxx * sx_, -ys), (sxx * sx_, ye)) if sxx > 0 else ((sxx * sx_, ye), (sxx * sx_, -ys))
            timber_wall(p, a, b, floor1, eave, (sxx, 0), step=2.0)
        if not back_wing:
            timber_wall(p, (sx_, ye), (-sx_, ye), floor1, eave, (0, 1))
    wy = [0] if back_wing else [-.5, 4.5]
    for sxx in (-1, 1):
        for y in wy:
            opening(p, (sxx * (sx_ - inset), y), (sxx, 0), 1.0, 1.2, 1.1, 'dark', frame='woodDark')
            for zr in rows:
                opening(p, (sxx * sx_, y), (sxx, 0), 1.0, 1.2, zr, 'dark', frame='woodDark')
    if not back_wing:
        opening(p, (0, ye), (0, 1), 1.2, 2.2, 0, 'woodDark', frame='beam')
        for zr in rows:
            opening(p, (0, ye), (0, 1), .9, 1.2, zr, 'dark', frame='woodDark')
    zo = eave - over * ks
    y_r = wcy
    y_e = wcy - whd - over * ks / kw
    yb_e, yb_r = (y_e, y_r) if back_wing else (ye + .35, ye + .35)
    for sxx, key in ((-1, roof[0]), (1, roof[1])):
        slab(p, [(sxx * (sx_ + over), -y_e, zo), (sxx * (sx_ + over), yb_e, zo), (0, yb_r, R), (0, -y_r, R)], th, key)
    if not back_wing:
        p.quads([(-sx_, ye, eave), (sx_, ye, eave), (0, ye, R - th)], [(0, 1, 2)], upper)
    m.done('spine', p)

    p = m.part('chimneys')
    spots = {1: [(1.8, 4.0)], 2: [(-5.5, -wcy), (1.6, 5.0)], 3: [(-5.5, -wcy), (5.5, wcy), (0, 0)]}[L]
    for x, y in spots:
        p.box((x, y, (R + 1.2) / 2), (.85, .85, R + 1.2), 'stoneRough' if L < 3 else 'brick')
        p.box((x, y, R + 1.25), (1.05, 1.05, .2), 'stoneTrim')
    m.done('chimneys', p)


# ------------------------------------------------------------------ market (4 x 4 U)
def market(m, L):
    h = 2 * S
    p = m.part('ground')
    p.box((0, 0, .04), (2 * h - .1, 2 * h - .1, .08), {1: 'dirt', 2: 'cobble', 3: 'paving'}[L])
    if L == 1:
        for _ in range(7):
            blob(p, rng.uniform(-5, 5), rng.uniform(-5, 5), rng.uniform(.5, 1.0), .08, .02, 'gravel', n=6, top_scale=.95)
    else:
        for sx in (-1, 1):
            p.box((sx * (h - .25), 0, .09), (.4, 2 * h - .1, .1), 'kerb')
            p.box((0, sx * (h - .25), .09), (2 * h - .1, .4, .1), 'kerb')
        if L == 3:
            p.box((0, 0, .09), (5.0, 5.0, .02), 'pavingDark')
            p.box((0, 0, .1), (3.6, 3.6, .02), 'paving')
    m.done('ground', p)
    canv = [('canvasRed', 'canvasWhite'), ('canvasBlue', 'canvasWhite'), ('canvasYellow', 'canvasRed'), ('canvasGreen', 'canvasYellow')]
    goods = [('produceRed', 'produceGreen', 'produceOrange'), ('cloth', 'canvasBlue', 'cloth'),
             ('produceGreen', 'produceOrange', 'produceGreen'), ('sack', 'produceRed', 'sack')]
    k = 0
    for sy in (-1, 1):
        for sx in (-1, 1):
            p = m.part('stall%d' % k)
            stall(p, Frame(sx * 3.6, sy * 3.7, 0 if sy > 0 else math.pi), 3.8, 2.3, canv[k], goods[k])
            m.done('stall%d' % k, p)
            k += 1
    p = m.part('props')
    for i, (x, y) in enumerate(((-6.2, 0), (6.2, .4), (-1.2, 6.3), (1.4, -6.3))):
        if i % 2:
            barrel(p, x, y)
            barrel(p, x + .8, y + .2, r=.33, h=.85)
        else:
            crate(p, x, y, 0, .65, .2)
            crate(p, x + .2, y + .1, .65, .5, .6)
            sack(p, x + .7, y - .5)
    if L >= 2:
        for x, y in ((-6.3, -2.2), (6.3, 2.6)):
            sack(p, x, y)
            sack(p, x + .5, y + .2)
    m.done('props', p)
    p = m.part('centre')
    if L == 2:   # market cross
        prism(p, circ(0, 0, 1.4, 8, math.pi / 8), 0, .3, 'stone')
        prism(p, circ(0, 0, 1.0, 8, math.pi / 8), .3, .6, 'stone')
        p.cylinder(.22, 0, 'stoneLight', n=8, axis='z', center=(0, 0, 0), radii=[.24, .2], along=[.6, 3.8])
        cross(p, 0, 0, 3.6, 1.3, 'stoneLight')
    elif L == 3:   # covered weighing pavilion
        prism(p, circ(0, 0, 2.1, 8, math.pi / 8), 0, .25, 'stone')
        for x, y in circ(0, 0, 1.75, 8, math.pi / 8):
            p.box((x, y, 1.55), (.2, .2, 2.6), 'woodDark')
        prism(p, circ(0, 0, 1.95, 8, math.pi / 8), 2.85, 3.1, 'woodDark')
        pyramid(p, 0, 0, 0, 0, 2.9, 5.2, ('roofTile', 'roofTileDark'), n=8, r=2.6)
        p.box((0, 0, 5.3), (.25, .25, .4), 'gold')
        p.box((0, 0, .9), (.16, .16, 1.3), 'woodDark')      # weighing beam with two pans
        p.box((0, 0, 1.55), (1.8, .1, .1), 'wood')
        for s in (-1, 1):
            p.cylinder(.3, 0, 'iron', n=7, axis='z', center=(s * .85, 0, 0), radii=[.2, .32], along=[.75, .85])
    if L >= 2:
        for x, y in ((-6.6, -6.6), (6.6, 6.6)) if L == 2 else ((-6.6, -6.6), (6.6, -6.6), (-6.6, 6.6), (6.6, 6.6)):
            p.box((x, y, 2.4), (.12, .12, 4.8), 'woodDark')
            bw = -1.1 if x > 0 else 1.1
            plate(p, (x, y), (0, -1), [(0, 3.6), (bw, 3.6), (bw, 4.6), (0, 4.6)], 'canvasRed' if x * y > 0 else 'canvasBlue', -.02, .02)
    m.done('centre', p)


# ------------------------------------------------------------------ piazza (5 x 5 U), three variants
def plaza_base(m, key, L):
    h = 2.5 * S
    p = m.part('ground')
    p.box((0, 0, .05), (2 * h - .2, 2 * h - .2, .1), key)
    for sx in (-1, 1):
        p.box((sx * (h - .3), 0, .1), (.4, 2 * h - .2, .12), 'kerb')
        p.box((0, sx * (h - .3), .1), (2 * h - .2, .4, .12), 'kerb')
    return p, h


def plaza_paved(m, L):
    p, h = plaza_base(m, {1: 'gravel', 2: 'paving', 3: 'paving'}[L], L)
    if L == 1:
        for _ in range(9):
            a = rng.uniform(0, 6.3)
            blob(p, math.cos(a) * rng.uniform(1, 6), math.sin(a) * rng.uniform(1, 6), rng.uniform(.4, .8), .1, .02, 'paving', n=5, top_scale=.95)
    else:
        p.box((0, 0, .11), (6.0, 6.0, .02), 'pavingDark')
        p.box((0, 0, .12), (4.6, 4.6, .02), 'paving')
        for sx in (-1, 1):
            p.box((sx * 5.2, 0, .11), (.5, 2 * h - 1.2, .02), 'pavingDark')
            p.box((0, sx * 5.2, .11), (2 * h - 1.2, .5, .02), 'pavingDark')
    m.done('ground', p)
    p = m.part('furniture')
    for sx in (-1, 1):
        for sy in (-1, 1):
            if L == 1:
                p.cylinder(.22, 0, 'stone', n=6, axis='z', center=(sx * 7.2, sy * 7.2, 0), radii=[.24, .2, .12], along=[0, .7, .85])
            else:
                lamp_post(p, sx * 7.2, sy * 7.2)
    if L >= 2:
        for x, y, ax in ((-4.2, 0, 'y'), (4.2, 0, 'y'), (0, -4.2, 'x'), (0, 4.2, 'x')):
            bench(p, x, y, 2.0, ax)
    m.done('furniture', p)
    if L == 3:   # column with a bronze statue on stepped base
        p = m.part('monument')
        for i, s in enumerate((4.2, 3.2, 2.2)):
            p.box((0, 0, .1 + i * .3 + .15), (s, s, .3), 'stone')
        p.box((0, 0, 1.0 + .8), (1.4, 1.4, 1.6), 'stoneTrim')
        p.box((0, 0, 2.65), (1.6, 1.6, .2), 'stone')
        p.cylinder(.42, 0, 'stoneLight', n=10, axis='z', center=(0, 0, 0), radii=[.45, .4], along=[2.75, 7.6])
        p.box((0, 0, 7.75), (1.1, 1.1, .3), 'stone')
        p.taper((0, 0, 7.9), (0, 0, 9.2), .5, .4, .32, .3, 'bronze')
        p.cylinder(.18, 0, 'bronze', n=6, axis='z', center=(0, 0, 9.2), radii=[.12, .2, .16, .02], along=[0, .1, .3, .45])
        p.beam((.15, 0, 9.0), (.6, -.1, 9.75), .1, .1, 'bronze')
        m.done('monument', p)


def plaza_fountain(m, L):
    p, h = plaza_base(m, 'gravel' if L == 1 else 'paving', L)
    if L >= 2:
        prism(p, circ(0, 0, 5.2 if L == 3 else 4.2, 16), .1, .13, 'pavingDark')
    m.done('ground', p)
    p = m.part('fountain')
    if L == 1:
        p.ring(2.3, 1.95, .35, 'stone', n=14, axis='z', center=(0, 0, .45), side_key='stoneTrim')
        p.cylinder(1.95, 0, 'water', n=14, axis='z', center=(0, 0, 0), radii=[1.95, 1.95], along=[.1, .62])
        p.box((0, 0, .75), (.45, .45, 1.3), 'stone')
        p.box((.32, 0, 1.15), (.25, .1, .1), 'iron')
    else:
        r = 3.0 if L == 2 else 3.6
        n = 8 if L == 2 else 12
        if L == 3:
            prism(p, circ(0, 0, 4.4, n, math.pi / n), .1, .35, 'stone')
        z0 = .1 if L == 2 else .35
        p.ring(r, r - .4, .4, 'stoneLight', n=n, axis='z', center=(0, 0, z0 + .4), side_key='stoneTrim')
        prism(p, circ(0, 0, r - .4, n, math.pi / n), z0, z0 + .62, 'water')
        p.cylinder(.35, 0, 'stoneLight', n=8, axis='z', center=(0, 0, 0), radii=[.4, .32], along=[z0, z0 + 3.4 if L == 3 else z0 + 1.9])
        for zb, rb in (((z0 + 1.7, 1.25),) if L == 2 else ((z0 + 1.6, 1.6), (z0 + 2.9, 1.0))):
            p.cylinder(rb, 0, 'stoneLight', n=10, axis='z', center=(0, 0, 0), radii=[.3, rb, rb], along=[zb - .4, zb - .05, zb + .08])
            p.cylinder(rb - .12, 0, 'water', n=10, axis='z', center=(0, 0, 0), radii=[rb - .12, rb - .12], along=[zb, zb + .1])
        top = z0 + (2.0 if L == 2 else 3.4)
        p.cylinder(.25, 0, 'bronze' if L == 3 else 'stoneLight', n=6, axis='z', center=(0, 0, top),
                   radii=[.15, .25, .02], along=[0, .25, .7 if L == 3 else .45])
    m.done('fountain', p)
    if L >= 2:
        p = m.part('furniture')
        for x, y, ax in ((-6.0, 0, 'y'), (6.0, 0, 'y'), (0, -6.0, 'x'), (0, 6.0, 'x')):
            bench(p, x, y, 2.0, ax)
        if L == 3:
            for sx in (-1, 1):
                for sy in (-1, 1):
                    lamp_post(p, sx * 7.2, sy * 7.2)
        m.done('furniture', p)


def plaza_garden(m, L):
    p, h = plaza_base(m, 'lawn', L)
    p.box((0, 0, .11), (1.8, 2 * h - .6, .02), 'gravel')
    p.box((0, 0, .11), (2 * h - .6, 1.8, .02), 'gravel')
    m.done('ground', p)
    flowers = ['flowerRed', 'flowerYellow', 'flowerPurple', 'flowerWhite']
    for qi, (sx, sy) in enumerate(((-1, -1), (1, -1), (1, 1), (-1, 1))):
        cx, cy = sx * 4.4, sy * 4.4
        p = m.part('bed%d' % qi)
        p.box((cx, cy, .1), (4.4, 4.4, .12), 'soil')
        for i in range(5 if L == 1 else 8):
            a = 2 * math.pi * i / (5 if L == 1 else 8)
            bush(p, cx + math.cos(a) * 1.3, cy + math.sin(a) * 1.3, .38, .55, flowers[(i + qi) % (2 if L == 1 else 4)])
        if L >= 2:
            for side in (-1, 1):
                p.box((cx + side * 2.3, cy, .38), (.4, 4.9, .55), 'hedge')
                p.box((cx, cy + side * 2.3, .38), (4.2, .4, .55), 'hedge')
            tree(p, cx, cy, 4.2 if L == 2 else 5.2, 1.3 if L == 2 else 1.6, 'leaf' if qi % 2 else 'leafDark')
        else:
            bush(p, cx, cy, .7, 1.0, 'herb')
        m.done('bed%d' % qi, p)
    if L >= 2:
        p = m.part('furniture')
        for x, y, ax in ((-1.4, -6.2, 'y'), (1.4, 6.2, 'y'), (-6.2, 1.4, 'x'), (6.2, -1.4, 'x')):
            bench(p, x, y, 1.8, ax)
        if L == 3:   # gazebo at the crossing
            prism(p, circ(0, 0, 2.0, 6), .1, .3, 'stone')
            for x, y in circ(0, 0, 1.65, 6):
                p.box((x, y, 1.55), (.18, .18, 2.5), 'woodLight')
            prism(p, circ(0, 0, 1.8, 6), 2.8, 3.0, 'woodDark')
            pyramid(p, 0, 0, 0, 0, 2.95, 4.6, ('roofTile', 'roofTileDark'), n=6, r=2.4)
            p.box((0, 0, 4.7), (.2, .2, .3), 'gold')
        m.done('furniture', p)


# ------------------------------------------------------------------ town hall and guild (well civics)
def bell(p, x, y, z, r=.55):
    """Bronze bell hanging from a headstock, mouth at z."""
    p.cylinder(r, 0, 'bronze', n=8, axis='z', center=(x, y, 0), radii=[r, r * .82, r * .55, r * .2], along=[z, z + .35, z + .9, z + 1.05])
    p.box((x, y, z + 1.15), (r * 2.6, .2, .2), 'woodDark')


def sundial(p, o, n, z, r=1.0, key='plaster'):
    """Painted meridiana on a wall: a square panel, hour lines fanning down from the gnomon."""
    plate(p, o, n, rect_pts(2 * r, 2 * r, z - 2 * r * .8), key, 0, .05)
    top = z + r * .2 - .15
    for k in range(7):
        a = math.pi * (1.1 + .8 * k / 6)
        c, s_ = math.cos(a), math.sin(a)
        ln = r * (.9 if k % 3 else 1.05)
        w = .035 if k % 3 else .06
        plate(p, o, n, [(-s_ * w, top + c * w), (c * ln - s_ * w, top + s_ * ln + c * w),
                        (c * ln + s_ * w, top + s_ * ln - c * w), (s_ * w, top - c * w)], 'dark', 0, .08)
    plate(p, o, n, circ(0, top, .12, 6), 'gold', 0, .1)
    p.beam((o[0] + n[0] * .08, o[1] + n[1] * .08, top), (o[0] + n[0] * .75, o[1] + n[1] * .75, top - .7), .05, .05, 'iron')


def clock_face(p, o, n, z, r=.9):
    plate(p, o, n, circ(0, z, r + .15, 12, math.pi / 12), 'stoneTrim', 0, .05)
    plate(p, o, n, circ(0, z, r, 12, math.pi / 12), 'clock', 0, .08)
    plate(p, o, n, [(-.04, z), (.04, z), (.04, z + r * .78), (-.04, z + r * .78)], 'dark', 0, .11)
    plate(p, o, n, [(0, z - .04), (r * .55, z - .04), (r * .55, z + .04), (0, z + .04)], 'dark', 0, .11)


def merlons(p, a, b, z, key, step=1.15, swallow=False):
    """Battlement teeth along a wall top from a to b; swallowtail (ghibelline) when asked."""
    L = math.hypot(b[0] - a[0], b[1] - a[1])
    tx, ty = (b[0] - a[0]) / L, (b[1] - a[1]) / L
    rot = Matrix.Rotation(math.atan2(ty, tx), 3, 'Z')
    k = max(1, int(L / step))
    for i in range(k):
        u = (i + .5) * L / k
        x, y = a[0] + tx * u, a[1] + ty * u
        if swallow:
            p.box((x, y, z + .3), (.6, .4, .6), key, rot=rot)
            for s_ in (-1, 1):
                p.box((x + tx * s_ * .19, y + ty * s_ * .19, z + .85), (.22, .4, .5), key, rot=rot)
        else:
            p.box((x, y, z + .4), (.6, .4, .8), key, rot=rot)


def arcade(p, xs, y, n, z1, col, fill, depth=.35):
    """Round arches on columns along x at the wall plane y (outward normal n = (0, +-1))."""
    for x in xs:
        p.cylinder(.28, 0, col, n=8, axis='z', center=(x, y - n[1] * depth, 0), radii=[.36, .27, .27, .38], along=[0, .3, z1 - .4, z1])
    for xa, xb in zip(xs, xs[1:]):
        r = (xb - xa - .5) / 2
        spring = z1 - .45 - r
        # Each spandrel half is fanned from its top outer corner, so it stays a clean polygon.
        for sd in (-1, 1):
            arc = [(sd * math.cos(math.pi * k / 8) * r, spring + math.sin(math.pi * k / 8) * r) for k in range(5)]
            pts = [(sd * (r + .25), z1), (sd * (r + .25), spring)] + arc + [(0, z1)]
            plate(p, ((xa + xb) / 2, y), n, pts if sd < 0 else pts[::-1], fill, -depth - .2, .02)


# civicLocalParts: hall 4 x 2.5 U at cy .35, tower 1.3 x 1.3 U at (0, -1.15) on the middle of the front.
def townhall(m, L):
    """L1 timber house of the commune, L2 brick broletto over an open arcade, L3 stone palazzo
    with ghibelline merlons. The civic tower rises from the middle of the front and carries the
    bell and the sundial at every level (the arengario balcony from L2, the clock at L3)."""
    x0, x1 = -2.0 * S, 2.0 * S
    yf, yb = -.9 * S, 1.6 * S
    hc, hd = (yf + yb) / 2, yb - yf
    tcx, tcy, th = 0.0, -1.15 * S, 2.15
    gf = {1: 3.2, 2: 3.7, 3: 4.1}[L]
    eave = {1: 6.3, 2: 7.8, 3: 10.8}[L]
    wall = {1: 'stoneRough', 2: 'stone', 3: 'stoneLight'}[L]
    trim = {1: 'stoneRoughDark', 2: 'stoneTrim', 3: 'stoneTrim'}[L]
    upper = {1: 'plasterWarm', 2: 'brick', 3: 'stoneLight'}[L]
    roof = ('roofShingle', 'roofShingleDark') if L == 1 else ('roofTile', 'roofTileDark')
    glass = 'dark' if L == 1 else 'glass'
    tw = x1 - x0

    p = m.part('hall')
    p.box((0, hc, .15), (tw + .3, hd + .3, .3), trim)
    if L == 1:
        p.box((0, hc, gf / 2), (tw, hd, gf), wall)
        p.box((0, hc, (gf + eave) / 2), (tw + .3, hd + .3, eave - gf), upper)
        for n, a, b in (((0, -1), (x0 - .15, yf - .15), (x1 + .15, yf - .15)), ((1, 0), (x1 + .15, yf - .15), (x1 + .15, yb + .15)),
                        ((-1, 0), (x0 - .15, yb + .15), (x0 - .15, yf - .15)), ((0, 1), (x1 + .15, yb + .15), (x0 - .15, yb + .15))):
            timber_wall(p, a, b, gf, eave, n)
        opening(p, (-4.6, yf), (0, -1), 1.6, 2.5, 0, 'woodDark', frame='beam', arch='round')
        p.box((-4.6, yf - .3, .1), (2.4, .6, .2), trim)
        opening(p, (4.6, yf), (0, -1), .8, 1.0, 1.2, 'dark', frame='woodDark')
        shutters(p, (4.6, yf), (0, -1), .8, 1.0, 1.2)
        for x in (-5.4, -3.2, 3.2, 5.4):
            opening(p, (x, yf - .15), (0, -1), .9, 1.2, gf + .9, glass, frame='woodDark')
            shutters(p, (x, yf - .15), (0, -1), .9, 1.2, gf + .9)
        for x in (-4.0, 0, 4.0):
            opening(p, (x, yb + .15), (0, 1), .9, 1.2, gf + .9, glass, frame='woodDark')
        for sx in (-1, 1):
            for y in (hc - 2.0, hc + 2.0):
                opening(p, (sx * (x1 + .15), y), (sx, 0), .9, 1.2, gf + .9, glass, frame='woodDark')
    else:
        core = yf + 2.3
        p.box((0, (core + yb) / 2, gf / 2), (tw - .2, yb - core, gf), wall)
        p.box((0, (yf + core) / 2, .32), (tw - .2, core - yf, .04), 'paving')
        p.box((0, hc, (gf + eave) / 2), (tw, hd, eave - gf), upper)
        p.box((0, hc, gf + .1), (tw + .2, hd + .2, .3), trim)
        for xs in ((-6.75, -4.65, -2.55), (2.55, 4.65, 6.75)):   # an arcade either side of the tower
            arcade(p, xs, yf, (0, -1), gf, 'stoneLight', upper)
        for sx in (-1, 1):
            p.cylinder(.28, 0, 'stoneLight', n=8, axis='z', center=(sx * (x1 - .35), core - .3, 0), radii=[.36, .27, .27, .38], along=[0, .3, gf - .4, gf])
            opening(p, (sx * 4.65, core), (0, -1), 1.4, 2.5, 0, 'woodDark', frame=trim, arch='round')
        rows = [gf + 1.0] if L == 2 else [gf + 1.0, gf + 4.0]
        for zr in rows:
            for x in (-5.7, -3.5, 3.5, 5.7):
                opening(p, (x, yf), (0, -1), 1.0, 2.0, zr, glass, frame=trim, arch='pointed' if L == 2 else 'round')
                p.box((x, yf - .04, zr + 1.1), (.08, .1, 2.2), trim)          # mullion of the biforate
            for x in (-4.5, 0, 4.5):
                opening(p, (x, yb), (0, 1), 1.0, 2.0, zr, glass, frame=trim, arch='pointed' if L == 2 else 'round')
            for sx in (-1, 1):
                for y in (hc - 2.0, hc + 2.0):
                    opening(p, (sx * x1, y), (sx, 0), 1.0, 2.0, zr, glass, frame=trim, arch='pointed' if L == 2 else 'round')
        for x in (-4.6, 4.6):     # coats of arms between the windows
            plate(p, (x, yf), (0, -1), [(-.35, eave - 1.6), (.35, eave - 1.6), (.35, eave - 1.0), (0, eave - .8), (-.35, eave - 1.0)][::-1],
                  'canvasRed' if x < 0 else 'canvasBlue', 0, .06)
    if L < 3:
        gable_roof(p, 0, hc, tw, hd, eave, eave + hd / 2 * (.8 if L == 1 else .55), 'x', roof, gable_key=upper)
    else:
        for a, b in (((x0, yf), (x1, yf)), ((x1, yf), (x1, yb)), ((x1, yb), (x0, yb)), ((x0, yb), (x0, yf))):
            dx, dy = b[0] - a[0], b[1] - a[1]
            ln = math.hypot(dx, dy)
            p.box(((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, eave + .1), (abs(dx) + .5 if dy == 0 else .5, abs(dy) + .5 if dx == 0 else .5, .2), trim)
            merlons(p, a, b, eave + .2, upper, swallow=True)
        gable_roof(p, 0, hc, tw - .6, hd - .6, eave, eave + 2.4, 'x', roof, over=0, end_over=0, gable_key=upper)
    m.done('hall', p)

    # The civic tower on the front right corner.
    tz = {1: 8.0, 2: 12.8, 3: 18.8}[L]
    tfront = tcy - th
    p = m.part('tower')
    p.box((tcx, tcy, tz / 2), (2 * th, 2 * th, tz), wall if L > 1 else 'stoneRough')
    p.box((tcx, tcy, .3), (2 * th + .25, 2 * th + .25, .6), trim)
    if L >= 2:
        for z in (gf + .1, tz - 4.2 if L == 3 else tz - .2):
            p.box((tcx, tcy, z), (2 * th + .14, 2 * th + .14, .26), trim)
    opening(p, (tcx, tfront), (0, -1), 1.2, 2.4, 0, 'woodDark', frame=trim, arch='round')
    if L >= 2:   # arengario: the balcony the commune speaks from, over the tower door
        az = gf + .4
        opening(p, (tcx, tfront), (0, -1), 1.0, 2.0, az + .2, 'woodDark', frame=trim, arch='round')
        p.box((tcx, tfront - .55, az), (2.8, 1.1, .22), trim)
        p.box((tcx, tfront - 1.05, az + .4), (2.8, .1, .6), 'iron')
        for sx in (-1, 1):
            p.box((tcx + sx * 1.35, tfront - .6, az + .4), (.1, 1.0, .6), 'iron')
            p.beam((tcx + sx * .9, tfront - .9, az - .1), (tcx + sx * .9, tfront - .05, az - 1.1), .18, .18, trim)
    for n in ((1, 0), (0, 1), (-1, 0), (0, -1)):
        o = (tcx + n[0] * th, tcy + n[1] * th)
        for z in ((4.0,) if L == 1 else (5.0, 9.0) if L == 2 else (5.5, 10.0, 13.0)):
            if n == (0, -1) and z > 4.5 and z < 9.5:
                continue
            opening(p, o, n, .3, 1.0, z, 'dark')
    sundial(p, (tcx, tfront), (0, -1), {1: 6.2, 2: 8.6, 3: 9.4}[L], {1: .9, 2: 1.15, 3: 1.25}[L], 'plaster' if L < 3 else 'stoneLight')
    if L == 3:
        clock_face(p, (tcx, tfront), (0, -1), tz - 2.1, 1.0)
    m.done('tower', p)

    p = m.part('belfry')
    if L == 1:   # open timber bell frame under a shingled pyramid
        for sx in (-1, 1):
            for sy in (-1, 1):
                p.box((tcx + sx * (th - .2), tcy + sy * (th - .2), tz + 1.3), (.3, .3, 2.6), 'wood')
        p.box((tcx, tcy, tz + .1), (2 * th + .2, 2 * th + .2, .2), 'woodDark')
        for n in ((1, 0), (0, 1), (-1, 0), (0, -1)):
            p.box((tcx + n[0] * (th - .2), tcy + n[1] * (th - .2), tz + .9), (2 * th if n[0] == 0 else .12, .12 if n[0] == 0 else 2 * th, .12), 'woodDark')
        bell(p, tcx, tcy, tz + .9, .5)
        pyramid(p, tcx, tcy, 2 * th + .8, 2 * th + .8, tz + 2.6, tz + 5.4, roof)
        p.box((tcx, tcy, tz + 5.6), (.12, .12, .5), 'iron')
    else:
        cell = 3.2 if L == 2 else 3.6
        for sx in (-1, 1):
            for sy in (-1, 1):
                p.box((tcx + sx * (th - .35), tcy + sy * (th - .35), tz + cell / 2), (.7, .7, cell), wall)
        for n in ((1, 0), (0, 1), (-1, 0), (0, -1)):
            o = (tcx + n[0] * th, tcy + n[1] * th)
            w, r = 2 * th - 1.4, th - .7
            pts = [(-th, tz + cell), (-th, tz + cell - r - .3), (-w / 2, tz + cell - r - .3)]
            pts += [(-math.cos(math.pi * k / 6) * r, tz + cell - r - .3 + math.sin(math.pi * k / 6) * r * .9) for k in range(1, 6)]
            pts += [(w / 2, tz + cell - r - .3), (th, tz + cell - r - .3), (th, tz + cell)]
            plate(p, o, n, pts, wall, -.5, 0)
            p.box((o[0] - n[0] * .1, o[1] - n[1] * .1, tz + .5), (2 * th if n[0] == 0 else .3, .3 if n[0] == 0 else 2 * th, 1.0), wall)
        bell(p, tcx, tcy, tz + 1.0, .62 if L == 2 else .7)
        p.box((tcx, tcy, tz + cell + .15), (2 * th + .5, 2 * th + .5, .3), trim)
        if L == 2:
            pyramid(p, tcx, tcy, 2 * th + .6, 2 * th + .6, tz + cell + .3, tz + cell + 4.2, roof)
            p.box((tcx, tcy, tz + cell + 4.5), (.12, .12, .7), 'iron')
        else:
            z = tz + cell + .3
            c = th + .2
            for a, b in (((tcx - c, tcy - c), (tcx + c, tcy - c)), ((tcx + c, tcy - c), (tcx + c, tcy + c)),
                         ((tcx + c, tcy + c), (tcx - c, tcy + c)), ((tcx - c, tcy + c), (tcx - c, tcy - c))):
                merlons(p, a, b, z, wall, step=1.1, swallow=True)
            p.box((tcx, tcy, z + 1.0), (1.8, 1.8, 2.0), wall)
            pyramid(p, tcx, tcy, 0, 0, z + 2.0, z + 5.6, ('roofLead', 'roofSlateDark'), n=8, r=1.25)
            p.box((tcx, tcy, z + 5.8), (.1, .1, .5), 'gold')
            p.box((tcx + .45, tcy, z + 5.85), (.8, .04, .5), 'canvasRed')     # pennant
    m.done('belfry', p)


# civicLocalParts: hall 3 x 2.5 U, the gable front at -y.
def guild(m, L):
    """L1 timber guild house, L2 jettied hall over a stone ground floor with a goods hoist,
    L3 stone guildhall with stepped gables and a corner oriel."""
    w, d = 3.0 * S - .3, 2.5 * S - .3
    hx, hy = w / 2, d / 2
    roof = {1: ('roofShingle', 'roofShingleDark'), 2: ('roofTile', 'roofTileDark'), 3: ('roofSlate', 'roofSlateDark')}[L]
    p = m.part('hall')
    if L == 1:
        # Jettied timber hall with a porch over the door and an open goods shed on its flank.
        x0_, x1_ = -hx, 1.7
        mc, mw, gf, eave, jet = (x0_ + x1_) / 2, x1_ - x0_, 2.9, 5.7, .35
        R = eave + (mw / 2 + jet) * 1.1
        p.box((mc, 0, .3), (mw + .1, d + .1, .6), 'stoneRough')
        p.box((mc, 0, gf / 2), (mw, d, gf), 'plaster')
        p.box((mc, 0, (gf + eave) / 2), (mw + 2 * jet, d + 2 * jet, eave - gf), 'plasterWarm')
        for o, n, a, b in ((0, (0, -1), (x0_, -hy), (x1_, -hy)), (0, (-1, 0), (x0_, hy), (x0_, -hy)), (0, (0, 1), (x1_, hy), (x0_, hy))):
            timber_wall(p, a, b, .6, gf, n, step=1.6, braces=False, rail=False)
        for n, a, b in (((0, -1), (x0_ - jet, -hy - jet), (x1_ + jet, -hy - jet)), ((1, 0), (x1_ + jet, -hy - jet), (x1_ + jet, hy + jet)),
                        ((-1, 0), (x0_ - jet, hy + jet), (x0_ - jet, -hy - jet)), ((0, 1), (x1_ + jet, hy + jet), (x0_ - jet, hy + jet))):
            timber_wall(p, a, b, gf, eave, n, step=1.4)
        for x in [x0_ + .3 + i * .9 for i in range(int((mw - .6) / .9) + 1)]:     # jetty joists
            p.box((x, -hy - .12, gf - .08), (.15, .45, .15), 'beam')
        gable_roof(p, mc, 0, d + 2 * jet, mw + 2 * jet, eave, R, 'y', roof, gable_key='plasterWarm')
        gy = -hy - jet - .45 - .05                                   # carved gable: king post and braces
        p.beam((mc, gy, eave + .1), (mc, gy, R - .5), .16, .16, 'beam')
        for sx in (-1, 1):
            p.beam((mc + sx * (mw / 2 - .2), gy, eave + .15), (mc, gy, R - 1.3), .14, .14, 'beam')
        p.beam((mc - mw / 2 - jet, gy, eave + .05), (mc + mw / 2 + jet, gy, eave + .05), .2, .2, 'beam')
        opening(p, (mc, -hy), (0, -1), 1.5, 2.3, 0, 'woodDark', frame='beam', arch='round')
        for sx in (-1, 1):                                            # porch on two posts
            p.box((mc + sx * 1.3, -hy - 1.15, 1.25), (.18, .18, 2.5), 'woodDark')
        slab(p, [(mc - 1.65, -hy - 1.45, 2.45), (mc + 1.65, -hy - 1.45, 2.45), (mc + 1.65, -hy, 2.85), (mc - 1.65, -hy, 2.85)], .1, roof[0])
        bench(p, mc - 2.6, -hy - .45, 1.6)
        for x in (mc - 2.5, mc + 2.5):
            opening(p, (x, -hy), (0, -1), .8, .9, 1.2, 'dark', frame='woodDark')
            shutters(p, (x, -hy), (0, -1), .8, .9, 1.2)
        for x in (mc - 2.0, mc + 2.0):
            opening(p, (x, -hy - jet), (0, -1), .9, 1.1, gf + .8, 'glass', frame='woodDark')
            shutters(p, (x, -hy - jet), (0, -1), .9, 1.1, gf + .8)
            p.box((x, -hy - jet - .18, gf + .7), (1.1, .3, .2), 'woodDark')
            p.box((x, -hy - jet - .18, gf + .85), (1.0, .24, .14), 'flowerRed' if x < mc else 'flowerYellow')
        opening(p, (mc, -hy - jet), (0, -1), .7, .9, eave + 1.0, 'dark', frame='woodDark')
        p.box((x0_ - jet - .55, -hy + .8, gf + .3), (1.1, .07, .07), 'iron')     # emblem on a bracket
        plate(p, (x0_ - jet - .9, -hy + .76), (0, -1), circ(0, gf - .25, .4, 8), 'woodLight', -.03, .03)
        plate(p, (x0_ - jet - .9, -hy + .72), (0, -1), circ(0, gf - .25, .22, 6), 'gold', -.03, .04)
        # Goods shed: boarded back and side, lean-to roof against the hall.
        sx0, sx1 = x1_, hx
        p.box(((sx0 + sx1) / 2, hy - .1, 1.2), (sx1 - sx0, .2, 2.4), 'wood')
        p.box((sx1 - .1, 0, 1.2), (.2, d, 2.4), 'wood')
        p.box((sx1 - .1, -hy + .1, 1.3), (.2, .2, 2.6), 'woodDark')
        slab(p, [(sx0, -hy - .3, 3.6), (sx1 + .3, -hy - .3, 2.55), (sx1 + .3, hy + .3, 2.55), (sx0, hy + .3, 3.6)], .12, roof[1])
        barrel(p, sx0 + .9, -1.2, r=.34, h=.9)
        barrel(p, sx0 + .9, -.3, r=.34, h=.9)
        crate(p, sx0 + 1.0, 1.4, 0, .7, .1)
        crate(p, sx0 + 1.0, 1.4, .7, .55, .5)
        sack(p, sx0 + 1.4, 2.6)
        sign_z = None
    elif L == 2:
        # Merchant guild: stone ground floor with three arches, two jettied floors, dormers,
        # banners and a goods hoist in the gable.
        gf, f2, eave = 3.4, 6.0, 8.6
        j1, j2 = .3, .6
        R = eave + (hx + j2) * 1.0
        p.box((0, 0, gf / 2), (w, d, gf), 'stone')
        p.box((0, 0, .25), (w + .15, d + .15, .5), 'stoneTrim')
        p.box((0, 0, gf + .05), (w + .2, d + .2, .2), 'stoneTrim')
        for jj, z0, z1 in ((j1, gf, f2), (j2, f2, eave)):
            p.box((0, 0, (z0 + z1) / 2), (w + 2 * jj, d + 2 * jj, z1 - z0), 'plaster')
            X, Y = hx + jj, hy + jj
            for n, a, b in (((0, -1), (-X, -Y), (X, -Y)), ((1, 0), (X, -Y), (X, Y)), ((-1, 0), (-X, Y), (-X, -Y)), ((0, 1), (X, Y), (-X, Y))):
                timber_wall(p, a, b, z0, z1, n, step=1.3)
            for x in [-X + .3 + i * .9 for i in range(int((2 * X - .6) / .9) + 1)]:
                p.box((x, -Y + jj / 2 - .05, z0 - .08), (.15, jj + .3, .15), 'beam')
        gable_roof(p, 0, 0, d + 2 * j2, w + 2 * j2, eave, R, 'y', roof, gable_key='plaster')
        opening(p, (0, -hy), (0, -1), 2.2, 3.0, 0, 'woodDark', frame='stoneTrim', arch='round')
        p.box((0, -hy - .4, .12), (3.0, .8, .24), 'stoneTrim')
        for sx in (-1, 1):
            opening(p, (sx * 3.3, -hy), (0, -1), 1.6, 2.4, 0, 'dark', frame='stoneTrim', arch='round')
            p.box((sx * 3.3, -hy - .35, .45), (1.6, .5, .9), 'wood')          # shop counters in the side arches
            blob(p, sx * 3.3 - .35, -hy - .35, .25, .9, .18, 'cloth' if sx < 0 else 'produceOrange', n=6)
            blob(p, sx * 3.3 + .35, -hy - .35, .25, .9, .18, 'canvasBlue' if sx < 0 else 'produceRed', n=6)
        for x in (-3.0, 0, 3.0):
            opening(p, (x, -hy - j1), (0, -1), .9, 1.2, gf + .7, 'glass', frame='woodDark')
            shutters(p, (x, -hy - j1), (0, -1), .9, 1.2, gf + .7)
            p.box((x, -hy - j1 - .18, gf + .6), (1.1, .3, .2), 'woodDark')
            p.box((x, -hy - j1 - .18, gf + .75), (1.0, .24, .14), ('flowerRed', 'flowerYellow', 'flowerPurple')[int(x / 3) + 1])
        for x in (-2.0, 2.0):
            opening(p, (x, -hy - j2), (0, -1), .9, 1.2, f2 + .7, 'glass', frame='woodDark')
        for sx, key in ((-1, 'canvasRed'), (1, 'canvasBlue')):             # guild banners
            bx = sx * (hx + j2 - .5)
            p.box((bx, -hy - j2 - .4, eave - .25), (.06, .8, .06), 'iron')
            plate(p, (bx, -hy - j2 - .75), (0, -1), [(-.35, eave - .3), (.35, eave - .3), (.35, f2 - .4), (0, f2 - .1), (-.35, f2 - .4)][::-1], key, -.02, .02)
            plate(p, (bx, -hy - j2 - .78), (0, -1), circ(0, eave - 1.2, .18, 6), 'gold', -.02, .03)
        opening(p, (0, -hy - j2), (0, -1), 1.3, 1.6, eave + .6, 'dark', frame='woodDark')
        p.beam((0, -hy + .4, R - .9), (0, -hy - j2 - 1.2, R - .9), .22, .22, 'beam')    # goods hoist
        p.beam((0, -hy - j2 - 1.05, R - 1.0), (0, -hy - j2 - 1.05, f2 + .5), .03, .03, 'sack')
        crate(p, 0, -hy - j2 - 1.05, f2, .5)
        plate(p, (0, -hy - j2), (0, -1), circ(0, R - 2.3, .45, 8), 'gold', 0, .08)
        for sx in (-1, 1):                                                  # roof dormers
            for y in (-1.6, 1.8):
                dx = sx * (hx + j2 - 1.3)
                dz = eave + (hx + j2 - abs(dx)) * 1.0
                p.box((dx + sx * .2, y, dz - .2), (1.4, 1.4, 1.6), 'plaster')
                opening(p, (dx + sx * .9, y), (sx, 0), .7, .8, dz - .7, 'glass', frame='woodDark')
                gable_roof(p, dx + sx * .3, y, 1.6, 1.6, dz + .6, dz + 1.3, 'x', roof, over=.12, end_over=.12, th=.12, gable_key='plaster')
        chimney = (hx - 1.2, 2.2, R)
        for sx in (-1, 1):
            for y in (-1.8, 1.8):
                opening(p, (sx * (hx + j1), y), (sx, 0), .9, 1.2, gf + .8, 'glass', frame='woodDark')
        sign_z = gf - .5
    else:
        eave = 9.4
        R = eave + hx * 1.15
        p.box((0, 0, eave / 2), (w, d, eave), 'stoneLight')
        p.box((0, 0, .3), (w + .2, d + .2, .6), 'stoneTrim')
        for z in (3.6, eave - .1):
            p.box((0, 0, z), (w + .16, d + .16, .24), 'stoneTrim')
        gable_roof(p, 0, 0, d - .8, w, eave, R - .25, 'y', roof, over=.3, ends=(False, False))
        # Stepped gables front and back.
        steps = 6
        for sy in (-1, 1):
            y = sy * (hy - .35)
            for i in range(steps):
                z0 = eave + i * (R - eave) / steps
                hw = hx * (1 - i / steps)
                p.box((0, y, z0 + (R - eave) / steps / 2), (2 * hw, .7, (R - eave) / steps), 'stoneLight')
                p.box((0, y, z0 + (R - eave) / steps), (2 * hw + .2, .8, .14), 'stoneTrim')
            p.box((0, y, R + .4), (.4, .4, .8), 'stoneTrim')
        opening(p, (0, -hy), (0, -1), 2.0, 3.2, 0, 'woodDark', frame='stoneTrim', arch='pointed')
        p.box((0, -hy - .45, .12), (3.2, .9, .24), 'stoneTrim')
        for x in (-3.4, 3.4):
            opening(p, (x, -hy), (0, -1), 1.1, 2.0, 1.0, 'glass', frame='stoneTrim', arch='pointed')
            opening(p, (x, -hy), (0, -1), 1.1, 2.8, 4.6, 'glass', frame='stoneTrim', arch='pointed')
        opening(p, (0, -hy), (0, -1), 1.3, 2.6, 4.6, 'glass', frame='stoneTrim', arch='pointed')
        opening(p, (0, -hy), (0, -1), 1.0, 1.6, eave + 1.0, 'dark', frame='stoneTrim', arch='round')
        for sx in (-1, 1):
            for y in (-1.6, 1.6):
                opening(p, (sx * hx, y), (sx, 0), 1.0, 2.6, 4.6, 'glass', frame='stoneTrim', arch='pointed')
        plate(p, (0, -hy), (0, -1), circ(0, 8.1, .6, 10), 'gold', 0, .08)
        # Corner oriel on the front right.
        ox, oy = hx - .2, -hy - .2
        prism(p, circ(ox, oy, 1.0, 6), 3.4, 8.8, 'stoneLight')
        p.cylinder(.9, 0, 'stoneTrim', n=6, axis='z', center=(ox, oy, 0), radii=[.2, .95], along=[2.4, 3.4])
        for a in (math.pi * 1.25, math.pi * 1.75):
            n = (math.cos(a), math.sin(a))
            opening(p, (ox + n[0] * .87, oy + n[1] * .87), n, .5, 1.4, 5.6, 'glass')
        pyramid(p, ox, oy, 0, 0, 8.8, 11.6, ('roofSlate', 'roofSlateDark'), n=6, r=1.2)
        p.box((ox, oy, 11.8), (.1, .1, .5), 'gold')
        sign_z = None
    if sign_z is not None:   # hanging guild sign
        p.box((hx - 1.2, -hy - .45, sign_z + .55), (.06, .9, .06), 'iron')
        plate(p, (hx - 1.2, -hy - .7), (1, 0), circ(0, sign_z, .32, 8), 'gold' if L == 2 else 'woodLight', -.03, .03)
    m.done('hall', p)
    if L == 2:   # own part, like the tavern's: the cutaway leaves it out
        x, y, top = chimney
        p = m.part('chimneys')
        p.box((x, y, (top + .8) / 2), (.8, .8, top + .8), 'brick')
        p.box((x, y, top + .85), (1.0, 1.0, .18), 'stoneTrim')
        m.done('chimneys', p)

    p = m.part('props')
    if L == 1:
        barrel(p, -4.6, -hy - .6, r=.32, h=.85)
        crate(p, 4.5, -hy - .7, 0, .6, .2)
    elif L == 2:
        for x, y in ((-4.7, -hy - .8), (-4.0, -hy - .9)):
            sack(p, x, y)
        crate(p, 4.6, -hy - .9, 0, .65, .1)
        crate(p, 4.7, -hy - .85, .65, .5, .5)
    else:
        bench(p, -3.4, -hy - .7, 2.0)
        lamp_post(p, -hx + .4, -hy - 1.0, 3.0)
    m.done('props', p)


# ------------------------------------------------------------------ annexes (CIVIC_ANNEX_CATALOG footprints)
def house_block(p, w, d, z1, wall, roof, ridge_rise, axis='x', plinth=None, over=.4, th=.2, gable_key=None, cx=0, cy=0):
    if plinth:
        p.box((cx, cy, .3), (w + .1, d + .1, .6), plinth)
    p.box((cx, cy, z1 / 2), (w, d, z1), wall)
    span = d if axis == 'x' else w
    gable_roof(p, cx, cy, w if axis == 'x' else d, span, z1, z1 + ridge_rise, axis, roof, over=over, th=th,
               gable_key=gable_key or wall)


def a_herbGarden(m):
    h = 3.5
    p = m.part('ground')
    p.box((0, 0, .03), (2 * h - .1, 2 * h - .1, .06), 'dirt')
    p.box((0, 0, .07), (.9, 2 * h - .4, .02), 'gravel')
    m.done('ground', p)
    p = m.part('beds')
    herbs = ['herb', 'leaf', 'flowerPurple', 'herb', 'flowerYellow', 'leafDark']
    i = 0
    for sx in (-1, 1):
        for y in (-2.1, 0, 2.1):
            cx = sx * 1.75
            p.box((cx, y, .17), (2.0, 1.5, .34), 'woodLight')
            p.box((cx, y, .35), (1.8, 1.3, .04), 'soil')
            for j in range(3):
                bush(p, cx - .6 + j * .6, y + (.25 if j % 2 else -.25), .3, .45, herbs[(i + j) % len(herbs)])
            i += 1
    m.done('beds', p)
    p = m.part('fence')
    pts = [(-h + .1, -h + .1), (h - .1, -h + .1), (h - .1, h - .1), (-h + .1, h - .1)]
    for a, b in zip(pts, pts[1:] + pts[:1]):
        L_ = math.hypot(b[0] - a[0], b[1] - a[1])
        n_ = int(L_ / 1.15)
        for k in range(n_ + 1):
            t = k / n_
            x, y = a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t
            if abs(x) < .6 and y < 0:
                continue
            p.box((x, y, .5), (.1, .1, 1.0), 'woodDark')
        for z in (.45, .85):
            if a[1] == b[1] and a[1] < 0:   # front: leave the gate open
                for s in (-1, 1):
                    p.beam((s * .6, a[1], z), (s * (h - .1), a[1], z), .06, .1, 'wood')
            else:
                p.beam((a[0], a[1], z), (b[0], b[1], z), .06, .1, 'wood')
    for x in (2.6, 3.0):   # straw bee skeps
        p.cylinder(.3, 0, 'roofThatch', n=7, axis='z', center=(x, 2.9, 0), radii=[.32, .3, .18, .02], along=[0, .3, .55, .7])
    m.done('fence', p)


def a_scriptorium(m):
    w, d = 8.0, 6.2
    p = m.part('body')
    house_block(p, w, d, 4.6, 'stone', ('roofSlate', 'roofSlateDark'), 3.0, plinth='stoneTrim')
    for x in (-2.6, 0, 2.6):
        for sy in (-1, 1):
            opening(p, (x, sy * d / 2), (0, sy), 1.0, 2.0, 1.6, 'glass', frame='stoneTrim', arch='round')
    for sx in (-1, 1):
        opening(p, (sx * w / 2, 0), (sx, 0), .9, 1.5, 1.8, 'glass', frame='stoneTrim', arch='round')
    opening(p, (-3.0, -d / 2), (0, -1), 1.2, 2.3, 0, 'woodDark', frame='stoneTrim', arch='round')
    p.box((2.6, 1.6, 5.0), (.8, .8, 4.6), 'stoneRough')
    cross(p, w / 2 - .1, 0, 7.5, 1.0, 'iron', axis='y')
    m.done('body', p)


def a_monastery(m):
    w, d = 10.0, 7.4
    p = m.part('body')
    house_block(p, w, d, 7.0, 'stoneLight', ('roofTile', 'roofTileDark'), 3.4, plinth='stoneTrim')
    for sy in (-1, 1):
        p.beam((-w / 2, sy * (d / 2 + .05), 3.5), (w / 2, sy * (d / 2 + .05), 3.5), .12, .2, 'stoneTrim')
        for x in (-3.8, -1.9, 0, 1.9, 3.8):
            if not (sy < 0 and abs(x) < .1):
                opening(p, (x, sy * d / 2), (0, sy), .7, 1.3, 1.4, 'dark', frame='stoneTrim', arch='round')
            opening(p, (x, sy * d / 2), (0, sy), .7, 1.3, 4.6, 'glass', frame='stoneTrim', arch='round')
    opening(p, (0, -d / 2), (0, -1), 1.4, 2.6, 0, 'woodDark', frame='stoneTrim', arch='round')
    for sx in (-1, 1):
        opening(p, (sx * w / 2, 0), (sx, 0), .8, 1.6, 4.4, 'glass', frame='stoneTrim', arch='round')
        p.box((sx * 3.2, 1.2, 7.9), (.8, .8, 5.4), 'stone')
    m.done('body', p)


def a_cloister(m):
    h, g, zo, zi = 4.3, 2.5, 3.5, 2.55
    p = m.part('ground')
    p.box((0, 0, .03), (2 * h, 2 * h, .06), 'paving')
    p.box((0, 0, .08), (2 * g - .3, 2 * g - .3, .06), 'lawn')
    p.box((0, 0, .12), (.8, 2 * g - .3, .02), 'gravel')
    p.box((0, 0, .12), (2 * g - .3, .8, .02), 'gravel')
    m.done('ground', p)
    p = m.part('walls')
    for sx in (-1, 1):
        p.box((sx * (h - .2), 0, zo / 2), (.4, 2 * h, zo), 'stone')
        p.box((sx * (h + 1.0) / 2, -h + .2, zo / 2), (h - 1.0, .4, zo), 'stone')
    p.box((0, h - .2, zo / 2), (2 * h, .4, zo), 'stone')
    p.box((0, -h + .2, zo - .4), (2.0, .4, .8), 'stone')
    m.done('walls', p)
    p = m.part('arcade')
    for i in range(7):
        t = -g + i * (2 * g) / 6
        for x, y in ((t, -g), (t, g), (-g, t), (g, t)):
            p.cylinder(.16, 0, 'stoneLight', n=6, axis='z', center=(x, y, 0), radii=[.2, .15, .2], along=[0, zi - .3, zi - .1])
    for sx in (-1, 1):
        p.box((sx * g, 0, zi), (.4, 2 * g + .4, .25), 'stoneTrim')
        p.box((0, sx * g, zi), (2 * g + .4, .4, .25), 'stoneTrim')
    m.done('arcade', p)
    p = m.part('roof')
    O, I = h + .2, g - .3
    corners = [(-1, -1), (1, -1), (1, 1), (-1, 1)]
    for i in range(4):
        a, b = corners[i], corners[(i + 1) % 4]
        slab(p, [(a[0] * O, a[1] * O, zo + .1), (b[0] * O, b[1] * O, zo + .1), (b[0] * I, b[1] * I, zi + .05), (a[0] * I, a[1] * I, zi + .05)],
             .15, 'roofTile' if i % 2 else 'roofTileDark')
    m.done('roof', p)
    p = m.part('well')
    prism(p, circ(0, 0, .65, 8, math.pi / 8), .1, .85, 'stone')
    prism(p, circ(0, 0, .45, 8, math.pi / 8), .8, .87, 'water')
    for s in (-1, 1):
        p.box((s * .55, 0, 1.3), (.12, .12, 1.0), 'woodDark')
    p.box((0, 0, 1.8), (1.3, .12, .12), 'woodDark')
    m.done('well', p)


def a_storage(m):
    w = 4.6
    p = m.part('body')
    p.box((0, 0, .3), (w + .1, w + .1, .6), 'stoneRough')
    p.box((0, 0, 1.9), (w, w, 2.6), 'wood')
    for sx in (-1, 1):
        for x in (-1.6, -.5, .6, 1.7):
            plate(p, (x * sx, sx * w / 2), (0, sx), rect_pts(.1, 2.6, .6), 'woodDark', 0, .04)
    gable_roof(p, 0, 0, w, w, 3.2, 5.2, 'x', ('roofShingle', 'roofShingleDark'), gable_key='wood')
    opening(p, (0, -w / 2), (0, -1), 1.4, 2.0, .6, 'woodDark', frame='beam')
    barrel(p, 1.6, -2.55, r=.32, h=.85)
    sack(p, -1.7, -2.5)
    m.done('body', p)


def a_courtyard(m):
    h = 3.5
    p = m.part('ground')
    p.box((0, 0, .03), (2 * h - .1, 2 * h - .1, .06), 'dirt')
    for _ in range(5):
        blob(p, rng.uniform(-2.5, 2.5), rng.uniform(-2.5, 2.5), rng.uniform(.4, .8), .06, .02, 'gravel', n=6, top_scale=.95)
    m.done('ground', p)
    p = m.part('wall')
    for sx in (-1, 1):
        p.box((sx * (h - .2), 0, .45), (.35, 2 * h, .9), 'stoneRough')
    p.box((0, h - .2, .45), (2 * h, .35, .9), 'stoneRough')
    m.done('wall', p)
    p = m.part('props')
    p.box((-2.2, 1.8, .35), (1.8, .7, .7), 'woodDark')       # trough
    p.box((-2.2, 1.8, .66), (1.6, .5, .04), 'water')
    for row in range(3):                                      # woodpile under a lean-to
        for i in range(4 - row):
            p.cylinder(.16, 0, 'wood', n=6, axis='y', center=(1.4 + i * .36 + row * .18, 2.6, .17 + row * .3), radii=[.16, .16], along=[-.6, .6], cap_key='woodLight')
    slab(p, [(.9, 3.3, 2.0), (3.2, 3.3, 2.0), (3.2, 1.8, 1.5), (.9, 1.8, 1.5)], .1, 'roofShingle')
    for x in (1.0, 3.1):
        p.box((x, 1.9, .75), (.12, .12, 1.5), 'woodDark')
    p.box((1.8, -1.2, .45), (1.4, .9, .1), 'wood')            # handcart
    for s in (-1, 1):
        p.cylinder(.4, .05, 'woodDark', n=8, axis='y', center=(1.8, -1.2 + s * .52, .4))
    p.beam((2.5, -1.2, .45), (3.4, -1.2, .2), .08, .08, 'woodDark')
    p.box((-1.6, -1.6, .35), (1.2, .8, .7), 'hay')
    m.done('props', p)


def a_stables(m):
    w, d, z1 = 8.2, 5.8, 3.0
    p = m.part('body')
    p.box((0, d / 2 - .1, z1 / 2), (w, .2, z1), 'wood')
    for sx in (-1, 1):
        p.box((sx * (w / 2 - .1), 0, z1 / 2), (.2, d, z1), 'wood')
    for x in (-2.0, 0, 2.0):
        p.box((x, .4, .75), (.12, d - 1.4, 1.5), 'woodLight')        # stall partitions
    for x in (-4.0, -2.0, 0, 2.0, 4.0):
        p.box((x, -d / 2 + .1, z1 / 2), (.2, .2, z1), 'woodDark')
    p.box((0, -d / 2 + .1, z1 - .1), (w, .25, .25), 'woodDark')
    for x in (-3.0, -1.0, 1.0, 3.0):
        p.box((x, -d / 2 + .15, .55), (1.6, .1, 1.1), 'wood')        # half doors
        blob(p, x, d / 2 - .7, .55, 0, .5, 'hay', n=6)
    m.done('body', p)
    p = m.part('roof')
    gable_roof(p, 0, 0, w, d, z1, z1 + 2.4, 'x', ('roofShingle', 'roofShingleDark'), over=.55, gable_key='wood')
    m.done('roof', p)
    p = m.part('props')
    p.box((3.6, -3.2, .4), (1.0, .6, .8), 'hay')
    p.box((3.4, -3.2, 1.0), (.9, .55, .4), 'hay')
    m.done('props', p)


def a_brewery(m):
    p = m.part('body')
    cx, w, d = -1.4, 5.6, 6.2
    p.box((cx, 0, .5), (w + .1, d + .1, 1.0), 'stoneRough')
    p.box((cx, 0, 2.5), (w, d, 3.0), 'plaster')
    for n, a, b in (((0, -1), (cx - w / 2, -d / 2), (cx + w / 2, -d / 2)), ((1, 0), (cx + w / 2, -d / 2), (cx + w / 2, d / 2)),
                    ((-1, 0), (cx - w / 2, d / 2), (cx - w / 2, -d / 2)), ((0, 1), (cx + w / 2, d / 2), (cx - w / 2, d / 2))):
        timber_wall(p, a, b, 1.0, 4.0, n, rail=False)
    gable_roof(p, cx, 0, d, w, 4.0, 6.6, 'y', ('roofShingle', 'roofShingleDark'), gable_key='plaster')
    opening(p, (cx, -d / 2), (0, -1), 1.6, 2.2, 0, 'woodDark', frame='beam', arch='round')
    opening(p, (cx + w / 2, 1.2), (1, 0), .9, 1.0, 2.2, 'dark', frame='woodDark')
    p.box((cx - 1.4, 1.5, 4.5), (.9, .9, 9.0), 'brick')                  # malt kiln chimney
    p.box((cx - 1.4, 1.5, 9.05), (1.1, 1.1, .2), 'stoneTrim')
    m.done('body', p)
    p = m.part('yard')
    p.cylinder(1.05, 0, 'barrel', n=10, axis='z', center=(2.9, 1.6, 0), radii=[.95, 1.05, 1.0], along=[0, .8, 1.5], cap_key='woodLight')
    for z in (.4, 1.15):
        p.cylinder(1.07, .05, 'iron', n=10, axis='z', center=(2.9, 1.6, z))
    for i, (x, y, z) in enumerate(((2.3, -1.6, 0), (3.2, -1.6, 0), (2.75, -1.6, .7))):
        barrel(p, x, y, z, r=.36, h=.9, lying=True)
    for x, y in ((3.8, -.2), (3.4, .2)):
        sack(p, x, y)
    m.done('yard', p)


def a_inn(m):
    w, d, f1, z1 = 9.6, 7.0, 3.0, 6.0
    p = m.part('body')
    p.box((0, .3, f1 / 2), (w - .6, d - .6, f1), 'stoneRough')
    p.box((0, .3, (f1 + z1) / 2), (w, d, z1 - f1), 'plaster')
    y0, y1 = .3 - d / 2, .3 + d / 2
    for n, a, b in (((0, -1), (-w / 2, y0), (w / 2, y0)), ((1, 0), (w / 2, y0), (w / 2, y1)),
                    ((-1, 0), (-w / 2, y1), (-w / 2, y0)), ((0, 1), (w / 2, y1), (-w / 2, y1))):
        timber_wall(p, a, b, f1, z1, n)
    gable_roof(p, 0, .3, w, d, z1, z1 + 3.0, 'x', ('roofTile', 'roofTileDark'), gable_key='plaster')
    for x in (-3.3, -1.1, 1.1, 3.3):
        opening(p, (x, y0), (0, -1), .8, 1.1, f1 + 1.0, 'dark', frame='woodDark')
        shutters(p, (x, y0), (0, -1), .8, 1.1, f1 + 1.0)
        opening(p, (x, y1), (0, 1), .8, 1.1, f1 + 1.0, 'dark', frame='woodDark')
    for x in (-3.0, 3.0):
        opening(p, (x, y0 + .3), (0, -1), .9, 1.0, 1.1, 'dark', frame='woodDark')
    opening(p, (0, y0 + .3), (0, -1), 1.4, 2.4, 0, 'woodDark', frame='stoneTrim', arch='round')
    p.box((2.8, .8, (z1 + 4.6) / 2), (.85, .85, z1 + 4.6 - 0), 'stoneRough')
    m.done('body', p)
    p = m.part('gallery')   # timber balcony across the front
    p.box((0, y0 - .45, f1 + .05), (w - 1.0, .9, .12), 'wood')
    p.box((0, y0 - .85, f1 + .95), (w - 1.0, .08, .1), 'woodDark')
    for i in range(13):
        x = -(w - 1.0) / 2 + i * (w - 1.0) / 12
        p.box((x, y0 - .85, f1 + .5), (.07, .07, .9), 'woodDark')
    for x in (-(w - 1.2) / 2, (w - 1.2) / 2):
        p.beam((x, y0, f1 - 1.0), (x, y0 - .8, f1), .1, .12, 'beam')
    m.done('gallery', p)


def a_stall(m):
    p = m.part('stall')
    stall(p, Frame(0, .1, 0), 3.8, 2.3, ('canvasBlue', 'canvasWhite'), ('produceOrange', 'produceGreen', 'produceRed'))
    m.done('stall', p)


def a_loggia(m):
    w, d = 10.2, 4.9
    p = m.part('body')
    p.box((0, 0, .18), (w, d, .36), 'stone')
    for x in (-4.4, -2.2, 0, 2.2, 4.4):
        for sy in (-1, 1):
            p.cylinder(.26, 0, 'stoneLight', n=8, axis='z', center=(x, sy * 1.85, 0), radii=[.32, .26, .26, .36], along=[.36, .6, 3.1, 3.35])
    for sy in (-1, 1):
        p.box((0, sy * 1.85, 3.6), (w - .2, .55, .5), 'stoneTrim')
        for x in (-3.3, -1.1, 1.1, 3.3):     # arch spandrels
            plate(p, (x, sy * 2.12), (0, sy), [(-1.1, 3.35), (-.75, 3.0), (-.3, 2.82), (.3, 2.82), (.75, 3.0), (1.1, 3.35)], 'stoneTrim', -.1, .02)
    gable_roof(p, 0, 0, w, 4.2, 3.85, 5.5, 'x', ('roofTile', 'roofTileDark'), over=.45, gable_key='stoneLight')
    m.done('body', p)
    p = m.part('goods')
    for x in (-3.3, 1.1):
        p.box((x, 0, .8), (1.8, .8, .08), 'woodLight')
        for k in (-1, 1):
            p.box((x + k * .75, 0, .58), (.08, .6, .44), 'woodDark')
        blob(p, x - .4, 0, .3, .84, .2, 'cloth', n=6)
        blob(p, x + .4, 0, .3, .84, .2, 'produceOrange', n=6)
    barrel(p, 3.6, .6, .36)
    sack(p, -1.2, .9, .36)
    m.done('goods', p)


def a_warehouse(m):
    w, d, z1 = 8.0, 6.2, 6.4
    p = m.part('body')
    p.box((0, 0, .5), (w + .1, d + .1, 1.0), 'stoneRough')
    p.box((0, 0, (z1 + 1.0) / 2), (w, d, z1 - 1.0), 'wood')
    for n, a, b in (((0, -1), (-w / 2, -d / 2), (w / 2, -d / 2)), ((1, 0), (w / 2, -d / 2), (w / 2, d / 2)),
                    ((-1, 0), (-w / 2, d / 2), (-w / 2, -d / 2)), ((0, 1), (w / 2, d / 2), (-w / 2, d / 2))):
        timber_wall(p, a, b, 1.0, z1, n, step=2.0)
    gable_roof(p, 0, 0, w, d, z1, z1 + 3.0, 'x', ('roofShingle', 'roofShingleDark'), gable_key='wood')
    opening(p, (0, -d / 2), (0, -1), 2.6, 2.9, 0, 'woodDark', frame='beam')
    p.box((0, -d / 2 - .05, 1.45), (.06, .06, 2.8), 'beam')
    opening(p, (0, -d / 2), (0, -1), 1.3, 1.5, 4.0, 'dark', frame='beam')
    p.beam((0, -d / 2 + .5, z1 + .9), (0, -d / 2 - .7, z1 + .9), .2, .2, 'beam')    # hoist beam
    p.beam((0, -d / 2 - .55, z1 + .8), (0, -d / 2 - .55, 3.4), .03, .03, 'sack')
    crate(p, 0, -d / 2 - .55, 2.9, .5)
    for x, y, z, s in ((-3.0, -3.55, 0, .7), (-2.3, -3.6, 0, .6), (-2.7, -3.55, .7, .55), (3.0, -3.5, 0, .7)):
        crate(p, x, y, z, s, .1)
    m.done('body', p)


def a_shop(m):
    w, d, f1, z1 = 5.6, 4.8, 2.9, 5.6
    p = m.part('body')
    p.box((0, .15, f1 / 2), (w - .5, d - .4, f1), 'stone')
    p.box((0, 0, (f1 + z1) / 2), (w, d, z1 - f1), 'plaster')
    for n, a, b in (((0, -1), (-w / 2, -d / 2), (w / 2, -d / 2)), ((1, 0), (w / 2, -d / 2), (w / 2, d / 2)),
                    ((-1, 0), (-w / 2, d / 2), (-w / 2, -d / 2)), ((0, 1), (w / 2, d / 2), (-w / 2, d / 2))):
        timber_wall(p, a, b, f1, z1, n, step=1.4)
    gable_roof(p, 0, 0, d, w, z1, z1 + 2.8, 'y', ('roofTile', 'roofTileDark'), gable_key='plaster')
    fy = -d / 2 + .25
    opening(p, (-.7, fy), (0, -1), 2.2, 1.4, .9, 'dark', frame='woodDark')
    p.box((-.7, fy - .35, .95), (2.4, .7, .08), 'woodLight')            # fold-down counter
    for k, g in enumerate(('produceRed', 'cloth', 'produceOrange')):
        blob(p, -1.4 + k * .7, fy - .35, .22, 1.0, .18, g, n=6)
    opening(p, (1.75, fy), (0, -1), 1.0, 2.2, 0, 'woodDark', frame='woodDark')
    slab(p, [(-2.0, fy - .9, 2.45), (.6, fy - .9, 2.45), (.6, fy, 2.85), (-2.0, fy, 2.85)], .05, 'canvasYellow')
    opening(p, (0, -d / 2), (0, -1), 1.2, 1.2, f1 + .9, 'glass', frame='woodDark')
    shutters(p, (0, -d / 2), (0, -1), 1.2, 1.2, f1 + .9)
    p.box((2.45, -d / 2 - .22, f1 - .1), (.07, .44, .07), 'iron')
    plate(p, (2.45, -d / 2 - .4), (1, 0), rect_pts(.45, .45, f1 - .6), 'gold', -.03, .03)
    m.done('body', p)


# ------------------------------------------------------------------ lot props
# Small single-part props that settlement-civic3d.js scatters over the civic lot
# (graves and cypresses around the church, tables around the inn). Origin at the
# prop centre; graves lie along local y with the head at +y.
def p_graveStone(m):
    p = m.part('body')
    p.box((0, 0, .07), (.6, 1.25, .14), 'lawnDark')
    plate(p, (0, .55), (0, -1), arch_pts(.5, .8, .1), 'stoneLight', -.07, .07)
    m.done('body', p)


def p_graveWorn(m):
    p = m.part('body')
    p.box((0, 0, .06), (.6, 1.2, .12), 'lawnDark')
    plate(p, (0, .55), (0, -1), arch_pts(.44, .6, .08, pointed=True), 'stone', -.06, .06)
    m.done('body', p)


def p_graveCross(m):
    p = m.part('body')
    p.box((0, 0, .07), (.55, 1.2, .14), 'soil')
    cross(p, 0, .52, .1, 1.05, 'woodDark')
    m.done('body', p)


def p_graveSlab(m):
    p = m.part('body')
    p.box((0, 0, .09), (.7, 1.4, .18), 'stoneTrim')
    p.box((0, 0, .2), (.6, 1.3, .05), 'stone')
    p.box((0, .15, .235), (.08, .7, .02), 'stoneTrim')
    p.box((0, .3, .235), (.38, .08, .02), 'stoneTrim')
    m.done('body', p)


def p_graveTall(m):
    p = m.part('body')
    p.box((0, 0, .1), (.8, 1.4, .2), 'stoneTrim')
    p.box((0, .45, .45), (.5, .4, .5), 'stone')
    p.taper((0, .45, .7), (0, .45, 1.8), .34, .34, .2, .2, 'stoneLight')
    pyramid(p, 0, .45, .26, .26, 1.8, 2.05, ('stoneLight', 'stone'))
    m.done('body', p)


def p_cemeteryCross(m):
    p = m.part('body')
    prism(p, circ(0, 0, .9, 8, math.pi / 8), 0, .25, 'stone')
    p.box((0, 0, .45), (.8, .8, .4), 'stoneTrim')
    cross(p, 0, 0, .6, 2.6, 'stoneLight')
    m.done('body', p)


def p_cypress(m):
    p = m.part('body')
    cypress(p, 0, 0, 4.6, .5)
    m.done('body', p)


def p_cypressSmall(m):
    p = m.part('body')
    cypress(p, 0, 0, 3.2, .4, 'leaf')
    m.done('body', p)


def p_tableSet(m):
    p = m.part('body')
    table_set(p, 0, 0, 3)
    m.done('body', p)


def p_tableBarrel(m):
    p = m.part('body')
    barrel(p, 0, 0, r=.36, h=.95)
    p.cylinder(.4, 0, 'woodLight', n=8, axis='z', center=(0, 0, 0), radii=[.4, .4], along=[.95, 1.0])
    for a in (0.3, 2.4, 4.3):
        x, y = math.cos(a) * .75, math.sin(a) * .75
        p.cylinder(.18, 0, 'wood', n=6, axis='z', center=(x, y, 0), radii=[.14, .18, .18], along=[0, .4, .5])
    p.cylinder(.07, 0, 'iron', n=6, axis='z', center=(.1, .05, 0), radii=[.07, .07], along=[1.0, 1.15])
    m.done('body', p)


def p_tablePergola(m):
    p = m.part('body')
    table_set(p, 0, 0, 2)
    for px in (-1.3, 1.3):
        for py in (-1.1, 1.1):
            p.box((px, py, 1.25), (.13, .13, 2.5), 'woodDark')
    for py in (-1.1, 1.1):
        p.box((0, py, 2.55), (2.9, .13, .13), 'wood')
    for i in range(6):
        px = -1.25 + i * .5
        p.box((px, 0, 2.66), (.09, 2.6, .08), 'wood')
        p.box((px + .22, 0, 2.72), (.36, 2.4, .06), 'leaf' if i % 2 else 'leafDark')
    m.done('body', p)


def p_flowerBush(m):
    p = m.part('body')
    bush(p, 0, 0, .55, .7, 'herb')
    for a in range(5):
        x, y = math.cos(a * 1.3) * .32, math.sin(a * 1.3) * .32
        p.cylinder(.1, 0, ('flowerRed', 'flowerYellow', 'flowerWhite')[a % 3], n=5, axis='z', center=(x, y, 0), radii=[.1, .12, .03], along=[.5, .6, .72])
    m.done('body', p)


def p_treeOak(m):
    p = m.part('body')
    p.taper((0, 0, 0), (0, 0, 2.6), .42, .42, .3, .3, 'woodDark')
    for dx, dy, dz, r in ((0, 0, 3.6, 2.1), (.9, .4, 3.1, 1.3), (-.8, -.5, 3.3, 1.4), (.2, -.7, 4.6, 1.2)):
        p.cylinder(0, 0, 'leaf' if dz < 4 else 'leafDark', n=8, axis='z', center=(dx, dy, 0),
                   radii=[r * .45, r * .95, r, r * .7, .05], along=[dz - r * .7, dz - r * .3, dz, dz + r * .45, dz + r * .8])
    m.done('body', p)


def p_treeLinden(m):
    p = m.part('body')
    p.taper((0, 0, 0), (0, 0, 3.4), .36, .36, .24, .24, 'woodDark')
    p.cylinder(0, 0, 'leafDark', n=8, axis='z', center=(0, 0, 0), radii=[.6, 1.8, 1.9, 1.3, .05], along=[2.2, 3.4, 4.6, 6.0, 7.2])
    p.cylinder(0, 0, 'leaf', n=7, axis='z', center=(.3, .2, 0), radii=[.5, 1.3, 1.1, .05], along=[4.6, 5.6, 6.8, 7.8])
    m.done('body', p)


PROPS = [('treeOak', p_treeOak), ('treeLinden', p_treeLinden),('graveStone', p_graveStone), ('graveWorn', p_graveWorn), ('graveCross', p_graveCross), ('graveSlab', p_graveSlab),
         ('graveTall', p_graveTall), ('cemeteryCross', p_cemeteryCross), ('cypress', p_cypress), ('cypressSmall', p_cypressSmall),
         ('tableSet', p_tableSet), ('tableBarrel', p_tableBarrel), ('tablePergola', p_tablePergola), ('flowerBush', p_flowerBush)]


ANNEXES = [('herbGarden', a_herbGarden), ('scriptorium', a_scriptorium), ('monastery', a_monastery), ('cloister', a_cloister),
           ('storage', a_storage), ('courtyard', a_courtyard), ('stables', a_stables), ('brewery', a_brewery), ('inn', a_inn),
           ('stall', a_stall), ('loggia', a_loggia), ('warehouse', a_warehouse), ('shop', a_shop)]


def build_list():
    out = []
    for L in (1, 2, 3):
        out += [('church%d' % L, lambda m, L=L: church(m, L)), ('tavern%d' % L, lambda m, L=L: tavern(m, L)),
                ('market%d' % L, lambda m, L=L: market(m, L))]
        for v, fn in (('paved', plaza_paved), ('fountain', plaza_fountain), ('garden', plaza_garden)):
            out.append(('plaza_%s%d' % (v, L), lambda m, L=L, fn=fn: fn(m, L)))
    out += ANNEXES
    for L in (1, 2, 3):   # appended last: earlier models keep their export order
        out += [('townhall%d' % L, lambda m, L=L: townhall(m, L)), ('guild%d' % L, lambda m, L=L: guild(m, L))]
    out += [('prop_' + k, fn) for k, fn in PROPS]
    return out


def main(out_path):
    root = fresh_collection(COLL_NAME)
    data = {'palette': list(COLORS.values()), 'paletteKeys': KEYS, 'models': {}}
    total, stats = 0, {}
    for i, (name, fn) in enumerate(build_list()):
        m = Model(root, name, ((i % 6) * 30, (i // 6) * 30, 0))
        rng.seed(sum(map(ord, name)))
        fn(m)
        parts = {k: export_part_indexed(p, KEYS) for k, p in m.parts.items()}
        n = sum(len(p['c']) for p in parts.values())
        stats[name] = n
        total += n
        data['models'][name] = {'parts': parts}
    js = ("'use strict';\n// Generated by ASSETS/blender/build_civic.py — do not edit by hand.\n"
          "// Civic models in game-local space (U): x, y as houseLocalToWorld, front at -y, +z up.\n"
          "// Parts: p = vertex xyz, i = 3 indices per triangle, c = palette index per triangle.\n"
          "window.ConquerCivicModels=" + json.dumps(data, separators=(',', ':')) + ";\n")
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, 'w', encoding='utf-8', newline='\n') as f:
        f.write(js)
    print(f"civic models: {len(stats)} models, {total} triangles, {len(js) // 1024} KB -> {out_path}")
    return {'total': total, 'kb': len(js) // 1024, 'models': stats}


if __name__ == '__main__' and '--' in sys.argv:
    args = sys.argv[sys.argv.index('--') + 1:]
    main(args[args.index('--out') + 1])
elif 'CIVIC_OUT' in globals():
    CIVIC_RESULT = main(CIVIC_OUT)
