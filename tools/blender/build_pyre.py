"""CONQUER signal-fire pyre builder (Blender 4.4+/5.x): the great pyre on a tower's flat deck.

A beacon laid ready on the flat crenellated platform of a stone tower (MIL-RES-01, decision
D-MIL-RES-261109): a square stone hearth slab that keeps the fire off the deck, a crib of split logs
laid in alternate courses, a cone of brushwood and tarred faggots in the middle and a few staves
leaning in. The game mounts it with ROOM_EXTERIOR (`signalFire`, mount 'deck') on a tower whose
`signalFire` variant is 'pyre' and whose pyre has not burnt yet (settlement-soldiers.js). Same method
as the belfry and the mews: low-poly, flat colours, real metres on the game dimensions (1 U = 3.5 m).

Axes (U): origin at the middle of the deck, +X / +Y the tower's local axes, +Z up.
  hearth   stone slab and its kerb
  logs     the crib of split logs
  brush    brushwood cone, tarred faggots, leaning staves

Headless:
    blender --background --python tools/blender/build_pyre.py -- --out src/assets/pyre-models.js
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
    'hearth': '#6f6b64', 'kerb': '#58544e',
    'log': '#6b4a2e', 'logDark': '#563a23', 'logEnd': '#a8875f',
    'brush': '#7d6c3d', 'brushDark': '#5f5230', 'tar': '#2e2924', 'stave': '#7a5a38',
}
KEYS = list(COLORS.keys())
COLL_NAME = 'CONQUER_Pyre'

HEARTH = .30           # half side of the hearth slab (U)
SLAB = .035            # slab thickness
LOG = .028             # half section of a log
LOG_HALF = .22         # half length of a log
COURSES = 5            # log courses in the crib
BRUSH_TOP = .52        # top of the brushwood cone


def prism(p, pts, z0, z1, key, top=None):
    """Vertical prism over a U polygon (converted to metres); faces wound outwards."""
    n = len(pts)
    vs = [(x * S, y * S, z0 * S) for x, y in pts] + [(x * S, y * S, z1 * S) for x, y in pts]
    p.quads(vs, [(i, (i + 1) % n, n + (i + 1) % n, n + i) for i in range(n)], key)
    p.quads(vs, [tuple(range(n, 2 * n))], top or key)
    p.quads(vs, [tuple(range(n - 1, -1, -1))], key)


def box(p, x0, x1, y0, y1, z0, z1, key, top=None):
    prism(p, [(x0, y0), (x1, y0), (x1, y1), (x0, y1)], z0, z1, key, top)


def pyre(root):
    parts = {}

    hearth = Part(root, 'hearth', COLORS)
    box(hearth, -HEARTH, HEARTH, -HEARTH, HEARTH, 0, SLAB, 'hearth')
    k = .03
    for sx, sy, w, d in ((0, -1, HEARTH, k), (0, 1, HEARTH, k), (-1, 0, k, HEARTH), (1, 0, k, HEARTH)):   # low kerb
        cx, cy = sx * (HEARTH - k), sy * (HEARTH - k)
        box(hearth, cx - w, cx + w, cy - d, cy + d, SLAB, SLAB + .03, 'kerb')
    parts['hearth'] = hearth.finish()

    logs = Part(root, 'logs', COLORS)
    z = SLAB
    for c in range(COURSES):
        along_x = c % 2 == 0
        for side in (-1, 1):
            off = side * (LOG_HALF - LOG * 1.4)
            key = 'log' if (c + (side > 0)) % 2 else 'logDark'
            if along_x:
                box(logs, -LOG_HALF, LOG_HALF, off - LOG, off + LOG, z, z + 2 * LOG, key, 'logEnd')
            else:
                box(logs, off - LOG, off + LOG, -LOG_HALF, LOG_HALF, z, z + 2 * LOG, key, 'logEnd')
        z += 2 * LOG
    parts['logs'] = logs.finish()

    brush = Part(root, 'brush', COLORS)
    r, base = LOG_HALF - 3 * LOG, SLAB
    ring = [(r, -r), (r, r), (-r, r), (-r, -r)]
    for i in range(4):                                                    # brushwood cone inside the crib
        (ax, ay), (bx, by) = ring[i], ring[(i + 1) % 4]
        brush.quads([(ax * S, ay * S, base * S), (bx * S, by * S, base * S), (0, 0, BRUSH_TOP * S)], [(0, 1, 2)],
                    'brush' if i % 2 else 'brushDark')
    for i, (x, y) in enumerate(((.06, .02), (-.05, .05), (.0, -.06))):    # tarred faggots on top of the crib
        box(brush, x - .045, x + .045, y - .025, y + .025, z - .01, z + .04, 'tar')
    for sx, sy in ((1, 1), (-1, 1), (1, -1), (-1, -1)):                   # staves leaning in from the corners
        x0, y0 = sx * (HEARTH - .06), sy * (HEARTH - .06)
        x1, y1 = sx * .05, sy * .05
        t, z1 = .012, BRUSH_TOP - .04
        for dy, order in ((-t, (0, 1, 2, 3)), (t, (3, 2, 1, 0))):         # two faces a stave thick apart
            brush.quads([((x0 - t) * S, (y0 + dy) * S, SLAB * S), ((x0 + t) * S, (y0 + dy) * S, SLAB * S),
                         ((x1 + t) * S, (y1 + dy) * S, z1 * S), ((x1 - t) * S, (y1 + dy) * S, z1 * S)], [order], 'stave')
    parts['brush'] = brush.finish()
    return parts


def main(out_path):
    root = fresh_collection(COLL_NAME)
    parts = {k: export_part_indexed(p, KEYS) for k, p in pyre(root).items()}
    total = sum(len(p['c']) for p in parts.values())
    data = {'palette': list(COLORS.values()), 'paletteKeys': KEYS, 'sink': 0, 'height': round(BRUSH_TOP, 3),
            'models': {'pyre': {'parts': parts}}}
    js = ("'use strict';\n// Generated by tools/blender/build_pyre.py - do not edit by hand.\n"
          "// Signal-fire pyre (U): origin at the middle of the tower deck, +x/+y the tower's local axes, +z up.\n"
          "// Parts: p = vertex xyz, i = 3 indices per triangle, c = palette index per triangle.\n"
          "window.ConquerPyreModels=" + json.dumps(data, separators=(',', ':')) + ";\n")
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, 'w', encoding='utf-8', newline='\n') as f:
        f.write(js)
    print(f"pyre models: {total} triangles, {len(js) // 1024} KB -> {out_path}")
    return {'total': total, 'kb': len(js) // 1024}


if __name__ == '__main__' and '--' in sys.argv:
    args = sys.argv[sys.argv.index('--') + 1:]
    main(args[args.index('--out') + 1])
elif 'PYRE_OUT' in globals():
    PYRE_RESULT = main(PYRE_OUT)
