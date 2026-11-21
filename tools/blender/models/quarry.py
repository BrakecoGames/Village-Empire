"""Village Empire — Quarry (steenhouwerij), 3 levels. Herkenbaar aan de stenen hut met leien dak,
gestapelde blokken en de houten kraan met hangend blok. Bouwen: npm run models -- quarry"""
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
setup(seed=3202)


def block(x, z, y=0.04, s=1.0, mat=None):
    box(0.09 * s, 0.065 * s, 0.075 * s, mat or rnd.choice(("StoneA", "StoneL", "StoneB")),
        pos=(x, y, z), rot=(0, rnd.uniform(-0.15, 0.15), 0), bevel=0.008)


def crane(x, z, h=0.55, reach=0.32):
    beam((x, 0.04, z), (x, h, z), 0.032, "Timber")
    beam((x - 0.07, 0.04, z), (x, 0.24, z), 0.018, "Timber")          # schoren
    beam((x, 0.04, z + 0.07), (x, 0.24, z), 0.018, "Timber")
    beam((x + 0.02, h - 0.02, z), (x - reach, h - 0.02, z), 0.026, "Timber")
    beam((x, h - 0.12, z), (x - reach * 0.6, h - 0.025, z), 0.016, "Timber")
    hx = x - reach + 0.03
    cyl(0.003, 0.003, h - 0.32, 4, "DoorD", pos=(hx, 0.3, z), smooth=False)
    block(hx, z, y=0.24, s=0.9, mat="StoneL")
    cyl(0.035, 0.035, 0.03, 8, "Wood", pos=(x + 0.02, 0.2, z - 0.015), rot=(math.pi / 2, 0, 0))  # lier


def build(lvl):
    earth_base(0.84, 0.78, top=0.04, clumps=8, pebbles=8, flowers=2,
               keep_clear=[(-0.22, -0.02, 0.06, 0.5), (0.06, 0.46, 0.08, 0.46)])
    h = house_body(x=-0.13, z=-0.13, w=0.42, d=0.34, wall_top=0.36, ridge_y=0.61, roof="slate",
                   wall="StoneA", timber=False)
    door(-0.13, h["front"], w=0.11, h=0.18)
    window(h["right"] + 0.002, 0.2, -0.13, "x", lit=False, shutters="Shutter", w=0.08, h=0.08)
    # geen vaste blokkenstapel: de game legt de werkelijke voorraad stenen op de marker 'pile'
    crane(0.34, -0.26, h=0.56 if lvl < 3 else 0.66, reach=0.3)
    # puin en gereedschap
    for _ in range(5):
        pebble(rnd.uniform(-0.38, -0.2), rnd.uniform(0.18, 0.36), rnd.uniform(0.014, 0.024), 0.04)
    beam((-0.33, 0.04, 0.3), (-0.3, 0.19, 0.27), 0.012, "WoodL")
    box(0.07, 0.014, 0.012, "Iron", pos=(-0.3, 0.18, 0.27), rot=(0, 0, 0.3))
    if lvl >= 3:
        # kruiwagen met stenen
        box(0.12, 0.05, 0.08, "Wood", pos=(0.05, 0.08, 0.36), rot=(0, 0.3, 0.12), bevel=0.005)
        cyl(0.03, 0.03, 0.012, 8, "LogD", pos=(0.11, 0.07, 0.38), rot=(math.pi / 2, 0, 0.3))
        for k in range(3):
            pebble(0.04 + k * 0.025, 0.36, 0.018, 0.12)
        block(-0.34, -0.35, s=1.1)
    return {"pile": (0.26, 0.04, 0.27)}


build_levels("quarry", build, args)
