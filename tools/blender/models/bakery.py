"""Village Empire — Bakery (bakkerij), 3 levels. Roomwit huis met pannendak, gemetselde koepeloven
met gloeiende mond, uithangbord met brood. Bouwen: npm run models -- bakery"""
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
setup(seed=4303)


def build(lvl):
    earth_base(0.84, 0.8, top=0.04, clumps=9, pebbles=3, flowers=4,
               keep_clear=[(-0.28, -0.04, 0.12, 0.5), (0.14, 0.46, 0.08, 0.46)])
    h = house_body(x=-0.08, z=-0.08, w=0.48, d=0.36, wall_top=0.4, ridge_y=0.7, roof="tile", wall="Cream")
    door(-0.16, h["front"], w=0.12, h=0.2)
    window(0.06, 0.2, h["front"] + 0.002, "z", lit=True, shutters="Shutter", w=0.09, h=0.09)
    flower_box(0.06, 0.15, h["front"], "z", n=3)
    smoke1 = chimney(0.1, -0.18, 0.44, 0.88)
    # koepeloven
    blob(0.13, "Brick", (0.3, 0.04, 0.24), scale=(1, 0.85, 1), sub=2)
    box(0.07, 0.06, 0.03, "Glow", pos=(0.3, 0.05, 0.36))
    box(0.09, 0.012, 0.035, "StoneL", pos=(0.3, 0.11, 0.365))
    cyl(0.025, 0.03, 0.12, 8, "Brick", pos=(0.33, 0.14, 0.2))
    # uithangbord met brood
    beam((-0.36, 0.2, h["front"] + 0.01), (-0.36, 0.34, h["front"] + 0.01), 0.012, "Timber")
    beam((-0.36, 0.33, h["front"] + 0.01), (-0.24, 0.33, h["front"] + 0.01), 0.012, "Iron")
    box(0.1, 0.07, 0.012, "WoodL", pos=(-0.28, 0.24, h["front"] + 0.012), bevel=0.003)
    blob(0.03, "Bread", (-0.28, 0.275, h["front"] + 0.022), scale=(1.4, 0.8, 0.9), sub=1)
    # meel en hout
    sack(0.36, -0.28, 0.04, 0.04)
    sack(0.3, -0.33, 0.04, 0.035)
    crate(0.4, -0.08, 0.04, 0.08, 0.2)
    # geen vaste broden: de werkelijke voorraad brood ligt op de marker 'pile'
    if lvl >= 2:
        crate(-0.36, -0.3, 0.04, 0.08, 0.4)
    if lvl >= 3:
        # luifel boven de deur en een tweede schoorsteen
        for s_ in range(4):
            half_tube((-0.22 + s_ * 0.04, 0.3, h["front"] + 0.05), (0, -0.4, 1), (0, 1, 0.4), 0.024, 0.11,
                      "RedC" if s_ % 2 else "Canvas", seg=4)
        blob(0.05, "Leaf", (-0.38, 0.07, -0.3), sub=2)
    return {"smoke": [smoke1, (0.33, 0.29, 0.2)], "pile": (-0.03, 0.04, 0.34)}


build_levels("bakery", build, args)
