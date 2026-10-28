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
    'plank': '#8b6845', 'plankDark': '#6e5136', 'beam': '#5a3e28', 'brace': '#68472e',
    'ladder': '#9a7550', 'door': '#4f3220', 'doorPlank': '#5f3e27', 'iron': '#3b3936',
    'rope': '#a88d62', 'dark': '#1e1712',
    # winter: white
    'roofShingle': '#5a3d2e', 'roofShingleDark': '#4d3427', 'roofRidge': '#3f2b20', 'roofDeck': '#8b6845',
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


def hip_roof(p, half, eave, apex, keys=('roofShingle', 'roofShingleDark'), courses=3, lip=.045, drop=.05):
    """Hip roof over a square of half-side `half` (U): shingle courses that each start a
    little wider and lower than the top of the course below (a visible step), hip ridges
    and a short finial. Faces alternate the two roof tones like drawWoodHipRoof."""
    zs = [eave + (apex - eave) * k / courses for k in range(courses + 1)]
    hs = [half * (1 - k / courses) for k in range(courses + 1)]
    for k in range(courses):
        bh, bz = hs[k] + (lip if k else 0), zs[k] - (drop if k else 0)
        ring = [(x * S, y * S, bz * S) for x, y in rect(0, 0, bh * 2, bh * 2)]
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


def palisade_tower(mdl, roofed):
    """drawMediumWoodTower (1.5 U): closed body of stakes to the deck at 1.72-1.82 U, then a
    pointed parapet (open) or a rail with four posts and a hip roof to 2.95 U (roofed).
    Added: two outer walers, a door, loopholes, joist ends under the deck."""
    size, deck0, deck1 = 1.5, 1.72, 1.82
    half = size / 2 - .07
    cs = [(-half, -half), (half, -half), (half, half), (-half, half)]
    body = mdl.part('body')
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
            log(body, x, y, .09 if (abs(abs(x) - half) < 1e-6 and abs(abs(y) - half) < 1e-6) else .085,
                0, deck0 + rng.uniform(-.02, .0), lean=lean)
    out = half + .1
    for z in (.32, 1.30):                                            # walers
        for e in range(4):
            a, b = cs[e], cs[(e + 1) % 4]
            s = out / half
            beam(body, (a[0] * s, a[1] * s, z), (b[0] * s, b[1] * s, z), .06, .07, 'beam')
    # door on the -x face: dark doorway, a plank leaf ajar, a lintel
    box(body, -out - .002, 0, 0, .012, .34, .62, 'dark')
    box(body, -out - .02, .1, 0, .04, .15, .6, 'door')
    box(body, -out - .01, 0, .62, .06, .46, .07, 'beam')
    for face in ('x+', 'y+', 'y-'):
        for along in (-.3, .3):
            slit(body, face, along, 1.02, half=half + .085)
    mdl.done('body', body)
    dk = mdl.part('deck')
    deck(dk, size - .10, deck0, deck1, top='plank' if roofed else 'roofDeck', joists=4)
    mdl.done('deck', dk)
    top = mdl.part('top')
    if roofed:
        rail(top, (size - .08) / 2 - .055, deck1, 2.02)
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
        seen = set()
        for e in range(4):
            a, b = cs[e], cs[(e + 1) % 4]
            n = max(1, math.ceil(math.hypot(b[0] - a[0], b[1] - a[1]) / .245))
            for i in range(n + 1):
                x, y = a[0] + (b[0] - a[0]) * i / n, a[1] + (b[1] - a[1]) * i / n
                k = (round(x, 3), round(y, 3))
                if k in seen:
                    continue
                seen.add(k)
                pointed(top, x, y, .072, deck1, 2.03 + rng.uniform(-.015, .015), 2.22 + rng.uniform(-.02, .02))
        for e in range(4):                                           # inner rail tying the parapet
            a, b = cs[e], cs[(e + 1) % 4]
            s = (half - .1) / half
            beam(top, (a[0] * s, a[1] * s, 1.98), (b[0] * s, b[1] * s, 1.98), .04, .05, 'beam')
        ladder(top, -.3, .3, deck1 - .62, deck1 + .25, axis_y=False, w=.14, rungs=3)
    mdl.done('top', top)


def wood_gate(mdl):
    """drawWoodGate (w 1 U along the passage x, h 1.5 U across): two piers of posts at
    y = +-0.66, jambs, a fighting deck 1.48-1.62 U, lintels and merlons to 1.94 U, a double
    door on the +x mouth. Added: knee braces at the mouths, a bar bracket, plank merlons."""
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
    hx, hy = half_x + .015, half_y + .015
    items = [(x, y, .18, .16) for x in (-hx, hx) for y in (-hy, hy)]
    items += [(x, y, .18, .16) for y in (-hy, hy) for x in (-hx * .34, hx * .34)]
    items += [(x, 0, .16, .18) for x in (-hx, hx)]
    for x, y, mw, md in items:
        box(dk, x, y, roof_top, mw, md, .32, 'log', 'roofDeck')
        # plank seams on the merlon face
        box(dk, x, y, roof_top + .02, mw * .1, md + .006, .28, 'plankDark')
    mdl.done('deck', dk)
    door = mdl.part('door')
    door_half = min(.34, h * .32)
    x = half_x + .012
    for sgn in (-1, 1):
        box(door, x, sgn * door_half / 2, .035, .04, door_half - .01, 1.045, 'door')
        for k in range(1, 3):
            y = sgn * door_half * k / 3
            box(door, x + .021, y, .06, .004, .012, .99, 'doorPlank')
        for z in (.34, .78):
            box(door, x + .024, sgn * door_half / 2, z, .008, door_half - .07, .045, 'iron')
        box(door, x + .028, sgn * .06, .55, .012, .03, .03, 'iron')            # ring handle
    box(door, x + .002, 0, .035, .046, .012, 1.045, 'dark')                      # meeting seam
    box(door, x - .01, 0, 1.08, .06, door_half * 2 + .1, .1, 'beam')            # head beam
    mdl.done('door', door)


BUILD = [('stake', stake), ('watchtower', watchtower),
         ('palisadeTower_open', lambda m_: palisade_tower(m_, False)),
         ('palisadeTower_roofed', lambda m_: palisade_tower(m_, True)),
         ('woodGate', wood_gate)]


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
