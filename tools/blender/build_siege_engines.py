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
    'team': '#7b3f98',   # player colour: cloth wraps and banners, replaced in game per owner
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
# Age-of-Empires style: a fixed engine on a ground frame (no wheels when set up)
# with two tall uprights, a very long beam wrapped in the player's colour and a
# boxed counterweight. It travels packed on the same frame raised on four wheels:
# uprights folded forward, beam laid on top, box riding in the trough. Modelled
# SET UP (frame on the ground); the game folds it with the `rig` numbers below.
TREB_H = 5.6          # axle height
TREB_HINGE = .5       # uprights fold about their feet at this height
TREB_LIFT = .35       # packed: the frame rides this much higher, on its wheels


def build_trebuchet(root, off):
    parts, pivots = {}, {}
    H, HZ = TREB_H, TREB_HINGE
    p = part(root, 'base', 'trebuchet', off)
    for s in (-1, 1):
        p.box((0, s * 1.3, .2), (6.8, .34, .34), 'woodDark')                            # sills
        for x in (-3.45, 3.45):
            p.box((x, s * 1.3, .2), (.12, .38, .38), 'team')                            # coloured end caps
        p.box((0, s * 1.0, .4), (.6, .42, .3), 'wood')                                  # upright hinge blocks
        for x in (-2.7, 2.7):
            p.box((x, s * 1.25, .32), (.4, .3, .24), 'wood')                            # prop feet
        for x in (-2.2, 2.2):
            p.box((x, s * 1.55, .2), (.2, .2, .2), 'iron')                              # axle stubs
    for x in (-3.2, -1.6, 0, 1.6, 3.2):
        p.box((x, 0, .14), (.28, 2.9, .22), 'woodDark')                                 # cross beams
    p.box((-2.9, 0, .3), (3.0, .7, .06), 'woodLight')                                   # sling trough
    for s in (-1, 1):
        p.box((-2.9, s * .36, .38), (3.0, .06, .18), 'wood')
    p.cylinder(.22, .55, 'woodLight', n=8, center=(-3.9, 0, .7), cap_key='woodDark')    # windlass drum
    for s in (-1, 1):
        p.box((-3.9, s * .62, .5), (.2, .12, .6), 'wood')
    parts['base'] = p.finish()

    # Uprights: tall posts with pointed caps, hinged at their feet, carrying the axle.
    p = part(root, 'tower', 'trebuchet', off)
    for s in (-1, 1):
        y = s * 1.0
        post(p, (0, y, HZ), (0, y, H + .5), .32, 'wood')
        p.taper((0, y, H + .5), (0, y, H + 1.0), .36, .36, .06, .06, 'woodDark')
        for z in (1.6, 3.6):
            p.box((0, y, z), (.38, .38, .28), 'team')                                   # coloured wraps
        p.box((0, y, H), (.5, .4, .6), 'iron')                                          # bearing plates
    p.cylinder(.18, 1.2, 'iron', n=8, center=(0, 0, H), cap_key='ironLight')            # axle
    parts['tower'] = p.finish()
    pivots['tower'] = u(0, 0, HZ)

    # Props: the rear pair slides along the frame while the uprights fold; the
    # front pair is unpinned and laid back before folding.
    for name, x0 in (('propR', -2.7), ('propF', 2.7)):
        p = part(root, name, 'trebuchet', off)
        for s in (-1, 1):
            post(p, (x0, s * 1.25, .35), (0, s * 1.25, 3.4), .2, 'woodDark')
        parts[name] = p.finish()
        pivots[name] = u(x0, 0, .35)

    # Beam modelled level: short end +x carries the counterweight hinge,
    # long end -x carries the sling. Pivot on the axle.
    p = part(root, 'arm', 'trebuchet', off)
    p.taper((2.3, 0, H), (-6.6, 0, H), .5, .55, .24, .26, 'woodLight')
    for x in (1.3, -1.0):
        p.cylinder(.3, 0, 'iron', n=8, axis='x', center=(0, 0, H), radii=[.31, .31], along=[x, x + .12])
    for x in (-2.4, -4.4):
        p.cylinder(.3, 0, 'team', n=8, axis='x', center=(0, 0, H), radii=[.25, .25], along=[x, x + .4])
    parts['arm'] = p.finish()
    pivots['arm'] = u(0, 0, H)

    # Counterweight: a stone-filled box hanging from a hinge on the short end
    # (hangers apart: they are hooked on only once the box is up).
    p = part(root, 'weight', 'trebuchet', off)
    p.box((2.0, 0, H - 1.85), (1.4, 1.2, 1.5), 'wood')
    p.box((2.0, 0, H - 1.08), (1.3, 1.1, .06), 'stone')                                 # stones showing on top
    for z in (H - 1.3, H - 2.4):
        p.box((2.0, 0, z), (1.46, 1.26, .1), 'iron')                                    # iron bands
    for s in (-1, 1):
        p.box((2.0, s * .62, H - 1.85), (.9, .04, .9), 'team')                          # coloured drapes
    parts['weight'] = p.finish()
    pivots['weight'] = u(2.0, 0, H)
    p = part(root, 'hangers', 'trebuchet', off)
    for s in (-1, 1):
        post(p, (2.0, s * .45, H - .05), (2.0, s * .5, H - 1.1), .12, 'woodDark')
    parts['hangers'] = p.finish()
    pivots['hangers'] = u(2.0, 0, H)

    # Sling: two ropes from the long end to a leather pouch holding the stone,
    # modelled hanging straight down from the tip (pivot on the tip).
    p = part(root, 'sling', 'trebuchet', off)
    for s in (-1, 1):
        p.beam((-6.6, 0, H), (-6.6, s * .14, H - 2.6), .03, .03, 'rope')
    p.box((-6.6, 0, H - 2.7), (.36, .34, .14), 'leather')
    parts['sling'] = p.finish()
    pivots['sling'] = u(-6.6, 0, H)
    p = part(root, 'slingStone', 'trebuchet', off)                                       # leaves the pouch on release
    p.cylinder(.2, 0, 'stone', n=6, axis='z', center=(-6.6, 0, H - 2.66), radii=[.12, .2, .12], along=[0, .16, .32])
    parts['slingStone'] = p.finish()
    pivots['slingStone'] = u(-6.6, 0, H)

    p = part(root, 'wheel', 'trebuchet', off)
    wheel(p, .55)
    parts['wheel'] = p.finish()
    # Packed layout: beam resting on the box (in the trough) and on the folded uprights.
    box_x, box_hinge_z = -2.6, .33 + 2.6
    arm_tilt = math.atan2((box_hinge_z - 1.1 + .23) - (.65 + .25), 3.0 - box_x)
    arm_pivot_x = .4
    arm_pivot_z = (box_hinge_z - 1.1 + .23) - math.tan(arm_tilt) * (arm_pivot_x - box_x)
    rig = {'lift': u(TREB_LIFT)[0], 'packedArm': u(arm_pivot_x, 0, arm_pivot_z), 'packedArmPitch': round(arm_tilt, 4),
           'packedHinge': u(box_x, 0, box_hinge_z), 'propLen': u(math.hypot(2.7, 3.4 - .35))[0],
           'propTop': u(0, 0, 3.4), 'wheelOut': u(1.05)[0], 'wheelFlatZ': u(.1)[0]}
    meta = {'wheels': {'part': 'wheel', 'r': u(.55)[0], 'at': [u(x, s * 1.75, .55) for x in (-2.2, 2.2) for s in (-1, 1)]},
            'crew': [u(-3.6, 1.0, 0), u(-3.6, -1.0, 0), u(3.0, 1.9, 0)], 'length': u(9.5)[0], 'axleZ': u(H)[0], 'rig': rig}
    return parts, pivots, meta


# ------------------------------------------------------------------ siege tower
def build_tower(root, off):
    """Assault tower: tapered timber frame clad in hides on four wheels, three
    floors, a parapet on top and a drawbridge hinged on the front at wall height
    (modelled raised; it is lowered forward onto the wall)."""
    parts, pivots = {}, {}
    B, T, TOP, PAR = 1.9, 1.5, 7.6, 8.8           # base / top half-width, platform, parapet
    half = lambda z: B + (T - B) * (z - .7) / (PAR - .7)
    p = part(root, 'frame', 'tower', off)
    for sx in (-1, 1):
        for sy in (-1, 1):
            post(p, (sx * B, sy * B, .5), (sx * T, sy * T, PAR), .32, 'wood')          # corner posts
    for z in (.7, 3.2, 5.5, TOP):
        h = half(z)
        for s in (-1, 1):
            p.box((0, s * h, z), (2 * h + .3, .26, .26), 'woodDark')                    # floor ring beams
            p.box((s * h, 0, z), (.26, 2 * h + .3, .26), 'woodDark')
    p.box((0, 0, TOP + .02), (2 * T, 2 * T, .12), 'woodLight')                         # top floor
    for x in (-1.1, 1.1):
        p.box((x, 0, .45), (.16, 2 * B + 1.0, .16), 'iron')                            # axles
    # Hide cladding on sides and back, front up to the bridge; dark seams.
    for (ax, s) in (('y', 1), ('y', -1), ('x', -1), ('x', 1)):
        a, b = (.9, TOP) if not (ax == 'x' and s == 1) else (.9, TOP - .05)
        pa, pb = half(a) + .14, half(b) + .14
        A = (0, s * pa, a) if ax == 'y' else (s * pa, 0, a)
        Bp = (0, s * pb, b) if ax == 'y' else (s * pb, 0, b)
        p.taper(A, Bp, 2 * pa, .08, 2 * pb, .08, 'hide')
        for z in (2.0, 4.3, 6.5):
            h = half(z) + .2
            c = (0, s * h, z) if ax == 'y' else (s * h, 0, z)
            sz = (2 * h, .06, .12) if ax == 'y' else (.06, 2 * h, .12)
            p.box(c, sz, 'hideDark')
        if ax != 'x' or s != 1:
            for z in (4.4, 6.6):                                                         # arrow slits
                h = half(z) + .2
                for o in (-.6, .6):
                    c = (o, s * h, z) if ax == 'y' else (s * h, o, z)
                    p.box(c, (.12, .05, .5) if ax == 'y' else (.05, .12, .5), 'leather')
    # Parapet with merlons on three sides (the front is the bridge).
    for (ax, s) in (('y', 1), ('y', -1), ('x', -1)):
        c = (0, s * T, TOP + .45) if ax == 'y' else (s * T, 0, TOP + .45)
        p.box(c, (2 * T + .2, .14, .8) if ax == 'y' else (.14, 2 * T + .2, .8), 'wood')
        for o in (-1.0, 0, 1.0):
            c = (o, s * T, TOP + 1.0) if ax == 'y' else (s * T, o, TOP + 1.0)
            p.box(c, (.5, .16, .4) if ax == 'y' else (.16, .5, .4), 'wood')
    # Banner pole on the back corner.
    post(p, (-T, T, PAR), (-T, T, PAR + 2.0), .08, 'woodDark')
    p.box((-T + .45, T, PAR + 1.6), (.8, .04, .55), 'team')
    parts['frame'] = p.finish()

    p = part(root, 'bridge', 'tower', off)
    p.box((T + .12, 0, TOP + 1.5), (.14, 2.2, 3.0), 'woodLight')                      # planks, raised
    for z in (TOP + .6, TOP + 1.6, TOP + 2.6):
        p.box((T + .22, 0, z), (.08, 2.3, .16), 'wood')                               # battens
    for s in (-1, 1):
        p.box((T + .22, s * 1.0, TOP + 2.9), (.1, .1, .12), 'iron')                   # chain rings
    parts['bridge'] = p.finish()
    pivots['bridge'] = u(T + .12, 0, TOP)

    p = part(root, 'wheel', 'tower', off)
    wheel(p, .6, half=.12, spokes=8)
    parts['wheel'] = p.finish()
    meta = {'wheels': {'part': 'wheel', 'r': u(.6)[0], 'at': [u(x, s * (B + .32), .6) for x in (-1.1, 1.1) for s in (-1, 1)]},
            'crew': [u(-2.7, y, 0) for y in (-1.0, 0, 1.0)], 'length': u(9.0)[0]}
    return parts, pivots, meta


# ------------------------------------------------------------------ ladder
def build_ladder(root, off):
    """Scaling ladder with iron hooks, modelled standing with its foot at the
    origin (pivot); carried flat on the shoulders, raised against the wall."""
    parts, pivots = {}, {}
    L = 8.6
    p = part(root, 'ladder', 'ladder', off)
    for s in (-1, 1):
        post(p, (0, s * .3, 0), (0, s * .24, L), .1, 'woodLight')                     # rails
        p.beam((0, s * .24, L - .1), (.35, s * .24, L + .05), .05, .05, 'iron')        # hooks
        p.beam((.35, s * .24, L + .05), (.4, s * .24, L - .2), .05, .05, 'iron')
    z = .35
    while z < L - .1:
        w = .3 + (.24 - .3) * z / L
        p.box((0, 0, z), (.06, 2 * w, .06), 'wood')                                   # rungs
        z += .38
    parts['ladder'] = p.finish()
    pivots['ladder'] = u(0, 0, 0)
    meta = {'wheels': {'part': None, 'r': 0, 'at': []},
            'crew': [u(-2.4, .45, 0), u(2.0, -.45, 0)], 'length': u(8.8)[0]}
    return parts, pivots, meta


ENGINES = [('ram', build_ram, (0, 0, 0)), ('catapult', build_catapult, (0, 6, 0)), ('trebuchet', build_trebuchet, (0, 13, 0)),
           ('tower', build_tower, (0, 21, 0)), ('ladder', build_ladder, (0, 27, 0))]


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
