"""CONQUER garderobe builder (Blender 4.4+/5.x): the latrine box corbelled out of the exterior
face of a built section (room function 'latrine', ROOM_EXTERIOR in settlement-room-exterior.js).

Low-poly, flat colours, real metres on the game dimensions (1 U = 3.5 m), as build_hoarding.py.

Axes (U): +X along the face, centred on the element (-W/2..W/2); +Y outward from the face
(0 = the masonry face); +Z up from the floor of the room the box serves.
  box      stone box on a slab, a small vent slit on its front
  corbels  four stepped stone corbels carrying the slab
  roof     lean-to slab roof from the wall down to the outer face
  chute    the drop hole and the stain running down the wall, modelled 0..-1 in Z: the game
           stretches it from the slab down to the ground under the element
Palette keys starting with 'roof' turn white in winter.

Run inside Blender (BlenderMCP execute_code):
    CQ_DIR = r"...\\tools\\blender"; GARDEROBE_OUT = r"...\\src\\assets\\garderobe-models.js"
    exec(open(CQ_DIR + r"\\build_garderobe.py", encoding="utf-8").read())
or headless:
    blender --background --python tools/blender/build_garderobe.py -- --out src/assets/garderobe-models.js
"""
import json, os, sys, importlib
_here = os.path.dirname(os.path.abspath(__file__)) if '__file__' in globals() else CQ_DIR
if _here not in sys.path:
    sys.path.insert(0, _here)
import cq_blender
importlib.reload(cq_blender)
from cq_blender import Part, fresh_collection, export_part_indexed
from mathutils import Vector

S = 3.5
COLORS = {
    'stone': '#6e645b', 'stoneDark': '#4f4842', 'stoneLight': '#8a7f74', 'corbel': '#5d554e',   # castleSideShade tones
    'dark': '#1d1a17', 'stain': '#3d3a2c',
    'roofSlab': '#5b5550', 'roofSlabDark': '#47423e', 'roofUnder': '#2f2b28',
    'wood': '#8a6440', 'woodDark': '#5e4329',   # the seat bench inside the box
}
KEYS = list(COLORS.keys())
COLL_NAME = 'CONQUER_Garderobe'

# Communal garderobe, three seats side by side (user 05/11/2026): wide and shallow.
W, PROJ = .76, .22            # width along the face, projection out of it
HOLES = (-.25, 0, .25)        # drop holes, one per seat
SLAB0, SLAB1 = -.06, 0.0      # floor slab, flush with the room floor
WALL_T = .05
TOP = .56                     # box walls
ROOF_IN, ROOF_OUT = -.03, PROJ + .05      # short eave (user 12/11/2026: it stuck out too much)
ROOF_SIDE = .03                            # eave past each side
ROOF_HI, ROOF_LO, ROOF_T = .80, .60, .04   # the eave underside rests on the front wall top (TOP)
CORBELS = (-.36, -.125, .125, .36)   # between the drop holes


def prism(p, pts, z0, z1, key, top=None, bottom=None):
    n = len(pts)
    vs = [(x * S, y * S, z0 * S) for x, y in pts] + [(x * S, y * S, z1 * S) for x, y in pts]
    p.quads(vs, [(i, (i + 1) % n, n + (i + 1) % n, n + i) for i in range(n)], key)
    p.quads(vs, [tuple(range(n, 2 * n))], top or key)
    p.quads(vs, [tuple(range(n - 1, -1, -1))], bottom or key)


def box(p, x0, x1, y0, y1, z0, z1, key, top=None, bottom=None):
    prism(p, [(x0, y0), (x1, y0), (x1, y1), (x0, y1)], z0, z1, key, top, bottom)


def slab(p, x0, x1, y0, z0, y1, z1, t, key, under):
    vs = [(x * S, y * S, (z + dz) * S) for dz in (0, -t) for x, y, z in ((x0, y0, z0), (x1, y0, z0), (x1, y1, z1), (x0, y1, z1))]
    # One closed solid on shared vertices, so Blender's normal recalculation turns every face out
    # (separate quads calls left the top flipped and the 2.5D back-face test dropped it).
    bv = [p.bm.verts.new(Vector(v)) for v in vs]
    for f, k in (((0, 1, 2, 3), key), ((7, 6, 5, 4), under), ((4, 5, 1, 0), under), ((6, 7, 3, 2), under),
                 ((0, 3, 7, 4), under), ((1, 5, 6, 2), under)):
        face = p.bm.faces.new([bv[i] for i in f])
        face.material_index = p._mat(k)


def garderobe(root):
    h = W / 2
    parts = {}

    b = Part(root, 'box', COLORS)
    box(b, -h - .02, h + .02, -.02, PROJ + .02, SLAB0, SLAB1, 'stoneDark', 'stoneLight')          # slab
    box(b, -h, -h + WALL_T, 0, PROJ, SLAB1, TOP, 'stone', 'stoneLight')                             # side walls
    box(b, h - WALL_T, h, 0, PROJ, SLAB1, TOP, 'stone', 'stoneLight')
    box(b, -h + WALL_T, h - WALL_T, PROJ - WALL_T, PROJ, SLAB1, TOP, 'stone', 'stoneLight')        # front
    # Gables: each side wall rises to the roof underside, so the roof sits on the box (no gap).
    def under(y):
        return ROOF_HI - ROOF_T - (ROOF_HI - ROOF_LO) * (y - ROOF_IN) / (ROOF_OUT - ROOF_IN)
    for x0, x1 in ((-h, -h + WALL_T), (h - WALL_T, h)):
        yz = [(0, TOP), (PROJ, TOP), (PROJ, under(PROJ)), (0, under(0))]
        vs = [(x * S, y * S, z * S) for x in (x0, x1) for y, z in yz]
        b.quads(vs, [(0, 1, 2, 3), (7, 6, 5, 4), (0, 4, 5, 1), (1, 5, 6, 2), (2, 6, 7, 3), (3, 7, 4, 0)], 'stone')
    for x in HOLES:
        box(b, x - .02, x + .02, PROJ, PROJ + .004, .28, .44, 'dark')                               # one vent slit per seat
    box(b, -h - .01, h + .01, PROJ - .01, PROJ + .015, TOP - .04, TOP, 'stoneDark')                 # string course
    parts['box'] = b.finish()

    # Communal seat: a plank bench across the box with a hole over each drop (user 12/11/2026:
    # the seats belong in the garderobe, not in the room).
    bn = Part(root, 'bench', COLORS)
    # Real holes: a body with a dark top, then planks around three openings (no thin decals,
    # which the 2.5D depth sort lets the bench top cover).
    BENCH_H, PLANK, HR, y1 = .2, .03, .05, PROJ - WALL_T
    x0, x1 = -h + WALL_T, h - WALL_T
    box(bn, x0, x1, 0, y1, SLAB1, BENCH_H - PLANK, 'woodDark', 'dark')
    yh0, yh1 = .03, y1 - .03
    box(bn, x0, x1, 0, yh0, BENCH_H - PLANK, BENCH_H, 'woodDark', 'wood')       # back plank
    box(bn, x0, x1, yh1, y1, BENCH_H - PLANK, BENCH_H, 'woodDark', 'wood')      # front plank
    edges = [x0] + [e for x in HOLES for e in (x - HR, x + HR)] + [x1]
    for a, b in zip(edges[0::2], edges[1::2]):                                  # boards between the holes
        box(bn, a, b, yh0, yh1, BENCH_H - PLANK, BENCH_H, 'woodDark', 'wood')
    parts['bench'] = bn.finish()

    c = Part(root, 'corbels', COLORS)
    for x in CORBELS:                                           # three courses, each stepping further out
        for k in range(3):
            z1 = SLAB0 - .045 * k
            box(c, x - .035, x + .035, -.02, PROJ * (3 - k) / 3, z1 - .045, z1, 'corbel', 'stoneLight')
    parts['corbels'] = c.finish()

    r = Part(root, 'roof', COLORS)
    # Lean-to roof: one sloped slab (a single convex solid sorts cleanly in 2.5D).
    slab(r, -h - ROOF_SIDE, h + ROOF_SIDE, ROOF_IN, ROOF_HI, ROOF_OUT, ROOF_LO, ROOF_T, 'roofSlab', 'roofSlabDark')
    parts['roof'] = r.finish()

    # Unit-height chute: z 0 at the slab underside (chuteTop), -1 at the ground (stretched by the game).
    ch = Part(root, 'chute', COLORS)
    for x in HOLES:
        box(ch, x - .05, x + .05, .03, .13, -.004, 0, 'dark')                                       # drop hole
        vs = [((x + dx) * S, .003 * S, z * S) for dx, z in ((-.04, 0), (.04, 0), (.06, -1), (-.06, -1))]   # stain on the wall
        ch.quads(vs, [(0, 1, 2, 3)], 'stain')
    parts['chute'] = ch.finish()
    return parts


def main(out_path):
    root = fresh_collection(COLL_NAME)
    parts = {k: export_part_indexed(p, KEYS) for k, p in garderobe(root).items()}
    total = sum(len(p['c']) for p in parts.values())
    data = {'palette': list(COLORS.values()), 'paletteKeys': KEYS,
            'models': {'garderobe': {'width': W, 'projection': PROJ, 'chuteTop': SLAB0, 'bottom': SLAB0 - .135, 'parts': parts}}}
    js = ("'use strict';\n// Generated by tools/blender/build_garderobe.py — do not edit by hand.\n"
          "// Garderobe (U): +x along the face centred, +y outward, +z up from the room floor; chute z 0..-1 is stretched to the ground.\n"
          "// Parts: p = vertex xyz, i = 3 indices per triangle, c = palette index per triangle.\n"
          "window.ConquerGarderobeModels=" + json.dumps(data, separators=(',', ':')) + ";\n")
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, 'w', encoding='utf-8', newline='\n') as f:
        f.write(js)
    print(f"garderobe models: {total} triangles, {len(js) // 1024} KB -> {out_path}")
    return {'total': total, 'kb': len(js) // 1024}


if __name__ == '__main__' and '--' in sys.argv:
    args = sys.argv[sys.argv.index('--') + 1:]
    main(args[args.index('--out') + 1])
elif 'GARDEROBE_OUT' in globals():
    GARDEROBE_RESULT = main(GARDEROBE_OUT)
