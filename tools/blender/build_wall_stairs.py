"""CONQUER wall-walk stairs builder (Blender 4.4+/5.x): BC-251105-01 timber stair and
BC-251105-02 masonry stair that climb from the ground to the wall walk (cammino di ronda).

Both flights run ALONG the interior face of a wall, the top step flush with the walk.
Low-poly, flat colours, real metres on the game dimensions (1 U = 3.5 m), like the hoarding.

Model axes (U), normalised to a rise of 1 U:
  +X along the wall face, 0 = foot of the flight .. run = top step (where the walk is entered)
  +Y away from the wall face into the bailey, 0 = the masonry face .. width
  +Z up from the ground, 0..1 = the wall-walk height
The game scales X and Z by the real rise (walk height above the ground) and keeps Y, so the
slope (wood ~60 deg, stone ~45 deg) and the step count stay those modelled here.
  stairWood   stringers, treads, outer handrail with posts, a top landing tied to the wall
  stairStone  solid stepped masonry flight with a coping on its open side, bonded to the wall
Palette keys starting with 'tread' turn white in winter.

headless:
    blender --background --factory-startup --python tools/blender/build_wall_stairs.py -- --out src/assets/wall-stair-models.js
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
    'beam': '#5e4128', 'post': '#3f2c20', 'plank': '#8b6845', 'plankDark': '#6e5136',
    'treadWood': '#9a7550', 'stone': '#9a9184', 'stoneDark': '#7d756a', 'treadStone': '#b3aa9c',
    'coping': '#8a8276',
}
KEYS = list(COLORS.keys())
COLL_NAME = 'CONQUER_WallStairs'
SPECS = {
    'wood': {'run': .58, 'width': .30, 'steps': 7},
    'stone': {'run': 1.0, 'width': .36, 'steps': 8},
}


def prism(p, pts, z0, z1, key, top=None):
    n = len(pts)
    vs = [(x * S, y * S, z0 * S) for x, y in pts] + [(x * S, y * S, z1 * S) for x, y in pts]
    p.quads(vs, [(i, (i + 1) % n, n + (i + 1) % n, n + i) for i in range(n)], key)
    p.quads(vs, [tuple(range(n, 2 * n))], top or key)
    p.quads(vs, [tuple(range(n - 1, -1, -1))], key)


def box(p, x0, x1, y0, y1, z0, z1, key, top=None):
    prism(p, [(x0, y0), (x1, y0), (x1, y1), (x0, y1)], z0, z1, key, top)


def beam(p, a, b, w, h, key):
    p.beam(tuple(v * S for v in a), tuple(v * S for v in b), w * S, h * S, key)


def wood_stair(root):
    sp = SPECS['wood']
    run, W, n = sp['run'], sp['width'], sp['steps']
    parts = {}
    frame = Part(root, 'frame', COLORS)
    for y in (.035, W - .035):                                   # two stringers, foot to walk
        beam(frame, (0, y, .02), (run, y, 1.0 - .03), .045, .07, 'beam')
    box(frame, run - .02, run + .16, 0, W, .94, 1.0, 'plankDark', 'plank')    # top landing at the walk
    for x in (run + .12,):                                       # landing post down to the ground
        box(frame, x, x + .045, W - .05, W - .005, 0, .94, 'post')
    for k in range(4):                                           # outer handrail posts
        t = (k + .5) / 4
        x, z = run * t, t
        box(frame, x - .02, x + .02, W - .03, W + .01, z, z + .26, 'post')
    beam(frame, (0, W - .01, .26), (run + .16, W - .01, 1.24), .03, .03, 'beam')   # handrail
    parts['frame'] = frame.finish()
    treads = Part(root, 'treads', COLORS)
    for k in range(n):                                           # open treads between the stringers
        z = (k + 1) / (n + 1)
        x = run * z
        box(treads, x - .055, x + .055, .055, W - .055, z - .02, z + .012, 'plankDark', 'treadWood')
    parts['treads'] = treads.finish()
    return parts


def stone_stair(root):
    sp = SPECS['stone']
    run, W, n = sp['run'], sp['width'], sp['steps']
    d, h = run / n, 1.0 / n
    parts = {}
    body = Part(root, 'body', COLORS)
    for k in range(n):                                           # each course runs on to the wall-walk end
        box(body, k * d, run, 0, W, k * h, (k + 1) * h - .012, 'stone' if k % 2 else 'stoneDark')
    box(body, run, run + .12, 0, W, 0, 1.0 - .012, 'stoneDark')                    # top pier against the walk
    parts['body'] = body.finish()
    treads = Part(root, 'treads', COLORS)
    for k in range(n):
        box(treads, k * d, (k + 1) * d + .01, 0, W, (k + 1) * h - .012, (k + 1) * h, 'stoneDark', 'treadStone')
    box(treads, run, run + .12, 0, W, 1.0 - .012, 1.0, 'stoneDark', 'treadStone')
    parts['treads'] = treads.finish()
    coping = Part(root, 'coping', COLORS)                         # low parapet kerb on the open side
    for k in range(n):
        box(coping, k * d, (k + 1) * d, W - .05, W, (k + 1) * h, (k + 1) * h + .07, 'coping')
    parts['coping'] = coping.finish()
    return parts


def main(out_path):
    root = fresh_collection(COLL_NAME)
    models = {}
    for name, fn in (('wood', wood_stair), ('stone', stone_stair)):
        parts = {k: export_part_indexed(p, KEYS) for k, p in fn(root).items()}
        models['stair' + name.capitalize()] = {'run': SPECS[name]['run'], 'width': SPECS[name]['width'], 'landing': .16 if name == 'wood' else .12, 'parts': parts}
    total = sum(len(p['c']) for m in models.values() for p in m['parts'].values())
    data = {'palette': list(COLORS.values()), 'paletteKeys': KEYS, 'models': models}
    js = ("'use strict';\n// Generated by tools/blender/build_wall_stairs.py - do not edit by hand.\n"
          "// Wall-walk stairs (U, rise 1): +x along the wall face 0..run, +y into the bailey, +z up to the walk.\n"
          "// Parts: p = vertex xyz, i = 3 indices per triangle, c = palette index per triangle.\n"
          "window.ConquerWallStairModels=" + json.dumps(data, separators=(',', ':')) + ";\n")
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, 'w', encoding='utf-8', newline='\n') as f:
        f.write(js)
    print(f"wall stair models: {total} triangles, {len(js) // 1024} KB -> {out_path}")
    return {'total': total}


if __name__ == '__main__' and '--' in sys.argv:
    args = sys.argv[sys.argv.index('--') + 1:]
    main(args[args.index('--out') + 1])
elif 'STAIR_OUT' in globals():
    STAIR_RESULT = main(STAIR_OUT)
