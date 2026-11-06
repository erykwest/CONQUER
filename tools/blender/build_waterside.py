"""CONQUER waterside kit (Blender 4.x/5.x): low-poly, flat-coloured, in metres.
  riverJetty   molo fluviale: a timber staging along the river bank (4U long, 1U over the water)
               on piles, with two boat slots on the water side (bollards, fenders) and a ladder
  rocksA/B/C   scogli: clusters of sea rocks for headlands, wet and weeded at the waterline
  reef         a low flat spread of rocks just awash, for the foot of a rocky shore
  beachBoat    a rowing boat drawn up on the sand, keel up, with its oars
  driftwood    bleached logs and a tangle of weed on the beach

Model frame: origin on the bank / waterline, +X out over the water, +Y left, +Z up.
The jetty deck is at z = DECK_Z (above the waterline z = 0), its landing step on land at -X.
Headless:
    blender --background --factory-startup --python tools/blender/build_waterside.py -- --out src/assets/waterside-models.js
"""
import json, math, os, sys, importlib, random
from mathutils import Vector, Matrix
_here = os.path.dirname(os.path.abspath(__file__)) if '__file__' in globals() else CQ_DIR
if _here not in sys.path:
    sys.path.insert(0, _here)
import cq_blender
importlib.reload(cq_blender)
from cq_blender import Part, fresh_collection, export_part_indexed, METERS_PER_U

COLORS = {
    'plank': '#9b7044', 'plankLight': '#ab7f50', 'beam': '#5b3b22', 'pile': '#4a3322', 'wet': '#2f3a33',
    'post': '#6f4a2b', 'rope': '#c8b48a',
    'rock': '#8a857b', 'rockLight': '#a39d91', 'rockDark': '#6a665e', 'weed': '#3f5a3a', 'weedDark': '#2c4029',
    'boat': '#8f6439', 'boatDark': '#5f3f22', 'oar': '#b98652', 'drift': '#c9bda6', 'driftDark': '#a59a84',
}
KEYS = list(COLORS.keys())
COLL_NAME = 'CONQUER_Waterside'
U = METERS_PER_U
DECK_Z = .9
rng = random.Random(9)


class Model:
    def __init__(self, root, name, offset):
        self.root, self.name, self.offset, self.parts, self.meta = root, name, offset, {}, {}

    def part(self, key):
        return Part(self.root, key, COLORS, self.offset, prefix=self.name + '_')

    def done(self, key, p):
        self.parts[key] = p.finish()


def pole(p, a, b, r, key='pile', end='post', n=6):
    a, b = Vector(a), Vector(b)
    x, y, z, length = p.frame(a, b)
    mid, rot = (a + b) / 2, Matrix((x, y, z)).transposed()
    ring = lambda s: [mid + rot @ Vector((s, math.cos(2 * math.pi * i / n) * r, math.sin(2 * math.pi * i / n) * r)) for i in range(n)]
    vs = ring(-length / 2) + ring(length / 2)
    p.quads(vs, [(i, (i + 1) % n, n + (i + 1) % n, n + i) for i in range(n)], key)
    p.quads(vs, [tuple(range(n - 1, -1, -1))], end)
    p.quads(vs, [tuple(range(n, 2 * n))], end)


def river_jetty(m):
    """Molo fluviale: a timber staging along the bank (x along the bank, +y out over the water),
    4U long and 1U deep, on piles, with a step up from the bank and two boat slots on the water
    side, each with a pair of bollards and a fender. meta: berths (slot centres, in U)."""
    L, D, back = 4 * U, 1 * U, .5
    m.meta.update({'length': 4, 'depth': 1, 'deck': DECK_Z / U,
                   'berths': [[-L / 4 / U, (D + 1.0) / U], [L / 4 / U, (D + 1.0) / U]]})
    p = m.part('deck')
    plank, x, i = .3, -L / 2, 0
    while x < L / 2 - .01:
        p.box((x + plank / 2, (D - back) / 2, DECK_Z - .03), (plank - .03, D + back, .06), 'plankLight' if i % 3 == 1 else 'plank')
        x += plank; i += 1
    for y in (-back + .15, D / 2, D - .15):
        p.box((0, y, DECK_Z - .14), (L, .14, .12), 'beam')
    m.done('deck', p)
    p = m.part('piles')
    xs = [-L / 2 + .15 + k * (L - .3) / 4 for k in range(5)]
    for x in xs:
        for y in (.15, D - .12):
            pole(p, (x, y, -1.4), (x, y, DECK_Z + .12), .11)
            p.cylinder(.13, .2, 'wet', n=6, axis='z', center=(x, y, 0))
        p.box((x, (D - back) / 2, DECK_Z - .24), (.12, D + back, .1), 'beam')
    for x in (-L / 2 - .3, L / 2 + .3):                                                         # bank ends
        p.box((x, (-back + .4) / 2, DECK_Z * .45), (.6, back + .4, DECK_Z * .9), 'beam')
    m.done('piles', p)
    p = m.part('fittings')
    for bx in (-L / 4, L / 4):                                                                   # two boat slots
        for dx in (-.9, .9):
            pole(p, (bx + dx, D - .15, DECK_Z), (bx + dx, D - .15, DECK_Z + .45), .1, 'post', 'pile')
            p.ring(.14, .09, .05, 'rope', n=8, axis='z', center=(bx + dx, D - .15, DECK_Z + .3))
        p.box((bx, D + .04, DECK_Z - .35), (1.2, .08, .35), 'post')                              # fender plank
    for k in range(3):                                                                           # ladder between the slots
        p.box((0, D + .06, DECK_Z - .25 - k * .3), (.5, .05, .05), 'post')
    for x in (-.25, .25):
        p.box((x, D + .06, DECK_Z - .55), (.05, .05, 1.1), 'post')
    m.done('fittings', p)

def rock(p, c, r, h, n=7, seed=0, top=.55):
    """Irregular rock: a jittered ring at the foot, a narrower one at the top, a cap; the base
    below the waterline is dark and wet, a weed band at z~0."""
    rr = random.Random(seed)
    base, mid, cap = [], [], []
    for i in range(n):
        a = 2 * math.pi * i / n + rr.uniform(-.2, .2)
        k = r * rr.uniform(.8, 1.15)
        base.append((c[0] + math.cos(a) * k * 1.05, c[1] + math.sin(a) * k * 1.05, c[2] - .6))
        mid.append((c[0] + math.cos(a) * k, c[1] + math.sin(a) * k, c[2] + .12))
        cap.append((c[0] + math.cos(a) * k * top, c[1] + math.sin(a) * k * top, c[2] + h * rr.uniform(.85, 1.1)))
    vs = base + mid + cap
    for i in range(n):
        j = (i + 1) % n
        p.quads(vs, [(i, j, n + j, n + i)], 'weedDark' if i % 2 else 'weed')
        p.quads(vs, [(n + i, n + j, 2 * n + j, 2 * n + i)], 'rockLight' if i % 3 == 0 else ('rockDark' if i % 3 == 1 else 'rock'))
    p.quads(vs, [tuple(range(2 * n, 3 * n))], 'rockLight')


def rocks_a(m):
    p = m.part('rocks')
    rock(p, (0, 0, 0), 1.6, 2.2, seed=1)
    rock(p, (1.7, .9, 0), 1.0, 1.2, seed=2)
    rock(p, (-1.4, 1.2, 0), .8, .9, seed=3)
    rock(p, (.6, -1.6, 0), .7, .6, seed=4)
    m.done('rocks', p)


def rocks_b(m):
    p = m.part('rocks')
    rock(p, (0, 0, 0), 2.2, 1.4, n=8, seed=5, top=.7)
    rock(p, (2.3, -.6, 0), 1.2, 2.0, seed=6)
    rock(p, (-2.2, -.4, 0), .9, .7, seed=7)
    m.done('rocks', p)


def rocks_c(m):
    p = m.part('rocks')
    rock(p, (0, 0, 0), 1.0, 2.8, seed=8, top=.4)
    rock(p, (1.2, -.4, 0), .7, 1.1, seed=9)
    m.done('rocks', p)


def reef(m):
    p = m.part('rocks')
    for i in range(9):
        a = i * 2.4
        rock(p, (math.cos(a) * (1 + i * .35), math.sin(a) * (1 + i * .3), -.05), rng.uniform(.4, .9), rng.uniform(.15, .35), n=6, seed=20 + i, top=.75)
    m.done('rocks', p)


def beach_boat(m):
    """Keel-up rowing boat on the sand, propped on a log; its oars lying beside it."""
    p = m.part('boat')
    L, B, H, n = 4.4, 1.5, .55, 8
    rings = []
    for i in range(n + 1):
        t = -1 + 2 * i / n
        w = B / 2 * max(.05, 1 - abs(t) ** 2.4)
        hz = H * (1 - .25 * t * t)
        rings.append([(t * L / 2, -w, .25), (t * L / 2, -w * .7, .25 + hz * .8), (t * L / 2, 0, .25 + hz), (t * L / 2, w * .7, .25 + hz * .8), (t * L / 2, w, .25)])
    for i in range(n):
        for k in range(4):
            a, b, c, d = rings[i][k], rings[i + 1][k], rings[i + 1][k + 1], rings[i][k + 1]
            p.quads([a, b, c, d], [(0, 1, 2, 3)], 'boatDark' if k in (1, 2) and i % 2 else 'boat')
    p.cylinder(.14, 1.8, 'driftDark', n=6, axis='y', center=(.4, 0, .12))
    for s in (-1, 1):
        p.beam((-1.6, s * 1.05, .05), (1.7, s * 1.15, .05), .07, .07, 'oar')
        p.box((1.9, s * 1.16, .05), (.5, .16, .04), 'oar')
    m.done('boat', p)


def driftwood(m):
    p = m.part('wood')
    for (a, b, r) in (((-1.6, -.3, .1), (1.5, .4, .12), .13), ((-.5, .9, .08), (1.1, 1.3, .08), .09), ((.3, -1.0, .07), (1.4, -.6, .07), .08)):
        pole(p, a, b, r, key='drift', end='driftDark')
    for i in range(6):
        p.box((-1.0 + i * .45, -.15 + (i % 2) * .5, .03), (.4, .3, .05), 'weed' if i % 2 else 'weedDark')
    m.done('wood', p)


MODELS = [('riverJetty', river_jetty), ('rocksA', rocks_a), ('rocksB', rocks_b), ('rocksC', rocks_c),
          ('reef', reef), ('beachBoat', beach_boat), ('driftwood', driftwood)]
LAYOUT = {'riverJetty': (0, 0), 'rocksA': (20, 0), 'rocksB': (30, 0), 'rocksC': (40, 0),
          'reef': (50, 0), 'beachBoat': (20, 12), 'driftwood': (30, 12)}


def main(out_path):
    root = fresh_collection(COLL_NAME)
    data = {'palette': list(COLORS.values()), 'paletteKeys': KEYS, 'metersPerU': METERS_PER_U, 'models': {}}
    stats = {}
    for name, fn in MODELS:
        m = Model(root, name, (*LAYOUT[name], 0))
        rng.seed(sum(map(ord, name)))
        fn(m)
        parts = {k: export_part_indexed(p, KEYS) for k, p in m.parts.items()}
        stats[name] = sum(len(p['c']) for p in parts.values())
        data['models'][name] = {'parts': parts, 'meta': m.meta}
    js = ("'use strict';\n// Generated by tools/blender/build_waterside.py — do not edit by hand.\n"
          "// Waterside kit in model space (U): +x out over the water, origin on the bank, z = 0 waterline.\n"
          "// Parts: p = vertex xyz, i = 3 indices per triangle, c = palette index per triangle.\n"
          "window.ConquerWatersideModels=" + json.dumps(data, separators=(',', ':')) + ";\n")
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, 'w', encoding='utf-8', newline='\n') as f:
        f.write(js)
    print(f"waterside models: {stats}, {len(js) // 1024} KB -> {out_path}")


if __name__ == '__main__' and '--' in sys.argv:
    args = sys.argv[sys.argv.index('--') + 1:]
    main(args[args.index('--out') + 1] if '--out' in args else os.path.join(_here, '..', '..', 'src', 'assets', 'waterside-models.js'))
