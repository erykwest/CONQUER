"""CONQUER industries builder (Blender 5.x): logging camp, stone quarry, mine.

Low-poly, flat-coloured models in real metres on the game footprints
(logging camp 2x2 U = 7 m, quarry 3x3 U = 10.5 m, mine 1x1 U = 3.5 m).
Each model is split into parts (ground, shed, log pile, ...) so the canvas
painter can sort them as units; WebGL uses the same triangles with a depth
buffer. Shading is not baked: the game shades faces like the castle.

Run inside Blender (BlenderMCP execute_code):
    CQ_DIR = r"...\\ASSETS\\blender"; INDUSTRIES_OUT = r"...\\src\\assets\\industry-models.js"
    exec(open(CQ_DIR + r"\\build_industries.py", encoding="utf-8").read())
Axes: +X = the building's front (its angle in game), +Y left, +Z up; origin on the
ground at the footprint centre.
"""
import json, math, os, sys, importlib, random
from mathutils import Vector, Matrix
_here = os.path.dirname(os.path.abspath(__file__)) if '__file__' in globals() else CQ_DIR
if _here not in sys.path:
    sys.path.insert(0, _here)
import cq_blender
importlib.reload(cq_blender)
from cq_blender import Part, fresh_collection, export_part, u

COLORS = {
    'dirt': '#8a7354', 'gravel': '#b3ab9b', 'grass': '#7c8f52',
    'wood': '#9a6a3f', 'woodLight': '#b98652', 'woodDark': '#6f4a2b', 'bark': '#5e4630',
    'log': '#8b6a45', 'logEnd': '#d0ae72', 'roof': '#6a5038', 'roofDark': '#4f3b29',
    'rock': '#8f8b82', 'rockTop': '#a29d90', 'rockCut': '#c9c2b4', 'block': '#d3ccbd', 'rubble': '#77736b',
    'iron': '#55595d', 'rope': '#c8b48a', 'dark': '#15120f', 'ore': '#4b4d52', 'lamp': '#f2c14e',
}
KEYS = list(COLORS.keys())
COLL_NAME = 'CONQUER_Industries'
rng = random.Random(7)


class Model:
    def __init__(self, root, name, offset):
        self.root, self.name, self.offset, self.parts = root, name, offset, {}

    def part(self, key):
        return Part(self.root, key, COLORS, self.offset, prefix=self.name + '_')

    def done(self, key, p):
        self.parts[key] = p.finish()


def blob(p, cx, cy, r, z0, h, key, n=8, jitter=.18, top_scale=.55):
    """Irregular low-poly lump (rubble, spoil heap, boulder)."""
    base, top = [], []
    for i in range(n):
        a = 2 * math.pi * i / n
        rr = r * (1 + rng.uniform(-jitter, jitter))
        base.append((cx + math.cos(a) * rr, cy + math.sin(a) * rr, z0))
        top.append((cx + math.cos(a) * rr * top_scale, cy + math.sin(a) * rr * top_scale, z0 + h * (1 + rng.uniform(-.15, .15))))
    vs = base + top
    faces = [(i, (i + 1) % n, n + (i + 1) % n, n + i) for i in range(n)]
    faces.append(tuple(range(2 * n - 1, n - 1, -1)))
    p.quads(vs, faces, key)


def ground_patch(p, rx, ry, key, n=10, jitter=.08, z=.03):
    pts = []
    for i in range(n):
        a = 2 * math.pi * i / n
        k = 1 + rng.uniform(-jitter, jitter)
        pts.append((math.cos(a) * rx * k, math.sin(a) * ry * k))
    top = [(x, y, z) for x, y in pts]
    bot = [(x * 1.04, y * 1.04, 0) for x, y in pts]
    vs = top + bot
    faces = [tuple(range(n))] + [(n + i, n + (i + 1) % n, (i + 1) % n, i) for i in range(n)]
    p.quads(vs, faces, key)


def log(p, a, b, r, key='log', end='logEnd', n=7):
    """Log between two points: bark cylinder with light cut ends."""
    a, b = Vector(a), Vector(b)
    x, y, z, length = p.frame(a, b)
    mid = (a + b) / 2
    # Cylinder built along local x, then rotated into place.
    rot = Matrix((x, y, z)).transposed()
    ring = lambda s: [mid + rot @ Vector((s, math.cos(2 * math.pi * i / n) * r, math.sin(2 * math.pi * i / n) * r)) for i in range(n)]
    r0, r1 = ring(-length / 2), ring(length / 2)
    vs = r0 + r1
    p.quads(vs, [(i, (i + 1) % n, n + (i + 1) % n, n + i) for i in range(n)], key)
    p.quads(vs, [tuple(range(n - 1, -1, -1))], end)
    p.quads(vs, [tuple(range(n, 2 * n))], end)


# ------------------------------------------------------------------ logging camp
def logging_camp(m):
    p = m.part('ground')
    ground_patch(p, 3.3, 3.3, 'dirt')
    m.done('ground', p)

    # Open timber shed with a shingled gable roof (back-left quarter).
    p = m.part('shed')
    sx0, sx1, sy0, sy1, eave, ridge = -2.9, -0.5, -2.9, -0.3, 2.0, 3.0
    for x in (sx0, sx1):
        for y in (sy0, sy1):
            p.box((x, y, eave / 2), (.16, .16, eave), 'woodDark')
    for y in (sy0, sy1):
        p.box(((sx0 + sx1) / 2, y, eave), (sx1 - sx0 + .3, .14, .16), 'wood')          # eave beams
    p.box(((sx0 + sx1) / 2, (sy0 + sy1) / 2, ridge), (sx1 - sx0 + .6, .14, .14), 'woodDark')   # ridge
    for x in (sx0, sx1):                                                                  # gable posts
        p.box((x, (sy0 + sy1) / 2, (eave + ridge) / 2), (.12, .12, ridge - eave), 'wood')
    # Back wall of vertical planks.
    for i in range(9):
        x = sx0 + .1 + i * (sx1 - sx0 - .2) / 8
        p.box((x, sy0 - .06, eave / 2), (.24, .05, eave), 'wood' if i % 2 else 'woodLight')
    # Firewood stacked under the roof.
    for row in range(3):
        for i in range(6):
            x = sx0 + .45 + i * .3
            log(p, (x, sy0 + .3, .14 + row * .24), (x, sy0 + 1.0, .14 + row * .24), .11)
    m.done('shed', p)
    p = m.part('roof')
    hw = (sy1 - sy0) / 2 + .35
    cy = (sy0 + sy1) / 2
    for s in (-1, 1):
        a = (sx0 - .3, cy + s * hw, eave - .1)
        b = (sx1 + .3, cy, ridge + .08)
        # Each roof plane as a thin slab from the eave line up to the ridge.
        ex0, ex1 = sx0 - .3, sx1 + .3
        lo, hi = (cy + s * hw, eave - .12), (cy, ridge + .06)
        th = .08
        vs = [(ex0, lo[0], lo[1]), (ex1, lo[0], lo[1]), (ex1, hi[0], hi[1]), (ex0, hi[0], hi[1]),
              (ex0, lo[0], lo[1] - th), (ex1, lo[0], lo[1] - th), (ex1, hi[0], hi[1] - th), (ex0, hi[0], hi[1] - th)]
        p.quads(vs, [(0, 1, 2, 3), (7, 6, 5, 4), (0, 4, 5, 1), (3, 2, 6, 7), (0, 3, 7, 4), (1, 5, 6, 2)], 'roof')
        # Shingle courses: darker strips across the roof plane.
        for k in (.33, .66):
            y = lo[0] + (hi[0] - lo[0]) * k
            z = lo[1] + (hi[1] - lo[1]) * k + .02
            p.box(((ex0 + ex1) / 2, y, z), (ex1 - ex0, .06, .03), 'roofDark')
    m.done('roof', p)

    # Big log pile (pyramid of trunks) held by stakes, front-right.
    p = m.part('logpile')
    px0, px1, py = .2, 3.0, -1.9
    for row, count in enumerate((4, 3, 2)):
        for i in range(count):
            y = py + (i - (count - 1) / 2) * .36
            z = .17 + row * .3
            log(p, (px0, y, z), (px1, y, z), .17)
    for x in (px0 - .12, px1 + .12):
        for s in (-1, 1):
            p.box((x, py + s * .85, .45), (.09, .09, .9), 'woodDark')
    m.done('logpile', p)

    # Chopping block with the axe, split logs, sawhorse with a trunk, stumps.
    p = m.part('work')
    p.cylinder(.27, 0, 'log', n=8, axis='z', center=(1.2, 1.3, 0), radii=[.27, .27], along=[0, .5], cap_key='logEnd')
    p.beam((1.2, 1.3, .5), (1.55, 1.55, .95), .05, .05, 'woodLight')                       # axe handle
    p.box((1.18, 1.28, .55), (.18, .05, .14), 'iron')                                     # axe head in the block
    for i, (x, y) in enumerate(((1.8, .8), (.7, 1.9), (1.7, 2.0), (.5, 1.1))):
        p.box((x, y, .1), (.36, .12, .12), 'logEnd' if i % 2 else 'log', rot=Matrix.Rotation(i * .9, 3, 'Z'))
    for x in (-.6, .6):                                                                    # sawhorse
        sx = 1.0 + x * .0
        for s in (-1, 1):
            p.beam((-1.0 + x, 1.7 + s * .32, 0), (-1.0 + x, 1.7 - s * .1, .8), .07, .07, 'woodDark')
    log(p, (-2.2, 1.7, .9), (.3, 1.7, .9), .16)
    for x, y, r in ((2.4, 2.4, .22), (-2.4, 2.5, .2), (2.6, .6, .18)):
        p.cylinder(r, 0, 'bark', n=7, axis='z', center=(x, y, 0), radii=[r, r * .9], along=[0, .28], cap_key='logEnd')
    m.done('work', p)


# ------------------------------------------------------------------ stone quarry
def quarry(m):
    p = m.part('ground')
    p.box((1.6, 0, .02), (7.2, 9.6, .04), 'gravel')                                       # working yard
    m.done('ground', p)

    # Rock mass at the back cut into three benches (front = +X faces the yard).
    p = m.part('rock')
    W = 4.6          # half width of the cut; shoulders reach 5.2 m, inside the 10.5 m footprint
    steps = [(-2.0, 1.7), (-3.4, 3.3), (-4.6, 4.7)]       # (face x, top z of that bench)
    prev_x, prev_z = -2.0, 0
    xs = [-2.0, -3.4, -4.6, -5.25]
    zs = [1.7, 3.3, 4.7]
    for i in range(3):
        x_face, x_back, z_top = xs[i], xs[i + 1], zs[i]
        z_bot = 0 if i == 0 else zs[i - 1]
        # Fresh-cut vertical face with a tooled band, then the bench top behind it.
        p.box((x_face - .05, 0, (z_bot + z_top) / 2), (.1, 2 * W - i * .7, z_top - z_bot), 'rockCut')
        p.box(((x_face + x_back) / 2, 0, z_top / 2), (x_face - x_back, 2 * W - i * .7, z_top), 'rock')
        p.box(((x_face + x_back) / 2, 0, z_top + .02), (x_face - x_back, 2 * W - i * .7, .04), 'rockTop')
        # One tooled course line and a few staggered joints: worked stone, not a grid.
        p.box((x_face + .01, 0, z_bot + (z_top - z_bot) * .55), (.03, 2 * W - i * .7, .04), 'rock')
        for k in range(3):
            y = rng.uniform(-W + 1, W - 1)
            zc = z_bot + (z_top - z_bot) * (.28 if k % 2 else .78)
            p.box((x_face + .01, y, zc), (.03, .04, (z_top - z_bot) * .45), 'rock')
        # Half-cut blocks still standing proud of the face.
        for k in range(2):
            y = rng.uniform(-W + 1.2, W - 1.2)
            p.box((x_face + .25, y, z_bot + .3), (.5, rng.uniform(.8, 1.3), .6), 'rockCut')
    # Rough side shoulders so the cut sits inside the hillside.
    for s in (-1, 1):
        vs = [(-5.25, s * W, 0), (-2.0, s * W, 0), (-2.0, s * W, 1.7), (-5.25, s * W, 4.7),
              (-5.25, s * (W + .6), 0), (-1.2, s * (W + .6), 0), (-1.6, s * (W + .4), 1.2), (-5.25, s * (W + .4), 4.2)]
        p.quads(vs, [(0, 1, 2, 3), (4, 7, 6, 5), (1, 5, 6, 2), (2, 6, 7, 3), (0, 4, 5, 1)], 'rock')
    m.done('rock', p)

    # Cut blocks stacked for transport, rubble at the face.
    p = m.part('blocks')
    for i, (x, y, z) in enumerate([(1.4, -3.4, 0), (2.5, -3.4, 0), (1.4, -2.6, 0), (2.5, -2.6, 0), (1.95, -3.0, .62),
                                   (3.6, 2.8, 0), (3.6, 3.7, 0), (3.6, 3.25, .62)]):
        p.box((x, y, z + .3), (1.0, .7, .6), 'block', rot=Matrix.Rotation(rng.uniform(-.05, .05), 3, 'Z'))
    for _ in range(9):
        blob(p, rng.uniform(-1.6, -.6), rng.uniform(-4, 4), rng.uniform(.2, .4), 0, rng.uniform(.2, .45), 'rubble', n=6)
    m.done('blocks', p)

    # Sheer-leg crane with rope and windlass lifting a block off the bench.
    p = m.part('crane')
    apex = (-1.1, 0, 5.0)
    for s in (-1, 1):
        p.beam((1.0, s * 1.4, 0), apex, .14, .14, 'woodDark')
    p.beam(apex, (3.2, 0, 0), .05, .05, 'rope')                                            # back stay
    p.beam((apex[0] - .3, 0, apex[2] + .05), (apex[0] + .4, 0, apex[2] + .05), .12, .12, 'wood')
    p.beam((-1.5, 0, apex[2]), (-1.5, 0, 2.6), .03, .03, 'rope')                            # hoist rope
    p.box((-1.5, 0, 2.3), (.9, .6, .55), 'block')
    for s in (-1, 1):
        p.box((.7, s * .9, .5), (.12, .12, 1.0), 'woodDark')                               # windlass stands
    p.cylinder(.16, .85, 'wood', n=8, axis='y', center=(.7, 0, .95), cap_key='woodDark')
    for s in (-1, 1):
        p.beam((.7, s * .95, .95), (.7, s * .95, 1.45), .05, .05, 'woodLight')              # handles
    m.done('crane', p)

    # Hand cart with a block and a leaning pickaxe.
    p = m.part('cart')
    p.box((3.4, -.4, .62), (1.4, .9, .16), 'wood')
    for s in (-1, 1):
        p.cylinder(.32, .05, 'woodDark', n=8, axis='y', center=(3.3, -.4 + s * .52, .32), cap_key='wood')
    p.beam((4.1, -.7, .62), (4.9, -.75, .5), .06, .06, 'woodDark')
    p.beam((4.1, -.1, .62), (4.9, -.05, .5), .06, .06, 'woodDark')
    p.box((3.4, -.4, .95), (.9, .6, .5), 'block')
    p.beam((-1.85, 2.4, 0), (-1.95, 2.6, 1.0), .04, .04, 'woodLight')
    p.box((-1.95, 2.6, 1.0), (.06, .5, .06), 'iron')
    m.done('cart', p)


# ------------------------------------------------------------------ mine
def mine(m):
    p = m.part('ground')
    ground_patch(p, 1.62, 1.62, 'dirt', z=.02)
    m.done('ground', p)

    # Rock outcrop the adit is driven into: a cluster of faceted boulders behind
    # and beside the portal, with a dressed face where the timbers stand.
    p = m.part('rock')
    for cx, cy, r, h in ((-.85, 0, 1.1, 2.6), (-.7, -1.0, .72, 1.9), (-.75, 1.0, .75, 2.1), (-1.15, .4, .68, 3.0)):
        blob(p, cx, cy, r, 0, h, 'rock', n=7, jitter=.22, top_scale=.42)
    p.box((.2, 0, 1.2), (.4, 2.1, 2.4), 'rock')
    p.quads([(.405, -1.0, 0), (.405, 1.0, 0), (.405, 1.0, 2.35), (.405, -1.0, 2.35)], [(0, 1, 2, 3)], 'rockCut')
    blob(p, -.6, 0, .9, 2.3, .5, 'rockTop', n=6, jitter=.2, top_scale=.4)
    m.done('rock', p)

    # Timbered portal: posts, lintel, struts, plank hood, black adit.
    p = m.part('portal')
    p.box((.38, 0, 1.02), (.04, 1.36, 2.04), 'dark')
    for s in (-1, 1):
        p.box((.55, s * .78, 1.05), (.22, .22, 2.1), 'woodDark')
        p.beam((.55, s * .66, 1.55), (.55, s * .3, 2.05), .1, .1, 'wood')                  # corner struts
    p.box((.55, 0, 2.18), (.26, 2.0, .26), 'wood')                                        # lintel
    for i in range(5):
        p.box((.72, -.8 + i * .4, 2.4), (.62, .38, .06), 'woodLight' if i % 2 else 'wood', rot=Matrix.Rotation(-.18, 3, 'Y'))
    m.done('portal', p)

    # Rails with sleepers running out of the adit, an ore cart, spoil heap, lantern.
    p = m.part('track')
    for i in range(4):
        p.box((.55 + i * .38, 0, .04), (.12, 1.0, .07), 'woodDark')
    for s in (-1, 1):
        p.box((1.15, s * .33, .1), (1.3, .05, .05), 'iron')
    m.done('track', p)
    p = m.part('cart')
    cx = 1.2
    vs = [(cx - .42, -.32, .22), (cx + .42, -.32, .22), (cx + .42, .32, .22), (cx - .42, .32, .22),
          (cx - .5, -.4, .7), (cx + .5, -.4, .7), (cx + .5, .4, .7), (cx - .5, .4, .7)]
    p.quads(vs, [(0, 3, 2, 1), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)], 'iron')
    blob(p, cx, 0, .4, .62, .22, 'ore', n=7, top_scale=.5)
    for x in (-.28, .28):
        for s in (-1, 1):
            p.cylinder(.12, .03, 'iron', n=7, axis='y', center=(cx + x, s * .36, .14))
    m.done('cart', p)
    p = m.part('spoil')
    blob(p, .9, 1.25, .5, 0, .45, 'rubble', n=8)
    blob(p, 1.25, 1.0, .3, 0, .3, 'rubble', n=6)
    p.box((.9, -1.25, .55), (.08, .08, 1.1), 'woodDark')                                   # lantern post
    p.box((.9, -1.25, 1.14), (.16, .16, .2), 'lamp')
    p.box((.9, -1.25, 1.27), (.2, .2, .05), 'iron')
    for i in range(3):                                                                     # spare props
        p.box((1.3, -1.25 + i * .14, .07 + (i % 2) * .12), (1.0, .12, .12), 'wood')
    m.done('spoil', p)


MODELS = [('loggingCamp', logging_camp, (0, 0, 0)), ('quarry', quarry, (14, 0, 0)), ('mine', mine, (28, 0, 0))]


def main(out_path):
    root = fresh_collection(COLL_NAME)
    data = {'palette': list(COLORS.values()), 'paletteKeys': KEYS, 'models': {}}
    total = 0
    for name, fn, off in MODELS:
        m = Model(root, name, off)
        fn(m)
        parts = {k: export_part(p, KEYS) for k, p in m.parts.items()}
        total += sum(len(p['c']) for p in parts.values())
        data['models'][name] = {'parts': parts}
    js = ("'use strict';\n// Generated by ASSETS/blender/build_industries.py — do not edit by hand.\n"
          "// Industry models as triangles in model space (U): +x front, +y left, +z up.\n"
          "window.ConquerIndustryModels=" + json.dumps(data, separators=(',', ':')) + ";\n")
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, 'w', encoding='utf-8', newline='\n') as f:
        f.write(js)
    print(f"industry models: {len(MODELS)} models, {total} triangles, {len(js) // 1024} KB -> {out_path}")
    return total


if __name__ == '__main__' and '--' in sys.argv:
    args = sys.argv[sys.argv.index('--') + 1:]
    main(args[args.index('--out') + 1])
elif 'INDUSTRIES_OUT' in globals():
    INDUSTRIES_RESULT = main(INDUSTRIES_OUT)
