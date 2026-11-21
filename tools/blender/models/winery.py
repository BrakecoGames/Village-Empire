"""Village Empire — Winery (wijnmakerij), 3 levels. Stenen pand met donkerrood dak, overwelfde
kelderpoort, liggende vaten op een rek en een uithangbord met wijn.
Bouwen: npm run models -- winery"""
import math
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "lib"))
import ve_blender as ve  # noqa: E402
from ve_parts import *  # noqa: E402,F401,F403
from ve_parts import rnd  # noqa: E402

args = ve.parse_args()
args.budget = max(args.budget, 3500)
ve.reset_scene()
setup(seed=5404)
DARK = ("TileDarkA", "TileDarkA", "TileDarkB", "TileDarkC")


def lying_barrel(x, z, y):
    cyl(0.05, 0.05, 0.12, 10, "Wood", pos=(x - 0.06, y + 0.05, z), rot=(0, 0, -math.pi / 2))
    for dx in (-0.035, 0.035):
        cyl(0.052, 0.052, 0.012, 10, "Iron", pos=(x + dx - 0.006, y + 0.05, z), rot=(0, 0, -math.pi / 2), cap=False)


def build(lvl):
    earth_base(0.86, 0.8, top=0.04, clumps=9, pebbles=4, flowers=3,
               keep_clear=[(-0.2, 0.08, 0.12, 0.5), (0.18, 0.46, 0.0, 0.46)])
    h = house_body(x=-0.07, z=-0.08, w=0.5, d=0.38, wall_top=0.4, ridge_y=0.68, roof="tile", wall="StoneA",
                   timber=False, roof_color=DARK)
    # overwelfde kelderpoort
    f = h["front"]
    box(0.16, 0.19, 0.02, "DoorD", pos=(-0.06, 0.06, f))
    half_tube((-0.06, 0.25, f + 0.004), (0, 0, 1), (0, 1, 0), 0.08, 0.03, "StoneB", seg=8, cap=True)
    half_tube((-0.06, 0.25, f + 0.012), (0, 0, 1), (0, 1, 0), 0.065, 0.02, "DoorD", seg=8, cap=True)
    for sx in (-1, 1):
        box(0.035, 0.19, 0.03, "StoneB", pos=(-0.06 + sx * 0.098, 0.06, f), bevel=0.005)
    window(h["right"] + 0.002, 0.22, -0.08, "x", lit=True, shutters=None, w=0.08, h=0.09)
    smoke = chimney(-0.26, -0.18, 0.46, 0.84)
    # vatenrek
    for x in (0.22, 0.42):
        box(0.02, 0.025, 0.36, "Timber", pos=(x - 0.1 + 0.1, 0.04, 0.17))
    for k in range(3):
        lying_barrel(0.32, 0.06 + k * 0.12, 0.06)
    lying_barrel(0.32, 0.12, 0.165)
    # uithangbord
    beam((-0.36, 0.2, f + 0.02), (-0.36, 0.34, f + 0.02), 0.012, "Timber")
    box(0.1, 0.07, 0.012, "WoodL", pos=(-0.31, 0.24, f + 0.02), bevel=0.003)
    cyl(0.012, 0.016, 0.04, 6, "Wine", pos=(-0.31, 0.255, f + 0.03))
    if lvl >= 2:
        lying_barrel(0.32, 0.24, 0.165)
        for k in range(3):
            cyl(0.01, 0.013, 0.045, 6, "Wine", pos=(0.06 + k * 0.03, 0.04, 0.34))
    if lvl >= 3:
        # kar met vat
        box(0.15, 0.04, 0.1, "Wood", pos=(-0.32, 0.09, -0.32), rot=(0, 0.5, 0), bevel=0.005)
        for s in (-1, 1):
            cyl(0.045, 0.045, 0.012, 8, "LogD", pos=(-0.32 + s * 0.035, 0.09, -0.32 + s * 0.06), rot=(math.pi / 2, 0, 0.5))
        lying_barrel(-0.32, -0.32, 0.13)
    return smoke


build_levels("winery", build, args)
