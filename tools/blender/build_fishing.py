"""CONQUER fisherman's lot kit (Blender 4.x/5.x): low-poly, flat-coloured props in metres.
  netRack     two forked poles and a ridge pole with a fishing net hung out to dry, floats
  fishRack    drying frame with rows of split fish hanging from the rails
  fishBaskets wicker baskets with the catch, an oar pair and a coiled line

Free-standing, centred on their footprint. Placed on the lots of fishermen's households
(src/settlement-fishers.js).
Headless:
    blender --background --factory-startup --python tools/blender/build_fishing.py -- --out src/assets/fishing-models.js
Axes: +X front, +Y left, +Z up; origin on the ground.
"""
import json, math, os, sys, importlib, random
from mathutils import Vector
_here = os.path.dirname(os.path.abspath(__file__)) if '__file__' in globals() else CQ_DIR
if _here not in sys.path:
    sys.path.insert(0, _here)
import cq_blender
importlib.reload(cq_blender)
from cq_blender import Part, fresh_collection, export_part_indexed, METERS_PER_U

COLORS = {
    'pole': '#8b6a45', 'poleEnd': '#d0ae72', 'wood': '#9a6a3f', 'woodDark': '#6f4a2b',
    'net': '#7c7660', 'netDark': '#5c5846', 'float': '#d8c38e', 'rope': '#c8b48a',
    'fish': '#b9b7ad', 'fishBelly': '#e0d6c2', 'fishDry': '#a98a5e',
    'wicker': '#b4904f', 'wickerDark': '#8a6a35', 'oar': '#b98652',
}
KEYS = list(COLORS.keys())
COLL_NAME = 'CONQUER_Fishing'
rng = random.Random(5)


class Model:
    def __init__(self, root, name, offset):
        self.root, self.name, self.offset, self.parts = root, name, offset, {}

    def part(self, key):
        return Part(self.root, key, COLORS, self.offset, prefix=self.name + '_')

    def done(self, key, p):
        self.parts[key] = p.finish()


def pole(p, a, b, r, key='pole', end='poleEnd', n=5):
    a, b = Vector(a), Vector(b)
    x, y, z, length = p.frame(a, b)
    from mathutils import Matrix
    mid, rot = (a + b) / 2, Matrix((x, y, z)).transposed()
    ring = lambda s: [mid + rot @ Vector((s, math.cos(2 * math.pi * i / n) * r, math.sin(2 * math.pi * i / n) * r)) for i in range(n)]
    vs = ring(-length / 2) + ring(length / 2)
    p.quads(vs, [(i, (i + 1) % n, n + (i + 1) % n, n + i) for i in range(n)], key)
    p.quads(vs, [tuple(range(n - 1, -1, -1))], end)
    p.quads(vs, [tuple(range(n, 2 * n))], end)


def net_rack(m):
    """Net hung over a ridge pole 1.9 m up, draped down both sides with a sag; cork floats
    along the head rope. 3.2 m long."""
    half, top = 1.6, 1.9
    p = m.part('frame')
    for x in (-half, half):
        for s in (-1, 1):                                                                     # forked legs
            pole(p, (x, s * .35, 0), (x, s * .04, top + .12), .045)
    pole(p, (-half - .2, 0, top), (half + .2, 0, top), .04)
    m.done('frame', p)
    p = m.part('net')
    cols = 8
    for s in (-1, 1):
        vs, faces = [], []
        for i in range(cols + 1):
            x = -half + 2 * half * i / cols
            sag = .18 * math.sin(math.pi * i / cols)
            for j, (dy, dz) in enumerate(((.02, top - .02), (.18, top - .55 - sag), (.34, top - 1.3 - sag * 1.4))):
                vs.append((x, s * dy, dz))
        for i in range(cols):
            for j in range(2):
                a, b = i * 3 + j, (i + 1) * 3 + j
                f = (a, b, b + 1, a + 1) if s > 0 else (a, a + 1, b + 1, b)
                faces.append(f)
        for f in faces:
            p.quads(vs, [f], 'net' if (faces.index(f) % 3) else 'netDark')
            p.quads(vs, [tuple(reversed(f))], 'netDark')
    for i in range(7):                                                                         # floats on the head rope
        x = -half + .25 + i * (2 * half - .5) / 6
        p.box((x, .03, top + .05), (.12, .09, .08), 'float')
    m.done('net', p)


def fish_rack(m):
    """A-frame drying rack: two rails with split fish hanging in rows. 2.4 m long."""
    half, h = 1.2, 1.5
    p = m.part('frame')
    for x in (-half, half):
        for s in (-1, 1):
            pole(p, (x, s * .55, 0), (x, s * .12, h + .1), .04)
    for z in (h, h - .55):
        for s in (-1, 1):
            y = s * (.12 + (h - z) / h * .43)
            pole(p, (-half - .1, y, z), (half + .1, y, z), .03)
    m.done('frame', p)
    p = m.part('fish')
    for z in (h, h - .55):
        for s in (-1, 1):
            y = s * (.12 + (h - z) / h * .43)
            for i in range(6):
                x = -half + .15 + i * (2 * half - .3) / 5
                l = rng.uniform(.28, .38)
                key = 'fishDry' if rng.random() < .4 else 'fish'
                p.taper((x, y, z - .02), (x, y, z - l), .07, .02, .03, .01, key)
                p.box((x, y + s * .012, z - l * .55), (.05, .01, l * .5), 'fishBelly')
    m.done('fish', p)


def fish_baskets(m):
    """Three wicker baskets with the catch, two oars leaning together and a coiled line."""
    p = m.part('goods')
    for (x, y, r) in ((0, 0, .28), (.62, .18, .24), (.25, -.55, .22)):
        p.cylinder(r, r * .82, 'wicker', n=8, axis='z', center=(x, y, .18), radii=[r * .82, r], along=[-.18, .18], cap_key='wickerDark')
        for k in range(5):
            a = 2 * math.pi * k / 5 + rng.random()
            p.taper((x + math.cos(a) * r * .4, y + math.sin(a) * r * .4, .38), (x + math.cos(a + 2) * r * .7, y + math.sin(a + 2) * r * .7, .4), .05, .015, .035, .01, 'fish')
    for s in (-1, 1):                                                                          # oars leaning in a V
        p.beam((-.75, s * .5, 0), (-.7, s * .08, 1.9), .045, .045, 'oar')
        p.box((-.74, s * .44, .3), (.04, .16, .55), 'oar')
    p.ring(.3, .18, .05, 'rope', n=10, axis='z', center=(.9, -.5, .03))
    p.ring(.24, .14, .05, 'rope', n=10, axis='z', center=(.9, -.5, .09))
    m.done('goods', p)


MODELS = [('netRack', net_rack), ('fishRack', fish_rack), ('fishBaskets', fish_baskets)]
LAYOUT = {'netRack': (0, 0), 'fishRack': (5, 0), 'fishBaskets': (9, 0)}


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
        data['models'][name] = {'parts': parts}
    js = ("'use strict';\n// Generated by tools/blender/build_fishing.py — do not edit by hand.\n"
          "// Fisherman's lot props in model space (U): +x front, +y left, +z up, origin on the ground.\n"
          "// Parts: p = vertex xyz, i = 3 indices per triangle, c = palette index per triangle.\n"
          "window.ConquerFishingModels=" + json.dumps(data, separators=(',', ':')) + ";\n")
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, 'w', encoding='utf-8', newline='\n') as f:
        f.write(js)
    print(f"fishing models: {stats}, {len(js) // 1024} KB -> {out_path}")


if __name__ == '__main__' and '--' in sys.argv:
    args = sys.argv[sys.argv.index('--') + 1:]
    main(args[args.index('--out') + 1] if '--out' in args else os.path.join(_here, '..', '..', 'src', 'assets', 'fishing-models.js'))
