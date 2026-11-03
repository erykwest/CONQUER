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
from cq_blender import Part, fresh_collection, export_part, u, METERS_PER_U

COLORS = {
    'dirt': '#8a7354', 'gravel': '#b3ab9b', 'grass': '#7c8f52',
    'wood': '#9a6a3f', 'woodLight': '#b98652', 'woodDark': '#6f4a2b', 'bark': '#5e4630',
    'log': '#8b6a45', 'logEnd': '#d0ae72', 'roof': '#6a5038', 'roofDark': '#4f3b29',
    'rock': '#8f8b82', 'rockTop': '#a29d90', 'rockCut': '#c9c2b4', 'block': '#d3ccbd', 'rubble': '#77736b',
    'iron': '#55595d', 'rope': '#c8b48a', 'dark': '#15120f', 'ore': '#4b4d52', 'lamp': '#f2c14e',
    'clay': '#c9773a', 'clayLight': '#dc873b', 'clayDark': '#995025', 'clayWet': '#8a4a26', 'clayCut': '#e09a5c',
    'water': '#4f7f8f', 'brickGreen': '#c98b5a', 'brick': '#a5452c',
    'millWall': '#ddd2bf', 'millWallDark': '#bdb09a', 'sail': '#ece2c8', 'char': '#2b2522', 'charLight': '#4a3d33',
    'soot': '#5b524a', 'ember': '#c0502a',
}
KEYS = list(COLORS.keys())
COLL_NAME = 'CONQUER_Industries'
rng = random.Random(7)


class Model:
    def __init__(self, root, name, offset):
        self.root, self.name, self.offset, self.parts = root, name, offset, {}
        self.pivots = {}    # part -> hub (m) of a part that turns about the model X axis in game

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


# ------------------------------------------------------------------ clay pit
def clay_pit(m):
    """Clay pit 4x4 U = 14 m on flat lowland: a stepped dig with a puddled pond
    at the back, banks of spoil, drying racks of green bricks and a wheelbarrow."""
    p = m.part('ground')
    ground_patch(p, 6.7, 6.7, 'dirt', n=12, z=.02)
    m.done('ground', p)

    # The dig: terraced clay floors rising from the wet bottom (back) to the yard.
    p = m.part('pit')
    for i, (x0, x1, z, key) in enumerate(((-6.0, -1.2, .05, 'clayWet'), (-1.2, .6, .22, 'clay'), (.6, 1.8, .4, 'clayLight'))):
        p.box(((x0 + x1) / 2, -.6, z / 2), (x1 - x0, 7.4 - i * .8, z), key)
        p.box((x1 - .03, -.6, z / 2), (.06, 7.4 - i * .8, z), 'clayCut')                    # spade-cut step face
    # Standing water in the deepest corner and a few spade marks on the wet floor.
    ground_patch_at = lambda cx, cy, rx, ry, key, z: [p.quads(
        [(cx + math.cos(2 * math.pi * k / 9) * rx, cy + math.sin(2 * math.pi * k / 9) * ry, z) for k in range(9)],
        [tuple(range(9))], key)]
    ground_patch_at(-4.4, -2.6, 1.4, 1.1, 'water', .07)
    for k in range(5):
        p.box((rng.uniform(-3.5, -1.6), rng.uniform(-3, 2), .075), (.5, .08, .02), 'clayCut', rot=Matrix.Rotation(rng.uniform(-.6, .6), 3, 'Z'))
    m.done('pit', p)

    # Spoil banks around the dig (left, right and back) with tufts of grass.
    p = m.part('banks')
    for x in (-5.6, -4.0, -2.4, -.8):
        for s in (-1, 1):
            blob(p, x, -.6 + s * 4.6, rng.uniform(.8, 1.1), 0, rng.uniform(.5, .8), 'clayDark', n=7, top_scale=.5)
    for y in (-3.6, -1.6, .4, 2.4):
        blob(p, -6.3, y, .9, 0, .7, 'clayDark', n=7, top_scale=.5)
    for _ in range(6):
        blob(p, rng.uniform(-6, 0), rng.choice((-5.4, 4.0)), .25, .6, .2, 'grass', n=5)
    m.done('banks', p)

    # Drying racks of green bricks under small plank roofs (front right).
    p = m.part('racks')
    for ry in (2.4, 4.4):
        x0, x1 = 2.2, 6.0
        for x in (x0, x1):
            for s in (-1, 1):
                p.box((x, ry + s * .45, .65), (.1, .1, 1.3), 'woodDark')
        for z in (.35, .8):
            p.box(((x0 + x1) / 2, ry, z), (x1 - x0 + .2, 1.0, .05), 'wood')
            for i in range(9):
                p.box((x0 + .3 + i * .4, ry + (-.2 if i % 2 else .2), z + .09), (.28, .16, .12), 'brickGreen')
        p.box(((x0 + x1) / 2, ry, 1.38), (x1 - x0 + .5, 1.4, .06), 'roof', rot=Matrix.Rotation(.08, 3, 'X'))
    m.done('racks', p)

    # Moulding table with a brick mould, a heap of raw clay and a wheelbarrow.
    p = m.part('work')
    p.box((3.0, -1.6, .8), (1.6, .8, .08), 'woodLight')
    for x in (2.35, 3.65):
        for s in (-1, 1):
            p.box((x, -1.6 + s * .3, .4), (.08, .08, .8), 'woodDark')
    p.box((2.7, -1.6, .88), (.32, .2, .08), 'woodDark')
    p.box((3.3, -1.55, .88), (.28, .16, .1), 'brickGreen')
    blob(p, 2.0, -3.4, .8, 0, .7, 'clay', n=8, top_scale=.45)
    bx, by = 4.6, -3.2
    p.box((bx, by, .5), (1.0, .7, .3), 'wood')
    blob(p, bx, by, .3, .62, .18, 'clayWet', n=6)
    p.cylinder(.22, .06, 'woodDark', n=8, axis='y', center=(bx + .55, by, .22), cap_key='wood')
    for s in (-1, 1):
        p.beam((bx - .3, by + s * .3, .4), (bx - 1.1, by + s * .35, .55), .05, .05, 'woodDark')
        p.beam((bx - .3, by + s * .3, .35), (bx - .3, by + s * .3, 0), .05, .05, 'woodDark')
    p.beam((1.3, 1.0, 0), (1.5, 1.2, 1.1), .04, .04, 'woodLight')                          # spade
    p.box((1.3, 1.0, .1), (.2, .04, .25), 'iron')
    m.done('work', p)

    # Stack of fired bricks ready to haul away.
    p = m.part('bricks')
    for lvl in range(4):
        for i in range(4):
            for j in range(2):
                p.box((5.2 + j * .3 + (lvl % 2) * .05, -.6 + i * .32, .06 + lvl * .12), (.28, .3, .11), 'brick')
    m.done('bricks', p)


# ------------------------------------------------------------------ mills
# Both mills sit on a 2x2 U = 7 m footprint. Each comes in three states: intact,
# burnt (fire has gutted it: blackened, roof/cap gone, sails or paddles stripped)
# and ruin (what the siege or the fire leaves: a ragged stump and fallen timbers).
def ragged_ring(p, cx, cy, r0, r1, hmin, hmax, key, n=14, top_key=None):
    """Hollow ragged-topped round wall between radii r0 (inner) and r1 (outer)."""
    hs = [rng.uniform(hmin, hmax) for _ in range(n)]
    for i in range(n):
        a0, a1 = 2 * math.pi * i / n, 2 * math.pi * (i + 1) / n
        h0, h1 = hs[i], hs[(i + 1) % n]
        o0, o1 = (cx + math.cos(a0) * r1, cy + math.sin(a0) * r1), (cx + math.cos(a1) * r1, cy + math.sin(a1) * r1)
        i0, i1 = (cx + math.cos(a0) * r0, cy + math.sin(a0) * r0), (cx + math.cos(a1) * r0, cy + math.sin(a1) * r0)
        vs = [(*o0, 0), (*o1, 0), (*o1, h1), (*o0, h0), (*i0, 0), (*i1, 0), (*i1, h1), (*i0, h0)]
        p.quads(vs, [(0, 1, 2, 3), (5, 4, 7, 6), (3, 2, 6, 7)], key)
        if top_key:
            p.quads(vs, [(3, 2, 6, 7)], top_key)


def ragged_wall(p, a, b, th, hmin, hmax, key, n=5, top_key=None):
    """Straight ragged-topped wall from a to b (x,y), thickness th."""
    ax, ay = a; bx, by = b
    L = math.hypot(bx - ax, by - ay); nx, ny = -(by - ay) / L * th / 2, (bx - ax) / L * th / 2
    hs = [rng.uniform(hmin, hmax) for _ in range(n + 1)]
    for i in range(n):
        t0, t1 = i / n, (i + 1) / n
        x0, y0, x1, y1 = ax + (bx - ax) * t0, ay + (by - ay) * t0, ax + (bx - ax) * t1, ay + (by - ay) * t1
        vs = [(x0 + nx, y0 + ny, 0), (x1 + nx, y1 + ny, 0), (x1 + nx, y1 + ny, hs[i + 1]), (x0 + nx, y0 + ny, hs[i]),
              (x0 - nx, y0 - ny, 0), (x1 - nx, y1 - ny, 0), (x1 - nx, y1 - ny, hs[i + 1]), (x0 - nx, y0 - ny, hs[i])]
        p.quads(vs, [(0, 1, 2, 3), (5, 4, 7, 6)], key)
        p.quads(vs, [(3, 2, 6, 7)], top_key or key)
        if i == 0:
            p.quads(vs, [(4, 0, 3, 7)], key)
        if i == n - 1:
            p.quads(vs, [(1, 5, 6, 2)], key)


HUB = (2.05, 0, 7.05)        # windmill windshaft hub (sails turn in the Y-Z plane, facing +X)


def sail_arm(p, ang, length, cloth=True, broken=0, key='woodDark'):
    """One sail: a stock from the hub with a lattice frame and (optionally) cloth."""
    cx, cy, cz = HUB
    dy, dz = math.cos(ang), math.sin(ang)
    L = length * (1 - broken)
    p.beam((cx, cy, cz), (cx, cy + dy * L, cz + dz * L), .12, .12, key)
    if L < 1.2:
        return
    # Lattice: two rails and cross bars from 1 m out to the tip, offset to one side.
    sy, sz = -dz, dy                                   # perpendicular in the sail plane
    w = .75
    a0, a1 = 1.0, L - .1
    for off in (.12, w):
        p.beam((cx, cy + dy * a0 + sy * off, cz + dz * a0 + sz * off), (cx, cy + dy * a1 + sy * off, cz + dz * a1 + sz * off), .05, .05, key)
    for k in range(int((a1 - a0) / .6) + 1):
        t = a0 + k * .6
        p.beam((cx, cy + dy * t, cz + dz * t), (cx, cy + dy * t + sy * w, cz + dz * t + sz * w), .04, .04, key)
    if cloth:
        c = [(cx + .03, cy + dy * a0 + sy * .12, cz + dz * a0 + sz * .12), (cx + .03, cy + dy * a1 + sy * .12, cz + dz * a1 + sz * .12),
             (cx + .03, cy + dy * a1 + sy * w, cz + dz * a1 + sz * w), (cx + .03, cy + dy * a0 + sy * w, cz + dz * a0 + sz * w)]
        p.box(tuple(sum(v[i] for v in c) / 4 for i in range(3)), (.03, 1, 1), 'sail',
              rot=Matrix(((1, 0, 0), (0, dy * (a1 - a0), sy * (w - .12)), (0, dz * (a1 - a0), sz * (w - .12)))))


def windmill_tower(p, wall, dark, height=6.4):
    p.cylinder(2.25, 0, wall, n=14, axis='z', center=(0, 0, 0), radii=[2.25, 1.7], along=[0, height], cap_key=dark)
    p.cylinder(2.32, 0, dark, n=14, axis='z', center=(0, 0, 0), radii=[2.32, 2.3], along=[0, .45], cap_key=dark)   # plinth


def windmill(m, state='intact'):
    burnt, ruin = state == 'burnt', state == 'ruin'
    p = m.part('ground')
    ground_patch(p, 3.3, 3.3, 'soot' if state != 'intact' else 'dirt', z=.02)
    m.done('ground', p)

    p = m.part('tower')
    if ruin:
        ragged_ring(p, 0, 0, 1.75, 2.25, .9, 2.9, 'millWallDark', top_key='rock')
        for k in range(6):                                                                # soot streaks on the stump
            a = rng.uniform(0, 2 * math.pi)
            p.box((math.cos(a) * 2.27, math.sin(a) * 2.27, .7), (.06, .5, 1.2), 'char', rot=Matrix.Rotation(a, 3, 'Z'))
    else:
        windmill_tower(p, 'millWallDark' if burnt else 'millWall', 'char' if burnt else 'millWallDark')
        # Door at the front, two small windows up the tower.
        p.box((2.2, 0, .95), (.18, .9, 1.7), 'char' if burnt else 'woodDark', rot=Matrix.Rotation(-.12, 3, 'Y'))
        for z, a in ((3.2, .5), (4.8, -.6)):
            p.box((math.cos(a) * 1.95, math.sin(a) * 1.95, z), (.14, .4, .55), 'dark', rot=Matrix.Rotation(a, 3, 'Z'))
        if burnt:
            # Soot licking up from the door and windows; the top rim charred.
            p.box((2.1, 0, 2.6), (.08, 1.0, 1.8), 'char', rot=Matrix.Rotation(-.12, 3, 'Y'))
            p.cylinder(1.75, 0, 'char', n=14, axis='z', center=(0, 0, 0), radii=[1.76, 1.72], along=[5.6, 6.42], cap_key='char')
    m.done('tower', p)

    p = m.part('cap')
    if not burnt and not ruin:
        # Boat-shaped wooden cap turned to the wind, with the windshaft out front.
        p.cylinder(1.85, 0, 'roof', n=14, axis='z', center=(0, 0, 0), radii=[1.9, .25], along=[6.35, 8.1], cap_key='roofDark')
        p.box((.1, 0, 6.5), (3.9, 1.4, .3), 'woodDark')
        p.cylinder(.18, 0, 'woodDark', n=8, axis='x', center=(0, 0, 7.05), radii=[.18, .18], along=[.4, 2.2], cap_key='wood')
        p.beam((-1.6, 0, 6.5), (-3.3, 0, .2), .12, .12, 'woodDark')                         # tail pole to turn the cap
        p.beam((-3.3, -.5, .2), (-3.3, .5, .2), .1, .1, 'woodDark')
    elif burnt:
        # Only the charred cap frame is left on the rim.
        for a in range(0, 360, 60):
            r = math.radians(a)
            p.beam((math.cos(r) * 1.7, math.sin(r) * 1.7, 6.4), (math.cos(r) * .3, math.sin(r) * .3, 7.5 - (a % 120) / 120), .1, .1, 'char')
        p.cylinder(.18, 0, 'char', n=8, axis='x', center=(0, 0, 7.05), radii=[.18, .18], along=[.4, 2.2], cap_key='charLight')
    m.done('cap', p)

    p = m.part('sails')
    if not ruin:
        for i in range(4):
            ang = math.pi / 4 + i * math.pi / 2
            if burnt:
                sail_arm(p, ang, 5.0, cloth=False, broken=(.0, .55, .25, .8)[i], key='char')
            else:
                sail_arm(p, ang, 5.0)
        p.box((HUB[0] + .1, 0, HUB[2]), (.3, .5, .5), 'char' if burnt else 'iron')
    m.done('sails', p)
    if state == 'intact':
        m.pivots['sails'] = HUB

    p = m.part('yard')
    if ruin:
        # The cap and sails came down: charred spars and rafters on the ground, rubble at the foot.
        log(p, (2.4, -3.1, .14), (3.0, 2.2, .3), .13, key='char', end='charLight')
        log(p, (-.6, 2.6, .12), (3.1, 3.0, .12), .12, key='char', end='charLight')
        log(p, (-2.8, -2.4, .1), (-.9, -3.2, .1), .1, key='charLight', end='char')
        for k in range(10):
            a = rng.uniform(0, 2 * math.pi); r = rng.uniform(2.3, 3.1)
            blob(p, math.cos(a) * r, math.sin(a) * r, rng.uniform(.2, .45), 0, rng.uniform(.15, .4), 'rubble' if k % 3 else 'millWallDark', n=6)
        blob(p, 0, 0, 1.1, 0, .5, 'soot', n=9)                                           # fallen masonry inside
        p.box((.4, .3, .75), (1.4, .1, .1), 'char', rot=Matrix.Rotation(.6, 3, 'Z'))
    else:
        # Grain sacks by the door and a hand cart.
        for k, (x, y) in enumerate(((2.75, -1.1), (2.9, -1.55), (2.6, -1.5))):
            blob(p, x, y, .28, 0, .45 + (k == 1) * .05, 'charLight' if burnt else 'rope', n=7, top_scale=.7)
        if not burnt:
            p.box((2.6, 1.6, .5), (1.1, .7, .12), 'wood')
            p.cylinder(.3, .05, 'woodDark', n=8, axis='y', center=(2.5, 1.6 + .4, .3), cap_key='wood')
            p.cylinder(.3, .05, 'woodDark', n=8, axis='y', center=(2.5, 1.6 - .4, .3), cap_key='wood')
            p.beam((2.0, 1.4, .5), (1.4, 1.35, .4), .05, .05, 'woodDark')
            p.beam((2.0, 1.8, .5), (1.4, 1.85, .4), .05, .05, 'woodDark')
    m.done('yard', p)


def watermill(m, state='intact'):
    """Wheel side (+X) against the river bank: undershot wheel on the outer face."""
    burnt, ruin = state == 'burnt', state == 'ruin'
    p = m.part('ground')
    ground_patch(p, 3.3, 3.3, 'soot' if state != 'intact' else 'dirt', z=.02)
    m.done('ground', p)

    x0, x1, y0, y1 = -2.7, 2.7, -2.5, 2.5
    p = m.part('house')
    if ruin:
        ragged_wall(p, (x0, y0), (x1, y0), .4, .5, 2.2, 'millWallDark', top_key='rock')
        ragged_wall(p, (x1, y0), (x1, y1), .4, 1.2, 2.6, 'millWallDark', top_key='rock')
        ragged_wall(p, (x1, y1), (x0 + 1.5, y1), .4, .3, 1.6, 'millWallDark', top_key='rock')
        ragged_wall(p, (x0, y1 - 1.8), (x0, y0), .4, .4, 1.4, 'millWallDark', top_key='rock')
        blob(p, -.4, .3, 1.1, 0, .45, 'soot', n=9)
        blob(p, -2.6, 1.8, .6, 0, .4, 'millWallDark', n=7)
        for a, b in (((-1.8, -1.6, .5), (1.6, 1.4, .25)), ((-2.0, 1.0, .3), (.6, -1.9, .8)), ((.4, 2.2, .2), (2.2, .2, 1.1))):
            log(p, a, b, .12, key='char', end='charLight')
    else:
        wall, dark = ('millWallDark', 'char') if burnt else ('millWall', 'millWallDark')
        # Stone ground floor, timber-framed upper floor.
        p.box((0, 0, 1.25), (x1 - x0, y1 - y0, 2.5), wall)
        p.box((0, 0, .2), (x1 - x0 + .14, y1 - y0 + .14, .4), dark)
        up = 'charLight' if burnt else 'woodLight'
        p.box((0, 0, 3.4), (x1 - x0 - .1, y1 - y0 - .1, 1.8), up)
        for x in (x0 + .05, -.9, .9, x1 - .05):                                               # frame posts
            for y in (y0 + .02, y1 - .02):
                p.box((x, y, 3.4), (.16, .08, 1.8), 'char' if burnt else 'woodDark')
        for y in (y0 + .02, y1 - .02):
            p.box((0, y, 2.55), (x1 - x0, .1, .14), 'char' if burnt else 'woodDark')
        p.box((x0 - .02, 0, 1.0), (.1, 1.0, 1.9), 'char' if burnt else 'woodDark')            # door (land side)
        for y in (-1.3, 1.3):
            p.box((x1 + .01, y, 1.6), (.06, .6, .7), 'dark')
            p.box((x0 - .01, y, 3.4), (.06, .5, .6), 'dark')
        if burnt:
            for y in (-1.3, 1.3):
                p.box((x1 + .02, y, 2.5), (.05, .9, 1.5), 'char')                                # soot over the windows
    m.done('house', p)

    p = m.part('roof')
    if not ruin:
        eave, ridge = 4.3, 6.1
        if not burnt:
            for s in (-1, 1):
                lo, hi = (s * (y1 - y0) / 2 * 1.12, eave), (0, ridge)
                ex0, ex1, th = x0 - .35, x1 + .35, .1
                vs = [(ex0, lo[0], lo[1]), (ex1, lo[0], lo[1]), (ex1, hi[0], hi[1]), (ex0, hi[0], hi[1]),
                      (ex0, lo[0], lo[1] - th), (ex1, lo[0], lo[1] - th), (ex1, hi[0], hi[1] - th), (ex0, hi[0], hi[1] - th)]
                q = [(0, 1, 2, 3), (7, 6, 5, 4), (0, 4, 5, 1), (3, 2, 6, 7), (0, 3, 7, 4), (1, 5, 6, 2)]
                p.quads(vs, q if s > 0 else [tuple(reversed(f)) for f in q], 'roof')
            for x in (x0, x1):                                                                  # gables
                v = [(x, y0 * 1.0, eave - .1), (x, y1 * 1.0, eave - .1), (x, 0, ridge - .05)]
                p.box((x, 0, (eave + ridge) / 2 - .3), (.08, (y1 - y0) * .5, ridge - eave - .4), 'woodLight')
        else:
            # Roof burnt away: a few charred rafters and the ridge beam sagging.
            for k in range(5):
                x = x0 + .3 + k * (x1 - x0 - .6) / 4
                for s in (-1, 1):
                    if (k + (s > 0)) % 3 == 0:
                        continue
                    p.beam((x, s * 2.4, eave), (x, 0, ridge - .3 * (k % 2)), .09, .09, 'char')
            p.beam((x0 + .3, 0, ridge - .2), (x1 - .6, 0, ridge - .7), .12, .12, 'char')
    m.done('roof', p)

    # Undershot wheel on the river face: axle out of the +X wall, wheel plane Y-Z.
    p = m.part('wheel')
    wx, wz, R = x1 + .75, 1.55, 1.9
    key = 'char' if burnt or ruin else 'woodDark'
    if ruin:
        # The wheel broke off its axle and lies tilted against the bank.
        rot = Matrix.Rotation(1.0, 3, 'Y')
        base = Vector((x1 + 1.0, 0, .9))
        n = 12
        rim = [base + rot @ Vector((0, math.cos(2 * math.pi * k / n) * R, math.sin(2 * math.pi * k / n) * R)) for k in range(n)]
        for k in range(n):
            if k in (3, 4, 9):
                continue
            p.beam(tuple(rim[k]), tuple(rim[(k + 1) % n]), .12, .12, 'char')
        for k in (0, 2, 6, 8):
            p.beam(tuple(base), tuple(rim[k]), .08, .08, 'char')
    else:
        p.beam((x1 - .05, 0, wz), (wx + .5, 0, wz), .2, .2, 'iron' if not burnt else 'char')
        n = 12
        for side in (-.35, .35):
            rim = [(wx + side, math.cos(2 * math.pi * k / n) * R, wz + math.sin(2 * math.pi * k / n) * R) for k in range(n)]
            for k in range(n):
                if burnt and k in (2, 7):
                    continue
                p.beam(rim[k], rim[(k + 1) % n], .1, .1, key)
            for k in range(0, n, 2):
                if burnt and k == 6:
                    continue
                p.beam((wx + side, 0, wz), rim[k], .07, .07, key)
        for k in range(n):                                                                      # paddles
            if burnt and k % 3:
                continue
            a = 2 * math.pi * k / n
            p.box((wx, math.cos(a) * (R - .1), wz + math.sin(a) * (R - .1)), (.8, .1, .45), 'wood' if not burnt else 'char',
                  rot=Matrix.Rotation(a + math.pi / 2, 3, 'X'))
    m.done('wheel', p)
    if state == 'intact':
        m.pivots['wheel'] = (wx, 0, wz)

    p = m.part('yard')
    if not ruin:
        # Head-race flume feeding the wheel from upstream (-Y), on trestles.
        fz = wz + R + .15
        flume = 'char' if burnt else 'wood'
        p.box((wx, -2.6, fz), (.8, 2.6, .12), flume)
        for s in (-1, 1):
            p.box((wx + s * .4, -2.6, fz + .2), (.06, 2.6, .35), flume)
        for y in (-3.4, -2.0):
            p.beam((wx, y, 0), (wx, y, fz - .05), .1, .1, 'char' if burnt else 'woodDark')
        if not burnt:
            p.box((wx, -2.6, fz + .08), (.66, 2.5, .04), 'water')
        for k, (x, y) in enumerate(((x0 - .5, -1.2), (x0 - .7, -1.7), (x0 - .4, -1.8))):
            blob(p, x, y, .28, 0, .45, 'charLight' if burnt else 'rope', n=7, top_scale=.7)
    else:
        for k in range(8):
            blob(p, rng.uniform(-3, 3), rng.choice((-3, 3)) * rng.uniform(.85, 1), rng.uniform(.2, .4), 0, .3, 'rubble', n=6)
    m.done('yard', p)


MODELS = [('loggingCamp', logging_camp, (0, 0, 0)), ('quarry', quarry, (14, 0, 0)), ('mine', mine, (28, 0, 0)),
          ('clayPit', clay_pit, (44, 0, 0)),
          ('windmill', lambda m: windmill(m), (0, 16, 0)), ('windmillBurnt', lambda m: windmill(m, 'burnt'), (12, 16, 0)),
          ('windmillRuin', lambda m: windmill(m, 'ruin'), (24, 16, 0)),
          ('watermill', lambda m: watermill(m), (0, 30, 0)), ('watermillBurnt', lambda m: watermill(m, 'burnt'), (12, 30, 0)),
          ('watermillRuin', lambda m: watermill(m, 'ruin'), (24, 30, 0))]


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
        if m.pivots:
            data['models'][name]['pivots'] = {k: [round(c / METERS_PER_U, 3) for c in v] for k, v in m.pivots.items()}
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
