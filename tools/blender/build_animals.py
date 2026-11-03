"""CONQUER 3D animals builder (Blender 5.x).

Every animal is low-poly rigid parts with pivots at the joints (hips, shoulders,
neck base, throat, tail root), so the game drives the same walk / browse / run /
special poses as the 2D animals by turning parts about their pivots. Sizes are
real metres (sheep 0.7 m at the withers ... horse 1.6 m), so no per-species
scale factor is needed in 3D. Colours are *roles* named like the 2D species
palettes (body, head, leg, mane, hoof, ...), resolved in game against that
species' palette and coat, so the approved colours carry over.

Run inside Blender (BlenderMCP execute_code):
    CQ_DIR = r"...\\ASSETS\\blender"; ANIMALS_OUT = r"...\\src\\assets\\animal-models.js"
    exec(open(CQ_DIR + r"\\build_animals.py", encoding="utf-8").read())
Axes: +X forward (nose), +Y left, +Z up; origin on the ground under the barrel.
"""
import json, math, os, sys, importlib
from mathutils import Vector
_here = os.path.dirname(os.path.abspath(__file__)) if '__file__' in globals() else CQ_DIR
if _here not in sys.path:
    sys.path.insert(0, _here)
import cq_blender
importlib.reload(cq_blender)
from cq_blender import Part, fresh_collection, export_part, u

ROLES = ['body', 'shade', 'head', 'leg', 'legFar', 'mane', 'hoof', 'eye', 'ear', 'nose', 'muzzle',
         'horn', 'beard', 'tusk', 'antler', 'tail']
COLL_NAME = 'CONQUER_Animals'
LEGS = ['legHL', 'legHR', 'legFL', 'legFR']

# Display palettes (Blender viewport only) copied from the approved 2D colours.
PALETTES = {
    'sheep': {'body': '#f6f3ec', 'head': '#e7b1ab', 'leg': '#e7b1ab', 'legFar': '#c98f8a', 'eye': '#2b2321'},
    'goat': {'body': '#d8c19a', 'head': '#d8c19a', 'leg': '#d8c19a', 'hoof': '#3a2c20', 'horn': '#4a2f1d',
             'beard': '#b39a72', 'eye': '#2b2321', 'ear': '#c4aa80'},
    'cow': {'body': '#7a5236', 'head': '#7a5236', 'leg': '#7a5236', 'hoof': '#2a1c12', 'ear': '#5f3f29',
            'muzzle': '#a47c5d', 'eye': '#1e140d', 'mane': '#3b2617'},
    'horse': {'body': '#8a5a35', 'legFar': '#6d4628', 'mane': '#2a1a10', 'hoof': '#221812', 'eye': '#120c08',
              'muzzle': '#5e3d24'},
    'deer': {'body': '#a8703f', 'head': '#a8703f', 'leg': '#a8703f', 'hoof': '#2a1d12', 'ear': '#93612f',
             'nose': '#2a1d12', 'eye': '#1a120b', 'tail': '#f1e9dc', 'antler': '#dcc9a3', 'shade': '#cfa676'},
    'wolf': {'body': '#8c8b86', 'head': '#8c8b86', 'leg': '#8c8b86', 'ear': '#6b6a66', 'nose': '#1c1c1b',
             'eye': '#e2b93b', 'tail': '#7d7c77', 'shade': '#c7c3b8'},
    'bear': {'body': '#5b3e27', 'head': '#5b3e27', 'leg': '#5b3e27', 'ear': '#45301d', 'muzzle': '#8a6a4c',
             'nose': '#120c08', 'eye': '#120c08'},
    'boar': {'body': '#9b8a74', 'head': '#9b8a74', 'leg': '#6d6151', 'hoof': '#2a2522', 'ear': '#7d6e5c',
             'nose': '#5b4a42', 'tusk': '#efe8d6', 'mane': '#5a4f42', 'eye': '#1a1a1a', 'tail': '#6d6151'},
}
PALETTES['stag'] = PALETTES['deer']


class Builder:
    """Collects one species' parts, pivots and metadata."""
    def __init__(self, root, species, offset):
        self.root, self.species, self.offset = root, species, offset
        self.parts, self.pivots, self.meta = {}, {}, {}

    def part(self, name):
        return Part(self.root, name, PALETTES[self.species], self.offset, prefix=self.species + '_')

    def done(self, name, p, pivot=None):
        self.parts[name] = p.finish()
        if pivot is not None:
            self.pivots[name] = u(*pivot)

    def barrel(self, cz, radii, along, squash, key='body', cap='body'):
        p = self.part('body')
        p.cylinder(.3, 0, key, n=8, axis='x', center=(0, 0, cz), squash=squash, radii=radii, along=along, cap_key=cap)
        return p

    def legs(self, hind, fore, y, hip_z, fore_z, top, bottom, knee_z, foot, key='leg'):
        """Four legs (thigh/forearm + cannon + foot), each turning about its hip/shoulder.
        top/bottom: (w, h) at the hip and above the foot; foot: (kind, key, height)."""
        kind, foot_key, fh = foot
        for name, x, side, z in (('legHL', hind, 1, hip_z), ('legHR', hind, -1, hip_z),
                                 ('legFL', fore, 1, fore_z), ('legFR', fore, -1, fore_z)):
            p = self.part(name)
            yy = side * y
            knee = (x + (-.04 if name.startswith('legH') else .02), yy, knee_z)
            mid = ((top[0] + bottom[0]) / 2, (top[1] + bottom[1]) / 2)
            p.taper((x, yy, z), knee, top[0], top[1], mid[0], mid[1], key)
            p.taper(knee, (x, yy, fh), mid[0], mid[1], bottom[0], bottom[1], key)
            if kind == 'hoof':
                p.box((x, yy, fh / 2), (bottom[0] * 1.3, bottom[1] * 1.2, fh), foot_key)
            else:   # paw: wider and longer forward
                p.box((x + bottom[0] * .25, yy, fh / 2), (bottom[0] * 1.9, bottom[1] * 1.4, fh), foot_key)
            self.done(name, p, (x, yy, z))
        self.meta['hip'] = u(hind, 0, hip_z)


def eyes(p, x, y, z, key='eye', size=.035):
    for s in (-1, 1):
        p.box((x, s * y, z), (size, .015, size), key)


def ears(p, base, tip, w, key):
    for s in (-1, 1):
        p.taper((base[0], s * base[1], base[2]), (tip[0], s * tip[1], tip[2]), w, w * .6, w * .25, w * .2, key)


# ------------------------------------------------------------------ species
def horse(b):
    p = b.part('body')
    p.cylinder(.3, 0, 'body', n=8, axis='x', center=(0, 0, 1.22), squash=1.12,
               radii=[.14, .29, .34, .34, .31, .2], along=[-1.02, -.86, -.4, .3, .72, .9], cap_key='legFar')
    b.done('body', p)
    for name, x, y, z in (('legHL', -.62, .17, 1.12), ('legHR', -.62, -.17, 1.12), ('legFL', .6, .17, 1.06), ('legFR', .6, -.17, 1.06)):
        p = b.part(name)
        hind = name.startswith('legH')
        knee = (x + (-.06 if hind else .02), y, .6)
        p.taper((x, y, z), knee, .2 if hind else .17, .26 if hind else .2, .11, .11, 'body')
        p.taper(knee, (x, y, .1), .1, .1, .08, .08, 'body')
        p.box((x, y, .05), (.13, .11, .1), 'hoof')
        b.done(name, p, (x, y, z))
    b.meta['hip'] = u(-.62, 0, 1.12)
    p = b.part('neck')
    p.taper((.6, 0, 1.3), (1.25, 0, 2.15), .3, .48, .2, .28, 'body')
    p.taper((.54, 0, 1.62), (1.2, 0, 2.3), .08, .1, .06, .09, 'mane')
    b.done('neck', p, (.74, 0, 1.42))
    p = b.part('head')
    p.taper((1.21, 0, 2.21), (1.65, 0, 1.75), .24, .32, .17, .2, 'body', end_key='muzzle')
    for s in (-1, 1):
        p.taper((1.25, s * .06, 2.27), (1.2, s * .08, 2.45), .06, .05, .015, .015, 'body')
    eyes(p, 1.37, .105, 2.12, size=.045)
    b.done('head', p, (1.27, 0, 2.13))
    p = b.part('tail')
    p.taper((-.98, 0, 1.38), (-1.12, 0, .62), .1, .12, .14, .05, 'mane')
    b.done('tail', p, (-.98, 0, 1.38))
    b.meta.update(center=u(0, 0, 1.22), height=u(2.45)[0], bodyBottom=u(.84)[0])


def sheep(b):
    b.done('body', b.barrel(.62, [.16, .3, .34, .33, .26, .14], [-.6, -.45, -.1, .25, .45, .55], 1.0))
    b.legs(-.34, .32, .13, .5, .5, (.08, .09), (.06, .06), .26, ('hoof', 'legFar', .05))
    p = b.part('neck')
    p.taper((.2, 0, .6), (.66, 0, .88), .2, .26, .15, .19, 'body')           # fleece-covered neck
    b.done('neck', p, (.26, 0, .62))
    p = b.part('head')
    p.taper((.64, 0, .94), (.9, 0, .78), .15, .18, .1, .11, 'head')
    ears(p, (.66, .07, .91), (.7, .2, .88), .06, 'head')
    eyes(p, .76, .07, .9)
    b.done('head', p, (.66, 0, .9))
    p = b.part('tail')
    p.taper((-.56, 0, .7), (-.63, 0, .52), .1, .1, .07, .06, 'body')
    b.done('tail', p, (-.56, 0, .7))
    b.meta.update(center=u(0, 0, .62), height=u(.95)[0], bodyBottom=u(.3)[0])


def goat(b):
    b.done('body', b.barrel(.72, [.12, .24, .27, .27, .22, .12], [-.6, -.45, -.1, .25, .45, .55], 1.15))
    b.legs(-.36, .33, .11, .64, .62, (.08, .1), (.05, .05), .34, ('hoof', 'hoof', .05))
    p = b.part('neck')
    p.taper((.24, 0, .72), (.68, 0, 1.1), .14, .2, .11, .14, 'body')
    b.done('neck', p, (.3, 0, .76))
    p = b.part('head')
    p.taper((.66, 0, 1.15), (.94, 0, .93), .13, .17, .08, .1, 'head')
    p.taper((.88, 0, .95), (.87, 0, .79), .05, .05, .02, .02, 'beard')
    ears(p, (.68, .06, 1.13), (.7, .16, 1.09), .05, 'ear')
    for s in (-1, 1):                                                      # ibex horns sweeping back
        pts = [(.68, s * .04, 1.21), (.62, s * .06, 1.37), (.5, s * .08, 1.45), (.39, s * .08, 1.39), (.35, s * .08, 1.29)]
        ws = [.05, .045, .035, .025, .012]
        for i in range(len(pts) - 1):
            p.taper(pts[i], pts[i + 1], ws[i], ws[i], ws[i + 1], ws[i + 1], 'horn')
    eyes(p, .78, .06, 1.11)
    b.done('head', p, (.68, 0, 1.13))
    p = b.part('tail')
    p.taper((-.56, 0, .82), (-.62, 0, .94), .06, .05, .03, .03, 'body')
    b.done('tail', p, (-.56, 0, .82))
    b.meta.update(center=u(0, 0, .72), height=u(1.4)[0], bodyBottom=u(.41)[0])


def cow(b):
    b.done('body', b.barrel(1.0, [.25, .42, .46, .46, .42, .28], [-1.05, -.85, -.3, .35, .75, .92], 1.05))
    b.legs(-.68, .62, .22, .82, .82, (.18, .22), (.12, .12), .42, ('hoof', 'hoof', .07))
    p = b.part('neck')
    p.taper((.58, 0, .92), (1.18, 0, 1.2), .36, .42, .28, .34, 'body')
    b.done('neck', p, (.62, 0, 1.02))
    p = b.part('head')
    p.taper((1.14, 0, 1.32), (1.52, 0, 1.02), .3, .32, .22, .2, 'head', end_key='muzzle')
    ears(p, (1.18, .13, 1.28), (1.2, .3, 1.26), .08, 'ear')
    eyes(p, 1.31, .14, 1.24)
    b.done('head', p, (1.18, 0, 1.24))
    p = b.part('tail')
    p.taper((-1.0, 0, 1.3), (-1.06, 0, .55), .06, .06, .05, .05, 'body')
    p.box((-1.06, 0, .5), (.08, .08, .14), 'mane')                         # tuft
    b.done('tail', p, (-1.0, 0, 1.3))
    b.meta.update(center=u(0, 0, 1.0), height=u(1.55)[0], bodyBottom=u(.52)[0])


def deer(b, stag=False):
    b.done('body', b.barrel(.95, [.12, .22, .25, .25, .22, .13], [-.65, -.5, -.15, .25, .48, .58], 1.15))
    b.legs(-.4, .38, .1, .88, .86, (.08, .11), (.045, .045), .45, ('hoof', 'hoof', .05))
    p = b.part('neck')
    p.taper((.28, 0, .96), (.76, 0, 1.6), .13, .2, .1, .13, 'body')
    b.done('neck', p, (.34, 0, .98))
    p = b.part('head')
    p.taper((.72, 0, 1.66), (1.06, 0, 1.52), .12, .14, .07, .08, 'head', end_key='nose')
    ears(p, (.76, .05, 1.7), (.74, .17, 1.86), .07, 'ear')
    eyes(p, .86, .06, 1.63)
    if stag:                                                               # branching antlers
        for s in (-1, 1):
            beam = [(.74, s * .05, 1.72), (.68, s * .14, 1.9), (.63, s * .2, 2.08), (.6, s * .22, 2.24)]
            for i in range(len(beam) - 1):
                p.beam(beam[i], beam[i + 1], .03, .03, 'antler')
            for a, t in (((.68, s * .14, 1.9), (.78, s * .16, 2.02)), ((.63, s * .2, 2.08), (.72, s * .22, 2.2)),
                         ((.61, s * .21, 2.18), (.54, s * .28, 2.3))):
                p.beam(a, t, .025, .025, 'antler')
    b.done('head', p, (.74, 0, 1.62))
    p = b.part('tail')
    p.taper((-.6, 0, 1.06), (-.68, 0, 1.12), .08, .06, .05, .04, 'tail')
    b.done('tail', p, (-.6, 0, 1.06))
    b.meta.update(center=u(0, 0, .95), height=u(2.3 if stag else 1.9)[0], bodyBottom=u(.67)[0])


def wolf(b):
    b.done('body', b.barrel(.66, [.13, .19, .21, .23, .21, .12], [-.6, -.48, -.15, .2, .45, .58], 1.2))
    b.legs(-.38, .38, .1, .58, .58, (.08, .1), (.05, .05), .3, ('paw', 'leg', .04))
    p = b.part('neck')
    p.taper((.38, 0, .7), (.6, 0, .9), .2, .26, .16, .2, 'body')
    b.done('neck', p, (.42, 0, .72))
    p = b.part('head')
    p.taper((.56, 0, .96), (.96, 0, .86), .17, .16, .07, .07, 'head', end_key='nose')
    for s in (-1, 1):
        p.taper((.6, s * .05, 1.02), (.58, s * .07, 1.14), .06, .03, .01, .01, 'ear')
    eyes(p, .72, .07, .96)
    b.done('head', p, (.6, 0, .92))
    p = b.part('tail')
    p.taper((-.58, 0, .74), (-.9, 0, .36), .1, .1, .07, .05, 'tail')         # bushy, hanging
    b.done('tail', p, (-.58, 0, .74))
    b.meta.update(center=u(0, 0, .66), height=u(1.2)[0], bodyBottom=u(.4)[0])


def bear(b):
    b.done('body', b.barrel(.82, [.3, .44, .48, .5, .44, .28], [-.8, -.62, -.2, .25, .55, .74], 1.08))
    b.legs(-.5, .48, .2, .68, .7, (.22, .26), (.16, .16), .34, ('paw', 'leg', .06))
    p = b.part('neck')
    p.taper((.5, 0, .98), (.82, 0, 1.0), .36, .4, .3, .34, 'body')
    b.done('neck', p, (.56, 0, .98))
    p = b.part('head')
    p.taper((.78, 0, 1.02), (1.18, 0, .9), .3, .28, .14, .14, 'head', end_key='nose')
    p.taper((1.0, 0, .93), (1.18, 0, .88), .15, .14, .13, .12, 'muzzle')
    for s in (-1, 1):
        p.box((.86, s * .12, 1.16), (.06, .05, .07), 'ear')
    eyes(p, .98, .1, 1.04)
    b.done('head', p, (.82, 0, 1.0))
    p = b.part('tail')
    p.taper((-.78, 0, .95), (-.84, 0, .88), .08, .08, .05, .05, 'body')
    b.done('tail', p, (-.78, 0, .95))
    b.meta.update(center=u(0, 0, .82), height=u(1.3)[0], bodyBottom=u(.31)[0])


def boar(b):
    # Short legs: the barrel rides low and the shoulders sit higher than the rump.
    p = b.barrel(.52, [.14, .26, .3, .33, .32, .2], [-.65, -.5, -.15, .2, .45, .6], 1.18)
    p.taper((-.35, 0, .86), (.45, 0, .91), .05, .06, .05, .06, 'mane')        # bristle crest along the back
    b.done('body', p)
    b.legs(-.4, .36, .13, .4, .42, (.1, .12), (.07, .07), .2, ('hoof', 'hoof', .05))
    p = b.part('neck')
    p.taper((.38, 0, .55), (.62, 0, .6), .3, .38, .24, .3, 'body')
    b.done('neck', p, (.42, 0, .55))
    p = b.part('head')
    p.taper((.58, 0, .66), (.98, 0, .4), .22, .26, .1, .1, 'head', end_key='nose')
    ears(p, (.64, .08, .74), (.6, .14, .86), .07, 'ear')
    for s in (-1, 1):
        p.taper((.86, s * .06, .43), (.9, s * .08, .52), .025, .025, .01, .01, 'tusk')
    eyes(p, .74, .1, .66)
    b.done('head', p, (.62, 0, .6))
    p = b.part('tail')
    p.taper((-.62, 0, .66), (-.7, 0, .52), .03, .03, .02, .02, 'tail')
    b.done('tail', p, (-.62, 0, .66))
    b.meta.update(center=u(0, 0, .52), height=u(.95)[0], bodyBottom=u(.22)[0])


SPECIES = [('sheep', sheep), ('goat', goat), ('cow', cow), ('horse', horse), ('deer', deer),
           ('stag', lambda b: deer(b, stag=True)), ('wolf', wolf), ('bear', bear), ('boar', boar)]


def main(out_path):
    root = fresh_collection(COLL_NAME)
    data = {'roles': ROLES}
    total = 0
    for i, (name, fn) in enumerate(SPECIES):
        b = Builder(root, name, ((i % 5) * 3.2, (i // 5) * 3.5, 0))   # laid out side by side in Blender
        fn(b)
        parts = {n: export_part(p, ROLES) for n, p in b.parts.items()}
        total += sum(len(p['c']) for p in parts.values())
        data[name] = {'parts': parts, 'pivots': b.pivots, 'legs': LEGS, **b.meta}
    js = ("'use strict';\n// Generated by ASSETS/blender/build_animals.py — do not edit by hand.\n"
          "// Animal parts as triangles in model space (U): +x forward, +y left, +z up; colours are palette roles.\n"
          "window.ConquerAnimalModels=" + json.dumps(data, separators=(',', ':')) + ";\n")
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, 'w', encoding='utf-8', newline='\n') as f:
        f.write(js)
    print(f"animal models: {len(SPECIES)} species, {total} triangles, {len(js) // 1024} KB -> {out_path}")
    return total


if __name__ == '__main__' and '--' in sys.argv:
    args = sys.argv[sys.argv.index('--') + 1:]
    main(args[args.index('--out') + 1])
elif 'ANIMALS_OUT' in globals():
    ANIMALS_RESULT = main(ANIMALS_OUT)
