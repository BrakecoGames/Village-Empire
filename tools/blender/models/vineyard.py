"""Village Empire — Vineyard (wijngaardhuis), 3 levels. Roomwit huis met paars pannendak en een
pergola vol druivenranken en trossen. Bouwen: npm run models -- vineyard"""
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
setup(seed=5303)
PURPLE = ("TilePurpA", "TilePurpA", "TilePurpB", "TilePurpC")


def build(lvl):
    earth_base(0.82, 0.76, top=0.04, clumps=9, pebbles=3, flowers=4,
               keep_clear=[(-0.28, -0.04, 0.04, 0.5), (0.12, 0.46, 0.04, 0.46)])
    h = house_body(x=-0.12, z=-0.12, w=0.44, d=0.32, wall_top=0.37, ridge_y=0.64, roof="tile", wall="Cream",
                   roof_color=PURPLE)
    door(-0.18, h["front"], w=0.11, h=0.18)
    window(0.02, 0.2, h["front"] + 0.002, "z", lit=True, shutters="ShutterG", w=0.08, h=0.08)
    smoke = chimney(0.0, -0.22, 0.42, 0.76)
    # pergola met ranken en trossen
    for x in (0.16, 0.38):
        for z in (0.08, 0.36):
            beam((x, 0.04, z), (x, 0.32, z), 0.02, "Timber")
    for z in (0.08, 0.22, 0.36):
        beam((0.14, 0.32, z), (0.4, 0.32, z), 0.014, "Wood")
    nleaf = 6 if lvl == 1 else 9
    for i in range(nleaf):
        blob(0.045, rnd.choice(("Leaf", "LeafL")), (0.18 + (i % 3) * 0.09, 0.35, 0.1 + (i // 3) * 0.12), scale=(1.2, 0.6, 1.1), sub=1)
    for i in range(3 if lvl == 1 else 5):
        x, z = 0.2 + (i % 3) * 0.08, 0.16 + (i // 3) * 0.12
        for k in range(3):
            blob(0.014, "Grape", (x + (k - 1) * 0.012, 0.29 - k * 0.012, z), sub=0)
    for x in (0.16, 0.38):                                       # ranken langs de palen
        blob(0.03, "Leaf", (x, 0.15, 0.36), scale=(0.8, 1.6, 0.8), sub=1)
    barrel(-0.34, 0.26, 0.04)
    # mand met druiven
    cyl(0.04, 0.032, 0.04, 8, "WoodL", pos=(-0.04, 0.04, 0.32))
    for k in range(3):
        blob(0.016, "Grape", (-0.05 + k * 0.012, 0.09, 0.32), sub=0)
    if lvl >= 3:
        barrel(-0.34, 0.12, 0.04)
        box(0.12, 0.012, 0.045, "WoodL", pos=(0.27, 0.1, 0.42), bevel=0.003)
    return smoke


build_levels("vineyard", build, args)
