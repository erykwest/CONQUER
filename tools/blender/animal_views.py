"""An approved 2D animal in 3D, built from its own art, rendered as part-ID images for 6 views.

  blender -b -P tools/blender/animal_views.py -- <parts dir> <out dir>

Same method as the mounted figures (mounted_views.py, PR 314), for the animals of
settlement-animals.js (ANIMAL-VIEWS-261127). <parts dir> comes from extract_animal_parts.mjs +
mounted_parts_poly.py: every coloured shape of the animal (side view, facing right, at rest) as
polygons in art units, with the function that drew it and its colour. Each shape becomes a solid
of its own depth, rounded like a pillow: legs near and far, body, tail, neck, head; ears, horns and
antlers stand on both sides of the head; shade, muzzle, nose, beard, tusk and eye are skins painted
on the solid under them. Depths are fractions of the body's own depth (DEPTH below), so a sheep is
round and a deer slim. Seen from the side the model is the 2D art itself; the gait is the 2D gait.

Images: <out>/<view>_<pose>__base.png in flat ID colours; <out>/ids.json maps colours to parts.
The camera looks along +Y; the animal faces +X.
"""
import bpy
import bmesh
import json
import math
import os
import sys

args = sys.argv[sys.argv.index("--") + 1:]
src, outdir = args[0], args[1]
os.makedirs(outdir, exist_ok=True)
data = json.load(open(os.path.join(src, "parts.json"), encoding="utf-8"))
polys = json.load(open(os.path.join(src, "parts_poly.json"), encoding="utf-8"))
frame, C = data["frame"], {k: str(v).lower() for k, v in data["colors"]["coat"].items()}
species = data["species"]
CX, CY = frame["center"]["x"], frame["center"]["y"]
M = 0.0105  # metres per art unit (as the horse's); the build is traced back to art units

# Body depth as a fraction of the body's height in the art; head depth as a fraction of the body depth.
DEPTH = {"sheep": (.95, .45), "goat": (.7, .42), "cow": (.82, .45), "horse": (.62, .38), "deer": (.8, .42),
         "stag": (.8, .42), "wolf": (.75, .45), "bear": (.85, .55), "boar": (.8, .5)}
# Antlers, horns and ears splay outward from the head (radians about the animal's long axis), so from
# the front they open in a V instead of standing as flat boards in the side plane.
SPLAY = {"antler": .55, "horn": .25, "ear": .45}
kb, kh = DEPTH.get(species, (.65, .45))
BODY_T = kb * frame["bodyH"] * M
HEAD_T = kh * BODY_T
LEG_OFF = .26 * BODY_T

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene


def art(x, y):
    return x * M, -y * M


def empty(name, x, z, parent=None):
    e = bpy.data.objects.new(name, None)
    scene.collection.objects.link(e)
    e.location = (x, 0.0, z)
    if parent is not None:
        e.parent = parent
        e.matrix_parent_inverse = parent.matrix_world.inverted()
    return e


root = empty("root", 0.0, 0.0)
body_pivot = empty("body", *art(0, 150 - CY), root)
head_at = (frame["head"]["x"] - CX, frame["head"]["y"] - CY)
head_pivot = empty("head", *art(*head_at), body_pivot)
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
            best = min(best, d)
    return best


def solid(name, loops_art, y0, T):
    """Polygon loops (art units) -> closed prism between y0 -/+ T/2, rounded like a pillow."""
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
    if me.polygons:
        mod = ob.modifiers.new("remesh", "REMESH")
        mod.mode = 'VOXEL'
        mod.voxel_size = max(0.004, min(0.014, T / 8))
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
    c = False
    for loop in loops:
        for i in range(len(loop)):
            ax, az = loop[i]
            bx, bz = loop[i - 1]
            if (az > z) != (bz > z) and x < (bx - ax) * (z - az) / (bz - az) + ax:
                c = not c
    return c


def overlay(name, base, loops_art, grow):
    """The base surface inside the part's outline (seen from the side), pushed out by grow."""
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


# --- part table: op -> solids ---------------------------------------------------------------------
# (op, side, y0, T, parent, group, skin_of, grow). Near side = -Y (toward the profile camera).
def assign(ops):
    out, marks = [], {}
    order = frame["legOrder"]
    st = {"leg": 0, "piece": 0, "body": 0, "ear": 0}
    ears = sum(1 for o in ops if o["style"].lower() == C.get("ear") and "drawHeadArt" in o["tag"])

    def add(op, side, y0, T, parent, group, mark=None, skin=None, grow=0.0):
        out.append((op, side, y0, T, parent, group, skin, grow))
        if mark:
            marks[mark] = len(out) - 1

    for idx, op in enumerate(ops):
        tag, style = op["tag"], op["style"].lower()
        nxt = ops[idx + 1] if idx + 1 < len(ops) else None
        if style.startswith("rgba(30, 40, 20"):
            continue   # ground shadow: drawn by the view renderer
        if "drawLeg" in tag:
            i = order[st["leg"]]
            y0 = -LEG_OFF if i % 2 == 0 else LEG_OFF
            T = max(.05, frame["legs"][i]["w"] * M * .95)
            if op["op"] == "fillRect":            # hoof: painted on the lower leg
                add(op, "", y0, T, knees[i], f"leg{i}", skin=f"lower{i}", grow=.004)
            elif st["piece"] == 0:                # lower leg (cannon), turned at the joint
                add(op, "", y0, T, knees[i], f"leg{i}", mark=f"lower{i}")
                st["piece"] = 1
            else:                                 # upper leg: the leg ends here
                add(op, "", y0, T, hips[i], f"leg{i}")
                st["piece"] = 0
                st["leg"] += 1
        elif "drawNeck" in tag:
            if style == C.get("mane"):
                add(op, "", 0.0, .16 * BODY_T, body_pivot, "neck")
            else:
                add(op, "", 0.0, .5 * BODY_T, body_pivot, "neck", mark="neck")
        elif "drawStroke" in tag:                 # antlers: far branch on the far side, near on the near
            far = style == C.get("antlerFar")
            add(op, "f" if far else "n", (.32 if far else -.32) * HEAD_T, .05, head_pivot, "antler")
        elif "drawHead" in tag and C.get("hornFar") and style == C["hornFar"]:
            add(op, "f", .3 * HEAD_T, .06, head_pivot, "horn")
        elif "drawHead" in tag and C.get("horn") and style == C["horn"]:
            add(op, "n", -.3 * HEAD_T, .06, head_pivot, "horn")
        elif "drawHeadArt" in tag:
            if "head" not in marks and style == C.get("head"):
                add(op, "", 0.0, HEAD_T, head_pivot, "head", mark="head")
            elif style == C.get("ear"):
                # Two ears in the art: the first is the far one. One ear: one on each side.
                sides = [("f", .38)] if ears > 1 and st["ear"] == 0 else [("n", -.38)] if ears > 1 else [("n", -.38), ("f", .38)]
                for s, k in sides:
                    add(op, s, k * HEAD_T, .035, head_pivot, "ear")
                st["ear"] += 1
            else:                                 # muzzle, nose, beard, tusk, eye: painted on the head
                add(op, "", 0.0, HEAD_T, head_pivot, "head", skin="head", grow=.004)
        elif "fillStroke<animals:Object.drawAnimal" in tag:
            if st["body"] == 0:                   # tail (drawn before the body)
                add(op, "", 0.0, max(.04, .16 * BODY_T), tail_pivot, "tail")
            else:
                add(op, "", 0.0, BODY_T, body_pivot, "body", mark="body")
            st["body"] += 1
        elif "Object.drawAnimal" in tag and style == C.get("shade"):
            add(op, "", 0.0, BODY_T, body_pivot, "body", skin="body", grow=.004)
        else:
            print("unassigned part", op["k"], tag, style)
    return out, marks


def srgb_to_lin(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


ids, objects = {}, []
built = []
parts, marks = assign(data["ops"])
for idx, (op, side, y0, T, parent, group, skin, grow) in enumerate(parts):
    loops = polys.get(str(op["k"])) or []
    if not loops:
        built.append(None)
        continue
    name = f"{op['k']}{side}"
    if skin:
        base_idx = marks.get(skin)
        base_ob = built[base_idx] if base_idx is not None and base_idx < len(built) else None
        if base_ob is None:
            built.append(None)
            continue
        ob = overlay(name, base_ob, loops, grow)
    else:
        ob = solid(name, loops, y0, T)
        if group in SPLAY and side:
            # Turn about the part's base (its lowest point in the art), outward on its own side.
            zs = [z for loop in loops for _, z in loop]
            base_y = max(zs)
            bx = sum(x for loop in loops for x, z in loop if z >= base_y - 6) / max(1, sum(1 for loop in loops for x, z in loop if z >= base_y - 6))
            pivot = (bx * M, y0, -base_y * M)
            a = SPLAY[group] * (1 if side == "n" else -1)   # near side (-Y) leans further to -Y going up
            ca, sa = math.cos(a), math.sin(a)
            for v in ob.data.vertices:
                dy, dz = v.co.y - pivot[1], v.co.z - pivot[2]
                v.co.y = pivot[1] + dy * ca - dz * sa
                v.co.z = pivot[2] + dy * sa + dz * ca
    ob.parent = parent
    ob.matrix_parent_inverse = parent.matrix_world.inverted()
    n = len(ids) + 1
    rgb = ((n * 67) % 211 + 30, (n * 131) % 211 + 30, (n * 29) % 211 + 30)
    while "%d,%d,%d" % rgb in ids:
        n += 997
        rgb = ((n * 67) % 211 + 30, (n * 131) % 211 + 30, (n * 29) % 211 + 30)
    ob.color = (*(srgb_to_lin(c / 255) for c in rgb), 1.0)
    ids["%d,%d,%d" % rgb] = {"k": op["k"], "src": "base", "side": side, "group": group, "style": op["style"], "tag": op["tag"], "arms": False}
    built.append(ob)
    objects.append(ob)
print("parts built:", len(objects))

# --- camera and renderer --------------------------------------------------------------------------
RES, ORTHO, CAM_Z = 720, 3.8, 1.55   # room for the stag's antlers (~3.2 m up in art units)
cam_data = bpy.data.cameras.new("cam")
cam_data.type = 'ORTHO'
cam_data.ortho_scale = ORTHO
cam = bpy.data.objects.new("cam", cam_data)
scene.collection.objects.link(cam)
cam.location = (0.0, -10.0, CAM_Z)
cam.rotation_euler = (math.radians(90), 0.0, 0.0)
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


def set_pose(p):
    body_pivot.location.z = art(0, 150 - CY)[1] - p["bob"] * M
    body_pivot.rotation_euler = (0.0, p["tilt"], 0.0)
    hx, hz = art(*head_at)
    head_pivot.location = (hx + p["headX"] * M, 0.0, hz - p["headY"] * M)
    head_pivot.rotation_euler = (0.0, p["headRot"], 0.0)
    tail_pivot.rotation_euler = (0.0, p["tail"], 0.0)
    for i, leg in enumerate(frame["legs"]):
        x, z = art(leg["x"] - CX, leg["y"] - CY)
        hips[i].location = (x, 0.0, z + p["lift"][i] * M)
        hips[i].rotation_euler = (0.0, p["legs"][i], 0.0)
        knees[i].rotation_euler = (0.0, p["bend"][i], 0.0)
    bpy.context.view_layer.update()


VIEWS = ["SE", "S", "SW", "NW", "N", "NE"]
POSES = ["idle"] + [f"p{i}" for i in range(8)]
renders = 0
for view in VIEWS:
    root.rotation_euler = (0.0, 0.0, math.radians(ANGLES[view]))
    for pose in POSES:
        set_pose(data["poses"][pose])
        scene.render.filepath = os.path.join(outdir, f"{view}_{pose}__base.png")
        bpy.ops.render.render(write_still=True)
        renders += 1
json.dump({"ids": ids, "res": RES, "ortho": ORTHO, "camZ": CAM_Z, "M": M, "layers": [],
           "sets": [{"name": "rest", "poses": POSES}], "views": VIEWS, "colors": data["colors"], "species": species},
          open(os.path.join(outdir, "ids.json"), "w"))
print("done:", outdir, renders, "renders")
