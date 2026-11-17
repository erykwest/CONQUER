"""CONQUER regional-map token kit (Blender 4.4+/5.x): very low-poly stylised pieces for the 3D
regional map (lab/3dregionmap.html): village, castle, pier, ship, troops.

These are map tokens, not Builder models: a handful of flat-coloured prisms each, distilled from
the Builder kits (the 60-degree gabled cottages of build_houses.py, the civic stone and slate,
the cog hull and square sail of build_ships.py, the plank pier on piles of build_waterside.py,
the capsule-like soldiers) and reduced to the silhouette that still reads at regional zoom.
Budget: every token stays under ~100 triangles; hidden faces (bottoms, faces buried in other
prisms) are never emitted.

Units: token units, not game U. Origin on the ground (waterline for ship and pier) at the
footprint centre, +X forward (ship bow, pier seaward end), +Y left, +Z up. Every token fits a
footprint of radius ~1, so the map scales it by one number per territory size.

Palette: builder hexes. The key 'team' (flags, sail, tabards) is meant to be replaced by the
owner's political colour; keys ending in 'Dark' are the pre-shaded slope/side of the same
material, because the regional renderer has no lighting. Flags and sails are single planes:
draw without back-face culling (the region3d renderer does not cull).

Run headless:
    blender --background --factory-startup --python tools/blender/build_region_tokens.py -- --out src/assets/region-token-models.js [--render DIR]
"""
import json, math, os, sys, importlib
_here = os.path.dirname(os.path.abspath(__file__)) if '__file__' in globals() else CQ_DIR
if _here not in sys.path:
    sys.path.insert(0, _here)
import cq_blender
importlib.reload(cq_blender)
from cq_blender import Part, fresh_collection

COLORS = {
    # houses: the game's own house colours (settlement-house3d.js / build_houses.py)
    'daub': '#654936', 'daubDark': '#4e392d',                              # L1 cottages
    'houseStone': '#625e59', 'houseStoneDark': '#4f4b47',                  # L2-L4 ground floor
    'plaster': '#e0ca91', 'plasterDark': '#c8ae70',                        # L2-L4 upper floor
    'roofThatch': '#b39250', 'roofThatchDark': '#977a42',
    'houseSlate': '#3a3d42', 'houseSlateDark': '#2c2e33',
    'chimney': '#3b302c', 'chimneyDark': '#2f2622',
    'turretRoof': '#303943', 'turretRoofDark': '#262d35',                  # L4 corner turrets
    # castle (build_civic.py stone + slate)
    'stone': '#b0a794', 'stoneDark': '#958c7a', 'stoneTop': '#cdc3ad',
    'roofSlate': '#535a66', 'roofSlateDark': '#454b56',
    # pier (build_waterside.py)
    'plank': '#9b7044', 'plankDark': '#7d5a36', 'pile': '#4a3322',
    # ship (build_ships.py)
    'oak': '#8f6439', 'oakDark': '#5f3f22', 'deck': '#b18c60', 'mast': '#9a7448', 'pole': '#5f4630',
    # owner colour (replace at runtime)
    'team': '#b0332a', 'teamDark': '#86241f',
}
KEYS = list(COLORS.keys())
COLL_NAME = 'CONQUER_RegionTokens'


# ------------------------------------------------------------------ primitives (token units)
def rot(x, y, a, cx=0.0, cy=0.0):
    c, s = math.cos(a), math.sin(a)
    return (cx + x * c - y * s, cy + x * s + y * c)


def ngon(cx, cy, r, n, a0=0.0):
    return [(cx + r * math.cos(a0 + 2 * math.pi * k / n), cy + r * math.sin(a0 + 2 * math.pi * k / n)) for k in range(n)]


def prism(p, ring, z0, z1, key, top=None, dark=None):
    """Vertical prism over a CCW ring: sides (+ optional flat top). No bottom.
    dark: the side faces whose outward normal points to -X or -Y get this key."""
    n = len(ring)
    for k in range(n):
        (x0, y0), (x1, y1) = ring[k], ring[(k + 1) % n]
        nx, ny = y1 - y0, -(x1 - x0)
        kk = dark if dark and (nx + ny) < 0 else key
        p.quads([(x0, y0, z0), (x1, y1, z0), (x1, y1, z1), (x0, y0, z1)], [(0, 1, 2, 3)], kk)
    if top:
        p.quads([(x, y, z1) for x, y in ring], [tuple(range(n))], top)


def cone(p, ring, z0, apex, key, dark=None):
    """Pyramid/cone roof over a ring (open base)."""
    n = len(ring)
    for k in range(n):
        (x0, y0), (x1, y1) = ring[k], ring[(k + 1) % n]
        nx, ny = y1 - y0, -(x1 - x0)
        kk = dark if dark and (nx + ny) < 0 else key
        p.quads([(x0, y0, z0), (x1, y1, z0), apex], [(0, 1, 2)], kk)


def shade(key, n):
    """Pre-shaded variant for faces whose outward normal points to -X/-Y."""
    return key + 'Dark' if (n[0] + n[1]) < 0 and key + 'Dark' in COLORS else key


def house(p, cx, cy, w, d, a, h, wall, roof, ground=None, hg=0.0, jetty=0.0, pitch=60, chimney=False):
    """Gabled house, ridge along local X (length w), span d, eaves at h.
    One band (L1 cottage): 4 walls with pentagonal gables + 2 roof planes = 14 tris.
    ground (L2-L4): a stone ground floor up to hg under the upper band (+8 tris); jetty pushes the
    upper band out on every side, like the game's jettied timber floor. chimney: +10 tris."""
    P = lambda x, y, z: (*rot(x, y, a, cx, cy), z)
    def band(hw, hd, z0, z1, key, rise=None):
        ring = [(-hw, -hd), (hw, -hd), (hw, hd), (-hw, hd)]
        for k in range(4):
            (x0, y0), (x1, y1) = ring[k], ring[(k + 1) % 4]
            n = rot(y1 - y0, -(x1 - x0), a)
            pts = [P(x0, y0, z0), P(x1, y1, z0), P(x1, y1, z1)]
            if rise and k in (1, 3):                      # gable ends: pentagon up to the ridge
                pts.append(P(x0, 0, z1 + rise))
            pts.append(P(x0, y0, z1))
            p.quads(pts, [tuple(range(len(pts)))], shade(key, n))
    hw, hd = w / 2, d / 2
    if ground:
        band(hw, hd, 0, hg, ground)
    uw, ud = hw + jetty, hd + jetty
    rise = math.tan(math.radians(pitch)) * ud * .62
    band(uw, ud, hg if ground else 0, h, wall, rise)
    # roof planes with eaves overhang
    ox, oy = w * .08, d * .14
    dz = rise * oy / ud
    for sy in (-1, 1):
        n = rot(0, sy, a)
        p.quads([P(-uw - ox, sy * (ud + oy), h - dz), P(uw + ox, sy * (ud + oy), h - dz),
                 P(uw + ox, 0, h + rise), P(-uw - ox, 0, h + rise)], [(0, 1, 2, 3)], shade(roof, n))
    if chimney:                                           # stack through the roof near one gable
        r = .035
        x = uw * .62
        ring = [P(x + sx, sy, 0)[:2] for sx, sy in ((-r, -r), (r, -r), (r, r), (-r, r))]
        prism(p, ring, h, h + rise + .08, 'chimney', top='chimneyDark', dark='chimneyDark')
    return P


def turret(p, P, x, y, r, z1, roof_h):
    """L4 corner turret: hexagonal plaster shaft from the ground + conical slate roof = 18 tris."""
    cx, cy, _ = P(x, y, 0)
    prism(p, ngon(cx, cy, r, 6, math.pi / 6), 0, z1, 'plaster', dark='plasterDark')
    cone(p, ngon(cx, cy, r * 1.25, 6, math.pi / 6), z1, (cx, cy, z1 + roof_h), 'turretRoof', dark='turretRoofDark')


def pole(p, x, y, z0, z1, r, key):
    """Three-sided pole, no caps: 6 tris."""
    prism(p, ngon(x, y, r, 3, math.pi / 2), z0, z1, key)


def flag(p, x, y, z, w, hgt, key='team'):
    """Single-plane pennant flying along +X from a pole top: 1 tri."""
    p.quads([(x, y, z), (x, y, z - hgt), (x + w, y, z - hgt * .55)], [(0, 1, 2)], key)


# ------------------------------------------------------------------ tokens
# Village evolution, following the game's house levels (settlement-house3d.js):
#   L1 low daub cottages with thatch, scattered;
#   L2 stone ground floor + plaster upper floor under dark slate (one cottage left);
#   L3 taller, jettied upper floors, chimneys, closer together;
#   L4 a tight block of tall townhouses round a square, chimneys and corner turrets.
def cottage(p, cx, cy, w, d, a, h=.20):
    return house(p, cx, cy, w, d, a, h, 'daub', 'roofThatch')


def townhouse(p, cx, cy, w, d, a, h, hg, jetty=0.0, chimney=False):
    return house(p, cx, cy, w, d, a, h, 'plaster', 'houseSlate', ground='houseStone', hg=hg, jetty=jetty, chimney=chimney)


def village1(p):
    """Four thatched cottages: 56 tris."""
    for cx, cy, w, d, a in ((-.50, .30, .46, .30, .35), (.32, .48, .42, .28, -.30),
                            (.52, -.22, .46, .30, 1.25), (-.12, -.50, .40, .28, -.20)):
        cottage(p, cx, cy, w, d, a)


def village2(p):
    """Four stone-and-plaster houses under slate and one surviving cottage: 102 tris."""
    for cx, cy, w, d, a in ((-.52, .36, .48, .32, .30), (.30, .54, .46, .30, -.25),
                            (.60, -.12, .48, .32, 1.30), (.04, -.58, .44, .30, -.15)):
        townhouse(p, cx, cy, w, d, a, h=.30, hg=.13)
    cottage(p, -.52, -.30, .40, .28, .90)


def village3(p):
    """Five taller jettied houses, two chimneys: 130 tris."""
    for i, (cx, cy, w, d, a) in enumerate(((-.48, .36, .54, .34, .15), (.28, .52, .52, .34, -.10),
                                           (.60, -.14, .54, .34, 1.45), (.02, -.58, .52, .34, .05),
                                           (-.56, -.30, .44, .30, 1.20))):
        townhouse(p, cx, cy, w, d, a, h=.40, hg=.16, jetty=.025, chimney=i in (0, 3))


def village4(p):
    """Six tall townhouses closing a square, two chimneys, two corner turrets: 188 tris."""
    q = math.pi / 2
    rows = ((-.50, .42, .56, .34, 0.0), (.22, .58, .56, .34, 0.0), (.66, -.02, .56, .34, q),
            (.22, -.60, .56, .34, 0.0), (-.50, -.58, .56, .34, 0.0), (-.74, -.08, .46, .30, q))
    for i, (cx, cy, w, d, a) in enumerate(rows):
        P = townhouse(p, cx, cy, w, d, a, h=.52, hg=.18, jetty=.03, chimney=i in (1, 4))
        if i in (0, 3):                                    # turret on the outer corner, toward the viewer
            turret(p, P, -w / 2 if i == 0 else w / 2, d / 2 if i == 0 else -d / 2, .11, .64, .28)


def castle(p):
    """Square curtain, four squat square towers with slate pyramids, a tall keep and a flag."""
    half, th, wall_h = .62, .10, .38
    t_r, t_h = .17, .58
    # curtain walls between the towers: outer + inner face + walk top; ends buried in towers
    for k in range(4):
        a = k * math.pi / 2
        q = lambda x, y, z: (*rot(x, y, a), z)
        x_o, x_i = half + th / 2, half - th / 2
        y0, y1 = -half + t_r * .7, half - t_r * .7
        key = 'stoneDark' if k in (2, 3) else 'stone'
        p.quads([q(x_o, y0, 0), q(x_o, y1, 0), q(x_o, y1, wall_h), q(x_o, y0, wall_h)], [(0, 1, 2, 3)], key)
        p.quads([q(x_i, y1, 0), q(x_i, y0, 0), q(x_i, y0, wall_h), q(x_i, y1, wall_h)], [(0, 1, 2, 3)], 'stoneDark' if key == 'stone' else 'stone')
        p.quads([q(x_i, y0, wall_h), q(x_i, y1, wall_h), q(x_o, y1, wall_h), q(x_o, y0, wall_h)], [(0, 1, 2, 3)], 'stoneTop')
    # corner towers: 4 sides + pyramid = 12 tris each
    for sx in (-1, 1):
        for sy in (-1, 1):
            cx, cy = sx * half, sy * half
            ring = [(cx - t_r, cy - t_r), (cx + t_r, cy - t_r), (cx + t_r, cy + t_r), (cx - t_r, cy + t_r)]
            prism(p, ring, 0, t_h, 'stone', dark='stoneDark')
            eave = [(cx - t_r * 1.18, cy - t_r * 1.18), (cx + t_r * 1.18, cy - t_r * 1.18),
                    (cx + t_r * 1.18, cy + t_r * 1.18), (cx - t_r * 1.18, cy + t_r * 1.18)]
            cone(p, eave, t_h, (cx, cy, t_h + .30), 'roofSlate', dark='roofSlateDark')
    # keep: tall square block, flat top (walk) + slate pyramid inset is too many: use a pyramid
    k_r, k_h = .24, .86
    ring = [(-k_r - .04, -k_r), (k_r - .04, -k_r), (k_r - .04, k_r), (-k_r - .04, k_r)]
    prism(p, ring, 0, k_h, 'stone', dark='stoneDark')
    eave = [(x * 1.12 - .004, y * 1.12) for x, y in ring]
    cone(p, eave, k_h, (-.04, 0, k_h + .34), 'roofSlate', dark='roofSlateDark')
    pole(p, -.04, 0, k_h + .30, k_h + .62, .014, 'pole')
    flag(p, -.04, 0, k_h + .62, .24, .14)


def pier(p):
    """Straight plank jetty with a T-head on six piles; deck top at z=.10 above the waterline."""
    z = .10
    # deck: x from -0.9 (shore) to 0.55, width .26; T-head across the seaward end
    prism(p, [(-.95, -.13), (.55, -.13), (.55, .13), (-.95, .13)], 0.06, z, 'plankDark', top='plank')
    prism(p, [(.55, -.40), (.80, -.40), (.80, .40), (.55, .40)], 0.06, z, 'plankDark', top='plank')
    # piles poking out of the water beside the deck: 3-sided, 6 tris
    for x, y in ((-.55, -.16), (-.55, .16), (.05, -.16), (.05, .16), (.83, -.36), (.83, .36)):
        pole(p, x, y, -.05, z + .07, .035, 'pile')


def ship(p):
    """Cog: pointed bow, flat transom, sheer rising fore and aft, aft castle, one mast with a
    bellied square sail in the owner's colour. Waterline at z=0 (hull bottom omitted)."""
    L, B = 1.7, .52
    xs, xm, xb = -L / 2, 0.0, L / 2
    # deck outline (CCW from above): stern stb, mid stb, bow, mid port, stern port
    top = [(xs, -B * .36, .30), (xm + .10, -B / 2, .24), (xb, 0, .36), (xm + .10, B / 2, .24), (xs, B * .36, .30)]
    bot = [(xs + .08, -B * .22, 0), (xm + .10, -B * .32, 0), (xb - .22, 0, 0), (xm + .10, B * .32, 0), (xs + .08, B * .22, 0)]
    # sides: starboard aft/fore (face -Y, pre-shaded), port fore/aft, transom
    for k, key in enumerate(('oakDark', 'oakDark', 'oak', 'oak', 'oakDark')):
        j = (k + 1) % 5
        p.quads([bot[k], bot[j], top[j], top[k]], [(0, 1, 2, 3)], key)
    p.quads(top, [(0, 1, 2, 3, 4)], 'deck')
    # aft castle: box over the stern, back flush with the transom
    prism(p, [(xs + .02, -B * .34), (xs + .40, -B * .40), (xs + .40, B * .40), (xs + .02, B * .34)], .22, .48, 'oak', top='deck', dark='oakDark')
    # mast and sail
    mx = .12
    pole(p, mx, 0, .24, 1.45, .03, 'mast')
    # yard braced ~28 degrees so the sail never reads edge-on from the side
    sw, s0, s1, belly, brace = .46, .55, 1.30, .10, math.radians(28)
    S = lambda x, y, z: (*rot(x, y, brace, mx, 0), z)
    sail = [S(.04, -sw, s0), S(.04 + belly, 0, s0 + .02), S(.04, sw, s0),
            S(.04, sw, s1), S(.04 + belly * .8, 0, s1 + .03), S(.04, -sw, s1)]
    p.quads(sail, [(0, 1, 4, 5)], 'team')
    p.quads(sail, [(1, 2, 3, 4)], 'teamDark')


# Troops are not modelled here: the regional map reuses the game's own soldier figures, baked by
# tools/bake-region-troops.mjs into src/assets/regional/troop-*.png + region-troop-sprites.js.
TOKENS = (
    ('village1', village1, 'Villaggio L1: casupole di terra e paglia'),
    ('village2', village2, 'Villaggio L2: case in pietra e intonaco, tetti in ardesia'),
    ('village3', village3, 'Villaggio L3: case alte a sbalzo con camini'),
    ('village4', village4, 'Villaggio L4: isolato di case alte con torrette'),
    ('castle', castle, 'Castello: cortina, quattro torri, mastio con bandiera'),
    ('pier', pier, 'Molo: pontile a T su pali'),
    ('ship', ship, 'Nave: cocca con vela quadra'),
)


def build(root):
    parts = {}
    for i, (name, fn, _) in enumerate(TOKENS):
        row, col = (0, i) if i < 4 else (1, i - 4 + .5)   # villages L1-L4 in front, the rest behind
        p = Part(root, name, COLORS, (col * 2.6, row * 2.8, 0), prefix='rt_')
        fn(p)
        parts[name] = p.finish()
    return parts


def export(part, digits=3):
    """Shared-vertex triangle list: p = xyz, i = 3 indices per tri, c = palette index per tri."""
    me = part.object.data
    me.calc_loop_triangles()
    pos, idx, col, seen = [], [], [], {}
    lo, hi = [1e9] * 3, [-1e9] * 3
    for tri in me.loop_triangles:
        for vi in tri.vertices:
            co = me.vertices[vi].co
            k = tuple(round(v, digits) + 0.0 for v in co)
            if k not in seen:
                seen[k] = len(seen)
                pos += list(k)
                lo = [min(a, b) for a, b in zip(lo, k)]; hi = [max(a, b) for a, b in zip(hi, k)]
            idx.append(seen[k])
        col.append(KEYS.index(me.materials[tri.material_index]['cq_key']))
    radius = max(math.hypot(pos[i], pos[i + 1]) for i in range(0, len(pos), 3))
    return {'tris': len(col), 'radius': round(radius, 3), 'height': round(hi[2], 3),
            'bounds': [lo, hi], 'p': pos, 'i': idx, 'c': col}


def render(parts, out_dir):
    """Workbench preview sheet (flat colours + wireframe) from the regional map's iso angle."""
    import bpy
    from mathutils import Vector
    sc = bpy.context.scene
    keep = {o.object.name for o in parts.values()}
    for ob in list(sc.objects):          # factory-startup cube, light, camera
        if ob.name not in keep:
            bpy.data.objects.remove(ob, do_unlink=True)
    try:
        sc.render.engine = 'BLENDER_WORKBENCH'
    except TypeError:
        pass
    sh = sc.display.shading
    sh.light = 'FLAT'; sh.color_type = 'MATERIAL'   # like region3d: palette only, no lighting
    sh.show_shadows = False; sh.show_cavity = False
    sh.show_object_outline = True; sh.object_outline_color = (0.1, 0.08, 0.06)
    sc.render.film_transparent = False
    world = sc.world or bpy.data.worlds.new('w'); sc.world = world
    world.color = (0.36, 0.42, 0.30)
    # ground plane in the regional plain colour
    bpy.ops.mesh.primitive_plane_add(size=40, location=(3.9, 1.4, -0.002))
    g = bpy.context.active_object
    gm = bpy.data.materials.new('rt_ground'); gm.diffuse_color = (0.30, 0.38, 0.20, 1); g.data.materials.append(gm)
    cam_data = bpy.data.cameras.new('rt_cam'); cam_data.type = 'ORTHO'; cam_data.ortho_scale = 11.2
    cam = bpy.data.objects.new('rt_cam', cam_data); sc.collection.objects.link(cam); sc.camera = cam
    target = Vector((3.9, 1.4, .35))
    d = Vector((0.0, -1.0, 1.1)).normalized()    # region3d-like fixed iso pitch
    cam.location = target + d * 20
    cam.rotation_euler = (target - cam.location).to_track_quat('-Z', 'Y').to_euler()
    sc.render.resolution_x, sc.render.resolution_y = 1800, 860
    os.makedirs(out_dir, exist_ok=True)
    sc.render.filepath = os.path.join(out_dir, 'region-tokens.png')
    bpy.ops.render.render(write_still=True)
    # wireframe pass: overlay edges via a wireframe modifier copy
    for part in parts.values():
        ob = part.object
        w = ob.copy(); w.data = ob.data.copy(); sc.collection.objects.link(w)
        mod = w.modifiers.new('wf', 'WIREFRAME'); mod.thickness = 0.014; mod.use_replace = True
        wm = bpy.data.materials.new('rt_wire'); wm.diffuse_color = (0.05, 0.04, 0.03, 1)
        w.data.materials.clear(); w.data.materials.append(wm)
    sc.render.filepath = os.path.join(out_dir, 'region-tokens-wire.png')
    bpy.ops.render.render(write_still=True)
    # three-quarter view from a lower angle, studio light (no wireframe)
    for ob in list(sc.objects):
        if ob.modifiers.get('wf'):
            bpy.data.objects.remove(ob, do_unlink=True)
    sh.light = 'STUDIO'
    d = Vector((0.3, -1.0, 0.5)).normalized()
    cam_data.ortho_scale = 12
    cam.location = target + d * 20
    cam.rotation_euler = (target - cam.location).to_track_quat('-Z', 'Y').to_euler()
    sc.render.filepath = os.path.join(out_dir, 'region-tokens-low.png')
    bpy.ops.render.render(write_still=True)


def main(out_path, render_dir=None):
    root = fresh_collection(COLL_NAME)
    parts = build(root)
    data = {'palette': list(COLORS.values()), 'paletteKeys': KEYS, 'units': 'token', 'models': {}}
    for name, _, label in TOKENS:
        data['models'][name] = {'label': label, **export(parts[name])}
    if out_path:
        js = ("// Generated by tools/blender/build_region_tokens.py - do not edit by hand.\n"
              "// Regional-map tokens (village, castle, pier, ship, troops) in token units: origin on the\n"
              "// ground/waterline, +X forward, +Z up, footprint radius ~1. p = vertex xyz, i = 3 indices\n"
              "// per triangle, c = palette index per triangle; 'team'/'teamDark' = owner colour.\n"
              "// Flags and sails are single planes: draw without back-face culling.\n"
              "window.ConquerRegionTokenModels = " + json.dumps(data, separators=(',', ':')) + ";\n")
        with open(out_path, 'w', encoding='utf-8', newline='\n') as f:
            f.write(js)
    for name in data['models']:
        m = data['models'][name]
        print('[region-tokens] %-8s %3d tris  r=%.2f  h=%.2f' % (name, m['tris'], m['radius'], m['height']))
    if render_dir:
        render(parts, render_dir)
    return data


if __name__ == '__main__' and '--' in sys.argv:
    args = sys.argv[sys.argv.index('--') + 1:]
    out = args[args.index('--out') + 1] if '--out' in args else None
    rdir = args[args.index('--render') + 1] if '--render' in args else None
    main(out, rdir)
