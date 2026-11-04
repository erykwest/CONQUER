"""CONQUER belfry builder (Blender 4.4+/5.x): the alarm bell on a tower roof.

A small open timber bell frame straddling the apex of a pitched tower roof: a slate saddle sunk
into the slopes, four corner posts braced at the foot, a headstock beam carrying a bronze bell
with its wheel, and a shingled pyramid cap. The game sets it on the roof apex of every T1/T2
tower, stone or wood, with the `bell` variant (towerBell in settlement-alarm-bells.js). Same
method as the dovecote lantern: low-poly, flat colours, real metres on the game dimensions
(1 U = 3.5 m).

Axes (U): origin at the roof apex, +X / +Y the tower's local axes, +Z up. The saddle reaches
down to z = -SINK so it sits in the roof slope instead of floating on its point.
  frame    saddle, corner posts, braces, sill and eave plates, headstock beam
  bell     the bronze bell, its crown and clapper
  wheel    the bell wheel at the end of the headstock
  roof     pyramid cap of shingles with a finial
Palette keys starting with 'roof' turn white in winter.

Run inside Blender (BlenderMCP execute_code):
    CQ_DIR = r"...\\tools\\blender"; BELFRY_OUT = r"...\\src\\assets\\belfry-models.js"
    exec(open(CQ_DIR + r"\\build_belfry.py", encoding="utf-8").read())
or headless:
    blender --background --python tools/blender/build_belfry.py -- --out src/assets/belfry-models.js
"""
import json, math, os, sys, importlib
_here = os.path.dirname(os.path.abspath(__file__)) if '__file__' in globals() else CQ_DIR
if _here not in sys.path:
    sys.path.insert(0, _here)
import cq_blender
importlib.reload(cq_blender)
from cq_blender import Part, fresh_collection, export_part_indexed

S = 3.5          # metres per game unit
COLORS = {
    'saddle': '#3a3d42', 'post': '#4a3424', 'beam': '#5e4128', 'brace': '#553b26',
    'bronze': '#9a7a3c', 'bronzeDark': '#6e5527', 'bronzeLip': '#b8954e', 'clapper': '#2e2b28',
    'wheel': '#6b4b2e',
    'roofShingle': '#5d4130', 'roofShingleDark': '#4b382a', 'roofRidge': '#806047',
    'finial': '#8f8577',
}
KEYS = list(COLORS.keys())
COLL_NAME = 'CONQUER_Belfry'

HALF = .14             # half side of the frame between post centres (U)
POST = .022            # half section of a post
SINK = .18             # saddle depth below the apex, into the roof slope
SILL, PLATE = .02, .4  # sill top and eave plate top
EAVE, CAP_TOP = .21, .64
BELL_MOUTH, BELL_R, BELL_CROWN = .1, .085, .27
HEAD_Z = .3            # headstock beam (bell hangs from it)


def prism(p, pts, z0, z1, key, top=None):
    """Vertical prism over a U polygon (converted to metres)."""
    n = len(pts)
    vs = [(x * S, y * S, z0 * S) for x, y in pts] + [(x * S, y * S, z1 * S) for x, y in pts]
    p.quads(vs, [(i, (i + 1) % n, n + (i + 1) % n, n + i) for i in range(n)], key)
    p.quads(vs, [tuple(range(n, 2 * n))], top or key)
    p.quads(vs, [tuple(range(n - 1, -1, -1))], key)


def box(p, x0, x1, y0, y1, z0, z1, key, top=None):
    prism(p, [(x0, y0), (x1, y0), (x1, y1), (x0, y1)], z0, z1, key, top)


def belfry(root):
    parts = {}
    e = HALF + POST

    frame = Part(root, 'frame', COLORS)
    box(frame, -e - .02, e + .02, -e - .02, e + .02, -SINK, SILL, 'saddle')                 # slate saddle in the roof
    for sx in (-1, 1):
        for sy in (-1, 1):                                                                  # corner posts
            x, y = sx * HALF, sy * HALF
            box(frame, x - POST, x + POST, y - POST, y + POST, SILL, PLATE, 'post')
    for y in (-HALF, HALF):                                                                 # sills along x
        box(frame, -e, e, y - POST, y + POST, SILL, SILL + .03, 'beam')
    for x in (-HALF, HALF):                                                                 # braces: foot of each post pair
        frame.taper(((x) * S, (-HALF + POST) * S, (SILL + .03) * S), (x * S, (-.03) * S, (SILL + .14) * S),
                    .02 * S, .02 * S, .02 * S, .02 * S, 'brace')
        frame.taper(((x) * S, (HALF - POST) * S, (SILL + .03) * S), (x * S, .03 * S, (SILL + .14) * S),
                    .02 * S, .02 * S, .02 * S, .02 * S, 'brace')
    box(frame, -e - .015, e + .015, -e - .015, e + .015, PLATE - .03, PLATE, 'beam')        # eave plate ring
    box(frame, -e, e, -.022, .022, HEAD_Z - .022, HEAD_Z + .022, 'beam')                    # headstock beam along x
    parts['frame'] = frame.finish()

    bell = Part(root, 'bell', COLORS)
    # Profile from the lip up to the crown, mouth open downwards; a darker shoulder band.
    bell.cylinder(BELL_R * S, 0, 'bronze', n=12, axis='z', center=(0, 0, 0),
                  radii=[BELL_R * S, .078 * S, .058 * S, .05 * S, .046 * S, 0],
                  along=[BELL_MOUTH * S, (BELL_MOUTH + .03) * S, (BELL_MOUTH + .08) * S, (BELL_MOUTH + .13) * S,
                         (BELL_CROWN - .01) * S, BELL_CROWN * S])
    bell.cylinder(BELL_R * S, 0, 'bronzeLip', n=12, axis='z', center=(0, 0, 0),
                  radii=[(BELL_R + .006) * S, (BELL_R + .006) * S], along=[BELL_MOUTH * S, (BELL_MOUTH + .014) * S])
    bell.cylinder(.05 * S, 0, 'bronzeDark', n=12, axis='z', center=(0, 0, 0),
                  radii=[.06 * S, .056 * S], along=[(BELL_MOUTH + .07) * S, (BELL_MOUTH + .09) * S])
    box(bell, -.012, .012, -.012, .012, BELL_CROWN, HEAD_Z - .02, 'bronzeDark')             # crown / cannons
    # Mouth seen from below and the clapper hanging in it.
    bell.quads([(math.cos(a) * (BELL_R - .004) * S, math.sin(a) * (BELL_R - .004) * S, (BELL_MOUTH + .004) * S)
                for a in (2 * math.pi * k / 12 for k in range(12))], [tuple(range(12))], 'clapper')
    bell.cylinder(.014 * S, 0, 'clapper', n=6, axis='z', center=(0, 0, 0),
                  radii=[.016 * S, .016 * S, .006 * S], along=[(BELL_MOUTH - .02) * S, (BELL_MOUTH + .01) * S, (BELL_CROWN - .05) * S])
    parts['bell'] = bell.finish()

    wheel = Part(root, 'wheel', COLORS)
    # Half wheel on the +x end of the headstock, in the y-z plane, for the bell rope.
    wheel.ring(.07 * S, .056 * S, .008 * S, 'wheel', n=12, axis='x', center=((e + .025) * S, 0, HEAD_Z * S))
    for k in range(3):
        a = math.pi * k / 3
        wheel.taper(((e + .025) * S, 0, HEAD_Z * S),
                    ((e + .025) * S, math.cos(a) * .063 * S, (HEAD_Z + math.sin(a) * .063) * S),
                    .012 * S, .012 * S, .012 * S, .012 * S, 'wheel')
    parts['wheel'] = wheel.finish()

    roof = Part(root, 'roof', COLORS)
    # Pyramid cap over the eave plate, each slope a triangle shaded a course darker on alternate sides.
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
    parts = {k: export_part_indexed(p, KEYS) for k, p in belfry(root).items()}
    total = sum(len(p['c']) for p in parts.values())
    data = {'palette': list(COLORS.values()), 'paletteKeys': KEYS, 'sink': SINK, 'height': round(CAP_TOP + .07, 3),
            'models': {'belfry': {'parts': parts}}}
    js = ("'use strict';\n// Generated by tools/blender/build_belfry.py - do not edit by hand.\n"
          "// Alarm-bell belfry (U): origin at the tower roof apex, +x/+y the tower's local axes, +z up.\n"
          "// Parts: p = vertex xyz, i = 3 indices per triangle, c = palette index per triangle.\n"
          "window.ConquerBelfryModels=" + json.dumps(data, separators=(',', ':')) + ";\n")
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, 'w', encoding='utf-8', newline='\n') as f:
        f.write(js)
    print(f"belfry models: {total} triangles, {len(js) // 1024} KB -> {out_path}")
    return {'total': total, 'kb': len(js) // 1024}


if __name__ == '__main__' and '--' in sys.argv:
    args = sys.argv[sys.argv.index('--') + 1:]
    main(args[args.index('--out') + 1])
elif 'BELFRY_OUT' in globals():
    BELFRY_RESULT = main(BELFRY_OUT)
