"""CONQUER timber fortifications builder (Blender 4.4+/5.x): watchtower, palisade tower
(open parapet or roofed gallery), timber gate and the palisade stake.

Same method as the civic models: low-poly, flat colours, real metres on the game
dimensions of drawWatchtowerWood / drawMediumWoodTower / drawWoodGate (1 U = 3.5 m).
Model axes are the structure's local axes (woodTowerLocal / woodGateLocal): +X along
the structure angle, +Y to its left, +Z up, origin on the ground at the centre. The
gate passage runs along X; its door leaves close the +X mouth.

The stake is a template the game repeats along every palisade and parapet: a unit
octagon (radius 1 U, body 0..1 U) with separate tips, scaled per use in game.
Palette keys starting with 'roof' turn white in winter.

Run inside Blender (BlenderMCP execute_code):
    CQ_DIR = r"...\\tools\\blender"; WOOD_OUT = r"...\\src\\assets\\wood-fort-models.js"
    exec(open(CQ_DIR + r"\\build_wood_fort.py", encoding="utf-8").read())
or headless:
    blender --background --python tools/blender/build_wood_fort.py -- --out src/assets/wood-fort-models.js
"""
import json, math, os, sys, importlib, random
from mathutils import Vector
_here = os.path.dirname(os.path.abspath(__file__)) if '__file__' in globals() else CQ_DIR
if _here not in sys.path:
    sys.path.insert(0, _here)
import cq_blender
importlib.reload(cq_blender)
from cq_blender import Part, fresh_collection, export_part_indexed

S = 3.5   # metres per game unit
COLORS = {
    'log': '#795134', 'logEnd': '#8a6342', 'cut': '#c29a6b', 'cutDark': '#b68a5e',
    'plank': '#8b6845', 'plankDark': '#765639', 'beam': '#6e4b30', 'brace': '#7a5537',
    'ladder': '#9a7550', 'door': '#4f3220', 'doorPlank': '#5f3e27', 'iron': '#3b3936',
    'rope': '#a88d62', 'dark': '#1e1712', 'pole': '#5f4630',
    # the realm's heraldry, replaced in game (State.heraldry c1 / c2)
    'heraldA': '#b53636', 'heraldB': '#355fb8',
    # winter: white
    # Kept clear of the dark ground tones: the Asset Lab cuts out pixels close to the empty view.
    'roofShingle': '#654535', 'roofShingleDark': '#5a3d2e', 'roofRidge': '#7a5640', 'roofDeck': '#8b6845',
    # longhouse covers (BC-251105-09): thatch and turf, also white in winter
    'roofThatch': '#a08650', 'roofThatchDark': '#8c7343', 'roofThatchRidge': '#76603a',
    'roofTurf': '#6f7d3e', 'roofTurfDark': '#5d6a34',
}
KEYS = list(COLORS.keys())
COLL_NAME = 'CONQUER_WoodFort'
rng = random.Random(7)


class Model:
    def __init__(self, root, name, offset):
        self.root, self.name, self.offset, self.parts = root, name, offset, {}

    def part(self, key):
        return Part(self.root, key, COLORS, self.offset, prefix=self.name + '_')

    def done(self, key, p):
        self.parts[key] = p.finish()


# ------------------------------------------------------------------ primitives (metres)
def m(*v):
    return tuple(x * S for x in v)


def oct_pts(cx, cy, r, a0=0.0, n=8):
    # palisadeOctagon: vertices at angle + pi/8 + i*pi/4 (flat faces along the axes)
    return [(cx + math.cos(a0 + math.pi / n + i * 2 * math.pi / n) * r,
             cy + math.sin(a0 + math.pi / n + i * 2 * math.pi / n) * r) for i in range(n)]


def prism(p, pts, z0, z1, key, top=None, bottom=False):
    n = len(pts)
    vs = [(x, y, z0) for x, y in pts] + [(x, y, z1) for x, y in pts]
    p.quads(vs, [(i, (i + 1) % n, n + (i + 1) % n, n + i) for i in range(n)], key)
    if top is not False:
        p.quads(vs, [tuple(range(n, 2 * n))], top or key)
    if bottom:
        p.quads(vs, [tuple(range(n - 1, -1, -1))], key)


def rect(cx, cy, w, d):
    return [(cx - w / 2, cy - d / 2), (cx + w / 2, cy - d / 2), (cx + w / 2, cy + d / 2), (cx - w / 2, cy + d / 2)]


def log(p, cx, cy, r, z0, z1, key='log', top='logEnd', lean=(0.0, 0.0)):
    """Octagonal timber post in U (converted to metres); lean shifts the top a little."""
    a = oct_pts(cx * S, cy * S, r * S)
    b = oct_pts((cx + lean[0]) * S, (cy + lean[1]) * S, r * S * .94)
    vs = [(x, y, z0 * S) for x, y in a] + [(x, y, z1 * S) for x, y in b]
    p.quads(vs, [(i, (i + 1) % 8, 8 + (i + 1) % 8, 8 + i) for i in range(8)], key)
    if top:
        p.quads(vs, [tuple(range(8, 16))], top)


def pointed(p, cx, cy, r, z0, body, tip, key='log'):
    """Sharpened stake: octagonal body and an eight-facet hewn point (alternate tones)."""
    log(p, cx, cy, r, z0, body, key, top=None)
    ring = oct_pts(cx * S, cy * S, r * S * .94)
    apex = (cx * S + rng.uniform(-.12, .12) * r * S, cy * S + rng.uniform(-.12, .12) * r * S, tip * S)
    for i in range(8):
        a, b = ring[i], ring[(i + 1) % 8]
        p.quads([(a[0], a[1], body * S), (b[0], b[1], body * S), apex], [(0, 1, 2)], 'cut' if i % 2 else 'cutDark')


def box(p, cx, cy, cz, w, d, h, key, top=None):
    """Box in U, centred on (cx, cy) with its base at cz."""
    prism(p, [(x * S, y * S) for x, y in rect(cx, cy, w, d)], cz * S, (cz + h) * S, key, top)


def beam(p, a, b, w, h, key):
    p.beam(m(*a), m(*b), w * S, h * S, key)


def hip_roof(p, half, eave, apex, keys=('roofShingle', 'roofShingleDark'), courses=3, lip=.045):
    """Hip roof over a square of half-side `half` (U): shingle courses, each starting a little
    wider than the top of the course below, with a flat step ring closing the joint (no gap to
    look into, so the depth-sorted 2.5D painter and the Lab draw it whole), hip ridges and a
    short finial. Faces alternate the two roof tones like drawWoodHipRoof."""
    zs = [eave + (apex - eave) * k / courses for k in range(courses + 1)]
    hs = [half * (1 - k / courses) for k in range(courses + 1)]
    for k in range(courses):
        bh, bz = hs[k] + (lip if k else 0), zs[k]
        ring = [(x * S, y * S, bz * S) for x, y in rect(0, 0, bh * 2, bh * 2)]
        if k:
            inner = [(x * S, y * S, bz * S) for x, y in rect(0, 0, hs[k] * 2, hs[k] * 2)]
            vs = ring + inner
            for i in range(4):
                p.quads(vs, [(i, (i + 1) % 4, 4 + (i + 1) % 4, 4 + i)], keys[1])
        if k == courses - 1:
            for i in range(4):
                p.quads([ring[i], ring[(i + 1) % 4], (0, 0, apex * S)], [(0, 1, 2)], keys[i % 2])
            continue
        top = [(x * S, y * S, zs[k + 1] * S) for x, y in rect(0, 0, hs[k + 1] * 2, hs[k + 1] * 2)]
        vs = ring + top
        for i in range(4):
            p.quads(vs, [(i, (i + 1) % 4, 4 + (i + 1) % 4, 4 + i)], keys[i % 2])
    for i in range(4):   # hip ridges
        a = [(-half, -half), (half, -half), (half, half), (-half, half)][i]
        beam(p, (a[0] * .98, a[1] * .98, eave + .01), (0, 0, apex + .005), .045, .035, 'roofRidge')
    log(p, 0, 0, .03, apex - .05, apex + .14, 'roofRidge', top='roofRidge')


def rail(p, half, z0, z1, corner_r=.045, step=.34, baluster_r=.032):
    """drawWoodRail: corner posts, balusters and a handrail around a square deck."""
    cs = [(-half, -half), (half, -half), (half, half), (-half, half)]
    for x, y in cs:
        log(p, x, y, corner_r, z0, z1)
    size = 2 * half
    steps = max(2, math.ceil(size / step))
    for e in range(4):
        a, b = cs[e], cs[(e + 1) % 4]
        for i in range(1, steps):
            t = i / steps
            log(p, a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, baluster_r, z0, z1 - .06, 'brace')
        beam(p, (a[0], a[1], z1 - .02), (b[0], b[1], z1 - .02), .05, .04, 'plank')
        beam(p, (a[0], a[1], (z0 + z1) / 2), (b[0], b[1], (z0 + z1) / 2), .03, .03, 'brace')


def deck(p, size, z0, z1, top='plank', joists=0):
    box(p, 0, 0, z0, size, size, z1 - z0, 'plankDark', top)
    # plank seams on the deck top
    n = max(3, int(size / .12))
    for i in range(1, n):
        x = -size / 2 + size * i / n
        box(p, x, 0, z1, .008, size * .98, .004, 'plankDark')
    # joist ends sticking out under the deck on every side
    for i in range(joists):
        t = -size / 2 + size * (i + .5) / joists
        for sgn in (-1, 1):
            box(p, sgn * (size / 2 + .03), t, z0 - .07, .1, .07, .07, 'beam')
            box(p, t, sgn * (size / 2 + .03), z0 - .07, .07, .1, .07, 'beam')


def x_brace(p, a, b, z0, z1, w=.045):
    beam(p, (a[0], a[1], z0), (b[0], b[1], z1), w, w, 'brace')
    beam(p, (b[0], b[1], z0), (a[0], a[1], z1), w, w, 'brace')


def ladder(p, x, y, z0, z1, axis_y=True, w=.18, rungs=7):
    off = (0, w / 2) if axis_y else (w / 2, 0)
    for sgn in (-1, 1):
        beam(p, (x + off[0] * sgn, y + off[1] * sgn, z0), (x + off[0] * sgn, y + off[1] * sgn, z1), .03, .03, 'ladder')
    for k in range(1, rungs + 1):
        z = z0 + (z1 - z0) * k / (rungs + 1)
        beam(p, (x - off[0], y - off[1], z), (x + off[0], y + off[1], z), .018, .018, 'ladder')


def slit(p, face, along, z, w=.04, h=.16, half=.75):
    """Dark loophole plate on the outside of a square body (face: 'x+', 'x-', 'y+', 'y-')."""
    d = half + .002
    if face[0] == 'x':
        x = d if face[1] == '+' else -d
        box(p, x, along, z, .01, w, h, 'dark')
    else:
        y = d if face[1] == '+' else -d
        box(p, along, y, z, w, .01, h, 'dark')


# ------------------------------------------------------------------ models
def stake(mdl):
    """Unit stake template: 'body' radius 1 U, 0..1 U; 'tipA'/'tipB' 0..1 U point; 'cap' flat end."""
    body = mdl.part('body')
    a = oct_pts(0, 0, S)
    vs = [(x, y, 0) for x, y in a] + [(x, y, S) for x, y in a]
    body.quads(vs, [(i, (i + 1) % 8, 8 + (i + 1) % 8, 8 + i) for i in range(8)], 'log')
    mdl.done('body', body)
    cap = mdl.part('cap')
    cap.quads([(x, y, S) for x, y in a], [tuple(range(8))], 'logEnd')
    mdl.done('cap', cap)
    # tip A: eight even facets; tip B: hewn with four big cuts, the point off-centre
    tip = mdl.part('tipA')
    for i in range(8):
        p0, p1 = a[i], a[(i + 1) % 8]
        tip.quads([(p0[0], p0[1], 0), (p1[0], p1[1], 0), (0, 0, S)], [(0, 1, 2)], 'cut' if i % 2 else 'cutDark')
    mdl.done('tipA', tip)
    tip = mdl.part('tipB')
    apex = (.14 * S, -.1 * S, S)
    for i in range(0, 8, 2):
        p0, p1, p2 = a[i], a[(i + 1) % 8], a[(i + 2) % 8]
        tip.quads([(p0[0], p0[1], 0), (p1[0], p1[1], 0), (p2[0], p2[1], 0), apex], [(0, 1, 2, 3)], 'cut' if i % 4 else 'cutDark')
    mdl.done('tipB', tip)


def watchtower(mdl):
    """drawWatchtowerWood: four legs to the eave, deck 1.34-1.46 U, rail to 1.72 U, hip roof
    2.35 U. Added: two storeys of X braces, girts, an inside ladder to a trapdoor."""
    half, deck0, deck1, eave, apex = .39, 1.34, 1.46, 1.98, 2.35
    frame = mdl.part('frame')
    cs = [(-half, -half), (half, -half), (half, half), (-half, half)]
    for x, y in cs:
        log(frame, x, y, .075, 0, eave, top=None)
        box(frame, x, y, -.02, .2, .2, .05, 'beam')               # sole pad
    for e in range(4):
        a, b = cs[e], cs[(e + 1) % 4]
        x_brace(frame, a, b, .12, .7)
        x_brace(frame, a, b, .74, 1.30)
        for z in (.10, .72, 1.30):
            beam(frame, (a[0], a[1], z), (b[0], b[1], z), .05, .05, 'beam')
    ladder(frame, -.22, -.12, 0, deck1, axis_y=False, w=.16, rungs=8)
    mdl.done('frame', frame)
    dk = mdl.part('deck')
    deck(dk, 1.0, deck0, deck1, joists=3)
    box(dk, -.22, -.22, deck1, .2, .2, .006, 'dark')                # trapdoor
    rail(dk, .5 - .055, deck1, 1.72)
    mdl.done('deck', dk)
    roof = mdl.part('roof')
    box(roof, 0, 0, eave - .05, 1.12, 1.12, .05, 'beam', 'beam')    # wall plate
    hip_roof(roof, .64, eave, apex)
    mdl.done('roof', roof)
    flag(mdl, apex + .1, pole_h=.42, length=.28, height=.16)


def palisade_tower(mdl, roofed):
    """drawMediumWoodTower (1.5 U): closed body of stakes to the deck at 1.72-1.82 U, then a
    pointed parapet (open) or a rail with four posts and a hip roof to 2.95 U (roofed).
    Added: two outer walers, a door, loopholes, joist ends under the deck.
    The body is one part per side (side_yn, side_xp, side_yp, side_xn: stakes, walers, door,
    slits), so the cutaway can leave out the two sides facing the camera; 'floor' and
    'interior' (plank floor, ladder to the deck) only show in cutaway."""
    size, deck0, deck1 = 1.5, 1.72, 1.82
    half = size / 2 - .07
    cs = [(-half, -half), (half, -half), (half, half), (-half, half)]
    names = ['side_yn', 'side_xp', 'side_yp', 'side_xn']            # edge e of cs, outward side
    sides = [mdl.part(n) for n in names]
    seen = set()
    for e in range(4):
        a, b = cs[e], cs[(e + 1) % 4]
        n = max(1, math.ceil(math.hypot(b[0] - a[0], b[1] - a[1]) / .205))
        for i in range(n + 1):
            x, y = a[0] + (b[0] - a[0]) * i / n, a[1] + (b[1] - a[1]) * i / n
            k = (round(x, 3), round(y, 3))
            if k in seen:
                continue
            seen.add(k)
            lean = (rng.uniform(-.008, .008), rng.uniform(-.008, .008))
            log(sides[e], x, y, .09 if (abs(abs(x) - half) < 1e-6 and abs(abs(y) - half) < 1e-6) else .085,
                0, deck0 + rng.uniform(-.02, .0), lean=lean)
    out = half + .1
    for z in (.32, 1.30):                                            # walers
        for e in range(4):
            a, b = cs[e], cs[(e + 1) % 4]
            s = out / half
            beam(sides[e], (a[0] * s, a[1] * s, z), (b[0] * s, b[1] * s, z), .06, .07, 'beam')
    # door on the -x face: dark doorway, a plank leaf ajar, a lintel
    door = sides[3]
    box(door, -out - .002, 0, 0, .012, .34, .62, 'dark')
    box(door, -out - .02, .1, 0, .04, .15, .6, 'door')
    box(door, -out - .01, 0, .62, .06, .46, .07, 'beam')
    for face, e in (('x+', 1), ('y+', 2), ('y-', 0)):
        for along in (-.3, .3):
            slit(sides[e], face, along, 1.02, half=half + .085)
    for n, p in zip(names, sides):
        mdl.done(n, p)
    # Inside, seen only in cutaway: a plank floor and the ladder to a hatch in the deck.
    fl = mdl.part('floor')
    inner = half - .1
    box(fl, 0, 0, 0, inner * 2, inner * 2, .03, 'plankDark', 'plank')
    for i in range(1, 7):
        box(fl, -inner + inner * 2 * i / 7, 0, .03, .008, inner * 2 * .98, .003, 'plankDark')
    mdl.done('floor', fl)
    inside = mdl.part('interior')
    ladder(inside, inner - .1, inner - .12, .03, deck0, axis_y=True, w=.16, rungs=8)
    box(inside, inner - .1, inner - .12, deck0 - .005, .22, .22, .006, 'dark')   # hatch, seen from below
    mdl.done('interior', inside)
    dk = mdl.part('deck')
    deck(dk, size - .10, deck0, deck1, top='plank' if roofed else 'roofDeck', joists=4)
    mdl.done('deck', dk)
    top = mdl.part('top')
    # The open tower's pointed parapet, also under the roof of the roofed one.
    stake_parapet(top, half, half, deck1, 2.03, 2.22)
    if roofed:
        rh, eave, apex = .61, 2.55, 2.95
        for x, y in [(-rh, -rh), (rh, -rh), (rh, rh), (-rh, rh)]:
            log(top, x, y, .055, deck1, eave, top=None)
            # knee braces from the post to the eave plate
            sx, sy = (1 if x > 0 else -1), (1 if y > 0 else -1)
            beam(top, (x, y, eave - .28), (x - sx * .22, y, eave - .04), .035, .035, 'brace')
            beam(top, (x, y, eave - .28), (x, y - sy * .22, eave - .04), .035, .035, 'brace')
        box(top, 0, 0, eave - .05, 1.30, 1.30, .05, 'beam', 'beam')
        hip_roof(top, .85, eave, apex, courses=3)
    else:
        ladder(top, -.3, .3, deck1 - .62, deck1 + .25, axis_y=False, w=.14, rungs=3)
    mdl.done('top', top)
    if roofed:
        flag(mdl, apex + .1)


def cloth(p, pts, key):
    """A thin cloth panel through world points (U), drawn as one quad strip."""
    p.quads([m(*q) for q in pts], [tuple(range(len(pts)))], key)


def flag(mdl, z0, pole_h=.5, length=.34, height=.2):
    """Pole on the roof apex with a waving two-colour heraldic flag (part 'flag')."""
    f = mdl.part('flag')
    log(f, 0, 0, .018, z0, z0 + pole_h, 'pole', top='iron')
    zt = z0 + pole_h - .02
    zm, zb = zt - height / 2, zt - height
    # Four vertical folds along +x, alternating a little in y; top half A, bottom half B.
    xs = [0, length * .3, length * .62, length]
    ys = [0, .025, -.02, .03]
    for k in range(3):
        a, b = (xs[k] + .018, ys[k]), (xs[k + 1] + .018, ys[k + 1])
        cloth(f, [(a[0], a[1], zt), (b[0], b[1], zt - .01 * k), (b[0], b[1], zm - .01 * k), (a[0], a[1], zm)], 'heraldA')
        cloth(f, [(a[0], a[1], zm), (b[0], b[1], zm - .01 * k), (b[0], b[1], zb - .01 * k), (a[0], a[1], zb)], 'heraldB')
    mdl.done('flag', f)


def drapes(mdl, x, ys, top, length=.72, w=.2):
    """Heraldic drapes hung from an iron rod on a facade at local x (part 'banners'):
    field A with a B stripe down the middle, ending in a point."""
    b = mdl.part('banners')
    for y in ys:
        beam(b, (x, y - w / 2 - .03, top), (x, y + w / 2 + .03, top), .02, .02, 'iron')
        bot, tip = top - length, top - length - .1
        cloth(b, [(x, y - w / 2, top), (x, y - w / 6, top), (x, y - w / 6, bot - .033), (x, y - w / 2, bot)], 'heraldA')
        cloth(b, [(x, y + w / 6, top), (x, y + w / 2, top), (x, y + w / 2, bot), (x, y + w / 6, bot - .033)], 'heraldA')
        cloth(b, [(x, y - w / 6, top), (x, y + w / 6, top), (x, y + w / 6, bot - .033), (x, y, tip), (x, y - w / 6, bot - .033)], 'heraldB')
        cloth(b, [(x, y - w / 2, bot), (x, y - w / 6, bot - .033), (x, y, tip)], 'heraldA')
        cloth(b, [(x, y + w / 6, bot - .033), (x, y + w / 2, bot), (x, y, tip)], 'heraldA')
    mdl.done('banners', b)


def stake_parapet(p, hx, hy, z0, body, tip, r=.072, step=.245):
    """Pointed stakes around a hx x hy deck edge (open palisade tower), tied by an inner rail."""
    cs = [(-hx, -hy), (hx, -hy), (hx, hy), (-hx, hy)]
    seen = set()
    for e in range(4):
        a, b = cs[e], cs[(e + 1) % 4]
        n = max(1, math.ceil(math.hypot(b[0] - a[0], b[1] - a[1]) / step))
        for i in range(n + 1):
            x, y = a[0] + (b[0] - a[0]) * i / n, a[1] + (b[1] - a[1]) * i / n
            k = (round(x, 3), round(y, 3))
            if k in seen:
                continue
            seen.add(k)
            pointed(p, x, y, r, z0, body + rng.uniform(-.015, .015), tip + rng.uniform(-.02, .02))
    for e in range(4):
        a, b = cs[e], cs[(e + 1) % 4]
        sx, sy = (hx - .1) / hx, (hy - .1) / hy
        beam(p, (a[0] * sx, a[1] * sy, body - .05), (b[0] * sx, b[1] * sy, body - .05), .04, .05, 'beam')


def wood_gate(mdl):
    """drawWoodGate (w 1 U along the passage x, h 1.5 U across): two piers of posts at
    y = +-0.66, jambs, a fighting deck 1.48-1.62 U with the palisade towers' pointed parapet
    to ~1.94 U, lintels and knee braces at the mouths. The door leaves are not part of the
    model: ConquerGates (settlement-gate-fittings.js) hangs the stone gate's leaves in the
    +x mouth, so they swing open and show the siege damage like every other gate."""
    w, h, body_top, roof_top = 1.0, 1.5, 1.48, 1.62
    half_x, half_y = w / 2, h / 2
    side_y, step = half_y - .09, .205
    frame = mdl.part('frame')
    usable = max(.2, w - .16)
    n = max(1, math.ceil(usable / step))
    for sy in (-side_y, side_y):
        for i in range(n + 1):
            x = -usable / 2 + usable * i / n
            log(frame, x, sy, .075, 0, body_top, top=None, lean=(0, rng.uniform(-.006, .006)))
        beam(frame, (-usable / 2 - .05, sy * 1.08, .35), (usable / 2 + .05, sy * 1.08, .35), .05, .06, 'beam')
        beam(frame, (-usable / 2 - .05, sy * 1.08, 1.12), (usable / 2 + .05, sy * 1.08, 1.12), .05, .06, 'beam')
    jamb_y = min(.52, half_y - .22)
    for x in (-half_x + .08, half_x - .08):
        for y in (-jamb_y, jamb_y):
            log(frame, x, y, .09, 0, body_top, top=None)
            sy = 1 if y > 0 else -1
            beam(frame, (x, y, 1.0), (x, y - sy * .2, 1.17), .04, .04, 'brace')   # knee brace to the lintel
    for x in (-half_x + .035, half_x - .035):
        box(frame, x, 0, 1.18, .10, h - .10, .14, 'beam')
    mdl.done('frame', frame)
    dk = mdl.part('deck')
    box(dk, 0, 0, body_top, w + .06, h + .06, roof_top - body_top, 'plankDark', 'roofDeck')
    for i in range(1, 8):
        x = -(w + .06) / 2 + (w + .06) * i / 8
        box(dk, x, 0, roof_top, .008, h, .004, 'plankDark')
    stake_parapet(dk, half_x - .01, half_y - .01, roof_top, 1.80, 1.96, r=.066)
    mdl.done('deck', dk)
    # Two heraldic drapes flanking the door on the outer (+x) front, under the fighting deck.
    drapes(mdl, half_x + .045, (-.62, .62), body_top - .05)


# Timber longhouse: a ground-floor-only built section (W1 1 U wide, W2 2 U wide) of any length.
LONGHOUSE = {'longhouse_w1': (1.0, .62, 1.45), 'longhouse_w2': (2.0, .72, 1.75)}   # width, wall top, ridge (U)


def slab(p, quad, t, key, under='beam'):
    """Thin roof slab: top face through four points (U), extruded t down; edges and underside 'under'."""
    top = [m(*q) for q in quad]
    bot = [(x, y, z - t * S) for x, y, z in top]
    vs = top + bot
    p.quads(vs, [(0, 1, 2, 3)], key)
    p.quads(vs, [(7, 6, 5, 4), (0, 4, 5, 1), (1, 5, 6, 2), (2, 6, 7, 3), (3, 7, 4, 0)], under)


# Longhouse covers (BC-251105-09): the game picks one set of parts per section (s.roofCover).
# over = eave overhang beyond the wall (U), t = thickness, lip = lap of each course over the one below.
LONGHOUSE_COVERS = {
    'shingle': dict(courses=4, t=.03, lip=.025, over=.10, keys=('roofShingleDark', 'roofShingle'), under='beam'),
    'thatch':  dict(courses=3, t=.085, lip=.05, over=.14, keys=('roofThatchDark', 'roofThatch'), under='roofThatchDark'),
    'turf':    dict(courses=1, t=.06, lip=0, over=.12, keys=('roofTurf', 'roofTurf'), under='plankDark'),
}


def longhouse_cover(mdl, v, cv, hw, wall_h, ridge, slope, roof_z):
    """One roof cover over the 1 U bay ('roof_yn.v', 'roof_yp.v', 'ridge.v'), the overhang past
    each gable ('verge_a.v', 'verge_b.v': slab, barge boards, crossed carved boards) and the
    smoke hole of the hearth ('smoke.v'), a hooded louvre on the ridge the game sets on one bay."""
    t, over, keys = cv['t'], cv['over'], cv['keys']
    eave_y, eave_z = hw + over, wall_h - over * slope
    lift = t                                              # the slab's underside sits on the rafters
    for sgn, name in ((-1, 'roof_yn'), (1, 'roof_yp')):
        r = mdl.part(name + '.' + v)
        n = cv['courses']
        for k in range(n):
            t0, t1 = k / n, (k + 1) / n
            y0, y1 = sgn * (eave_y - eave_y * t0), sgn * (eave_y - eave_y * t1)
            z0, z1 = eave_z + (ridge - eave_z) * t0, eave_z + (ridge - eave_z) * t1
            lip = cv['lip'] if k else 0
            q = [(0, y0 + sgn * lip * .3, z0 + lift - lip), (1, y0 + sgn * lip * .3, z0 + lift - lip), (1, y1, z1 + lift), (0, y1, z1 + lift)]
            slab(r, q if sgn > 0 else q[::-1], t, keys[k % 2], cv['under'])
        if v == 'turf':      # turf-retaining log along the eave, birch-bark deck edge under it
            log_y = sgn * (eave_y - .03)
            beam(r, (0, log_y, eave_z + lift + .02), (1, log_y, eave_z + lift + .02), .07, .07, 'log')
            beam(r, (0, sgn * eave_y, eave_z - .01), (1, sgn * eave_y, eave_z - .01), .03, .04, 'cut')
        elif v == 'thatch':  # thatch cut square at the eave: a darker band of butt ends
            beam(r, (0, sgn * (eave_y - .01), eave_z + lift * .45), (1, sgn * (eave_y - .01), eave_z + lift * .45), .05, lift * .9, 'roofThatchRidge')
        else:
            beam(r, (0, sgn * eave_y, eave_z - .015), (1, sgn * eave_y, eave_z - .015), .04, .05, 'beam')   # eave board
        mdl.done(name + '.' + v, r)
    rd = mdl.part('ridge.' + v)
    top = ridge + lift
    if v == 'thatch':        # thick ridge roll, bound with two hazel rods
        beam(rd, (0, 0, top - .02), (1, 0, top - .02), .24, .1, 'roofThatchRidge')
        for y in (-.09, .09):
            beam(rd, (0, y, top + .025), (1, y, top + .025), .02, .02, 'beam')
        crest = top + .08
    elif v == 'turf':        # grass crest over the ridge board
        beam(rd, (0, 0, top + .01), (1, 0, top + .01), .16, .07, 'roofTurfDark')
        crest = top + .05
    else:
        beam(rd, (0, 0, ridge + .05), (1, 0, ridge + .05), .1, .07, 'roofRidge')
        crest = ridge + .09
    mdl.done('ridge.' + v, rd)
    for out, name in ((-1, 'verge_a'), (1, 'verge_b')):
        e = mdl.part(name + '.' + v)
        ox = out * (.16 + (over - .1) * .5)
        for sgn in (-1, 1):
            q = [(0, sgn * eave_y, eave_z + lift), (ox, sgn * eave_y, eave_z + lift), (ox, 0, ridge + lift), (0, 0, ridge + lift)]
            slab(e, q if (sgn > 0) == (out > 0) else q[::-1], t, keys[0], cv['under'])
            beam(e, (ox, sgn * eave_y, eave_z + lift - t - .005), (ox, 0, ridge + lift - t), .03, .07, 'beam')
            # crossed carved boards over the ridge (the barge boards running on past each other),
            # at the same height on every cover so the section keeps its structureHeight
            dz = 0
            beam(e, (ox + out * .01, sgn * hw * .55, roof_z(hw * .45) + .06 + dz), (ox + out * .01, -sgn * .2, ridge + .2 + .16 * slope * .2 + dz), .03, .06, 'beam')
            box(e, ox + out * .01, -sgn * .23, ridge + .23 + dz, .035, .07, .09, 'cut')   # carved head
        if v == 'thatch':
            beam(e, (0, 0, top - .02), (ox, 0, top - .02), .24, .1, 'roofThatchRidge')
        elif v == 'turf':
            beam(e, (0, 0, top + .01), (ox, 0, top + .01), .16, .07, 'roofTurfDark')
        else:
            beam(e, (0, 0, ridge + .05), (ox, 0, ridge + .05), .1, .07, 'roofRidge')
        mdl.done(name + '.' + v, e)
    # Smoke hole over the hearth: a dark opening in the ridge under a small raised hood.
    sm = mdl.part('smoke.' + v)
    x0, x1, hy, hz = .32, .68, .19, crest + .1
    box(sm, .5, 0, crest - .09, x1 - x0, .26, .1, 'dark')
    for x in (x0, x1):
        for y in (-.1, .1):
            log(sm, x, y, .018, crest - .04, hz - .02, 'beam', top=None)
    for sgn in (-1, 1):
        q = [(x0 - .03, sgn * hy, hz - .07), (x1 + .03, sgn * hy, hz - .07), (x1 + .03, 0, hz), (x0 - .03, 0, hz)]
        slab(sm, q if sgn > 0 else q[::-1], .025, keys[1] if v != 'turf' else 'plank', 'beam')
    mdl.done('smoke.' + v, sm)


def longhouse(mdl, width, wall_h, ridge):
    """Longhouse in structure-local space: a repeatable 1 U bay (x 0..1) the game lays along a->b,
    and two gable ends at x = 0 (end_a faces -x and holds the door, end_b faces +x and is moved
    to b). Vertical plank walls on a sill, raking outer props, a steep shingle roof with an eave
    overhang, crossed carved boards over each gable. Parts per side (wall_yn / wall_yp,
    roof_yn / roof_yp, end_a / end_b) let the cutaway leave out the ones facing the camera;
    'floor' only shows in cutaway."""
    hw = width / 2 - .06                                 # wall line
    slope = (ridge - wall_h) / hw
    roof_z = lambda y: wall_h + slope * (hw - abs(y))   # underside of the roof over the wall line
    planks = 9
    for sgn, name in ((-1, 'wall_yn'), (1, 'wall_yp')):
        w = mdl.part(name)
        y = sgn * hw
        box(w, .5, y, 0, 1.0, .09, .08, 'beam')                       # sill
        for i in range(planks):
            x = (i + .5) / planks
            box(w, x, y, .06, 1 / planks - .008, .05, wall_h - .1, 'plank' if i % 2 else 'plankDark')
        box(w, .5, y, wall_h - .06, 1.0, .09, .07, 'beam', 'beam')     # wall plate
        log(w, 0, y, .05, 0, wall_h, top=None)                         # bay post
        beam(w, (.5, y + sgn * .12, 0), (.5, y + sgn * .03, wall_h * .78), .055, .055, 'log')   # raking prop
        mdl.done(name, w)
    for v, cv in LONGHOUSE_COVERS.items():
        longhouse_cover(mdl, v, cv, hw, wall_h, ridge, slope, roof_z)
    fl = mdl.part('floor')
    box(fl, .5, 0, 0, 1.0, hw * 2 - .06, .03, 'plankDark', 'plank')
    for i in range(1, 6):
        box(fl, .5, -hw + hw * 2 * i / 6, .03, 1.0, .008, .003, 'plankDark')
    mdl.done('floor', fl)
    for out, name in ((-1, 'end_a'), (1, 'end_b')):
        e = mdl.part(name)
        x = out * .025
        n = max(5, round(hw * 2 / .11))
        for i in range(n):                                             # gable planks up to the roof
            ya, yb = -hw + hw * 2 * i / n + .004, -hw + hw * 2 * (i + 1) / n - .004
            top = [(ya, roof_z(ya)), (yb, roof_z(yb))]
            if ya < 0 < yb:
                top.insert(1, (0, ridge))
            pts = [(ya, .06)] + top + [(yb, .06)]
            vs = [(x * S - .025 * S, py * S, pz * S) for py, pz in pts] + [(x * S + .025 * S, py * S, pz * S) for py, pz in pts]
            k = len(pts)
            e.quads(vs, [tuple(range(k))[::-1], tuple(range(k, 2 * k))], 'plank' if i % 2 else 'plankDark')
            e.quads(vs, [(j, (j + 1) % k, k + (j + 1) % k, k + j) for j in range(k)], 'plankDark')
        box(e, 0, 0, 0, .09, hw * 2 + .09, .08, 'beam')                # sill
        for y in (-hw, hw):
            log(e, 0, y, .065, 0, wall_h, top=None)                    # corner posts
        box(e, 0, 0, wall_h - .06, .09, hw * 2 + .09, .07, 'beam', 'beam')   # tie beam
        if out < 0:                                                  # door, lintel and a step stone
            dw = min(.42, hw * .7)
            box(e, x - .03, 0, .08, .012, dw, .5, 'dark')
            box(e, x - .045, dw * .22, .08, .03, dw * .5, .48, 'door')
            box(e, x - .04, 0, .58, .07, dw + .16, .07, 'beam')
            for y in (-dw / 2 - .03, dw / 2 + .03):
                box(e, x - .035, y, .08, .05, .05, .5, 'beam')
            box(e, x - .12, 0, -.02, .16, dw + .1, .05, 'logEnd')
        else:                                                          # shuttered gable window
            box(e, x + .03, 0, wall_h + .1, .012, .2, .16, 'dark')
            box(e, x + .04, -.15, wall_h + .1, .02, .09, .16, 'door')
        mdl.done(name, e)


BUILD = [('stake', stake), ('watchtower', watchtower),
         ('palisadeTower_open', lambda m_: palisade_tower(m_, False)),
         ('palisadeTower_roofed', lambda m_: palisade_tower(m_, True)),
         ('woodGate', wood_gate)] + \
        [(k, (lambda v: lambda m_: longhouse(m_, *v))(v)) for k, v in LONGHOUSE.items()]


def main(out_path):
    root = fresh_collection(COLL_NAME)
    data = {'palette': list(COLORS.values()), 'paletteKeys': KEYS, 'models': {}}
    total, stats = 0, {}
    for i, (name, fn) in enumerate(BUILD):
        mdl = Model(root, name, (i * 12, 0, 0))
        rng.seed(sum(map(ord, name)))
        fn(mdl)
        parts = {k: export_part_indexed(p, KEYS) for k, p in mdl.parts.items()}
        n = sum(len(p['c']) for p in parts.values())
        stats[name] = n
        total += n
        data['models'][name] = {'parts': parts}
    js = ("'use strict';\n// Generated by tools/blender/build_wood_fort.py — do not edit by hand.\n"
          "// Timber fortifications in structure-local space (U): +x along the angle, +z up.\n"
          "// Parts: p = vertex xyz, i = 3 indices per triangle, c = palette index per triangle.\n"
          "window.ConquerWoodFortModels=" + json.dumps(data, separators=(',', ':')) + ";\n")
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, 'w', encoding='utf-8', newline='\n') as f:
        f.write(js)
    print(f"wood fort models: {len(stats)} models, {total} triangles, {len(js) // 1024} KB -> {out_path}")
    print(json.dumps(stats))
    return {'total': total, 'kb': len(js) // 1024, 'models': stats}


if __name__ == '__main__' and '--' in sys.argv:
    args = sys.argv[sys.argv.index('--') + 1:]
    main(args[args.index('--out') + 1])
elif 'WOOD_OUT' in globals():
    WOOD_RESULT = main(WOOD_OUT)
