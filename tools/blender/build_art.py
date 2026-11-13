"""CONQUER art works builder (Blender 4.4+): graphic archetypes of the ARTE subsystem.

ART-251105-01: paintings, tapestries and sculptures that a room of the castle can display.
These are the reusable *graphic archetypes*; an individual commissioned work (unique id,
owner, location) is game data that points at one of them, never a model of its own.

Same method and axes as the cutaway furniture (build_furniture.py), so the pieces are drawn
by src/settlement-cutaway-furniture.js as 'a:<name>' and listed by the Asset Lab:
real metres, low-poly flat colours, origin on the floor in the middle of the piece, +X the
FRONT (towards the room), the back of wall pieces on the wall plane, +Z up.

Paintings and tapestries are 'painted' with a small pixel grid (one letter per cell, merged
into the fewest rectangles) on a canvas plane, inside a gilt or timber frame / woven border.

    blender.exe -b --factory-startup --python build_art.py -- --out src/assets/art-models.js
"""
import json, math, os, sys, importlib
import bmesh
from mathutils import Vector, Matrix
_here = os.path.dirname(os.path.abspath(__file__)) if '__file__' in globals() else CQ_DIR
if _here not in sys.path:
    sys.path.insert(0, _here)
import cq_blender, build_scatter
for m in (cq_blender, build_scatter):
    importlib.reload(m)
from cq_blender import METERS_PER_U, Part, fresh_collection
from build_scatter import export_indexed

COLORS = {
    # frames and fittings
    'gilt': '#c9a24b', 'giltDark': '#8e6f2a', 'frameWood': '#5a3a22', 'frameWoodDark': '#3e2716',
    'iron': '#55595d', 'cord': '#8a7454',
    # pigments
    'goldLeaf': '#d8b04f', 'goldPale': '#efd786', 'ultramarine': '#2c4a8c', 'azure': '#4f6fae',
    'vermilion': '#b23a2a', 'crimson': '#7a2430', 'flesh': '#e0b48c', 'fleshShade': '#b98a64',
    'umber': '#4a3424', 'umberDark': '#2a211b', 'ink': '#1e1a18', 'lead': '#ece4d2',
    'sky': '#8fb4d0', 'skyPale': '#c9dbe3', 'meadow': '#6f8a4a', 'meadowDark': '#4a6236',
    'forest': '#2f4a2a', 'tower': '#a39a8c', 'roofTile': '#9b4a32', 'river': '#4f7d96',
    'bay': '#6b4a30', 'hide': '#8a5a35', 'verdigris': '#3e6b5a',
    # wool
    'woolGround': '#2f4a35', 'woolLeaf': '#5f7f45', 'woolRed': '#8a2f2a', 'woolBlue': '#2f3f6b',
    'woolCream': '#d9cbaa', 'woolOchre': '#c49a45', 'woolPink': '#c0503c', 'woolWhite': '#e8dfc6',
    'woolSky': '#6a7fb8', 'woolBrown': '#6b4a30',
    # sculpture
    'marble': '#e6e1d6', 'marbleShade': '#c9c2b4', 'limestone': '#c2b59a', 'limestoneShade': '#9f9279',
    'bronze': '#8a6a3a', 'bronzeDark': '#5e4826', 'stonePlinth': '#8d877c', 'stonePlinthDark': '#6f6a62',
    # roles of their own, so that each can be recoloured alone (see SLOTS)
    'robeL': '#b23a2a', 'robeR': '#4a6236', 'nicheBack': '#2c4a8c',
}

# ---------------------------------------------------------------- commissioning colours
# A commissioned work keeps its archetype's shapes and chooses the colours of its slots.
# Each slot recolours one palette key (and its shade key, darkened by the same ratio as the
# defaults); the swatch sets are the suggested pigments, wools, gildings and stones.
SWATCHES = {
    'pigment': {'Oltremare': '#2c4a8c', 'Azzurrite': '#4f6fae', 'Vermiglione': '#b23a2a', 'Lacca cremisi': '#7a2430',
                'Rosa di robbia': '#c0607a', 'Porpora': '#5b3a6b', 'Verderame': '#3e6b5a', 'Terra verde': '#6f8a4a',
                'Ocra gialla': '#c49a45', 'Oro': '#d8b04f', 'Terra d\'ombra': '#4a3424', 'Nero d\'avorio': '#1e1a18',
                'Bianco di piombo': '#ece4d2'},
    'sky': {'Cielo': '#8fb4d0', 'Cielo chiaro': '#c9dbe3', 'Tramonto': '#d9a07a', 'Fondo oro': '#d8b04f', 'Notte': '#2f3f6b'},
    'frame': {'Oro zecchino': '#c9a24b', 'Oro pallido': '#e0c46a', 'Argento': '#b8bcc0', 'Noce': '#5a3a22',
              'Rovere': '#8a6a45', 'Ebano': '#2a2220', 'Lacca rossa': '#7a2a22', 'Lacca verde': '#2f4a3a'},
    'wool': {'Verde bosco': '#2f4a35', 'Verde foglia': '#5f7f45', 'Rosso robbia': '#8a2f2a', 'Blu guado': '#2f3f6b',
             'Azzurro': '#6a7fb8', 'Crema': '#d9cbaa', 'Bianco': '#e8dfc6', 'Ocra': '#c49a45', 'Rosa': '#c0503c',
             'Bruno': '#6b4a30', 'Viola': '#4f3560', 'Nero': '#2a2420'},
    'sculpture': {'Marmo bianco': '#e6e1d6', 'Marmo rosa': '#d9b8a8', 'Marmo nero': '#3a3634', 'Pietra calcarea': '#c2b59a',
                  'Arenaria': '#b9895e', 'Bronzo': '#8a6a3a', 'Bronzo dorato': '#c9a24b', 'Bronzo patinato': '#5f8a76'},
    'plinth': {'Pietra grigia': '#8d877c', 'Pietra scura': '#5a5550', 'Porfido': '#6e2e2a', 'Serpentino': '#3f5a48', 'Marmo': '#d8d2c6'},
}
# (id, label, palette key, shade key or None, swatch set)
FRAME_GILT = ('frame', 'Cornice', 'gilt', 'giltDark', 'frame')
FRAME_WOOD = ('frame', 'Cornice', 'frameWood', 'frameWoodDark', 'frame')
FILLET = ('fillet', 'Filetto della cornice', 'gilt', None, 'frame')
ICON_SLOTS = [('ground', 'Fondo', 'goldLeaf', None, 'pigment'), ('halo', 'Aureole', 'goldPale', None, 'pigment'),
              ('mantle', 'Manto', 'ultramarine', None, 'pigment'), ('robe', 'Veste', 'vermilion', None, 'pigment'), FRAME_GILT]
SLOTS = {
    'icon': ICON_SLOTS,
    'triptych': ICON_SLOTS + [('robeLeft', 'Veste del santo a sinistra', 'robeL', None, 'pigment'),
                              ('robeRight', 'Veste del santo a destra', 'robeR', None, 'pigment')],
    'portrait': [('ground', 'Fondo', 'umberDark', None, 'pigment'), ('hat', 'Copricapo', 'ink', None, 'pigment'),
                 ('robe', 'Veste', 'crimson', None, 'pigment'), FRAME_WOOD, FILLET],
    'landscape': [('sky', 'Cielo', 'sky', None, 'sky'), ('clouds', 'Nuvole', 'skyPale', None, 'sky'),
                  ('meadow', 'Prati', 'meadow', 'meadowDark', 'pigment'), ('water', 'Acque', 'river', None, 'pigment'),
                  ('roofs', 'Tetti', 'roofTile', None, 'pigment'), FRAME_GILT],
    'hunt': [('sky', 'Cielo', 'skyPale', None, 'sky'), ('wood', 'Bosco', 'forest', None, 'pigment'),
             ('meadow', 'Prato', 'meadow', None, 'pigment'), ('rider', 'Cavaliere', 'vermilion', None, 'pigment'), FRAME_WOOD, FILLET],
    'millefleurs': [('ground', 'Fondo', 'woolGround', None, 'wool'), ('leaves', 'Fogliame', 'woolLeaf', None, 'wool'),
                    ('flowers', 'Fiori', 'woolPink', None, 'wool'), ('border', 'Bordura', 'woolRed', None, 'wool')],
    'frieze': [('ground', 'Fondo', 'woolCream', None, 'wool'), ('figures', 'Figure e motivi', 'woolRed', None, 'wool'),
               ('horses', 'Cavalli e scafo', 'woolBrown', None, 'wool'), ('border', 'Bordura', 'woolBlue', None, 'wool')],
    'bust': [('material', 'Materiale', 'marble', 'marbleShade', 'sculpture')],
    'saint': [('ground', 'Fondo della nicchia', 'nicheBack', None, 'pigment'), ('mantle', 'Manto', 'ultramarine', None, 'pigment'),
              ('robe', 'Veste', 'vermilion', None, 'pigment'), ('gilding', 'Dorature', 'gilt', 'giltDark', 'frame'),
              ('corbel', 'Mensola', 'frameWood', 'frameWoodDark', 'frame')],
}
PLINTH = ('plinth', 'Basamento', 'stonePlinth', 'stonePlinthDark', 'plinth')


def statue_slots(body, shade):
    return [('material', 'Materiale', body, shade, 'sculpture'), PLINTH]


def lum(h):
    return sum(int(h[i:i + 2], 16) for i in (1, 3, 5)) / 765


def export_slots(slots):
    out = []
    for sid, label, key, shade, swatch in slots:
        e = {'id': sid, 'label': label, 'key': key, 'default': COLORS[key], 'swatches': swatch}
        if shade:
            e['shade'] = shade
            e['k'] = round(max(0, min(.7, 1 - lum(COLORS[shade]) / max(.01, lum(COLORS[key])))), 3)
        out.append(e)
    return out
KEYS = list(COLORS.keys())
COLL_NAME = 'CONQUER_Art'

# ---------------------------------------------------------------- pixel canvases
# One letter = one cell; rows top to bottom, columns left to right as seen from the room.
ICON = ('GGGGGGGGGGGG', 'GGGGggggGGGG', 'GGGggUUUggGG', 'GGGgUFFFUgGG', 'GGGgUFfFUgGG', 'GGGGBUFUBGGG',
        'GGGBBBBBBBGG', 'GGBBgggBBBBG', 'GBBgFFFgRBBG', 'GBBBFfFRRBBG', 'GBBBRRRRRBBG', 'GBBBBRRRBBBG',
        'GBBBBBBBBBBG', 'GBBBBBBBBBBG', 'GGBBBBBBBBGG', 'GGGGGGGGGGGG')
ICON_KEYS = {'G': 'goldLeaf', 'g': 'goldPale', 'U': 'umber', 'F': 'flesh', 'f': 'fleshShade', 'B': 'ultramarine', 'R': 'vermilion'}
WING = ('GGGGGG', 'GGggGG', 'GgUUgG', 'GgFFgG', 'GGFfGG', 'GSSSSG', 'GSWSSG', 'GSSSSG', 'GSSSSG', 'GSSSSG',
        'GSSSSG', 'GSSSSG', 'GSSSSG', 'GSSSSG', 'GGUUGG', 'GGGGGG')
PORTRAIT = ('DDDDDDDDDD', 'DDDKKKKDDD', 'DDKKKKKKDD', 'DDDUFFFDDD', 'DDDFFfFDDD', 'DDDFFFFDDD', 'DDDDfFfDDD',
            'DDDDFFDDDD', 'DDRRWWRRDD', 'DRRRWWRRRD', 'RRRRRRRRRR', 'RRRRRRRRRR', 'RRRRRRRRRR')
PORTRAIT_KEYS = {'D': 'umberDark', 'K': 'ink', 'U': 'umber', 'F': 'flesh', 'f': 'fleshShade', 'R': 'crimson', 'W': 'lead'}
LANDSCAPE = ('SSSSSSSSSSSSSSSS', 'SSsssSSSSSSSssSS', 'SSSSSSSSSCSCSSSS', 'SSSSSSSSSCCCSSSS', 'SSSSHHHSSCrCHSSS',
             'SSHHHHHHHCCCHHHS', 'HHHHhhHHHHHHHhhH', 'hhTThhhAAAhhTTTh', 'TTTThhAAAAAhhTTT', 'hhhhhAAAAAAAhhhh')
LANDSCAPE_KEYS = {'S': 'sky', 's': 'skyPale', 'H': 'meadow', 'h': 'meadowDark', 'C': 'tower', 'r': 'roofTile', 'A': 'river', 'T': 'forest'}
HUNT = ('SSSSSSSSSSSSSSSS', 'TTSSTTTSSSSTTTSS', 'TTTTTTTTTTTTTTTT', 'TTTHHHTTTTTHHTTT', 'HHHHHRHHHHHHNHNH',
        'HHHHRRHHHHHHNNNH', 'HHMMMMMHHHHNNNNH', 'HHMHHHMHWHWHNHNH', 'HHHHHHHHWWWHHHHH', 'HHHHHHHHHHHHHHHH')
HUNT_KEYS = {'S': 'skyPale', 'T': 'forest', 'H': 'meadow', 'R': 'vermilion', 'M': 'bay', 'N': 'hide', 'W': 'lead'}
MILLEFLEURS = ('VrVVwVVVyVVbVV', 'VVVyVVbVVVrVVw', 'wVVVVhhhhVVVVV', 'VVbVhhhhhhVwVV', 'VVVVVhhhhVVVVr', 'VrVVVVUUVVVyVV',
               'VVVWVVUUVVWVVV', 'VVWWWWUUWWWWVV', 'VbWVWVUUVWVWbV', 'VVVVVVUUVVVVVV', 'VyVVrVVVVwVVyV', 'VVwVVVbVVVVrVV')
MILLEFLEURS_KEYS = {'V': 'woolGround', 'h': 'woolLeaf', 'U': 'woolBrown', 'W': 'woolWhite', 'r': 'woolPink',
                    'w': 'woolWhite', 'y': 'woolOchre', 'b': 'woolSky'}
FRIEZE = ('bcbcbcbcbcbcbcbcbc', 'cccccccccccccccccc', 'ccFccccFccccccRccc', 'cBBBccRRRcccccRRcc', 'cMMMMcMMMMccRRRRRc',
          'cMccMcMccMcUUUUUUU', 'ccccccccccAAUUUUUA', 'bcbcbcbcbcbcbcbcbc')
FRIEZE_KEYS = {'b': 'woolRed', 'c': 'woolCream', 'F': 'flesh', 'B': 'woolBlue', 'R': 'woolRed', 'M': 'woolBrown',
               'U': 'woolBrown', 'A': 'woolSky'}


def grid_rects(grid):
    """Cells -> the fewest rectangles: runs along each row, stacked while identical."""
    rects, open_ = [], {}
    for r, row in enumerate(grid):
        runs, c = [], 0
        while c < len(row):
            c1 = c
            while c1 + 1 < len(row) and row[c1 + 1] == row[c]:
                c1 += 1
            runs.append((c, c1 + 1, row[c])); c = c1 + 1
        nxt = {}
        for run in runs:
            if run in open_:
                rects[open_[run]][3] = r + 1; nxt[run] = open_[run]
            else:
                rects.append([run[0], run[1], r, r + 1, run[2]]); nxt[run] = len(rects) - 1
        open_ = nxt
    return rects


def facing(p, start, direction):
    """Faces created since `start` must look towards `direction` (fixed after the normal recalc)."""
    p.facing.append((start, len(p.bm.faces), tuple(direction)))


def canvas(p, grid, legend, x, w, h, zc, yc=0.0, xf=None, normal=(1, 0, 0)):
    """Paint the grid on the plane x, w wide (y) and h high (z), centred on (yc, zc).
    xf optionally maps each local point (x, y, z) (e.g. a hinged triptych wing)."""
    rows, cols = len(grid), len(grid[0])
    cw, ch = w / cols, h / rows
    y0, z1 = yc - w / 2, zc + h / 2
    start = len(p.bm.faces)
    for c0, c1, r0, r1, k in grid_rects(grid):
        ya, yb, za, zb = y0 + c0 * cw, y0 + c1 * cw, z1 - r1 * ch, z1 - r0 * ch
        pts = [(x, ya, za), (x, yb, za), (x, yb, zb), (x, ya, zb)]
        if xf:
            pts = [xf(q) for q in pts]
        p.quads(pts, [(0, 1, 2, 3)], legend[k])
    facing(p, start, normal)


def frame(p, w, h, zc, fw, key='gilt', inner='giltDark', depth=.05, yc=0.0):
    """Backboard and four mouldings around a w x h canvas centred at (yc, zc); back on x = 0."""
    p.box((.01, yc, zc), (.02, w + fw, h + fw), 'frameWoodDark')
    for s in (-1, 1):
        p.box((depth / 2, yc + s * (w / 2 + fw / 2), zc), (depth, fw, h + 2 * fw), key)
        p.box((depth / 2, yc, zc + s * (h / 2 + fw / 2)), (depth, w, fw), key)
        p.box((depth * .7, yc + s * (w / 2 + .006), zc), (.012, .012, h), inner)
        p.box((depth * .7, yc, zc + s * (h / 2 + .006)), (.012, w, .012), inner)


def hanging(p, w, top, yc=0.0):
    """Picture cord from the two top corners of the frame to an iron nail above."""
    nail = (.02, yc, top + .22)
    for s in (-1, 1):
        p.beam((.012, yc + s * w * .35, top - .03), nail, .008, .008, 'cord')
    p.box(nail, (.04, .02, .02), 'iron')


def painting(p, grid, legend, w, h, zc, fw, frame_key='gilt', inner='giltDark'):
    frame(p, w, h, zc, fw, frame_key, inner)
    canvas(p, grid, legend, .024, w, h, zc)
    hanging(p, w + 2 * fw, zc + h / 2 + fw)


# ---------------------------------------------------------------- paintings
def icon(scale):
    def f(p):
        w, h = .5 * scale, .66 * scale
        painting(p, ICON, ICON_KEYS, w, h, 1.6 + .15 * (scale - 1), .05 * scale)
    return f


def triptych(scale):
    """Gilt altarpiece: the central panel and two hinged wings opened towards the room."""
    def f(p):
        w, h, ww, fw = .5 * scale, .66 * scale, .25 * scale, .045 * scale
        zc = 1.62 + .15 * (scale - 1)
        frame(p, w, h, zc, fw)
        canvas(p, ICON, ICON_KEYS, .024, w, h, zc)
        # Gable over the central panel.
        top = zc + h / 2 + fw
        for s in (-1, 1):
            p.beam((.025, s * (w / 2 + fw), top), (.025, 0, top + .16 * scale), .045 * scale, .05, 'gilt')
        p.box((.025, 0, top + .17 * scale), (.05, .05 * scale, .05 * scale), 'giltDark')
        # Wings: hinged on the outer edge of the central frame, opened 30 degrees.
        for s, robe in ((-1, 'robeL'), (1, 'robeR')):
            hinge = Vector((0, s * (w / 2 + fw), 0))
            a = s * math.radians(-30)
            rot = Matrix.Rotation(a, 3, 'Z')
            xf = lambda q, hinge=hinge, rot=rot: tuple(hinge + rot @ (Vector(q) - hinge))
            yc = s * (w / 2 + fw + ww / 2 + fw)
            start = len(p.bm.verts)
            frame(p, ww, h * .92, zc, fw, yc=yc)
            p.bm.verts.ensure_lookup_table()
            for v in p.bm.verts[start:]:
                v.co = Vector(xf(v.co))
            canvas(p, WING, {**ICON_KEYS, 'S': robe, 'W': 'lead'}, .024, ww, h * .92, zc, yc=yc, xf=xf,
                   normal=tuple(rot @ Vector((1, 0, 0))))
    return f


def portrait(scale):
    def f(p):
        w, h = .46 * scale, .6 * scale
        painting(p, PORTRAIT, PORTRAIT_KEYS, w, h, 1.62 + .12 * (scale - 1), .055 * scale, 'frameWood', 'gilt')
    return f


def wide(grid, legend, frame_key, inner):
    def make(scale):
        def f(p):
            w, h = .8 * scale, .5 * scale
            painting(p, grid, legend, w, h, 1.6 + .1 * (scale - 1), .05 * scale, frame_key, inner)
        return f
    return make


landscape = wide(LANDSCAPE, LANDSCAPE_KEYS, 'gilt', 'giltDark')
hunt = wide(HUNT, HUNT_KEYS, 'frameWood', 'gilt')


# ---------------------------------------------------------------- tapestries
def tapestry(grid, legend, border, w, h, top):
    """Woven panel hanging from a rod: border band, the woven scene, a fringe at the hem."""
    def f(p):
        b = .07 * max(1, w / 1.3)
        zc = top - .05 - h / 2
        p.beam((.035, -w / 2 - .12, top), (.035, w / 2 + .12, top), .04, .04, 'frameWoodDark')
        for s in (-1, 1):
            p.cylinder(.035, 0, 'gilt', n=6, axis='y', center=(.035, s * (w / 2 + .14), top), radii=[.03, .045, 0], along=[0, s * .03, s * .07])
            p.box((.01, s * (w / 2 + .1), top + .02), (.02, .03, .1), 'iron')
        # Lining against the wall, well behind the woven face (no depth fighting in the cutaway).
        p.box((.004, 0, zc), (.008, w * .98, h * .98), 'woolBrown')
        inner_w, inner_h = w - 2 * b, h - 2 * b
        canvas(p, grid, legend, .024, inner_w, inner_h, zc)
        # Border band around the scene, on the same plane: four strips and an ochre line.
        start = len(p.bm.faces)
        x = .024
        for (ya, yb, za, zb, k) in ((-w / 2, w / 2, zc + inner_h / 2, zc + h / 2, border), (-w / 2, w / 2, zc - h / 2, zc - inner_h / 2, border),
                                    (-w / 2, -inner_w / 2, zc - inner_h / 2, zc + inner_h / 2, border), (inner_w / 2, w / 2, zc - inner_h / 2, zc + inner_h / 2, border)):
            p.quads([(x, ya, za), (x, yb, za), (x, yb, zb), (x, ya, zb)], [(0, 1, 2, 3)], k)
        for s in (-1, 1):
            z = zc + s * (h / 2 - b / 2)
            p.quads([(x + .006, -w / 2 + b * .3, z - .008), (x + .006, w / 2 - b * .3, z - .008), (x + .006, w / 2 - b * .3, z + .008), (x + .006, -w / 2 + b * .3, z + .008)], [(0, 1, 2, 3)], 'woolOchre')
        facing(p, start, (1, 0, 0))
        p.box((.012, 0, zc - h / 2 - .04), (.02, w * .98, .08), 'woolCream')   # fringe
    return f


# ---------------------------------------------------------------- sculptures
def figure(p, h, z0, body, shade, skin=None, halo=None, x=0.0):
    """Standing robed figure facing +x, h metres tall, feet on z0."""
    s = h / 1.7
    skin = skin or body
    P = lambda dx, dy, dz: (x + dx * s, dy * s, z0 + dz * s)
    p.cylinder(.2 * s, 0, body, n=10, axis='z', center=(x, 0, z0), radii=[.25 * s, .21 * s, .16 * s, .19 * s, .11 * s],
               along=[0, .5 * s, .95 * s, 1.3 * s, 1.4 * s], cap_key=shade)
    p.cylinder(.05 * s, 0, skin, n=6, axis='z', center=(x, 0, z0 + 1.38 * s), radii=[.05 * s, .05 * s], along=[0, .07 * s])
    p.cylinder(.1 * s, 0, skin, n=8, axis='z', center=(x + .01 * s, 0, z0 + 1.43 * s),
               radii=[.06 * s, .095 * s, .1 * s, .085 * s, .03 * s], along=[0, .06 * s, .14 * s, .23 * s, .28 * s])
    # Mantle falling from the shoulders behind the body.
    p.taper(P(-.06, 0, 1.36), P(-.1, 0, .12), .38 * s, .1 * s, .5 * s, .1 * s, shade)
    # Left arm down holding a book, right arm raised in blessing.
    p.taper(P(0, .2, 1.3), P(.12, .22, .95), .09 * s, .09 * s, .07 * s, .07 * s, shade)
    p.box(P(.18, .2, .92), (.14 * s, .2 * s, .05 * s), shade)
    p.taper(P(0, -.2, 1.3), P(.16, -.22, 1.05), .09 * s, .09 * s, .07 * s, .07 * s, shade)
    p.taper(P(.16, -.22, 1.05), P(.2, -.2, 1.32), .07 * s, .07 * s, .05 * s, .05 * s, shade)
    p.box(P(.2, -.2, 1.36), (.04 * s, .05 * s, .08 * s), skin)
    if halo:
        p.cylinder(.16 * s, .006, halo, n=12, axis='x', center=P(-.1, 0, 1.56))


def plinth(p, w, h, key='stonePlinth', dark='stonePlinthDark'):
    p.box((0, 0, .04), (w + .08, w + .08, .08), dark)
    p.box((0, 0, h / 2), (w, w, h), key)
    p.box((0, 0, h - .03), (w + .06, w + .06, .06), dark)


def statue(body, shade):
    def f(p):
        plinth(p, .6, .55)
        figure(p, 1.7, .55, body, shade)
    return f


def bust(p):
    """Marble bust on a square pedestal with base and cap."""
    p.box((0, 0, .04), (.42, .42, .08), 'marbleShade')
    p.box((0, 0, .55), (.3, .3, .95), 'marble')
    p.box((0, 0, 1.05), (.4, .4, .06), 'marbleShade')
    p.cylinder(.09, 0, 'marbleShade', n=8, axis='z', center=(0, 0, 1.08), radii=[.1, .07, .07], along=[0, .03, .07])
    p.taper((0, 0, 1.15), (0, 0, 1.38), .24, .46, .2, .38, 'marble', end_key='marbleShade')
    p.cylinder(.06, 0, 'marble', n=6, axis='z', center=(0, 0, 1.37), radii=[.06, .055], along=[0, .08])
    p.cylinder(.11, 0, 'marble', n=8, axis='z', center=(.01, 0, 1.43), radii=[.07, .105, .11, .09, .03], along=[0, .07, .15, .25, .3])
    p.taper((-.02, 0, 1.6), (-.06, 0, 1.47), .2, .1, .14, .08, 'marbleShade')          # hair at the nape


def saint_niche(p):
    """Polychrome wooden saint in a gilt tabernacle on the wall: corbel shelf, starry back, gable."""
    zb, zt, hw = .95, 2.05, .32
    p.box((.02, 0, (zb + zt) / 2), (.04, 2 * hw, zt - zb), 'nicheBack')
    start = len(p.bm.faces)
    for i, (y, z) in enumerate(((-.2, 1.9), (.18, 1.95), (-.12, 1.25), (.2, 1.4), (-.22, 1.55), (.05, 1.98), (.22, 1.75))):
        p.quads([(.041, y - .015, z - .015), (.041, y + .015, z - .015), (.041, y + .015, z + .015), (.041, y - .015, z + .015)], [(0, 1, 2, 3)], 'goldPale')
    facing(p, start, (1, 0, 0))
    for s in (-1, 1):
        p.box((.08, s * (hw + .03), (zb + zt) / 2), (.16, .06, zt - zb), 'gilt')
        p.beam((.08, s * (hw + .06), zt), (.08, 0, zt + .3), .06, .16, 'gilt')
    p.box((.08, 0, zt + .32), (.08, .06, .1), 'giltDark')
    p.box((.13, 0, zb - .03), (.26, 2 * hw + .12, .06), 'frameWood')
    p.taper((.08, 0, zb - .06), (.03, 0, zb - .4), 2 * hw - .1, .15, .12, .04, 'frameWoodDark')   # corbel: wide along the wall
    figure(p, .85, zb, 'vermilion', 'ultramarine', skin='flesh', halo='gilt', x=.15)


# ---------------------------------------------------------------- catalogue
# kind / archetype / size / material / mount: the metadata the ARTE game data refers to.
S, L = 1.0, 1.7
PIECES = (
    ('artIconS', icon(S), 'painting', 'icon', 'small', 'tempera', 'wall', 'Icona su fondo oro · piccola'),
    ('artIconL', icon(L), 'painting', 'icon', 'large', 'tempera', 'wall', 'Icona su fondo oro · grande'),
    ('artTriptychS', triptych(S), 'painting', 'triptych', 'small', 'tempera', 'wall', 'Trittico · piccolo'),
    ('artTriptychL', triptych(L), 'painting', 'triptych', 'large', 'tempera', 'wall', 'Trittico · grande'),
    ('artPortraitS', portrait(S), 'painting', 'portrait', 'small', 'oil', 'wall', 'Ritratto · piccolo'),
    ('artPortraitL', portrait(L), 'painting', 'portrait', 'large', 'oil', 'wall', 'Ritratto · grande'),
    ('artLandscapeS', landscape(S), 'painting', 'landscape', 'small', 'oil', 'wall', 'Paesaggio · piccolo'),
    ('artLandscapeL', landscape(L), 'painting', 'landscape', 'large', 'oil', 'wall', 'Paesaggio · grande'),
    ('artHuntS', hunt(S), 'painting', 'hunt', 'small', 'oil', 'wall', 'Scena di caccia · piccola'),
    ('artHuntL', hunt(L), 'painting', 'hunt', 'large', 'oil', 'wall', 'Scena di caccia · grande'),
    ('artMillefleursS', tapestry(MILLEFLEURS, MILLEFLEURS_KEYS, 'woolRed', 1.2, 1.05, 2.5), 'tapestry', 'millefleurs', 'small', 'wool', 'wall', 'Arazzo millefleurs · piccolo'),
    ('artMillefleursL', tapestry(MILLEFLEURS, MILLEFLEURS_KEYS, 'woolRed', 2.2, 1.9, 2.75), 'tapestry', 'millefleurs', 'large', 'wool', 'wall', 'Arazzo millefleurs · grande'),
    ('artFriezeS', tapestry(FRIEZE, FRIEZE_KEYS, 'woolBlue', 1.5, .7, 2.45), 'tapestry', 'frieze', 'small', 'wool', 'wall', 'Arazzo narrativo · piccolo'),
    ('artFriezeL', tapestry(FRIEZE, FRIEZE_KEYS, 'woolBlue', 2.7, 1.2, 2.75), 'tapestry', 'frieze', 'large', 'wool', 'wall', 'Arazzo narrativo · grande'),
    ('artBust', bust, 'sculpture', 'bust', 'small', 'marble', 'floor', 'Busto su piedistallo · marmo'),
    ('artStatueMarble', statue('marble', 'marbleShade'), 'sculpture', 'statue', 'large', 'marble', 'floor', 'Statua su basamento · marmo'),
    ('artStatueStone', statue('limestone', 'limestoneShade'), 'sculpture', 'statue', 'large', 'stone', 'floor', 'Statua su basamento · pietra'),
    ('artStatueBronze', statue('bronze', 'bronzeDark'), 'sculpture', 'statue', 'large', 'bronze', 'floor', 'Statua su basamento · bronzo'),
    ('artSaintNiche', saint_niche, 'sculpture', 'saint', 'small', 'polychromeWood', 'wall', 'Santo ligneo policromo in tabernacolo'),
)


def build(root):
    parts = {}
    for i, (name, fn, *_rest) in enumerate(PIECES):
        p = Part(root, name, COLORS, ((i % 6) * 3.5, (i // 6) * 3.5, 0), prefix='art_')
        p.facing = []
        fn(p)
        # Closed solids get outward normals; painted planes look at the room whatever the recalc chose.
        bmesh.ops.recalc_face_normals(p.bm, faces=p.bm.faces[:])
        p.bm.faces.ensure_lookup_table()
        for a, b, d in p.facing:
            for face in p.bm.faces[a:b]:
                face.normal_update()
                if face.normal.dot(Vector(d)) < 0:
                    face.normal_flip()
        parts[name] = p.finish(recalc=False)
    return parts


def export(parts, out_path):
    data = {'unit': 'U', 'metersPerU': METERS_PER_U, 'palette': list(COLORS.values()), 'paletteKeys': KEYS,
            'pieces': {}, 'catalog': {}, 'swatches': SWATCHES}
    statue = {'marble': statue_slots('marble', 'marbleShade'), 'stone': statue_slots('limestone', 'limestoneShade'),
              'bronze': statue_slots('bronze', 'bronzeDark')}
    total = 0
    for (name, _fn, kind, archetype, size, material, mount, label) in PIECES:
        e = export_indexed(parts[name], KEYS)
        xs, ys, zs = e['v'][0::3], e['v'][1::3], e['v'][2::3]
        e['d'] = round(max(xs) - min(xs), 3); e['w'] = round(max(ys) - min(ys), 3); e['h'] = round(max(zs), 3)
        e['back'] = round(min(xs), 3)
        e['z0'] = round(min(zs), 3)                         # lowest point: wall pieces hang above the floor
        data['pieces'][name] = e
        slots = statue[material] if archetype == 'statue' else SLOTS[archetype]
        used = set(e['c'])
        for sid, _l, key, shade, _s in slots:                # every slot key really paints this piece
            assert KEYS.index(key) in used, (name, sid, key)
        data['catalog'][name] = {'kind': kind, 'archetype': archetype, 'size': size, 'material': material,
                                 'mount': mount, 'label': label, 'colors': export_slots(slots)}
        total += len(e['c'])
    js = ("'use strict';\n// Generated by tools/blender/build_art.py — do not edit by hand.\n"
          "// ARTE graphic archetypes (paintings, tapestries, sculptures) as indexed triangles in model space (U):\n"
          "// +x front, +y left, +z up; catalog = kind/archetype/size/material/mount of each piece.\n"
          "window.ConquerArtModels=" + json.dumps(data, separators=(',', ':'), ensure_ascii=False) + ";\n")
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, 'w', encoding='utf-8', newline='\n') as f:
        f.write(js)
    print(f"art models: {len(parts)} pieces, {total} triangles, {len(js) // 1024} KB -> {out_path}")


if __name__ == '__main__' and '--' in sys.argv:
    args = sys.argv[sys.argv.index('--') + 1:]
    root = fresh_collection(COLL_NAME)
    export(build(root), args[args.index('--out') + 1])
