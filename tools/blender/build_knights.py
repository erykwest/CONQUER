"""CONQUER mounted figures builder (Blender 5.x): horse gear and riders.

Two kits ride the 3D horse of build_animals.py (same axes and pivots: +X nose,
+Y left, +Z up, origin on the ground under the barrel, real metres):
- armoured: heraldic caparison (quartered, gold hem), crinet over the neck,
  steel chanfron and plume, war saddle, bridle; the knight in mail with a
  surcoat in the realm colours, great helm with crest, couched lance with a
  pennon and a kite shield;
- light: riding saddle on a heraldic blanket, saddlebags, bridle; the messenger
  dressed like the foot soldiers (parted tunic, kettle hat), reins in hand, a
  satchel and a message tube.
Every gear part is bound to a horse part (body / neck / head) and follows the
horse's gait in game; rider parts ride the body. Palette keys 'heraldA',
'heraldB' are replaced by the realm livery in game; 'decals' are planar quads
where the game paints the realm's coat of arms (shield, caparison flanks).

Run inside Blender (BlenderMCP execute_code):
    CQ_DIR = r"...\\ASSETS\\blender"; KNIGHTS_OUT = r"...\\src\\assets\\knight-models.js"
    exec(open(CQ_DIR + r"\\build_knights.py", encoding="utf-8").read())
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
    'heraldA': '#b53636', 'heraldB': '#355fb8', 'heraldTrim': '#d2ad4b', 'lining': '#3d3229',
    'steel': '#9aa3aa', 'steelDark': '#5d656c', 'mail': '#7d858b', 'leather': '#6b4a2e', 'leatherDark': '#45301f',
    'wood': '#9b7448', 'iron': '#4c5156', 'dark': '#16181a', 'skin': '#d99a83', 'cloth': '#5c4a36',
    'hatSteel': '#70777c', 'paper': '#e9dfc6',
}
KEYS = list(COLORS.keys())
COLL_NAME = 'CONQUER_Knights'

# Horse barrel (build_animals.horse): centre z, radii along x, vertical squash.
BARREL_Z, SQUASH = 1.22, 1.12
B_ALONG = [-1.02, -.86, -.4, .3, .72, .9]
B_RADII = [.14, .29, .34, .34, .31, .2]


def barrel_r(x):
    if x <= B_ALONG[0]:
        return B_RADII[0]
    for i in range(len(B_ALONG) - 1):
        if x <= B_ALONG[i + 1]:
            k = (x - B_ALONG[i]) / (B_ALONG[i + 1] - B_ALONG[i])
            return B_RADII[i] + (B_RADII[i + 1] - B_RADII[i]) * k
    return B_RADII[-1]


class Kit:
    def __init__(self, root, name, offset):
        self.root, self.name, self.offset = root, name, offset
        self.parts, self.bind = {}, {}

    def part(self, key):
        return Part(self.root, key, COLORS, self.offset, prefix=self.name + '_')

    def done(self, key, p, bind, recalc=True):
        self.parts[key] = p.finish(recalc)
        self.bind[key] = bind


def herald(front, left):
    """Quartered caparison: front-left and rear-right in the first tincture."""
    return 'heraldA' if front == left else 'heraldB'


def cloth_shell(p, xs, hem, top_lift=.03, width_pad=.05, min_w=.24, thick=.03, keyf=None, n_arc=6):
    """Cloth draped over the barrel between xs[0] and xs[-1], hanging to hem on both
    sides: a single outward-wound surface (the part is finished without recalculating
    normals), so the painter never interleaves a lining with the cloth."""
    sections = []
    for x in xs:
        r = barrel_r(x)
        w = max(r, min_w) + width_pad
        top = BARREL_Z + r * SQUASH + top_lift
        pts = [(w, hem), (w, BARREL_Z)]
        for k in range(1, n_arc):
            a = math.pi * k / n_arc
            pts.append((w * math.cos(a), BARREL_Z + (top - BARREL_Z) * math.sin(a)))
        pts += [(-w, BARREL_Z), (-w, hem)]
        sections.append([(x, y, z) for y, z in pts])
    inner = []
    for sec in sections:
        row = []
        for (x, y, z) in sec:
            dy, dz = -y, BARREL_Z - z
            L = math.hypot(dy, dz) or 1
            row.append((x, y + dy / L * thick, z + dz / L * thick))
        inner.append(row)
    m = len(sections[0])
    for i in range(len(xs) - 1):
        xm = (xs[i] + xs[i + 1]) / 2
        for j in range(m - 1):
            ym = (sections[i][j][1] + sections[i][j + 1][1]) / 2
            key = keyf(xm, ym) if keyf else 'heraldA'
            # j runs from the left hem over the back to the right hem: this order faces out.
            p.quads([sections[i][j], sections[i][j + 1], sections[i + 1][j + 1], sections[i + 1][j]], [(0, 1, 2, 3)], key)
    return sections


def hem_trim(p, sections, h=.07, out=.012):
    """Gold band along both hems, just proud of the cloth."""
    for side in (0, len(sections[0]) - 1):
        for i in range(len(sections) - 1):
            a, b = sections[i][side], sections[i + 1][side]
            s = 1 if a[1] > 0 else -1
            vs = [(a[0], a[1] + s * out, a[2]), (b[0], b[1] + s * out, b[2]), (b[0], b[1] + s * out, b[2] + h), (a[0], a[1] + s * out, a[2] + h)]
            p.quads(vs, [(0, 3, 2, 1) if s > 0 else (0, 1, 2, 3)], 'heraldTrim')


def saddle(p, war=True):
    x0, z0 = -.08, 1.6
    p.box((x0, 0, z0 + .03), (.6, .5, .08), 'leather')
    p.box((x0 + .27, 0, z0 + .12), (.1, .34, .2 if war else .12), 'leatherDark')     # pommel
    p.box((x0 - .3, 0, z0 + (.2 if war else .1)), (.08, .44, .34 if war else .16), 'leatherDark')   # cantle
    for s in (-1, 1):
        p.box((x0 + .12, s * .37, 1.28), (.04, .02, .62), 'leatherDark')               # stirrup leathers
        p.box((x0 + .14, s * .39, .96), (.14, .06, .04), 'iron')                         # stirrup tread
        for dx in (-.06, .06):
            p.box((x0 + .14 + dx, s * .39, 1.03), (.02, .04, .14), 'iron')
    p.box((x0 + .1, 0, 1.2), (.08, .74, .05), 'leatherDark')                              # girth (under the cloth)


def bridle(p):
    # Cheek straps, noseband and browband on the head (build_animals.horse head axis).
    for s in (-1, 1):
        p.beam((1.26, s * .125, 2.24), (1.52, s * .1, 1.86), .02, .03, 'leatherDark')
        p.box((1.56, s * .1, 1.83), (.04, .04, .04), 'iron')                              # bit ring
    p.beam((1.47, -.11, 1.95), (1.47, .11, 1.95), .03, .03, 'leatherDark')
    p.beam((1.26, -.13, 2.3), (1.26, .13, 2.3), .03, .03, 'leatherDark')


# ------------------------------------------------------------------ horse gear
def armoured(k):
    p = k.part('caparison')
    xs = [-1.0, -.82, -.55, -.25, .05, .35, .6, .82]
    secs = cloth_shell(p, xs, hem=.6, keyf=lambda x, y: herald(x > -.1, y > 0))
    hem_trim(p, secs)
    k.done('caparison', p, 'body', recalc=False)
    # Chest and rump panels close the drape at both ends (closed boxes: normals recalculated).
    p = k.part('capPanels')
    for x, h0, h1 in ((.86, .62, 1.38), (-1.03, .7, 1.42)):
        w = max(barrel_r(x), .24) + .05
        for s in (-1, 1):
            p.box((x, s * w / 2, (h0 + h1) / 2), (.03, w, h1 - h0), herald(x > 0, s > 0))
        p.box((x + (.012 if x > 0 else -.012), 0, h0 + .035), (.03, 2 * w, .07), 'heraldTrim')
    k.done('capPanels', p, 'body')
    p = k.part('saddle')
    saddle(p, war=True)
    k.done('saddle', p, 'body')
    p = k.part('crinet')
    p.taper((.62, 0, 1.36), (1.2, 0, 2.12), .36, .56, .27, .35, 'heraldA', end_key='heraldTrim')
    p.taper((.58, 0, 1.66), (1.17, 0, 2.3), .1, .12, .07, .1, 'heraldB')                  # crest strip over the mane
    k.done('crinet', p, 'neck')
    p = k.part('chanfron')
    p.taper((1.25, 0, 2.2), (1.56, 0, 1.86), .29, .37, .21, .26, 'steel', end_key='steelDark')
    for s in (-1, 1):
        p.box((1.37, s * .16, 2.12), (.07, .02, .06), 'dark')                             # eye holes
    p.taper((1.24, 0, 2.36), (1.18, 0, 2.62), .06, .06, .1, .1, 'heraldB')                # plume
    p.taper((1.18, 0, 2.62), (1.08, 0, 2.7), .1, .1, .03, .03, 'heraldA')
    bridle(p)
    k.done('chanfron', p, 'head')


def light(k):
    p = k.part('blanket')
    secs = cloth_shell(p, [-.48, -.3, -.1, .1, .26], hem=1.2, top_lift=.015, width_pad=.03, thick=.02,
                       keyf=lambda x, y: 'heraldA' if y > 0 else 'heraldB')
    hem_trim(p, secs, h=.05, out=.008)
    k.done('blanket', p, 'body', recalc=False)
    p = k.part('saddle')
    saddle(p, war=False)
    for s in (-1, 1):   # saddlebags behind the cantle
        p.box((-.55, s * .37, 1.36), (.3, .1, .26), 'leather')
        p.box((-.55, s * .38, 1.46), (.31, .1, .06), 'leatherDark')
    p.beam((.5, -.36, 1.38), (.5, .36, 1.38), .04, .04, 'leatherDark')                    # breast strap
    k.done('saddle', p, 'body')
    p = k.part('bridle')
    bridle(p)
    k.done('bridle', p, 'head')


# ------------------------------------------------------------------ riders (seated on the saddle)
def rider_legs(p, mail=True):
    leg = 'mail' if mail else 'cloth'
    for s in (-1, 1):
        hip, knee, ankle = (-.04, s * .15, 1.7), (.22, s * .36, 1.38), (.14, s * .4, 1.02)
        p.taper(hip, knee, .17, .17, .14, .14, leg)
        p.taper(knee, ankle, .13, .13, .11, .11, leg)
        p.box((.2, s * .41, .97), (.26, .1, .1), 'steelDark' if mail else 'leatherDark')
    p.box((-.06, 0, 1.73), (.3, .34, .16), leg)


def torso_halves(p, z0, z1, w0, w1, d0, d1, left='heraldA', right='heraldB', x=-.05):
    # The two tinctures of the realm, parted per pale (left = the rider's left).
    for s, key in ((1, left), (-1, right)):
        p.taper((x, s * w0 / 4, z0), (x + .03, s * w1 / 4, z1), w0 / 2, d0, w1 / 2, d1, key)


def knight_rider(k):
    p = k.part('body')
    rider_legs(p, mail=True)
    torso_halves(p, 1.76, 2.2, .4, .46, .25, .28)
    for s in (-1, 1):   # surcoat skirt over the thighs
        p.beam((-.06, s * .13, 1.74), (.2, s * .3, 1.5), .2, .12, 'heraldA' if s > 0 else 'heraldB')
    p.box((-.03, 0, 1.8), (.27, .42, .05), 'leatherDark')                                 # belt
    p.beam((-.12, .25, 1.78), (-.46, .3, 1.28), .05, .07, 'leatherDark')                 # scabbard
    p.box((-.02, 0, 2.23), (.2, .22, .08), 'mail')                                        # aventail
    p.cylinder(.13, 0, 'steel', n=8, axis='z', center=(0, 0, 0), radii=[.135, .13, .12], along=[2.26, 2.44, 2.54], cap_key='steelDark')
    p.box((.12, 0, 2.43), (.03, .2, .025), 'dark')                                        # visor slit
    p.box((.12, 0, 2.34), (.03, .02, .1), 'dark')                                         # breaths
    p.taper((0, 0, 2.54), (0, 0, 2.66), .05, .16, .02, .2, 'heraldA')                     # crest
    k.done('body', p, 'body')
    p = k.part('shield')   # shield arm and kite shield
    p.taper((-.02, .25, 2.16), (.08, .32, 1.93), .11, .11, .09, .09, 'mail')
    p.taper((.08, .32, 1.93), (.2, .42, 1.86), .09, .09, .08, .08, 'mail')
    # The shield is on the same part as its arm: they sort triangle by triangle.
    # Kite shield on the left forearm, face to the rider's left (+Y), a little forward.
    outline = [(-.33, .44), (.33, .44), (.35, .05), (.16, -.4), (0, -.68), (-.16, -.4), (-.35, .05)]
    cx, cy, cz, tilt = .12, .5, 1.82, .12
    def S(uu, vv, off):
        return (cx + uu * math.cos(tilt), cy + off + uu * math.sin(tilt) * .2, cz + vv)
    n = len(outline)
    back = [S(uu, vv, -.03) for uu, vv in outline]
    front = [S(uu, vv, 0) for uu, vv in outline]
    vs = back + front
    p.quads(vs, [tuple(range(n - 1, -1, -1))], 'leatherDark')
    # Face parted per pale (fallback when the realm arms are not painted on it).
    mid_top, mid_bot = S(0, .44, 0), S(0, -.68, 0)
    p.quads([front[0], mid_top, mid_bot, front[5], front[6]], [(0, 1, 2, 3, 4)], 'heraldA')
    p.quads([mid_top, front[1], front[2], front[3], mid_bot], [(0, 1, 2, 3, 4)], 'heraldB')
    for i in range(n):
        p.quads([vs[i], vs[(i + 1) % n], vs[n + (i + 1) % n], vs[n + i]], [(0, 1, 2, 3)], 'heraldTrim')
    p.box((cx, cy + .015, cz + .02), (.05, .03, .05), 'heraldTrim')                       # boss
    k.done('shield', p, 'body')
    p = k.part('armR')   # lance arm, couched
    p.taper((-.02, -.25, 2.16), (-.1, -.33, 1.92), .11, .11, .09, .09, 'mail')
    p.taper((-.1, -.33, 1.92), (.2, -.3, 1.86), .09, .09, .08, .08, 'mail')
    k.done('armR', p, 'body')
    p = k.part('lance')
    gx, gy, gz = .2, -.3, 1.86
    yaw = .1   # couched across the horse's neck, towards the left
    tip = (gx + 3.4 * math.cos(yaw), gy + 3.4 * math.sin(yaw), gz + .1)
    butt = (gx - .7 * math.cos(yaw), gy - .7 * math.sin(yaw), gz - .02)
    p.taper(butt, (gx + .25, gy + .025, gz), .06, .06, .09, .09, 'wood')
    p.taper((gx + .25, gy + .025, gz), (gx + .4, gy + .04, gz + .01), .16, .16, .07, .07, 'steelDark')   # vamplate
    p.taper((gx + .4, gy + .04, gz + .01), tip, .07, .07, .035, .035, 'wood')
    tx, ty, tz = tip
    p.taper(tip, (tx + .22, ty + .022, tz + .006), .04, .04, .01, .01, 'steel')
    # Pennon below the head, parted in the realm colours.
    a = (tx - .55, ty - .055, tz - .015)
    b = (tx - .15, ty - .015, tz - .005)
    p.quads([a, b, (b[0] - .05, b[1], b[2] - .2), (a[0], a[1], a[2] - .26)], [(0, 1, 2, 3)], 'heraldA')
    p.quads([(a[0], a[1], a[2] - .26), (b[0] - .05, b[1], b[2] - .2), (b[0] - .3, b[1], b[2] - .42)], [(0, 1, 2)], 'heraldB')
    k.done('lance', p, 'body')
    k.meta = {'grip': u(gx, gy, gz), 'seat': u(-.06, 0, 1.7), 'shieldFace': None}
    # Decal: the shield face (unit square -> o + u*U + v*V), clipped to the outline.
    # Seen from the rider's left, forward (+x) runs to the viewer's left: u goes backwards.
    o, ux, vy = S(.35, .44, .004), S(-.35, .44, .004), S(.35, -.68, .004)
    k.decals = {'shield': {'part': 'shield', 'o': u(*o), 'u': u(*ux), 'v': u(*vy),
                           'clip': [[(.35 - uu) / .7, (.44 - vv) / 1.12] for uu, vv in outline]}}


def messenger_rider(k):
    p = k.part('body')
    rider_legs(p, mail=False)
    torso_halves(p, 1.76, 2.18, .38, .42, .23, .25)
    for s in (-1, 1):
        p.beam((-.06, s * .13, 1.74), (.14, s * .27, 1.56), .18, .1, 'heraldA' if s > 0 else 'heraldB')
    p.box((-.03, 0, 1.8), (.25, .4, .05), 'leatherDark')                                  # belt
    p.beam((-.18, -.2, 2.14), (-.02, .22, 1.8), .05, .03, 'leatherDark')                  # satchel strap
    p.box((-.04, .25, 1.74), (.22, .08, .18), 'leather')                                  # satchel
    p.cylinder(.05, 0, 'leather', n=6, axis='y', center=(-.2, 0, 2.04), radii=[.05, .05], along=[-.2, .2], cap_key='paper')   # message tube
    p.cylinder(.1, 0, 'skin', n=8, axis='z', center=(0, 0, 0), radii=[.07, .105, .1], along=[2.18, 2.26, 2.42], cap_key='skin')
    p.cylinder(.19, 0, 'hatSteel', n=10, axis='z', center=(0, 0, 0), radii=[.2, .19, .12, .05], along=[2.39, 2.42, 2.5, 2.54], cap_key='hatSteel')
    for s in (-1, 1):   # arms forward, hands at the pommel holding the reins
        p.taper((-.02, s * .23, 2.12), (.06, s * .27, 1.9), .1, .1, .08, .08, 'heraldA' if s > 0 else 'heraldB')
        p.taper((.06, s * .27, 1.9), (.28, s * .12, 1.84), .08, .08, .07, .07, 'heraldA' if s > 0 else 'heraldB')
        p.box((.3, s * .11, 1.84), (.06, .05, .06), 'skin')
        p.beam((.32, s * .11, 1.84), (.78, s * .1, 1.78), .015, .015, 'leatherDark')      # reins to the neck
    k.done('body', p, 'body')
    k.meta = {'seat': u(-.06, 0, 1.7)}
    k.decals = {}


def gear_decals(k):
    # The realm arms on both caparison flanks (outer face of the side panels).
    x0, x1, z0, z1 = -.7, .2, .66, 1.26
    w = max(barrel_r(-.24), .24) + .05 + .004
    k.decals = {
        'flankL': {'part': 'caparison', 'o': u(x1, w, z1), 'u': u(x0, w, z1), 'v': u(x1, w, z0), 'clip': None},
        'flankR': {'part': 'caparison', 'o': u(x0, -w, z1), 'u': u(x1, -w, z1), 'v': u(x0, -w, z0), 'clip': None}}


KITS = [('gear_armoured', armoured, (0, 0, 0)), ('gear_light', light, (0, 5, 0)),
        ('rider_knight', knight_rider, (0, 0, 0)), ('rider_messenger', messenger_rider, (0, 5, 0))]


def main(out_path):
    root = fresh_collection(COLL_NAME)
    data = {'palette': list(COLORS.values()), 'paletteKeys': KEYS, 'kits': {}}
    total = 0
    for name, fn, off in KITS:
        k = Kit(root, name, off)
        k.meta, k.decals = {}, {}
        fn(k)
        if name == 'gear_armoured':
            gear_decals(k)
        parts = {pk: {**export_part(p, KEYS), 'bind': k.bind[pk]} for pk, p in k.parts.items()}
        total += sum(len(p['c']) for p in parts.values())
        data['kits'][name] = {'parts': parts, 'meta': k.meta, 'decals': k.decals}
    js = ("'use strict';\n// Generated by ASSETS/blender/build_knights.py — do not edit by hand.\n"
          "// Horse gear and riders in the 3D horse's model space (U): +x nose, +y left, +z up.\n"
          "window.ConquerKnightModels=" + json.dumps(data, separators=(',', ':')) + ";\n")
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, 'w', encoding='utf-8', newline='\n') as f:
        f.write(js)
    print(f"knight kits: {len(KITS)} kits, {total} triangles, {len(js) // 1024} KB -> {out_path}")
    return total


if __name__ == '__main__' and '--' in sys.argv:
    args = sys.argv[sys.argv.index('--') + 1:]
    main(args[args.index('--out') + 1])
elif 'KNIGHTS_OUT' in globals():
    KNIGHTS_RESULT = main(KNIGHTS_OUT)
