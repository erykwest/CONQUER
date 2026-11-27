"""Vehicles (cart, wagon, coach) in 3D for the 8-view module, rendered as part-ID images.

  blender -b -P tools/blender/wagon_views.py -- <parts dir> <out dir> [views]

<parts dir>: extract_mounted_parts.mjs <dir> wagon '{"vehicle":"wagon"}' + mounted_parts_poly.py. It holds
the vehicle card as settlement-vehicles.js paints it (team, seated driver or walking carter) and the
vehicle's own numbers from settlement-wagons.js (chassis, cargo sizes, colours, DEPTH, scale, team
layout, cargo slots for 1..6 items).

- The team and the driver are the approved 2D art built part by part (as mounted_views.py): every
  shape a rounded solid at its depth; one rig per horse (hip, knee, bob and tilt, head, tail), walking
  with the 2D gait. The far horse of the 2D art is drawn shifted by DEPTH x 1.6: it is moved back and
  set beside the near one.
- The vehicle is built from the same numbers the 2D painter uses: side and end boards with planks
  and posts, floor, seat and post, pole, wheels (tyre, felloe, spokes that turn with the stride,
  hub), the carriage's perch, cabin, roof, trim, windows, door and crest. The 2D art fakes depth by
  shifting the far side by DEPTH; here the far side is at its real depth (vehicle width).
- Cargo: one layer per slot and kind for every load size (cargo:<n>:<i>:<kind>), rendered at rest
  with the vehicle in place, so only the visible part of each item is traced.

Views: SE S SW NW N NE (the profile E/W is the 2D art). Poses: idle and the walk p0..p7 (wheel
spin and bed bob as the card's gait bucket). Output: <out>/<view>_<pose>__<layer>.png and ids.json
with a fill and outline per ID.
"""
import bpy
import bmesh
import json
import math
import os
import sys
from mathutils import Vector

args = sys.argv[sys.argv.index("--") + 1:]
parts_dir, outdir = args[0], args[1]
VIEWS = args[2].split(",") if len(args) > 2 else ["SE", "S", "SW", "NW", "N", "NE"]
os.makedirs(outdir, exist_ok=True)
data = json.load(open(os.path.join(parts_dir, "parts.json"), encoding="utf-8"))
polys = json.load(open(os.path.join(parts_dir, "parts_poly.json"), encoding="utf-8"))
WG, frame, coat = data["wagons"], data["frame"], data["colors"]["coat"]
CX, CY = frame["center"]["x"], frame["center"]["y"]
M = 0.0105                       # metres per horse art unit (as mounted_views.py)
K = WG["K"]                      # wagon art unit = K horse art units
CH = WG["CHASSIS"][WG["chassis"]]
COL = WG["COLORS"]
D = WG["DEPTH"]
WIDTH = {"cart": 1.1, "wagon": 1.3, "carriage": 1.4}[WG["chassis"]]   # bed width, metres
LINE = COL["line"]

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene


def art(x, y):
    return x * M, -y * M


def wx(v):     # wagon art x -> metres
    return v * K * M


def wz(y):     # wagon art y (down) -> metres up
    return -y * K * M


def empty(name, x, y, z, parent=None):
    e = bpy.data.objects.new(name, None)
    scene.collection.objects.link(e)
    e.location = (x, y, z)
    if parent is not None:
        bpy.context.view_layer.update()   # the parent's matrix_world must be current (a fresh one is identity)
        e.parent = parent
        e.matrix_parent_inverse = parent.matrix_world.inverted()
    return e


def seg_dist(px, pz, loops):
    best = 1e9
    for loop in loops:
        n = len(loop)
        for i in range(n):
            ax, az = loop[i]
            bx, bz = loop[(i + 1) % n]
            dx, dz = bx - ax, bz - az
            L = dx * dx + dz * dz
            t = 0.0 if L < 1e-12 else max(0.0, min(1.0, ((px - ax) * dx + (pz - az) * dz) / L))
            best = min(best, math.hypot(px - ax - t * dx, pz - az - t * dz))
    return best


def solid(name, loops_art, y0, T, inflate, dx=0.0, dy=0.0):
    """Polygon loops (horse art units, shifted by dx,dy) -> closed prism y0 -/+ T/2, pillow if inflate."""
    loops = [[art(x + dx, y + dy) for x, y in loop] for loop in loops_art]
    bm = bmesh.new()
    for loop in loops:
        pts = []
        for x, z in loop:
            if not pts or abs(pts[-1][0] - x) > 1e-6 or abs(pts[-1][1] - z) > 1e-6:
                pts.append((x, z))
        if len(pts) > 1 and abs(pts[0][0] - pts[-1][0]) < 1e-6 and abs(pts[0][1] - pts[-1][1]) < 1e-6:
            pts.pop()
        if len(pts) < 3:
            continue
        near = [bm.verts.new((x, y0 - T / 2, z)) for x, z in pts]
        far = [bm.verts.new((x, y0 + T / 2, z)) for x, z in pts]
        try:
            bm.faces.new(list(reversed(near)))
            bm.faces.new(far)
            for i in range(len(pts)):
                j = (i + 1) % len(pts)
                bm.faces.new((near[i], near[j], far[j], far[i]))
        except ValueError:
            continue
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    scene.collection.objects.link(ob)
    if inflate and me.polygons:
        mod = ob.modifiers.new("remesh", "REMESH")
        mod.mode = 'VOXEL'
        mod.voxel_size = max(0.006, min(0.014, T / 8))
        bpy.context.view_layer.objects.active = ob
        bpy.ops.object.modifier_apply(modifier=mod.name)
        for v in ob.data.vertices:
            d = seg_dist(v.co.x, v.co.z, loops)
            f = math.sqrt(max(0.0, 1.0 - (1.0 - min(1.0, d / (T / 2))) ** 2))
            v.co.y = y0 + (1.0 if v.co.y >= y0 else -1.0) * (T / 2) * f
    return ob


def inside(x, z, loops):
    c = False
    for loop in loops:
        for i in range(len(loop)):
            ax, az = loop[i]
            bx, bz = loop[i - 1]
            if (az > z) != (bz > z) and x < (bx - ax) * (z - az) / (bz - az) + ax:
                c = not c
    return c


def overlay(name, base, loops_art, grow, dx=0.0, dy=0.0):
    loops = [[art(x + dx, y + dy) for x, y in loop] for loop in loops_art]
    me = base.data.copy()
    bm = bmesh.new()
    bm.from_mesh(me)
    kill = [f for f in bm.faces if not inside(f.calc_center_median().x, f.calc_center_median().z, loops)]
    bmesh.ops.delete(bm, geom=kill, context='FACES')
    bm.normal_update()
    for v in bm.verts:
        v.co += v.normal * grow
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    scene.collection.objects.link(ob)
    ob.matrix_world = base.matrix_world.copy()
    return ob


def box(name, x0, x1, y0, y1, z0, z1):
    """Axis box in metres."""
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2))
    o = bpy.context.active_object
    o.name = name
    o.scale = (max(1e-4, abs(x1 - x0)), max(1e-4, abs(y1 - y0)), max(1e-4, abs(z1 - z0)))
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return o


def disc(name, x, y, z, r, t, verts=32):
    """Cylinder whose axis is Y (a wheel layer), centred at (x, y, z), metres."""
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=t, location=(x, y, z), rotation=(math.pi / 2, 0, 0))
    o = bpy.context.active_object
    o.name = name
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
    return o


def rod(name, a, b, r, verts=10):
    ax, ay, az = a
    bx, by, bz = b
    L = math.dist(a, b)
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=L, location=((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2))
    o = bpy.context.active_object
    o.name = name
    o.rotation_mode = 'QUATERNION'
    o.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(Vector((bx - ax, by - ay, bz - az)).normalized())
    return o


def srgb_to_lin(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


# --- registry: unique ID colour per part, with its fill and outline group ------------------------
ids, by_src = {}, {}
counter = [0]


def register(ob, src, group, fill, outline, parent=None, k=0):
    if parent is not None:
        ob.parent = parent
        ob.matrix_parent_inverse = parent.matrix_world.inverted()
    counter[0] += 1
    n = counter[0]
    while True:
        rgb = (30 + n % 200, 30 + (n // 200) % 200, 30 + (n * 37) % 200)   # unique for n < 40000
        if "%d,%d,%d" % rgb not in ids:
            break
        n += 997
    ob.color = (*(srgb_to_lin(c / 255) for c in rgb), 1.0)
    ids["%d,%d,%d" % rgb] = {"k": k, "src": src, "side": "", "group": group, "fill": fill, "outline": outline,
                             "style": fill, "tag": src, "arms": False}
    by_src.setdefault(src, []).append(ob)
    return ob


root = empty("root", 0, 0, 0)
body = empty("vehicle", 0, 0, 0, root)          # the bed and all it carries: bob
wheel_spin = []                                   # (pivot, radius in wagon units)

# --- team: one rig per horse, from the approved horse art --------------------------------------------
lay = WG["layout"]
C = {k: str(v).lower() for k, v in coat.items()}
ops = data["ops"]
animal_runs, cur = [], []
for op in ops:
    if op["tag"].startswith("animals:"):
        cur.append(op)
    elif cur:
        animal_runs.append(cur)
        cur = []
if cur:
    animal_runs.append(cur)
horses = sorted(lay["horses"], key=lambda h: 0 if h["far"] else 1)     # far first, as drawn
rigs = []
jm = ((frame["joint"]["a"]["x"] + frame["joint"]["b"]["x"]) / 2 - CX, (frame["joint"]["a"]["y"] + frame["joint"]["b"]["y"]) / 2 - CY)
for h, run in zip(horses, animal_runs):
    idx, far = h["index"], h["far"]
    # The 2D far horse is shifted by DEPTH x 1.6 (art units): move it back beside the near one.
    sx, sy = (-D["x"] * 1.6, -D["y"] * 1.6) if far else (0.0, 0.0)
    hx = h["x"] + sx
    dc = (0.36 if far else -0.36) if len(horses) == 2 else 0.0
    bp = empty(f"h{idx}body", art(hx, 0)[0], dc, art(0, 150 - CY)[1], root)
    hp = empty(f"h{idx}head", art(hx + jm[0], 0)[0], dc, art(0, jm[1])[1], bp)
    tp = empty(f"h{idx}tail", art(hx + frame["tailPivot"]["x"] - CX, 0)[0], dc, art(0, frame["tailPivot"]["y"] - CY)[1], bp)
    hips, knees = [], []
    for i, leg in enumerate(frame["legs"]):
        hip = empty(f"h{idx}hip{i}", art(hx + leg["x"] - CX, 0)[0], dc, art(0, leg["y"] - CY)[1], root)
        knee = empty(f"h{idx}knee{i}", art(hx + leg["joint"]["x"] - CX, 0)[0], dc, art(0, leg["joint"]["y"] - CY)[1], hip)
        hips.append(hip)
        knees.append(knee)
    rigs.append({"idx": idx, "hx": hx, "dc": dc, "body": bp, "head": hp, "tail": tp, "hips": hips, "knees": knees})
    marks, legn, headn = {}, 0, 0
    g, ctok = f"#h{idx}", f"coat@{idx}:"
    for op in run:
        tag, style = op["tag"], op["style"].lower()
        loops = polys.get(str(op["k"])) or []
        if not loops or style.startswith("rgba(30, 40, 20") or op["op"].startswith("stroke"):
            continue

        def mk(T, y0=0.0, infl=True):
            return solid(f"h{idx}:{op['k']}", loops, dc + y0, T, infl, sx, sy)

        if "drawLeg" in tag:
            i, piece = divmod(legn, 3)
            legn += 1
            name = ("lower", "hoof", "upper")[piece]
            y0 = -0.12 if i % 2 == 0 else 0.12
            parent = hips[i] if name == "upper" else knees[i]
            if name == "hoof":
                ob = overlay(f"h{idx}:{op['k']}", marks[f"lower{i}"], loops, 0.004, sx, sy)
                register(ob, "base", f"leg{i}{g}", ctok + "hoof", ctok + "line", parent, op["k"])
            else:
                ob = mk(0.11, y0)
                marks[f"{name}{i}"] = ob
                register(ob, "base", f"leg{i}{g}", ctok + ("leg" if i % 2 == 0 else "legFar"), ctok + "line", parent, op["k"])
        elif "drawNeck" in tag:
            mane = style == C["mane"]
            ob = mk(0.08 if mane else 0.24)
            register(ob, "base", f"neck{g}", ctok + ("mane" if mane else "head"), ctok + "line", bp, op["k"])
        elif "drawHeadArt" in tag:
            if headn == 0:
                ob = mk(0.2)
                marks["head"] = ob
                register(ob, "base", f"head{g}", ctok + "head", ctok + "line", hp, op["k"])
            elif style in (C["mane"], C["eye"], C["line"]):
                key = {C["mane"]: "mane", C["eye"]: "eye", C["line"]: "line"}[style]
                register(overlay(f"h{idx}:{op['k']}", marks["head"], loops, 0.005, sx, sy), "base", f"head{g}", ctok + key, ctok + "line", hp, op["k"])
            else:
                for side in (-1, 1):
                    register(mk(0.035, side * 0.06), "base", f"head{g}", ctok + "head", ctok + "line", hp, op["k"])
            headn += 1
        elif "fillStroke<animals:Object.drawAnimal" in tag:
            if style == C["mane"]:
                register(mk(0.1), "base", f"tail{g}", ctok + "mane", ctok + "line", tp, op["k"])
            else:
                ob = mk(0.52)
                marks["body"] = ob
                register(ob, "base", f"body{g}", ctok + "body", ctok + "line", bp, op["k"])
        elif style == C["shade"] and "body" in marks:
            register(overlay(f"h{idx}:{op['k']}", marks["body"], loops, 0.004, sx, sy), "base", f"body{g}", ctok + "shade", ctok + "line", bp, op["k"])

# --- driver or carter --------------------------------------------------------------------------------
# Not built in 3D: in every view the game draws its own 2D villager (as in the profile and as every
# person in the game), placed at the seat's projected anchor. Here only the anchors are computed
# (see ANCHORS below): the seat (feet point and the board top that hides the legs) or, for the cart,
# the carter walking at the horse's head on the near side.
carter = WG["chassis"] == "cart"

# --- the vehicle, from the 2D painter's numbers -----------------------------------------------------
HW = WIDTH / 2
bx0, bx1 = CH["bed"]


def part(ob, group, fill, parent=None):
    return register(ob, "base", "w:" + group, fill, LINE, parent or body)


for wi, w in enumerate(CH["wheels"]):
    r = w["r"]
    for side, y in (("n", -HW - 0.08), ("f", HW + 0.08)):
        cx, cz = wx(w["x"]), wz(-r)
        part(disc(f"tyre{wi}{side}", cx, y, cz, wx(r), 0.07), f"wheel{wi}{side}", COL["iron"], root)
        part(disc(f"felloe{wi}{side}", cx, y, cz, wx(r * .86), 0.08), f"wheel{wi}{side}", COL["wood"], root)
        part(disc(f"inner{wi}{side}", cx, y, cz, wx(r * .72), 0.09), f"wheel{wi}{side}", COL["woodDark"], root)
        spin = empty(f"spin{wi}{side}", cx, y, cz, root)
        wheel_spin.append((spin, r))
        for s in range(10):
            a = s * math.pi / 5
            ob = box(f"spoke{wi}{side}{s}", wx(r * .18), wx(r * .76), -0.048, 0.048, -wx(r * .045), wx(r * .045))
            ob.rotation_euler = (0, -a, 0)
            bpy.context.view_layer.objects.active = ob
            bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
            ob.location = (cx, y, cz)
            bpy.ops.object.transform_apply(location=True, rotation=False, scale=False)
            part(ob, f"wheel{wi}{side}", COL["woodLight"], spin)
        part(disc(f"hub{wi}{side}", cx, y, cz, wx(r * .2), 0.1, 16), f"wheel{wi}{side}", COL["ironLight"], spin)

if CH.get("cabin"):
    cab = CH["cabin"]
    w0, w1 = CH["wheels"][0], CH["wheels"][1]
    part(box("perch", wx(w0["x"]), wx(w1["x"] + 8), -0.15, 0.15, wz(-w0["r"] + 4), wz(-w0["r"] - 6)), "perch", COL["lacquerDark"])
    x0, x1, bot, top = cab["x0"], cab["x1"], cab["bottom"], cab["top"]
    part(box("cabin", wx(x0), wx(x1), -HW * .95, HW * .95, wz(bot + 10), wz(top)), "cabin", COL["lacquer"])
    part(box("roof", wx(x0 - 4), wx(x1 + 4), -HW, HW, wz(top + 2), wz(top - 8)), "cabin", COL["lacquerDark"])
    mid = (x0 + x1) / 2
    for side in (-1, 1):
        yo, t = side * HW * .95, 0.012
        y1s = sorted((yo, yo + side * t))
        y2s = sorted((yo, yo + side * 2 * t))
        part(box("trimlo", wx(x0), wx(x1), *y1s, wz(bot - 13), wz(bot - 15)), "cabin", COL["trim"])
        part(box("trimhi", wx(x0), wx(x1), *y1s, wz(top + 7), wz(top + 5)), "cabin", COL["trim"])
        for a, b in ((x0 + 8, mid - 20), (mid + 20, x1 - 8)):
            part(box("window", wx(a), wx(b), *y1s, wz(top + 50), wz(top + 16)), "cabin", COL["glass"])
        part(box("door", wx(mid - 16), wx(mid + 16), *y1s, wz(bot - 16), wz(top + 12)), "cabin", COL["lacquerDark"])
        part(box("doorwin", wx(mid - 10), wx(mid + 10), *y2s, wz(top + 48), wz(top + 18)), "cabin", COL["glass"])
        part(box("crest", wx(mid - 7), wx(mid + 7), *y2s, wz(bot - 36), wz(bot - 52)), "cabin", COL["velvet"])
    for fx in (x0, x1):
        for side in (-1, 1):
            part(box("finial", wx(fx - 4), wx(fx + 4), side * HW - 0.03, side * HW + 0.03, wz(top - 8), wz(top - 16)), "cabin", COL["trim"])
else:
    fl, tp_ = CH["floor"], CH["boardTop"]
    part(box("floor", wx(bx0), wx(bx1), -HW, HW, wz(fl) - 0.03, wz(fl) + 0.01), "floor", COL["woodDark"])
    for side in (-1, 1):
        y0, y1 = sorted((side * HW, side * (HW - 0.05)))
        bottom = fl + 8 if side < 0 else fl
        part(box("board", wx(bx0), wx(bx1), y0, y1, wz(bottom), wz(tp_)), f"board{side}", COL["wood"])
        yo0, yo1 = sorted((side * HW, side * (HW + 0.006)))
        for k in (1, 2):
            yy = tp_ + (bottom - tp_) * k / 3
            part(box("plank", wx(bx0), wx(bx1), yo0, yo1, wz(yy + .8), wz(yy - .8)), f"board{side}", COL["woodDark"])
        for px in (bx0, (bx0 + bx1) / 2, bx1):
            part(box("post", wx(px - 3), wx(px + 3), yo0, yo1, wz(bottom), wz(tp_)), f"board{side}", COL["woodDark"])
    for ex in (bx0, bx1):
        part(box("end", wx(ex) - 0.025, wx(ex) + 0.025, -HW, HW, wz(fl), wz(tp_)), f"end{ex}", COL["wood"])
seat = CH.get("seat")
if seat:
    part(box("seat", wx(seat["x"] - 18), wx(seat["x"] + 18), -HW * .8, HW * .8, wz(seat["y"]), wz(seat["y"] - 6)), "seat", COL["woodLight"])
    part(box("seatpost", wx(seat["x"] - 3), wx(seat["x"] + 3), -0.03, 0.03, wz(CH["boardTop"]), wz(seat["y"])), "seat", COL["woodDark"])
if lay["horses"]:
    near = [h for h in lay["horses"] if not h["far"]][0]
    part(rod("pole", (wx(bx1 - 6), 0.0, wz(CH["hitchY"])), (art(near["x"] + 52, 0)[0], 0.0, art(0, -112)[1]), wx(3.5)), "pole", COL["woodDark"])

# --- cargo layers ------------------------------------------------------------------------------------
CARGO = WG["CARGO"]
layers = []


def cargo_item(name, kind, item, src):
    w, h = CARGO[kind]["w"], CARGO[kind]["h"]
    depthk = .7 if item["row"] == 0 else .15
    x = item["x"] - D["x"] * depthk
    yb = item["y"] - D["y"] * depthk           # base, wagon art y (down)
    yc = HW * 0.36 * (1 if item["row"] == 0 else -1)
    front = item["row"] == 1
    obs = []
    if kind == "crate":
        obs.append((box(name, wx(x - w / 2), wx(x + w / 2), yc - wx(w) * .45, yc + wx(w) * .45, wz(yb), wz(yb - h)),
                    COL["woodLight"] if front else COL["wood"]))
    elif kind == "hay":
        obs.append((box(name, wx(x - w / 2), wx(x + w / 2), yc - wx(w) * .4, yc + wx(w) * .4, wz(yb), wz(yb - h)),
                    COL["hay"] if front else COL["hayDark"]))
        for bx in (x - w * .2, x + w * .2):
            obs.append((box(name + "band", wx(bx - 1.3), wx(bx + 1.3), yc - wx(w) * .41, yc + wx(w) * .41, wz(yb) - 0.003, wz(yb - h) + 0.003), COL["leather"]))
    elif kind == "barrel":
        bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=wx(w * .45), depth=wx(h), location=(wx(x), yc, wz(yb - h / 2)))
        o = bpy.context.active_object
        o.name = name
        obs.append((o, COL["barrel"]))
        for kk in (.22, .78):
            bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=wx(w * .46), depth=wx(2.4), location=(wx(x), yc, wz(yb - h * kk)))
            obs.append((bpy.context.active_object, COL["iron"]))
    elif kind == "logs":
        for ddx, ddy in ((-.25, 0), (.25, 0), (0, -1)):
            lx, ly, rr = x + ddx * w * .5, yb - h * .25 + ddy * h * .48, h * .27
            for dyy in (-1, 1):
                yy = yc + dyy * wx(rr) * 1.1
                obs.append((rod(name + "log", (wx(lx - w * .5), yy, wz(ly)), (wx(lx + w * .5), yy, wz(ly)), wx(rr), 14), COL["log"]))
                bpy.ops.mesh.primitive_cylinder_add(vertices=14, radius=wx(rr) * .98, depth=0.01, location=(wx(lx + w * .5) + 0.004, yy, wz(ly)), rotation=(0, math.pi / 2, 0))
                obs.append((bpy.context.active_object, COL["logEnd"]))
    elif kind in ("sack", "stone"):
        bpy.ops.mesh.primitive_uv_sphere_add(segments=20, ring_count=12, radius=1.0, location=(wx(x), yc, wz(yb - h * .45)))
        o = bpy.context.active_object
        o.name = name
        o.scale = (wx(w) * .5, wx(w) * .4, wx(h) * (.5 if kind == "sack" else .45))
        obs.append((o, (COL["sack"] if front else COL["sackDark"]) if kind == "sack" else (COL["stone"] if front else COL["stoneDark"])))
        if kind == "sack":
            obs.append((rod(name + "tie", (wx(x), yc, wz(yb - h * .86)), (wx(x), yc, wz(yb - h)), wx(w * .14), 10), COL["sackDark"]))
    for o, fill in obs:
        register(o, src, "w:cargo", fill, LINE, body)


if not CH.get("cabin"):
    max_n = 4 if WG["chassis"] == "cart" else 6
    for n in range(1, max_n + 1):
        for i, slot in enumerate(WG["slots"][str(n)]):
            for kind in CARGO:
                L = f"cargo:{n}:{i}:{kind}"
                layers.append(L)
                cargo_item(L, kind, slot, L)
print("parts built:", len(by_src.get("base", [])), "cargo layers:", len(layers), flush=True)

# --- render ------------------------------------------------------------------------------------------
RES, ORTHO, CAM_Z = 1024, 9.0, 1.5
cam_data = bpy.data.cameras.new("cam")
cam_data.type = 'ORTHO'
cam_data.ortho_scale = ORTHO
cam = bpy.data.objects.new("cam", cam_data)
scene.collection.objects.link(cam)
# The game camera looks down ~30 deg (w2sRaw: ground depth x0.5, height x0.9): render the views from
# the same elevation, so a diagonal view reads as three-quarter (top of the bed, the horses' backs).
ELEV = math.radians(30)
cam.rotation_euler = (math.radians(90) - ELEV, 0.0, 0.0)
cam.location = (0.0, -40.0 * math.cos(ELEV), CAM_Z + 40.0 * math.sin(ELEV))
scene.camera = cam
scene.render.engine = 'BLENDER_WORKBENCH'
scene.render.resolution_x = scene.render.resolution_y = RES
scene.render.film_transparent = True
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGBA'
scene.display.render_aa = 'OFF'
scene.render.dither_intensity = 0.0
scene.view_settings.view_transform = 'Standard'
scene.view_settings.look = 'None'
sh = scene.display.shading
sh.light = 'FLAT'
sh.color_type = 'OBJECT'
sh.show_object_outline = False
sh.show_cavity = False
sh.show_shadows = False
sh.show_specular_highlight = False
ANGLES = {"E": 0, "SE": -45, "S": -90, "SW": -135, "W": 180, "NW": 135, "N": 90, "NE": 45}
poses = data["poses"]


def set_pose(name):
    p = poses[name]
    phase = None if name == "idle" else int(name[1:])
    dist = 0.0 if phase is None else phase / 8 * 40          # the card's gait bucket -> distance (wagon units)
    bob = 0.0 if phase is None else math.sin(dist * .18) * 1.2
    body.location.z = -bob * K * M
    for spin, r in wheel_spin:
        spin.rotation_euler = (0.0, dist / r, 0.0)
    for rig in rigs:
        hx, dc = rig["hx"], rig["dc"]
        rig["body"].location.z = art(0, 150 - CY)[1] - p["bob"] * M
        rig["body"].rotation_euler = (0.0, p["tilt"], 0.0)
        rig["head"].location = (art(hx + jm[0] + p["headX"], 0)[0], dc, art(0, jm[1])[1] - p["headY"] * M)
        rig["head"].rotation_euler = (0.0, p["headRot"], 0.0)
        rig["tail"].rotation_euler = (0.0, p["tail"], 0.0)
        for i, leg in enumerate(frame["legs"]):
            rig["hips"][i].location = (art(hx + leg["x"] - CX, 0)[0], dc, art(0, leg["y"] - CY)[1] + p["lift"][i] * M)
            rig["hips"][i].rotation_euler = (0.0, p["legs"][i], 0.0)
            rig["knees"][i].rotation_euler = (0.0, p["bend"][i], 0.0)
    bpy.context.view_layer.update()


def show(srcs):
    for name, objs in by_src.items():
        for o in objs:
            o.hide_render = name not in srcs


# Anchors of the 2D driver per view, in art units as the tracer writes regions (x right, y down from
# the ground under the bed's middle, heights restored by /cos(elev)), and whether he stands behind the
# vehicle's middle (then the renderer draws him before the vehicle, so boards, load and team hide him).
def project(pt, yaw):
    x, y, z = pt
    xr, yr = x * math.cos(yaw) - y * math.sin(yaw), x * math.sin(yaw) + y * math.cos(yaw)
    u = xr
    v = yr * math.sin(ELEV) + (z - CAM_Z) * math.cos(ELEV)        # screen-up through the target
    depth = yr * math.cos(ELEV) - (z - CAM_Z) * math.sin(ELEV)    # away from the camera
    ce = math.cos(ELEV)
    return [round(u / M, 1), round(-(v + CAM_Z * ce) / ce / M, 1)], depth


def view_anchors(yaw):
    if carter:
        ahead = 0.75 * 12 / (5.75 * 1.9 / 256) * M          # .75 U ahead of the bed middle, metres
        at, depth = project((ahead, -0.55, 0.0), yaw)
        _, mid = project((ahead * .5, 0.0, 0.6), yaw)
        return {"kind": "carter", "at": at, "behind": depth > mid}
    if not seat:
        return None
    at, depth = project((wx(seat["x"]), 0.0, wz(seat["driverY"])), yaw)
    clip, _ = project((wx(seat["x"]), 0.0, wz(CH["boardTop"] if not CH.get("cabin") else seat["y"])), yaw)
    _, mid = project((0.0, 0.0, wz(CH["boardTop"])), yaw)
    return {"kind": "seat", "at": at, "clip": clip[1], "behind": depth > mid}


anchors = {}
POSES = ["idle"] + [f"p{i}" for i in range(8)]
renders = 0
for view in VIEWS:
    root.rotation_euler = (0.0, 0.0, math.radians(ANGLES[view]))
    for pose in POSES:
        set_pose(pose)
        show({"base"})
        scene.render.filepath = os.path.join(outdir, f"{view}_{pose}__base.png")
        bpy.ops.render.render(write_still=True)
        renders += 1
    set_pose("idle")
    for L in layers:
        show({"base", L})
        scene.render.filepath = os.path.join(outdir, f"{view}_idle__{L.replace(':', '-')}.png")
        bpy.ops.render.render(write_still=True)
        renders += 1
    anchors[view] = view_anchors(math.radians(ANGLES[view]))
    print("rendered", view, renders, flush=True)

json.dump({"ids": ids, "res": RES, "ortho": ORTHO, "camZ": CAM_Z, "elev": math.degrees(ELEV), "M": M, "anchors": anchors, "layers": layers, "layerPoses": ["idle"],
           "sets": [{"name": "rest", "poses": POSES}], "views": VIEWS, "colors": data["colors"]},
          open(os.path.join(outdir, "ids.json"), "w"))
print("done:", outdir, renders, "renders")
