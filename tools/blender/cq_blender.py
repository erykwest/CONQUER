"""Shared helpers for the CONQUER Blender builders (wagon, animals).

Parts are built from bmesh primitives in real metres, shown in the open scene
and exported as flat triangle lists in game units (U) with a palette index per
triangle. Model axes: +X forward, +Y left, +Z up, origin on the ground.
"""
import bpy, bmesh, math
from mathutils import Vector, Matrix

METERS_PER_U = 3.5   # a 1.75 m person is ~0.5 U in game


def fresh_collection(name):
    """(Re)create a top-level collection, removing a previous build."""
    old = bpy.data.collections.get(name)
    if old:
        for ob in list(old.all_objects):
            bpy.data.objects.remove(ob, do_unlink=True)
        for ch in list(old.children_recursive):
            bpy.data.collections.remove(ch)
        bpy.data.collections.remove(old)
    root = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(root)
    return root


def material(key, hex_color, prefix=''):
    name = 'cq_' + prefix + key
    m = bpy.data.materials.get(name)
    if not m:
        m = bpy.data.materials.new(name)
        m['cq_key'] = key
    h = hex_color.lstrip('#')
    rgb = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    m.diffuse_color = (*[c ** 2.2 for c in rgb], 1.0)   # viewport colour (linear)
    return m


class Part:
    """One exported part: a Blender object built from bmesh primitives."""
    def __init__(self, root, name, palette, offset=(0, 0, 0), prefix=''):
        self.name = name
        self.palette = palette
        self.prefix = prefix   # per-model material names (several palettes in one scene)
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
        faces = [(0, 2, 3, 1), (4, 5, 7, 6), (0, 1, 5, 4), (2, 6, 7, 3), (0, 4, 6, 2), (1, 3, 7, 5)]
        self.quads(corners, faces, key)

    def frame(self, a, b):
        """Orthonormal frame with x along a->b and a horizontal side axis."""
        d = Vector(b) - Vector(a)
        x = d.normalized()
        y = Vector((0, 0, 1)).cross(x)
        if y.length < 1e-3:                       # vertical: any horizontal side axis
            y = Vector((1, 0, 0)).cross(x)
        y.normalize()
        return x, y, x.cross(y), d.length

    def beam(self, a, b, w, h, key):
        """Box of width w (horizontal) and height h from point a to point b."""
        x, y, z, length = self.frame(a, b)
        rot = Matrix((x, y, z)).transposed()
        self.box(tuple((Vector(a) + Vector(b)) / 2), (length, w, h), key, rot)

    def taper(self, a, b, w0, h0, w1, h1, key, end_key=None):
        """Tapered box (frustum) from a (w0 x h0) to b (w1 x h1): legs, necks, tails."""
        x, y, z, _ = self.frame(a, b)
        A, B = Vector(a), Vector(b)
        ring = lambda c, w, h: [c + y * sy * w / 2 + z * sz * h / 2 for sy, sz in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
        r0, r1 = ring(A, w0, h0), ring(B, w1, h1)
        vs = r0 + r1
        self.quads(vs, [(0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)], key)
        self.quads(vs, [(3, 2, 1, 0)], key)
        self.quads(vs, [(4, 5, 6, 7)], end_key or key)

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

    def cylinder(self, r, half, key, n=12, axis='y', center=(0, 0, 0), cap_key=None, radii=None, along=None, squash=1.0):
        """Closed cylinder; radii/along give a profile (barrel, sack, animal barrel).
        squash scales the second cross-section axis (oval sections)."""
        c = Vector(center)
        prof = list(zip(along, radii)) if radii else [(-half, r), (half, r)]
        def p(rr, a, s):
            u, v = math.cos(a) * rr, math.sin(a) * rr * squash
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

    def finish(self, recalc=True):
        """recalc=False keeps the winding as built (open cloth surfaces)."""
        me = bpy.data.meshes.new(self.name)
        if recalc:
            bmesh.ops.recalc_face_normals(self.bm, faces=self.bm.faces)
        self.bm.to_mesh(me); self.bm.free()
        for key in self.mats:
            me.materials.append(material(key, self.palette[key], self.prefix))
        ob = bpy.data.objects.new(self.prefix + self.name, me)
        ob.location = self.offset
        self.coll.objects.link(ob)
        self.object = ob
        return self


def export_part(part, keys, digits=3):
    """Triangles of a finished part in U (local coords) + palette index per triangle."""
    me = part.object.data
    me.calc_loop_triangles()
    v, c = [], []
    for tri in me.loop_triangles:
        for vi in tri.vertices:
            co = me.vertices[vi].co
            v += [round(co.x / METERS_PER_U, digits), round(co.y / METERS_PER_U, digits), round(co.z / METERS_PER_U, digits)]
        c.append(keys.index(me.materials[tri.material_index]['cq_key']))
    return {'v': v, 'c': c}


def export_part_indexed(part, keys, digits=3):
    """Like export_part but with shared vertices: {p: xyz list (U), i: 3 indices per
    triangle, c: palette index per triangle}. About 2.5x smaller for box-built models."""
    me = part.object.data
    me.calc_loop_triangles()
    p, i, c, seen = [], [], [], {}
    for tri in me.loop_triangles:
        for vi in tri.vertices:
            co = me.vertices[vi].co
            k = (round(co.x / METERS_PER_U, digits), round(co.y / METERS_PER_U, digits), round(co.z / METERS_PER_U, digits))
            if k not in seen:
                seen[k] = len(seen)
                p += [0 if v == 0 else v for v in k]
            i.append(seen[k])
        c.append(keys.index(me.materials[tri.material_index]['cq_key']))
    return {'p': p, 'i': i, 'c': c}


def u(*meters):
    """Metres -> U, rounded like the exported geometry."""
    return [round(x / METERS_PER_U, 4) for x in meters]
