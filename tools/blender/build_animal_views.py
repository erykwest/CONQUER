"""Build the 8-view module of the 2D animals (src/assets/animal-views.js). ANIMAL-VIEWS-261127.

  python tools/blender/build_animal_views.py <work dir> [--species sheep,goat] [--fresh]
  Env: BLENDER (blender.exe), QA_CHROME (Chromium for Playwright), LAB_URL (Asset Lab served from
  this checkout, default http://127.0.0.1:4190/figures-lab.html).

Per species: extract_animal_parts.mjs (the approved 2D art, part by part) -> mounted_parts_poly.py ->
animal_views.py (Blender headless: 3D build, part-ID renders of the six off-profile views, idle and
eight walk phases) -> trace_animal_views.py (all species into one module). Existing extractions and
renders in <work dir> are reused unless --fresh. The profile views (E/W) are the 2D art itself.
"""
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
SPECIES = ["sheep", "goat", "cow", "horse", "deer", "stag", "wolf", "boar", "bear"]


def run(cmd):
    print(">", " ".join(str(c) for c in cmd[:4]), "...", flush=True)
    subprocess.run(cmd, check=True, cwd=ROOT)


def main():
    work = os.path.abspath(sys.argv[1])
    species = SPECIES
    if "--species" in sys.argv:
        species = sys.argv[sys.argv.index("--species") + 1].split(",")
    fresh = "--fresh" in sys.argv
    blender = os.environ.get("BLENDER", r"C:\Program Files\Blender Foundation\Blender 4.4\blender.exe")
    traced = []
    for s in species:
        d, r = os.path.join(work, s), os.path.join(work, s + "-renders")
        if fresh or not os.path.exists(os.path.join(d, "parts_poly.json")):
            run(["node", os.path.join(HERE, "extract_animal_parts.mjs"), d, s])
            run([sys.executable, os.path.join(HERE, "mounted_parts_poly.py"), d])
        if fresh or not os.path.exists(os.path.join(r, "ids.json")):
            run([blender, "-b", "-P", os.path.join(HERE, "animal_views.py"), "--", d, r])
        traced.append(f"{s}={r}")
    run([sys.executable, os.path.join(HERE, "trace_animal_views.py"), os.path.join(ROOT, "src", "assets", "animal-views.js"), *traced])


if __name__ == "__main__":
    main()
