"""CONQUER modular wagon builder (Blender 5.x).

Builds the wagon as separate, reusable parts in real metres, shows them in the
open scene, and exports a game data module (triangles + base colours + mount
points) for src/settlement-wagons3d.js.

Run inside Blender (BlenderMCP execute_code or the Text editor):
    WAGON_OUT = r"...\\src\\assets\\wagon-model.js"; exec(open(r"...\\build_wagon.py").read())
or headless:
    blender.exe -b --factory-startup --python build_wagon.py -- --out <path>

Axes (model local): +X forward (towards the team), +Y left, +Z up; origin on the
ground under the middle of the bed. Export divides by METERS_PER_U (a 1.75 m
person is ~0.5 U in game).

Shading is NOT baked: the game shades each triangle from its world normal so a
turning wagon keeps the castle's two-tone side rule.
"""
import json, math, os, sys, importlib
from mathutils import Vector
# Shared helpers live next to this file (cq_blender.py). When the file is exec()'d
# through BlenderMCP there is no __file__, so CQ_DIR must be set by the caller.
_here = os.path.dirname(os.path.abspath(__file__)) if '__file__' in globals() else CQ_DIR
if _here not in sys.path:
    sys.path.insert(0, _here)
import cq_blender
importlib.reload(cq_blender)
from cq_blender import METERS_PER_U, Part, fresh_collection, export_part, u

COLORS = {
    'wood': '#9a6a3f', 'woodLight': '#b98652', 'woodDark': '#6f4a2b',
    'iron': '#55595d', 'ironLight': '#7c8186', 'canvas': '#e8dcc0', 'canvasHoop': '#8a6a46',
    'sack': '#c9a46e', 'sackDark': '#a8834f', 'twine': '#7a5a32', 'hay': '#e2c25a',
    'barrel': '#8a5a35', 'stone': '#9a9893', 'stoneDark': '#7f7d78', 'log': '#8b6a45', 'logEnd': '#c9a66f',
    'leather': '#4a3020',
}
COLL_NAME = 'CONQUER_Wagon'

# ---------------------------------------------------------------- parts
def plank_wall(part, x0, x1, y, z0, z1, thick, along='x', keys=('wood', 'woodLight')):
    """Side or end wall made of horizontal planks with alternating tones."""
    n = 2; gap = .02; h = (z1 - z0 - gap * (n - 1)) / n
    for i in range(n):
        za = z0 + i * (h + gap); zc = za + h / 2
        if along == 'x':
            part.box(((x0 + x1) / 2, y, zc), (x1 - x0, thick, h), keys[i % 2])
        else:
            part.box((y, (x0 + x1) / 2, zc), (thick, x1 - x0, h), keys[i % 2])

def bed(part, x0, x1, half_w, floor, wall_top):
    part.box(((x0 + x1) / 2, 0, floor - .04), (x1 - x0, half_w * 2, .08), 'woodDark')          # floor
    for s in (-1, 1):
        plank_wall(part, x0, x1, s * half_w, floor, wall_top, .05)                                # sides
        part.box(((x0 + x1) / 2, s * .45, floor - .13), (x1 - x0 - .1, .1, .1), 'woodDark')      # sills
        for px in (x0 + .04, (x0 + x1) / 2, x1 - .04):                                            # stakes
            part.box((px, s * (half_w + .04), (floor + wall_top) / 2 - .02), (.07, .05, wall_top - floor + .12), 'woodDark')
    for ex in (x0, x1):
        plank_wall(part, -half_w, half_w, ex, floor, wall_top, .05, along='y')                    # ends

def wheel(part, r, half=.045, spokes=8):
    part.ring(r, r - .03, half, 'iron', side_key='ironLight', inner=False)                        # iron tyre
    part.ring(r - .03, r - .1, half * .85, 'wood', side_key='woodDark', outer=False)               # felloe
    part.cylinder(.1, .09, 'woodDark', n=8, cap_key='ironLight')                                   # hub
    for i in range(spokes):
        a = 2 * math.pi * i / spokes
        d = Vector((math.cos(a), 0, math.sin(a)))
        part.beam(d * .09, d * (r - .09), .035, .035, 'woodLight')

def axle(part, x, z, half_track):
    part.box((x, 0, z), (.09, half_track * 2 + .2, .09), 'woodDark')

def build(root):
    parts = {}
    P = lambda name, off=(0, 0, 0): Part(root, name, COLORS, off)

    # --- wagon body: bed, under-frame, front bolster, seat
    p = P('wagonBody')
    bed(p, -1.5, 1.5, .65, .9, 1.28)
    axle(p, -1.0, .6, .85); axle(p, 1.05, .45, .85)
    p.box((1.05, 0, .68), (.22, 1.1, .36), 'woodDark')                                           # front bolster
    p.box((1.32, 0, 1.5), (.36, 1.1, .06), 'woodLight')                                           # seat board
    for s in (-1, 1):
        p.box((1.32, s * .5, 1.38), (.06, .06, .2), 'woodDark')                                   # seat posts
    p.box((1.12, 0, 1.62), (.05, 1.1, .2), 'wood')                                                # backrest
    parts['wagonBody'] = p.finish()

    # --- cart body (two wheels, no seat)
    p = P('cartBody', (0, 4, 0))
    bed(p, -.9, .9, .6, .85, 1.2)
    axle(p, 0, .65, .8)
    parts['cartBody'] = p.finish()

    # --- wheels as templates centred on their axle
    for name, r in (('wheelRear', .6), ('wheelFront', .45), ('wheelCart', .65)):
        p = P(name, (-3, {'wheelRear': 0, 'wheelFront': 1.5, 'wheelCart': 3}[name], 1))
        wheel(p, r)
        parts[name] = p.finish()

    # --- hitches: pole for a pair, shafts for a single horse
    p = P('wagonPole', (0, -4, 0))
    p.beam((1.1, 0, .45), (3.0, 0, .8), .08, .08, 'woodDark')
    p.beam((2.95, -.5, .82), (2.95, .5, .82), .06, .06, 'woodDark')                               # yoke bar
    parts['wagonPole'] = p.finish()
    for name, x0, z0 in (('wagonShafts', 1.1, .5), ('cartShafts', .9, .75)):
        p = P(name, (0, -6 if name == 'wagonShafts' else -8, 0))
        for s in (-1, 1):
            p.beam((x0, s * .35, z0), (x0 + 2.2, s * .3, .95), .06, .06, 'woodDark')
        p.beam((x0 + .1, -.36, z0 + .02), (x0 + .1, .36, z0 + .02), .06, .06, 'woodDark')
        parts[name] = p.finish()

    # --- canvas cover: hoops and an elliptic canvas shell (open ends)
    p = P('cover')
    n = 8; x0, x1 = -1.45, 1.45; base, top, hw = 1.28, 2.35, .68
    arc = [(-hw * math.cos(math.pi * i / n), base + (top - base) * math.sin(math.pi * i / n)) for i in range(n + 1)]
    for i in range(n):
        (y0, z0), (y1, z1) = arc[i], arc[i + 1]
        p.quads([(x0, y0, z0), (x1, y0, z0), (x1, y1, z1), (x0, y1, z1)], [(0, 1, 2, 3)], 'canvas')
    # Hoops: flat bands just proud of the canvas (only their outer face shows).
    for hx in (-1.42, -.47, .47, 1.42):
        for i in range(n):
            (y0, z0), (y1, z1) = arc[i], arc[i + 1]
            k0, k1 = 1.015, 1.015
            p.quads([(hx - .03, y0 * k0, (z0 - base) * k0 + base), (hx + .03, y0 * k0, (z0 - base) * k0 + base),
                     (hx + .03, y1 * k1, (z1 - base) * k1 + base), (hx - .03, y1 * k1, (z1 - base) * k1 + base)], [(0, 1, 2, 3)], 'canvasHoop')
    parts['cover'] = p.finish()

    # --- cargo templates, base centred on the bed floor
    cx = 4.5
    p = P('cargoSack', (cx, 0, 0))
    p.cylinder(.22, 0, 'sack', n=8, axis='z', radii=[.2, .25, .22, .1, .07], along=[0, .14, .32, .44, .5], cap_key='sackDark')
    p.cylinder(.08, 0, 'twine', n=8, axis='z', radii=[.085, .085], along=[.42, .46])
    parts['cargoSack'] = p.finish()
    p = P('cargoCrate', (cx, 1, 0))
    p.box((0, 0, .22), (.5, .5, .44), 'woodLight')
    for s in (-1, 1):
        p.box((0, s * .26, .22), (.52, .03, .07), 'woodDark'); p.box((s * .26, 0, .22), (.03, .52, .07), 'woodDark')
    parts['cargoCrate'] = p.finish()
    p = P('cargoBarrel', (cx, 2, 0))
    p.cylinder(.2, 0, 'barrel', n=8, axis='z', radii=[.18, .23, .23, .18], along=[0, .2, .36, .56], cap_key='woodLight')
    for z in (.08, .48):
        p.cylinder(.2, 0, 'iron', n=8, axis='z', radii=[.235, .24], along=[z, z + .04])
    parts['cargoBarrel'] = p.finish()
    p = P('cargoHay', (cx, 3, 0))
    p.box((0, 0, .2), (.62, .42, .4), 'hay')
    for s in (-1, 1):
        p.box((s * .16, 0, .2), (.04, .44, .42), 'twine')
    parts['cargoHay'] = p.finish()
    p = P('cargoLogs', (cx, 4, 0))
    for (y, z) in ((-.11, .1), (.11, .1), (0, .28)):
        p.cylinder(.1, .5, 'log', n=8, axis='x', center=(0, y, z), cap_key='logEnd')
    parts['cargoLogs'] = p.finish()
    p = P('cargoStone', (cx, 5, 0))
    vs = [(-.24, -.2, 0), (.24, -.2, 0), (.24, .2, 0), (-.24, .2, 0), (-.18, -.15, .3), (.2, -.12, .26), (.16, .16, .32), (-.2, .14, .28)]
    p.quads(vs, [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)], 'stone')
    parts['cargoStone'] = p.finish()
    return parts

# ---------------------------------------------------------------- export
def export(parts, out_path):
    palette = list(COLORS.values()); keys = list(COLORS.keys())
    data = {'unit': 'U', 'metersPerU': METERS_PER_U, 'palette': palette, 'paletteKeys': keys, 'parts': {}}
    for name, part in parts.items():
        data['parts'][name] = export_part(part, keys)   # local coordinates (display offset excluded)
    data['variants'] = {
        'wagon': {
            'body': 'wagonBody', 'cover': 'cover', 'hitch': {'1': 'wagonShafts', '2': 'wagonPole'},
            'wheels': [{'part': 'wheelRear', 'r': u(.6)[0], 'at': [u(-1.0, s * .85, .6) for s in (-1, 1)]},
                       {'part': 'wheelFront', 'r': u(.45)[0], 'at': [u(1.05, s * .85, .45) for s in (-1, 1)]}],
            # Seated driver: figure feet below the seat so only the upper body shows.
            'seat': u(1.32, 0, .62),
            'slots': [u(x, y, .9) for y in (.3, -.3) for x in (-.9, 0, .9)],
            'horses': {'1': [u(3.55, 0)], '2': [u(3.55, .45), u(3.55, -.45)]},
        },
        'cart': {
            'body': 'cartBody', 'cover': None, 'hitch': {'1': 'cartShafts', '2': 'cartShafts'},
            'wheels': [{'part': 'wheelCart', 'r': u(.65)[0], 'at': [u(0, s * .8, .65) for s in (-1, 1)]}],
            'seat': None,
            'slots': [u(x, y, .85) for y in (.28, -.28) for x in (-.45, .45)],
            'horses': {'1': [u(3.45, 0)], '2': [u(3.45, 0)]},
        },
    }
    data['cargo'] = {'sack': 'cargoSack', 'crate': 'cargoCrate', 'barrel': 'cargoBarrel',
                     'hay': 'cargoHay', 'logs': 'cargoLogs', 'stone': 'cargoStone'}
    js = ("'use strict';\n// Generated by ASSETS/blender/build_wagon.py — do not edit by hand.\n"
          "// Wagon parts as triangles in model space (U): +x forward, +y left, +z up.\n"
          "window.ConquerWagonModel=" + json.dumps(data, separators=(',', ':')) + ";\n")
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, 'w', encoding='utf-8', newline='\n') as f:
        f.write(js)
    tris = sum(len(p['c']) for p in data['parts'].values())
    print(f"wagon model: {len(parts)} parts, {tris} triangles, {len(js) // 1024} KB -> {out_path}")
    return tris

def main(out_path):
    root = fresh_collection(COLL_NAME)
    parts = build(root)
    return export(parts, out_path)

if __name__ == '__main__' and '--' in sys.argv:
    args = sys.argv[sys.argv.index('--') + 1:]
    main(args[args.index('--out') + 1])
elif 'WAGON_OUT' in globals():
    WAGON_RESULT = main(WAGON_OUT)
