"""CONQUER modular wagon builder (Blender 5.x).

Builds the wagon as separate, reusable parts in real metres, shows them in the
open scene, and exports a game data module (triangles + base colours + mount
points) for src/settlement-wagons3d.js.

Run inside Blender (BlenderMCP execute_code or the Text editor):
    WAGON_OUT = r"...\\src\\assets\\wagon-model.js"; exec(open(r"...\\build_wagon.py").read())
or headless:
    blender.exe -b --factory-startup --python build_wagon.py -- --out <path>

Axes (model local): +X forward (towards the team), +Y left, +Z up; origin on the
ground under the middle of the bed. Export divides by METERS_PER_U (a 1.75 m
person is ~0.5 U in game).

Shading is NOT baked: the game shades each triangle from its world normal so a
turning wagon keeps the castle's two-tone side rule.
"""
import bpy, bmesh, math, json, os, sys
from mathutils import Vector, Matrix

METERS_PER_U = 3.5
COLORS = {
    'wood': '#9a6a3f', 'woodLight': '#b98652', 'woodDark': '#6f4a2b',
    'iron': '#55595d', 'ironLight': '#7c8186', 'canvas': '#e8dcc0', 'canvasHoop': '#8a6a46',
    'sack': '#c9a46e', 'sackDark': '#a8834f', 'twine': '#7a5a32', 'hay': '#e2c25a',
    'barrel': '#8a5a35', 'stone': '#9a9893', 'stoneDark': '#7f7d78', 'log': '#8b6a45', 'logEnd': '#c9a66f',
    'leather': '#4a3020',
}

# ---------------------------------------------------------------- scene setup
COLL_NAME = 'CONQUER_Wagon'
def fresh_collection():
    old = bpy.data.collections.get(COLL_NAME)
    if old:
        for ob in list(old.all_objects):
            bpy.data.objects.remove(ob, do_unlink=True)
        for ch in list(old.children):
            bpy.data.collections.remove(ch)
        bpy.data.collections.remove(old)
    root = bpy.data.collections.new(COLL_NAME)
    bpy.context.scene.collection.children.link(root)
    return root

def material(key):
    name = 'cq_' + key
    m = bpy.data.materials.get(name)
    if not m:
        m = bpy.data.materials.new(name)
        h = COLORS[key].lstrip('#')
        rgb = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
        m.diffuse_color = (*[c ** 2.2 for c in rgb], 1.0)  # viewport colour (linear)
        m['cq_key'] = key
    return m

class Part:
    """One exported part: a Blender object built from bmesh primitives."""
    def __init__(self, root, name, offset=(0, 0, 0)):
        self.name = name
        self.bm = bmesh.new()
        self.mats = []
        coll = bpy.data.collections.new('part_' + name)
        root.children.link(coll)
        self.coll = coll
        self.offset = Vector(offset)   # display offset only (templates laid out side by side)

    def _mat(self, key):
        if key not in self.mats:
            self.mats.append(key)
        return self.mats.index(key)

    def quads(self, verts, faces, key):
        vs = [self.bm.verts.new(Vector(v)) for v in verts]
        mi = self._mat(key)
        for f in faces:
            face = self.bm.faces.new([vs[i] for i in f])
            face.material_index = mi

    def box(self, center, size, key, rot=None):
        """Axis-aligned box (optionally rotated by a 3x3 Matrix about its centre)."""
        cx, cy, cz = center; sx, sy, sz = (s / 2 for s in size)
        corners = [Vector((x, y, z)) for x in (-sx, sx) for y in (-sy, sy) for z in (-sz, sz)]
        if rot is not None:
            corners = [rot @ c for c in corners]
        corners = [c + Vector((cx, cy, cz)) for c in corners]
        # index = ix*4 + iy*2 + iz
        faces = [(0, 2, 3, 1), (4, 5, 7, 6), (0, 1, 5, 4), (2, 6, 7, 3), (0, 4, 6, 2), (1, 3, 7, 5)]
        self.quads(corners, faces, key)

    def beam(self, a, b, w, h, key):
        """Box of width w (horizontal) and height h from point a to point b."""
        a, b = Vector(a), Vector(b)
        d = b - a; length = d.length
        x = d.normalized()
        y = Vector((0, 0, 1)).cross(x)
        if y.length < 1e-3:                       # vertical beam: any horizontal side axis
            y = Vector((1, 0, 0)).cross(x)
        y.normalize()
        z = x.cross(y)
        rot = Matrix((x, y, z)).transposed()
        self.box(tuple((a + b) / 2), (length, w, h), key, rot)

    def ring(self, r_out, r_in, half, key, n=12, axis='y', center=(0, 0, 0), side_key=None, outer=True, inner=True):
        """Annulus extruded along an axis (wheel tyre / felloe); hidden surfaces can be skipped."""
        c = Vector(center)
        def p(r, a, s):
            u, v = math.cos(a) * r, math.sin(a) * r
            return c + (Vector((u, s, v)) if axis == 'y' else Vector((s, u, v)) if axis == 'x' else Vector((u, v, s)))
        for i in range(n):
            a0, a1 = 2 * math.pi * i / n, 2 * math.pi * (i + 1) / n
            vs = [p(r_out, a0, -half), p(r_out, a1, -half), p(r_out, a1, half), p(r_out, a0, half),
                  p(r_in, a0, -half), p(r_in, a1, -half), p(r_in, a1, half), p(r_in, a0, half)]
            surf = ([(0, 1, 2, 3)] if outer else []) + ([(7, 6, 5, 4)] if inner else [])
            if surf:
                self.quads(vs, surf, key)
            self.quads(vs, [(4, 5, 1, 0), (3, 2, 6, 7)], side_key or key)

    def cylinder(self, r, half, key, n=12, axis='y', center=(0, 0, 0), cap_key=None, radii=None, along=None):
        """Closed cylinder; radii/along give a profile (bulged barrel, tapered sack)."""
        c = Vector(center)
        prof = list(zip(along, radii)) if radii else [(-half, r), (half, r)]
        def p(rr, a, s):
            u, v = math.cos(a) * rr, math.sin(a) * rr
            return c + (Vector((u, s, v)) if axis == 'y' else Vector((s, u, v)) if axis == 'x' else Vector((u, v, s)))
        for k in range(len(prof) - 1):
            (s0, r0), (s1, r1) = prof[k], prof[k + 1]
            for i in range(n):
                a0, a1 = 2 * math.pi * i / n, 2 * math.pi * (i + 1) / n
                self.quads([p(r0, a0, s0), p(r0, a1, s0), p(r1, a1, s1), p(r1, a0, s1)], [(0, 1, 2, 3)], key)
        for s, rr, flip in ((prof[0][0], prof[0][1], True), (prof[-1][0], prof[-1][1], False)):
            pts = [p(rr, 2 * math.pi * i / n, s) for i in range(n)]
            if flip:
                pts = pts[::-1]
            self.quads(pts, [tuple(range(n))], cap_key or key)

    def finish(self):
        me = bpy.data.meshes.new(self.name)
        bmesh.ops.recalc_face_normals(self.bm, faces=self.bm.faces)
        self.bm.to_mesh(me); self.bm.free()
        for key in self.mats:
            me.materials.append(material(key))
        ob = bpy.data.objects.new(self.name, me)
        ob.location = self.offset
        self.coll.objects.link(ob)
        self.object = ob
        return self

# ---------------------------------------------------------------- parts
def plank_wall(part, x0, x1, y, z0, z1, thick, along='x', keys=('wood', 'woodLight')):
    """Side or end wall made of horizontal planks with alternating tones."""
    n = 2; gap = .02; h = (z1 - z0 - gap * (n - 1)) / n
    for i in range(n):
        za = z0 + i * (h + gap); zc = za + h / 2
        if along == 'x':
            part.box(((x0 + x1) / 2, y, zc), (x1 - x0, thick, h), keys[i % 2])
        else:
            part.box((y, (x0 + x1) / 2, zc), (thick, x1 - x0, h), keys[i % 2])

def bed(part, x0, x1, half_w, floor, wall_top):
    part.box(((x0 + x1) / 2, 0, floor - .04), (x1 - x0, half_w * 2, .08), 'woodDark')          # floor
    for s in (-1, 1):
        plank_wall(part, x0, x1, s * half_w, floor, wall_top, .05)                                # sides
        part.box(((x0 + x1) / 2, s * .45, floor - .13), (x1 - x0 - .1, .1, .1), 'woodDark')      # sills
        for px in (x0 + .04, (x0 + x1) / 2, x1 - .04):                                            # stakes
            part.box((px, s * (half_w + .04), (floor + wall_top) / 2 - .02), (.07, .05, wall_top - floor + .12), 'woodDark')
    for ex in (x0, x1):
        plank_wall(part, -half_w, half_w, ex, floor, wall_top, .05, along='y')                    # ends

def wheel(part, r, half=.045, spokes=8):
    part.ring(r, r - .03, half, 'iron', side_key='ironLight', inner=False)                        # iron tyre
    part.ring(r - .03, r - .1, half * .85, 'wood', side_key='woodDark', outer=False)               # felloe
    part.cylinder(.1, .09, 'woodDark', n=8, cap_key='ironLight')                                   # hub
    for i in range(spokes):
        a = 2 * math.pi * i / spokes
        d = Vector((math.cos(a), 0, math.sin(a)))
        part.beam(d * .09, d * (r - .09), .035, .035, 'woodLight')

def axle(part, x, z, half_track):
    part.box((x, 0, z), (.09, half_track * 2 + .2, .09), 'woodDark')

def build(root):
    parts = {}
    P = lambda name, off=(0, 0, 0): Part(root, name, off)

    # --- wagon body: bed, under-frame, front bolster, seat
    p = P('wagonBody')
    bed(p, -1.5, 1.5, .65, .9, 1.28)
    axle(p, -1.0, .6, .85); axle(p, 1.05, .45, .85)
    p.box((1.05, 0, .68), (.22, 1.1, .36), 'woodDark')                                           # front bolster
    p.box((1.32, 0, 1.5), (.36, 1.1, .06), 'woodLight')                                           # seat board
    for s in (-1, 1):
        p.box((1.32, s * .5, 1.38), (.06, .06, .2), 'woodDark')                                   # seat posts
    p.box((1.12, 0, 1.62), (.05, 1.1, .2), 'wood')                                                # backrest
    parts['wagonBody'] = p.finish()

    # --- cart body (two wheels, no seat)
    p = P('cartBody', (0, 4, 0))
    bed(p, -.9, .9, .6, .85, 1.2)
    axle(p, 0, .65, .8)
    parts['cartBody'] = p.finish()

    # --- wheels as templates centred on their axle
    for name, r in (('wheelRear', .6), ('wheelFront', .45), ('wheelCart', .65)):
        p = P(name, (-3, {'wheelRear': 0, 'wheelFront': 1.5, 'wheelCart': 3}[name], 1))
        wheel(p, r)
        parts[name] = p.finish()

    # --- hitches: pole for a pair, shafts for a single horse
    p = P('wagonPole', (0, -4, 0))
    p.beam((1.1, 0, .45), (3.0, 0, .8), .08, .08, 'woodDark')
    p.beam((2.95, -.5, .82), (2.95, .5, .82), .06, .06, 'woodDark')                               # yoke bar
    parts['wagonPole'] = p.finish()
    for name, x0, z0 in (('wagonShafts', 1.1, .5), ('cartShafts', .9, .75)):
        p = P(name, (0, -6 if name == 'wagonShafts' else -8, 0))
        for s in (-1, 1):
            p.beam((x0, s * .35, z0), (x0 + 2.2, s * .3, .95), .06, .06, 'woodDark')
        p.beam((x0 + .1, -.36, z0 + .02), (x0 + .1, .36, z0 + .02), .06, .06, 'woodDark')
        parts[name] = p.finish()

    # --- canvas cover: hoops and an elliptic canvas shell (open ends)
    p = P('cover')
    n = 8; x0, x1 = -1.45, 1.45; base, top, hw = 1.28, 2.35, .68
    arc = [(-hw * math.cos(math.pi * i / n), base + (top - base) * math.sin(math.pi * i / n)) for i in range(n + 1)]
    for i in range(n):
        (y0, z0), (y1, z1) = arc[i], arc[i + 1]
        p.quads([(x0, y0, z0), (x1, y0, z0), (x1, y1, z1), (x0, y1, z1)], [(0, 1, 2, 3)], 'canvas')
    # Hoops: flat bands just proud of the canvas (only their outer face shows).
    for hx in (-1.42, -.47, .47, 1.42):
        for i in range(n):
            (y0, z0), (y1, z1) = arc[i], arc[i + 1]
            k0, k1 = 1.015, 1.015
            p.quads([(hx - .03, y0 * k0, (z0 - base) * k0 + base), (hx + .03, y0 * k0, (z0 - base) * k0 + base),
                     (hx + .03, y1 * k1, (z1 - base) * k1 + base), (hx - .03, y1 * k1, (z1 - base) * k1 + base)], [(0, 1, 2, 3)], 'canvasHoop')
    parts['cover'] = p.finish()

    # --- cargo templates, base centred on the bed floor
    cx = 4.5
    p = P('cargoSack', (cx, 0, 0))
    p.cylinder(.22, 0, 'sack', n=8, axis='z', radii=[.2, .25, .22, .1, .07], along=[0, .14, .32, .44, .5], cap_key='sackDark')
    p.cylinder(.08, 0, 'twine', n=8, axis='z', radii=[.085, .085], along=[.42, .46])
    parts['cargoSack'] = p.finish()
    p = P('cargoCrate', (cx, 1, 0))
    p.box((0, 0, .22), (.5, .5, .44), 'woodLight')
    for s in (-1, 1):
        p.box((0, s * .26, .22), (.52, .03, .07), 'woodDark'); p.box((s * .26, 0, .22), (.03, .52, .07), 'woodDark')
    parts['cargoCrate'] = p.finish()
    p = P('cargoBarrel', (cx, 2, 0))
    p.cylinder(.2, 0, 'barrel', n=8, axis='z', radii=[.18, .23, .23, .18], along=[0, .2, .36, .56], cap_key='woodLight')
    for z in (.08, .48):
        p.cylinder(.2, 0, 'iron', n=8, axis='z', radii=[.235, .24], along=[z, z + .04])
    parts['cargoBarrel'] = p.finish()
    p = P('cargoHay', (cx, 3, 0))
    p.box((0, 0, .2), (.62, .42, .4), 'hay')
    for s in (-1, 1):
        p.box((s * .16, 0, .2), (.04, .44, .42), 'twine')
    parts['cargoHay'] = p.finish()
    p = P('cargoLogs', (cx, 4, 0))
    for (y, z) in ((-.11, .1), (.11, .1), (0, .28)):
        p.cylinder(.1, .5, 'log', n=8, axis='x', center=(0, y, z), cap_key='logEnd')
    parts['cargoLogs'] = p.finish()
    p = P('cargoStone', (cx, 5, 0))
    vs = [(-.24, -.2, 0), (.24, -.2, 0), (.24, .2, 0), (-.24, .2, 0), (-.18, -.15, .3), (.2, -.12, .26), (.16, .16, .32), (-.2, .14, .28)]
    p.quads(vs, [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)], 'stone')
    parts['cargoStone'] = p.finish()
    return parts

# ---------------------------------------------------------------- export
def export(parts, out_path):
    palette = list(COLORS.values()); keys = list(COLORS.keys())
    data = {'unit': 'U', 'metersPerU': METERS_PER_U, 'palette': palette, 'paletteKeys': keys, 'parts': {}}
    for name, part in parts.items():
        ob = part.object; me = ob.data
        me.calc_loop_triangles()
        v, c = [], []
        for tri in me.loop_triangles:
            for vi in tri.vertices:
                co = me.vertices[vi].co   # local coordinates (display offset excluded)
                v += [round(co.x / METERS_PER_U, 3), round(co.y / METERS_PER_U, 3), round(co.z / METERS_PER_U, 3)]
            key = me.materials[tri.material_index]['cq_key']
            c.append(keys.index(key))
        data['parts'][name] = {'v': v, 'c': c}
    u = lambda *m: [round(x / METERS_PER_U, 4) for x in m]
    data['variants'] = {
        'wagon': {
            'body': 'wagonBody', 'cover': 'cover', 'hitch': {'1': 'wagonShafts', '2': 'wagonPole'},
            'wheels': [{'part': 'wheelRear', 'r': u(.6)[0], 'at': [u(-1.0, s * .85, .6) for s in (-1, 1)]},
                       {'part': 'wheelFront', 'r': u(.45)[0], 'at': [u(1.05, s * .85, .45) for s in (-1, 1)]}],
            # Seated driver: figure feet below the seat so only the upper body shows.
            'seat': u(1.32, 0, .62),
            'slots': [u(x, y, .9) for y in (.3, -.3) for x in (-.9, 0, .9)],
            'horses': {'1': [u(3.55, 0)], '2': [u(3.55, .45), u(3.55, -.45)]},
        },
        'cart': {
            'body': 'cartBody', 'cover': None, 'hitch': {'1': 'cartShafts', '2': 'cartShafts'},
            'wheels': [{'part': 'wheelCart', 'r': u(.65)[0], 'at': [u(0, s * .8, .65) for s in (-1, 1)]}],
            'seat': None,
            'slots': [u(x, y, .85) for y in (.28, -.28) for x in (-.45, .45)],
            'horses': {'1': [u(3.45, 0)], '2': [u(3.45, 0)]},
        },
    }
    data['cargo'] = {'sack': 'cargoSack', 'crate': 'cargoCrate', 'barrel': 'cargoBarrel',
                     'hay': 'cargoHay', 'logs': 'cargoLogs', 'stone': 'cargoStone'}
    js = ("'use strict';\n// Generated by ASSETS/blender/build_wagon.py — do not edit by hand.\n"
          "// Wagon parts as triangles in model space (U): +x forward, +y left, +z up.\n"
          "window.ConquerWagonModel=" + json.dumps(data, separators=(',', ':')) + ";\n")
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, 'w', encoding='utf-8', newline='\n') as f:
        f.write(js)
    tris = sum(len(p['c']) for p in data['parts'].values())
    print(f"wagon model: {len(parts)} parts, {tris} triangles, {len(js) // 1024} KB -> {out_path}")
    return tris

def main(out_path):
    root = fresh_collection()
    parts = build(root)
    return export(parts, out_path)

if __name__ == '__main__' and '--' in sys.argv:
    args = sys.argv[sys.argv.index('--') + 1:]
    main(args[args.index('--out') + 1])
elif 'WAGON_OUT' in globals():
    WAGON_RESULT = main(WAGON_OUT)
