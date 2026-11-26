"""Trace the part masks of extract_mounted_parts.mjs into polygons, in the horse's art units.

  python tools/blender/mounted_parts_poly.py <parts dir>

Reads <parts dir>/parts.json and part_<k>.png, writes <parts dir>/parts_poly.json: for every kept
op k a list of closed loops [[x, y], ...] in art units relative to the art's ground centre
(sp.center), y down as in the 2D art.
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from trace_mask import mask_of, contours, simplify_closed  # noqa: E402


def main():
    d = sys.argv[1]
    data = json.load(open(os.path.join(d, "parts.json"), encoding="utf-8"))
    f = data["frame"]
    X, Y, PX = f["X"], f["Y"], f["PX"]
    polys = {}
    for op in data["ops"]:
        k = op["k"]
        loops = []
        for loop in contours(mask_of(os.path.join(d, f"part_{k}.png"))):
            pts = simplify_closed(loop, 0.5)
            if len(pts) < 3:
                continue
            # grid point (col,row) -> continuous pixel (+.5) -> art units from the ground centre.
            loops.append([[round((c + .5 - X) / PX, 2), round((r + .5 - Y) / PX, 2)] for c, r in pts])
        polys[str(k)] = loops
    json.dump(polys, open(os.path.join(d, "parts_poly.json"), "w", encoding="utf-8"))
    print("traced", len(polys), "parts")


if __name__ == "__main__":
    main()
