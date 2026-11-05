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

S = 3.5
COLORS = {
    'stone': '#6e645b', 'stoneDark': '#4f4842', 'stoneLight': '#8a7f74', 'corbel': '#5d554e',   # castleSideShade tones
    'dark': '#1d1a17', 'stain': '#3d3a2c',
    'roofSlab': '#5b5550', 'roofSlabDark': '#47423e', 'roofUnder': '#2f2b28',
}
KEYS = list(COLORS.keys())
COLL_NAME = 'CONQUER_Garderobe'

W, PROJ = .46, .22            # width along the face, projection out of it (shallower, user 05/11/2026)
SLAB0, SLAB1 = -.06, 0.0      # floor slab, flush with the room floor
WALL_T = .05
TOP = .56                     # box walls
ROOF_IN, ROOF_OUT = -.03, PROJ + .05
ROOF_HI, ROOF_LO, ROOF_T = .70, .58, .04
CORBELS = (-.19, -.1, .1, .19)   # clear of the drop hole in the middle


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
    p.quads(vs, [(0, 1, 2, 3)], key)
    p.quads(vs, [(7, 6, 5, 4)], under)
    p.quads(vs, [(4, 5, 1, 0), (6, 7, 3, 2), (0, 3, 7, 4), (1, 5, 6, 2)], under)


def garderobe(root):
    h = W / 2
    parts = {}

    b = Part(root, 'box', COLORS)
    box(b, -h - .02, h + .02, -.02, PROJ + .02, SLAB0, SLAB1, 'stoneDark', 'stoneLight')          # slab
    box(b, -h, -h + WALL_T, 0, PROJ, SLAB1, TOP, 'stone', 'stoneLight')                             # side walls
    box(b, h - WALL_T, h, 0, PROJ, SLAB1, TOP, 'stone', 'stoneLight')
    box(b, -h + WALL_T, h - WALL_T, PROJ - WALL_T, PROJ, SLAB1, TOP, 'stone', 'stoneLight')        # front
    box(b, -.025, .025, PROJ, PROJ + .004, .26, .44, 'dark')                                        # vent slit
    box(b, -h - .01, h + .01, PROJ - .01, PROJ + .015, TOP - .04, TOP, 'stoneDark')                 # string course
    parts['box'] = b.finish()

    c = Part(root, 'corbels', COLORS)
    for x in CORBELS:                                           # three courses, each stepping further out
        for k in range(3):
            z1 = SLAB0 - .045 * k
            box(c, x - .035, x + .035, -.02, PROJ * (3 - k) / 3, z1 - .045, z1, 'corbel', 'stoneLight')
    parts['corbels'] = c.finish()

    r = Part(root, 'roof', COLORS)
    slab(r, -h - .03, h + .03, ROOF_IN, ROOF_HI, ROOF_OUT, ROOF_LO, ROOF_T, 'roofSlab', 'roofUnder')
    box(r, -h - .03, h + .03, ROOF_IN - .02, ROOF_IN + .03, ROOF_HI - ROOF_T, ROOF_HI + .02, 'roofSlabDark')   # flashing on the wall
    parts['roof'] = r.finish()

    # Unit-height chute: z 0 at the slab underside (chuteTop), -1 at the ground (stretched by the game).
    ch = Part(root, 'chute', COLORS)
    box(ch, -.06, .06, .02, .14, -.004, 0, 'dark')                                                  # drop hole
    vs = [(x * S, .003 * S, z * S) for x, z in ((-.05, 0), (.05, 0), (.08, -1), (-.08, -1))]       # stain on the wall
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
