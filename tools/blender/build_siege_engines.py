"""CONQUER siege engines builder (Blender 5.x): ram, catapult (mangonel/onager),
trebuchet, assault towers, mantlet, scaling ladder, ballista.

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
from mathutils import Vector, Matrix
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
    'hideA': '#8a4b3c', 'hideB': '#6f5670', 'hideC': '#7d8c90', 'hideD': '#a3783f',
    'team': '#7b3f98',   # player colour: cloth wraps and banners, replaced in game per owner
}
KEYS = list(COLORS.keys())
COLL_NAME = globals().get('SIEGE_COLL', 'CONQUER_Siege')


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
    # Upgrade "sassaiola": the cup loaded with a heap of fist-sized stones instead.
    p = part(root, 'pebbles', 'catapult', off)
    for (dx, dy, dz) in ((-.1, -.1, 0), (.1, -.08, 0), (-.08, .1, 0), (.1, .1, 0), (0, 0, .1), (.02, -.12, .06), (-.12, .02, .07)):
        p.cylinder(.08, 0, 'stone', n=5, axis='z', center=(-1.0 + dx, dy, 3.35 + dz), radii=[.05, .085, .05], along=[0, .07, .14])
    parts['pebbles'] = p.finish()

    p = part(root, 'wheel', 'catapult', off)
    wheel(p, .45)
    parts['wheel'] = p.finish()
    meta = {'wheels': {'part': 'wheel', 'r': u(.45)[0], 'at': [u(x, s * 1.08, .45) for x in (-1.4, 1.4) for s in (-1, 1)]},
            'crew': [u(-2.4, .5, 0), u(-2.4, -.5, 0)], 'length': u(4.6)[0]}
    return parts, pivots, meta


# ------------------------------------------------------------------ trebuchet
# A counterweight trebuchet like a wooden scale model: long sills on ground
# sleepers, two A-frames (front leg, rear leg, king post with a pointed cap and
# two ties), a ladder up the front, a windlass with star capstans, a hopper-shaped
# counterweight hinged on the short end and a covered sling trough ahead of the
# frame on the long-arm side. Modelled SET UP. It travels packed on the same sills
# raised on four wheels: A-frames laid down along the sills, ties and ladder on
# the stack, beam resting on the box in the trough. `rig.stow` says how each part
# lies when packed and when it goes up during the set-up (u from 0 to 1).
TREB_H = 5.4             # axle height
TREB_FOOT = .6           # legs and king posts hinge at their feet, on the foot blocks
TREB_LIFT = .24          # packed: the sills ride on the wheel hubs
TREB_Y = 1.15            # A-frame planes
TREB_ARM = (2.7, -7.2)   # short end, long end
TREB_HINGE_X = 2.3       # counterweight hinge on the short end
TREB_LEG_X, TREB_TOP_X = 2.5, .16
TREB_LADDER = ((3.15, -1.47, .46), (.55, -1.47, TREB_H - .35))


def star(p, c, r, key='wood', spikes=8):
    """Capstan star: handspikes radiating in the xz plane round a hub (axis y)."""
    c = Vector(c)
    p.cylinder(.16, .1, 'woodDark', n=8, center=tuple(c), cap_key='wood')
    for i in range(spikes):
        a = 2 * math.pi * (i + .5) / spikes
        d = Vector((math.cos(a), 0, math.sin(a)))
        p.beam(c + d * .12, c + d * r, .07, .09, key)


def build_trebuchet(root, off):
    parts, pivots = {}, {}
    H, FZ, Y, HX = TREB_H, TREB_FOOT, TREB_Y, TREB_HINGE_X
    sx, lx = TREB_ARM
    LX, TX = TREB_LEG_X, TREB_TOP_X
    leg_x = lambda z: LX - (LX - TX) * (z - FZ) / (H - .25 - FZ)                       # |x| of a leg at height z

    p = part(root, 'base', 'trebuchet', off)
    for x in (-2.6, -.9, .9, 2.6):
        p.box((x, 0, .08), (.3, 3.3, .16), 'woodDark')                                  # sleepers
    for x in (-4.0, -5.9):
        p.box((x, 0, .08), (.3, 1.7, .16), 'woodDark')
    for s in (-1, 1):
        p.box((0, s * Y, .31), (6.6, .3, .3), 'wood')                                   # sills
        for x in (-3.3, 3.3):
            p.box((x, s * Y, .31), (.08, .34, .34), 'team')                             # coloured end caps
        for x in (-LX, 0, LX):
            p.box((x, s * Y, .53), (.42, .36, .14), 'woodDark')                         # foot blocks
        p.beam((-2.4, s * Y, .3), (2.4, -s * Y, .3), .16, .16, 'woodDark')              # floor cross braces
    p.box((3.15, 0, .38), (.24, 2.3, .16), 'woodDark')                                  # front cross beam (beam rest)
    # Covered sling trough ahead of the frame, on the long-arm side.
    p.box((-4.65, 0, .2), (3.9, 1.2, .08), 'woodDark')
    for s in (-1, 1):
        p.box((-4.65, s * .56, .38), (3.9, .08, .4), 'wood')
    for x in (-6.58, -2.72):
        p.box((x, 0, .38), (.08, 1.2, .4), 'wood')
    for y in (-.42, -.14, .14, .42):
        p.box((-4.65, y, .6), (3.9, .26, .05), 'woodLight')                             # lid planks
    for x in (-6.2, -4.65, -3.1):
        p.box((x, 0, .64), (.1, 1.24, .04), 'iron')                                     # iron straps
    # Windlass between its own posts, star capstans outside the frames.
    for s in (-1, 1):
        post(p, (-2.75, s * .85, .46), (-2.75, s * .85, 1.4), .2, 'wood')
        star(p, (-2.75, s * 1.62, 1.15), .68)
    p.cylinder(.2, .75, 'woodLight', n=10, center=(-2.75, 0, 1.15), cap_key='woodDark')
    p.cylinder(.06, 1.7, 'iron', n=6, center=(-2.75, 0, 1.15))
    parts['base'] = p.finish()

    # A-frames: king posts (carrying the axle), front legs, rear legs, ties, ladder.
    p = part(root, 'king', 'trebuchet', off)
    for s in (-1, 1):
        post(p, (0, s * Y, FZ), (0, s * Y, H + .75), .3, 'wood')
        p.taper((0, s * Y, H + .75), (0, s * Y, H + 1.15), .32, .32, .05, .05, 'woodDark')
        p.box((0, s * Y, H), (.42, .4, .5), 'iron')                                     # bearings
        p.box((0, s * Y, 2.2), (.34, .34, .25), 'team')                                 # coloured wraps
    p.cylinder(.17, Y + .2, 'iron', n=8, center=(0, 0, H), cap_key='ironLight')         # axle
    parts['king'] = p.finish()
    pivots['king'] = u(0, 0, FZ)
    for name, sg in (('legF', 1), ('legR', -1)):
        p = part(root, name, 'trebuchet', off)
        for s in (-1, 1):
            post(p, (sg * LX, s * Y, FZ), (sg * TX, s * Y, H - .25), .26, 'wood')
        parts[name] = p.finish()
        pivots[name] = u(sg * LX, 0, FZ)
    TIES = (1.6, 3.5)
    for i, z in enumerate(TIES):
        p = part(root, 'tie%d' % (i + 1), 'trebuchet', off)
        for s in (-1, 1):
            p.box((0, s * (Y + .2), z), (2 * leg_x(z) + .3, .14, .2), 'woodDark')
            for x in (-leg_x(z), 0, leg_x(z)):
                p.box((x, s * (Y + .28), z), (.08, .04, .08), 'iron')                   # pins
        parts['tie%d' % (i + 1)] = p.finish()
        pivots['tie%d' % (i + 1)] = u(0, 0, z)
    # Two raking braces dressed as ladders, one outside each A-frame (as on the
    # model: rails and rungs, there for looks; nobody climbs them in game).
    p = part(root, 'ladder', 'trebuchet', off)
    for s in (-1, 1):
        A, B = Vector(TREB_LADDER[0]), Vector(TREB_LADDER[1])
        A.y, B.y = s * abs(A.y), s * abs(B.y)
        for o in (-.22, .22):
            post(p, A + Vector((0, o, 0)), B + Vector((0, o, 0)), .1, 'wood')
        n = int((B - A).length / .36)
        for i in range(1, n):
            p.box(tuple(A.lerp(B, i / n)), (.05, .44, .05), 'woodDark')
        p.box(tuple(A + Vector((0, 0, -.05))), (.3, .55, .16), 'woodDark')            # foot block
    parts['ladder'] = p.finish()
    pivots['ladder'] = u(*TREB_LADDER[0])

    # Beam modelled level: short end +x carries the counterweight hinge,
    # long end -x carries the sling. Pivot on the axle.
    p = part(root, 'arm', 'trebuchet', off)
    p.taper((sx, 0, H), (lx, 0, H), .46, .52, .22, .24, 'woodLight')
    for x in (1.0, -1.1):
        p.cylinder(.28, 0, 'iron', n=8, axis='x', center=(0, 0, H), radii=[.29, .29], along=[x, x + .12])
    for x in (-2.8, -5.8):
        p.cylinder(.25, 0, 'team', n=8, axis='x', center=(0, 0, H), radii=[.2, .2], along=[x, x + .35])
    p.beam((lx + .05, 0, H + .1), (lx - .25, 0, H + .4), .05, .05, 'iron')              # release hook
    parts['arm'] = p.finish()
    pivots['arm'] = u(0, 0, H)

    # Counterweight: a hopper (box over a wedge) hanging from the short end;
    # hangers apart: they are hooked on only once the box is up.
    p = part(root, 'weight', 'trebuchet', off)
    p.box((HX, 0, H - 1.35), (1.9, 1.3, .9), 'wood')
    p.taper((HX, 0, H - 1.8), (HX, 0, H - 2.6), 1.3, 1.9, 1.3, .6, 'wood')
    p.box((HX, 0, H - .88), (1.8, 1.2, .05), 'stone')                                   # stones showing on top
    p.box((HX, 0, H - .93), (1.96, 1.36, .08), 'iron')                                  # iron rim
    for s in (-1, 1):
        p.box((HX, s * .67, H - 1.4), (1.1, .04, .6), 'team')                           # coloured drapes
        for x in (-.7, .7):
            p.box((HX + x, s * .67, H - 1.35), (.07, .04, .86), 'iron')                 # corner straps
    parts['weight'] = p.finish()
    pivots['weight'] = u(HX, 0, H)
    p = part(root, 'hangers', 'trebuchet', off)
    for s in (-1, 1):
        post(p, (HX, s * .45, H - .05), (HX, s * .5, H - .92), .1, 'iron')
    parts['hangers'] = p.finish()
    pivots['hangers'] = u(HX, 0, H)

    # Sling: two ropes from the long end to a leather pouch holding the stone,
    # modelled hanging straight down from the tip (pivot on the tip).
    p = part(root, 'sling', 'trebuchet', off)
    for s in (-1, 1):
        p.beam((lx, 0, H), (lx, s * .14, H - 2.6), .03, .03, 'rope')
    p.box((lx, 0, H - 2.7), (.36, .34, .14), 'leather')
    parts['sling'] = p.finish()
    pivots['sling'] = u(lx, 0, H)
    p = part(root, 'slingStone', 'trebuchet', off)                                       # leaves the pouch on release
    p.cylinder(.2, 0, 'stone', n=6, axis='z', center=(lx, 0, H - 2.66), radii=[.12, .2, .12], along=[0, .16, .32])
    parts['slingStone'] = p.finish()
    pivots['slingStone'] = u(lx, 0, H)

    p = part(root, 'wheel', 'trebuchet', off)
    wheel(p, .55)
    parts['wheel'] = p.finish()

    # Cocked: the long end down at the trough, the sling laid forward on its lid.
    trough_top = .63
    cocked = math.asin((H - (trough_top + .15)) / -lx)
    # Packed: box standing on the trough lid, beam resting on it and on the front cross beam.
    box_x, box_hinge_z = -4.6, trough_top + 2.6
    rest = (3.15, .46 + .23)                                       # short tip on the front cross beam
    on_box = (box_x, box_hinge_z - .9 + .2)
    tilt = math.atan2(on_box[1] - rest[1], rest[0] - on_box[0])
    pivot = (rest[0] - sx * math.cos(tilt), 0, rest[1] + sx * math.sin(tilt))
    ang = lambda a, b: math.atan2(b[2] - a[2], b[0] - a[0])
    aF = ang((LX, 0, FZ), (TX, 0, H - .25))
    aR = ang((-LX, 0, FZ), (-TX, 0, H - .25))
    aL = ang(TREB_LADDER[0], TREB_LADDER[1])
    # stow: pitch (positive = forward end down) and lift dz about the part pivot, and
    # the slice of the set-up during which the part goes up.
    stow = {'king': {'pitch': round(-(math.pi / 2 - .07), 4), 'at': [.22, .36]},
            'legF': {'pitch': round(-(math.pi - aF), 4), 'at': [.32, .44]},
            'legR': {'pitch': round(aR - .07, 4), 'at': [.40, .52]},
            'tie1': {'dz': u(.86 - TIES[0])[0], 'at': [.52, .57]},
            'tie2': {'dz': u(1.06 - TIES[1])[0], 'at': [.55, .60]},
            'ladder': {'pitch': round(-(math.pi - aL), 4), 'at': [.58, .64]}}
    rig = {'lift': u(TREB_LIFT)[0], 'cocked': round(-cocked, 4), 'stow': stow,
           'packedArm': u(*pivot), 'packedArmPitch': round(tilt, 4), 'packedHinge': u(box_x, 0, box_hinge_z),
           'wheelOut': u(.9)[0], 'wheelFlatZ': u(.1)[0]}
    meta = {'wheels': {'part': 'wheel', 'r': u(.55)[0], 'at': [u(x, s * 1.85, .55) for x in (-1.4, 2.2) for s in (-1, 1)]},
            'crew': [u(-2.75, 2.35, 0), u(-2.75, -2.35, 0), u(3.6, -2.1, 0)], 'length': u(10.0)[0], 'axleZ': u(H)[0], 'rig': rig}
    return parts, pivots, meta


# ------------------------------------------------------------------ siege tower
# One assault tower with upgrades, sized on the game's walls (patrols walk on the
# wall top, structureHeight): level 1 reaches the low H1 wall (1.15 U = 4.0 m),
# level 2 the high H2 wall (2.10 U = 7.35 m) and carries a fighting top for
# archers above the bridge. Wet hides over the front and sides (against fire) are a
# further upgrade: a separate part shown only when bought. Look after the classic
# assault tower: vertical plank front, plank sides on a trapezoid (sloping back),
# open back with the ladders inside, plank battlements on top.
WALLS = {1: 1.15 * 3.5, 2: 2.10 * 3.5}
WALL_WALK = WALLS[1]
HIDE_KEYS = ('hideA', 'hideB', 'hideC', 'hideD', 'hide', 'hideDark')


def plate(p, c, w, h, axis, key, tilt=0.0):
    """Flat rectangle (2 triangles) facing along axis 'x' or 'y': planks and hides seen
    from both sides. w runs horizontally along the face, h vertically; tilt turns it in its plane."""
    cx, cy, cz = c; ca, sa = math.cos(tilt), math.sin(tilt)
    pts = []
    for du, dv in ((-w / 2, -h / 2), (w / 2, -h / 2), (w / 2, h / 2), (-w / 2, h / 2)):
        a, b = du * ca - dv * sa, du * sa + dv * ca
        pts.append((cx, cy + a, cz + b) if axis == 'x' else (cx + a, cy, cz + b))
    p.quads(pts, [(0, 1, 2, 3)], key)


def build_tower(root, off, level=1):
    name = 'tower' if level == 1 else 'tower%d' % level
    parts, pivots = {}, {}
    walk = WALLS[level]
    DECK = walk + .45                               # bridge hinge: it slopes down onto the wall top
    TOP = DECK + (2.7 if level > 1 else 0)          # fighting top (level 2) or the bridge deck
    PAR = TOP + 1.1
    BRIDGE, W, FRONT = 2.6, 1.6, 1.7                # bridge length, half width, front face x
    back0 = -(1.2 + .3 * PAR)                       # the back slopes in: x at the ground ...
    back1 = -1.0                                    # ... and at the parapet
    back = lambda z: back0 + (back1 - back0) * min(1, max(0, z / PAR))
    floors = [.75] + [.75 + (DECK - .75) * k / (2 if level == 1 else 3) for k in range(1, (2 if level == 1 else 3))] + [DECK]
    if level > 1:
        floors.append(TOP)

    p = part(root, 'frame', name, off)
    for s in (-1, 1):
        post(p, (FRONT, s * W, .45), (FRONT, s * W, PAR), .3, 'wood')                   # front posts
        post(p, (back(.45), s * W, .45), (back(PAR), s * W, PAR), .3, 'wood')            # sloping back posts
        p.box(((FRONT + back0) / 2, s * W, .5), (FRONT - back0 + .3, .3, .3), 'woodDark')  # sills
    for z in floors:
        bx = back(z)
        for s in (-1, 1):
            p.box(((FRONT + bx) / 2, s * W, z), (FRONT - bx + .3, .24, .24), 'woodDark')
        p.box((FRONT, 0, z), (.24, 2 * W + .3, .24), 'woodDark')
        p.box((bx, 0, z), (.24, 2 * W + .3, .24), 'woodDark')
        p.box(((FRONT + bx) / 2, 0, z + .1), (FRONT - bx - .1, 2 * W - .1, .08), 'woodLight')  # floor planks
    # Front: vertical planks up to the bridge; above it (level 2) up to the parapet.
    spans = [(.5, DECK)] + ([(DECK + BRIDGE + .05, TOP)] if level > 1 and DECK + BRIDGE + .05 < TOP else [])
    k = 0
    y = -W + .15
    while y < W - .1:
        for z0, z1 in spans:
            plate(p, (FRONT + .12, y + .15, (z0 + z1) / 2), .3, z1 - z0, 'x', 'woodLight' if k % 2 else 'wood')
        y += .32; k += 1
    # Sides: vertical planks on the trapezoid, cut along the sloping back.
    for s in (-1, 1):
        x = FRONT - .14; k = 0
        while x > back0 + .1:
            zt = PAR if x > back1 else PAR * (x - back0) / (back1 - back0)
            if zt > .8:
                plate(p, (x - .15, s * (W + .1), (.5 + zt) / 2), .3, zt - .5, 'y', 'woodLight' if k % 2 else 'wood')
            x -= .32; k += 1
        for z in floors:
            bx = back(z)
            p.box(((FRONT + bx) / 2, s * (W + .16), z), (FRONT - bx, .06, .14), 'woodDark')  # battens
    # Open back: one ladder per storey, leaning inside.
    for z0, z1 in zip(floors[:-1], floors[1:]):
        x0 = back(z0) + .55
        for sy in (-1, 1):
            p.beam((x0, sy * .25 + .5, z0 + .1), (x0 + .5, sy * .25 + .5, z1 + .1), .07, .08, 'woodLight')
        zz = z0 + .4
        while zz < z1:
            f = (zz - z0) / (z1 - z0)
            p.box((x0 + .5 * f, .5, zz), (.05, .5, .05), 'wood')
            zz += .35
    # Plank battlements around the top.
    for s in (-1, 1):
        p.box(((FRONT + back1) / 2, s * W, TOP + .45), (FRONT - back1 + .2, .12, .7), 'wood')
    for x, sx in ((FRONT, 1), (back1, -1)):
        if level == 1 and sx == 1:
            continue                                                                    # the bridge closes the front
        p.box((x, 0, TOP + .45), (.12, 2 * W + .2, .7), 'wood')
    for s in (-1, 1):
        for x in [FRONT - .2 - .6 * i for i in range(int((FRONT - back1) / .6) + 1)]:
            p.box((x, s * W, TOP + .95), (.3, .14, .4), 'woodLight')
    for x, sx in ((FRONT, 1), (back1, -1)):
        if level == 1 and sx == 1:
            continue
        for yy in (-1.2, -.4, .4, 1.2):
            p.box((x, yy, TOP + .95), (.14, .3, .4), 'woodLight')
    post(p, (back1, W, PAR), (back1, W, PAR + 1.8), .08, 'woodDark')                 # banner
    p.box((back1 + .45, W, PAR + 1.45), (.8, .04, .55), 'team')
    for x in (FRONT - .5, back0 + .7) + ((back0 / 2 + .5,) if level > 1 else ()):
        p.box((x, 0, .4), (.16, 2 * W + 1.0, .16), 'iron')                              # axles
    parts['frame'] = p.finish()

    # Upgrade: wet hides patched over the front and the sides.
    p = part(root, 'hides', name, off)
    seed = 7
    def rnd():
        nonlocal seed
        seed = (seed * 1103515245 + 12345) & 0x7fffffff
        return seed / 0x7fffffff
    def patch(c, size, axis, key):
        w, h = (size[1], size[2]) if axis == 'x' else (size[0], size[2])
        plate(p, c, w, h, axis, key, (rnd() - .5) * .5)
    z = .9
    while z < DECK - .3:
        y = -W + .3 + rnd() * .2
        while y < W - .25:
            w, h = .8 + rnd() * .4, .85 + rnd() * .45
            patch((FRONT + .19, y, z), (.04, w, h), 'x', HIDE_KEYS[int(rnd() * 4)])
            y += w * .85
        z += .75
    for s in (-1, 1):
        z = .9
        while z < (PAR - .4 if level > 1 else DECK):
            x = FRONT - .3 - rnd() * .2
            while x > back(z) + .3:
                w, h = .8 + rnd() * .4, .85 + rnd() * .45
                patch((x, s * (W + .17), z), (w, .04, h), 'y', HIDE_KEYS[int(rnd() * 4)])
                x -= w * .85
            z += .8
    parts['hides'] = p.finish()

    p = part(root, 'bridge', name, off)
    bx = FRONT + .26
    p.box((bx, 0, DECK + BRIDGE / 2), (.12, 2.0, BRIDGE), 'woodLight')                # planks, raised
    for zz in (DECK + .5, DECK + 1.3, DECK + 2.1):
        p.box((bx + .09, 0, zz), (.07, 2.1, .14), 'wood')                              # battens
    for s in (-1, 1):
        p.box((bx + .09, s * .9, DECK + BRIDGE - .1), (.1, .1, .12), 'iron')           # rope rings
    parts['bridge'] = p.finish()
    pivots['bridge'] = u(bx, 0, DECK)

    p = part(root, 'wheel', name, off)
    wheel(p, .55, half=.12, spokes=8)
    parts['wheel'] = p.finish()
    axles = (FRONT - .5, back0 + .7) + ((back0 / 2 + .5,) if level > 1 else ())
    archers = [u(x, y, TOP + .1) for x in (FRONT - .6, back1 + .5) for y in (-.7, .7)] if level > 1 else []
    meta = {'wheels': {'part': 'wheel', 'r': u(.55)[0], 'at': [u(x, s * (W + .42), .55) for x in axles for s in (-1, 1)]},
            'crew': [u(back0 - .7, y, 0) for y in (-1.0, 0, 1.0)], 'length': u(max(FRONT - back0 + BRIDGE, PAR))[0],
            'level': level, 'upgrades': ['hides'],
            'rig': {'bridgeLen': u(BRIDGE)[0], 'deck': u(DECK + .08)[0], 'walk': u(walk)[0], 'top': u(TOP + .1)[0],
                    'front': u(FRONT)[0], 'archers': archers}}
    return parts, pivots, meta


def build_tower2(root, off):
    return build_tower(root, off, 2)

# ------------------------------------------------------------------ mantlet
def build_mantlet(root, off):
    """Mantlet: a slanted plank shield on two wheels with push handles behind;
    archers shelter behind it and shoot over or round it."""
    parts, pivots = {}, {}
    p = part(root, 'frame', 'mantlet', off)
    bottom, top = Vector((.35, 0, .2)), Vector((-.2, 0, 2.3))
    at = lambda k, y=0: bottom.lerp(top, k) + Vector((0, y, 0))
    W0, W1, WH = MANTLET_WINDOW                                                        # embrasure: k range, half width
    p.taper(at(0), at(W0), 2.6, .12, 2.6, .12, 'wood')                                 # the shield, round
    p.taper(at(W1), at(1), 2.6, .12, 2.6, .12, 'wood')                                 # an embrasure
    for s in (-1, 1):
        p.taper(at(W0, s * (1.3 + WH) / 2), at(W1, s * (1.3 + WH) / 2), 1.3 - WH, .12, 1.3 - WH, .12, 'wood')
    d = (top - bottom).normalized(); n = Vector((d.z, 0, -d.x))                       # front normal (+x)
    for y in (-1.1, -.55, .55, 1.1):
        p.beam(bottom + n * .07 + Vector((0, y, 0)), top + n * .07 + Vector((0, y, 0)), .07, .04, 'woodDark')
    for (k0, k1) in ((0, W0), (W1, 1)):
        p.beam(at(k0) + n * .07, at(k1) + n * .07, .07, .04, 'woodDark')
    for k in (.25, .8):
        c = bottom.lerp(top, k) + n * .1
        p.beam(c + Vector((0, -1.3, 0)), c + Vector((0, 1.3, 0)), .1, .06, 'woodDark')  # cross battens
    for s in (-1, 1):
        c = bottom.lerp(top, .55) + n * .1
        p.beam(c + Vector((0, s * WH, 0)), c + Vector((0, s * 1.3, 0)), .2, .05, 'team')  # coloured band
        c = bottom.lerp(top, (W0 + W1) / 2) + n * .13
        p.box(tuple(c + Vector((0, s * .85, 0))), (.05, .28, .07), 'leather')         # sighting slits
    p.box((.1, 0, .45), (.12, 3.0, .12), 'iron')                                       # axle
    parts['frame'] = p.finish()
    # Shutter closing the embrasure (taken off when the ballista is mounted).
    p = part(root, 'shutter', 'mantlet', off)
    p.taper(at(W0) - n * .08, at(W1) - n * .08, 2 * WH + .1, .08, 2 * WH + .1, .08, 'woodDark')
    p.box(tuple(at((W0 + W1) / 2) - n * .15), (.06, .2, .06), 'iron')
    parts['shutter'] = p.finish()
    # Rear props and push handles (cleared away for the ballista and its crew).
    p = part(root, 'props', 'mantlet', off)
    for s in (-1, 1):
        post(p, (-.1, s * .9, 1.6), (-1.0, s * .9, .35), .1, 'woodDark')               # rear props
        post(p, (.05, s * .55, .75), (-1.45, s * .45, .95), .09, 'wood')               # push handles
    parts['props'] = p.finish()
    p = part(root, 'wheel', 'mantlet', off)
    wheel(p, .45, half=.07, spokes=6)
    parts['wheel'] = p.finish()
    meta = {'wheels': {'part': 'wheel', 'r': u(.45)[0], 'at': [u(.1, s * 1.42, .45) for s in (-1, 1)]},
            'crew': [u(-1.75, .45, 0), u(-1.75, -.45, 0), u(-1.0, 1.05, 0), u(-1.0, -1.05, 0)], 'length': u(3.0)[0],
            'rig': {'ballista': u(MANTLET_BALLISTA_X, 0, 0), 'ballistaCrew': [u(-2.9, .5, 0), u(-2.9, -.5, 0)]}}
    return parts, pivots, meta


# ------------------------------------------------------------------ ballista
# Torsion bolt-thrower on a trestle: two rope skeins in the head, arms drawn back
# by a string hooked on the slider's claw, a winch at the rear. Stands alone, behind
# the mantlet's embrasure (upgrade) or on a roofless tower top. The string is drawn
# in game from the arm tips to the claw.
BALLISTA_Z = 1.3          # stock height above its floor
BALLISTA_CLAW = -1.02     # claw (and bolt nock) when drawn
MANTLET_WINDOW = (.45, .7, .4)
MANTLET_BALLISTA_X = -.8  # the ballista stands behind the shield, its bolt through the embrasure


def build_ballista(root, off):
    parts, pivots = {}, {}
    Z = BALLISTA_Z
    p = part(root, 'stand', 'ballista', off)
    post(p, (-.35, 0, 0), (-.35, 0, Z - .12), .16, 'wood')                             # pivot post
    for a in (math.pi * .25, math.pi, math.pi * 1.75):
        d = Vector((math.cos(a), math.sin(a), 0))
        post(p, (-.35 + d.x * .85, d.y * .85, 0), (-.35, 0, Z * .55), .1, 'woodDark')   # trestle legs
    p.box((-.35, 0, Z - .1), (.34, .34, .1), 'iron')                                   # turntable
    parts['stand'] = p.finish()
    p = part(root, 'stock', 'ballista', off)
    p.box((-.35, 0, Z), (2.5, .26, .14), 'wood')                                       # stock
    for s in (-1, 1):
        p.box((-.4, s * .11, Z + .1), (2.3, .05, .07), 'woodDark')                     # slide rails
        p.box((.55, s * .5, Z), (.22, .1, .74), 'wood')                                # head side posts
        p.cylinder(.09, .3, 'rope', n=8, axis='z', center=(.55, s * .33, Z), cap_key='iron')   # skeins
        p.beam((-1.45, s * .3, Z - .22), (-1.45, s * .3, Z + .26), .05, .05, 'woodDark')     # winch handles
        p.beam((-1.69, s * .3, Z + .02), (-1.21, s * .3, Z + .02), .05, .05, 'woodDark')
    for z in (Z + .33, Z - .33):
        p.box((.55, 0, z), (.22, 1.1, .1), 'woodDark')                                 # head frame
    p.box((.55, 0, Z - .2), (.22, .2, .2), 'iron')
    p.cylinder(.08, .26, 'woodLight', n=8, center=(-1.45, 0, Z + .02), cap_key='woodDark')     # winch drum
    parts['stock'] = p.finish()
    for name, s in (('armL', 1), ('armR', -1)):
        p = part(root, name, 'ballista', off)
        p.taper((.55, s * .33, Z), (.38, s * 1.05, Z), .12, .1, .07, .06, 'woodLight')
        p.box((.38, s * 1.05, Z), (.06, .06, .1), 'iron')
        parts[name] = p.finish()
        pivots[name] = u(.55, s * .33, Z)
    p = part(root, 'slider', 'ballista', off)
    p.box((-.6, 0, Z + .15), (.9, .17, .06), 'woodLight')
    p.box((BALLISTA_CLAW, 0, Z + .2), (.08, .1, .1), 'iron')                            # claw
    parts['slider'] = p.finish()
    p = part(root, 'bolt', 'ballista', off)
    p.beam((BALLISTA_CLAW + .02, 0, Z + .21), (.95, 0, Z + .21), .045, .045, 'woodLight')
    p.taper((.95, 0, Z + .21), (1.18, 0, Z + .21), .09, .09, .01, .01, 'iron')
    for s in (-1, 1):
        p.box((BALLISTA_CLAW + .2, s * .05, Z + .21), (.22, .06, .02), 'team')         # fletching
    parts['bolt'] = p.finish()
    rig = {'z': u(Z)[0], 'claw': u(BALLISTA_CLAW)[0], 'tipL': u(.38, 1.05, Z), 'tipR': u(.38, -1.05, Z),
           'boltZ': u(Z + .21)[0], 'muzzle': u(1.18)[0]}
    meta = {'wheels': {'part': None, 'r': 0, 'at': []},
            'crew': [u(-2.1, .5, 0), u(-2.1, -.5, 0)], 'length': u(3.0)[0], 'rig': rig}
    return parts, pivots, meta


# ------------------------------------------------------------------ ladder
LADDER_LEN = 5.2      # leans on the H1 walk edge with ~1 m to spare


def build_ladder(root, off):
    """Scaling ladder with iron hooks, modelled standing with its foot at the
    origin (pivot); carried flat on the shoulders, raised against the wall."""
    parts, pivots = {}, {}
    L = LADDER_LEN
    p = part(root, 'ladder', 'ladder', off)
    for s in (-1, 1):
        post(p, (0, s * .3, 0), (0, s * .26, L), .1, 'woodLight')                     # rails
        p.beam((0, s * .26, L - .1), (.3, s * .26, L + .05), .05, .05, 'iron')         # hooks
        p.beam((.3, s * .26, L + .05), (.35, s * .26, L - .18), .05, .05, 'iron')
    z = .35
    while z < L - .1:
        w = .3 + (.26 - .3) * z / L
        p.box((0, 0, z), (.06, 2 * w, .06), 'wood')                                   # rungs
        z += .38
    parts['ladder'] = p.finish()
    pivots['ladder'] = u(0, 0, 0)
    meta = {'wheels': {'part': None, 'r': 0, 'at': []},
            'crew': [u(-1.5, .45, 0), u(1.3, -.45, 0)], 'length': u(4.8)[0], 'rig': {'len': u(L)[0]}}
    return parts, pivots, meta

ENGINES = [('ram', build_ram, (0, 0, 0)), ('catapult', build_catapult, (0, 6, 0)), ('trebuchet', build_trebuchet, (0, 13, 0)),
           ('tower', build_tower, (0, 21, 0)), ('tower2', build_tower2, (0, 39, 0)), ('ladder', build_ladder, (0, 27, 0)),
           ('mantlet', build_mantlet, (0, 31, 0)), ('ballista', build_ballista, (0, 35, 0))]


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
