"""CONQUER cutaway furniture builder (Blender 4.4+).

Room furniture for the castle cutaway (towers, gates, built sections), in real
metres with the wagon/scatter palette and helpers. Exported as
src/assets/furniture-model.js for src/settlement-cutaway-furniture.js.

    blender.exe -b --factory-startup --python build_furniture.py -- --out <path>

Axes: origin on the floor at the middle of the piece, +X is the FRONT (towards the
room), the back of wall pieces lies on x = -depth/2, +Z up. 'heraldA'/'heraldB' are
placeholders the game replaces with the realm's heraldry colours.
"""
import json, math, os, sys, importlib
from mathutils import Vector, Matrix
_here = os.path.dirname(os.path.abspath(__file__)) if '__file__' in globals() else CQ_DIR
if _here not in sys.path:
    sys.path.insert(0, _here)
import cq_blender, build_wagon, build_scatter
for m in (cq_blender, build_wagon, build_scatter):
    importlib.reload(m)
from cq_blender import METERS_PER_U, Part, fresh_collection
from build_scatter import mark, xform, move, turn_z, crate, barrel, sack, log, bucket, export_indexed

COLORS = dict(build_scatter.COLORS)
COLORS.update({
    'heraldA': '#7f2323', 'heraldB': '#243f79', 'gold': '#d1aa4c', 'goldDark': '#9c7a2c',
    'cloth': '#d9cfb8', 'clothDark': '#a89c84', 'straw': '#d6b551', 'ember': '#e0702a', 'flame': '#ffd27a',
    'soot': '#2b2622', 'stoneWarm': '#a39a8c', 'linen': '#ece4d2', 'candle': '#efe6cf',
})
COLL_NAME = 'CONQUER_Furniture'

# ---------------------------------------------------------------- shared pieces
def legs(p, w, d, h, t=.06, key='woodDark', inset=.05):
    for sx in (-1, 1):
        for sy in (-1, 1):
            p.box((sx * (d / 2 - inset), sy * (w / 2 - inset), h / 2), (t, t, h), key)

def table(p, d, w, h=.76, key='woodLight'):
    p.box((0, 0, h - .03), (d, w, .06), key); legs(p, w, d, h - .06)

def bench(p, w=1.6, d=.32):
    p.box((0, 0, .43), (d, w, .05), 'wood'); legs(p, w, d, .41, inset=.08)

def candle_flame(p, x, y, z, h=.14):
    p.cylinder(.018, 0, 'candle', n=6, axis='z', center=(x, y, z), radii=[.018, .018], along=[0, h])
    p.cylinder(.012, 0, 'flame', n=5, axis='z', center=(x, y, z + h), radii=[.012, .002], along=[0, .05])

def banner(p, h=2.4, w=.7):
    p.cylinder(.03, 0, 'woodDark', n=6, axis='z', radii=[.03, .03], along=[0, h])
    p.box((0, 0, .03), (.36, .36, .06), 'iron')
    p.beam((0, -w / 2 - .05, h - .08), (0, w / 2 + .05, h - .08), .03, .03, 'gold')
    p.quads([(.02, -w / 2, h - .1), (.02, w / 2, h - .1), (.02, w / 2, h - 1.1), (.02, 0, h - 1.35), (.02, -w / 2, h - 1.1)], [(0, 1, 2, 3, 4)], 'heraldA')
    p.box((.025, 0, h - .55), (.01, w * .32, .5), 'heraldB')

def fire(p, x, y, z, r=.16):
    for a in range(3):
        log(p, x, y, z + .05, r * 2.2, .05, axis='x' if a % 2 else 'y', n=5)
    p.cylinder(r, 0, 'ember', n=7, axis='z', center=(x, y, z + .08), radii=[r * .8, r * .4, 0], along=[0, .14, .3])
    p.cylinder(r, 0, 'flame', n=6, axis='z', center=(x, y, z + .1), radii=[r * .45, 0], along=[0, .38])

# ---------------------------------------------------------------- furniture
def f_bench(p): bench(p)
def f_table_long(p): table(p, .8, 2.2)
def f_table_small(p): table(p, .7, .7, .74)
def f_stool(p):
    p.cylinder(.17, 0, 'wood', n=8, axis='z', radii=[.17, .17], along=[.42, .46])
    for i in range(3):
        a = i * 2.094; p.beam((math.cos(a) * .14, math.sin(a) * .14, 0), (math.cos(a) * .08, math.sin(a) * .08, .42), .035, .035, 'woodDark')
def f_chair(p):
    p.box((0, 0, .45), (.44, .44, .05), 'wood'); legs(p, .44, .44, .43, inset=.04)
    p.box((-.2, 0, .8), (.05, .44, .7), 'woodDark')
def f_chest(p):
    p.box((0, 0, .24), (.5, .9, .48), 'wood')
    p.cylinder(.25, .45, 'woodLight', n=8, axis='y', center=(0, 0, .48), radii=None)
    for y in (-.3, .3):
        p.box((0, y, .3), (.52, .05, .6), 'iron')
    p.box((.26, 0, .4), (.03, .1, .1), 'ironLight')
def f_brazier(p):
    for i in range(3):
        a = i * 2.094; p.beam((math.cos(a) * .28, math.sin(a) * .28, 0), (math.cos(a) * .16, math.sin(a) * .16, .7), .04, .04, 'iron')
    p.cylinder(.3, 0, 'iron', n=10, axis='z', radii=[.18, .32], along=[.66, .86], cap_key='soot')
    fire(p, 0, 0, .8, .2)
def f_banner(p): banner(p)
def f_spear_rack(p):
    for y in (-.6, .6):
        p.box((-.05, y, .8), (.08, .08, 1.6), 'woodDark')
    for z in (.3, 1.3):
        p.box((-.05, 0, z), (.08, 1.3, .07), 'wood')
    for i in range(6):
        y = -.5 + i * .2
        p.beam((.05, y, .05), (-.08, y, 2.4), .03, .03, 'woodLight')
        p.taper((-.08, y, 2.4), (-.09, y, 2.62), .06, .02, .005, .005, 'ironLight')
def f_sword_rack(p):
    p.box((0, 0, .5), (.3, 1.2, .08), 'woodDark'); p.box((0, 0, .05), (.4, 1.2, .1), 'woodDark')
    for y in (-.55, .55):
        p.box((0, y, .3), (.3, .07, .6), 'woodDark')
    for i in range(5):
        y = -.4 + i * .2
        p.beam((0, y, .1), (0, y, .95), .045, .012, 'ironLight')
        p.box((0, y, .98), (.06, .2, .025), 'iron'); p.box((0, y, 1.08), (.04, .04, .18), 'leather')
def f_armor_stand(p):
    p.box((0, 0, .04), (.5, .5, .08), 'woodDark'); p.box((0, 0, .85), (.07, .07, 1.6), 'woodDark')
    p.taper((0, 0, .95), (0, 0, 1.5), .5, .3, .62, .36, 'ironLight', end_key='iron')        # cuirass
    p.cylinder(.13, 0, 'iron', n=8, axis='z', center=(0, 0, 1.5), radii=[.13, .14, .1, 0], along=[0, .12, .26, .3])  # helm
    p.taper((0, 0, .7), (0, 0, .95), .46, .26, .5, .3, 'leather')
def f_shield_wall(p):
    p.box((-.03, 0, 1.55), (.06, 1.8, .08), 'woodDark')
    for i, y in enumerate((-.6, 0, .6)):
        p.cylinder(.26, .02, 'heraldA' if i % 2 == 0 else 'heraldB', n=10, axis='x', center=(.04, y, 1.25), cap_key='heraldA' if i % 2 else 'heraldB')
        p.cylinder(.06, .03, 'ironLight', n=6, axis='x', center=(.07, y, 1.25))
def f_arrow_crate(p):
    crate(p, 0, 0, 0, .55)
    for i in range(12):
        y = -.18 + (i % 4) * .12; x = -.12 + (i // 4) * .12
        p.beam((x, y, .4), (x, y, .78), .015, .015, 'woodLight'); p.box((x, y, .78), (.04, .01, .06), 'cloth')
def f_bunk_bed(p):
    for sx in (-1, 1):
        for sy in (-1, 1):
            p.box((sx * .42, sy * .95, .85), (.07, .07, 1.7), 'woodDark')
    for z in (.35, 1.3):
        p.box((0, 0, z), (.9, 2.0, .08), 'wood'); p.box((0, 0, z + .08), (.8, 1.86, .1), 'straw')
        p.box((0, .78, z + .16), (.6, .26, .07), 'linen'); p.box((.05, -.25, z + .15), (.78, 1.0, .03), 'clothDark')
def f_pallet(p):
    p.box((0, 0, .06), (.8, 1.9, .12), 'straw'); p.box((0, .75, .14), (.55, .25, .06), 'linen'); p.box((.02, -.3, .13), (.76, .9, .03), 'clothDark')
def f_wash_basin(p):
    table(p, .45, .45, .7, 'wood'); p.cylinder(.2, 0, 'ironLight', n=10, axis='z', center=(0, 0, .7), radii=[.12, .2], along=[0, .1], cap_key='iron')
def f_grain_bin(p):
    p.box((0, 0, .5), (1.0, 1.6, 1.0), 'wood')
    for y in (-.79, .79):
        p.box((0, y, .5), (1.02, .04, 1.02), 'woodDark')
    p.box((0, 0, .98), (.96, 1.56, .04), 'hay'); p.box((-.3, 0, 1.15), (.06, 1.6, .3), 'woodLight')
def f_scales(p):
    p.box((0, 0, .04), (.4, .4, .08), 'woodDark'); p.box((0, 0, .7), (.06, .06, 1.3), 'woodDark')
    p.beam((0, -.45, 1.32), (0, .45, 1.32), .04, .04, 'iron')
    for y in (-.42, .42):
        p.beam((0, y, 1.3), (0, y, 1.0), .01, .01, 'iron'); p.cylinder(.16, 0, 'ironLight', n=10, axis='z', center=(0, y, .97), radii=[.12, .16], along=[0, .05])
def f_hearth(p):
    p.box((-.35, 0, .9), (.4, 1.6, 1.8), 'stoneWarm'); p.box((0, 0, .1), (.8, 1.5, .2), 'stone')
    p.box((-.2, 0, 1.55), (.5, 1.6, .25), 'stoneDark'); fire(p, .05, 0, .2, .2)
    p.beam((-.1, -.55, 1.3), (-.1, .55, 1.3), .04, .04, 'iron'); p.beam((.05, 0, 1.3), (.05, 0, .82), .015, .015, 'iron')
    p.cylinder(.22, 0, 'soot', n=10, axis='z', center=(.05, 0, .52), radii=[.15, .24, .22], along=[0, .18, .32], cap_key='iron')
def f_shelf(p):
    for y in (-.6, .6):
        p.box((-.15, y, .9), (.3, .05, 1.8), 'woodDark')
    for z in (.4, .9, 1.4):
        p.box((-.15, 0, z), (.3, 1.25, .04), 'wood')
        for i, y in enumerate((-.4, -.15, .15, .4)):
            p.cylinder(.06, 0, 'stoneLight' if i % 2 else 'woodLight', n=6, axis='z', center=(-.15, y, z + .02), radii=[.05, .07, .05], along=[0, .1, .18])
def f_bread_oven(p):
    p.cylinder(.7, 0, 'stoneWarm', n=12, axis='z', radii=[.75, .75, .7, .45, 0], along=[0, .5, .8, 1.15, 1.3])
    p.box((.62, 0, .6), (.2, .5, .4), 'soot'); p.box((.72, 0, .82), (.06, .6, .06), 'stoneDark')
def f_ham_rack(p):
    for y in (-.7, .7):
        p.box((0, y, 1.0), (.08, .08, 2.0), 'woodDark')
    p.box((0, 0, 1.95), (.08, 1.5, .07), 'wood')
    for y in (-.45, -.15, .15, .45):
        p.beam((0, y, 1.92), (0, y, 1.7), .01, .01, 'twine'); p.cylinder(.1, 0, 'leather', n=7, axis='z', center=(0, y, 1.3), radii=[.04, .11, .09, .03], along=[0, .14, .3, .4])
def f_stall(p):
    p.box((0, -.95, .65), (1.9, .08, 1.3), 'wood'); p.box((.9, -.95, .7), (.1, .1, 1.4), 'woodDark'); p.box((-.9, -.95, .7), (.1, .1, 1.4), 'woodDark')
    for z in (.35, .75, 1.15):
        p.box((0, -.95, z), (1.9, .1, .06), 'woodDark')
    p.box((-.75, .2, .7), (.3, 1.3, .4), 'woodDark'); p.box((-.75, .2, .88), (.24, 1.2, .06), 'hay')
def f_manger(p):
    legs(p, 1.6, .5, .6); p.box((0, 0, .75), (.5, 1.6, .3), 'wood'); p.box((0, 0, .9), (.44, 1.54, .06), 'hay')
def f_saddle_stand(p):
    for y in (-.3, .3):
        for s in (-1, 1):
            p.beam((s * .25, y, 0), (0, y, .8), .05, .05, 'woodDark')
    p.beam((0, -.4, .82), (0, .4, .82), .08, .08, 'wood')
    p.cylinder(.22, .28, 'leather', n=8, axis='y', center=(0, 0, .86), squash=.7); p.box((0, 0, .6), (.6, .3, .4), 'heraldA')
def f_canopy_bed(p):
    p.box((0, 0, .3), (2.0, 1.5, .3), 'lacquerDark'); p.box((0, 0, .5), (1.9, 1.42, .14), 'linen')
    p.box((-.85, 0, .62), (.3, 1.3, .12), 'cloth'); p.box((.25, 0, .58), (1.3, 1.44, .06), 'heraldA')
    for sx in (-1, 1):
        for sy in (-1, 1):
            p.box((sx * .95, sy * .72, 1.1), (.08, .08, 2.2), 'lacquerDark')
    p.box((0, 0, 2.2), (2.0, 1.52, .06), 'heraldA'); p.box((-.97, 0, 1.4), (.03, 1.44, 1.5), 'heraldB')
    for sy in (-1, 1):
        p.box((0, sy * .75, 2.05), (2.0, .03, .3), 'heraldA')
def f_rug(p):
    p.box((0, 0, .008), (2.2, 1.5, .016), 'heraldA'); p.box((0, 0, .018), (1.8, 1.1, .006), 'heraldB'); p.box((0, 0, .023), (.6, .4, .004), 'gold')
def f_runner(p):
    p.box((0, 0, .008), (3.2, .9, .016), 'heraldA'); p.box((0, 0, .018), (3.0, .5, .006), 'gold')
def f_fireplace(p):
    p.box((-.3, 0, 1.2), (.5, 1.8, 2.4), 'stoneLight'); p.box((.02, 0, 1.05), (.2, 1.9, .14), 'stone')
    p.box((-.08, 0, .45), (.25, 1.1, .9), 'soot'); fire(p, -.05, 0, .02, .18)
    p.box((.05, 0, 1.2), (.08, .5, .3), 'heraldA')
def f_tapestry(p):
    p.box((-.02, 0, 2.3), (.04, 1.6, .05), 'woodDark'); p.box((0, 0, 1.45), (.02, 1.5, 1.7), 'heraldA')
    p.box((.012, 0, 1.45), (.01, 1.3, 1.5), 'heraldB'); p.box((.02, 0, 1.55), (.01, .5, .6), 'gold')
def f_writing_desk(p):
    table(p, .6, 1.2, .76, 'lacquerDark'); p.box((-.2, 0, .9), (.2, 1.1, .22), 'lacquer')
    p.box((.1, .2, .79), (.3, .4, .02), 'linen'); candle_flame(p, -.15, -.4, .76); p.box((.1, -.25, .8), (.05, .05, .08), 'soot')
def f_forge(p):
    p.box((0, 0, .45), (1.0, 1.0, .9), 'stoneDark'); p.box((0, 0, .91), (.7, .7, .04), 'ember')
    p.taper((0, 0, 1.6), (0, 0, 2.6), 1.0, 1.0, .4, .4, 'stone'); for_ = None
    for sx in (-1, 1):
        p.box((sx * .45, 0, 1.25), (.1, .9, .7), 'stone')
    p.beam((.3, .6, .7), (.6, .9, .55), .3, .12, 'leather')                          # bellows
def f_anvil(p):
    p.cylinder(.22, 0, 'bark', n=8, axis='z', radii=[.25, .22], along=[0, .45], cap_key='logEnd')
    p.box((0, 0, .55), (.2, .45, .2), 'iron'); p.taper((0, .22, .62), (0, .45, .62), .12, .12, .02, .03, 'iron')
def f_tool_rack(p):
    p.box((-.04, 0, 1.2), (.06, 1.4, .9), 'wood')
    for i, y in enumerate((-.5, -.25, 0, .25, .5)):
        p.beam((0, y, 1.5), (0, y, .9), .03, .03, 'woodLight'); p.box((.02, y, .86), (.06, .14 if i % 2 else .06, .1), 'iron')
def f_grindstone(p):
    for y in (-.25, .25):
        p.box((0, y, .4), (.1, .08, .8), 'woodDark')
    p.cylinder(.32, .07, 'stoneLight', n=12, axis='y', center=(0, 0, .55), cap_key='stone'); p.beam((0, -.3, .55), (0, .45, .55), .04, .04, 'iron')
    p.box((.4, 0, .25), (.4, .3, .25), 'wood')
def f_altar(p):
    p.box((0, 0, .5), (.8, 1.8, 1.0), 'stoneLight'); p.box((.05, 0, 1.02), (.85, 1.9, .05), 'linen'); p.box((.43, 0, .7), (.01, .5, .6), 'heraldA')
    p.box((-.2, 0, 1.45), (.06, .06, .8), 'gold'); p.box((-.2, 0, 1.6), (.06, .45, .06), 'gold')
    for y in (-.7, .7):
        p.cylinder(.05, 0, 'gold', n=6, axis='z', center=(0, y, 1.05), radii=[.07, .03, .03], along=[0, .05, .3]); candle_flame(p, 0, y, 1.35, .12)
def f_pew(p):
    bench(p, 1.8, .4); p.box((-.2, 0, .75), (.05, 1.8, .6), 'wood')
    for y in (-.88, .88):
        p.box((0, y, .5), (.42, .05, .9), 'woodDark')
def f_kneeler(p):
    p.box((0, 0, .1), (.3, 1.2, .2), 'heraldA'); p.box((-.25, 0, .5), (.12, 1.2, .9), 'wood'); p.box((-.25, 0, .97), (.25, 1.2, .05), 'woodLight')
def f_lectern(p):
    p.box((0, 0, .04), (.4, .4, .08), 'woodDark'); p.box((0, 0, .6), (.1, .1, 1.1), 'woodDark')
    p.box((0, 0, 1.2), (.4, .5, .05), 'wood', rot=Matrix.Rotation(-.5, 3, 'Y')); p.box((.02, 0, 1.24), (.3, .44, .03), 'linen', rot=Matrix.Rotation(-.5, 3, 'Y'))
def f_candle_stand(p):
    p.box((0, 0, .03), (.36, .36, .06), 'iron'); p.box((0, 0, .7), (.04, .04, 1.3), 'iron')
    p.beam((0, -.25, 1.3), (0, .25, 1.3), .03, .03, 'iron')
    for y in (-.25, 0, .25):
        candle_flame(p, 0, y, 1.33 + (.08 if y == 0 else 0))
def f_torch_wall(p):
    p.box((-.03, 0, 1.75), (.04, .12, .2), 'iron'); p.beam((-.02, 0, 1.68), (.16, 0, 1.92), .04, .04, 'woodDark')
    p.cylinder(.05, 0, 'soot', n=6, axis='z', center=(.17, 0, 1.92), radii=[.035, .05], along=[0, .06])
    p.cylinder(.05, 0, 'flame', n=6, axis='z', center=(.17, 0, 1.98), radii=[.05, .02, 0], along=[0, .1, .22])
def f_throne(p):
    p.box((0, 0, .1), (2.0, 2.4, .2), 'stoneLight'); p.box((.4, 0, .25), (1.2, 2.2, .1), 'stone')
    p.box((-.4, 0, .55), (.7, .9, .1), 'gold'); p.box((-.4, 0, .67), (.6, .8, .1), 'heraldA')
    p.box((-.72, 0, 1.4), (.1, .9, 1.7), 'gold'); p.box((-.66, 0, 1.25), (.04, .7, 1.1), 'heraldA')
    for y in (-.42, .42):
        p.box((-.4, y, .9), (.7, .08, .2), 'goldDark'); p.box((-.05, y, .62), (.08, .08, .5), 'goldDark')
    for y in (-.3, 0, .3):
        p.taper((-.72, y, 2.25), (-.72, y, 2.45), .1, .1, .02, .02, 'gold')
def f_strong_chest(p):
    p.box((0, 0, .3), (.6, 1.0, .6), 'woodDark')
    for y in (-.5, -.15, .15, .5):
        p.box((0, y, .3), (.62, .04, .62), 'iron')
    p.box((.31, 0, .42), (.04, .16, .16), 'ironLight')
def f_coin_sacks(p):
    for x, y, s in ((0, -.2, 1), (.1, .2, .85), (-.2, .05, .9), (.15, 0, .7)):
        sack(p, x, y, 0, 0, lying=False)
    for i in range(6):
        p.cylinder(.05, 0, 'gold', n=8, axis='z', center=(.35, -.3 + i * .1, 0), radii=[.05, .05], along=[0, .02 * (1 + i % 3)])
def f_gold_chest(p):
    p.box((0, 0, .25), (.5, .8, .5), 'lacquerDark')
    p.box((0, 0, .5), (.46, .76, .04), 'gold'); p.box((-.3, 0, .78), (.05, .8, .55), 'lacquerDark', rot=Matrix.Rotation(-.35, 3, 'Y'))
    for i in range(8):
        p.box((-.1 + (i % 3) * .1, -.25 + (i // 3) * .22, .55), (.09, .14, .05), 'gold')
def f_ingot_rack(p):
    p.box((-.05, 0, .55), (.4, 1.1, 1.1), 'woodDark')
    for z in (.25, .6, .95):
        p.box((0, 0, z), (.4, 1.1, .04), 'wood')
        for i in range(5):
            p.taper((0, -.4 + i * .2, z + .02), (0, -.4 + i * .2, z + .09), .12, .2, .09, .16, 'gold')
def f_cell_bars(p):
    p.box((0, 0, 1.4), (.1, 2.4, .1), 'iron'); p.box((0, 0, .03), (.1, 2.4, .06), 'iron')
    for i in range(12):
        p.box((0, -1.1 + i * .2, .7), (.04, .04, 1.4), 'iron')
    p.box((0, .55, .7), (.06, .06, 1.4), 'ironLight')
def f_wall_chains(p):
    for y in (-.35, .35):
        p.box((-.03, y, 1.6), (.04, .14, .14), 'iron')
        for k in range(5):
            p.box((.02, y + (.04 if k % 2 else -.04) * .5, 1.55 - k * .12), (.03, .05, .1), 'ironLight')
        p.box((.04, y, .95), (.06, .14, .07), 'iron')
def f_straw(p):
    p.box((0, 0, .03), (1.4, 1.1, .06), 'straw'); p.box((.25, -.2, .07), (.7, .5, .05), 'strawDark' if 'strawDark' in COLORS else 'straw')
def f_stocks(p):
    for y in (-.6, .6):
        p.box((0, y, .4), (.12, .12, .8), 'woodDark')
    p.box((0, 0, .45), (.1, 1.3, .22), 'wood')
    for y in (-.3, 0, .3):
        p.box((.055, y, .45), (.01, .12, .12), 'soot')

PIECES = (
    ('bench', f_bench), ('tableLong', f_table_long), ('tableSmall', f_table_small), ('stool', f_stool), ('chair', f_chair),
    ('chest', f_chest), ('brazier', f_brazier), ('banner', f_banner),
    ('spearRack', f_spear_rack), ('swordRack', f_sword_rack), ('armorStand', f_armor_stand), ('shieldWall', f_shield_wall), ('arrowCrate', f_arrow_crate),
    ('bunkBed', f_bunk_bed), ('pallet', f_pallet), ('washBasin', f_wash_basin),
    ('grainBin', f_grain_bin), ('scales', f_scales),
    ('hearth', f_hearth), ('shelf', f_shelf), ('breadOven', f_bread_oven), ('hamRack', f_ham_rack),
    ('stall', f_stall), ('manger', f_manger), ('saddleStand', f_saddle_stand),
    ('canopyBed', f_canopy_bed), ('rug', f_rug), ('runner', f_runner), ('fireplace', f_fireplace), ('tapestry', f_tapestry), ('writingDesk', f_writing_desk),
    ('forge', f_forge), ('anvil', f_anvil), ('toolRack', f_tool_rack), ('grindstone', f_grindstone),
    ('altar', f_altar), ('pew', f_pew), ('kneeler', f_kneeler), ('lectern', f_lectern), ('candleStand', f_candle_stand), ('torchWall', f_torch_wall),
    ('throne', f_throne), ('strongChest', f_strong_chest), ('coinSacks', f_coin_sacks), ('goldChest', f_gold_chest), ('ingotRack', f_ingot_rack),
    ('cellBars', f_cell_bars), ('wallChains', f_wall_chains), ('straw', f_straw), ('stocks', f_stocks),
)
# Light sources (local metres): torch and candle flames glow in the night cutaway.
LIGHTS = {'torchWall': [(.17, 0, 2.1, 'torch')], 'brazier': [(0, 0, 1.0, 'fire')], 'hearth': [(.05, 0, .45, 'fire')],
          'fireplace': [(-.05, 0, .3, 'fire')], 'forge': [(0, 0, .95, 'fire')], 'candleStand': [(0, 0, 1.5, 'candle')],
          'altar': [(0, -.7, 1.5, 'candle'), (0, .7, 1.5, 'candle')], 'writingDesk': [(-.15, -.4, .95, 'candle')]}

def build(root):
    parts = {}
    for i, (name, fn) in enumerate(PIECES):
        p = Part(root, name, COLORS, ((i % 8) * 3.5, (i // 8) * 3.5, 0), prefix='fu_')
        fn(p)
        parts[name] = p.finish()
    return parts

def export(parts, out_path):
    keys = list(COLORS.keys())
    data = {'unit': 'U', 'metersPerU': METERS_PER_U, 'palette': list(COLORS.values()), 'paletteKeys': keys, 'pieces': {}}
    total = 0
    for name, part in parts.items():
        e = export_indexed(part, keys)
        xs, ys, zs = e['v'][0::3], e['v'][1::3], e['v'][2::3]
        e['d'] = round(max(xs) - min(xs), 3); e['w'] = round(max(ys) - min(ys), 3); e['h'] = round(max(zs), 3)
        e['back'] = round(min(xs), 3)                       # local x of the back face (wall contact)
        if name in LIGHTS:
            e['lights'] = [[round(x / METERS_PER_U, 3), round(y / METERS_PER_U, 3), round(z / METERS_PER_U, 3), k] for x, y, z, k in LIGHTS[name]]
        data['pieces'][name] = e
        total += len(e['c'])
    js = ("'use strict';\n// Generated by tools/blender/build_furniture.py — do not edit by hand.\n"
          "// Cutaway furniture as indexed triangles in model space (U): +x front, +y left, +z up.\n"
          "window.ConquerFurnitureModel=" + json.dumps(data, separators=(',', ':')) + ";\n")
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, 'w', encoding='utf-8', newline='\n') as f:
        f.write(js)
    print(f"furniture model: {len(parts)} pieces, {total} triangles, {len(js) // 1024} KB -> {out_path}")
    return total

def main(out_path):
    return export(build(fresh_collection(COLL_NAME)), out_path)

if __name__ == '__main__' and '--' in sys.argv:
    args = sys.argv[sys.argv.index('--') + 1:]
    main(args[args.index('--out') + 1])
elif 'FURNITURE_OUT' in globals():
    FURNITURE_RESULT = main(FURNITURE_OUT)
