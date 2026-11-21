"""Village Empire — Cottage (woonhuis), drie upgrade-levels in één GLB.

Uitvoer: public/models/house.glb met de nodes
    house_l1, house_l2, house_l3      één mesh per level (meerdere materialen + gebakken AO)
    house_l1_smoke, ...               lege markers: top van de schoorsteen (rook)

Coördinaten zijn GAME-coördinaten (Y omhoog, voordeur aan +Z, 1 eenheid = 1 tegel).
Bouwstenen: tools/blender/lib/ve_parts.py — stijl: docs/STIJLGIDS.md

Bouwen: npm run models -- house
"""
import math
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "lib"))
import ve_blender as ve  # noqa: E402
from ve_parts import *  # noqa: E402,F401,F403
from ve_parts import rnd  # noqa: E402

args = ve.parse_args()
args.budget = max(args.budget, 3400)   # per level; level 3 (dakkapel, aanbouw, gras) zit rond 3300
ve.reset_scene()
setup(seed=1207)

# ------------------------------------------------------------------ het huis
W, D = 0.6, 0.46                     # muren (x, z)
WALL_Y0, WALL_TOP = 0.06, 0.475      # muurvoet, muurtop (voor/achter)
EAVE_Z, EAVE_Y = 0.33, 0.39          # dakgoot (overstek)
RIDGE_Y = 0.78
APEX_Y = 0.745


def main_house(lvl):
    # fundering (zakt in het terrein, zoals de procedurele gebouwen)
    # natuurlijke fundering: aangestampte aarde met gras, keien en bloemetjes langs de rand (stijlgids)
    earth_base(0.8, 0.7, top=0.045, clumps=10, pebbles=4, flowers=4,
               keep_clear=[(-0.24, 0.04, 0.2, 0.5)])
    # muren: zeshoekig profiel (met puntgevels) over de breedte geëxtrudeerd
    prof = [(-D / 2, WALL_Y0), (D / 2, WALL_Y0), (D / 2, WALL_TOP), (0, APEX_Y), (-D / 2, WALL_TOP)]
    prism(prof, W, "Plaster", bevel=0.006)
    # vakwerk
    t = 0.028
    hx, hz = W / 2 + 0.004, D / 2 + 0.004
    for sx in (-1, 1):
        for sz in (-1, 1):
            beam((sx * hx, WALL_Y0, sz * hz), (sx * hx, WALL_TOP, sz * hz), t)
    for sz in (-1, 1):                                                   # voor/achter regels
        beam((-hx, WALL_TOP - 0.012, sz * hz), (hx, WALL_TOP - 0.012, sz * hz), t)
        beam((-hx, 0.26, sz * hz), (hx, 0.26, sz * hz), t * 0.9)
    for sx in (-1, 1):                                                   # zijgevels
        beam((sx * hx, WALL_TOP - 0.012, -hz), (sx * hx, WALL_TOP - 0.012, hz), t)
        beam((sx * hx, WALL_TOP, 0), (sx * hx, APEX_Y - 0.01, 0), t * 0.9)          # makelaar
        beam((sx * hx, WALL_Y0 + 0.02, -hz + 0.02), (sx * hx, 0.26, -0.04), t * 0.8)  # schoren
        beam((sx * hx, 0.26, 0.04), (sx * hx, WALL_TOP - 0.02, hz - 0.02), t * 0.8)
    # schoren naast de deur
    beam((0.04, WALL_Y0 + 0.02, hz), (0.07, 0.25, hz), t * 0.8)
    beam((-0.27, 0.27, hz), (-0.2, WALL_TOP - 0.02, hz), t * 0.8)

    # dak met holle pannen
    gable_roof(0.78, EAVE_Z, EAVE_Y, RIDGE_Y, rows=5, cols=7)

    # deur, ramen, bloembakken
    door(-0.1, D / 2 + 0.004)
    window(0.15, 0.16, D / 2 + 0.006, "z", lit=True)
    flower_box(0.15, 0.115, D / 2 + 0.004, "z", n=4)
    window(W / 2 + 0.006, 0.17, 0.0, "x", lit=False, shutters="ShutterG")
    flower_box(W / 2 + 0.004, 0.125, 0.0, "x", n=3)
    window(W / 2 + 0.006, 0.52, 0.0, "x", lit=True, shutters=None, w=0.07, h=0.08)   # zolderraam in de gevel

    # natuurstenen plint
    stone_plinth(-W / 2, W / 2, -D / 2, D / 2)

    # schoorsteen achter de nok
    smoke = chimney(0.17, -0.09, 0.45, 0.94)

    # details
    barrel(-0.33, 0.29)
    blob(0.06, "Leaf", (0.33, 0.07, 0.27), scale=(1.0, 0.85, 1.0), sub=2)       # struikje op de hoek
    blob(0.04, "LeafL", (0.27, 0.07, 0.31), scale=(1.0, 0.8, 1.0), sub=2)
    box(0.012, 0.012, 0.05, "Iron", pos=(0.02, 0.3, D / 2 + 0.03))              # lantaarnarm
    box(0.035, 0.045, 0.035, "Glow", pos=(0.02, 0.255, D / 2 + 0.055), bevel=0.004)
    box(0.045, 0.012, 0.045, "Iron", pos=(0.02, 0.3, D / 2 + 0.055))

    if lvl >= 2:
        # aanbouw links met lessenaarsdak en houtopslag
        ax, aw, ad = -0.43, 0.22, 0.36
        box(aw + 0.06, 0.24, ad + 0.08, "EarthD", pos=(ax - 0.01, -0.2, 0.0), bevel=0.02)
        box(aw, 0.26, ad, "Plaster2", pos=(ax, WALL_Y0, 0.0), bevel=0.005)
        for sz in (-1, 1):
            beam((ax - aw / 2 - 0.003, WALL_Y0, sz * (ad / 2 + 0.003)), (ax - aw / 2 - 0.003, WALL_Y0 + 0.26, sz * (ad / 2 + 0.003)), t)
        beam((ax - aw / 2, WALL_Y0 + 0.25, ad / 2 + 0.004), (ax + aw / 2, WALL_Y0 + 0.25, ad / 2 + 0.004), t)
        # lessenaarsdak: loopt af naar -x  -> gebruik een gekanteld 'zadeldak'-vlak langs z
        rows, cols = 3, 4
        roof_w = ad + 0.1
        y_hi, y_lo = WALL_Y0 + 0.36, WALL_Y0 + 0.24
        run = aw + 0.06
        a = math.atan2(y_hi - y_lo, run)
        L = math.hypot(run, y_hi - y_lo)
        tw = roof_w / cols
        r = tw * 0.52
        box(L + 0.02, 0.022, roof_w + 0.02, "RoofDeck", pos=(ax - 0.02, (y_hi + y_lo) / 2 - 0.012, 0.0), rot=(0, 0, a), base=False)
        up_a = (math.cos(a), math.sin(a), 0.0)          # dak loopt omhoog naar het huis (+x)
        n_a = (-math.sin(a), math.cos(a), 0.0)
        for ri in range(rows):
            tpos = (ri + 0.5) / rows
            px = (ax + aw / 2 + 0.01) - run * tpos
            py = y_hi - (y_hi - y_lo) * tpos + r * 0.35 * math.cos(a)
            px -= r * 0.35 * math.sin(a)
            stagger = (0.12 if ri % 2 else -0.12) * tw
            for ci in range(cols):
                pz = -roof_w / 2 + (ci + 0.5) * tw + stagger
                tile((px, py, pz), up_a, n_a, r, L / rows * 1.25, rnd.choice(("RoofA", "RoofB", "RoofC")),
                     twist=rnd.uniform(-0.03, 0.03))
        window(ax, 0.15, ad / 2 + 0.004, "z", lit=True, shutters="Shutter", w=0.08, h=0.09)
        woodpile(ax - 0.17, 0.0)
        fence((0.38, 0.08), (0.38, 0.33), 3)
        blob(0.03, "LeafL", (0.42, 0.06, 0.2), sub=1)

    if lvl >= 3:
        # dakkapel op het voordakvlak: voorgevel steekt net buiten het dak, achterkant zit erin
        fz, dy, dxc = 0.26, 0.45, -0.12
        box(0.17, 0.19, 0.16, "Plaster", pos=(dxc, dy, fz - 0.08))
        prism([(-0.085, 0.0), (0.085, 0.0), (0.0, 0.065)], 0.012, "Plaster", pos=(dxc, dy + 0.19, fz - 0.006), axis="z")
        for sx in (-1, 1):
            beam((dxc + sx * 0.087, dy, fz + 0.002), (dxc + sx * 0.087, dy + 0.19, fz + 0.002), 0.02)
        beam((dxc - 0.095, dy + 0.19, fz + 0.002), (dxc + 0.095, dy + 0.19, fz + 0.002), 0.02)
        window(dxc, dy + 0.08, fz + 0.004, "z", lit=True, shutters=None, w=0.08, h=0.08)
        # zadeldakje van de dakkapel (nok langs z)
        for s in (-1, 1):
            box(0.13, 0.018, 0.22, rnd.choice(("RoofA", "RoofB")), pos=(dxc + s * 0.05, dy + 0.225, fz - 0.09), rot=(0, 0, -s * 0.75), base=False, bevel=0.004)
        half_tube((dxc, dy + 0.262, fz - 0.09), (0, 0, 1), (0, 1, 0), 0.018, 0.22, "Ridge", seg=6, cap=True)
        # bankje en extra bloempotten
        box(0.16, 0.012, 0.05, "WoodL", pos=(0.2, 0.1, D / 2 + 0.08), bevel=0.003)
        for sx in (-1, 1):
            box(0.012, 0.045, 0.04, "Wood", pos=(0.2 + sx * 0.065, 0.055, D / 2 + 0.08))
        for px in (-0.24, 0.35):
            cyl(0.022, 0.017, 0.035, 8, "Brick", pos=(px, 0.06, D / 2 + 0.1))
            blob(0.022, "Leaf", (px, 0.105, D / 2 + 0.1), sub=1)
            blob(0.011, "FlRed" if px < 0 else "FlYel", (px + 0.008, 0.125, D / 2 + 0.108), sub=0)
    return smoke


build_levels("house", main_house, args)
