"""CONQUER environmental scatter builder (Blender 4.4+).

Small props that dress the settlement: parked carts, goods, signs, wheels and cart
parts, timber and stone piles, farm objects and work furniture. Built in real
metres with the wagon's parts and palette (build_wagon.py, cq_blender.py) and
exported as src/assets/scatter-model.js for src/settlement-scatter.js.

    blender.exe -b --factory-startup --python build_scatter.py -- --out <path>
or inside Blender (BlenderMCP): CQ_DIR = r"...\\tools\\blender"; SCATTER_OUT = r"..."; exec(open(...).read())

Axes as the wagon: +X forward, +Y left, +Z up, origin on the ground at the middle of
the prop. Shading is not baked (the game applies the castle two-tone rule).
"""
import json, math, os, sys, importlib
from mathutils import Vector, Matrix
_here = os.path.dirname(os.path.abspath(__file__)) if '__file__' in globals() else CQ_DIR
if _here not in sys.path:
    sys.path.insert(0, _here)
import cq_blender, build_wagon
importlib.reload(cq_blender); importlib.reload(build_wagon)
from cq_blender import METERS_PER_U, Part, fresh_collection, export_part
from build_wagon import bed, axle
import build_wagon as _bw

def wheel(part, r, half=.045):
    """The wagon wheel with six spokes: props are seen small and in numbers."""
    _bw.wheel(part, r, half, spokes=6)

COLORS = dict(build_wagon.COLORS)
COLORS.update({
    'rope': '#a88a5a', 'board': '#b07c48', 'boardDark': '#7d5531', 'paint': '#3b2a1a',
    'stoneLight': '#b4b1aa', 'straw': '#d6b551', 'strawDark': '#b8973f', 'bark': '#6a4c30',
})
COLL_NAME = 'CONQUER_Scatter'
FAMILIES = ('carts', 'goods', 'signs', 'wheels', 'materials', 'farm', 'work')

# ---------------------------------------------------------------- helpers
def mark(p):
    p.bm.verts.ensure_lookup_table()
    return len(p.bm.verts)

def xform(p, start, mat):
    """Transform the vertices created since mark() (a rigid sub-assembly)."""
    p.bm.verts.ensure_lookup_table()
    for v in p.bm.verts[start:]:
        v.co = mat @ v.co

def about(axis, angle, pivot):
    piv = Vector(pivot)
    return Matrix.Translation(piv) @ Matrix.Rotation(angle, 4, axis) @ Matrix.Translation(-piv)

def move(x, y, z):
    return Matrix.Translation(Vector((x, y, z)))

def turn_z(a):
    return Matrix.Rotation(a, 3, 'Z')

def crate(p, x, y, z, s=.5, a=0):
    p.box((x, y, z + s * .44), (s, s, s * .88), 'woodLight', rot=turn_z(a))
    for sx, sy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        w = (s + .02, .03) if sy else (.03, s + .02)
        c = Vector((sx * (s / 2 + .005), sy * (s / 2 + .005), 0))
        c = turn_z(a) @ c
        p.box((x + c.x, y + c.y, z + s * .44), (*w, .07), 'woodDark', rot=turn_z(a))

def barrel(p, x, y, z=0):
    p.cylinder(.2, 0, 'barrel', n=10, axis='z', center=(x, y, z), radii=[.18, .23, .23, .18], along=[0, .2, .36, .56], cap_key='woodLight')
    for h in (.08, .48):
        p.cylinder(.2, 0, 'iron', n=10, axis='z', center=(x, y, z), radii=[.235, .24], along=[h, h + .04])

def barrel_lying(p, x, y, a=0):
    m = mark(p)
    p.cylinder(.2, 0, 'barrel', n=10, axis='x', center=(0, 0, .23), radii=[.18, .23, .23, .18], along=[-.28, -.08, .08, .28], cap_key='woodLight')
    for h in (-.2, .16):
        p.cylinder(.2, 0, 'iron', n=10, axis='x', center=(0, 0, .23), radii=[.235, .24], along=[h, h + .04])
    xform(p, m, move(x, y, 0) @ Matrix.Rotation(a, 4, 'Z'))

def sack(p, x, y, z=0, a=0, lying=True):
    m = mark(p)
    if lying:
        p.cylinder(.2, 0, 'sack', n=8, axis='x', center=(0, 0, .16), radii=[.08, .2, .22, .2, .1], along=[-.32, -.22, 0, .2, .3], cap_key='sackDark', squash=.75)
        p.cylinder(.08, 0, 'twine', n=8, axis='x', center=(0, 0, .16), radii=[.1, .1], along=[.24, .27], squash=.75)
    else:
        p.cylinder(.22, 0, 'sack', n=8, axis='z', radii=[.2, .25, .22, .1, .07], along=[0, .14, .32, .44, .5], cap_key='sackDark')
        p.cylinder(.08, 0, 'twine', n=8, axis='z', radii=[.085, .085], along=[.42, .46])
    xform(p, m, move(x, y, z) @ Matrix.Rotation(a, 4, 'Z'))

def bale(p, x, y, z=0, a=0):
    p.box((x, y, z + .2), (.62, .42, .4), 'hay', rot=turn_z(a))
    for s in (-1, 1):
        c = turn_z(a) @ Vector((s * .16, 0, 0))
        p.box((x + c.x, y + c.y, z + .2), (.04, .44, .42), 'twine', rot=turn_z(a))

def log(p, x, y, z, length, r, axis='x', key='log', end='logEnd', n=8):
    p.cylinder(r, length / 2, key, n=n, axis=axis, center=(x, y, z), cap_key=end)

def bucket(p, x, y, r=.16, h=.32):
    p.cylinder(r, 0, 'wood', n=10, axis='z', center=(x, y, 0), radii=[r * .85, r], along=[0, h], cap_key='woodDark')
    for z in (.06, h - .06):
        p.cylinder(r, 0, 'iron', n=10, axis='z', center=(x, y, 0), radii=[r * .9 + .012, r * .97 + .012], along=[z, z + .025])

def solve(f, lo, hi, it=40):
    """Bisection for f(x)=0 on [lo,hi] (tilt angles that put a point on the ground)."""
    for _ in range(it):
        mid = (lo + hi) / 2
        if (f(lo) > 0) == (f(mid) > 0):
            lo = mid
        else:
            hi = mid
    return (lo + hi) / 2

def tilt_z(point, pivot, axis, angle):
    return (about(axis, angle, pivot) @ Vector(point)).z

# ---------------------------------------------------------------- assets
def cart_parked(p):
    """Two-wheel cart resting on its shafts, no horse."""
    m = mark(p)
    bed(p, -.9, .9, .6, .85, 1.2); axle(p, 0, .65, .8)
    for s in (-1, 1):
        p.beam((.9, s * .35, .75), (3.1, s * .3, .95), .06, .06, 'woodDark')
    p.beam((1.0, -.36, .77), (1.0, .36, .77), .06, .06, 'woodDark')
    pivot = (0, 0, .65)
    ang = solve(lambda a: tilt_z((3.1, 0, .92), pivot, 'Y', a) - .03, 0, .6)
    xform(p, m, about('Y', ang, pivot))
    for s in (-1, 1):
        w = mark(p); wheel(p, .65); xform(p, w, move(0, s * .8, .65))

def wagon_base(p, loaded=False):
    m = mark(p)
    bed(p, -1.5, 1.5, .65, .9, 1.28)
    axle(p, -1.0, .6, .85); axle(p, 1.05, .45, .85)
    p.box((1.05, 0, .68), (.22, 1.1, .36), 'woodDark')
    p.box((1.32, 0, 1.5), (.36, 1.1, .06), 'woodLight')
    for s in (-1, 1):
        p.box((1.32, s * .5, 1.38), (.06, .06, .2), 'woodDark')
    p.box((1.12, 0, 1.62), (.05, 1.1, .2), 'wood')
    p.beam((1.1, 0, .45), (3.0, 0, .06), .08, .08, 'woodDark')          # pole resting on the ground
    for x, r in ((-1.0, .6), (1.05, .45)):
        for s in (-1, 1):
            w = mark(p); wheel(p, r); xform(p, w, move(x, s * .85, r))
    if loaded:
        for i, (x, y) in enumerate(((-1.05, .28), (-1.05, -.28), (-.45, .3))):
            crate(p, x, y, .9, .46, .1 * i)
        for x, y in ((.15, .25), (.2, -.25)):
            sack(p, x, y, .9, 0)
        barrel(p, -.45, -.28, .9)

def wagon_parked(p):
    wagon_base(p)

def carriage_parked(p):
    """The noble carriage of the animations (build_wagon.carriage), pole on the ground."""
    c = build_wagon.CARRIAGE
    build_wagon.carriage(p)
    for x, r in ((c['rearX'], c['rearR']), (c['frontX'], c['frontR'])):
        for s in (-1, 1):
            w = mark(p); _bw.wheel(p, r, spokes=10); xform(p, w, move(x, s * c['track'], r))
    p.beam((1.2, 0, .5), (3.2, 0, .06), .08, .08, 'lacquerDark')

def wagon_loaded(p):
    wagon_base(p, loaded=True)

def crate_stack(p):
    crate(p, -.27, -.26, 0, .5, .05); crate(p, .27, -.24, 0, .5, -.08); crate(p, -.24, .3, 0, .5, .12)
    crate(p, -.05, -.05, .44, .48, .3)

def barrel_group(p):
    barrel(p, -.25, -.2); barrel(p, .25, -.18); barrel(p, 0, .26)
    barrel_lying(p, .62, .35, .4)

def sack_pile(p):
    for i, (x, y) in enumerate(((-.3, -.22), (.32, -.2), (-.28, .24), (.3, .26))):
        sack(p, x, y, 0, .15 * (i - 1.5))
    sack(p, 0, 0, .26, .3)

def goods_mixed(p):
    crate(p, -.3, -.15, 0, .5, .1); barrel(p, .3, -.2)
    sack(p, -.1, .38, 0, .5); sack(p, .4, .35, 0, -.3, lying=False)

def signpost(p):
    p.box((0, 0, .1), (.32, .32, .2), 'stone')
    p.box((0, 0, 1.15), (.11, .11, 2.1), 'woodDark')
    p.box((0, 0, 2.23), (.16, .16, .06), 'wood')
    for z, a, d in ((1.85, .35, 1), (1.55, -.6, -1)):
        r = turn_z(a)
        c = r @ Vector((d * .42, 0, 0))
        p.box((c.x, c.y, z), (.84, .04, .2), 'board', rot=r)
        t = r @ Vector((d * .88, 0, 0))
        p.box((t.x, t.y, z), (.12, .045, .14), 'boardDark', rot=r @ Matrix.Rotation(math.pi / 4, 3, 'Y'))
        s = r @ Vector((d * .42, 0, 0))
        p.box((s.x, s.y, z), (.6, .05, .035), 'paint', rot=r)

def hanging_sign(p):
    p.box((0, 0, .08), (.36, .36, .16), 'stone')
    p.box((0, 0, 1.25), (.12, .12, 2.5), 'woodDark')
    p.beam((0, 0, 2.3), (.95, 0, 2.3), .08, .08, 'woodDark')
    p.beam((0, 0, 1.9), (.5, 0, 2.28), .05, .05, 'woodDark')                 # brace
    for x in (.55, .9):
        p.beam((x, 0, 2.26), (x, 0, 2.0), .015, .015, 'iron')
    p.box((.72, 0, 1.78), (.5, .04, .44), 'board')
    p.box((.72, 0, 1.78), (.3, .05, .2), 'paint')

def milestone(p):
    p.box((0, 0, .04), (.55, .45, .08), 'stoneDark')
    p.taper((0, 0, .08), (0, 0, .85), .36, .26, .3, .22, 'stoneLight', end_key='stone')
    p.box((0, 0, .89), (.32, .24, .08), 'stone')
    p.box((.155, 0, .55), (.01, .16, .2), 'stoneDark')

def wheel_lying(p):
    w = mark(p); wheel(p, .6); xform(p, w, move(0, 0, .05) @ Matrix.Rotation(math.pi / 2, 4, 'X'))

def wheel_stack(p):
    for i, z in enumerate((.05, .145)):
        w = mark(p); wheel(p, .6); xform(p, w, move(.02 * i, -.02 * i, z) @ Matrix.Rotation(math.pi / 2 + .03 * i, 4, 'X'))
    w = mark(p); wheel(p, .45)
    xform(p, w, move(.78, .05, .43) @ Matrix.Rotation(-.3, 4, 'Y') @ Matrix.Rotation(math.pi / 2, 4, 'Z'))
    p.box((-.05, .2, .26), (.1, 1.1, .1), 'woodDark', rot=turn_z(.5))          # loose axle on top

def broken_cart(p):
    m = mark(p)
    bed(p, -.9, .9, .6, .85, 1.2); axle(p, 0, .65, .8)
    w = mark(p); wheel(p, .65); xform(p, w, move(0, .8, .65))
    pivot = (0, .8 + .045, 0)
    ang = solve(lambda a: tilt_z((0, -.8, .6), pivot, 'X', a) - .06, 0, .7)
    xform(p, m, about('X', ang, pivot))
    w = mark(p); wheel(p, .65); xform(p, w, move(.4, -1.55, .05) @ Matrix.Rotation(math.pi / 2, 4, 'X'))
    p.beam((-1.2, -.9, .04), (.6, -1.1, .04), .06, .06, 'woodDark')          # dropped shaft

def log_pile(p):
    rows = ((.14, (-.42, -.14, .14, .42)), (.38, (-.28, 0, .28)), (.62, (-.14, .14)))
    for z, ys in rows:
        for i, y in enumerate(ys):
            log(p, .04 * ((i + len(ys)) % 3 - 1), y, z, 2.2, .14)
    for s in (-1, 1):
        p.box((0, s * .62, .45), (.09, .09, .9), 'bark')

def plank_stack(p):
    for layer in range(5):
        z = .1 + layer * .065
        for i in range(4):
            p.box((0, -.39 + i * .26, z), (2.4, .24, .04), 'woodLight' if (i + layer) % 2 else 'wood')
        if layer < 4:
            for x in (-.9, 0, .9):
                p.box((x, 0, z + .033), (.06, 1.05, .026), 'woodDark')
    for x in (-.9, 0, .9):
        p.box((x, 0, .04), (.1, 1.05, .08), 'woodDark')

def stone_pile(p):
    blocks = ((-.32, -.22, 0, .2), (.3, -.25, 0, -.1), (-.3, .25, 0, -.15), (.32, .22, 0, .25), (0, 0, .3, .4), (.05, -.3, .3, -.2))
    for x, y, z, a in blocks:
        p.box((x, y, z + .15), (.55, .38, .3), 'stoneLight' if a > 0 else 'stone', rot=turn_z(a))
    vs = [(-.2, -.17, 0), (.2, -.17, 0), (.2, .17, 0), (-.2, .17, 0), (-.15, -.12, .22), (.17, -.1, .2), (.13, .13, .24), (-.17, .11, .21)]
    for x, y in ((.85, .1), (-.8, -.2)):
        p.quads([(vx + x, vy + y, vz) for vx, vy, vz in vs], [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)], 'stoneDark')

def firewood(p):
    for s in (-1, 1):
        p.box((s * .85, 0, .55), (.08, .08, 1.1), 'bark')
    for row in range(4):
        for col in range(8):
            x = -.7 + col * .2 + (.1 if row % 2 else 0)
            if x > .76:
                continue
            log(p, x, 0, .09 + row * .17, .45, .09, axis='y', n=5)
    p.box((0, 0, .03), (1.8, .5, .06), 'woodDark')

def hay_bales(p):
    bale(p, -.33, 0, 0, .05); bale(p, .33, .02, 0, -.04); bale(p, 0, .01, .4, .5)

def haystack(p):
    p.cylinder(1, 0, 'straw', n=12, axis='z', radii=[1.0, 1.06, .95, .62, .22, .04], along=[0, .25, .8, 1.45, 1.95, 2.15], cap_key='strawDark')
    p.cylinder(1, 0, 'strawDark', n=12, axis='z', radii=[1.075, 1.08], along=[.32, .4])
    p.box((0, 0, 1.3), (.06, .06, 2.6), 'woodDark')

def farm_tools(p):
    for y in (-.6, .6):
        p.box((0, y, .65), (.08, .08, 1.3), 'woodDark')
    p.beam((0, -.68, 1.2), (0, .68, 1.2), .07, .07, 'wood')
    # pitchfork, rake and scythe leaning on the bar
    p.beam((.55, -.35, .02), (.04, -.32, 1.32), .04, .04, 'woodLight')
    for k in (-1, 0, 1):
        p.beam((.04, -.32 + k * .05, 1.3), (-.1, -.32 + k * .05, 1.6), .015, .015, 'iron')       # tines up
    p.beam((.5, .05, .02), (.04, .02, 1.34), .04, .04, 'woodLight')
    p.beam((.06, -.12, 1.4), (.06, .16, 1.4), .05, .04, 'woodDark')
    p.beam((.52, .42, .02), (.04, .4, 1.36), .045, .045, 'wood')
    p.beam((.06, .4, 1.3), (.2, .9, 1.42), .02, .09, 'ironLight')                # scythe blade

def buckets(p):
    bucket(p, -.25, -.1); bucket(p, .18, -.22, .14, .28)
    p.cylinder(.4, 0, 'wood', n=12, axis='z', center=(.12, .32, 0), radii=[.34, .4], along=[0, .3], cap_key='woodDark')
    for z in (.06, .24):
        p.cylinder(.4, 0, 'iron', n=12, axis='z', center=(.12, .32, 0), radii=[.36, .395], along=[z, z + .025])

def workbench(p):
    p.box((0, 0, .82), (1.7, .62, .08), 'woodLight')
    for sx in (-1, 1):
        for sy in (-1, 1):
            p.box((sx * .75, sy * .25, .39), (.08, .08, .78), 'woodDark')
    p.box((0, 0, .2), (1.55, .5, .04), 'wood')
    p.box((-.72, -.28, .93), (.14, .14, .14), 'woodDark'); p.box((-.72, -.38, .93), (.06, .2, .04), 'iron')
    p.box((.3, .05, .9), (.3, .1, .08), 'woodDark'); p.beam((.3, .05, .9), (.62, .12, .88), .03, .03, 'woodLight')   # mallet
    crate(p, .45, 0, .22, .36, .1)

def ladder(p):
    for s in (-1, 1):
        p.beam((-1.5, s * .22, .04), (1.5, s * .22, .04), .06, .06, 'wood')
    for i in range(10):
        x = -1.35 + i * .3
        p.beam((x, -.22, .045), (x, .22, .045), .035, .035, 'woodLight')

def rope_coil(p):
    for i, (r, z) in enumerate(((.32, .04), (.3, .1), (.27, .16))):
        p.ring(r, r - .1, .03, 'rope', n=14, axis='z', center=(.015 * i, 0, z), side_key='twine')
    p.beam((.3, 0, .03), (.75, .2, .03), .05, .04, 'rope')

def sawhorse(p):
    for x in (-.55, .55):
        for s in (-1, 1):
            p.beam((x, s * .3, 0), (x, 0, .72), .06, .06, 'woodDark')
    p.beam((-.7, 0, .74), (.7, 0, .74), .1, .08, 'wood')
    log(p, 0, .02, .9, 1.6, .12)

def chopping_block(p):
    p.cylinder(.27, 0, 'bark', n=10, axis='z', radii=[.3, .27, .26], along=[0, .1, .46], cap_key='logEnd')
    p.beam((.0, .0, .46), (.42, .2, .9), .035, .035, 'woodLight')              # axe handle
    p.box((-.02, -.01, .5), (.14, .03, .12), 'iron', rot=turn_z(.44))
    for x, y, a in ((.5, -.25, .3), (.62, .05, 1.2), (-.45, .35, -.6), (.35, .45, 2.0)):
        p.box((x, y, .05), (.32, .1, .1), 'logEnd' if a > 1 else 'log', rot=turn_z(a))

ASSETS = (
    ('cartParked', 'carts', cart_parked), ('wagonParked', 'carts', wagon_parked),
    ('carriageParked', 'carts', carriage_parked), ('wagonLoaded', 'carts', wagon_loaded),
    ('crateStack', 'goods', crate_stack), ('barrelGroup', 'goods', barrel_group),
    ('sackPile', 'goods', sack_pile), ('goodsMixed', 'goods', goods_mixed),
    ('signpost', 'signs', signpost), ('hangingSign', 'signs', hanging_sign), ('milestone', 'signs', milestone),
    ('wheelLying', 'wheels', wheel_lying), ('wheelStack', 'wheels', wheel_stack), ('brokenCart', 'wheels', broken_cart),
    ('logPile', 'materials', log_pile), ('plankStack', 'materials', plank_stack),
    ('stonePile', 'materials', stone_pile), ('firewood', 'materials', firewood),
    ('hayBales', 'farm', hay_bales), ('haystack', 'farm', haystack), ('farmTools', 'farm', farm_tools), ('buckets', 'farm', buckets),
    ('workbench', 'work', workbench), ('ladder', 'work', ladder), ('ropeCoil', 'work', rope_coil),
    ('sawhorse', 'work', sawhorse), ('choppingBlock', 'work', chopping_block),
)

def build(root):
    parts = {}
    for i, (name, family, fn) in enumerate(ASSETS):
        p = Part(root, name, COLORS, (FAMILIES.index(family) * 5, (i % 4) * 5, 0), prefix='sc_')
        fn(p)
        parts[name] = (family, p.finish())
    return parts

def export_indexed(part, keys, digits=3):
    """export_part with shared vertices: v = unique xyz (U), i = 3 indices per triangle."""
    flat = export_part(part, keys, digits)
    seen, v, idx = {}, [], []
    for k in range(0, len(flat['v']), 3):
        key = tuple(flat['v'][k:k + 3])
        if key not in seen:
            seen[key] = len(v) // 3; v += key
        idx.append(seen[key])
    return {'v': v, 'i': idx, 'c': flat['c']}

def export(parts, out_path):
    palette = list(COLORS.values()); keys = list(COLORS.keys())
    data = {'unit': 'U', 'metersPerU': METERS_PER_U, 'palette': palette, 'paletteKeys': keys, 'families': list(FAMILIES), 'assets': {}}
    total = 0
    for name, (family, part) in parts.items():
        e = export_indexed(part, keys)
        xs, ys, zs = e['v'][0::3], e['v'][1::3], e['v'][2::3]
        e['family'] = family
        e['r'] = round(max(math.hypot(x, y) for x, y in zip(xs, ys)), 3)       # footprint radius (U)
        e['h'] = round(max(zs), 3)
        data['assets'][name] = e
        total += len(e['c'])
    js = ("'use strict';\n// Generated by tools/blender/build_scatter.py — do not edit by hand.\n"
          "// Scatter props as triangles in model space (U): +x forward, +y left, +z up.\n"
          "window.ConquerScatterModel=" + json.dumps(data, separators=(',', ':')) + ";\n")
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, 'w', encoding='utf-8', newline='\n') as f:
        f.write(js)
    print(f"scatter model: {len(parts)} assets, {total} triangles, {len(js) // 1024} KB -> {out_path}")
    return total

def main(out_path):
    root = fresh_collection(COLL_NAME)
    return export(build(root), out_path)

if __name__ == '__main__' and '--' in sys.argv:
    args = sys.argv[sys.argv.index('--') + 1:]
    main(args[args.index('--out') + 1])
elif 'SCATTER_OUT' in globals():
    SCATTER_RESULT = main(SCATTER_OUT)
