"""CONQUER house kit builder (Blender 4.4+/5.x): the detail pieces the game assembles on its
procedural house plans (settlement-house3d.js): upper-floor and ground-floor windows, the door,
the 60-degree gabled roof, the chimney stack and the jetty joist end.

Houses have no fixed size (lots, rows, L/T wings, per-id proportions), so unlike the civic
buildings they are not whole models: the game keeps its plans (houseFootprintParts /
urbanDenseParts, houseFacadePlan, houseDoorInfo, chimneySpecs) and places these pieces on them.
Low-poly, flat colours, real metres (1 U = 3.5 m), exported in U.

Piece axes:
  wall pieces (windows, door, joist): +X along the wall, +Y out of the wall, +Z up; origin on the
    wall face, at the opening centre (windows), at the threshold centre (door), under the joist
    (0.07 U high: its top meets the floor break).
  roof: ridge along X for a unit length (x -0.5..0.5) and a unit span (y -0.5..0.5) at 60 degrees,
    origin at the wall top (eaves line) on the centre; the game scales x by the ridge length and
    y, z by the span (the pitch is constant, so the scaling is uniform across the slope).
  chimney: footprint 0.22 x 0.20 U as chimneySpecs, z 0..0.48 U, origin at the bottom centre.
Palette keys starting with 'roof' turn white in winter. Stone keys use the same hex values as the
procedural houses so the brick masonry swatches (CLAY_VISUAL_SWATCHES) still apply.

Run headless:
    blender --background --factory-startup --python tools/blender/build_houses.py -- --out src/assets/house-models.js
"""
import json, math, os, sys, importlib
_here = os.path.dirname(os.path.abspath(__file__)) if '__file__' in globals() else CQ_DIR
if _here not in sys.path:
    sys.path.insert(0, _here)
import cq_blender
importlib.reload(cq_blender)
from cq_blender import Part, fresh_collection, export_part_indexed

S = 3.5   # metres per game unit
COLORS = {
    'stone': '#625e59', 'stoneDark': '#4f4b47', 'stoneTrim': '#8a857d', 'step': '#77736b',
    'plaster': '#e0ca91', 'beam': '#3b2a1e', 'wood': '#6b4a30', 'woodDark': '#4a3626',
    'glass': '#232120', 'shutter': '#56664a', 'shutterDark': '#45533b', 'iron': '#2e2b28',
    'roofSlate': '#303237', 'roofSlateDark': '#3a3d42', 'roofCourse': '#27292d', 'roofRidge': '#2a2b2f',
    'eaves': '#2b211a', 'chimney': '#3b302c', 'chimneyDark': '#332824', 'chimneyCap': '#493732',
}
KEYS = list(COLORS.keys())
COLL_NAME = 'CONQUER_Houses'
WIN_HW, WIN_HH = .0875, .15          # HOUSE_WINDOW_HALF_W / _H (settlement-urban.js)
DOOR_HW, DOOR_TOP = .08, .552        # houseDoorInfo half width, HOUSE_DOOR_TOP
PITCH = math.tan(math.radians(60))   # HOUSE_ROOF_PITCH


class Model:
    def __init__(self, root, name, offset):
        self.root, self.name, self.offset, self.parts = root, name, offset, {}

    def part(self, key):
        return Part(self.root, key, COLORS, self.offset, prefix=self.name + '_')

    def done(self, key, p):
        self.parts[key] = p.finish()


# ------------------------------------------------------------------ primitives (U in, metres out)
def box(p, x0, y0, z0, x1, y1, z1, key):
    p.box(((x0 + x1) / 2 * S, (y0 + y1) / 2 * S, (z0 + z1) / 2 * S), ((x1 - x0) * S, (y1 - y0) * S, (z1 - z0) * S), key)


def slab(p, pts, t, key, under=None):
    """Planar quad (U, counter-clockwise from outside) thickened by t along its normal inwards."""
    a = [tuple(v * S for v in q) for q in pts]
    ux, uy, uz = (a[1][i] - a[0][i] for i in range(3))
    vx, vy, vz = (a[3][i] - a[0][i] for i in range(3))
    n = (uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx)
    L = math.sqrt(sum(c * c for c in n)) or 1
    d = [-c / L * t * S for c in n]
    b = [(q[0] + d[0], q[1] + d[1], q[2] + d[2]) for q in a]
    vs = a + b
    p.quads(vs, [(0, 1, 2, 3)], key)
    p.quads(vs, [(7, 6, 5, 4)], under or key)
    p.quads(vs, [(0, 4, 5, 1), (1, 5, 6, 2), (2, 6, 7, 3), (3, 7, 4, 0)], under or key)


# ------------------------------------------------------------------ pieces
def window_upper(mdl):
    """Casement in the timbered floor: frame, cross, sill, two shutters folded open on the wall."""
    hw, hh, f = WIN_HW, WIN_HH, .022
    fr = mdl.part('frame')
    box(fr, -hw - f, -.01, -hh - f, -hw, .02, hh + f, 'wood')
    box(fr, hw, -.01, -hh - f, hw + f, .02, hh + f, 'wood')
    box(fr, -hw, -.01, hh, hw, .02, hh + f, 'wood')
    box(fr, -hw, -.01, -hh - f, hw, .02, -hh, 'wood')
    box(fr, -.006, -.004, -hh, .006, .012, hh, 'wood')               # mullion
    box(fr, -hw, -.004, -.006 + hh * .2, hw, .012, .006 + hh * .2, 'wood')   # transom
    box(fr, -hw - f - .015, 0, -hh - f - .016, hw + f + .015, .045, -hh - f, 'woodDark')   # sill
    mdl.done('frame', fr)
    gl = mdl.part('glass')
    box(gl, -hw, -.012, -hh, hw, -.006, hh, 'glass')
    mdl.done('glass', gl)
    sh = mdl.part('shutters')
    for s in (-1, 1):
        x0, x1 = sorted((s * (hw + f + .004), s * (hw + f + .004 + hw * .95)))
        box(sh, x0, .004, -hh + .01, x1, .016, hh - .01, 'shutter')
        for z in (-hh * .55, hh * .55):
            box(sh, x0 + .008, .016, z - .01, x1 - .008, .022, z + .01, 'shutterDark')
    mdl.done('shutters', sh)


def window_ground(mdl):
    """Small window in the stone ground floor: dressed surround, iron bars, stone sill."""
    hw, hh, f = WIN_HW, WIN_HH, .03
    fr = mdl.part('frame')
    box(fr, -hw - f, -.008, -hh, -hw, .018, hh + f, 'stoneTrim')
    box(fr, hw, -.008, -hh, hw + f, .018, hh + f, 'stoneTrim')
    box(fr, -hw - f, -.008, hh, hw + f, .022, hh + f + .012, 'stoneTrim')   # lintel
    box(fr, -hw - f - .012, -.008, -hh - .028, hw + f + .012, .04, -hh, 'stoneTrim')   # sill
    mdl.done('frame', fr)
    gl = mdl.part('glass')
    box(gl, -hw, -.014, -hh, hw, -.008, hh, 'glass')
    mdl.done('glass', gl)
    br = mdl.part('bars')
    for x in (-hw * .5, 0, hw * .5):
        box(br, x - .005, -.004, -hh, x + .005, .006, hh, 'iron')
    box(br, -hw, -.004, -.005, hw, .006, .005, 'iron')
    mdl.done('bars', br)


def door(mdl):
    """Plank door in a stone frame with an arched-look lintel block and a step."""
    hw, top, f = DOOR_HW, DOOR_TOP, .032
    fr = mdl.part('frame')
    box(fr, -hw - f, -.008, 0, -hw, .024, top, 'stoneTrim')
    box(fr, hw, -.008, 0, hw + f, .024, top, 'stoneTrim')
    box(fr, -hw - f - .01, -.008, top, hw + f + .01, .03, top + .045, 'stoneTrim')
    mdl.done('frame', fr)
    lf = mdl.part('leaf')
    box(lf, -hw, -.014, 0, hw, -.004, top, 'wood')
    for i in (1, 2, 3):
        x = -hw + 2 * hw * i / 4
        box(lf, x - .003, -.004, .01, x + .003, -.001, top - .01, 'woodDark')
    for z in (.12, top - .12):
        box(lf, -hw + .01, -.004, z - .008, hw * .55, .002, z + .008, 'iron')
    box(lf, hw * .55, -.004, top * .48, hw * .55 + .014, .006, top * .52, 'iron')   # ring
    mdl.done('leaf', lf)
    st = mdl.part('step')
    box(st, -hw - f - .02, .0, 0, hw + f + .02, .07, .022, 'step')
    mdl.done('step', st)


def roof(mdl):
    """Unit 60-degree gable roof: two thick slate slopes with eaves and verge overhang, slate
    courses, a ridge cap and dark eaves boards."""
    ov, vg, t, rise = .07, .045, .028, PITCH * .5
    zo = -ov * PITCH
    sl = mdl.part('slopes')
    for s in (-1, 1):
        y_e = s * (.5 + ov)
        pts = [(-.5 - vg, y_e, zo), (.5 + vg, y_e, zo), (.5 + vg, 0, rise), (-.5 - vg, 0, rise)]
        if s < 0:
            pts = [pts[1], pts[0], pts[3], pts[2]]
        slab(sl, pts, t, 'roofSlate' if s < 0 else 'roofSlateDark', 'eaves')
    mdl.done('slopes', sl)
    co = mdl.part('courses')
    for s in (-1, 1):
        for k in range(1, 6):
            f = k / 6
            y = s * (.5 + ov) * (1 - f)
            z = zo + (rise - zo) * f
            n = (0, s * math.sin(math.radians(30)), math.cos(math.radians(30)))
            lift = .0035
            y0, z0 = y + n[1] * lift, z + n[2] * lift
            dy, dz = -s * .012 * .5, .012 * PITCH * .5
            pts = [(-.5 - vg, y0, z0), (.5 + vg, y0, z0), (.5 + vg, y0 + dy, z0 + dz), (-.5 - vg, y0 + dy, z0 + dz)]
            if s < 0:
                pts = [pts[1], pts[0], pts[3], pts[2]]
            co.quads([tuple(v * S for v in q) for q in pts], [(0, 1, 2, 3)], 'roofCourse')
    mdl.done('courses', co)
    rg = mdl.part('ridge')
    box(rg, -.5 - vg, -.022, rise - .01, .5 + vg, .022, rise + .03, 'roofRidge')
    mdl.done('ridge', rg)


def chimney(mdl):
    """Stack as chimneySpecs (0.22 x 0.20 U, 0.48 U high) with a band and a projecting cap."""
    ch = mdl.part('stack')
    box(ch, -.11, -.10, 0, .11, .10, .40, 'chimney')
    box(ch, -.12, -.11, .26, .12, .11, .285, 'chimneyDark')
    box(ch, -.13, -.12, .40, .13, .12, .44, 'chimneyCap')
    box(ch, -.075, -.065, .44, .075, .065, .48, 'chimneyDark')
    mdl.done('stack', ch)


def joist(mdl):
    """Joist end carrying the jetty: a squared beam end with a chamfered drop below it."""
    j = mdl.part('joist')
    box(j, -.02, 0, .025, .02, .07, .07, 'beam')
    box(j, -.016, 0, 0, .016, .03, .025, 'beam')
    mdl.done('joist', j)


BUILD = [('windowUpper', window_upper), ('windowGround', window_ground), ('door', door),
         ('roof', roof), ('chimney', chimney), ('joist', joist)]


def main(out_path):
    root = fresh_collection(COLL_NAME)
    data = {'palette': list(COLORS.values()), 'paletteKeys': KEYS, 'models': {}}
    total, stats = 0, {}
    for i, (name, fn) in enumerate(BUILD):
        mdl = Model(root, name, (i * 8, 0, 0))
        fn(mdl)
        parts = {k: export_part_indexed(p, KEYS) for k, p in mdl.parts.items()}
        n = sum(len(p['c']) for p in parts.values())
        stats[name] = n
        total += n
        data['models'][name] = {'parts': parts}
    js = ("'use strict';\n// Generated by tools/blender/build_houses.py — do not edit by hand.\n"
          "// House kit pieces in piece-local space (U): see the builder for each piece's axes.\n"
          "// Parts: p = vertex xyz, i = 3 indices per triangle, c = palette index per triangle.\n"
          "window.ConquerHouseModels=" + json.dumps(data, separators=(',', ':')) + ";\n")
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, 'w', encoding='utf-8', newline='\n') as f:
        f.write(js)
    print(f"house kit: {len(stats)} pieces, {total} triangles, {len(js) // 1024} KB -> {out_path}")
    print(json.dumps(stats))
    return {'total': total, 'kb': len(js) // 1024, 'models': stats}


if __name__ == '__main__' and '--' in sys.argv:
    args = sys.argv[sys.argv.index('--') + 1:]
    main(args[args.index('--out') + 1])
elif 'HOUSE_OUT' in globals():
    HOUSE_RESULT = main(HOUSE_OUT)
