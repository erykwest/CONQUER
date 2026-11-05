"""CONQUER shipyard kit (Blender 4.x/5.x): low-poly, flat-coloured, in metres.
  slipwayL1   slipway for the small craft: stone ramp, two greased timber ways and keel
              blocks running from the yard down into the sea (reach 7U)
  slipwayL2   the same for the large ships (reach 10U, 4.8U wide, 12U up the yard)
  shed        open timber shed with a tiled roof, a sawhorse and a timber rack under it
  frames      ribs and stem of a hull in frame (shown while a ship is laid down)

Model frame: x = 0 on the coastline, +X out to sea, the yard on land at -X; +Y left, +Z up.
The ramp's top (z = TOP_Z) is on land at x = -LAND_M, its foot under water at the far end.
The game places the kit (src/settlement-shipyard.js) and reads 'meta' for the ramp line.
Headless:
    blender --background --factory-startup --python tools/blender/build_shipyard.py -- --out src/assets/shipyard-models.js
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
    'stone': '#8f8a7e', 'stoneDark': '#6f6a60', 'wet': '#2f3a33',
    'way': '#5b3b22', 'grease': '#3a2a1c', 'block': '#9a6a3f', 'wedge': '#b98652',
    'post': '#8b6a45', 'postEnd': '#d0ae72', 'beam': '#6f4a2b', 'plank': '#a87a4a',
    'roof': '#9c4e34', 'roofDark': '#7e3d29', 'timber': '#a5774a', 'timberEnd': '#d9b77e',
    'rib': '#b08458', 'ribDark': '#8a6640',
}
KEYS = list(COLORS.keys())
COLL_NAME = 'CONQUER_Shipyard'
U = METERS_PER_U
LAND_M = 5 * U          # yard depth on land (5U)
TOP_Z = .9              # ramp top above the yard ground (m)
COAST_Z = .15           # ramp at the coastline (m): gentle on land, steep under water
FOOT_Z = -2.6           # ramp foot below the waterline (m)
rng = random.Random(3)


class Model:
    def __init__(self, root, name, offset):
        self.root, self.name, self.offset, self.parts, self.meta = root, name, offset, {}, {}

    def part(self, key):
        return Part(self.root, key, COLORS, self.offset, prefix=self.name + '_')

    def done(self, key, p):
        self.parts[key] = p.finish()


def pole(p, a, b, r, key='post', end='postEnd', n=5):
    a, b = Vector(a), Vector(b)
    x, y, z, length = p.frame(a, b)
    mid, rot = (a + b) / 2, Matrix((x, y, z)).transposed()
    ring = lambda s: [mid + rot @ Vector((s, math.cos(2 * math.pi * i / n) * r, math.sin(2 * math.pi * i / n) * r)) for i in range(n)]
    vs = ring(-length / 2) + ring(length / 2)
    p.quads(vs, [(i, (i + 1) % n, n + (i + 1) % n, n + i) for i in range(n)], key)
    p.quads(vs, [tuple(range(n - 1, -1, -1))], end)
    p.quads(vs, [tuple(range(n, 2 * n))], end)


def slipway(m, reach_u, half_u, land_u=5):
    x0, x1 = -land_u * U + 1.0, reach_u * U
    half = half_u * U
    z = lambda x: TOP_Z + (x - x0) * (COAST_Z - TOP_Z) / -x0 if x <= 0 else COAST_Z + x * (FOOT_Z - COAST_Z) / x1
    m.meta.update({'x0': x0 / U, 'x1': x1 / U, 'z0': TOP_Z / U, 'zc': COAST_Z / U, 'z1': FOOT_Z / U, 'half': half_u, 'reach': reach_u})
    p = m.part('ramp')
    # Stone ramp: a sloping slab with a step down on each side, in sections.
    n = 10
    cuts = [x0 + -x0 * i / 5 for i in range(5)] + [x1 * i / 5 for i in range(6)]
    for i in range(n):
        a, b = cuts[i], cuts[i + 1]
        za, zb = z(a), z(b)
        vs = [(a, -half, za), (b, -half, zb), (b, half, zb), (a, half, za),
              (a, -half, za - 1.2), (b, -half, zb - 1.2), (b, half, zb - 1.2), (a, half, za - 1.2)]
        key = 'stone' if i % 2 else 'stoneDark'
        p.quads(vs, [(0, 1, 2, 3)], key)
        p.quads(vs, [(4, 5, 1, 0), (3, 2, 6, 7)], 'stoneDark')
    p.quads([(x0, -half, z(x0)), (x0, half, z(x0)), (x0, half, z(x0) - 1.2), (x0, -half, z(x0) - 1.2)], [(0, 1, 2, 3)], 'stoneDark')
    m.done('ramp', p)
    p = m.part('ways')
    # Two greased timber ways and the keel blocks between them.
    for y in (-half * .42, half * .42):
        p.beam((x0 + .3, y, z(x0 + .3) + .12), (x1, y, z(x1) + .12), .35, .25, 'way')
        p.beam((x0 + .3, y, z(x0 + .3) + .26), (x1, y, z(x1) + .26), .2, .04, 'grease')
    for i in range(int((x1 - x0) / 2.2)):
        x = x0 + 1.2 + i * 2.2
        if z(x) < -.4:
            break
        p.box((x, 0, z(x) + .3), (.5, .9, .6), 'block')
        p.box((x, 0, z(x) + .66), (.55, .5, .12), 'wedge')
    # Mooring posts at the foot of the ramp, tops above the water.
    for y in (-half - .3, half + .3):
        pole(p, (x1 - .5, y, FOOT_Z - .5), (x1 - .5, y, 1.1), .16)
    m.done('ways', p)


def slipway_l1(m):
    slipway(m, 7, 1.1)


def slipway_l2(m):
    slipway(m, 10, 2.4, 12)


def shed(m):
    """Open shed 7 x 5 m: six posts, tie beams, a tiled gable roof; sawhorse and timber rack."""
    lx, ly, h = 3.5, 2.5, 3.0
    p = m.part('frame')
    for x in (-lx, 0, lx):
        for y in (-ly, ly):
            pole(p, (x, y, 0), (x, y, h), .14)
        p.beam((x, -ly - .2, h), (x, ly + .2, h), .18, .18, 'beam')
    for y in (-ly, ly):
        p.beam((-lx - .2, y, h), (lx + .2, y, h), .18, .18, 'beam')
    m.done('frame', p)
    p = m.part('roof')
    ridge = h + 1.6
    for s in (-1, 1):
        vs = [(-lx - .5, s * (ly + .6), h - .25), (lx + .5, s * (ly + .6), h - .25), (lx + .5, 0, ridge), (-lx - .5, 0, ridge)]
        p.quads(vs, [(0, 1, 2, 3) if s < 0 else (3, 2, 1, 0)], 'roof')
        p.quads(vs, [(3, 2, 1, 0) if s < 0 else (0, 1, 2, 3)], 'roofDark')
    for x in (-lx - .5, lx + .5):
        p.quads([(x, -ly - .6, h - .25), (x, ly + .6, h - .25), (x, 0, ridge)], [(0, 1, 2)], 'beam')
        p.quads([(x, -ly - .6, h - .25), (x, ly + .6, h - .25), (x, 0, ridge)], [(2, 1, 0)], 'beam')
    m.done('roof', p)
    p = m.part('goods')
    for i in range(6):                                                                         # timber rack
        zc = .25 + (i // 3) * .32
        yc = -1.2 + (i % 3) * .34
        p.cylinder(.15, 5.0, 'timber', n=6, axis='x', center=(.2, yc, zc), cap_key='timberEnd')
    for x in (-2.3, 2.6):
        p.box((x, -1.2, .12), (.2, 1.3, .24), 'beam')
    for s in (-1, 1):                                                                          # sawhorse + plank
        p.beam((-1.0 + s * .5, 1.4, 0), (-1.0, 1.4, .9), .08, .08, 'post')
        p.beam((1.0 + s * .5, 1.4, 0), (1.0, 1.4, .9), .08, .08, 'post')
    p.box((0, 1.4, .95), (2.8, .35, .08), 'plank')
    m.done('goods', p)


def frames(m):
    """A hull in frame, 10 m: keel, stem and sternpost, ribs and a sheer batten each side."""
    L, B, H = 10.0, 3.2, 1.9
    p = m.part('frames')
    p.box((0, 0, .12), (L, .22, .24), 'ribDark')
    pole(p, (L / 2 - .2, 0, .1), (L / 2 + .6, 0, H + .5), .12, 'ribDark', 'rib')
    pole(p, (-L / 2 + .2, 0, .1), (-L / 2 - .3, 0, H + .4), .12, 'ribDark', 'rib')
    nr = 9
    for i in range(nr):
        t = -1 + 2 * (i + .5) / nr
        x = t * L / 2 * .9
        w = B / 2 * (1 - abs(t) ** 2.2 * .8)
        pts = [(x, s * w * math.sin(a), .2 + H * (1 - math.cos(a)) * .95) for s in (-1, 1) for a in (0.2, .7, 1.2, 1.57)]
        for s in (0, 4):
            for a, b in zip([(x, 0, .2)] + pts[s:s + 4], pts[s:s + 4]):
                p.beam(a, b, .1, .1, 'rib')
    for s in (-1, 1):
        pts = []
        for i in range(nr + 1):
            t = -1 + 2 * i / nr
            w = B / 2 * (1 - abs(t) ** 2.2 * .8)
            pts.append((t * L / 2 * .9, s * w, .2 + H * .95))
        for a, b in zip(pts, pts[1:]):
            p.beam(a, b, .08, .08, 'ribDark')
    m.done('frames', p)


MODELS = [('slipwayL1', slipway_l1), ('slipwayL2', slipway_l2), ('shed', shed), ('frames', frames)]
LAYOUT = {'slipwayL1': (0, 0), 'slipwayL2': (0, 20), 'shed': (-30, 0), 'frames': (-30, 15)}


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
    js = ("'use strict';\n// Generated by tools/blender/build_shipyard.py — do not edit by hand.\n"
          "// Shipyard kit in model space (U): +x out to sea, x = 0 on the coastline, +z up.\n"
          "// Parts: p = vertex xyz, i = 3 indices per triangle, c = palette index per triangle.\n"
          "// slipway meta (U): ramp from (x0, z0) on land to (x1, z1) under water, half width, reach.\n"
          "window.ConquerShipyardModels=" + json.dumps(data, separators=(',', ':')) + ";\n")
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, 'w', encoding='utf-8', newline='\n') as f:
        f.write(js)
    print(f"shipyard models: {stats}, {len(js) // 1024} KB -> {out_path}")


if __name__ == '__main__' and '--' in sys.argv:
    args = sys.argv[sys.argv.index('--') + 1:]
    main(args[args.index('--out') + 1] if '--out' in args else os.path.join(_here, '..', '..', 'src', 'assets', 'shipyard-models.js'))
