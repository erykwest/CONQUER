"""CONQUER siege engines builder (Blender 5.x): ram, catapult (onager), trebuchet.

Same method as the wagon and the animals: real metres, rigid parts with pivots,
flat colours shaded in game by the castle's two-tone rule. Moving parts are
exported separately with their pivot so the game can animate the shot:
  ram        the log swings on its ropes under the ridge (pivot on the ridge)
  catapult   the arm turns about the torsion skein and stops on the padded bar
  trebuchet  the beam turns about the axle; the counterweight box hangs from
             its hinge on the SHORT end; the sling whips from the LONG end
Wheels are templates turned by the distance travelled.

Run inside Blender (BlenderMCP execute_code):
    CQ_DIR = r"...\\ASSETS\\blender"; SIEGE_OUT = r"...\\src\\assets\\siege-engines-model.js"
    exec(open(CQ_DIR + r"\\build_siege_engines.py", encoding="utf-8").read())
Axes: +X forward (towards the target), +Y left, +Z up; origin on the ground at the centre.
"""
import json, math, os, sys, importlib
from mathutils import Vector
_here = os.path.dirname(os.path.abspath(__file__)) if '__file__' in globals() else CQ_DIR
if _here not in sys.path:
    sys.path.insert(0, _here)
import cq_blender
importlib.reload(cq_blender)
from cq_blender import Part, fresh_collection, export_part, u

COLORS = {
    'wood': '#9a6a3f', 'woodLight': '#b98652', 'woodDark': '#6f4a2b',
    'iron': '#55595d', 'ironLight': '#7c8186', 'rope': '#b8a27a',
    'hide': '#7a5a3c', 'hideDark': '#5b412b', 'stone': '#9a9893', 'leather': '#4a3020',
}
KEYS = list(COLORS.keys())
COLL_NAME = 'CONQUER_Siege'


def part(root, name, engine, offset):
    return Part(root, name, COLORS, offset, prefix=engine + '_')


def wheel(p, r, half=.09, spokes=6):
    """Heavy siege wheel: thick iron tyre, plank felloe, spokes, big hub (axle along y)."""
    p.ring(r, r - .05, half, 'iron', n=12, side_key='ironLight', inner=False)
    p.ring(r - .05, r - .16, half * .9, 'wood', n=12, side_key='woodDark', outer=False)
    p.cylinder(.13, half * 1.6, 'woodDark', n=8, cap_key='ironLight')
    for i in range(spokes):
        a = 2 * math.pi * i / spokes
        d = Vector((math.cos(a), 0, math.sin(a)))
        p.beam(d * .12, d * (r - .14), .07, .07, 'woodLight')


def post(p, a, b, s=.18, key='wood'):
    p.beam(a, b, s, s, key)


# ------------------------------------------------------------------ ram
def build_ram(root, off):
    parts, pivots = {}, {}
    p = part(root, 'frame', 'ram', off)
    for s in (-1, 1):
        p.box((0, s * 1.05, .55), (5.0, .22, .22), 'woodDark')                          # sills
        p.box((0, s * 1.05, 2.25), (5.0, .18, .18), 'wood')                             # top plates
        for x in (-2.2, 0, 2.2):
            post(p, (x, s * 1.05, .55), (x, s * 1.05, 2.25), .2)                        # posts
        post(p, (-2.2, s * 1.05, .7), (0, s * 1.05, 2.1), .12, 'woodDark')              # braces
        post(p, (2.2, s * 1.05, .7), (0, s * 1.05, 2.1), .12, 'woodDark')
    for x in (-2.2, 0, 2.2):
        p.box((x, 0, .55), (.2, 2.3, .18), 'woodDark')                                  # cross beams
    p.box((0, 0, 3.35), (5.2, .2, .2), 'woodDark')                                      # ridge
    for x in (-2.3, -1.15, 0, 1.15, 2.3):
        for s in (-1, 1):
            post(p, (x, s * 1.12, 2.28), (x, 0, 3.32), .1, 'woodDark')                  # rafters
    for x in (-1.6, 1.6):
        p.box((x, 0, .5), (.12, 2.8, .12), 'iron')                                      # axles
    parts['frame'] = p.finish()

    # Roof of wet hides on battens: two steep slopes with darker seams.
    p = part(root, 'roof', 'ram', off)
    for s in (-1, 1):
        p.beam((0, s * 1.3, 2.12), (0, s * .02, 3.42), 5.3, .07, 'hide')
        for x in (-1.75, -.55, .55, 1.75):
            p.beam((x, s * 1.33, 2.1), (x, s * .05, 3.43), .07, .08, 'hideDark')
    parts['roof'] = p.finish()

    # The ram: iron-headed log hung from the ridge on two ropes (swings as a pendulum).
    p = part(root, 'ram', 'ram', off)
    p.cylinder(.2, 0, 'woodDark', n=8, axis='x', center=(0, 0, 1.35),
               radii=[.18, .21, .21, .19], along=[-2.2, -1.5, 2.2, 2.85], cap_key='wood')
    p.cylinder(.22, 0, 'iron', n=8, axis='x', center=(0, 0, 1.35),
               radii=[.24, .24, .16, .04], along=[2.8, 3.15, 3.4, 3.5], cap_key='ironLight')
    for x in (-1.6, .4, 2.1):
        p.cylinder(.22, 0, 'iron', n=8, axis='x', center=(0, 0, 1.35), radii=[.225, .225], along=[x, x + .1])
    for x in (-1.0, 1.0):
        p.beam((x, 0, 1.55), (x, 0, 3.25), .04, .04, 'rope')
    parts['ram'] = p.finish()
    pivots['ram'] = u(0, 0, 3.25)

    p = part(root, 'wheel', 'ram', off)
    wheel(p, .5)
    parts['wheel'] = p.finish()
    meta = {'wheels': {'part': 'wheel', 'r': u(.5)[0], 'at': [u(x, s * 1.32, .5) for x in (-1.6, 1.6) for s in (-1, 1)]},
            'crew': [u(x, s * .55, 0) for x in (-1.5, -.3) for s in (-1, 1)], 'length': u(5.4)[0]}
    return parts, pivots, meta


# ------------------------------------------------------------------ catapult
def build_catapult(root, off):
    parts, pivots = {}, {}
    p = part(root, 'frame', 'catapult', off)
    for s in (-1, 1):
        p.box((0, s * .8, .55), (4.2, .26, .26), 'woodDark')                            # sills
        p.box((-1.0, s * .8, .95), (.5, .26, .55), 'wood')                              # skein housings
        post(p, (.55, s * .78, .65), (.3, s * .62, 2.35), .2)                           # stop uprights
        post(p, (1.55, s * .8, .65), (.38, s * .66, 2.1), .14, 'woodDark')              # braces
    for x in (-1.85, -.5, .9, 1.85):
        p.box((x, 0, .55), (.22, 1.85, .2), 'woodDark')                                 # cross beams
    p.box((.3, 0, 2.38), (.26, 1.5, .24), 'wood')                                       # stop bar
    p.box((.12, 0, 2.38), (.14, .8, .3), 'leather')                                     # its padding
    p.cylinder(.2, .72, 'rope', n=10, center=(-1.0, 0, .92), cap_key='rope')            # torsion skein
    p.cylinder(.12, .9, 'woodLight', n=8, center=(-1.9, 0, .85), cap_key='woodDark')    # windlass
    for x in (-1.4, 1.4):
        p.box((x, 0, .45), (.12, 2.3, .12), 'iron')                                     # axles
    parts['frame'] = p.finish()

    # Arm modelled upright (fired pose); the cup sits at the top with its stone.
    p = part(root, 'arm', 'catapult', off)
    p.taper((-1.0, 0, .92), (-1.0, 0, 3.2), .2, .24, .14, .16, 'woodLight')
    p.box((-1.0, 0, 3.28), (.42, .42, .14), 'wood')                                     # cup floor
    for (dx, dy) in ((.2, 0), (-.2, 0), (0, .2), (0, -.2)):
        p.box((-1.0 + dx, dy, 3.36), (.06 if dx else .42, .06 if dy else .42, .14), 'woodDark')
    parts['arm'] = p.finish()
    pivots['arm'] = u(-1.0, 0, .92)
    p = part(root, 'stone', 'catapult', off)
    p.cylinder(.16, 0, 'stone', n=6, axis='z', center=(-1.0, 0, 3.3), radii=[.1, .17, .1], along=[0, .14, .28])
    parts['stone'] = p.finish()

    p = part(root, 'wheel', 'catapult', off)
    wheel(p, .45)
    parts['wheel'] = p.finish()
    meta = {'wheels': {'part': 'wheel', 'r': u(.45)[0], 'at': [u(x, s * 1.08, .45) for x in (-1.4, 1.4) for s in (-1, 1)]},
            'crew': [u(-2.4, .5, 0), u(-2.4, -.5, 0)], 'length': u(4.6)[0]}
    return parts, pivots, meta


# ------------------------------------------------------------------ trebuchet
def build_trebuchet(root, off):
    parts, pivots = {}, {}
    H = 5.0                                                                              # axle height
    p = part(root, 'frame', 'trebuchet', off)
    for s in (-1, 1):
        p.box((0, s * 1.6, .55), (6.2, .32, .32), 'woodDark')                           # sills
        y = s * 1.15
        post(p, (-1.9, y, .6), (0, y, H), .28)                                          # A-frame legs
        post(p, (1.9, y, .6), (0, y, H), .28)
        post(p, (0, y, .6), (0, y, H - .1), .26, 'woodLight')                           # king post
        p.box((0, y, 2.4), (3.0, .22, .22), 'woodDark')                                 # tie beam
        post(p, (-1.9, y, .6), (-1.9, s * 1.6, .6), .3, 'woodDark')                     # leg feet
        post(p, (1.9, y, .6), (1.9, s * 1.6, .6), .3, 'woodDark')
        post(p, (-2.9, s * 1.6, .7), (-1.0, y, 3.1), .16, 'woodDark')                   # rear brace
        post(p, (2.9, s * 1.6, .7), (1.0, y, 3.1), .16, 'woodDark')                     # front brace
    for x in (-2.9, -1.9, 0, 1.9, 2.9):
        p.box((x, 0, .55), (.26, 3.5, .24), 'woodDark')                                 # cross beams
    p.cylinder(.16, 1.45, 'iron', n=8, center=(0, 0, H), cap_key='ironLight')           # axle
    p.box((-4.0, 0, .62), (3.0, .7, .06), 'woodLight')                                  # sling trough
    for s in (-1, 1):
        p.box((-4.0, s * .36, .7), (3.0, .06, .18), 'wood')
    p.cylinder(.22, 1.0, 'woodLight', n=8, center=(-2.6, 0, 1.0), cap_key='woodDark')   # windlass drum
    for x in (-2.4, 2.4):
        p.box((x, 0, .55), (.14, 4.2, .14), 'iron')                                     # axles
    parts['frame'] = p.finish()

    # Beam modelled level: short end +x carries the counterweight hinge,
    # long end -x carries the sling. Pivot on the axle.
    p = part(root, 'arm', 'trebuchet', off)
    p.taper((2.1, 0, H), (-6.4, 0, H), .42, .46, .2, .22, 'woodLight')
    for x in (1.2, -.9, -3.4):
        p.cylinder(.25, 0, 'iron', n=8, axis='x', center=(0, 0, H), radii=[.26, .26], along=[x, x + .1])
    parts['arm'] = p.finish()
    pivots['arm'] = u(0, 0, H)

    # Counterweight: a stone-filled box hanging from a hinge on the short end.
    p = part(root, 'weight', 'trebuchet', off)
    hinge = Vector((2.0, 0, H))
    for s in (-1, 1):
        post(p, (2.0, s * .45, H - .05), (2.0, s * .55, H - 1.1), .12, 'woodDark')      # hangers
    p.box((2.0, 0, H - 1.85), (1.5, 1.6, 1.5), 'wood')
    p.box((2.0, 0, H - 1.08), (1.4, 1.5, .06), 'stone')                                 # stones showing on top
    for z in (H - 1.3, H - 2.4):
        p.box((2.0, 0, z), (1.56, 1.66, .1), 'iron')                                    # iron bands
    parts['weight'] = p.finish()
    pivots['weight'] = u(2.0, 0, H)

    # Sling: two ropes from the long end to a leather pouch holding the stone,
    # modelled hanging straight down from the tip (pivot on the tip).
    p = part(root, 'sling', 'trebuchet', off)
    for s in (-1, 1):
        p.beam((-6.4, 0, H), (-6.4, s * .14, H - 2.6), .03, .03, 'rope')
    p.box((-6.4, 0, H - 2.7), (.36, .34, .14), 'leather')
    parts['sling'] = p.finish()
    pivots['sling'] = u(-6.4, 0, H)
    p = part(root, 'slingStone', 'trebuchet', off)                                       # leaves the pouch on release
    p.cylinder(.2, 0, 'stone', n=6, axis='z', center=(-6.4, 0, H - 2.66), radii=[.12, .2, .12], along=[0, .16, .32])
    parts['slingStone'] = p.finish()
    pivots['slingStone'] = u(-6.4, 0, H)

    p = part(root, 'wheel', 'trebuchet', off)
    wheel(p, .55)
    parts['wheel'] = p.finish()
    meta = {'wheels': {'part': 'wheel', 'r': u(.55)[0], 'at': [u(x, s * 2.15, .55) for x in (-2.4, 2.4) for s in (-1, 1)]},
            'crew': [u(-2.6, .75, 0), u(-2.6, -.75, 0), u(2.6, 1.9, 0)], 'length': u(9.0)[0], 'axleZ': u(H)[0]}
    return parts, pivots, meta


ENGINES = [('ram', build_ram, (0, 0, 0)), ('catapult', build_catapult, (0, 6, 0)), ('trebuchet', build_trebuchet, (0, 13, 0))]


def main(out_path):
    root = fresh_collection(COLL_NAME)
    data = {'palette': list(COLORS.values()), 'paletteKeys': KEYS, 'engines': {}}
    total = 0
    for name, fn, off in ENGINES:
        parts, pivots, meta = fn(root, off)
        exported = {n: export_part(p, KEYS) for n, p in parts.items()}
        total += sum(len(p['c']) for p in exported.values())
        data['engines'][name] = {'parts': exported, 'pivots': pivots, **meta}
    js = ("'use strict';\n// Generated by ASSETS/blender/build_siege_engines.py — do not edit by hand.\n"
          "// Siege engines as triangles in model space (U): +x towards the target, +y left, +z up.\n"
          "window.ConquerSiegeModel=" + json.dumps(data, separators=(',', ':')) + ";\n")
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, 'w', encoding='utf-8', newline='\n') as f:
        f.write(js)
    print(f"siege engines: {len(ENGINES)} engines, {total} triangles, {len(js) // 1024} KB -> {out_path}")
    return total


if __name__ == '__main__' and '--' in sys.argv:
    args = sys.argv[sys.argv.index('--') + 1:]
    main(args[args.index('--out') + 1])
elif 'SIEGE_OUT' in globals():
    SIEGE_RESULT = main(SIEGE_OUT)
