"""CONQUER falconry mews builder (Blender 4.4+/5.x): the falcons' cage on a tower roof.

A small slatted timber cage straddling the apex (or the middle of the ridge) of a pitched tower
roof: a slate saddle sunk into the slopes, four corner posts, sill and eave plates, close vertical
slats on three sides and a half-open front, a perch bar across the cage with a hooded falcon on it,
and a shingled pyramid cap. The game mounts it with ROOM_EXTERIOR (`mews`, mount 'roof') on the
tower whose top room is the falconry (towerMews in settlement-core.js). Same method as the belfry:
low-poly, flat colours, real metres on the game dimensions (1 U = 3.5 m).

Axes (U): origin at the roof apex, +X / +Y the tower's local axes, +Z up. The saddle reaches
down to z = -SINK so it sits in the roof slope instead of floating on its point.
  frame    saddle, corner posts, sill and eave plates
  slats    the cage bars
  perch    perch bar and the falcon on it
  roof     pyramid cap of shingles with a finial
Palette keys starting with 'roof' turn white in winter.

Headless:
    blender --background --python tools/blender/build_mews.py -- --out src/assets/mews-models.js
"""
import json, os, sys, importlib
_here = os.path.dirname(os.path.abspath(__file__)) if '__file__' in globals() else CQ_DIR
if _here not in sys.path:
    sys.path.insert(0, _here)
import cq_blender
importlib.reload(cq_blender)
from cq_blender import Part, fresh_collection, export_part_indexed

S = 3.5          # metres per game unit
COLORS = {
    'saddle': '#3a3d42', 'post': '#4a3424', 'beam': '#5e4128', 'slat': '#6a4a2e',
    'perch': '#7a5a38', 'falcon': '#6f5a44', 'falconLight': '#b7a284', 'hood': '#7a2a22', 'beak': '#d3b24a',
    'roofShingle': '#5d4130', 'roofShingleDark': '#4b382a', 'roofRidge': '#806047',
    'finial': '#8f8577',
}
KEYS = list(COLORS.keys())
COLL_NAME = 'CONQUER_Mews'

HALF = .16             # half side of the cage between post centres (U)
POST = .022            # half section of a post
SINK = .18             # saddle depth below the apex, into the roof slope
SILL, PLATE = .02, .36  # sill top and eave plate top
EAVE, CAP_TOP = .23, .58
SLAT, GAP = .008, .045  # half width of a slat, spacing between slats
PERCH_Z = .16


def prism(p, pts, z0, z1, key, top=None):
    """Vertical prism over a U polygon (converted to metres); faces wound outwards."""
    n = len(pts)
    vs = [(x * S, y * S, z0 * S) for x, y in pts] + [(x * S, y * S, z1 * S) for x, y in pts]
    p.quads(vs, [(i, (i + 1) % n, n + (i + 1) % n, n + i) for i in range(n)], key)
    p.quads(vs, [tuple(range(n, 2 * n))], top or key)
    p.quads(vs, [tuple(range(n - 1, -1, -1))], key)


def box(p, x0, x1, y0, y1, z0, z1, key, top=None):
    prism(p, [(x0, y0), (x1, y0), (x1, y1), (x0, y1)], z0, z1, key, top)


def mews(root):
    parts = {}
    e = HALF + POST

    frame = Part(root, 'frame', COLORS)
    box(frame, -e - .02, e + .02, -e - .02, e + .02, -SINK, SILL, 'saddle')                 # slate saddle in the roof
    for sx in (-1, 1):
        for sy in (-1, 1):                                                                  # corner posts
            x, y = sx * HALF, sy * HALF
            box(frame, x - POST, x + POST, y - POST, y + POST, SILL, PLATE, 'post')
    box(frame, -e, e, -e, e, SILL, SILL + .025, 'beam')                                      # floor of the cage
    box(frame, -e - .015, e + .015, -e - .015, e + .015, PLATE - .03, PLATE, 'beam')        # eave plate ring
    parts['frame'] = frame.finish()

    slats = Part(root, 'slats', COLORS)
    z0, z1 = SILL + .025, PLATE - .03
    n = int((2 * HALF - 2 * POST) // GAP)
    for k in range(n):
        t = -HALF + POST + GAP * (k + .5)
        box(slats, t - SLAT, t + SLAT, -HALF - SLAT, -HALF + SLAT, z0, z1, 'slat')         # back (-y)
        box(slats, -HALF - SLAT, -HALF + SLAT, t - SLAT, t + SLAT, z0, z1, 'slat')         # sides (-x / +x)
        box(slats, HALF - SLAT, HALF + SLAT, t - SLAT, t + SLAT, z0, z1, 'slat')
        if k % 2 == 0:                                                                      # front (+y): every other slat, half open
            box(slats, t - SLAT, t + SLAT, HALF - SLAT, HALF + SLAT, z0, z1, 'slat')
    parts['slats'] = slats.finish()

    perch = Part(root, 'perch', COLORS)
    box(perch, -HALF, HALF, -.012, .012, PERCH_Z - .012, PERCH_Z + .012, 'perch')            # perch bar along x
    # The hooded falcon: body, pale breast, tail, head with its red hood and a beak.
    box(perch, -.035, .035, -.03, .03, PERCH_Z + .012, PERCH_Z + .1, 'falcon')
    box(perch, -.03, .03, .028, .034, PERCH_Z + .03, PERCH_Z + .09, 'falconLight')
    box(perch, -.02, .02, -.05, -.026, PERCH_Z - .02, PERCH_Z + .04, 'falcon')
    box(perch, -.022, .022, -.018, .026, PERCH_Z + .1, PERCH_Z + .14, 'hood')
    box(perch, -.007, .007, .026, .04, PERCH_Z + .108, PERCH_Z + .122, 'beak')
    parts['perch'] = perch.finish()

    roof = Part(root, 'roof', COLORS)
    r, top = EAVE, CAP_TOP
    corners = [(r, -r), (r, r), (-r, r), (-r, -r)]
    for k in range(4):
        (ax, ay), (bx, by) = corners[k], corners[(k + 1) % 4]
        roof.quads([(ax * S, ay * S, PLATE * S), (bx * S, by * S, PLATE * S), (0, 0, top * S)], [(0, 1, 2)],
                   'roofShingle' if k % 2 else 'roofShingleDark')
    roof.quads([(x * S, y * S, PLATE * S) for x, y in reversed(corners)], [(0, 1, 2, 3)], 'roofRidge')
    roof.cylinder(.012 * S, 0, 'finial', n=6, axis='z', center=(0, 0, (top - .02) * S),
                  radii=[.012 * S, .012 * S, .026 * S, 0], along=[0, .04 * S, .06 * S, .09 * S])
    parts['roof'] = roof.finish()
    return parts


def main(out_path):
    root = fresh_collection(COLL_NAME)
    parts = {k: export_part_indexed(p, KEYS) for k, p in mews(root).items()}
    total = sum(len(p['c']) for p in parts.values())
    data = {'palette': list(COLORS.values()), 'paletteKeys': KEYS, 'sink': SINK, 'height': round(CAP_TOP + .07, 3),
            'models': {'mews': {'parts': parts}}}
    js = ("'use strict';\n// Generated by tools/blender/build_mews.py - do not edit by hand.\n"
          "// Falconry mews (U): origin at the tower roof apex, +x/+y the tower's local axes, +z up.\n"
          "// Parts: p = vertex xyz, i = 3 indices per triangle, c = palette index per triangle.\n"
          "window.ConquerMewsModels=" + json.dumps(data, separators=(',', ':')) + ";\n")
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, 'w', encoding='utf-8', newline='\n') as f:
        f.write(js)
    print(f"mews models: {total} triangles, {len(js) // 1024} KB -> {out_path}")
    return {'total': total, 'kb': len(js) // 1024}


if __name__ == '__main__' and '--' in sys.argv:
    args = sys.argv[sys.argv.index('--') + 1:]
    main(args[args.index('--out') + 1])
elif 'MEWS_OUT' in globals():
    MEWS_RESULT = main(MEWS_OUT)
