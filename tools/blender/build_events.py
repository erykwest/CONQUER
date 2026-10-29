"""CONQUER events builder (Blender 5.x): camp pavilions, wooden
stands, the U-shaped arena, stages and the lists' scatter props.

- tentOctagon / tentSquare: medieval camp pavilions, walls parted in vertical
  stripes of the realm livery, scalloped valance, central pole with pennon,
  guy ropes and stakes;
- standOpen / standCovered: wooden stand on a timber trestle (front walk with
  hangings, four tiers, side stair); the covered one adds a striped cloth
  canopy on posts with valances and pennons;
- arenaU: uncovered U-shaped stand (two straight legs and a half circle) round
  the field, open at the front (-y) where the lists enter;
- podiumStreet: small octagonal podium for a street artist or a pair;
- stageHerald / stagePlayers: the same 4.4 x 3 m stage dressed for public
  announcements (lectern, banners) or for travelling players (backcloth,
  wings, bunting); stageTheatre: stage with proscenium, curtains, backdrop and
  folding screens;
- circusTent (big top) and the troupe's wagons: wagonCaravan, wagonCage,
  wagonCargo (+x forward, as build_wagon.py), circusBooth (ticket booth);
- propBunting (bunting between two poles), propFence (1.4 U tournament fence
  segment, top rail in the realm livery);
- props (scatter): propTilt (a 12 m tilt barrier segment, to be tiled), lance,
  weapon, spear and shield racks, armour piles, crate and dressed mannequin.

Low-poly, flat-coloured models in real metres (1 U = 3.5 m). Axes as the civic
models: front at -Y, +Z up, origin on the ground at the footprint centre.
Palette keys 'heraldA', 'heraldB', 'heraldTrim' are replaced by the realm
livery in game (as build_knights.py); 'decals' are planar quads where the game
paints the realm's coat of arms. meta holds seats / door / field points in U.

Run inside Blender (BlenderMCP execute_code):
    CQ_DIR = r"...\\ASSETS\\blender"; EVENTS_OUT = r"...\\src\\assets\\event-models.js"
    exec(open(CQ_DIR + r"\\build_events.py", encoding="utf-8").read())
or headless:
    blender.exe -b --factory-startup --python build_events.py -- --out <path>
"""
import json, math, os, sys, importlib
from mathutils import Vector, Matrix
_here = os.path.dirname(os.path.abspath(__file__)) if '__file__' in globals() else CQ_DIR
if _here not in sys.path:
    sys.path.insert(0, _here)
import cq_blender, build_civic
importlib.reload(cq_blender)
importlib.reload(build_civic)
from cq_blender import METERS_PER_U, Part, fresh_collection, export_part_indexed, u
from build_civic import circ, prism, slab, plate, blob, pyramid

COLORS = {
    'heraldA': '#b53636', 'heraldB': '#355fb8', 'heraldTrim': '#d2ad4b',
    # Pavilion roles (walls, roof gores, valance tongues), A/B alternating: the game
    # fills them from the tent's livery scheme (settlement-events3d.js tentScheme).
    'wallA': '#b53636', 'wallB': '#355fb8', 'roofA': '#355fb8', 'roofB': '#b53636',
    'valA': '#b53636', 'valB': '#355fb8',
    'canvas': '#e8dcc0', 'canvasShade': '#c9bb98', 'dark': '#211d1a',
    'wood': '#9a6a3f', 'woodLight': '#ba8a55', 'woodDark': '#6a4529', 'beam': '#4d3423',
    'rope': '#b9a57a', 'steel': '#9aa3aa', 'steelDark': '#5d656c', 'gold': '#d8b14a',
    'mail': '#7d858b', 'leather': '#6b4a2e', 'leatherDark': '#45301f',
    'curtain': '#7c2a33', 'curtainDark': '#5e1f27', 'festYellow': '#d9b13b', 'festGreen': '#6f8a3c',
    'tentBrown': '#7b5a3e', 'tentKhaki': '#9a8460', 'tentStripe': '#c99a3e', 'tentShade': '#5c4430',
    'circusRed': '#b8322c', 'hay': '#d4b35b', 'barrel': '#8b5e35', 'iron': '#4f5357', 'sand': '#cdb98a',
}
KEYS = list(COLORS.keys())
COLL_NAME = 'CONQUER_Events'


class Model:
    def __init__(self, root, name, offset):
        self.root, self.name, self.offset = root, name, offset
        self.parts, self.meta, self.decals = {}, {}, {}
        # 'realm': heraldA / heraldB / heraldTrim follow the realm heraldry;
        # 'pair': heraldA / heraldB take a random pair of primary colours per instance
        # (knights' tents and gear), heraldTrim stays gold.
        self.livery = 'realm'

    def part(self, key):
        return Part(self.root, key, COLORS, self.offset, prefix=self.name + '_')

    def done(self, key, p):
        self.parts[key] = p.finish()


# ------------------------------------------------------------------ primitives
def mesh(p, verts, faces):
    """Faces [(indices, key)] on shared vertices, so a closed solid recalculates its
    normals as one piece."""
    vs = [p.bm.verts.new(Vector(v)) for v in verts]
    for f, key in faces:
        p.bm.faces.new([vs[i] for i in f]).material_index = p._mat(key)


def tincture(i):
    return 'heraldA' if i % 2 == 0 else 'heraldB'


def tongue(w, z, h=.3):
    """Scalloped valance tongue hanging from z (plate outline in (u, z))."""
    return [(-w / 2, z), (w / 2, z), (w / 2, z - h * .55), (0, z - h), (-w / 2, z - h * .55)]


class cloth:
    """Marks the faces built inside the block as wind-blown cloth: weight 0 at the
    anchor, 1 at length along axis; the cloth waves along disp (exported as part 'f')."""
    def __init__(self, p, anchor, axis, disp, length):
        self.p = p
        self.spec = (Vector(anchor), Vector(axis).normalized(), Vector(disp).normalized(), length)

    def __enter__(self):
        self.n0 = len(self.p.bm.faces)

    def __exit__(self, *exc):
        if not hasattr(self.p, 'wind'):
            self.p.wind = []
        self.p.wind.append((self.n0, len(self.p.bm.faces)) + self.spec)


def export_wind(part, digits=3):
    """Flutter of a finished part, indexed like export_part_indexed: i = vertex index,
    w = weight (0 anchor .. 1 free end), d = wave direction (3 per vertex)."""
    spans = getattr(part, 'wind', None)
    if not spans:
        return None
    me = part.object.data
    me.calc_loop_triangles()
    seen, out = {}, {}
    for tri in me.loop_triangles:
        span = next((s for s in spans if s[0] <= tri.polygon_index < s[1]), None)
        for vi in tri.vertices:
            co = me.vertices[vi].co
            k = (round(co.x / METERS_PER_U, digits), round(co.y / METERS_PER_U, digits), round(co.z / METERS_PER_U, digits))
            if k not in seen:
                seen[k] = len(seen)
            if span:
                a, ax, d, L = span[2:]
                w = max(0.0, min(1.0, (co - a).dot(ax) / L))
                j = seen[k]
                if w > out.get(j, (0.0,))[0]:
                    out[j] = (w, d)
    idx = sorted(out)
    return {'i': idx, 'w': [round(out[j][0], 3) for j in idx], 'd': [round(c, 3) for j in idx for c in out[j][1]]}


def pennon(p, x, y, z, length=1.4, axis=(1, 0), keys=('heraldA', 'heraldB')):
    """Swallow-tailed pennon from a staff at (x, y), top at z, flying along axis."""
    n = (axis[1], -axis[0])   # plate normal: its u axis is (-n.y, n.x) = axis
    a = [(.04, z), (length, z - .22), (length * .78, z - .34), (.04, z - .28)]
    b = [(.04, z - .28), (length * .78, z - .34), (length, z - .48), (.04, z - .56)]
    with cloth(p, (x, y, z), (axis[0], axis[1], 0), (n[0], n[1], 0), length):
        plate(p, (x, y), n, a, keys[0], -.01, .01)
        plate(p, (x, y), n, b, keys[1], -.01, .01)


def flagstaff(p, x, y, z0, h, length=1.2, axis=(1, 0)):
    p.box((x, y, z0 + h / 2), (.07, .07, h), 'woodDark')
    p.cylinder(.06, 0, 'gold', n=6, axis='z', center=(x, y, 0), radii=[.02, .08, .02], along=[z0 + h, z0 + h + .08, z0 + h + .18])
    pennon(p, x, y, z0 + h - .05, length, axis)


def skirt(p, x0, x1, y, ztop, zbot, nb, nt=4, fold=.2):
    """Cloth hangings along x on a front edge at y (facing -y): one cloth per bay in
    alternate tinctures, gold tongues below, the top folded over the rail."""
    pitch = (x1 - x0) / nb
    bw = pitch - .1
    for i in range(nb):
        c = x0 + pitch * (i + .5)
        p.box((c, y - .05, (ztop + zbot) / 2), (bw, .03, ztop - zbot), tincture(i))
        if fold:
            p.box((c, y + .04, ztop + .02), (bw, fold, .03), tincture(i))
        for t in range(nt):
            plate(p, (c - bw / 2 + bw / nt * (t + .5), y - .065), (0, -1), tongue(bw / nt, zbot + .02, .26), 'heraldTrim', 0, .02)


def gonfalon(p, x, y, ztop, w=.9, h=1.7):
    """Banner hanging from a crossbar, facing -y; returns its arms decal."""
    p.beam((x - w / 2 - .08, y, ztop), (x + w / 2 + .08, y, ztop), .05, .05, 'woodDark')
    with cloth(p, (x, y, ztop), (0, 0, -1), (0, -1, 0), h + .3):
        plate(p, (x, y - .04), (0, -1), [(-w / 2, ztop - .04), (w / 2, ztop - .04), (w / 2, ztop - h), (-w / 2, ztop - h)], 'heraldA', 0, .02)
        for t in range(3):
            plate(p, (x - w / 2 + w / 3 * (t + .5), y - .04), (0, -1), tongue(w / 3, ztop - h + .02, .3), 'heraldB', 0, .02)
    yd, a = y - .062, w * .36
    return {'o': u(x - a, yd, ztop - .2), 'u': u(x + a, yd, ztop - .2), 'v': u(x - a, yd, ztop - .2 - 2.3 * a), 'clip': None}


def prism3(p, pts, n, d, key):
    """Planar 3D polygon extruded by d along n (closed)."""
    k = len(pts)
    vs = list(pts) + [(x + n[0] * d, y + n[1] * d, z + n[2] * d) for x, y, z in pts]
    faces = [(tuple(range(k - 1, -1, -1)), key), (tuple(range(k, 2 * k)), key)]
    mesh(p, vs, faces + [((i, (i + 1) % k, k + (i + 1) % k, k + i), key) for i in range(k)])


# ------------------------------------------------------------------ arms and armour
KITE = [(-.33, .44), (.33, .44), (.35, .05), (.16, -.4), (0, -.68), (-.16, -.4), (-.35, .05)]
HEATER = [(-.3, .36), (.3, .36), (.3, .02), (.2, -.28), (0, -.44), (-.2, -.28), (-.3, .02)]


def shield(p, c, U, V, outline=KITE, s=1.0):
    """Shield centred at c: U to the viewer's right, V up the face; gold rim, face
    parted per pale in the livery."""
    c, U, V = Vector(c), Vector(U).normalized(), Vector(V).normalized()
    N = U.cross(V)
    P = lambda uu, vv, d: tuple(c + U * uu * s + V * vv * s + N * d)
    prism3(p, [P(uu * 1.05, vv * 1.04, -.035) for uu, vv in outline], N, .03, 'heraldTrim')
    t = next(i for i, (uu, _) in enumerate(outline) if uu == 0)
    top = outline[0][1]
    left = [(0, top), outline[0]] + outline[-1:t:-1] + [outline[t]]
    right = [(0, top)] + outline[1:t + 1]
    prism3(p, [P(uu, vv, -.006) for uu, vv in left], N, .008, 'heraldA')
    prism3(p, [P(uu, vv, -.006) for uu, vv in right], N, .008, 'heraldB')


def sword(p, a, d, side, L=1.0):
    """Arming sword from its point at a along d; the guard lies along side."""
    a, d, side = Vector(a), Vector(d).normalized(), Vector(side).normalized()
    q = lambda t: tuple(a + d * t * L)
    p.taper(q(0), q(.76), .012, .008, .05, .012, 'steel')
    g = a + d * .76 * L
    p.beam(tuple(g - side * .11), tuple(g + side * .11), .03, .03, 'steelDark')
    p.taper(q(.77), q(.92), .032, .032, .03, .03, 'leatherDark')
    p.box(q(.95), (.055, .055, .055), 'steelDark')


def axe(p, a, d, side, L=.95):
    a, d, side = Vector(a), Vector(d).normalized(), Vector(side).normalized()
    p.taper(tuple(a), tuple(a + d * L), .035, .035, .03, .03, 'wood')
    h = a + d * (L - .12)
    p.taper(tuple(h - side * .04), tuple(h + side * .17), .025, .07, .015, .22, 'steel')


def mace(p, a, d, L=.8):
    a, d = Vector(a), Vector(d).normalized()
    p.taper(tuple(a), tuple(a + d * L), .035, .035, .03, .03, 'wood')
    h = a + d * (L + .02)
    p.taper(tuple(h - d * .1), tuple(h + d * .1), .1, .1, .07, .07, 'steelDark')
    for k in range(4):
        r = Vector((math.cos(k * math.pi / 2), math.sin(k * math.pi / 2), 0)) * .06
        p.box(tuple(h + r), (.03 if k % 2 else .1, .1 if k % 2 else .03, .16), 'steelDark')


def polearm(p, a, d, L, halberd=False):
    a, d = Vector(a), Vector(d).normalized()
    p.taper(tuple(a), tuple(a + d * L), .045, .045, .04, .04, 'wood')
    tip = a + d * L
    p.taper(tuple(tip), tuple(tip + d * .3), .05, .02, .005, .005, 'steel')
    if halberd:
        side = Vector((1, 0, 0))
        h = a + d * (L - .12)
        p.taper(tuple(h), tuple(h + side * .22), .02, .1, .015, .26, 'steel')
        p.taper(tuple(h), tuple(h - side * .14), .02, .05, .01, .01, 'steel')


def great_helm(p, x, y, z):
    p.cylinder(.13, 0, 'steel', n=8, axis='z', center=(x, y, z), radii=[.135, .13, .12], along=[0, .2, .28], cap_key='steelDark')
    p.box((x, y - .125, z + .17), (.2, .03, .025), 'dark')
    p.box((x, y - .125, z + .09), (.02, .03, .1), 'dark')


def kettle_hat(p, x, y, z, flip=False):
    radii, along = [.2, .19, .12, .05], [0, .03, .11, .15]
    if flip:   # upside down, crown on the ground
        along = [.15 - t for t in along]
    p.cylinder(.2, 0, 'steelDark' if flip else 'steel', n=8, axis='z', center=(x, y, z), radii=radii, along=along)


def mail_heap(p, x, y, r, h, n=8):
    blob(p, x, y, r, 0, h, 'mail', n=n, jitter=.25, top_scale=.6)
    blob(p, x + r * .2, y - r * .1, r * .55, h * .9, h * .5, 'mail', n=6, jitter=.2, top_scale=.4)


# ------------------------------------------------------------------ pavilions
def pavilion(m, n, R, k, wall, apex, pole_top, over=.38, drop=.18, rope_step=1,
             keys=('heraldA', 'heraldB'), trim='heraldTrim', door=.5, roles=False):
    """Camp pavilion on an n-sided plan (circumradius R, a flat side to the front),
    each side parted into k vertical stripes of the two keys. With roles=True walls,
    roof gores and valance take their own A/B keys (wallA/B, roofA/B, valA/B)."""
    tincture = lambda i: keys[i % 2]
    wall_t, roof_t, val_t = ((lambda i: ('wallA', 'wallB')[i % 2]), (lambda i: ('roofA', 'roofB')[i % 2]),
                             (lambda i: ('valA', 'valB')[i % 2])) if roles else (tincture, lambda i: tincture(i + 1), tincture)
    a0 = math.pi / n
    corners = circ(0, 0, 1, n, a0)
    ring = []   # unit plan points along the perimeter, k per side
    for i in range(n):
        (x0, y0), (x1, y1) = corners[i], corners[(i + 1) % n]
        ring += [(x0 + (x1 - x0) * j / k, y0 + (y1 - y0) * j / k) for j in range(k)]
    N, E, ze = len(ring), R + over, wall - drop
    side_n = lambda s: (math.cos(a0 + math.pi * (2 * (s // k) + 1) / n), math.sin(a0 + math.pi * (2 * (s // k) + 1) / n))

    # Canvas: walls, eave soffit and roof gores as one closed solid.
    p = m.part('tent')
    verts = ([(x * R, y * R, 0) for x, y in ring] + [(x * R, y * R, wall) for x, y in ring]
             + [(x * E, y * E, ze) for x, y in ring] + [(0, 0, apex)])
    faces = [(tuple(range(N - 1, -1, -1)), 'canvasShade')]
    for s in range(N):
        t = (s + 1) % N
        faces += [((s, t, N + t, N + s), wall_t(s)),
                  ((N + s, N + t, 2 * N + t, 2 * N + s), 'canvasShade'),
                  ((2 * N + s, 2 * N + t, 3 * N), roof_t(s))]
    mesh(p, verts, faces)
    # Valance: a gold band and one tongue per stripe, countercoloured to the gore above.
    for s in range(N):
        a, b = ring[s], ring[(s + 1) % N]
        o = ((a[0] + b[0]) / 2 * E, (a[1] + b[1]) / 2 * E)
        w = math.hypot(b[0] - a[0], b[1] - a[1]) * E
        nn = side_n(s)
        plate(p, o, nn, tongue(w, ze + .02, .4), val_t(s), 0, .03)
        plate(p, o, nn, [(-w / 2, ze - .04), (w / 2, ze - .04), (w / 2, ze + .06), (-w / 2, ze + .06)], trim, .03, .045)
    # Door on the front side, flaps tied back.
    ap = R * math.cos(a0)
    plate(p, (0, -ap), (0, -1), [(-door, 0), (door, 0), (door * .4, wall - .15), (-door * .4, wall - .15)], 'dark', 0, .03)
    for sx in (-1, 1):
        plate(p, (0, -ap), (0, -1), [(sx * door, 0), (sx * door * 1.7, 0), (sx * door * .44, wall - .15)], 'canvas', .03, .06)
        p.box((sx * door * 1.24, -ap - .07, wall * .45), (.08, .04, .08), trim)
    m.done('tent', p)

    p = m.part('pole')
    p.cylinder(.06, 0, 'woodDark', n=6, axis='z', center=(0, 0, 0), radii=[.07, .05], along=[apex - .3, pole_top])
    p.cylinder(.06, 0, 'gold', n=6, axis='z', center=(0, 0, 0), radii=[.02, .12, .02], along=[pole_top, pole_top + .12, pole_top + .26])
    pennon(p, 0, 0, pole_top - .05, 1.7, keys=keys)
    m.done('pole', p)

    # Guy ropes from the eave to stakes.
    p = m.part('ropes')
    for s in range(0, N, rope_step):
        x, y = ring[s]
        L = math.hypot(x, y)
        dx, dy = x / L, y / L
        top = (x * E, y * E, ze)
        sx, sy = top[0] + dx * 1.7, top[1] + dy * 1.7
        p.beam(top, (sx, sy, .25), .03, .03, 'rope')
        p.beam((sx - dx * .04, sy - dy * .04, -.05), (sx + dx * .06, sy + dy * .06, .35), .06, .06, 'woodDark')
    m.done('ropes', p)
    m.meta = {'door': u(0, -ap - .8, 0), 'radius': u(E + 1.8)[0]}


def tent_octagon(m):
    pavilion(m, 8, 2.7, 2, 2.0, 4.9, 6.0, rope_step=2, roles=True)
    m.livery = 'pair'


def ridge_tent(m, body, stripe=None, W=1.25, L=1.6, e=.35, H=1.95, eaves=False):
    """Soldiers' ridge tent: low side walls, pitched roof along y, door flap at the
    front (-y) gable, poles and four guy ropes. Plain canvas: troops carry no livery.
    eaves: stripe bands along both eaves too (the company tent)."""
    p = m.part('tent')
    verts = [(-W, -L, 0), (W, -L, 0), (W, L, 0), (-W, L, 0),
             (-W, -L, e), (W, -L, e), (W, L, e), (-W, L, e), (0, -L, H), (0, L, H)]
    mesh(p, verts, [((3, 2, 1, 0), 'tentShade'), ((1, 2, 6, 5), body), ((3, 0, 4, 7), body),
                    ((5, 6, 9, 8), body), ((7, 4, 8, 9), body),
                    ((0, 1, 5, 8, 4), 'tentShade'), ((2, 3, 7, 9, 6), 'tentShade')])
    if stripe:
        p.box((0, 0, H + .02), (.14, 2 * L + .04, .06), stripe)
        if eaves:
            for sx in (-1, 1):
                p.box((sx * (W + .02), 0, e - .05), (.04, 2 * L + .04, .22), stripe)
    door = min(.38, W * .35) if not eaves else .7
    plate(p, (0, -L), (0, -1), [(-door, 0), (door, 0), (0, H - .2)], 'dark', 0, .02)
    m.done('tent', p)
    p = m.part('ropes')
    for sy in (-1, 1):
        p.beam((0, sy * L, 0), (0, sy * (L + .05), H + .25), .05, .05, 'woodDark')
        p.beam((0, sy * L, H), (0, sy * (L + 1.0), .05), .03, .03, 'rope')
    for sx in (-1, 1):
        for sy in (-1, 1):
            p.beam((sx * W, sy * L * .6, e), (sx * (W + .7), sy * L * .6, .05), .025, .025, 'rope')
    m.done('ropes', p)
    m.meta = {'door': u(0, -L - .6, 0), 'radius': u(W + .8)[0]}


def tent_ridge(m):
    ridge_tent(m, 'tentBrown', 'tentStripe')


def tent_ridge_plain(m):
    ridge_tent(m, 'tentKhaki')


def tent_company(m):
    # Company tent: a 4 x 5.8 m ridge tent with tall side walls, about a pavilion's size,
    # sleeping a whole company; brown canvas with ochre ridge and eave bands.
    ridge_tent(m, 'tentBrown', 'tentStripe', W=2.0, L=2.9, e=1.1, H=3.1, eaves=True)


def tent_square(m):
    # Circumradius 3.0: a 4.2 m square, four stripes a side; ropes at corners and mid sides.
    pavilion(m, 4, 3.0, 4, 2.0, 4.3, 5.3, rope_step=2, roles=True)
    m.livery = 'pair'


def circus_tent(m):
    """Big top: a 16-sided red and yellow tent, 11 m across, wide entrance."""
    pavilion(m, 16, 5.5, 1, 2.6, 7.4, 8.6, over=.45, rope_step=2,
             keys=('circusRed', 'festYellow'), trim='gold', door=1.0)
    m.meta['ring'] = u(0, 0, 0) + [u(3.2)[0]]


def circus_booth(m):
    """Ticket booth: striped kiosk with a counter at the front (-y), pointed roof, sign."""
    w, d, h = 1.5, 1.2, 2.0
    p = m.part('booth')
    p.box((0, 0, h / 2), (w, d, h), 'festYellow')
    for i in range(5):                                                                    # red stripes on the sides
        x = -w / 2 + w / 5 * (i + .5)
        if i % 2 == 0:
            for sy in (-1, 1):
                if sy < 0 and i == 2:
                    continue
                plate(p, (x, sy * d / 2), (0, sy), [(-w / 10, 0), (w / 10, 0), (w / 10, h), (-w / 10, h)], 'circusRed', 0, .01)
    for sx in (-1, 1):
        for j in range(3):
            y = -d / 2 + d / 3 * (j + .5)
            if j % 2 == 0:
                plate(p, (sx * w / 2, y), (sx, 0), [(-d / 6, 0), (d / 6, 0), (d / 6, h), (-d / 6, h)], 'circusRed', 0, .01)
    plate(p, (0, -d / 2), (0, -1), [(-.4, 1.0), (.4, 1.0), (.4, 1.7), (-.4, 1.7)], 'dark', .01, .03)
    p.box((0, -d / 2 - .15, 1.0), (.95, .32, .06), 'woodLight')                          # counter
    pyramid(p, 0, 0, w + .3, d + .3, h, h + 1.0, ('circusRed', 'festYellow'))
    p.box((0, -d / 2 - .06, h + .25), (1.1, .05, .4), 'canvas')                         # sign board
    p.box((0, 0, h + 1.25), (.05, .05, .5), 'woodDark')
    pennon(p, 0, 0, h + 1.45, .7, keys=('circusRed', 'festYellow'))
    m.done('booth', p)


def bunting_line(m):
    """Two poles 4.5 m apart with a line of festive bunting (scatter for fairs and circus)."""
    p = m.part('bunting')
    for sx in (-2.25, 2.25):
        p.box((sx, 0, 1.5), (.08, .08, 3.0), 'woodDark')
        p.cylinder(.06, 0, 'gold', n=6, axis='z', center=(sx, 0, 0), radii=[.02, .07, .02], along=[3.0, 3.07, 3.16])
    bunting(p, (-2.25, 0, 2.85), (2.25, 0, 2.85), n=8, sag=.45)
    m.done('bunting', p)


def lists_fence(m, L=4.9):
    """Tournament fence segment along x (1.4 U): posts, a painted top rail parted in
    the realm livery, a plain lower rail. Tile it round the field."""
    p = m.part('fence')
    for x in (-L / 2 + .07, 0, L / 2 - .07):
        p.box((x, 0, .65), (.14, .14, 1.3), 'beam')
        p.cylinder(.06, 0, 'gold', n=6, axis='z', center=(x, 0, 0), radii=[.06, .08, .02], along=[1.3, 1.36, 1.44])
    for i, key in enumerate(('heraldA', 'heraldB')):
        p.box(((i - .5) * L / 2, 0, 1.15), (L / 2, .1, .14), key)
    p.box((0, 0, .55), (L, .08, .1), 'wood')
    m.done('fence', p)


# ------------------------------------------------------------------ circus wagons (+x forward)
def cart_wheel(p, x, y, r=.45):
    p.cylinder(r, .04, 'woodDark', n=10, axis='y', center=(x, y, r), cap_key='wood')
    p.cylinder(.09, .07, 'iron', n=6, axis='y', center=(x, y, r))


def wagon_base(p, L, W, z):
    """Bed on two axles, four wheels and shafts for one horse."""
    p.box((0, 0, z), (L, W, .12), 'woodDark')
    for x in (-L / 2 + .55, L / 2 - .55):
        p.box((x, 0, .45), (.1, W + .3, .1), 'beam')
        for s in (-1, 1):
            cart_wheel(p, x, s * (W / 2 + .12))
    for s in (-1, 1):
        p.beam((L / 2 - .2, s * .35, z - .08), (L / 2 + 1.7, s * .3, .75), .06, .06, 'woodDark')
    p.beam((L / 2 + .1, -.38, z - .06), (L / 2 + .1, .38, z - .06), .06, .06, 'woodDark')


def wagon_caravan(m):
    """Players' caravan: painted box body, arched roof, back door with steps, chimney."""
    L, W, z = 3.4, 1.7, .95
    p = m.part('wagon')
    wagon_base(p, L, W, z)
    zb = z + .06
    p.box((0, 0, zb + .8), (L - .1, W, 1.6), 'festGreen')
    p.cylinder(W / 2 + .1, L / 2 + .12, 'circusRed', n=12, axis='x', center=(0, 0, zb + 1.6), squash=.45, cap_key='festYellow')
    for s in (-1, 1):
        for i, x in enumerate((-1.05, 0, 1.05)):
            plate(p, (x, s * W / 2), (0, s), [(-.45, zb + .25), (.45, zb + .25), (.45, zb + 1.4), (-.45, zb + 1.4)], 'festYellow', 0, .02)
            inner = [(-.36, zb + .33), (.36, zb + .33), (.36, zb + 1.32), (-.36, zb + 1.32)]
            plate(p, (x, s * W / 2), (0, s), inner, 'dark' if i == 1 else 'circusRed', .02, .035)
    plate(p, (-L / 2 + .05, 0), (-1, 0), [(-.35, zb), (.35, zb), (.35, zb + 1.45), (-.35, zb + 1.45)], 'woodDark', 0, .03)
    for j in range(3):                                                                    # back steps
        p.box((-L / 2 - .2 - .22 * j, 0, zb - .25 - .3 * j), (.22, .7, .05), 'woodLight')
    p.beam((-L / 2 - .1, -.36, zb - .05), (-L / 2 - .75, -.36, 0), .05, .05, 'woodDark')
    p.beam((-L / 2 - .1, .36, zb - .05), (-L / 2 - .75, .36, 0), .05, .05, 'woodDark')
    p.box((.9, .45, zb + 2.15), (.14, .14, .5), 'iron')                                  # stove pipe
    m.done('wagon', p)


def wagon_cage(m):
    """Menagerie wagon: barred cage on a flatbed, painted roof with a valance."""
    L, W, z = 3.2, 1.7, .95
    p = m.part('wagon')
    wagon_base(p, L, W, z)
    zb, hc = z + .06, 1.5
    p.box((0, 0, zb + .03), (L - .2, W - .1, .06), 'hay')
    for sx in (-1, 1):
        for sy in (-1, 1):
            p.box((sx * (L / 2 - .15), sy * (W / 2 - .1), zb + hc / 2), (.12, .12, hc), 'circusRed')
    n = 12
    for i in range(n + 1):
        x = -L / 2 + .15 + (L - .3) * i / n
        for sy in (-1, 1):
            p.box((x, sy * (W / 2 - .1), zb + hc / 2), (.03, .03, hc), 'iron')
    for i in range(1, 6):
        y = -W / 2 + .1 + (W - .2) * i / 6
        for sx in (-1, 1):
            p.box((sx * (L / 2 - .15), y, zb + hc / 2), (.03, .03, hc), 'iron')
    slab(p, [(-L / 2, -W / 2 - .1, zb + hc + .1), (L / 2, -W / 2 - .1, zb + hc + .1),
             (L / 2, 0, zb + hc + .4), (-L / 2, 0, zb + hc + .4)], .06, 'festYellow')
    slab(p, [(L / 2, W / 2 + .1, zb + hc + .1), (-L / 2, W / 2 + .1, zb + hc + .1),
             (-L / 2, 0, zb + hc + .4), (L / 2, 0, zb + hc + .4)], .06, 'circusRed')
    for sy in (-1, 1):
        for i in range(8):
            w = L / 8
            plate(p, (-L / 2 + w * (i + .5), sy * (W / 2 + .1)), (0, sy), tongue(w, zb + hc + .06, .3),
                  'circusRed' if i % 2 else 'festYellow', 0, .02)
    blob(p, -.4, 0, .45, zb + .06, .55, 'leatherDark', n=7, jitter=.2, top_scale=.5)  # a sleeping bear
    m.done('wagon', p)


def wagon_cargo(m):
    """Open cart of the troupe's baggage: plank sides, barrels, crates, a canvas bundle."""
    L, W, z = 3.0, 1.6, .9
    p = m.part('wagon')
    wagon_base(p, L, W, z)
    zb = z + .06
    for s in (-1, 1):
        p.box((0, s * (W / 2 - .03), zb + .25), (L, .06, .5), 'wood')
        p.box((s * (L / 2 - .03), 0, zb + .25), (.06, W, .5), 'woodLight')
    for x, y in ((-.9, -.38), (-.9, .38)):
        p.cylinder(.27, 0, 'barrel', n=8, axis='z', center=(x, y, zb), radii=[.23, .28, .23], along=[0, .35, .7], cap_key='woodLight')
    p.box((.05, -.3, zb + .25), (.55, .5, .5), 'woodLight')
    p.box((.15, .35, zb + .2), (.45, .45, .4), 'wood')
    p.cylinder(.35, .55, 'canvas', n=8, axis='x', center=(.95, 0, zb + .3), squash=.8, cap_key='canvasShade')
    for x in (.65, 1.25):
        p.cylinder(.36, .03, 'rope', n=8, axis='x', center=(x, 0, zb + .3), squash=.8)
    m.done('wagon', p)


# ------------------------------------------------------------------ wooden stand
def stand(m, covered):
    """Stand on a timber trestle facing the lists (-y): front walk, four tiers,
    side stair; covered adds a cloth canopy."""
    X = 6.0
    xs = [-6.0, -3.6, -1.2, 1.2, 3.6, 6.0]
    yf, yw, z0 = -2.4, -1.4, 1.4           # front edge, back of the front walk, walk level
    nt, dep, rise = 4, .8, .45
    yb, ztop = yw + nt * dep, z0 + nt * rise
    zcf, zcb = 5.2, 5.8                     # canopy at the front / back posts

    p = m.part('structure')
    p.box((0, (yf + yw) / 2, z0 - .05), (2 * X, yw - yf, .1), 'woodLight')
    for i in range(nt):
        ya, zt = yw + i * dep, z0 + (i + 1) * rise
        p.box((0, ya + dep / 2, zt - .05), (2 * X, dep, .1), 'wood' if i % 2 == 0 else 'woodLight')
        p.box((0, ya + .03, zt - rise / 2), (2 * X, .06, rise), 'woodDark')                  # riser
        for sx in (-1, 1):                                                                  # stepped side cheeks
            p.box((sx * (X + .03), (ya + yb) / 2, zt - rise / 2), (.06, yb - ya, rise), 'wood')
    # Trestle: posts under each row, raking stringers, X braces at the back and the ends.
    rows = ([(yf + .07, z0 + 1.0)] + [(yw + i * dep + .07, z0 + i * rise - .1) for i in range(nt)]
            + [(yb - .07, ztop + 1.1)])
    for x in xs:
        px = max(-X + .08, min(X - .08, x))
        for y, h in rows:
            p.box((px, y, h / 2), (.14, .14, h), 'beam')
        p.beam((px, yw, z0 - .17), (px, yb, ztop - .17), .12, .16, 'beam')
        p.box((px, (yf + yw) / 2, z0 - .17), (.12, yw - yf, .14), 'beam')
    for a, b in zip(xs, xs[1:]):
        for y in (yb - .07, yf + .07):
            zt = ztop - .3 if y > 0 else z0 - .3
            p.beam((a, y, .2), (b, y, zt), .06, .1, 'beam')
            p.beam((b, y, .2), (a, y, zt), .06, .1, 'beam')
    for sx in (-1, 1):
        p.beam((sx * (X - .08), yf + .07, .2), (sx * (X - .08), yb - .07, ztop - .3), .06, .1, 'beam')
        p.beam((sx * (X - .08), yb - .07, .2), (sx * (X - .08), yf + .07, z0 - .3), .06, .1, 'beam')
        p.beam((sx * (X + .05), yf + .04, z0 + 1.0), (sx * (X + .05), yb, ztop + 1.0), .08, .08, 'woodDark')   # side handrail
    # Backrest planks and front balustrade.
    for j, z in enumerate((ztop + .25, ztop + .75)):
        p.box((0, yb + .03, z), (2 * X, .06, .45), 'wood' if j else 'woodLight')
    p.box((0, yf + .05, z0 + 1.0), (2 * X + .1, .12, .1), 'woodDark')
    p.box((0, yf + .05, z0 + .5), (2 * X, .06, .08), 'woodDark')
    for i in range(21):
        p.box((-X + .3 + i * (2 * X - .6) / 20, yf + .05, z0 + .5), (.06, .06, 1.0), 'wood')
    # Side stair from the end of the front walk down towards the back.
    sx0, sw, n_st = X + .05, 1.1, 7
    p.box((sx0 + sw / 2, (yf + yw) / 2, z0 - .05), (sw, yw - yf, .1), 'woodLight')
    for y in (yf + .07, yw - .07):
        p.box((sx0 + sw - .07, y, (z0 + 1.0) / 2), (.12, .12, z0 + 1.0), 'beam')
    for j in range(1, n_st):
        p.box((sx0 + sw / 2, yw + .3 * (j - .5), z0 - z0 / n_st * j - .03), (sw - .1, .3, .06), 'woodLight')
    run = yw + .3 * n_st
    for x in (sx0 + .06, sx0 + sw - .06):
        p.beam((x, yw, z0 - .08), (x, run, 0), .08, .2, 'beam')
    p.beam((sx0 + sw, yf, z0 + 1.0), (sx0 + sw, yw, z0 + 1.0), .07, .07, 'woodDark')
    p.beam((sx0 + sw, yw, z0 + 1.0), (sx0 + sw, run, .95), .07, .07, 'woodDark')
    p.box((sx0 + sw, run, .5), (.1, .1, 1.0), 'beam')
    m.done('structure', p)

    # Hangings over the front balustrade: one cloth per bay, gold tongues; arms on the centre one.
    p = m.part('drapes')
    skirt(p, -X, X, yf, z0 + 1.05, .75, 5)
    m.done('drapes', p)
    yd, a = yf - .07, .5
    m.decals = {'arms': {'part': 'drapes', 'o': u(-a, yd, z0 + .9), 'u': u(a, yd, z0 + .9), 'v': u(-a, yd, z0 - .3), 'clip': None}}

    if covered:
        p = m.part('canopy')
        for x in xs:
            px = max(-X + .08, min(X - .08, x))
            p.box((px, yf + .07, (z0 + 1.0 + zcf) / 2), (.14, .14, zcf - z0 - 1.0), 'beam')
            p.box((px, yb - .07, (ztop + 1.1 + zcb) / 2), (.14, .14, zcb - ztop - 1.1), 'beam')
            flagstaff(p, px, yf + .07, zcf, .9, .9)
        cy0, cy1, cx = yf - .35, yb + .3, X + .3
        zc = lambda y: zcf + (zcb - zcf) * (y - (yf + .07)) / (yb - yf - .14)
        for y in (yf + .07, yb - .07):
            p.box((0, y, zc(y) - .12), (2 * X, .12, .14), 'beam')
        ns = 15
        for i in range(ns):
            x0, x1 = -cx + 2 * cx * i / ns, -cx + 2 * cx * (i + 1) / ns
            slab(p, [(x0, cy0, zc(cy0)), (x1, cy0, zc(cy0)), (x1, cy1, zc(cy1)), (x0, cy1, zc(cy1))], .04, tincture(i))
        nv = 20
        for i in range(nv):
            w = 2 * cx / nv
            plate(p, (-cx + w * (i + .5), cy0), (0, -1), tongue(w, zc(cy0) - .02, .45), tincture(i + 1), 0, .03)
        plate(p, (0, cy0), (0, -1), [(-cx, zc(cy0) - .1), (cx, zc(cy0) - .1), (cx, zc(cy0)), (-cx, zc(cy0))], 'heraldTrim', .03, .045)
        nside = 7
        for sx in (-1, 1):
            for i in range(nside):
                w = (cy1 - cy0) / nside
                y = cy0 + w * (i + .5)
                plate(p, (sx * cx, y), (sx, 0), tongue(w, zc(y) - .02, .4), tincture(i), 0, .03)
        m.done('canopy', p)

    m.meta = {'facing': [0, -1],
              'seats': [u(-X + .4 + j * .7, yw + i * dep + .35, z0 + (i + 1) * rise) for i in range(nt) for j in range(17)],
              'standing': [u(-X + .5 + j * .85, (yf + yw) / 2 + .1, z0) for j in range(14)],
              'stairFoot': u(sx0 + sw / 2, run + .4, 0)}


def stand_open(m):
    stand(m, False)


def stand_covered(m):
    stand(m, True)


# ------------------------------------------------------------------ U arena
def u_path(Ls, yc, step=2.0, m_arc=12):
    """Centre line of the U as (centre, outward normal) samples; the point at radius r
    is centre + normal * r. Left leg from the open end (-y), half circle at the back
    (+y), right leg back to the open end."""
    nY = round(Ls / step)
    ys = [-Ls + Ls * j / nY + yc for j in range(nY + 1)]
    path = [((0, y), (-1, 0)) for y in ys]
    for j in range(1, m_arc):
        a = math.pi - math.pi * j / m_arc
        path.append(((0, yc), (math.cos(a), math.sin(a))))
    return path + [((0, y), (1, 0)) for y in reversed(ys)]


def at(sample, r, z):
    (cx, cy), (nx, ny) = sample
    return (cx + nx * r, cy + ny * r, z)


def sweep(p, path, prof, keys, cap='woodDark'):
    """Closed (r, z) profile swept along the U; keys[k] (or keys(k, j)) colours the
    face of profile edge k; both ends capped."""
    K = len(prof)
    verts = [at(s, r, z) for s in path for r, z in prof]
    kf = keys if callable(keys) else (lambda k, j: keys[k])
    faces = []
    for j in range(len(path) - 1):
        for k in range(K):
            a, b = j * K + k, j * K + (k + 1) % K
            faces.append(((a, b, b + K, a + K), kf(k, j)))
    last = (len(path) - 1) * K
    faces += [(tuple(range(K)), cap), (tuple(range(last + K - 1, last - 1, -1)), cap)]
    mesh(p, verts, faces)


def arena_u(m):
    Ri, Ls, nt, dep, rise, z0 = 10.0, 16.0, 5, .8, .45, .9
    rb = Ri + .12                              # back of the field barrier, front of tier 0
    Ro = rb + nt * dep
    zl = z0 + (nt - 1) * rise                  # top tier
    yc = (Ls - Ro - .4) / 2                    # centre the footprint on the origin
    path = u_path(Ls, yc)
    mid = [len(path) // 6, len(path) // 2, len(path) - 1 - len(path) // 6]   # aisles: mid legs, back of the arc

    p = m.part('tiers')
    prof, keys = [(rb, 0), (Ro, 0), (Ro, zl)], ['woodDark', 'wood']
    for i in range(nt - 1, -1, -1):
        zi = z0 + i * rise
        prof.append((rb + i * dep, zi)); keys.append('woodLight' if i % 2 else 'wood')
        prof.append((rb + i * dep, zi - rise if i else 0)); keys.append('woodDark')
    prof.pop(); keys.pop()
    keys.append('woodDark')                    # closing edge behind the barrier
    sweep(p, path, prof, keys)
    for j in mid:                              # stair aisles: a half step up each riser
        for i in range(1, nt):
            r0 = rb + i * dep
            zb = z0 + (i - 1) * rise
            p.beam(at(path[j], r0 - dep / 2, zb + rise / 4), at(path[j], r0, zb + rise / 4), 1.0, rise / 2, 'woodLight')
    m.done('tiers', p)

    p = m.part('walls')
    sweep(p, path, [(Ri, 0), (rb, 0), (rb, 1.35), (Ri, 1.35)], ['woodDark', 'wood', 'woodDark', 'wood'])
    sweep(p, path, [(Ro, 0), (Ro + .12, 0), (Ro + .12, zl + 1.1), (Ro, zl + 1.1)],
          lambda k, j: 'woodDark' if k != 1 else ('wood' if j % 2 else 'woodLight'))
    for j, s in enumerate(path):
        p.beam(at(s, Ro + .2, 0), at(s, Ro + .2, zl + 1.35), .18, .18, 'beam')
        p.beam(at(s, Ri - .07, 0), at(s, Ri - .07, 1.45), .14, .14, 'beam')
        if j % 3 == 0:
            nx, ny = s[1]
            x, y, _ = at(s, Ro + .2, 0)
            flagstaff(p, x, y, zl + 1.35, 1.6, 1.3, (-ny, nx))
    for s in (path[0], path[-1]):              # entry steps at both open ends
        for k in range(2):
            x, y, _ = at(s, rb + dep / 2, 0)
            p.box((x, y - .35 - .35 * k, (2 - k) * z0 / 6), (dep, .35, (2 - k) * z0 / 3), 'woodLight')
    m.done('walls', p)

    # Hangings on the field side of the barrier, one per bay, with gold tongues.
    p = m.part('drapes')
    for j in range(len(path) - 1):
        a, b = at(path[j], Ri - .02, 0), at(path[j + 1], Ri - .02, 0)
        w = math.hypot(b[0] - a[0], b[1] - a[1]) - .2
        n = ((path[j][1][0] + path[j + 1][1][0]) / 2, (path[j][1][1] + path[j + 1][1][1]) / 2)
        L = math.hypot(*n)
        inward = (-n[0] / L, -n[1] / L)
        o = ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)
        plate(p, o, inward, [(-w / 2, .45), (w / 2, .45), (w / 2, 1.3), (-w / 2, 1.3)], tincture(j), 0, .03)
        for t in range(3):
            du = -w / 2 + w / 6 * (2 * t + 1)
            plate(p, o, inward, [(uu + du, z) for uu, z in tongue(w / 3, .47, .22)], 'heraldTrim', .02, .04)
    m.done('drapes', p)

    # Sand on the field (painted first: part name starts with 'ground').
    p = m.part('groundSand')
    prism(p, [at(s, Ri - .1, 0)[:2] for s in path], 0, .03, 'sand')
    m.done('groundSand', p)

    # Honour box over the back of the arc (apex normal +y): floor over the top tiers,
    # draped parapet, striped canopy with a valance, the lord's banners behind.
    p = m.part('honour')
    Y = lambda r: yc + r
    r0, hw, zt = rb + 2.4, 2.6, zl + 3.0
    p.box((0, Y((r0 + Ro) / 2), zl + .05), (2 * hw, Ro - r0, .12), 'woodLight')
    for sx in (-1, 1):
        for r in (r0 + .07, Ro - .07):
            p.box((sx * (hw - .07), Y(r), (zl + zt) / 2), (.14, .14, zt - zl), 'beam')
        p.box((sx * hw, Y((r0 + Ro) / 2), zl + .55), (.06, Ro - r0, .9), 'heraldB')     # side cheeks
    p.box((0, Y(r0), zl + .55), (2 * hw, .06, .9), 'heraldA')                           # draped parapet
    for t in range(8):
        w = 2 * hw / 8
        plate(p, (-hw + w * (t + .5), Y(r0) - .03), (0, -1), tongue(w, zl + .12, .25), 'heraldTrim', 0, .02)
    for i in range(9):
        x0, x1 = -hw - .3 + (2 * hw + .6) * i / 9, -hw - .3 + (2 * hw + .6) * (i + 1) / 9
        slab(p, [(x0, Y(r0 - .4), zt), (x1, Y(r0 - .4), zt), (x1, Y(Ro + .2), zt + .5), (x0, Y(Ro + .2), zt + .5)], .05, tincture(i))
    for i in range(12):
        w = (2 * hw + .6) / 12
        plate(p, (-hw - .3 + w * (i + .5), Y(r0 - .4)), (0, -1), tongue(w, zt - .03, .4), tincture(i + 1), 0, .03)
    flagstaff(p, 0, Y((r0 + Ro) / 2), zt + .5, 1.4, 1.4)
    for sx in (-1, 1):                                                                   # the lord's banners
        x = sx * (hw + 1.2)
        p.box((x, Y(Ro + .35), (zl + 1.1 + zt + 1.2) / 2), (.1, .1, zt + 1.2 - zl - 1.1), 'woodDark')
        m.decals['arms' + ('R' if sx > 0 else 'L')] = {'part': 'honour', **gonfalon(p, x, Y(Ro + .3), zt + 1.0, .9, 1.9)}
    m.done('honour', p)

    # Gate at the open end: two timber towers on the leg ends, a beam with banners across.
    p = m.part('gate')
    yg, rt, ht = yc - Ls - 1.2, (rb + Ro) / 2, zl + 3.2
    for sx in (-1, 1):
        x = sx * rt
        p.box((x, yg, ht / 2), (2.2, 2.2, ht), 'wood')
        for dx in (-1.05, 1.05):
            for dy in (-1.05, 1.05):
                p.box((x + dx, yg + dy, ht / 2), (.18, .18, ht), 'beam')
        p.box((x, yg, ht - .3), (2.5, 2.5, .2), 'woodDark')
        pyramid(p, x, yg, 2.6, 2.6, ht - .2, ht + 1.6, ('heraldA', 'heraldB'))
        plate(p, (x, yg - 1.1), (0, -1), [(-.35, 2.0), (.35, 2.0), (.35, 3.0), (-.35, 3.0)], 'dark', 0, .03)
        flagstaff(p, x, yg, ht + 1.5, 1.2, 1.2)
    p.box((0, yg, ht - .5), (2 * rt, .25, .3), 'woodDark')
    nb = 10
    for i in range(nb):
        x = -rt + 1.4 + (2 * rt - 2.8) * (i + .5) / nb
        with cloth(p, (x, yg - .14, ht - .65), (0, 0, -1), (0, -1, 0), 1.2):
            plate(p, (x, yg - .14), (0, -1), [(-.4, ht - .65), (.4, ht - .65), (.4, ht - 1.6), (0, ht - 1.85), (-.4, ht - 1.6)], tincture(i), 0, .02)
    m.done('gate', p)

    seats = []
    for i in range(nt):
        r, z = rb + i * dep + .35, z0 + i * rise
        for j in range(len(path) - 1):
            a, b = at(path[j], r, z), at(path[j + 1], r, z)
            L = math.hypot(b[0] - a[0], b[1] - a[1])
            nx, ny = path[j][1]
            for k in range(max(1, round(L / .7))):
                t = (k + .5) / max(1, round(L / .7))
                if j + 1 in mid and t > .7 or j in mid and t < .3:
                    continue                   # keep the aisles free
                seats.append(u(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, z) + [round(math.atan2(-ny, -nx), 3)])
    m.meta = {'seats': seats, 'field': {'r': u(Ri)[0], 'arcCentre': u(0, yc), 'openEnd': u(0, yc - Ls)},
              'entries': [u(*at(s, rb + dep / 2, 0)[:2]) for s in (path[0], path[-1])]}


# ------------------------------------------------------------------ props
def p_tilt(m, L=12.0, n=6):
    """Tilt barrier segment along x (tile it end to end); jousters ride either side."""
    p = m.part('barrier')
    for i in range(n + 1):
        p.box((-L / 2 + i * L / n, 0, .7), (.16, .16, 1.4), 'beam')
    p.box((0, 0, 1.43), (L + .16, .16, .1), 'woodDark')
    p.box((0, 0, .75), (L, .08, .12), 'wood')
    m.done('barrier', p)
    p = m.part('cloth')
    for i in range(n):
        for s in (-1, 1):
            p.box((-L / 2 + (i + .5) * L / n, s * .1, .85), (L / n - .18, .03, 1.1), tincture(i + (s > 0)))
    m.done('cloth', p)
    m.meta = {'length': u(L)[0], 'lanes': [u(0, -1.6), u(0, 1.6)]}


def p_lance_rack(m):
    p = m.part('rack')
    for sx in (-1.1, 1.1):
        p.beam((sx, -.5, 0), (sx, 0, 1.75), .1, .1, 'beam')
        p.beam((sx, .5, 0), (sx, 0, 1.75), .1, .1, 'beam')
    p.box((0, 0, 1.72), (2.5, .12, .12), 'woodDark')
    p.box((0, -.3, .35), (2.3, .08, .08), 'woodDark')
    for i in range(6):
        x = -.9 + i * .36
        butt, d = Vector((x, -.4, 0)), Vector((0, .4, 1.84)).normalized()
        seg = [butt + d * t for t in (0, .55, 1.25, 1.95, 2.65, 3.35)]
        for k in range(len(seg) - 1):
            w0, w1 = .075 - .006 * k, .07 - .006 * k
            p.taper(tuple(seg[k]), tuple(seg[k + 1]), w0, w0, w1, w1, tincture(i + k))
        p.taper(tuple(seg[1] - d * .05), tuple(seg[1] + d * .2), .2, .2, .07, .07, 'steelDark')   # vamplate
        p.taper(tuple(seg[-1]), tuple(seg[-1] + d * .2), .06, .06, .015, .015, 'steel')
    m.done('rack', p)
    m.livery = 'pair'


def a_frame(p, half, h, z_bar, spread=.5):
    """Two A legs at x = +-half joined by a top bar."""
    for sx in (-half, half):
        for sy in (-spread, spread):
            p.beam((sx, sy, 0), (sx, 0, h), .1, .1, 'beam')
    p.box((0, 0, z_bar), (2 * half + .3, .12, .12), 'woodDark')


def p_weapon_rack(m):
    """Swords, axes and maces standing in a trough, leaning on the top bar."""
    p = m.part('rack')
    for sx in (-1.0, 1.0):
        p.box((sx, .05, .7), (.1, .1, 1.4), 'beam')
        p.box((sx, .05, .04), (.12, .7, .08), 'beam')
    p.box((0, .14, 1.12), (2.15, .1, .1), 'woodDark')
    p.box((0, -.05, .12), (2.0, .26, .14), 'woodDark')
    d, side = (0, .17, 1), (1, 0, 0)
    for i, kind in enumerate(('sword', 'axe', 'sword', 'mace', 'sword', 'axe', 'mace')):
        a = (-.78 + i * .26, -.06, .16)
        if kind == 'sword':
            sword(p, a, d, side)
        elif kind == 'axe':
            axe(p, (a[0], a[1], .14), d, side)
        else:
            mace(p, (a[0], a[1], .14), d)
    m.done('rack', p)


def p_spear_rack(m):
    """Spears and halberds upright between a base board and a holed rail."""
    p = m.part('rack')
    for sx in (-1.3, 1.3):
        p.box((sx, 0, .55), (.1, .1, 1.1), 'beam')
        p.box((sx, 0, .04), (.12, .6, .08), 'beam')
    p.box((0, 0, 1.0), (2.75, .14, .1), 'woodDark')
    p.box((0, 0, .08), (2.6, .36, .08), 'woodDark')
    for i in range(6):
        x = -1.1 + i * .44
        polearm(p, (x, -.04, .12), (0, .03, 1), 2.1 if i % 3 == 1 else 2.5, halberd=(i % 3 == 1))
    m.done('rack', p)


def p_shield_rack(m):
    """A-frame with kite shields hung on the front and heaters on the back."""
    p = m.part('rack')
    a_frame(p, 1.3, 1.6, 1.55)
    for i, x in enumerate((-.8, 0, .8)):
        shield(p, (x, -.2, 1.0), (1, 0, 0), (0, .2, 1), KITE, .95)
    for x in (-.45, .45):
        shield(p, (x, .18, 1.1), (-1, 0, 0), (0, -.2, 1), HEATER)
    m.done('rack', p)
    m.livery = 'pair'


def p_armour_pile(m):
    """Heap of mail with helms, a shield lying on the ground and a sword across."""
    p = m.part('pile')
    mail_heap(p, 0, 0, .55, .28)
    mail_heap(p, .5, .3, .32, .18, n=7)
    great_helm(p, -.05, .02, .36)
    kettle_hat(p, .62, -.38, 0, flip=True)
    kettle_hat(p, .55, .32, .2)
    shield(p, (-.7, -.25, .06), (.95, .3, 0), (-.3, .95, .25), HEATER)
    sword(p, (.9, -.7, .05), (-1, .55, .02), (.55, 1, 0))
    for x, y in ((.25, -.5), (.38, -.55)):
        p.box((x, y, .04), (.12, .08, .08), 'steelDark')                                   # gauntlets
    m.done('pile', p)
    m.livery = 'pair'


def p_armour_crate(m):
    """Open crate of helms, a cuirass and a shield leaning on it, mail beside."""
    p = m.part('pile')
    p.box((0, 0, .32), (.8, .6, .64), 'woodLight')
    for s in (-1, 1):
        p.box((s * .41, 0, .32), (.03, .62, .66), 'woodDark')
        p.box((0, s * .31, .32), (.82, .03, .1), 'woodDark')
    for x, y in ((-.18, -.05), (.18, .08)):
        kettle_hat(p, x, y, .6)
    great_helm(p, .0, -.05, .7)
    p.cylinder(.2, 0, 'steel', n=8, axis='z', center=(0, 0, 0), radii=[.16, .2, .17], along=[0, .22, .44], squash=.65)
    shield(p, (.15, -.38, .36), (1, 0, 0), (0, .3, 1), KITE, .55)
    mail_heap(p, .75, .1, .3, .2, n=7)
    p.cylinder(.2, 0, 'steel', n=8, axis='z', center=(-.65, -.2, 0), radii=[.15, .19, .16], along=[0, .2, .4], squash=.65)
    m.done('pile', p)
    m.livery = 'pair'


def p_armour_stand(m):
    """Wooden mannequin dressed in mail and a livery surcoat, great helm on top,
    shield and sword at its foot."""
    p = m.part('stand')
    for a in (0, math.pi / 2):
        p.box((0, 0, .05), (.7, .1, .1), 'beam', rot=Matrix.Rotation(a, 3, 'Z'))
    p.box((0, 0, .8), (.08, .08, 1.6), 'wood')
    p.box((0, 0, 1.47), (.56, .08, .08), 'wood')
    p.taper((0, 0, .8), (0, 0, 1.5), .46, .3, .42, .26, 'mail')                          # hauberk
    for s, key in ((1, 'heraldA'), (-1, 'heraldB')):                                       # surcoat per pale
        p.taper((s * .12, 0, .72), (s * .1, 0, 1.42), .25, .33, .22, .29, key)
        p.taper((s * .26, 0, 1.46), (s * .3, 0, 1.08), .1, .1, .09, .09, 'mail')        # sleeves
    p.box((0, 0, 1.1), (.5, .34, .05), 'leatherDark')
    great_helm(p, 0, 0, 1.52)
    shield(p, (.4, -.3, .36), (1, .2, 0), (0, .35, 1), HEATER, .85)
    sword(p, (-.35, -.25, 0), (.05, .2, 1), (1, 0, 0))
    m.done('stand', p)
    m.livery = 'pair'


# ------------------------------------------------------------------ stages
def platform(p, W, D, H, xs, ys):
    """Plank deck on a post grid, braced at the back and the ends."""
    p.box((0, 0, H - .05), (W, D, .1), 'woodLight')
    for i in range(int(W / .5)):
        p.box((-W / 2 + .5 * (i + .5), 0, H + .002), (.02, D, .004), 'woodDark')          # board joints
    for x in xs:
        for y in ys:
            p.box((x, y, (H - .1) / 2), (.14, .14, H - .1), 'beam')
    for a, b in zip(xs, xs[1:]):
        p.beam((a, ys[-1], .15), (b, ys[-1], H - .25), .06, .1, 'beam')
        p.beam((b, ys[-1], .15), (a, ys[-1], H - .25), .06, .1, 'beam')
    for x in (xs[0], xs[-1]):
        p.beam((x, ys[0], .15), (x, ys[-1], H - .25), .06, .1, 'beam')


def side_stair(p, x0, y, H, w=1.0, run=.3, sgn=1):
    """Stair down from the deck edge at x0 outwards (sgn) at y."""
    n = max(3, round(H / .2))
    for j in range(1, n):
        p.box((x0 + sgn * run * (j - .5), y, H - H / n * j - .03), (run, w, .06), 'woodLight')
    for dy in (-w / 2 + .05, w / 2 - .05):
        p.beam((x0, y + dy, H - .08), (x0 + sgn * run * n, y + dy, 0), .2, .08, 'beam')
    return (x0 + sgn * (run * n + .4), y, 0)


def stage_herald(m):
    """Small platform for public announcements: lectern at the front, the realm's
    banners behind, stair on the side."""
    W, D, H = 4.4, 3.0, 1.2
    xs, ys = [-W / 2 + .08, 0, W / 2 - .08], [-D / 2 + .08, D / 2 - .08]
    p = m.part('platform')
    platform(p, W, D, H, xs, ys)
    for x in xs:                                                                          # back and side rails
        p.box((x, ys[-1], H + .5), (.1, .1, 1.0), 'beam')
    p.box((0, ys[-1], H + 1.0), (W, .08, .08), 'woodDark')
    for sx in (-1, 1):
        p.box((sx * (W / 2 - .08), -D / 2 + .08, H + .5), (.1, .1, 1.0), 'beam')
        p.box((sx * (W / 2 - .08), 0, H + 1.0), (.08, D, .08), 'woodDark')
    foot = side_stair(p, W / 2, D / 2 - .7, H)
    p.box((0, -D / 2 + .45, H + .55), (.12, .12, 1.0), 'woodDark')                      # lectern
    p.box((0, -D / 2 + .5, H + 1.1), (.6, .45, .06), 'woodDark', rot=Matrix.Rotation(-.35, 3, 'X'))
    m.done('platform', p)
    p = m.part('drapes')
    skirt(p, -W / 2, W / 2, -D / 2, H, .25, 2, fold=None)
    plate(p, (0, -D / 2 + .3), (0, -1), [(-.28, H + .3), (.28, H + .3), (.28, H + 1.0), (-.28, H + 1.0)], 'heraldA', 0, .02)
    m.decals = {}
    for k, sx in (('armsL', -1), ('armsR', 1)):
        x = sx * (W / 2 - .7)
        p.box((x, D / 2 + .05, (H + 3.4) / 2), (.1, .1, H + 3.4), 'woodDark')
        p.cylinder(.06, 0, 'gold', n=6, axis='z', center=(x, D / 2 + .05, 0), radii=[.02, .08, .02], along=[H + 3.4, H + 3.48, H + 3.58])
        m.decals[k] = {'part': 'drapes', **gonfalon(p, x, D / 2 - .03, H + 3.2)}
    m.done('drapes', p)
    m.meta = {'facing': [0, -1], 'speaker': u(0, -D / 2 + .95, H), 'stairFoot': u(*foot)}


def separe(p, xc, y0, h=1.8, keys=('heraldA', 'canvas', 'heraldB')):
    """Three-leaf folding screen zigzagging along y from y0."""
    pts = [(xc + (.15 if i % 2 else -.15), y0 + .52 * i) for i in range(4)]
    for x, y in pts:
        p.box((x, y, h / 2), (.05, .05, h), 'woodDark')
        p.box((x, y, .02), (.14, .14, .04), 'woodDark')
    for i in range(3):
        (xa, ya), (xb, yb) = pts[i], pts[i + 1]
        p.beam((xa, ya, h - .04), (xb, yb, h - .04), .04, .05, 'woodDark')
        p.beam((xa, ya, .2), (xb, yb, .2), .04, .05, 'woodDark')
        L = math.hypot(xb - xa, yb - ya)
        n = ((yb - ya) / L, -(xb - xa) / L, 0)
        prism3(p, [(xa, ya, .23), (xb, yb, .23), (xb, yb, h - .07), (xa, ya, h - .07)], n, .015, keys[i])


def stage_theatre(m):
    """Theatre stage: proscenium with a valance and gathered curtains, pleated
    backdrop, folding screens in the wings, stairs at both back corners."""
    W, D, H = 8.0, 5.0, 1.3
    zt = H + 4.0
    xs, ys = [-W / 2 + .08, -W / 6, W / 6, W / 2 - .08], [-D / 2 + .08, 0, D / 2 - .08]
    p = m.part('platform')
    platform(p, W, D, H, xs, ys)
    stairs = [side_stair(p, s * W / 2, D / 2 - .7, H, sgn=s) for s in (-1, 1)]
    for x in (xs[0], 0, xs[-1]):                                                          # frame
        p.box((x, ys[-1], (H + zt) / 2), (.16, .16, zt - H), 'beam')
    for x in (xs[0], xs[-1]):
        p.box((x, ys[0], (H + zt) / 2), (.16, .16, zt - H), 'beam')
        p.box((x, 0, zt), (.14, D, .16), 'beam')
    for y in (ys[0], ys[-1]):
        p.box((0, y, zt), (W, .16, .18), 'beam')
    p.box((0, D / 2 - .5, H + .25), (1.6, .4, .06), 'woodDark')                           # bench upstage
    for x in (-.7, .7):
        p.box((x, D / 2 - .5, H + .11), (.08, .35, .22), 'woodDark')
    m.done('platform', p)

    p = m.part('drapes')
    skirt(p, -W / 2, W / 2, -D / 2, H, .25, 4, fold=None)
    nv = 16
    for i in range(nv):                                                                  # proscenium valance
        w = W / nv
        plate(p, (-W / 2 + w * (i + .5), -D / 2 - .02), (0, -1), tongue(w, zt + .05, .6), tincture(i), 0, .03)
    plate(p, (0, -D / 2 - .02), (0, -1), [(-W / 2, zt - .02), (W / 2, zt - .02), (W / 2, zt + .1), (-W / 2, zt + .1)], 'heraldTrim', .03, .045)
    for s in (-1, 1):                                                                    # gathered curtains
        x = s * (W / 2 - .55)
        p.taper((x, -D / 2 + .2, zt - .05), (x + s * .2, -D / 2 + .2, H + 1.5), .9, .14, .25, .2, 'curtain')
        p.taper((x + s * .2, -D / 2 + .2, H + 1.5), (x + s * .05, -D / 2 + .2, H), .25, .2, .6, .16, 'curtain')
        p.box((x + s * .2, -D / 2 + .2, H + 1.5), (.3, .24, .06), 'heraldTrim')
    npl = 20
    for i in range(npl):                                                                 # pleated backdrop
        w = W / npl
        x0 = -W / 2 + w * i
        dy = .06 if i % 2 else 0
        p.box((x0 + w / 2, D / 2 - .2 - dy, (H + zt) / 2 - .05), (w, .03, zt - H - .1), 'curtain' if i % 2 else 'curtainDark')
    separe(p, -W / 2 + 1.0, -.6)
    separe(p, W / 2 - 1.0, -.6, keys=('heraldB', 'canvas', 'heraldA'))
    m.done('drapes', p)
    m.meta = {'facing': [0, -1], 'actors': [u(x, -D / 2 + 1.2, H) for x in (-1.6, 0, 1.6)],
              'wings': [u(s * (W / 2 - .5), .2, H) for s in (-1, 1)], 'stairFeet': [u(*f) for f in stairs]}


FEST = ('curtain', 'festYellow', 'festGreen', 'canvas')


def bunting(p, a, b, n=9, sag=.35):
    """Line of small triangular flags in the festive colours, sagging between a and b."""
    a, b = Vector(a), Vector(b)
    pt = lambda t: a + (b - a) * t - Vector((0, 0, sag * 4 * t * (1 - t)))
    p.beam(tuple(a), tuple(pt(.5)), .015, .015, 'rope')
    p.beam(tuple(pt(.5)), tuple(b), .015, .015, 'rope')
    d = (b - a).normalized()
    nrm = Vector((-d.y, d.x, 0)).normalized()
    for i in range(n):
        t0, t1 = (i + .15) / n, (i + .85) / n
        q0, q1 = pt(t0), pt(t1)
        tip = (q0 + q1) / 2 - Vector((0, 0, .28))
        with cloth(p, (q0 + q1) / 2, (0, 0, -1), nrm, .28):
            prism3(p, [tuple(q0), tuple(q1), tuple(tip)], nrm, .01, FEST[i % len(FEST)])


def lute(p, x, y, z, lean=.25):
    """Lute leaning back against something behind it (+y)."""
    d = Vector((0, math.sin(lean), math.cos(lean)))
    c = Vector((x, y, z))
    p.cylinder(.15, 0, 'woodLight', n=8, axis='z', center=(x, y, z), radii=[.04, .16, .14, .06], along=[0, .1, .28, .36], squash=.45)
    p.taper(tuple(c + d * .34), tuple(c + d * .72), .05, .025, .04, .02, 'woodDark')
    p.taper(tuple(c + d * .72), tuple(c + d * .84 + Vector((0, .06, 0))), .06, .03, .05, .03, 'woodDark')


def drum(p, x, y, z=0, r=.22, h=.3):
    p.cylinder(r, 0, 'curtain', n=8, axis='z', center=(x, y, z), radii=[r, r], along=[0, h], cap_key='canvas')
    for zz in (.02, h - .04):
        p.cylinder(r, 0, 'woodLight', n=8, axis='z', center=(x, y, z), radii=[r + .012, r + .012], along=[zz, zz + .04])


def stool(p, x, y, z=0, h=.45):
    p.cylinder(.18, 0, 'woodLight', n=6, axis='z', center=(x, y, z), radii=[.18, .18], along=[h - .05, h])
    for k in range(3):
        a = 2 * math.pi * k / 3
        p.beam((x + math.cos(a) * .17, y + math.sin(a) * .17, z), (x + math.cos(a) * .08, y + math.sin(a) * .08, z + h - .05), .04, .04, 'woodDark')


def podium_street(m):
    """Small octagonal podium for a street artist or a pair: a musician or a
    storyteller, a stool, an upturned hat for coins, a pole with bunting."""
    R, H = 1.0, .35
    p = m.part('podium')
    prism(p, circ(0, 0, R, 8, math.pi / 8), 0, H, 'wood', top='woodLight')
    for i in range(8):                                                                    # board joints
        a = math.pi / 8 + math.pi / 4 * i
        p.box((math.cos(a) * R * .48, math.sin(a) * R * .48, H + .002), (.02, .02, .004), 'woodDark')
    p.box((0, -R * .92 - .17, H / 4), (.8, .34, H / 2), 'woodLight')                    # step
    stool(p, .32, .22, H)
    lute(p, -.42, .3, H + .02)
    kettle_hat(p, .2, -R - .7, 0, flip=True)                                             # hat for coins
    p.box((0, R + .25, 1.2), (.08, .08, 2.4), 'woodDark')                                 # pole behind
    p.cylinder(.06, 0, 'gold', n=6, axis='z', center=(0, R + .25, 0), radii=[.02, .07, .02], along=[2.4, 2.47, 2.56])
    bunting(p, (0, R + .25, 2.3), (-1.9, R - .3, .9), n=6, sag=.25)
    bunting(p, (0, R + .25, 2.3), (1.9, R - .3, .9), n=6, sag=.25)
    for sx in (-1, 1):                                                                    # bunting pegs
        p.beam((sx * 1.9, R - .3, 0), (sx * 1.9, R - .3, .95), .05, .05, 'woodDark')
    m.done('podium', p)
    m.meta = {'facing': [0, -1], 'performers': [u(-.3, 0, H), u(.3, 0, H)],
              'hat': u(.2, -R - .7, 0), 'audienceRadius': u(3.2)[0]}


def stage_players(m):
    """The stage of stageHerald dressed for travelling players: a backcloth with a
    parted entrance, side wings, bunting, a drum, a trunk and a stool."""
    W, D, H = 4.4, 3.0, 1.2
    xs, ys = [-W / 2 + .08, 0, W / 2 - .08], [-D / 2 + .08, D / 2 - .08]
    p = m.part('platform')
    platform(p, W, D, H, xs, ys)
    foot = side_stair(p, W / 2, D / 2 - .7, H)
    zt = H + 2.7
    for sx in (-1, 1):
        p.box((sx * (W / 2 - .08), ys[-1], (H + zt) / 2), (.12, .12, zt - H), 'beam')     # backcloth frame
        p.box((sx * (W / 2 - .08), ys[0], (H + 2.2 + H) / 2), (.1, .1, 2.2), 'beam')      # front poles
        p.cylinder(.06, 0, 'gold', n=6, axis='z', center=(sx * (W / 2 - .08), ys[0], 0), radii=[.02, .07, .02], along=[H + 2.2, H + 2.27, H + 2.36])
    p.box((0, ys[-1], zt), (W, .1, .1), 'woodDark')
    drum(p, -1.4, .6, H)
    p.box((1.3, .75, H + .22), (.8, .45, .44), 'leather')                                 # trunk
    p.box((1.3, .75, H + .45), (.84, .49, .04), 'leatherDark')
    stool(p, .9, -.2, H)
    m.done('platform', p)

    p = m.part('drapes')
    pitch, n = W / 12, 12
    for i in range(n):                                                                    # backcloth, parted in the middle
        if i in (5, 6):
            continue
        dy = .05 if i % 2 else 0
        p.box((-W / 2 + pitch * (i + .5), D / 2 - .2 - dy, (H + zt) / 2), (pitch, .03, zt - H - .05), 'curtain' if i % 2 else 'curtainDark')
    for sx in (-1, 1):                                                                    # entrance halves tied back
        p.taper((sx * pitch, D / 2 - .2, zt - .05), (sx * pitch * 1.6, D / 2 - .2, H + 1.0), pitch * 2, .08, pitch * .8, .12, 'curtain')
        p.taper((sx * pitch * 1.6, D / 2 - .2, H + 1.0), (sx * pitch * 1.2, D / 2 - .2, H), pitch * .8, .12, pitch * 1.4, .08, 'curtain')
        p.box((sx * pitch * 1.6, D / 2 - .2, H + 1.0), (.2, .16, .05), 'festYellow')
    p.box((0, D / 2 - .14, (H + zt) / 2), (2 * pitch, .02, zt - H - .05), 'dark')
    for i, x in enumerate((-W / 2 + .5, W / 2 - .5)):                                    # side wings
        p.box((x, D / 2 - .7, H + 1.0), (.03, .9, 2.0), 'festGreen' if i else 'festYellow')
    for i in range(16):                                                                   # scalloped top valance
        w = W / 16
        plate(p, (-W / 2 + w * (i + .5), D / 2 - .26), (0, -1), tongue(w, zt - .02, .4), FEST[i % 3], 0, .02)
    for sx in (-1, 1):
        bunting(p, (sx * (W / 2 - .08), ys[0], H + 2.15), (sx * (W / 2 - .08), ys[-1], zt - .1), n=6, sag=.3)
    bunting(p, (-(W / 2 - .08), ys[0], H + 2.15), (W / 2 - .08, ys[0], H + 2.15), n=10, sag=.45)
    for i in range(4):                                                                    # front skirt in festive cloth
        c = -W / 2 + W / 4 * (i + .5)
        p.box((c, -D / 2 - .05, (H + .25) / 2), (W / 4 - .08, .03, H - .25), FEST[i % 3])
        for t in range(3):
            plate(p, (c - W / 8 + W / 12 * (t + .5), -D / 2 - .065), (0, -1), tongue(W / 12 - .03, .27, .22), 'canvas', 0, .02)
    m.done('drapes', p)
    m.meta = {'facing': [0, -1], 'performers': [u(x, -D / 2 + 1.0, H) for x in (-1.2, -.4, .4, 1.2)],
              'entrance': u(0, D / 2 - .5, H), 'stairFoot': u(*foot)}


MODELS = [('tentOctagon', tent_octagon), ('tentSquare', tent_square), ('standOpen', stand_open),
          ('standCovered', stand_covered), ('arenaU', arena_u), ('propTilt', p_tilt), ('propLanceRack', p_lance_rack),
          ('propWeaponRack', p_weapon_rack), ('propSpearRack', p_spear_rack), ('propShieldRack', p_shield_rack),
          ('propArmourPile', p_armour_pile), ('propArmourCrate', p_armour_crate), ('propArmourStand', p_armour_stand),
          ('stageHerald', stage_herald), ('stageTheatre', stage_theatre), ('podiumStreet', podium_street),
          ('stagePlayers', stage_players), ('circusTent', circus_tent), ('wagonCaravan', wagon_caravan),
          ('wagonCage', wagon_cage), ('wagonCargo', wagon_cargo), ('circusBooth', circus_booth),
          ('propBunting', bunting_line), ('propFence', lists_fence),
          ('tentRidge', tent_ridge), ('tentRidgePlain', tent_ridge_plain), ('tentCompany', tent_company)]
LAYOUT = {'tentOctagon': (0, 0), 'tentSquare': (12, 0), 'standOpen': (0, 16), 'standCovered': (20, 16),
          'arenaU': (10, 52), 'propTilt': (0, -10), 'propLanceRack': (12, -10),
          'propWeaponRack': (17, -10), 'propSpearRack': (22, -10), 'propShieldRack': (27, -10),
          'propArmourPile': (17, -15), 'propArmourCrate': (22, -15), 'propArmourStand': (27, -15),
          'stageHerald': (0, -25), 'stageTheatre': (14, -25), 'podiumStreet': (-10, -25), 'stagePlayers': (0, -35),
          'circusTent': (-30, 0), 'wagonCaravan': (-30, -14), 'wagonCage': (-24, -14), 'wagonCargo': (-18, -14),
          'circusBooth': (-30, -20), 'propBunting': (-25, -20), 'propFence': (-18, -20),
          'tentRidge': (-10, 0), 'tentRidgePlain': (-10, 5), 'tentCompany': (-10, 12)}


def main(out_path):
    root = fresh_collection(COLL_NAME)
    data = {'palette': list(COLORS.values()), 'paletteKeys': KEYS, 'models': {}}
    total, stats = 0, {}
    for name, fn in MODELS:
        m = Model(root, name, (*LAYOUT[name], 0))
        build_civic.rng.seed(sum(map(ord, name)))   # blob() jitter
        fn(m)
        parts = {}
        for k, p in m.parts.items():
            parts[k] = export_part_indexed(p, KEYS)
            f = export_wind(p)
            if f:
                parts[k]['f'] = f    # wind-blown cloth: animated by settlement-events3d.js
        n = sum(len(p['c']) for p in parts.values())
        stats[name] = n
        total += n
        data['models'][name] = {'parts': parts, 'meta': m.meta, 'decals': m.decals, 'livery': m.livery}
    js = ("'use strict';\n// Generated by ASSETS/blender/build_events.py — do not edit by hand.\n"
          "// Event venue and setup models in game-local space (U): front at -y, +z up, origin at the footprint centre.\n"
          "// Parts: p = vertex xyz, i = 3 indices per triangle, c = palette index per triangle,\n"
          "// f = wind-blown cloth {i: vertex, w: weight 0..1, d: wave direction}.\n"
          "window.ConquerEventModels=" + json.dumps(data, separators=(',', ':')) + ";\n")
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, 'w', encoding='utf-8', newline='\n') as f:
        f.write(js)
    print(f"event models: {len(stats)} models, {total} triangles, {len(js) // 1024} KB -> {out_path}")
    print(stats)
    return {'total': total, 'kb': len(js) // 1024, 'models': stats}


if __name__ == '__main__' and '--' in sys.argv:
    args = sys.argv[sys.argv.index('--') + 1:]
    main(args[args.index('--out') + 1])
elif 'EVENTS_OUT' in globals():
    EVENTS_RESULT = main(EVENTS_OUT)
