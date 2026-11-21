"""Village Empire — Forester (boswachtershuis), 3 levels. Herkenbaar aan het bemoste spanendak
en de omheinde boomkwekerij met jonge boompjes. Bouwen: npm run models -- forester"""
import math
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "lib"))
import ve_blender as ve  # noqa: E402
from ve_parts import *  # noqa: E402,F401,F403
from ve_parts import rnd  # noqa: E402

args = ve.parse_args()
args.budget = max(args.budget, 3400)
ve.reset_scene()
setup(seed=3101)
MOSSY = ("ShA", "Moss", "ShB", "Moss", "ShC", "ShA")


def sapling(x, z, s=1.0):
    cyl(0.008 * s, 0.01 * s, 0.05 * s, 5, "Log", pos=(x, 0.04, z))
    cyl(0.0, 0.045 * s, 0.08 * s, 7, "GrassD", pos=(x, 0.07 * s, z), cap=False)
    cyl(0.0, 0.035 * s, 0.07 * s, 7, "Leaf", pos=(x, 0.11 * s, z), cap=False)


def tree(x, z, s=1.0):
    cyl(0.018 * s, 0.024 * s, 0.14 * s, 6, "Log", pos=(x, 0.04, z))
    blob(0.09 * s, "Leaf", (x, 0.2 * s + 0.04, z), scale=(1, 0.9, 1), sub=2)
    blob(0.06 * s, "LeafL", (x + 0.04 * s, 0.26 * s + 0.04, z - 0.02 * s), sub=1)


def build(lvl):
    earth_base(0.82, 0.76, top=0.04, clumps=10, pebbles=3, flowers=4,
               keep_clear=[(-0.24, 0.0, 0.08, 0.5), (0.06, 0.45, -0.02, 0.45)])
    h = house_body(x=-0.12, z=-0.12, w=0.44, d=0.34, wall_top=0.37, ridge_y=0.64, roof="shingle",
                   wall="Plaster2", roof_color=MOSSY)
    door(-0.16, h["front"], w=0.11, h=0.18)
    window(h["right"] + 0.002, 0.19, -0.12, "x", lit=True, shutters="ShutterG", w=0.08, h=0.09)
    window(0.0, 0.2, h["front"] + 0.002, "z", lit=False, shutters="ShutterG", w=0.07, h=0.08)
    smoke = chimney(-0.27, -0.2, 0.42, 0.75)
    # kwekerij: omheind bed met jonge boompjes
    fence((0.1, 0.04), (0.38, 0.04), 3)
    fence((0.38, 0.04), (0.38, 0.38), 3)
    fence((0.1, 0.38), (0.38, 0.38), 3)
    box(0.26, 0.015, 0.31, "Soil", pos=(0.24, 0.04, 0.21))
    n = 4 if lvl == 1 else 6
    for i in range(n):
        sapling(0.16 + (i % 3) * 0.08, 0.11 + (i // 3) * 0.15 + (0.04 if i % 2 else 0), s=0.85 + 0.15 * (i % 2))
    # schop en gieter
    beam((-0.36, 0.04, 0.24), (-0.33, 0.2, 0.22), 0.012, "WoodL")
    box(0.04, 0.05, 0.008, "Iron", pos=(-0.365, 0.03, 0.245))
    cyl(0.025, 0.028, 0.05, 8, "Iron", pos=(0.02, 0.04, 0.3))
    beam((0.04, 0.065, 0.3), (0.075, 0.09, 0.3), 0.007, "Iron")
    if lvl >= 2:
        tree(-0.36, -0.32, 0.8)
        for k in range(3):
            pebble(-0.34 + k * 0.04, 0.36, 0.02, 0.04)
    if lvl >= 3:
        tree(0.34, -0.3, 1.0)
        # vogelhuisje en bankje
        beam((0.42, 0.04, 0.42), (0.42, 0.26, 0.42), 0.014, "Wood")
        box(0.05, 0.05, 0.05, "WoodL", pos=(0.42, 0.26, 0.42), bevel=0.004)
        box(0.13, 0.012, 0.045, "WoodL", pos=(-0.32, 0.1, 0.12), bevel=0.003)
        for sx in (-1, 1):
            box(0.012, 0.06, 0.04, "Wood", pos=(-0.32 + sx * 0.05, 0.04, 0.12))
    return smoke


build_levels("forester", build, args)
