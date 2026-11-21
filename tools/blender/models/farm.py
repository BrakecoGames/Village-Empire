"""Village Empire — Grain Farm (boerderij), 3 levels. Boerderij met rieten dak, rode schuur met
witte deur, hooibalen. L2: meer hooi + kar. L3: vogelverschrikker en pompoenen.
Bouwen: npm run models -- farm"""
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
setup(seed=4101)


def build(lvl):
    earth_base(0.84, 0.8, top=0.04, clumps=10, pebbles=3, flowers=4,
               keep_clear=[(-0.3, -0.05, 0.18, 0.5), (0.1, 0.46, 0.1, 0.46)])
    h = house_body(x=-0.14, z=0.04, w=0.42, d=0.3, wall_top=0.35, ridge_y=0.64, roof="thatch", wall="Plaster")
    door(-0.2, h["front"], w=0.11, h=0.18)
    window(-0.04, 0.19, h["front"] + 0.002, "z", lit=True, shutters="ShutterG", w=0.08, h=0.08)
    flower_box(-0.04, 0.14, h["front"], "z", n=3)
    smoke = chimney(-0.28, -0.04, 0.4, 0.78)
    # rode schuur achter rechts
    b = house_body(x=0.24, z=-0.22, w=0.28, d=0.28, wall_top=0.32, ridge_y=0.54, roof="slate",
                   wall="BarnRed", timber=False, plinth=False)
    box(0.13, 0.18, 0.012, "DoorD", pos=(0.24, 0.06, b["front"] + 0.002))
    # witte kozijnlatten met kruis (klassieke schuurdeur)
    beam((0.24 - 0.065, 0.07, b["front"] + 0.01), (0.24 + 0.065, 0.23, b["front"] + 0.01), 0.012, "Canvas")
    beam((0.24 - 0.065, 0.24, b["front"] + 0.01), (0.24 + 0.065, 0.24, b["front"] + 0.01), 0.012, "Canvas")
    for sx in (-1, 1):
        beam((0.24 + sx * 0.065, 0.06, b["front"] + 0.01), (0.24 + sx * 0.065, 0.24, b["front"] + 0.01), 0.012, "Canvas")
    window(0.24, 0.38, b["front"] + 0.002, "z", lit=False, shutters=None, w=0.06, h=0.06)
    # geen vaste hooibalen: de werkelijke voorraad graan ligt op de marker 'pile'
    if lvl >= 2:
        # handkar (leeg)
        box(0.14, 0.04, 0.1, "Wood", pos=(0.06, 0.09, 0.36), rot=(0, 0.4, 0), bevel=0.005)
        for sz in (-1, 1):
            cyl(0.04, 0.04, 0.012, 8, "LogD", pos=(0.06 + sz * 0.03, 0.08, 0.36 + sz * 0.05), rot=(math.pi / 2, 0, 0.4))
    if lvl >= 3:
        # vogelverschrikker
        beam((-0.38, 0.04, 0.32), (-0.38, 0.28, 0.32), 0.014, "Wood")
        beam((-0.45, 0.22, 0.32), (-0.31, 0.22, 0.32), 0.012, "Wood")
        blob(0.03, "Sack", (-0.38, 0.29, 0.32), sub=1)
        cyl(0.0, 0.045, 0.03, 8, "Hay", pos=(-0.38, 0.305, 0.32), cap=False)
        box(0.06, 0.07, 0.03, "BlueC", pos=(-0.38, 0.17, 0.32), bevel=0.004)
        for k in range(3):
            blob(0.028, "Pumpkin", (0.0 + k * 0.06, 0.06, -0.4 + (k % 2) * 0.03), scale=(1.2, 0.85, 1.2), sub=1)
    return {"smoke": [smoke], "pile": (0.3, 0.04, 0.27)}


build_levels("farm", build, args)
