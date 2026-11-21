"""Village Empire — Sawmill (zagerij), 3 levels. Werkplaats met pannendak plus een open afdak
met zaagbank; het ronde zaagblad draait in de game op de marker 'saw'.
Bouwen: npm run models -- sawmill"""
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
setup(seed=3303)


def plank_stack(x, z, n, y=0.04):
    for i in range(n):
        box(0.24, 0.02, 0.07, "WoodL" if i % 2 else "Wood", pos=(x, y + i * 0.022, z), rot=(0, (i % 2) * 0.06, 0))


def log_pile(x, z, rows=3, length=0.2):
    for row in range(rows):
        for i in range(rows - row):
            off = (i - (rows - row - 1) / 2) * 0.056
            cyl(0.026, 0.026, length, 6, "Log" if (i + row) % 2 else "LogD",
                pos=(x - length / 2, 0.066 + row * 0.048, z + off), rot=(0, 0, -math.pi / 2))


def build(lvl):
    earth_base(0.86, 0.8, top=0.04, clumps=8, pebbles=3, flowers=2,
               keep_clear=[(-0.3, -0.08, 0.06, 0.5), (0.1, 0.46, 0.0, 0.46)])
    h = house_body(x=-0.15, z=-0.12, w=0.44, d=0.36, wall_top=0.4, ridge_y=0.7, roof="tile", wall="Plaster")
    door(-0.2, h["front"], w=0.13, h=0.2)
    window(h["right"] + 0.002, 0.2, -0.12, "x", lit=True, shutters="Shutter", w=0.08, h=0.09)
    smoke = chimney(-0.3, -0.2, 0.46, 0.84)
    # open afdak met zaagbank
    sx0, sx1, sz0, sz1 = 0.14, 0.4, 0.06, 0.36
    for x in (sx0, sx1):
        for z in (sz0, sz1):
            beam((x, 0.04, z), (x, 0.31, z), 0.024, "Timber")
    gable_roof(0.34, 0.2, 0.29, 0.42, 3, 3, x=0.27, z=0.21, kind="shingle", mats=ROOFS["shingle"][1],
               ridge_mat="LogD", ridge_r=0.022)
    box(0.26, 0.075, 0.11, "Wood", pos=(0.27, 0.04, 0.21), bevel=0.006)          # zaagbank
    cyl(0.028, 0.028, 0.24, 6, "Log", pos=(0.15, 0.142, 0.21), rot=(0, 0, -math.pi / 2))
    box(0.06, 0.008, 0.06, "LogEnd", pos=(0.33, 0.115, 0.25))                    # zaagsel
    # geen vaste plankenstapel: de werkelijke voorraad planken ligt op de marker 'pile'
    log_pile(-0.3, -0.36, rows=2 if lvl == 1 else 3)
    if lvl >= 3:
        for _ in range(4):
            blob(0.03, "LogEnd", (rnd.uniform(0.2, 0.36), 0.045, rnd.uniform(0.36, 0.42)), scale=(1.4, 0.35, 1.2), sub=1)
        crate(0.38, -0.3, 0.04, 0.08)
        crate(0.38, -0.3, 0.12, 0.065, 0.3)
    return {"smoke": [smoke], "anims": {"saw": (0.27, 0.15, 0.21)}, "pile": (-0.15, 0.04, 0.34)}


build_levels("sawmill", build, args)
