"""CONQUER tower hoarding builder (Blender 4.4+/5.x): the timber gallery (ballatoio) hung
around the top of a stone tower.

The hoarding is one bay module, repeated in game along every edge of the tower outline
(towerHoardingBays in settlement-castle-structures.js), as the palisade repeats the stake.
Same method as the timber fortifications: low-poly, flat colours, real metres on the game
dimensions of drawWallHoarding (1 U = 3.5 m).

Bay axes (U): +X along the tower face, 0..BAY_LEN; +Y outward from the face (0 = the
masonry face); +Z up from the tower top (0 = structureHeight). The game normalises X to
0..1 and sweeps the bay between two mitred outward normals, so square corners close and
round towers follow their curve with the same module.
  deck     plank floor -0.02..0.42 U out, a drop slot (caditoia) along its outer edge
  frame    putlog joist through the masonry, diagonal strut, corner posts, rafter
  boards   outer plank wall to 0.43 U with a loophole
  roof     lean-to shingle roof from 0.66 U over the tower top down to 0.47 U at the eave
The hoarding is a wartime addition: the tower keeps its own top. On a crenellated tower the bay
sits at the tower top; under a pitched roof the game hangs it lower, below the eave.
Palette keys starting with 'roof' turn white in winter.

Run inside Blender (BlenderMCP execute_code):
    CQ_DIR = r"...\\tools\\blender"; HOARD_OUT = r"...\\src\\assets\\hoarding-models.js"
    exec(open(CQ_DIR + r"\\build_hoarding.py", encoding="utf-8").read())
or headless:
    blender --background --python tools/blender/build_hoarding.py -- --out src/assets/hoarding-models.js
"""
import json, os, sys, importlib
_here = os.path.dirname(os.path.abspath(__file__)) if '__file__' in globals() else CQ_DIR
if _here not in sys.path:
    sys.path.insert(0, _here)
import cq_blender
importlib.reload(cq_blender)
from cq_blender import Part, fresh_collection, export_part_indexed

S = 3.5          # metres per game unit
BAY_LEN = .75    # U along the face, as the posts of drawWallHoarding
COLORS = {
    'plank': '#8b6845', 'plankDark': '#6e5136', 'beam': '#5e4128', 'brace': '#6b4a2e',
    'board': '#7a5534', 'boardDark': '#654832', 'post': '#3f2c20', 'dark': '#1e1712',
    'roofShingle': '#5d4130', 'roofShingleDark': '#4b382a', 'roofRidge': '#806047', 'roofUnder': '#3a2a1e',
}
KEYS = list(COLORS.keys())
COLL_NAME = 'CONQUER_Hoarding'

# drawWallHoarding profile (U)
Y_IN, Y_OUT = -.02, .42                 # deck across the face
DECK0, DECK1 = -.045, .055
BOARD0, BOARD1, BOARD_T = -.03, .43, .03
ROOF_IN, ROOF_OUT = -.08, .49           # roof from over the tower top to past the boards
ROOF_HI, ROOF_LO, ROOF_T = .66, .47, .035
STRUT_FOOT = -.58


def prism(p, pts, z0, z1, key, top=None):
    """Vertical prism over a U polygon (converted to metres)."""
    n = len(pts)
    vs = [(x * S, y * S, z0 * S) for x, y in pts] + [(x * S, y * S, z1 * S) for x, y in pts]
    p.quads(vs, [(i, (i + 1) % n, n + (i + 1) % n, n + i) for i in range(n)], key)
    p.quads(vs, [tuple(range(n, 2 * n))], top or key)
    p.quads(vs, [tuple(range(n - 1, -1, -1))], key)


def box(p, x0, x1, y0, y1, z0, z1, key, top=None):
    prism(p, [(x0, y0), (x1, y0), (x1, y1), (x0, y1)], z0, z1, key, top)


def beam(p, a, b, w, h, key):
    p.beam(tuple(v * S for v in a), tuple(v * S for v in b), w * S, h * S, key)


def slab(p, x0, x1, y0, z0, y1, z1, t, key, under):
    """Sloped slab from the line (y0, z0) to (y1, z1) across x0..x1, t thick (roof courses)."""
    vs = [(x * S, y * S, (z + dz) * S) for dz in (0, -t) for x, y, z in ((x0, y0, z0), (x1, y0, z0), (x1, y1, z1), (x0, y1, z1))]
    p.quads(vs, [(0, 1, 2, 3)], key)
    p.quads(vs, [(7, 6, 5, 4)], under)
    p.quads(vs, [(4, 5, 1, 0), (6, 7, 3, 2), (0, 3, 7, 4), (1, 5, 6, 2)], under)


def bay(root):
    L, mid = BAY_LEN, BAY_LEN / 2
    parts = {}

    deck = Part(root, 'deck', COLORS)
    box(deck, 0, L, Y_IN, Y_OUT, DECK0, DECK1, 'plankDark', 'plank')
    for k in range(1, 4):                                     # plank seams across the floor
        x = L * k / 4
        box(deck, x - .004, x + .004, Y_IN, Y_OUT - .1, DECK1, DECK1 + .004, 'plankDark')
    box(deck, .08, L - .08, Y_OUT - .11, Y_OUT - .045, DECK1, DECK1 + .005, 'dark')   # drop slot
    parts['deck'] = deck.finish()

    frame = Part(root, 'frame', COLORS)
    # putlog joist through the masonry, its end proud of the boards
    box(frame, mid - .035, mid + .035, -.10, Y_OUT + .06, DECK0 - .08, DECK0, 'beam')
    beam(frame, (mid, Y_OUT - .05, DECK0 - .06), (mid, .02, STRUT_FOOT), .05, .05, 'brace')
    box(frame, mid - .05, mid + .05, -.01, .03, STRUT_FOOT - .05, STRUT_FOOT + .02, 'beam')   # foot block
    box(frame, 0, .05, Y_OUT, Y_OUT + .05, BOARD0, ROOF_LO + .01, 'post')                     # corner post
    box(frame, 0, .05, Y_IN, Y_IN + .05, DECK1, ROOF_HI - .02, 'post')                        # post on the tower top
    beam(frame, (.025, ROOF_IN, ROOF_HI - ROOF_T - .02), (.025, ROOF_OUT, ROOF_LO - ROOF_T - .02), .045, .05, 'beam')
    box(frame, 0, L, Y_IN, Y_IN + .06, ROOF_HI - .1, ROOF_HI - ROOF_T, 'beam')               # wall plate
    box(frame, 0, L, Y_OUT - .01, Y_OUT + .05, BOARD1 - .02, BOARD1 + .03, 'beam')            # eave plate
    parts['frame'] = frame.finish()

    boards = Part(root, 'boards', COLORS)
    n = 4
    for k in range(n):
        x0, x1 = L * k / n, L * (k + 1) / n
        box(boards, x0, x1, Y_OUT, Y_OUT + BOARD_T, BOARD0, BOARD1 - (.012 if k % 2 else 0), 'board' if k % 2 else 'boardDark')
    box(boards, mid - .03, mid + .03, Y_OUT + BOARD_T, Y_OUT + BOARD_T + .004, .12, .32, 'dark')   # loophole
    parts['boards'] = boards.finish()

    roof = Part(root, 'roof', COLORS)
    courses = 3
    for k in range(courses):
        t0, t1 = k / courses, (k + 1) / courses + (.06 if k < courses - 1 else 0)
        y0, y1 = ROOF_IN + (ROOF_OUT - ROOF_IN) * t0, ROOF_IN + (ROOF_OUT - ROOF_IN) * min(1, t1)
        z0, z1 = ROOF_HI + (ROOF_LO - ROOF_HI) * t0, ROOF_HI + (ROOF_LO - ROOF_HI) * min(1, t1)
        lift = .012 * (courses - 1 - k)          # upper courses lap over the lower ones
        slab(roof, 0, L, y0, z0 + lift, y1, z1 + lift, ROOF_T, 'roofShingle' if k % 2 else 'roofShingleDark', 'roofUnder')
    box(roof, 0, L, ROOF_IN - .03, ROOF_IN + .03, ROOF_HI, ROOF_HI + .03, 'roofRidge')       # ridge board
    parts['roof'] = roof.finish()
    return parts


def main(out_path):
    root = fresh_collection(COLL_NAME)
    parts = {k: export_part_indexed(p, KEYS) for k, p in bay(root).items()}
    total = sum(len(p['c']) for p in parts.values())
    data = {'palette': list(COLORS.values()), 'paletteKeys': KEYS, 'bayLength': BAY_LEN,
            'models': {'bay': {'parts': parts}}}
    js = ("'use strict';\n// Generated by tools/blender/build_hoarding.py — do not edit by hand.\n"
          "// Tower hoarding bay (U): +x along the face 0..bayLength, +y outward, +z up from the tower top.\n"
          "// Parts: p = vertex xyz, i = 3 indices per triangle, c = palette index per triangle.\n"
          "window.ConquerHoardingModels=" + json.dumps(data, separators=(',', ':')) + ";\n")
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, 'w', encoding='utf-8', newline='\n') as f:
        f.write(js)
    print(f"hoarding models: {total} triangles, {len(js) // 1024} KB -> {out_path}")
    return {'total': total, 'kb': len(js) // 1024}


if __name__ == '__main__' and '--' in sys.argv:
    args = sys.argv[sys.argv.index('--') + 1:]
    main(args[args.index('--out') + 1])
elif 'HOARD_OUT' in globals():
    HOARD_RESULT = main(HOARD_OUT)
