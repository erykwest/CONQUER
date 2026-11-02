"""CONQUER ships builder (Blender 4.x / 5.x).

Five ships in real metres, three small craft and two large ships:
  barca      fishing boat, open hull, one lateen sail, oars and nets
  cargo      coastal cargo boat (knarr-like), high stem and stern posts, square sail, deck cargo
  caravella  small caravel, two lateen sails with the red cross, raised aftercastle
  cocca      cog, one mast with a square sail, striped fore and aft castles with crenellations
  nave       two-masted lateen nave, red wale, latticed castles, crow's nest, shrouds and ratlines

Run headless:
    blender.exe -b --factory-startup --python build_ships.py -- --out <path>\\src\\assets\\ship-models.js

Axes (model local): +X bow, +Y port (left), +Z up; origin on the waterline amidships.
Exported in U (METERS_PER_U) as indexed triangles with a palette index per triangle.
"""
import json, math, os, sys, importlib
from mathutils import Vector
_here = os.path.dirname(os.path.abspath(__file__)) if '__file__' in globals() else CQ_DIR
if _here not in sys.path:
    sys.path.insert(0, _here)
import cq_blender
importlib.reload(cq_blender)
from cq_blender import METERS_PER_U, Part, fresh_collection, export_part, export_part_indexed

COLORS = {
    'oak': '#8f6439', 'oakLight': '#a5774a', 'oakDark': '#5f3f22',
    'tar': '#4b2a20', 'tarLight': '#5e3326', 'tarDark': '#2a1913',
    'deck': '#b18c60', 'deckLight': '#c29d6f', 'wood': '#8b6a45', 'woodDark': '#4a3322',
    'mast': '#9a7448', 'rope': '#3b2a1a', 'iron': '#55595d',
    'sail': '#ece2c8', 'sailShade': '#e2d7bb', 'sailRed': '#b5562e', 'sailRedShade': '#a14a27', 'cross': '#a8262a',
    'red': '#b0332a', 'redDark': '#86241f', 'yellow': '#e3b53b', 'cream': '#e7d3a8',
    'sack': '#c9a46e', 'sackDark': '#a8834f', 'barrel': '#8a5a35', 'crate': '#b98652', 'net': '#6e6a52',
}
COLL_NAME = 'CONQUER_Ships'

SPECS = {
    'barca':     dict(label='Barca da pesca', size='small', L=9.0,  B=3.0, H=1.0, D=.75, rise=.45, posts=.7,
                      hull=('oak', 'oakLight', 'oakDark'), open=True, stern=0.0, bow=0.0),
    'cargo':     dict(label='Barca da carico', size='small', L=12.0, B=3.9, H=1.15, D=.9, rise=1.0, posts=1.3,
                      hull=('oak', 'oakLight', 'oakDark'), open=True, stern=0.0, bow=0.0),
    'caravella': dict(label='Caravella', size='small', L=14.0, B=4.2, H=1.5, D=1.05, rise=.6, posts=.35,
                      hull=('tar', 'tarLight', 'tarDark'), stern=.38, bow=0.0),
    'cocca':     dict(label='Cocca', size='large', L=23.0, B=7.6, H=2.5, D=1.8, rise=.8, posts=.4,
                      hull=('oak', 'oakLight', 'oakDark'), stern=.55, bow=.3),
    'nave':      dict(label='Nave latina', size='large', L=26.0, B=8.0, H=2.8, D=1.9, rise=1.2, posts=.4,
                      hull=('oakLight', 'oak', 'red'), stern=.45, bow=0.0),
}

# ---------------------------------------------------------------- hull
class Hull:
    """Lofted hull: stations stern (t=-1) to bow (t=+1), superelliptic sections."""
    N, K = 26, 9

    def __init__(self, s):
        self.s = s
        self.L, self.B, self.H, self.D = s['L'], s['B'], s['H'], s['D']

    def half(self, t):
        s = self.s
        e = 1.9 if t > 0 else 2.6
        full = s['bow'] if t > 0 else s['stern']
        shape = max(0.0, 1 - abs(t) ** e) ** .55
        return self.B / 2 * max(.02, full + (1 - full) * shape)

    def top(self, t):
        return self.H + self.s['rise'] * t * t

    def draft(self, t):
        return self.D * max(0.0, 1 - abs(t) ** 4) ** .5 + .08

    def point(self, t, k, side=1, inset=0.0):
        th = k / self.K * math.pi / 2
        b, top, d = self.half(t) - inset, self.top(t), self.draft(t)
        c, sn = math.cos(th), math.sin(th)
        y = max(0.0, b) * (c ** .75)
        z = top - (top + d) * (sn ** 1.35)
        return Vector((t * self.L / 2, side * y, z))

    def deck_z(self, t):
        """Deck under the bulwark; open boats have a lower floor boards level instead."""
        if self.s.get('open'):
            return self.top(t) - 1.0 - .25 * (1 - t * t)
        return self.top(t) - (.85 if self.s['size'] == 'small' else 1.1)


def build_hull(part, h, keys):
    hull, light, wale = keys
    N, K = h.N, h.K
    ts = [-1 + 2 * i / N for i in range(N + 1)]
    for i in range(N):
        for k in range(K):
            # Strakes: a dark wale at the top, then alternating planks; a second wale on big ships.
            key = wale if k == 0 or (h.s['size'] == 'large' and k == 2) else (hull if k % 2 else light)
            for side in (1, -1):
                a, b = h.point(ts[i], k, side), h.point(ts[i + 1], k, side)
                c, d = h.point(ts[i + 1], k + 1, side), h.point(ts[i], k + 1, side)
                part.quads([a, b, c, d], [(0, 1, 2, 3)], key)
    # Transom (or a full bow) where the hull is still wide.
    for t in (-1.0, 1.0):
        if h.half(t) > .3:
            ring = [h.point(t, k, 1) for k in range(K + 1)] + [h.point(t, k, -1) for k in range(K, -1, -1)]
            part.quads(ring, [tuple(range(len(ring)))], wale if h.s['size'] == 'large' else hull)
    # Inner bulwark down to the deck, the gunwale cap on top.
    for i in range(N):
        t0, t1 = ts[i], ts[i + 1]
        for side in (1, -1):
            o0, o1 = h.point(t0, 0, side), h.point(t1, 0, side)
            i0 = Vector((o0.x, o0.y * .9, o0.z)); i1 = Vector((o1.x, o1.y * .9, o1.z))
            d0 = Vector((i0.x, i0.y, h.deck_z(t0))); d1 = Vector((i1.x, i1.y, h.deck_z(t1)))
            part.quads([i0, i1, d1, d0], [(0, 1, 2, 3)], light)
            part.quads([o0, o1, i1, i0], [(0, 1, 2, 3)], 'woodDark')
    # Deck planks: strips across the beam, two tones.
    M = 7
    for i in range(N):
        t0, t1 = ts[i], ts[i + 1]
        w0, w1 = h.half(t0) * .9, h.half(t1) * .9
        z0, z1 = h.deck_z(t0), h.deck_z(t1)
        for j in range(M):
            a, b = -1 + 2 * j / M, -1 + 2 * (j + 1) / M
            part.quads([(t0 * h.L / 2, a * w0, z0), (t1 * h.L / 2, a * w1, z1),
                        (t1 * h.L / 2, b * w1, z1), (t0 * h.L / 2, b * w0, z0)], [(0, 1, 2, 3)],
                       'deck' if j % 2 else 'deckLight')
    # Frames showing above the floor of open boats.
    if h.s.get('open'):
        for i in range(2, N - 1, 2):
            t = ts[i]
            for side in (1, -1):
                o = h.point(t, 0, side)
                part.beam((o.x, o.y * .86, h.deck_z(t)), (o.x, o.y * .88, o.z - .05), .09, .09, 'woodDark')
        for t in (-.35, .25):                                                   # thwarts
            w = h.half(t) * .86; z = h.deck_z(t) + .45
            part.box((t * h.L / 2, 0, z), (.35, w * 2, .07), 'wood')
    # Stem and sternpost, curving up past the sheer.
    for sgn in (1, -1):
        t = sgn * 1.0
        base = h.point(t, 0, 1); base.y = 0
        keel = Vector((base.x - sgn * .2, 0, -h.draft(sgn * .9)))
        tip = Vector((base.x + sgn * h.s['posts'] * .45, 0, base.z + h.s['posts']))
        part.beam(keel, base, .22, .22, wale)
        part.beam(base, tip, .2, .2, wale)
    # Keel.
    part.beam((-h.L / 2 + .3, 0, -h.draft(0) - .05), (h.L / 2 - .3, 0, -h.draft(0) - .05), .22, .18, 'woodDark')


def rudder(part, h):
    sp = h.point(-1.0, 0, 1); x = sp.x - .25
    part.beam((x + .1, 0, sp.z + .3), (x - .35, 0, -h.draft(-.9) * .9), .16, .16, 'woodDark')
    part.taper((x - .2, 0, h.top(-1) * .3), (x - .2, 0, -h.draft(-.9) * .85), .1, h.L * .045, .1, h.L * .07, 'wood')


# ---------------------------------------------------------------- rigging
def mast(part, h, x, height, r):
    t = x / (h.L / 2); z0 = h.deck_z(t) - .3
    part.taper((x, 0, z0), (x, 0, z0 + height), r, r, r * .6, r * .6, 'mast')
    part.box((x, 0, h.deck_z(t) + .05), (r * 3, r * 3, .12), 'woodDark')                 # partners
    return Vector((x, 0, z0 + height))


def shrouds(part, h, x, head, n=2, ratlines=False):
    for side in (1, -1):
        feet = []
        for j in range(n):
            fx = x - .4 - j * .7
            t = fx / (h.L / 2)
            g = h.point(t, 0, side)
            foot = Vector((fx, g.y + side * .05, g.z))
            feet.append(foot)
            part.beam(head - Vector((0, 0, .3)), foot, .04, .04, 'rope')
        if ratlines and len(feet) > 1:
            top = head - Vector((0, 0, .3))
            if side == 1:                                                         # crew climb the port shrouds
                h.marks['ratlines'][round(x, 3)] = (feet[0].lerp(feet[-1], .5), top)
            for f in range(1, 9):
                q = f / 10
                a = feet[0].lerp(top, q); b = feet[-1].lerp(top, q)
                part.beam(a, b, .025, .025, 'rope')
    # Stays to the stem and the sternpost.
    for sgn in (1, -1):
        e = h.point(sgn * 1.0, 0, 1); e.y = 0
        part.beam(head - Vector((0, 0, .15)), e + Vector((0, 0, h.s['posts'] * .6)), .04, .04, 'rope')


def sail_grid(sails, P, nu, nv, keyfn):
    """Cloth as explicit triangles in a fixed order: the set and furled builds of one sail
    must match triangle by triangle (they are morph targets)."""
    for i in range(nu):
        for j in range(nv):
            u0, u1, v0, v1 = i / nu, (i + 1) / nu, j / nv, (j + 1) / nv
            sails.quads([P(u0, v0), P(u1, v0), P(u1, v1), P(u0, v1)], [(0, 1, 2), (0, 2, 3)], keyfn(i, j, (u0 + u1) / 2, (v0 + v1) / 2))


# Furled (furl=1): the cloth is gathered up under its yard, nearly flat against it.
FURL_DEPTH = .07


def emblem_patch(h, P, region, cols, rows, axis):
    """Heraldry patch on a sail: a cols x rows vertex grid (row 0 at the top, col 0 at the
    left as seen from port / from ahead) laid on the cloth, set and furled, recorded on the
    hull for export. region(c, r) -> (u, v) sail parameters of grid vertex (c, r)."""
    if h.furl:
        return
    v, f = [], []
    for r in range(rows + 1):
        for c in range(cols + 1):
            u, w = region(c / cols, r / rows)
            v += list(P(u, w, 0)); f += list(P(u, w, 1))
    h.marks['emblems'].append({'cols': cols, 'rows': rows, 'axis': axis, 'v': v, 'f': f})


def flag(h, at, w, hgt):
    """Flag mount: the top of the staff at `at`; the flag flies aft (-x), w long, hgt deep."""
    if not h.furl:
        h.marks['flags'].append({'at': list(at), 'w': w, 'h': hgt})


def lateen(part, sails, h, x, height, yard, furl, belly=.9):
    head = mast(part, h, x, height, .14 if h.s['size'] == 'small' else .3)
    t = x / (h.L / 2); dz = h.deck_z(t)
    lo = Vector((x + yard * .45, 0, dz + height * .25))
    hi = Vector((x - yard * .55, 0, head.z + height * .35))
    part.beam(lo, hi, .14 if h.s['size'] == 'small' else .24, .14 if h.s['size'] == 'small' else .24, 'mast')
    clew = Vector((x - yard * .36, .25, dz + 1.0))
    A, Bv = lo + Vector((0, .18, -.12)), hi + Vector((0, .18, -.12))

    def P(u, v, f=furl):
        vv = v * (1 - f * (1 - FURL_DEPTH))
        p = A.lerp(Bv, u).lerp(clew, vv)
        b = belly * (1 - f * .8)
        return p + Vector((0, b * math.sin(math.pi * u) * math.sin(math.pi * min(1, vv * 1.1)) * (1 - vv * .5) + f * .12, 0))

    # Panels are laid out in the set sail's plane (x along the hull, z up), so cloths hang
    # as vertical strips whatever the triangle shape.
    def key(i, j, u, v):
        return 'sail' if int(math.floor(P(u, v, 0).x / (yard * .07))) % 2 else 'sailShade'
    sail_grid(sails, P, 22, 16, key)
    # Heraldry: an upright 1.6:1 rectangle around the centroid of the set sail, mapped back to
    # sail parameters (u, v) so it follows the belly and gathers up with the cloth.
    c = (A + Bv + clew) / 3
    ew = yard * .3; eh = ew / 1.6

    def uv_at(tx, tz):
        best = min(((i / 40, j / 40) for i in range(41) for j in range(41)),
                   key=lambda q: (P(*q, 0).x - tx) ** 2 + (P(*q, 0).z - tz) ** 2)
        u, w = best
        for _ in range(8):                                                      # Newton on (x, z)
            e = 1e-4; p = P(u, w, 0)
            pu, pw = P(u + e, w, 0), P(u, w + e, 0)
            a, b, cc, d = (pu.x - p.x) / e, (pw.x - p.x) / e, (pu.z - p.z) / e, (pw.z - p.z) / e
            det = a * d - b * cc
            if abs(det) < 1e-9:
                break
            rx, rz = tx - p.x, tz - p.z
            u += (d * rx - b * rz) / det; w += (-cc * rx + a * rz) / det
        return min(1, max(0, u)), min(1, max(0, w))
    emblem_patch(h, P, lambda s, t: uv_at(c.x + ew / 2 - s * ew, c.z + eh / 2 - t * eh), 24, 15, 'y')
    h.marks['rig'].append({'kind': 'lateen', 'x': x, 'head': head, 'deck': dz, 'lo': lo})
    # Halyard from the masthead to the yard.
    part.beam(head, lo.lerp(hi, .55), .04, .04, 'rope')
    return head


def square(part, sails, h, x, height, yard, furl, red=False, belly=1.1):
    head = mast(part, h, x, height, .16 if h.s['size'] == 'small' else .32)
    yz = head.z - .5
    w = yard / 2
    part.beam((x + .2, -w, yz), (x + .2, w, yz), .18, .18, 'mast')
    foot = max(h.deck_z(x / (h.L / 2)) + 1.6, yz - height * .62)
    drop = lambda f: (yz - .1 - foot) * (1 - f * (1 - FURL_DEPTH))

    def P(u, v, f=furl):
        return Vector((x + .3 + belly * (1 - f * .8) * math.sin(math.pi * u) * math.sin(math.pi * v) * (1 - .3 * v),
                       -w + 2 * w * u, yz - .1 - drop(f) * v))
    for s in (1, -1):                                                             # leech lines follow the foot
        sails.beam((x + .2, s * w * .95, yz), (x + .3, s * w * .9, yz - .1 - drop(furl) - .02), .03, .03, 'rope')
    a, b = ('sailRed', 'sailRedShade') if red else ('sail', 'sailShade')
    sail_grid(sails, P, 8, 6, lambda i, j, u, v: a if i % 2 else b)
    # Heraldry over the whole square sail, seen from ahead: col 0 at u=0 (the -y side).
    emblem_patch(h, P, lambda s, t: (.06 + .88 * s, .06 + .88 * t), 24, 15, 'x')
    h.marks['rig'].append({'kind': 'square', 'x': x, 'head': head, 'deck': h.deck_z(x / (h.L / 2)), 'yz': yz, 'w': w})
    return head


def crows_nest(part, head):
    c = head - Vector((0, 0, 1.4))
    part.ring(.75, .62, .35, 'redDark', n=12, axis='z', center=c, side_key='red')
    part.cylinder(.65, .05, 'woodDark', n=12, axis='z', center=c - Vector((0, 0, .35)))


# ---------------------------------------------------------------- castles
def castle(part, h, aft, length, height, style):
    if aft:
        x0, x1 = -h.L / 2 + .2, -h.L / 2 + length
    else:
        x0, x1 = h.L / 2 - length - .4, h.L / 2 - .4
    ts = [x0 / (h.L / 2), x1 / (h.L / 2)]
    b = min(h.half(t) for t in ts + [(ts[0] + ts[1]) / 2]) + .25
    z0 = max(h.top(t) for t in ts) + .05
    xm, lx = (x0 + x1) / 2, x1 - x0
    h.marks['castles'].append((x0, x1))
    # Posts down to the deck, platform, overhanging floor.
    for px in (x0 + .2, x1 - .2):
        for s in (1, -1):
            part.box((px, s * (b - .25), (z0 + h.deck_z(px / (h.L / 2))) / 2), (.25, .25, z0 - h.deck_z(px / (h.L / 2))), 'woodDark')
    part.box((xm, 0, z0), (lx, b * 2, .25), 'woodDark')
    part.box((xm, 0, z0 + .14), (lx - .1, b * 2 - .1, .04), 'deck')
    wall = height * .55
    if style == 'stripes':
        n = max(4, int(lx / .55))
        for i in range(n):
            xa = x0 + i * lx / n
            k = 'red' if i % 2 else 'yellow'
            for s in (1, -1):
                part.box((xa + lx / n / 2, s * b, z0 + .15 + wall / 2), (lx / n, .14, wall), k)
        m = max(3, int(2 * b / .55))
        for xe in (x0, x1):
            for i in range(m):
                ya = -b + i * 2 * b / m
                part.box((xe, ya + b / m, z0 + .15 + wall / 2), (.14, 2 * b / m, wall), 'red' if i % 2 else 'yellow')
        cren = 'yellow'
    else:
        for s in (1, -1):
            part.box((xm, s * b, z0 + .15 + wall / 2), (lx, .14, wall), 'red')
        for xe in (x0, x1):
            part.box((xe, 0, z0 + .15 + wall / 2), (.14, 2 * b, wall), 'red')
        # Lattice band on the overhang below the parapet (as on the lateen nave).
        for s in (1, -1):
            y = s * (b + .09)
            part.box((xm, y, z0 - .15), (lx, .05, .5), 'redDark')
            part.box((xm, y, z0 + .12), (lx, .06, .1), 'cream')
            xx = x0 + .1
            while xx < x1 - .5:
                part.beam((xx, y + s * .03, z0 - .38), (xx + .45, y + s * .03, z0 + .05), .06, .06, 'cream')
                part.beam((xx + .45, y + s * .03, z0 - .38), (xx, y + s * .03, z0 + .05), .06, .06, 'cream')
                xx += .45
        cren = 'cream'
    # Crenellations on the parapet.
    zc = z0 + .15 + wall
    xx = x0
    while xx < x1 - .3:
        for s in (1, -1):
            part.box((xx + .2, s * b, zc + .2), (.4, .16, .4), cren)
        xx += .8
    yy = -b
    while yy < b - .3:
        for xe in (x0, x1):
            part.box((xe, yy + .2, zc + .2), (.16, .4, .4), cren)
        yy += .8
    # Ladder up from the waist.
    lx0 = x1 + .5 if aft else x0 - .5
    zd = h.deck_z(lx0 / (h.L / 2))
    for s in (1, -1):
        part.beam((lx0, s * .4, zd), (lx0 - (.6 if aft else -.6), s * .4, z0 + .1), .08, .08, 'woodDark')
    for k in range(1, 6):
        q = k / 6
        part.box((lx0 - (.6 if aft else -.6) * q, 0, zd + (z0 + .1 - zd) * q), (.12, .8, .05), 'wood')


# ---------------------------------------------------------------- cargo
def barrel(part, c, r=.32):
    part.cylinder(r, 0, 'barrel', n=10, axis='z', center=c, radii=[r * .85, r, r, r * .85], along=[0, r * .9, r * 1.6, r * 2.4], cap_key='wood')
    for z in (r * .35, r * 2.0):
        part.cylinder(r, 0, 'iron', n=10, axis='z', center=c, radii=[r * .97, r * 1.0], along=[z, z + .05])


def sack(part, c, r=.32):
    part.cylinder(r, 0, 'sack', n=8, axis='z', center=c, radii=[r * .9, r * 1.1, r, r * .45, r * .3], along=[0, r * .6, r * 1.3, r * 1.8, r * 2.0], cap_key='sackDark')


def crate(part, c, s=.7):
    part.box((c[0], c[1], c[2] + s / 2), (s, s, s), 'crate')
    for sg in (1, -1):
        part.box((c[0], c[1] + sg * s / 2, c[2] + s / 2), (s + .02, .04, .1), 'woodDark')
        part.box((c[0] + sg * s / 2, c[1], c[2] + s / 2), (.04, s + .02, .1), 'woodDark')


def cargo(part, h, items):
    for kind, fx, fy in items:
        t = fx; x = t * h.L / 2; y = fy * h.half(t) * .8; z = h.deck_z(t)
        {'barrel': barrel, 'sack': sack, 'crate': crate}[kind](part, (x, y, z))


# ---------------------------------------------------------------- ships
class NullPart:
    """Swallows geometry: the furled pass only rebuilds the sails."""
    def __getattr__(self, name):
        return lambda *a, **k: None


CREW = {'barca': 2, 'cargo': 3, 'caravella': 5, 'cocca': 8, 'nave': 10}


def crew_marks(h, key):
    """Where the crew goes: a walk along the waist (between the castles) on the deck, and
    per mast a climb (port shrouds with ratlines, otherwise the mast itself) up to the
    working spots aloft (along a square yard, or at the masthead of a lateen rig)."""
    x0, x1 = -h.L / 2 * .78, h.L / 2 * .78
    for c0, c1 in h.marks['castles']:
        if c1 < 0:
            x0 = max(x0, c1 + .3)
        else:
            x1 = min(x1, c0 - .3)
    deck = []
    for i in range(13):
        x = x0 + (x1 - x0) * i / 12
        deck.append([x, 0, h.deck_z(x / (h.L / 2))])
    masts = []
    for r in h.marks['rig']:
        x, head = r['x'], r['head']
        rl = h.marks['ratlines'].get(round(x, 3))
        if rl:
            foot, top = rl
            foot = foot - Vector((0, .35, 0))                                    # inboard, by the shrouds
            foot.z = h.deck_z(foot.x / (h.L / 2))
            climb = [list(foot), list(rl[0] + Vector((0, 0, .5))), list(top - Vector((0, -.4, .4)))]
        else:
            foot = Vector((x - .45, .25, r['deck']))
            climb = [list(foot), list(Vector((x - .2, .15, r['deck'] + .4))), list(head - Vector((.2, -.15, .9)))]
        if r['kind'] == 'square':
            aloft = [[x - .25, s * r['w'] * q, r['yz'] - .55] for q in (.25, .55) for s in (1, -1)]
        else:
            aloft = [[x - .2, .15, head.z - .9], [x + .15, -.15, head.z - 1.3]]
        masts.append({'x': x, 'climb': climb, 'aloft': aloft})
    return {'n': CREW[key], 'deck': deck, 'half': h.half(0) * .55, 'masts': masts}


def ensign(part, h, deck, staff, w, hgt):
    """Ensign staff raked over the stern, its flag mount at the top."""
    x = -h.L / 2 + .35
    top = Vector((x - staff * .25, 0, deck + staff))
    part.taper((x, 0, deck - .1), top, .1, .1, .06, .06, 'woodDark')
    part.box(tuple(top + Vector((0, 0, .05))), (.12, .12, .1), 'yellow')
    flag(h, top, w, hgt)


def masthead_flag(part, h, head, w, hgt):
    top = head + Vector((0, 0, 1.1))
    part.taper(head, top, .08, .08, .05, .05, 'woodDark')
    flag(h, top, w, hgt)


def build_ship(part, sails, key, s, furl):
    h = Hull(s)
    h.furl, h.marks = furl, {'flags': [], 'emblems': [], 'rig': [], 'ratlines': {}, 'castles': []}
    build_hull(part, h, s['hull'])
    rudder(part, h)
    if key == 'barca':
        head = lateen(part, sails, h, .5, 6.5, 8.0, furl)
        masthead_flag(part, h, head, 1.3, .8)
        for sgn in (1, -1):                                                      # oars along the thwarts
            part.beam((-2.8, sgn * .55, h.deck_z(0) + .55), (2.6, sgn * .7, h.deck_z(0) + .6), .1, .06, 'wood')
            part.box((2.75, sgn * .7, h.deck_z(0) + .6), (.5, .05, .22), 'wood')
        part.cylinder(.55, 0, 'net', n=10, axis='z', center=(-2.2, -.4, h.deck_z(-.5)), radii=[.6, .55, .3], along=[0, .25, .4])
        cargo(part, h, [('barrel', -.62, .35), ('barrel', -.62, -.1)])
    elif key == 'cargo':
        head = square(part, sails, h, .3, 7.5, 6.0, furl, red=True)
        masthead_flag(part, h, head, 1.5, .95)
        cargo(part, h, [('sack', -.55, .4), ('sack', -.5, -.2), ('crate', -.25, .45), ('barrel', -.25, -.4),
                        ('crate', .45, .3), ('sack', .45, -.35), ('barrel', .62, 0), ('sack', -.72, .05)])
    elif key == 'caravella':
        castle(part, h, True, 3.4, 1.6, 'lattice')
        head = lateen(part, sails, h, 1.4, 9.0, 11.0, furl)
        masthead_flag(part, h, head, 1.8, 1.1)
        lateen(part, sails, h, -2.6, 7.0, 8.5, furl)
        ensign(part, h, h.top(-1) + 1.7, 2.2, 1.6, 1.0)
        cargo(part, h, [('barrel', .55, .3), ('crate', .5, -.35)])
    elif key == 'cocca':
        castle(part, h, True, 6.0, 2.4, 'stripes')
        castle(part, h, False, 4.4, 2.2, 'stripes')
        head = square(part, sails, h, .3, 16.0, 13.0, furl)
        shrouds(part, h, .3, head, n=3, ratlines=True)
        masthead_flag(part, h, head, 3.2, 2.0)
        ensign(part, h, h.top(-1) + 2.5, 3.0, 2.6, 1.6)
        cargo(part, h, [('barrel', -.2, .5), ('barrel', -.15, .25), ('crate', .2, -.5), ('sack', .25, .45)])
    elif key == 'nave':
        castle(part, h, True, 7.2, 2.8, 'lattice')
        castle(part, h, False, 4.6, 2.2, 'lattice')
        head = lateen(part, sails, h, 2.4, 19.0, 24.0, furl)
        crows_nest(part, head)
        shrouds(part, h, 2.4, head, n=3, ratlines=True)
        head2 = lateen(part, sails, h, -2.4, 15.5, 19.0, furl)
        shrouds(part, h, -2.4, head2, n=2)
        masthead_flag(part, h, head, 3.4, 2.1)
        masthead_flag(part, h, head2, 2.6, 1.6)
        ensign(part, h, h.top(-1) + 2.9, 3.0, 2.6, 1.6)
        cargo(part, h, [('sack', .0, .5), ('barrel', -.05, -.5), ('crate', .12, .05), ('sack', .1, -.3)])
    return h


def build(root):
    parts = {}
    off = 0.0
    for key, s in SPECS.items():
        p = Part(root, key, COLORS, (0, off, 0))
        sails = Part(root, key + 'Sails', COLORS, (0, off, 0))
        furled = Part(root, key + 'SailsFurled', COLORS, (0, off, 0))
        h = build_ship(p, sails, key, s, 0)
        build_ship(NullPart(), furled, key, s, 1)
        furled.offset.z += 30                                                    # shown apart in the scene
        parts[key] = (p.finish(), sails.finish(recalc=False), furled.finish(recalc=False), h)
        off += s['B'] + 8
    return parts


def export(parts, out_path):
    keys = list(COLORS.keys())
    data = {'unit': 'U', 'metersPerU': METERS_PER_U, 'palette': list(COLORS.values()), 'paletteKeys': keys, 'ships': {}}
    for key, (part, sails, furled, h) in parts.items():
        s = SPECS[key]
        d = export_part_indexed(part, keys)
        # Sails: set (v) and furled (f) positions of the same triangles, morphed by the game.
        so, sf = export_part(sails, keys), export_part(furled, keys)
        assert so['c'] == sf['c'] and len(so['v']) == len(sf['v']), key + ': sail morph targets differ'
        d['sails'] = {'v': so['v'], 'f': sf['v'], 'c': so['c']}
        # Heraldry: flag mounts and the patches on the sails (both in U), coloured by the game.
        U = lambda vals: [round(q / METERS_PER_U, 3) for q in vals]
        d['flags'] = [{'at': U(f['at']), 'w': U([f['w']])[0], 'h': U([f['h']])[0]} for f in h.marks['flags']]
        d['emblems'] = [{'cols': e['cols'], 'rows': e['rows'], 'axis': e['axis'], 'v': U(e['v']), 'f': U(e['f'])}
                        for e in h.marks['emblems']]
        cm = crew_marks(h, key)
        d['crew'] = {'n': cm['n'], 'half': U([cm['half']])[0], 'deck': [U(p) for p in cm['deck']],
                     'masts': [{'x': U([m['x']])[0], 'climb': [U(p) for p in m['climb']], 'aloft': [U(p) for p in m['aloft']]}
                               for m in cm['masts']]}
        d.update({'label': s['label'], 'size': s['size'], 'L': round(s['L'] / METERS_PER_U, 3),
                  'B': round(s['B'] / METERS_PER_U, 3), 'draft': round(s['D'] / METERS_PER_U, 3),
                  'deck': round(h.deck_z(0) / METERS_PER_U, 3)})
        data['ships'][key] = d
    js = ("'use strict';\n// Generated by tools/blender/build_ships.py — do not edit by hand.\n"
          "// Ships as indexed triangles in model space (U): +x bow, +y port, +z up, z=0 waterline.\n"
          "window.ConquerShipModels=" + json.dumps(data, separators=(',', ':')) + ";\n")
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, 'w', encoding='utf-8', newline='\n') as f:
        f.write(js)
    tris = {k: len(v['c']) + len(v['sails']['c']) for k, v in data['ships'].items()}
    print(f"ship models: {tris}, {len(js) // 1024} KB -> {out_path}")
    return tris


def main(out_path):
    root = fresh_collection(COLL_NAME)
    return export(build(root), out_path)


if __name__ == '__main__' and '--' in sys.argv:
    args = sys.argv[sys.argv.index('--') + 1:]
    main(args[args.index('--out') + 1])
elif 'SHIPS_OUT' in globals():
    SHIPS_RESULT = main(SHIPS_OUT)
