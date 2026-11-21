"""Village Empire — Tavern (herberg), 3 levels. Twee verdiepingen: stenen begane grond met
vakwerk erboven, verlichte ramen, uithangbord met bierpul, terras met bank en tafel.
Bouwen: npm run models -- tavern"""
import math
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "lib"))
import ve_blender as ve  # noqa: E402
from ve_parts import *  # noqa: E402,F401,F403
from ve_parts import rnd  # noqa: E402

args = ve.parse_args()
args.budget = max(args.budget, 3600)
ve.reset_scene()
setup(seed=5505)


def build(lvl):
    earth_base(0.86, 0.82, top=0.04, clumps=8, pebbles=3, flowers=4,
               keep_clear=[(-0.3, -0.04, 0.1, 0.5), (0.06, 0.42, 0.18, 0.5)])
    X, Z, W, D = -0.05, -0.1, 0.56, 0.4
    # stenen begane grond
    box(W, 0.26, D, "StoneA", pos=(X, 0.04, Z), bevel=0.008)
    for sx in (-1, 1):
        for k in range(3):
            box(0.05, 0.045, 0.05, "StoneL" if k % 2 else "StoneB", pos=(X + sx * (W / 2 - 0.016), 0.07 + k * 0.08, Z + D / 2 - 0.016), bevel=0.006)
    box(W + 0.04, 0.03, D + 0.04, "Timber", pos=(X, 0.3, Z))                           # verdiepingsbalk
    h = house_body(x=X, z=Z, w=W + 0.02, d=D + 0.02, wall_top=0.58, ridge_y=0.92, roof="tile", wall="Plaster",
                   y0=0.33, plinth=False)
    f = Z + D / 2
    door(-0.18, f + 0.004, w=0.12, h=0.2)
    window(0.08, 0.15, f + 0.006, "z", lit=True, shutters=None, w=0.1, h=0.09)
    window(-0.2, 0.42, h["front"] + 0.002, "z", lit=True, shutters="Shutter", w=0.08, h=0.08)
    window(0.1, 0.42, h["front"] + 0.002, "z", lit=True, shutters="Shutter", w=0.08, h=0.08)
    flower_box(-0.2, 0.37, h["front"], "z", n=3)
    flower_box(0.1, 0.37, h["front"], "z", n=3)
    window(h["right"] + 0.002, 0.45, Z, "x", lit=True, shutters=None, w=0.08, h=0.08)
    smoke = chimney(0.15, -0.22, 0.75, 1.06)
    # uithangbord met bierpul
    beam((-0.36, 0.38, f + 0.02), (-0.43, 0.38, f + 0.1), 0.012, "Iron")
    box(0.1, 0.09, 0.012, "WoodL", pos=(-0.43, 0.27, f + 0.1), bevel=0.003)
    cyl(0.018, 0.016, 0.04, 6, "Gold", pos=(-0.43, 0.3, f + 0.11))
    # terras: tafel met bekers en een bank
    box(0.2, 0.012, 0.09, "WoodL", pos=(0.24, 0.1, 0.34), bevel=0.003)
    for sx in (-1, 1):
        box(0.012, 0.06, 0.07, "Wood", pos=(0.24 + sx * 0.08, 0.04, 0.34))
    box(0.2, 0.012, 0.04, "Wood", pos=(0.24, 0.07, 0.42))
    cyl(0.012, 0.012, 0.03, 6, "Gold", pos=(0.2, 0.112, 0.34))
    cyl(0.012, 0.012, 0.03, 6, "Wine", pos=(0.28, 0.112, 0.34))
    barrel(-0.37, -0.3, 0.04)
    if lvl >= 2:
        barrel(-0.37, -0.18, 0.04)
        for lx in (-0.29, 0.21):                                 # lantaarns naast de deur/het raam
            box(0.03, 0.04, 0.03, "Glow", pos=(lx, 0.26, f + 0.03), bevel=0.003)
    if lvl >= 3:
        # luifel boven het terras
        for s_ in range(5):
            half_tube((0.15 + s_ * 0.045, 0.3, f + 0.07), (0, -0.4, 1), (0, 1, 0.4), 0.026, 0.13, "RedC" if s_ % 2 else "Canvas", seg=4)
        for x in (0.13, 0.36):
            beam((x, 0.04, 0.4), (x, 0.28, 0.4), 0.012, "Timber")
    return smoke


build_levels("tavern", build, args)
