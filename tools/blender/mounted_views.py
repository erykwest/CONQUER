"""Mounted figure in 3D, built from the approved 2D art, rendered as part-ID images for 8 views.

  blender -b -P tools/blender/mounted_views.py -- <config.json> <out dir>

config.json:
  {"base": "<parts dir>",                    # the whole figure at rest (extract_mounted_parts.mjs)
   "exclude": ["head", "shield", "crest"],   # op classes drawn as layers instead of in the base
   "views": ["SE", "S", "SW", "NW", "N", "NE"],
   "sets": [{"name": "rest", "poses": ["idle", "p0", ...]},
            {"name": "charge", "poses": ["r0", ...], "swap": {"lance": "<parts dir with charge:true>"}}],
   "layers": [{"name": "helmet:greathelm", "dir": "<parts dir>", "class": "head"}, ...]}

Parts dirs come from extract_mounted_parts.mjs + mounted_parts_poly.py: every coloured shape of
the 2D figure (side view, at rest) as polygons in art units, with the function that drew it.
Each shape becomes a solid of its own depth and thickness (near/far legs, barrel, neck, head, rider,
gear), rounded like a pillow so it reads as a volume from the front; one-sided shapes (rider's leg,
arm, hand...) are mirrored to the far side; shapes painted over another one in 2D (blanket, shade,
tunic half, hoof, bridle, arms...) are skin patches of that solid. Seen from the side the model is
the 2D art itself. The gait is the 2D gait (ConquerAnimals.transitionPose, parts.json poses).

Each part is rendered flat in a unique ID colour (Workbench, no anti-aliasing, no dither, Standard
view transform). Images: <out>/<view>_<pose>__<layer>.png, layer "base" or a layer name (":"
becomes "-"); a layer image shows the base too, so that the layer's visible regions are exact.
<out>/ids.json maps ID colours to parts. The camera looks along +Y; the horse faces +X.
"""
import bpy
import bmesh
import json
import math
import os
import sys

args = sys.argv[sys.argv.index("--") + 1:]
config = json.load(open(args[0], encoding="utf-8"))
outdir = args[1]
os.makedirs(outdir, exist_ok=True)


def load(d):
    return (json.load(open(os.path.join(d, "parts.json"), encoding="utf-8")),
            json.load(open(os.path.join(d, "parts_poly.json"), encoding="utf-8")))


base_data, base_polys = load(config["base"])
frame, coat = base_data["frame"], base_data["colors"]["coat"]
CX, CY = frame["center"]["x"], frame["center"]["y"]
M = 0.0105  # metres per art unit: withers ~1.7 m, barrel ~1.6 m long

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene


def art(x, y):
    """Art point relative to the ground centre (y down) -> (X, Z) metres."""
    return x * M, -y * M


def empty(name, x, z, parent=None):
    e = bpy.data.objects.new(name, None)
    scene.collection.objects.link(e)
    e.location = (x, 0.0, z)
    if parent is not None:
        bpy.context.view_layer.update()   # the parent's matrix_world must be current (a fresh one is identity)
        e.parent = parent
        e.matrix_parent_inverse = parent.matrix_world.inverted()
    return e


root = empty("root", 0.0, 0.0)
body_pivot = empty("body", *art(0, 150 - CY), root)          # tilt about (center.x, 150), as drawAnimal
jmid = ((frame["joint"]["a"]["x"] + frame["joint"]["b"]["x"]) / 2 - CX, (frame["joint"]["a"]["y"] + frame["joint"]["b"]["y"]) / 2 - CY)
head_pivot = empty("head", *art(*jmid), body_pivot)
tail_pivot = empty("tail", *art(frame["tailPivot"]["x"] - CX, frame["tailPivot"]["y"] - CY), body_pivot)
hips, knees = [], []
for i, leg in enumerate(frame["legs"]):
    hip = empty(f"hip{i}", *art(leg["x"] - CX, leg["y"] - CY), root)
    knee = empty(f"knee{i}", *art(leg["joint"]["x"] - CX, leg["joint"]["y"] - CY), hip)
    hips.append(hip)
    knees.append(knee)


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
            d = math.hypot(px - ax - t * dx, pz - az - t * dz)
            if d < best:
                best = d
    return best


def solid(name, loops_art, y0, T, inflate):
    """Polygon loops (art units) -> closed prism between y0 -/+ T/2, rounded like a pillow if inflate."""
    loops = [[art(x, y) for x, y in loop] for loop in loops_art]
    bm = bmesh.new()
    for loop in loops:
        pts = []
        for x, z in loop:
            if not pts or (abs(pts[-1][0] - x) > 1e-6 or abs(pts[-1][1] - z) > 1e-6):
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
            n = len(pts)
            for i in range(n):
                j = (i + 1) % n
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
        R = T / 2
        for v in ob.data.vertices:
            d = seg_dist(v.co.x, v.co.z, loops)
            f = math.sqrt(max(0.0, 1.0 - (1.0 - min(1.0, d / R)) ** 2))
            side = 1.0 if v.co.y >= y0 else -1.0
            v.co.y = y0 + side * (T / 2) * f
    return ob


def inside(x, z, loops):
    """Even-odd point-in-polygon over all loops (X, Z metres)."""
    c = False
    for loop in loops:
        for i in range(len(loop)):
            ax, az = loop[i]
            bx, bz = loop[i - 1]
            if (az > z) != (bz > z) and x < (bx - ax) * (z - az) / (bz - az) + ax:
                c = not c
    return c


def overlay(name, base, loops_art, grow):
    """The base surface inside the part's outline (seen from the side), pushed out by grow along the
    normals: a skin painted on the base solid, as the 2D part is painted over the base shape."""
    loops = [[art(x, y) for x, y in loop] for loop in loops_art]
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


def op_class(tag):
    """Which layer an op belongs to: crest, head (helmet, face, mantling), shield, lance, or base."""
    if "drawHeraldicCrest" in tag:
        return "crest"
    if "drawHeraldicMantling" in tag or ("mounted2d:head" in tag and "headSpace" not in tag):
        return "head"
    if "mounted2d:shield" in tag:
        return "shield"
    if "mounted2d:lance" in tag:
        return "lance"
    return "base"


# --- part table: op -> solids ---------------------------------------------------------------------
# A part: (op, side, y0, T, inflate, parent, group, skin_of, grow). Near side = -Y (toward the camera
# of the profile view). skin_of names a part marked earlier (in this source, else in the base).
C = {k: str(v).lower() for k, v in coat.items()}
LIVERY = {k: str(v).lower() for k, v in base_data["colors"]["livery"].items()}
base_marks = {}


def assign(ops, marks, fallback):
    st = {"leg": 0, "head": 0, "saddle": 0, "torso": 0, "blanket": 0, "cap": 0, "crinet": 0, "pennon": 0,
          "mant": 0, "helm": 0, "crest": 0, "shield": 0, "cloak": 0}
    out = []

    def add(op, side, y0, T, inflate, parent, group, mark=None, skin=None, grow=0.0):
        out.append((op, side, y0, T, inflate, parent, group, skin, grow))
        if mark:
            marks[mark] = (side, len(out) - 1)

    def both(op, off, T, inflate, parent, group, mark=None):
        add(op, "n", -off, T, inflate, parent, group + "n", mark and mark + "n")
        add(op, "f", off, T, inflate, parent, group + "f", mark and mark + "f")

    for op in ops:
        tag, style = op["tag"], op["style"].lower()
        if style.startswith("rgba(30, 40, 20"):
            continue   # ground shadow: drawn by the view renderer
        if "drawLeg" in tag:
            i, piece = divmod(st["leg"], 3)
            st["leg"] += 1
            y0 = -0.12 if i % 2 == 0 else 0.12
            name = ("lower", "hoof", "upper")[piece]
            parent = hips[i] if name == "upper" else knees[i]
            if name == "hoof":
                add(op, "", y0, 0.11, True, parent, f"leg{i}", skin=f"lower{i}", grow=0.004)
            else:
                add(op, "", y0, 0.11, True, parent, f"leg{i}", mark=f"{name}{i}")
        elif "drawNeck" in tag:
            if style == C["mane"]:
                add(op, "", 0.0, 0.08, True, body_pivot, "neck")
            else:
                add(op, "", 0.0, 0.24, True, body_pivot, "neck", mark="neck")
        elif "drawHeadArt" in tag:
            if st["head"] == 0:
                add(op, "", 0.0, 0.2, True, head_pivot, "head", mark="head")
            elif style in (C["mane"], C["eye"], C["line"]):
                add(op, "", 0.0, 0.2, True, head_pivot, "head", skin="head", grow=0.005)
            else:   # ear: a small solid on each side, standing above the head's outline
                add(op, "n", -0.06, 0.035, True, head_pivot, "head")
                add(op, "f", 0.06, 0.035, True, head_pivot, "head")
            st["head"] += 1
        elif "fillStroke<animals:Object.drawAnimal" in tag:
            if style == C["mane"]:
                add(op, "", 0.0, 0.1, True, tail_pivot, "tail")
            else:
                add(op, "", 0.0, 0.52, True, body_pivot, "body", mark="body")
        elif "drawAnimal" in tag and "onBody" not in tag and style == C["shade"]:
            add(op, "", 0.0, 0.52, True, body_pivot, "body", skin="body", grow=0.004)
        elif "mounted2d:caparison" in tag or "arms<mounted2d:caparison" in tag:
            # The drape hangs below the barrel: its own solid, a little wider; quarters, hem and arms
            # are painted on it.
            if st["cap"] == 0:
                add(op, "", 0.0, 0.6, True, body_pivot, "caparison", mark="caparison")
            else:
                add(op, "", 0.0, 0.6, True, body_pivot, "caparison", skin="caparison", grow=0.004 + 0.003 * st["cap"])
            st["cap"] += 1
        elif "mounted2d:blanket" in tag:
            add(op, "", 0.0, 0.52, True, body_pivot, "blanket", skin="body", grow=0.008 + 0.004 * st["blanket"])
            st["blanket"] += 1
        elif "mounted2d:saddle" in tag:
            if st["saddle"] == 0:
                add(op, "", 0.0, 0.64 if "caparison" in marks or "caparison" in fallback else 0.56, True, body_pivot, "saddle")
            elif st["saddle"] in (1, 2):
                add(op, "", 0.0, 0.26, True, body_pivot, "cantle" if st["saddle"] == 1 else "pommel")
            else:
                add(op, "n", -0.3, 0.08, True, body_pivot, "saddlebag")
            st["saddle"] += 1
        elif "mounted2d:crinet" in tag and "headSpace" not in tag:
            # Neck armour in the livery, and its stripe: painted on the neck.
            add(op, "", 0.0, 0.24, True, body_pivot, "neck", skin="neck", grow=0.008 + 0.004 * st["crinet"])
            st["crinet"] += 1
        elif "headSpace<mounted2d:crinet" in tag:
            if style in (LIVERY["main"], LIVERY["alt"]):   # plume at the poll: a thin crest of its own
                add(op, "", 0.0, 0.05, True, head_pivot, "plume", mark=None if st["pennon"] else "plume",
                    skin="plume" if st["pennon"] else None, grow=0.004)
                st["pennon"] += 1
            else:                                         # chanfron and its eye hole: on the face
                add(op, "", 0.0, 0.2, True, head_pivot, "head", skin="head", grow=0.008 if style == "#16181a" else 0.005)
        elif "mounted2d:bridle" in tag:
            add(op, "", 0.0, 0.2, True, head_pivot, "head", skin="head", grow=0.005)
        elif "mounted2d:cloak" in tag:
            if st["cloak"] == 0:
                add(op, "", 0.0, 0.36, True, body_pivot, "cloak", mark="cloak")
            else:
                add(op, "", 0.0, 0.36, True, body_pivot, "cloak", skin="cloak", grow=0.004)
            st["cloak"] += 1
        elif "mounted2d:lance" in tag:
            # The lance is carried on the far side; its arm and hand too.
            if "hand" in tag:
                add(op, "", 0.19, 0.075, True, body_pivot, "lancearm")
            elif "limb" in tag and style != "#8a6a40":
                add(op, "", 0.19, 0.09, True, body_pivot, "lancearm")
            elif "limb" in tag:
                add(op, "", 0.2, 0.06, True, body_pivot, "lance")
            else:   # steel tip and pennon
                add(op, "", 0.2, 0.012 if style != "#9aa3aa" else 0.05, style == "#9aa3aa", body_pivot, "lance")
        elif "mounted2d:torso" in tag:
            if st["torso"] == 0:
                add(op, "", 0.0, 0.32, True, body_pivot, "torso", mark="torso")
            else:
                add(op, "", 0.0, 0.32, True, body_pivot, "torso", skin="torso", grow=0.004 * st["torso"])
            st["torso"] += 1
        elif "mounted2d:legs" in tag:
            if "limb" in tag:
                both(op, 0.25, 0.1, True, body_pivot, "rleg", mark="rleg")
            elif "poly" in tag and style == LIVERY["main"]:     # surcoat skirt over the thigh
                both(op, 0.25, 0.14, True, body_pivot, "skirt", mark="skirt")
            elif "poly" in tag and style == LIVERY["alt"]:
                for s, off in (("n", -0.25), ("f", 0.25)):
                    add(op, s, off, 0.14, True, body_pivot, "skirt" + s, skin="skirt" + s, grow=0.004)
            elif "poly" in tag:                                # boot / sabaton
                both(op, 0.25, 0.11, True, body_pivot, "rleg")
            else:                                              # stirrup leather
                both(op, 0.27, 0.02, False, body_pivot, "rleg")
        elif "mounted2d:reins" in tag or "hand<mounted2d:reins" in tag:
            if "limb" in tag:
                both(op, 0.18, 0.09, True, body_pivot, "arm")
            elif "hand" in tag:
                both(op, 0.18, 0.075, True, body_pivot, "hand")
            elif "poly" in tag:
                add(op, "n", -0.17, 0.06, True, body_pivot, "satchel")
            else:
                both(op, 0.07, 0.015, False, body_pivot, "rein")
        elif op_class(tag) == "shield":
            # On the near side, over the thigh: a flat board; its arms, rim and boss painted on it.
            if st["shield"] == 0:
                add(op, "n", -0.33, 0.04, True, body_pivot, "shield", mark="shield")
            else:
                add(op, "n", -0.33, 0.04, True, body_pivot, "shield", skin="shield", grow=0.003 * st["shield"])
            st["shield"] += 1
        elif "drawHeraldicMantling" in tag:
            if st["mant"] % 2 == 0:
                add(op, "", 0.0, 0.26, True, body_pivot, "mantling", mark=f"mant{st['mant']}")
            else:
                add(op, "", 0.0, 0.26, True, body_pivot, "mantling", skin=f"mant{st['mant'] - 1}", grow=0.004)
            st["mant"] += 1
        elif op_class(tag) == "head":
            # Rider's head: the first fill is the helmet or the face (with coif); the rest is painted
            # on it (visor slit, face opening, hat), except a wide brim (a line) of its own.
            if st["helm"] == 0:
                add(op, "", 0.0, 0.24, True, body_pivot, "helmet", mark="helmet")
            elif "line<mounted2d:head" in tag and style != "#16181a":
                add(op, "", 0.0, 0.38, False, body_pivot, "helmet")
            else:
                add(op, "", 0.0, 0.24, True, body_pivot, "helmet", skin="helmet", grow=0.004 + 0.002 * st["helm"])
            st["helm"] += 1
        elif op_class(tag) == "crest":
            if "shape<" in tag:   # the crest figure: a flat board above the helmet
                add(op, "", 0.0, 0.05, True, body_pivot, "crest")
            else:                 # torse: a twisted band round the top of the helmet
                add(op, "", 0.0, 0.27, True, body_pivot, "crest")
        else:
            print("unassigned part", op["k"], tag, style)
    return out


def srgb_to_lin(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


ids, objects_by_src = {}, {}
counter = [0]


def build(src_name, ops, polys, marks, fallback):
    """Build the solids of a list of ops; returns the objects; registers their ID colours."""
    parts = assign(ops, marks, fallback)
    built = []
    for idx, (op, side, y0, T, inflate, parent, group, skin, grow) in enumerate(parts):
        loops = polys.get(str(op["k"])) or []
        if not loops:
            built.append(None)
            continue
        name = f"{src_name}:{op['k']}{side}"
        if skin:
            ref = marks.get(skin) or fallback.get(skin)
            base_ob = ref and ref[2] if ref and len(ref) > 2 else None
            if base_ob is None:
                built.append(None)
                continue
            ob = overlay(name, base_ob, loops, grow)
        else:
            ob = solid(name, loops, y0, T, inflate)
        ob.parent = parent
        ob.matrix_parent_inverse = parent.matrix_world.inverted()
        ob["cls"] = op_class(op["tag"])
        # Marks point at built objects (for later skins in this source or a layer).
        for key, val in list(marks.items()):
            if len(val) == 2 and val[1] == idx:
                marks[key] = (val[0], val[1], ob)
        counter[0] += 1
        n = counter[0]
        rgb = (30 + n % 200, 30 + (n // 200) % 200, 30 + (n * 37) % 200)   # unique for n < 40000
        while "%d,%d,%d" % rgb in ids:
            n += 997
            rgb = (30 + n % 200, 30 + (n // 200) % 200, 30 + (n * 37) % 200)   # unique for n < 40000
        ob.color = (*(srgb_to_lin(c / 255) for c in rgb), 1.0)
        ids["%d,%d,%d" % rgb] = {"k": op["k"], "src": src_name, "side": side, "group": group,
                                 "style": op["style"], "tag": op["tag"], "arms": "arms<" in op["tag"]}
        built.append(ob)
    objs = [o for o in built if o is not None]
    objects_by_src.setdefault(src_name, []).extend(objs)
    return objs


exclude = set(config.get("exclude", []))
base_ops = [op for op in base_data["ops"] if op_class(op["tag"]) not in exclude]
build("base", base_ops, base_polys, base_marks, {})
swaps = {}   # set name -> {class: src name}
for s in config.get("sets", []):
    for cls, d in (s.get("swap") or {}).items():
        data, polys = load(d)
        name = f"{s['name']}-{cls}"
        build(name, [op for op in data["ops"] if op_class(op["tag"]) == cls], polys, {}, base_marks)
        swaps.setdefault(s["name"], {})[cls] = name
for L in config.get("layers", []):
    data, polys = load(L["dir"])
    build(L["name"], [op for op in data["ops"] if op_class(op["tag"]) == L["class"]], polys, {}, base_marks)
print("parts built:", sum(len(v) for v in objects_by_src.values()), {k: len(v) for k, v in objects_by_src.items()})

# --- camera and renderer --------------------------------------------------------------------------
RES, ORTHO, CAM_Z = 960, 5.4, 2.35   # room for the raised lance (tip ~4.9 m up)
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
scene.render.dither_intensity = 0.0  # exact ID colours, no noise
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


def set_pose(p):
    body_pivot.location.z = art(0, 150 - CY)[1] - p["bob"] * M
    body_pivot.rotation_euler = (0.0, p["tilt"], 0.0)
    hx, hz = art(*jmid)
    head_pivot.location = (hx + p["headX"] * M, 0.0, hz - p["headY"] * M)
    head_pivot.rotation_euler = (0.0, p["headRot"], 0.0)
    tail_pivot.rotation_euler = (0.0, p["tail"], 0.0)
    for i, leg in enumerate(frame["legs"]):
        x, z = art(leg["x"] - CX, leg["y"] - CY)
        hips[i].location = (x, 0.0, z + p["lift"][i] * M)
        hips[i].rotation_euler = (0.0, p["legs"][i], 0.0)
        knees[i].rotation_euler = (0.0, p["bend"][i], 0.0)
    bpy.context.view_layer.update()


def show(srcs):
    for name, objs in objects_by_src.items():
        on = name in srcs
        for o in objs:
            o.hide_render = not on


poses = base_data["poses"]
layers = [L["name"] for L in config.get("layers", [])]
renders = 0
for view in config.get("views", ["SE", "S", "SW", "NW", "N", "NE"]):
    root.rotation_euler = (0.0, 0.0, math.radians(ANGLES[view]))
    for s in config.get("sets", [{"name": "rest", "poses": ["idle"] + [f"p{i}" for i in range(8)]}]):
        # Base for this set: base objects minus the swapped classes (e.g. the raised lance), plus the
        # swap sources (the couched lance of the charge).
        swap = swaps.get(s["name"], {})
        swapped_classes = set(swap.keys())
        base_srcs = {"base"} | set(swap.values())
        for pose in s["poses"]:
            set_pose(poses[pose])
            for layer in ["base"] + layers:
                srcs = base_srcs | ({layer} if layer != "base" else set())
                show(srcs)
                if swapped_classes:
                    for o in objects_by_src["base"]:
                        if o.get("cls") in swapped_classes:
                            o.hide_render = True
                scene.render.filepath = os.path.join(outdir, f"{view}_{pose}__{layer.replace(':', '-')}.png")
                bpy.ops.render.render(write_still=True)
                renders += 1
    print("rendered", view, renders)

json.dump({"ids": ids, "res": RES, "ortho": ORTHO, "camZ": CAM_Z, "elev": math.degrees(ELEV), "M": M, "layers": layers,
           "sets": config.get("sets", []), "views": config.get("views", []), "colors": base_data["colors"]}, open(os.path.join(outdir, "ids.json"), "w"))
print("done:", outdir, renders, "renders")
