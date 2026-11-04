"""CONQUER dovecote lantern builder (Blender 4.4+/5.x): the Colombaia on a tower roof.

A small whitewashed timber lantern straddling the apex of a pitched tower roof, with flight
holes and landing ledges on its four faces, a shingled pyramid cap and a few pigeons on the
ledges. The game sets it on the roof apex of every T2/T3 stone tower whose top floor holds the
'dovecote' room (towerDovecote in settlement-core.js). Same method as the hoarding: low-poly,
flat colours, real metres on the game dimensions (1 U = 3.5 m).

Axes (U): origin at the roof apex, +X / +Y the tower's local axes, +Z up. The plinth reaches
down to z = -SINK so it sits in the roof slope instead of floating on its point.
  frame    plinth, corner posts, sill and eave plates
  walls    whitewashed walls with the flight holes
  ledges   landing ledges under each row of holes
  roof     pyramid cap of shingles with a finial
  pigeons  three pigeons perched on the ledges
Palette keys starting with 'roof' turn white in winter.

Run inside Blender (BlenderMCP execute_code):
    CQ_DIR = r"...\\tools\\blender"; DOVE_OUT = r"...\\src\\assets\\dovecote-models.js"
    exec(open(CQ_DIR + r"\\build_dovecote.py", encoding="utf-8").read())
or headless:
    blender --background --python tools/blender/build_dovecote.py -- --out src/assets/dovecote-models.js
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
    'plaster': '#e4dac4', 'plasterShade': '#cdbfa4', 'post': '#4a3424', 'beam': '#5e4128',
    'hole': '#1e1712', 'ledge': '#7a5534',
    'roofShingle': '#5d4130', 'roofShingleDark': '#4b382a', 'roofRidge': '#806047',
    'finial': '#8f8577', 'pigeon': '#a3a8ad', 'pigeonDark': '#6b7076', 'pigeonNeck': '#5c7d6b', 'beak': '#c9a48a',
}
KEYS = list(COLORS.keys())
COLL_NAME = 'CONQUER_Dovecote'

HALF = .15             # half side of the walls (U)
SINK = .16             # plinth depth below the apex, into the roof slope
WALL0, WALL1 = .02, .30
EAVE, CAP_TOP = .23, .50


def prism(p, pts, z0, z1, key, top=None):
    """Vertical prism over a U polygon (converted to metres)."""
    n = len(pts)
    vs = [(x * S, y * S, z0 * S) for x, y in pts] + [(x * S, y * S, z1 * S) for x, y in pts]
    p.quads(vs, [(i, (i + 1) % n, n + (i + 1) % n, n + i) for i in range(n)], key)
    p.quads(vs, [tuple(range(n, 2 * n))], top or key)
    p.quads(vs, [tuple(range(n - 1, -1, -1))], key)


def box(p, x0, x1, y0, y1, z0, z1, key, top=None):
    prism(p, [(x0, y0), (x1, y0), (x1, y1), (x0, y1)], z0, z1, key, top)


def faces():
    """The four wall faces: (outward normal, along-face axis) in the tower's local plan."""
    return [((1, 0), (0, 1)), ((0, 1), (-1, 0)), ((-1, 0), (0, -1)), ((0, -1), (1, 0))]


def on_face(n, t, out, along, half_w, half_d):
    """Box footprint centred `along` on a face, `out` from the centre, (half_w along, half_d out)."""
    (nx, ny), (tx, ty) = n, t
    cx, cy = nx * out + tx * along, ny * out + ty * along
    wx, wy = abs(tx) * half_w + abs(nx) * half_d, abs(ty) * half_w + abs(ny) * half_d
    return cx - wx, cx + wx, cy - wy, cy + wy


def lantern(root):
    parts = {}

    frame = Part(root, 'frame', COLORS)
    box(frame, -HALF - .02, HALF + .02, -HALF - .02, HALF + .02, -SINK, WALL0, 'beam')       # plinth in the roof
    for sx in (-1, 1):
        for sy in (-1, 1):                                                                # corner posts
            x, y = sx * HALF, sy * HALF
            box(frame, x - .02, x + .02, y - .02, y + .02, WALL0, WALL1, 'post')
    box(frame, -HALF - .025, HALF + .025, -HALF - .025, HALF + .025, WALL1 - .025, WALL1, 'beam')   # eave plate
    parts['frame'] = frame.finish()

    walls = Part(root, 'walls', COLORS)
    box(walls, -HALF, HALF, -HALF, HALF, WALL0, WALL1 - .025, 'plaster')
    for i, (n, t) in enumerate(faces()):
        for row, z in enumerate((.08, .19)):                                              # two rows of holes
            for a in (-.055, .055):
                x0, x1, y0, y1 = on_face(n, t, HALF + .002, a + (.02 if row else 0), .022, .004)
                box(walls, x0, x1, y0, y1, z, z + .05, 'hole')
        if i % 2:                                                                         # a shade on two faces
            x0, x1, y0, y1 = on_face(n, t, HALF + .001, 0, HALF - .02, .001)
            box(walls, x0, x1, y0, y1, WALL0 + .01, WALL0 + .03, 'plasterShade')
    parts['walls'] = walls.finish()

    ledges = Part(root, 'ledges', COLORS)
    for n, t in faces():
        for z in (.07, .18):
            x0, x1, y0, y1 = on_face(n, t, HALF + .03, 0, HALF - .01, .03)
            box(ledges, x0, x1, y0, y1, z - .012, z, 'ledge')
    parts['ledges'] = ledges.finish()

    roof = Part(root, 'roof', COLORS)
    # Pyramid cap over the eave plate, each slope a triangle shaded a course darker on alternate sides.
    e, top = EAVE, CAP_TOP
    corners = [(e, -e), (e, e), (-e, e), (-e, -e)]
    for k in range(4):
        (ax, ay), (bx, by) = corners[k], corners[(k + 1) % 4]
        roof.quads([(ax * S, ay * S, WALL1 * S), (bx * S, by * S, WALL1 * S), (0, 0, top * S)], [(0, 1, 2)],
                   'roofShingle' if k % 2 else 'roofShingleDark')
    roof.quads([(x * S, y * S, WALL1 * S) for x, y in reversed(corners)], [(0, 1, 2, 3)], 'roofRidge')
    roof.cylinder(.012 * S, 0, 'finial', n=6, axis='z', center=(0, 0, (top - .02) * S),
                  radii=[.012 * S, .012 * S, .028 * S, 0], along=[0, .05 * S, .07 * S, .1 * S])
    parts['roof'] = roof.finish()

    pigeons = Part(root, 'pigeons', COLORS)
    # (face, along, ledge z, heading turn): birds sitting on the ledges, facing out.
    for fi, a, z in ((0, -.06, .07), (1, .05, .18), (3, .02, .07)):
        n, t = faces()[fi]
        bx, by = n[0] * (HALF + .035) + t[0] * a, n[1] * (HALF + .035) + t[1] * a
        head = math.atan2(n[1], n[0])
        ca, sa = math.cos(head), math.sin(head)
        at = lambda fx, fy, fz: ((bx + fx * ca - fy * sa) * S, (by + fx * sa + fy * ca) * S, (z + fz) * S)
        pigeons.cylinder(.022 * S, 0, 'pigeon', n=7, axis='x', center=at(-.005, 0, .025),
                         radii=[.006 * S, .02 * S, .022 * S, .014 * S], along=[-.035 * S, -.018 * S, .005 * S, .022 * S], squash=.85)
        pigeons.cylinder(.012 * S, 0, 'pigeonNeck', n=6, axis='z', center=at(.018, 0, .035),
                         radii=[.011 * S, .009 * S], along=[0, .018 * S])
        pigeons.cylinder(.012 * S, 0, 'pigeonDark', n=6, axis='z', center=at(.02, 0, .053),
                         radii=[.009 * S, .012 * S, 0], along=[0, .008 * S, .02 * S])
        pigeons.taper(at(.03, 0, .06), at(.042, 0, .058), .006 * S, .005 * S, .002 * S, .002 * S, 'beak')
        pigeons.taper(at(-.03, 0, .028), at(-.05, 0, .022), .018 * S, .006 * S, .022 * S, .003 * S, 'pigeonDark')   # tail
    parts['pigeons'] = pigeons.finish()
    return parts


def main(out_path):
    root = fresh_collection(COLL_NAME)
    parts = {k: export_part_indexed(p, KEYS) for k, p in lantern(root).items()}
    total = sum(len(p['c']) for p in parts.values())
    data = {'palette': list(COLORS.values()), 'paletteKeys': KEYS, 'sink': SINK,
            'models': {'lantern': {'parts': parts}}}
    js = ("'use strict';\n// Generated by tools/blender/build_dovecote.py — do not edit by hand.\n"
          "// Dovecote lantern (U): origin at the tower roof apex, +x/+y the tower's local axes, +z up.\n"
          "// Parts: p = vertex xyz, i = 3 indices per triangle, c = palette index per triangle.\n"
          "window.ConquerDovecoteModels=" + json.dumps(data, separators=(',', ':')) + ";\n")
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, 'w', encoding='utf-8', newline='\n') as f:
        f.write(js)
    print(f"dovecote models: {total} triangles, {len(js) // 1024} KB -> {out_path}")
    return {'total': total, 'kb': len(js) // 1024}


if __name__ == '__main__' and '--' in sys.argv:
    args = sys.argv[sys.argv.index('--') + 1:]
    main(args[args.index('--out') + 1])
elif 'DOVE_OUT' in globals():
    DOVE_RESULT = main(DOVE_OUT)
