"""Build the 8-view module of the mounted figures (src/assets/mounted-views.js).

  python tools/blender/build_mounted_views.py <work dir> [--kinds messenger,knight] [--fresh]
  Env: BLENDER (blender.exe), QA_CHROME (Chromium for Playwright), LAB_URL (Asset Lab served from
  this checkout, default http://127.0.0.1:4190/figures-lab.html).

Steps, per kind: extract_mounted_parts.mjs (the approved 2D art, part by part, for the base and
every equipment variant) -> mounted_parts_poly.py -> mounted_views.py (Blender headless: 3D build,
part-ID renders of the six off-profile views) -> trace_mounted_views.py (all kinds into one module).
Existing extractions in <work dir> are reused unless --fresh. The profile views (E/W) are the 2D
art itself and are not rendered.
"""
import json
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
VIEWS = ["SE", "S", "SW", "NW", "N", "NE"]
REST = ["idle"] + [f"p{i}" for i in range(8)]
CHARGE = [f"r{i}" for i in range(8)]
HELMETS = ["cap", "kettle", "nasal", "barbuta"]          # + greathelm, the default (base extraction)
SHIELDS = ["oval", "round", "heater", "kite", "pavise"]   # + default (pointed), from the base extraction
CRESTS = ["wings", "antlers", "horns", "eagle", "crown"]


def run(cmd):
    print(">", " ".join(cmd[:3]), "...", flush=True)
    subprocess.run(cmd, check=True, cwd=ROOT)


def extract(work, name, kind, options, fresh):
    d = os.path.join(work, name)
    if fresh or not os.path.exists(os.path.join(d, "parts_poly.json")):
        run(["node", os.path.join(HERE, "extract_mounted_parts.mjs"), d, kind, json.dumps(options)])
        run([sys.executable, os.path.join(HERE, "mounted_parts_poly.py"), d])
    return d


def main():
    work = os.path.abspath(sys.argv[1])
    kinds = ["messenger", "knight"]
    if "--kinds" in sys.argv:
        kinds = sys.argv[sys.argv.index("--kinds") + 1].split(",")
    fresh = "--fresh" in sys.argv
    blender = os.environ.get("BLENDER", r"C:\Program Files\Blender Foundation\Blender 4.4\blender.exe")
    traced = []
    for kind in kinds:
        if kind == "messenger":
            config = {"base": extract(work, "messenger", "messenger", {}, fresh), "exclude": [], "views": VIEWS,
                      "sets": [{"name": "rest", "poses": REST}]}
        else:
            base = extract(work, "knight-base", "knight", {}, fresh)
            layers = [{"name": "helmet:greathelm", "dir": base, "class": "head"},
                      {"name": "shield:default", "dir": base, "class": "shield"}]
            layers += [{"name": f"helmet:{h}", "dir": extract(work, f"knight-helmet-{h}", "knight", {"helmet": h}, fresh), "class": "head"} for h in HELMETS]
            layers += [{"name": f"shield:{s}", "dir": extract(work, f"knight-shield-{s}", "knight", {"shield": s}, fresh), "class": "shield"} for s in SHIELDS]
            layers += [{"name": f"crest:{c}", "dir": extract(work, f"knight-crest-{c}", "knight", {"crest": c}, fresh), "class": "crest"} for c in CRESTS]
            charge = extract(work, "knight-charge", "knight", {"charge": True}, fresh)
            config = {"base": base, "exclude": ["head", "shield", "crest"], "views": VIEWS,
                      "sets": [{"name": "rest", "poses": REST}, {"name": "charge", "poses": CHARGE, "swap": {"lance": charge}}],
                      "layers": layers}
        cfg = os.path.join(work, f"{kind}.config.json")
        json.dump(config, open(cfg, "w", encoding="utf-8"), indent=1)
        renders = os.path.join(work, f"{kind}-renders")
        run([blender, "-b", "-P", os.path.join(HERE, "mounted_views.py"), "--", cfg, renders])
        traced.append(f"{kind}={renders}")
    run([sys.executable, os.path.join(HERE, "trace_mounted_views.py"), os.path.join(ROOT, "src", "assets", "mounted-views.js"), *traced])


if __name__ == "__main__":
    main()
