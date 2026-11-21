"""Village Empire — Storehouse (pakhuis), 3 levels. Breed houten pakhuis met leien dak, grote
dubbele deur, hijsbalk met katrol en goederen voor de deur. Bouwen: npm run models -- warehouse"""
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
setup(seed=5606)


def build(lvl):
    earth_base(0.9, 0.86, top=0.04, clumps=8, pebbles=3, flowers=2,
               keep_clear=[(-0.18, 0.18, 0.2, 0.5), (0.22, 0.46, 0.2, 0.5), (-0.46, -0.2, 0.2, 0.5)])
    h = house_body(x=0.0, z=-0.06, w=0.66, d=0.5, wall_top=0.44, ridge_y=0.8, roof="slate", wall="WoodL", timber=False)
    f = h["front"]
    for i in range(10):                                          # verticale planken
        beam((-0.31 + i * 0.069, 0.06, f + 0.004), (-0.31 + i * 0.069, 0.44, f + 0.004), 0.012, "Wood")
    for sx in (-1, 1):
        beam((sx * 0.335, 0.06, f + 0.006), (sx * 0.335, 0.44, f + 0.006), 0.026, "Timber")
    # dubbele deur met kruislatten
    box(0.26, 0.3, 0.02, "DoorD", pos=(0, 0.06, f + 0.008))
    for sx in (-1, 1):
        beam((sx * 0.13, 0.07, f + 0.02), (0, 0.35, f + 0.02), 0.012, "Door")
    beam((-0.14, 0.36, f + 0.02), (0.14, 0.36, f + 0.02), 0.02, "Timber")
    # hijsbalk met katrol en luik
    box(0.12, 0.09, 0.015, "DoorD", pos=(0, 0.5, f - 0.02))
    beam((0, 0.66, f - 0.05), (0, 0.66, f + 0.12), 0.026, "Timber")
    cyl(0.02, 0.02, 0.014, 8, "Iron", pos=(0, 0.64, f + 0.1), rot=(0, 0, -math.pi / 2))
    cyl(0.003, 0.003, 0.4, 4, "DoorD", pos=(0, 0.24, f + 0.1), smooth=False)
    crate(0.0, f + 0.1, 0.2, 0.06)
    # goederen
    crate(0.32, 0.36, 0.04, 0.09, 0.2)
    crate(0.38, 0.28, 0.04, 0.08)
    crate(0.34, 0.33, 0.13, 0.07, 0.5)
    barrel(-0.3, 0.35, 0.04)
    barrel(-0.38, 0.28, 0.04)
    if lvl >= 2:
        sack(-0.22, 0.4, 0.04, 0.035)
        sack(0.22, 0.42, 0.04, 0.035)
        crate(0.38, -0.36, 0.04, 0.08)
    if lvl >= 3:
        barrel(-0.38, -0.34, 0.04)
        barrel(-0.3, -0.38, 0.04)
        crate(0.38, -0.36, 0.12, 0.07, 0.3)
    return None


build_levels("warehouse", build, args)
