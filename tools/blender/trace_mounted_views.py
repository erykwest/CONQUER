"""Trace the part-ID renders of mounted_views.py into the 2D views module.

  python tools/blender/trace_mounted_views.py <output .js> <kind>=<render dir> [<kind>=<render dir> ...]

For every view and pose, <view>_<pose>__base.png gives the base frame and <view>_<pose>__<layer>.png
the visible regions of that layer (helmet, shield, crest...), rendered with the base in front of
or behind it. Every image is split by ID colour into the visible region of each part (occlusion
already resolved by the 3D render), traced and written in the horse's art units (relative to the
ground centre, y down: the frame of the 2D side art). The renderer (settlement-mounted2d.js)
fills each region in the part's colour, outlines each group and paints the realm arms in the
arms regions (bbox given).
"""
import json
import math
import os
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from trace_mask import contours, simplify_closed  # noqa: E402

ANGLES = {"E": 0, "SE": -45, "S": -90, "SW": -135, "W": 180, "NW": 135, "N": 90, "NE": 45}
HORSE_GROUPS = ("body", "tail", "neck", "head", "leg0", "leg1", "leg2", "leg3", "plume")
NO_OUTLINE = {"rein"}


def token_of(style, group, coat, livery):
    s = style.lower()
    if s == livery["main"].lower():
        return "livery:main"
    if s == livery["alt"].lower():
        return "livery:alt"
    keys = [k for k, v in coat.items() if str(v).lower() == s]
    if keys:
        pref = {"leg": ["leg", "legFar", "hoof"], "head": ["head", "mane", "eye", "line"], "neck": ["head", "mane"],
                "tail": ["mane"], "body": ["body", "shade"]}
        for g, order in pref.items():
            if group.startswith(g):
                for k in order:
                    if k in keys:
                        return "coat:" + k
        return "coat:" + keys[0]
    return s


def regions_of(path, meta, keys_rgb, ppm, wanted):
    """Regions [part index, path(, bbox)] of the parts whose src is in `wanted`."""
    im = np.array(Image.open(path).convert("RGBA")).astype(np.int32)
    alpha = im[:, :, 3] >= 128
    code = im[:, :, 0] * 65536 + im[:, :, 1] * 256 + im[:, :, 2]
    label = np.full(code.shape, -1, dtype=np.int32)
    for u in np.unique(code[alpha]):
        rgb = np.array([u >> 16, (u >> 8) & 255, u & 255])
        label[alpha & (code == u)] = int(np.argmin(((keys_rgb - rgb) ** 2).sum(axis=1)))
    res, camz, M = meta["res"], meta["camZ"], meta["M"]
    ce = math.cos(math.radians(meta.get("elev", 0.0)))
    out = []
    for idx in np.unique(label[label >= 0]):
        idx = int(idx)
        part = meta["_parts"][idx]
        if part["src"] not in wanted:
            continue
        mask = label == idx
        if mask.sum() < 4:
            continue
        loops, xs, ys = [], [], []
        for loop in contours(mask.astype(np.uint8).tolist()):
            pts = simplify_closed(loop, float(os.environ.get("TRACE_EPS", "1.8")))
            if len(pts) < 3:
                continue
            art = []
            for c, r in pts:
                x = round(((c + .5 - res / 2) / ppm) / M)
                # Camera pitched down by elev: screen-up through the target, origin at -camz*cos(elev);
                # heights are restored to the 2D art's (divide by cos(elev)).
                y = round(-((res / 2 - (r + .5)) / ppm + camz * ce) / ce / M)
                art.append(f"{x} {y}")
                xs.append(x)
                ys.append(y)
            loops.append("M" + " L".join(art) + "Z")
        if not loops:
            continue
        region = [idx, "".join(loops)]
        if part["arms"]:
            region.append([min(xs), min(ys), max(xs) - min(xs), max(ys) - min(ys)])
        out.append(region)
    out.sort(key=lambda r: meta["_parts"][r[0]]["k"])
    return out


def trace_kind(src):
    meta = json.load(open(os.path.join(src, "ids.json"), encoding="utf-8"))
    coat, livery = meta["colors"]["coat"], meta["colors"]["livery"]
    ppm = meta["res"] / meta["ortho"]
    keys = list(meta["ids"].keys())
    keys_rgb = np.array([[int(c) for c in k.split(",")] for k in keys])
    meta["_parts"] = [meta["ids"][k] for k in keys]
    # Vehicles (wagon_views.py) give each part its own fill and outline; the riders derive them.
    parts = [{"k": p["k"], "group": p["group"],
              "fill": p.get("fill") or token_of(p["style"], p["group"], coat, livery),
              "outline": p["outline"] if "outline" in p else (None if p["group"] in NO_OUTLINE else
                         ("coat:line" if p["group"].startswith(HORSE_GROUPS) else "outline")),
              **({"arms": True} if p["arms"] else {})} for p in meta["_parts"]]
    sets = meta["sets"] or [{"name": "rest", "poses": ["idle"] + [f"p{i}" for i in range(8)]}]
    poses = [p for s in sets for p in s["poses"]]
    layers = meta.get("layers", [])
    views, layer_frames = {}, {L: {} for L in layers}
    for view in meta.get("views") or ["SE", "S", "SW", "NW", "N", "NE"]:
        frames = []
        for s in sets:
            base_srcs = {"base"} | {f"{s['name']}-{cls}" for cls in (s.get("swap") or {})}
            for pose in s["poses"]:
                frames.append(regions_of(os.path.join(src, f"{view}_{pose}__base.png"), meta, keys_rgb, ppm, base_srcs))
                for L in layers:
                    if meta.get("layerPoses") and pose not in meta["layerPoses"]:
                        continue   # layers traced at rest only (vehicle cargo)
                    layer_frames[L].setdefault(view, []).append(
                        regions_of(os.path.join(src, f"{view}_{pose}__{L.replace(':', '-')}.png"), meta, keys_rgb, ppm, {L}))
        a = math.radians(ANGLES[view])
        views[view] = {"shadow": round(78 * abs(math.cos(a)) + 24 * abs(math.sin(a)), 1), "frames": frames}
        if (meta.get("anchors") or {}).get(view):
            views[view]["anchor"] = meta["anchors"][view]   # the 2D driver's seat / carter (wagon_views.py)
        print("traced", src, view)
    out = {"parts": parts, "poses": poses, "views": views}
    if layers:
        out["layers"] = layer_frames
    return out


def main():
    out = sys.argv[1]
    # Kinds not traced in this run keep their current entry in the module.
    new_kinds = {a.split("=", 1)[0] for a in sys.argv[2:]}
    kept = []
    if os.path.exists(out):
        for line in open(out, encoding="utf-8"):
            if line.startswith("window.ConquerMountedViews[") and "]=" in line:
                if json.loads(line[len("window.ConquerMountedViews["):line.index("]=")]) not in new_kinds:
                    kept.append(line)
    with open(out, "w", encoding="utf-8", newline="\n") as f:
        f.write("// Generated by tools/blender/trace_mounted_views.py (Blender build: tools/blender/mounted_views.py,\n")
        f.write("// parts from the approved 2D art: extract_mounted_parts.mjs). Do not edit by hand.\n")
        f.write("window.ConquerMountedViews=window.ConquerMountedViews||{};\n")
        for line in kept:
            f.write(line)
        for arg in sys.argv[2:]:
            kind, src = arg.split("=", 1)
            f.write(f"window.ConquerMountedViews[{json.dumps(kind)}]=" + json.dumps(trace_kind(src), separators=(",", ":")) + ";\n")
    print("wrote", out, os.path.getsize(out), "bytes")


if __name__ == "__main__":
    main()
