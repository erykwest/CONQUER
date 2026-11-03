"""CONQUER construction-site kit (Blender 4.x/5.x): modular props for the build phases.

Low-poly, flat-coloured props in real metres, meant to be placed around a
structure while it is being built (and removed when it is finished):
  ladderShort / ladderLong   ladders leaning on a wall (1 / 2 scaffold storeys)
  scaffoldBay                one putlog-scaffold bay, 2.4 m wide x 2.0 m tall, tiles in y and z
  materialPile               timber, ashlar, bricks, sand heap and mortar trough
  carpenterBench             trestle bench with a beam being cut by a bow saw
  masonBench                 banker with a block being dressed, hammer and chisel
  hoist                      tripod with block and tackle lifting a slung stone
  treadwheelCrane            great wheel, mast and jib lifting a block

Wall-mounted pieces (ladders, scaffold) put the wall face on x = 0 with the
wall behind (-X) and the prop in front (+X); free-standing props are centred on
their footprint. Each model is split into parts so the game can show them one
phase at a time (e.g. scaffold 'rail' only on the top storey, 'end' only on the
last bay of a run, 'endRail' on the last bay of the top storey).

The game places them per construction phase (src/settlement-construction-props.js).

Run inside Blender (BlenderMCP execute_code):
    CQ_DIR = r"...\\tools\\blender"; CONSTRUCTION_OUT = r"...\\src\\assets\\construction-models.js"
    exec(open(CQ_DIR + r"\\build_construction.py", encoding="utf-8").read())
or headless:
    blender --background --factory-startup --python tools/blender/build_construction.py -- --out src/assets/construction-models.js
Axes: +X front, +Y left, +Z up; origin on the ground.
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
    'dirt': '#8a7354', 'sand': '#cdb27c', 'sawdust': '#d9bf8c', 'chips': '#ddd6c8',
    'wood': '#9a6a3f', 'woodLight': '#b98652', 'woodDark': '#6f4a2b', 'pole': '#8b6a45', 'poleEnd': '#d0ae72',
    'plank': '#a87a4a', 'cut': '#e0c08a',
    'rock': '#8f8b82', 'block': '#d3ccbd', 'blockDressed': '#e4ddcf', 'brick': '#a8553a', 'brickDark': '#8a4430',
    'mortar': '#c9c5ba', 'iron': '#55595d', 'blade': '#9aa0a4', 'rope': '#c8b48a', 'dark': '#2a231c',
}
KEYS = list(COLORS.keys())
COLL_NAME = 'CONQUER_Construction'
rng = random.Random(11)

STOREY = 2.0      # scaffold storey height (m): bays stack every 2.0 m
BAY = 2.4         # scaffold bay width along the wall (m)
REACH = 1.3       # standards' distance from the wall face (m)


class Model:
    def __init__(self, root, name, offset):
        self.root, self.name, self.offset, self.parts, self.meta = root, name, offset, {}, {}

    def part(self, key):
        return Part(self.root, key, COLORS, self.offset, prefix=self.name + '_')

    def done(self, key, p):
        self.parts[key] = p.finish()


def pole(p, a, b, r, key='pole', end='poleEnd', n=6):
    """Round timber between two points: bark sides with light cut ends."""
    a, b = Vector(a), Vector(b)
    x, y, z, length = p.frame(a, b)
    mid = (a + b) / 2
    rot = Matrix((x, y, z)).transposed()
    ring = lambda s: [mid + rot @ Vector((s, math.cos(2 * math.pi * i / n) * r, math.sin(2 * math.pi * i / n) * r)) for i in range(n)]
    vs = ring(-length / 2) + ring(length / 2)
    p.quads(vs, [(i, (i + 1) % n, n + (i + 1) % n, n + i) for i in range(n)], key)
    p.quads(vs, [tuple(range(n - 1, -1, -1))], end)
    p.quads(vs, [tuple(range(n, 2 * n))], end)


def lashing(p, c, r=.09, h=.1):
    """Rope binding around a pole joint (square: it is a few pixels in game)."""
    p.cylinder(r, 0, 'rope', n=4, axis='z', center=c, radii=[r, r], along=[-h / 2, h / 2])


def spole(p, a, b, r):
    """Scaffold pole: four-sided, the scaffold is the bulk of a site's triangles."""
    pole(p, a, b, r, n=4)


def blob(p, cx, cy, r, z0, h, key, n=8, jitter=.18, top_scale=.55):
    """Irregular low-poly lump (sand heap, rough stone, chippings)."""
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


def patch(p, cx, cy, rx, ry, key, n=9, z=.015):
    """Flat irregular ground stain (sawdust, chippings, spilt sand)."""
    pts = [(cx + math.cos(2 * math.pi * i / n) * rx * rng.uniform(.8, 1.15),
            cy + math.sin(2 * math.pi * i / n) * ry * rng.uniform(.8, 1.15)) for i in range(n)]
    p.quads([(x, y, z) for x, y in pts], [tuple(range(n))], key)


def rope_line(p, pts, w=.035):
    for a, b in zip(pts, pts[1:]):
        p.beam(a, b, w, w, 'rope')


def stone(p, c, size, key='block', yaw=0.0):
    p.box(c, size, key, rot=Matrix.Rotation(yaw, 3, 'Z'))


def hammer(p, head, yaw, key_head='iron'):
    """Mason's hammer lying on a surface: head centre at `head`, handle along yaw.
    Slightly oversized so it still reads at game zoom."""
    d = Vector((math.cos(yaw), math.sin(yaw), 0))
    h = Vector(head)
    p.beam(h, h + d * .5, .05, .05, 'woodLight')
    p.box(tuple(h), (.12, .28, .1), key_head, rot=Matrix.Rotation(yaw, 3, 'Z'))


def chisel(p, a, b):
    """Iron chisel: shaft with a flared bit at b (oversized like the hammer)."""
    a, b = Vector(a), Vector(b)
    p.beam(a, b, .035, .035, 'iron')
    p.taper(b, b + (b - a).normalized() * .07, .035, .035, .08, .012, 'blade')


# ------------------------------------------------------------------ ladders
def ladder(m, length, lean_deg=75):
    """Leaning ladder: top against the wall face (x = 0), foot out on +X.
    Rails narrow towards the top like hand-made ladders; rungs every 0.3 m."""
    lean = math.radians(lean_deg)
    foot_x, top_z = length * math.cos(lean), length * math.sin(lean)
    p = m.part('ladder')
    for s in (-1, 1):
        a = (foot_x, s * .24, 0)
        b = (0.04, s * .19, top_z)
        p.beam(a, b, .06, .08, 'wood')
    n = int(length / .3)
    for i in range(1, n):
        t = i / n
        x, z, half = foot_x * (1 - t) + .04 * t, top_z * t, .24 * (1 - t) + .19 * t
        p.beam((x, -half - .03, z), (x, half + .03, z), .045, .045, 'woodLight')
    m.done('ladder', p)
    m.meta.update(length=length, topZ=round(top_z, 3), footX=round(foot_x, 3))


def ladder_short(m):
    ladder(m, 3.2)


def ladder_long(m):
    ladder(m, 5.3)


# ------------------------------------------------------------------ scaffold
def scaffold_bay(m):
    """One storey of medieval putlog scaffold against a wall at x = 0.
    A single row of standards stands REACH in front of the wall; putlogs run from
    the ledger into holes in the masonry; the deck is planks laid on the putlogs.
    The bay spans y in [-BAY/2, BAY/2] and z in [0, STOREY]: repeat it along y
    and stack it in z. Its own standard is at -y; 'end' closes a run at +y."""
    y0, y1, top = -BAY / 2, BAY / 2, STOREY
    p = m.part('frame')
    spole(p, (REACH, y0, 0), (REACH, y0, top), .065)
    spole(p, (REACH + .02, y0 - .05, top - .1), (REACH + .02, y1 + .05, top - .1), .05)     # ledger
    for y in (y0 + .3, 0, y1 - .3):
        p.beam((-.25, y, top - .02), (REACH + .15, y, top - .02), .09, .09, 'woodDark')    # putlogs into the wall
    lashing(p, (REACH, y0, top - .1))
    p.box((.0, 0, top - .02), (.06, BAY - .2, .14), 'dark')                                 # putlog holes' shadow
    m.done('frame', p)

    p = m.part('deck')
    for i in range(4):
        x = .14 + i * .3
        p.box((x, rng.uniform(-.04, .04), top + .055), (.28, BAY - .06, .04),
              'plank' if i % 2 else 'woodLight', rot=Matrix.Rotation(rng.uniform(-.012, .012), 3, 'Z'))
    m.done('deck', p)

    p = m.part('brace')
    spole(p, (REACH + .07, y0 + .05, .1), (REACH + .07, y1 - .05, top - .2), .04)
    m.done('brace', p)

    # Guard rail for the top storey: standard stub above the deck and a rail.
    p = m.part('rail')
    spole(p, (REACH, y0, top), (REACH, y0, top + 1.1), .06)
    spole(p, (REACH + .02, y0 - .05, top + 1.0), (REACH + .02, y1 + .05, top + 1.0), .04)
    p.box((REACH - .02, 0, top + .16), (.04, BAY, .18), 'plank')                            # toe board
    lashing(p, (REACH, y0, top + 1.0), r=.08)
    m.done('rail', p)

    p = m.part('end')                                                                       # closing standard
    spole(p, (REACH, y1, 0), (REACH, y1, top), .065)
    lashing(p, (REACH, y1, top - .1))
    m.done('end', p)
    p = m.part('endRail')                                                                   # its stub on the top storey
    spole(p, (REACH, y1, top), (REACH, y1, top + 1.1), .06)
    lashing(p, (REACH, y1, top + 1.0), r=.08)
    m.done('endRail', p)
    m.meta.update(bay=BAY, storey=STOREY, reach=REACH)


# ------------------------------------------------------------------ material pile
def material_pile(m):
    p = m.part('ground')
    patch(p, 0, 0, 2.0, 1.7, 'dirt', n=10, z=.012)
    m.done('ground', p)

    # Squared timbers on two bearers, sticks between the layers.
    p = m.part('timber')
    tx0, tx1, ty = -1.5, 1.3, -1.05
    for x in (tx0 + .3, tx1 - .3):
        p.box((x, ty, .06), (.14, 1.05, .12), 'woodDark')
    for layer in range(3):
        z = .12 + layer * .25
        for i in range(4 - layer // 2):
            y = ty - .36 + i * .24 + (layer % 2) * .05
            p.box(((tx0 + tx1) / 2 + rng.uniform(-.1, .1), y, z + .1), (tx1 - tx0, .2, .2), 'wood' if (i + layer) % 2 else 'woodLight')
        if layer < 2:
            for x in (tx0 + .3, tx1 - .3):
                p.box((x, ty, z + .225), (.06, 1.0, .05), 'woodDark')
    m.done('timber', p)

    # Ashlar blocks stacked two high.
    p = m.part('stone')
    for i, (x, y, z) in enumerate([(-1.2, .55, 0), (-.5, .55, 0), (-1.2, 1.12, 0), (-.5, 1.12, 0), (-.85, .84, .42)]):
        stone(p, (x, y, z + .21), (.62, .5, .42), 'block', yaw=rng.uniform(-.06, .06))
    blob(p, .05, 1.35, .22, 0, .25, 'rock', n=6)
    m.done('stone', p)

    # A pallet of bricks (used when the building is in brick).
    p = m.part('bricks')
    p.box((.55, -.05, .05), (.8, .6, .1), 'woodDark')
    for layer in range(4):
        for i in range(3):
            if layer % 2:
                p.box((.55, -.05 - .2 + i * .2, .16 + layer * .09), (.74, .18, .08), 'brick' if i % 2 else 'brickDark')
            else:
                p.box((.55 - .25 + i * .25, -.05, .16 + layer * .09), (.23, .54, .08), 'brickDark' if i % 2 else 'brick')
    m.done('bricks', p)

    # Sand heap with a shovel, mortar trough.
    p = m.part('sand')
    blob(p, 1.1, .9, .7, 0, .55, 'sand', n=9, jitter=.12, top_scale=.3)
    p.beam((1.0, .7, .3), (.7, .35, 1.1), .04, .04, 'woodLight')
    p.box((1.03, .73, .26), (.2, .03, .24), 'iron', rot=Matrix.Rotation(.85, 3, 'Z'))
    m.done('sand', p)
    p = m.part('mortar')
    p.box((1.45, -.85, .18), (.9, .55, .3), 'wood')
    p.box((1.45, -.85, .335), (.8, .45, .02), 'mortar')
    p.beam((1.2, -.8, .36), (1.55, -.95, .55), .04, .04, 'woodDark')                       # hoe
    m.done('mortar', p)


# ------------------------------------------------------------------ carpenter
def carpenter_bench(m):
    p = m.part('ground')
    patch(p, .1, 1.1, .7, .55, 'sawdust')
    m.done('ground', p)

    # Trestle bench along Y with splayed legs.
    p = m.part('bench')
    top = .8
    p.box((0, 0, top - .04), (.5, 2.2, .08), 'plank')
    for y in (-.8, .8):
        p.box((0, y, top - .13), (.42, .12, .1), 'woodDark')
        for sx in (-1, 1):
            for sy in (-1, 1):
                p.beam((sx * .14, y + sy * .03, top - .16), (sx * .3, y + sy * .12, 0), .06, .06, 'woodDark')
    m.done('bench', p)

    # Squared beam overhanging the end, half sawn; offcuts and planks.
    p = m.part('work')
    bz = top + .1
    p.box((0, .15, bz), (.2, 2.3, .2), 'wood')
    p.box((0, 1.15, bz + .03), (.21, .02, .15), 'dark')                                       # the kerf
    p.box((0, 1.3, bz), (.205, .005, .2), 'cut')
    for i, (x, y) in enumerate(((.5, 1.4), (-.45, 1.25), (.35, .95))):
        p.box((x, y, .07), (.2, .3 if i else .45, .14), 'cut' if i % 2 else 'wood', rot=Matrix.Rotation(i * 1.1, 3, 'Z'))
    for i in range(3):                                                                        # planks leaning on the bench
        x = -.33 - i * .05
        p.box((x, -.55 + i * .32, .7), (.03, .26, 1.45), 'plank' if i % 2 else 'woodLight', rot=Matrix.Rotation(-.22, 3, 'Y'))
    m.done('work', p)

    # Bow saw (frame saw) standing in the kerf: blade below, stretcher, tensioning cord.
    p = m.part('saw')
    y, bl = 1.15, .42
    for sx in (-1, 1):
        p.box((sx * bl, y, bz + .28), (.04, .03, .62), 'woodLight')                          # arms
    p.box((0, y, bz + .27), (2 * bl, .03, .035), 'woodLight')                                # stretcher
    p.box((0, y, bz + .03), (2 * bl + .06, .008, .06), 'blade')                              # blade in the cut
    p.box((0, y, bz + .55), (2 * bl, .02, .02), 'rope')                                      # twisted cord
    p.box((.12, y, bz + .43), (.03, .02, .26), 'woodDark')                                   # toggle stick
    m.done('saw', p)


# ------------------------------------------------------------------ stonemason
def mason_bench(m):
    p = m.part('ground')
    patch(p, .2, 0, 1.2, .9, 'chips', n=10)
    for _ in range(7):
        blob(p, rng.uniform(-.6, 1.0), rng.uniform(-.8, .8), rng.uniform(.04, .08), .01, .05, 'blockDressed', n=5)
    m.done('ground', p)

    # Banker: heavy timber bench at working height.
    p = m.part('banker')
    top = .72
    p.box((0, 0, top - .07), (.8, 1.3, .14), 'woodDark')
    for sx in (-1, 1):
        for sy in (-1, 1):
            p.box((sx * .3, sy * .52, (top - .14) / 2), (.16, .16, top - .14), 'wood')
    p.box((0, 0, .18), (.6, 1.04, .08), 'wood')                                              # stretcher shelf
    m.done('banker', p)

    # The block being dressed: rough body, one finished face toward +X, drafted edge.
    p = m.part('block')
    bz = top + .22
    p.box((-.03, -.1, bz), (.5, .7, .44), 'block')
    p.box((.225, -.1, bz), (.012, .66, .4), 'blockDressed')
    p.box((-.03, -.1, bz + .222), (.42, .62, .01), 'blockDressed')                            # dressed top bed
    m.done('block', p)

    # Hammer and chisel on the banker, beside the block.
    p = m.part('tools')
    hammer(p, (.2, .45, top + .05), 2.6)
    chisel(p, (-.3, .5, top + .02), (-.02, .42, top + .02))
    chisel(p, (.05, -.3, bz + .4), (.2, -.2, bz + .2))                                       # one set to the block
    m.done('tools', p)

    # Rough blocks waiting and two finished ones.
    p = m.part('stones')
    for x, y, s, yaw in ((-.95, -.55, (.55, .45, .4), .3), (-1.0, .45, (.6, .5, .45), -.2), (-.9, .0, (.5, .4, .35), .9)):
        stone(p, (x, y, s[2] / 2), s, 'rock', yaw)
    stone(p, (.95, .7, .2), (.55, .42, .4), 'blockDressed', .1)
    stone(p, (.98, .7, .6), (.5, .4, .4), 'blockDressed', -.08)
    m.done('stones', p)


# ------------------------------------------------------------------ hoist
def hoist(m):
    """Tripod with a block and tackle: two falls to a lower block, hook, slung stone,
    hauling rope belayed to a stake."""
    apex = Vector((0, 0, 4.3))
    p = m.part('frame')
    for a in (60, 180, 300):
        ang = math.radians(a)
        foot = Vector((math.cos(ang) * 1.7, math.sin(ang) * 1.7, 0))
        pole(p, foot, apex + (apex - foot).normalized() * .35, .08)
    p.cylinder(.13, 0, 'rope', n=7, axis='z', center=apex, radii=[.13, .13], along=[-.12, .12])
    m.done('frame', p)

    p = m.part('tackle')
    top_block, low_block = apex + Vector((0, 0, -.45)), Vector((0, 0, 2.3))
    p.beam(apex + Vector((0, 0, -.1)), top_block + Vector((0, 0, .15)), .03, .03, 'rope')
    p.box(tuple(top_block), (.12, .2, .3), 'woodDark')
    p.cylinder(.1, .07, 'wood', n=8, axis='y', center=top_block)
    p.box(tuple(low_block), (.12, .18, .26), 'woodDark')
    p.cylinder(.09, .065, 'wood', n=8, axis='y', center=low_block)
    for dx in (-.08, .08):                                                                   # the two falls
        p.beam(top_block + Vector((dx, 0, -.1)), low_block + Vector((dx, 0, .1)), .03, .03, 'rope')
    hook = low_block + Vector((0, 0, -.25))
    p.beam(low_block + Vector((0, 0, -.13)), hook, .03, .03, 'iron')
    # Hauling part: from the top block out to a stake, with a coil on the ground.
    stake = Vector((2.1, .9, .35))
    rope_line(p, [top_block + Vector((.1, 0, 0)), Vector((1.3, .55, 1.15)), stake])
    p.box((stake.x, stake.y, .25), (.08, .08, .5), 'woodDark')
    p.ring(.32, .2, .04, 'rope', n=10, axis='z', center=(2.35, .35, .04))
    p.ring(.26, .16, .04, 'rope', n=10, axis='z', center=(2.35, .35, .12))
    m.done('tackle', p)

    p = m.part('load')
    bz = 1.15
    stone(p, (0, 0, bz), (.65, .45, .42), 'block')
    for sx in (-1, 1):                                                                        # rope sling
        rope_line(p, [hook, Vector((sx * .26, 0, bz + .22)), Vector((sx * .33, 0, bz - .22))], w=.03)
    m.done('load', p)


# ------------------------------------------------------------------ treadwheel crane
def treadwheel_crane(m):
    """Great wheel turning a drum; the rope runs over the mast head and out along the
    jib to a pulley, down to a hook lifting a block. Wheel at -X, load at +X."""
    xw, zw, R, half = -2.0, 2.15, 1.9, .5
    xm, mast_h = .25, 6.3
    tip = Vector((3.6, 0, 6.7))

    p = m.part('base')                                                                       # ground sills
    for y in (-.85, .85):
        p.box((xw, y, .1), (3.0, .22, .2), 'woodDark')
    for x in (xw - 1.2, xw + 1.2):
        p.box((x, 0, .1), (.22, 2.0, .2), 'woodDark')
    p.box((xm, 0, .1), (2.8, .26, .2), 'woodDark')
    p.box((xm, 0, .1), (.26, 2.8, .2), 'woodDark')
    p.box(((xw + 1.2 + xm) / 2, 0, .1), (xm - xw - 1.2, .22, .2), 'woodDark')               # tie sill
    m.done('base', p)

    p = m.part('wheel')
    for y in (-half, half):
        p.ring(R, R - .16, .06, 'wood', n=16, axis='y', center=(xw, y, zw), side_key='woodDark')
        for k in range(4):
            a = math.pi * k / 4
            d = Vector((math.cos(a), 0, math.sin(a))) * (R - .1)
            c = Vector((xw, y, zw))
            p.beam(c - d, c + d, .09, .09, 'woodDark')
    for k in range(20):                                                                      # treads
        a = 2 * math.pi * k / 20
        p.box((xw + math.cos(a) * (R - .2), 0, zw + math.sin(a) * (R - .2)), (.18, 2 * half + .12, .04),
              'woodLight' if k % 2 else 'plank', rot=Matrix.Rotation(-(a + math.pi / 2), 3, 'Y'))
    p.cylinder(.12, .95, 'woodDark', n=8, axis='y', center=(xw, 0, zw), cap_key='poleEnd')    # axle
    p.cylinder(.3, .22, 'rope', n=10, axis='y', center=(xw, 0, zw), cap_key='wood')           # drum with rope
    m.done('wheel', p)

    p = m.part('frame')                                                                      # A-frames carrying the axle
    for y in (-.85, .85):
        for sx in (-1, 1):
            p.beam((xw + sx * 1.15, y, .2), (xw + sx * .08, y, zw + .1), .14, .14, 'wood')
        p.box((xw, y, zw - .02), (.34, .2, .22), 'woodDark')
        p.beam((xw - .6, y, 1.0), (xw + .6, y, 1.0), .1, .1, 'wood')
    # Mast with four raking shores and the jib with its strut.
    p.box((xm, 0, mast_h / 2), (.3, .3, mast_h), 'wood')
    for d in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        p.beam((xm + d[0] * 1.3, d[1] * 1.3, .2), (xm + d[0] * .15, d[1] * .15, 2.4), .14, .14, 'woodDark')
    p.beam((xm - .1, 0, mast_h - .35), tip, .22, .22, 'wood')
    p.beam((xm + .1, 0, 3.4), (xm + 2.0, 0, 6.3), .16, .16, 'woodDark')
    p.cylinder(.2, .14, 'woodDark', n=8, axis='y', center=(xm, 0, mast_h), cap_key='wood')    # mast-head sheave
    p.cylinder(.18, .14, 'woodDark', n=8, axis='y', center=tuple(tip + Vector((0, 0, -.12))), cap_key='wood')
    m.done('frame', p)

    p = m.part('rope')
    hook = Vector((tip.x + .18, 0, 2.75))
    rope_line(p, [Vector((xw + .05, 0, zw + .3)), Vector((xm - .12, 0, mast_h + .15)),
                  Vector((tip.x, 0, tip.z + .06)), Vector((tip.x + .18, 0, tip.z - .12)), hook])
    p.box((hook.x, 0, hook.z - .08), (.06, .06, .16), 'iron')
    m.done('rope', p)

    p = m.part('load')
    bz = 2.0
    stone(p, (hook.x, 0, bz), (.8, .55, .5), 'block')
    for sx in (-1, 1):
        rope_line(p, [hook + Vector((0, 0, -.12)), Vector((hook.x + sx * .32, 0, bz + .25)), Vector((hook.x + sx * .4, 0, bz - .25))], w=.03)
    m.done('load', p)


MODELS = [('ladderShort', ladder_short), ('ladderLong', ladder_long), ('scaffoldBay', scaffold_bay),
          ('materialPile', material_pile), ('carpenterBench', carpenter_bench), ('masonBench', mason_bench),
          ('hoist', hoist), ('treadwheelCrane', treadwheel_crane)]
LAYOUT = {'ladderShort': (-6, 0), 'ladderLong': (-4, 0), 'scaffoldBay': (0, 0), 'materialPile': (6, 0),
          'carpenterBench': (11, 0), 'masonBench': (15, 0), 'hoist': (20, 0), 'treadwheelCrane': (28, 0)}


def main(out_path):
    root = fresh_collection(COLL_NAME)
    data = {'palette': list(COLORS.values()), 'paletteKeys': KEYS, 'metersPerU': METERS_PER_U, 'models': {}}
    total, stats = 0, {}
    for name, fn in MODELS:
        m = Model(root, name, (*LAYOUT[name], 0))
        rng.seed(sum(map(ord, name)))
        fn(m)
        parts = {k: export_part_indexed(p, KEYS) for k, p in m.parts.items()}
        n = sum(len(p['c']) for p in parts.values())
        stats[name] = n
        total += n
        data['models'][name] = {'parts': parts, 'meta': m.meta}
    js = ("'use strict';\n// Generated by tools/blender/build_construction.py — do not edit by hand.\n"
          "// Construction-site props in model space (U): +x front, +y left, +z up, origin on the ground.\n"
          "// Wall-mounted props (ladders, scaffold) have the wall face at x = 0.\n"
          "// Parts: p = vertex xyz, i = 3 indices per triangle, c = palette index per triangle.\n"
          "// meta lengths are in metres (divide by metersPerU).\n"
          "window.ConquerConstructionModels=" + json.dumps(data, separators=(',', ':')) + ";\n")
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, 'w', encoding='utf-8', newline='\n') as f:
        f.write(js)
    print(f"construction models: {len(stats)} models, {total} triangles, {len(js) // 1024} KB -> {out_path}")
    print(stats)
    return {'total': total, 'kb': len(js) // 1024, 'models': stats}


if __name__ == '__main__' and '--' in sys.argv:
    args = sys.argv[sys.argv.index('--') + 1:]
    main(args[args.index('--out') + 1])
elif 'CONSTRUCTION_OUT' in globals():
    CONSTRUCTION_RESULT = main(CONSTRUCTION_OUT)
