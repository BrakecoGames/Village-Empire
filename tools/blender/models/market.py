"""Village Empire — Marketplace (markt), 3 levels. Geplaveid plein met gildehuisje, kramen met
gestreepte luifels en een vlag (animatie op marker 'flag'). L2: derde kraam. L3: waterput.
Bouwen: npm run models -- market"""
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
setup(seed=5101)


def build(lvl):
    # geplaveid plein: lage aardebak met losse keien (geen grijze plaat)
    box(0.9, 0.24, 0.86, "EarthD", pos=(0, -0.2, 0), bevel=0.03)
    for j in range(5):
        for i in range(5):
            x, z = -0.34 + i * 0.17 + (0.04 if j % 2 else 0), -0.34 + j * 0.17
            if abs(x) > 0.42:
                continue
            box(0.155, 0.02, 0.155, rnd.choice(("StoneL", "StoneA", "StoneL", "StoneB")),
                pos=(x, 0.03, z), rot=(0, rnd.uniform(-0.04, 0.04), 0))
    for _ in range(8):
        grass_clump(rnd.choice((-1, 1)) * rnd.uniform(0.38, 0.44), rnd.uniform(-0.42, 0.42), 0.8, 0.04)
    h = house_body(x=-0.18, z=-0.26, w=0.32, d=0.24, wall_top=0.36, ridge_y=0.58, roof="tile", wall="Plaster")
    door(-0.18, h["front"], w=0.1, h=0.17)
    stall(0.22, -0.18, "RedC", "Canvas", ("Apple", "Cabbage", "Pumpkin"))
    stall(0.2, 0.22, "BlueC", "Canvas", ("Grape", "Bread", "Hay"))
    barrel(-0.3, 0.27, 0.05)
    crate(-0.14, 0.3, 0.05, 0.08, 0.3)
    crate(-0.36, 0.08, 0.05, 0.07)
    flag = flag_pole(-0.38, -0.38, 0.05, 0.55)
    if lvl >= 2:
        stall(-0.12, 0.1, "Gold", "Canvas", ("Bread", "Apple"))
        sack(-0.38, 0.32, 0.05, 0.035)
    if lvl >= 3:
        # waterput met dakje
        cyl(0.07, 0.075, 0.1, 10, "StoneB", pos=(0.02, 0.05, 0.38))
        cyl(0.055, 0.055, 0.01, 10, "Water", pos=(0.02, 0.14, 0.38), smooth=False)
        for sx in (-1, 1):
            beam((0.02 + sx * 0.07, 0.05, 0.38), (0.02 + sx * 0.07, 0.3, 0.38), 0.012, "Timber")
        for s in (-1, 1):
            box(0.1, 0.012, 0.14, "RoofA", pos=(0.02 + s * 0.04, 0.32, 0.38), rot=(0, 0, -s * 0.6), base=False)
    return {"smoke": [], "anims": {"flag": flag}}


build_levels("market", build, args)
