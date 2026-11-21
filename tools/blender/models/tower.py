"""Village Empire — Watchtower (wachttoren), 3 levels. Stenen toren met steenbanden, houten
uitkijkplatform met balustrade, rood piramidedak en vlag (marker 'flag').
Bouwen: npm run models -- tower"""
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
setup(seed=5202)


def build(lvl):
    earth_base(0.7, 0.7, top=0.04, clumps=10, pebbles=5, flowers=3, keep_clear=[(-0.1, 0.1, 0.2, 0.5)])
    H = 1.12 if lvl < 3 else 1.24
    box(0.46, H, 0.46, "StoneA", pos=(0, 0.04, 0), bevel=0.01)
    for i in range(4):                                           # steenbanden
        box(0.49, 0.035, 0.49, "StoneB", pos=(0, 0.06 + i * H / 4, 0), bevel=0.008)
    for sx in (-1, 1):                                           # hoekstenen
        for sz in (-1, 1):
            for k in range(6):
                box(0.06, 0.05, 0.06, "StoneL" if k % 2 else "StoneB", pos=(sx * 0.215, 0.12 + k * H / 6, sz * 0.215), bevel=0.007)
    # uitkijkplatform
    top = 0.04 + H
    box(0.6, 0.04, 0.6, "Timber", pos=(0, top, 0), bevel=0.006)
    for sx in (-1, 1):
        for sz in (-1, 1):
            beam((sx * 0.27, top, sz * 0.27), (sx * 0.27, top + 0.28, sz * 0.27), 0.028, "Timber")
            beam((sx * 0.22, top - 0.14, sz * 0.22), (sx * 0.29, top, sz * 0.29), 0.02, "Timber")     # schoren
    for s in (-1, 1):
        beam((-0.28, top + 0.1, s * 0.28), (0.28, top + 0.1, s * 0.28), 0.016, "Wood")
        beam((s * 0.28, top + 0.1, -0.28), (s * 0.28, top + 0.1, 0.28), 0.016, "Wood")
    cone_roof(0, 0, top + 0.27, 0.46, 0.42, mats=("RoofA", "RoofB", "RoofC"), rows=3, seg=4)
    flag = flag_pole(0, 0, top + 0.6, 0.34)
    door(0.0, 0.234, w=0.12, h=0.21)
    window(0.0, 0.7, 0.236, "z", lit=True, shutters=None, w=0.08, h=0.1)
    window(0.236, 0.48, 0.0, "x", lit=False, shutters=None, w=0.07, h=0.09)
    if lvl >= 2:
        # schild met wapen boven de deur en een bank met fakkel
        box(0.12, 0.14, 0.015, "BlueC", pos=(0.0, 0.42, 0.24), bevel=0.004)
        box(0.05, 0.05, 0.004, "Gold", pos=(0.0, 0.46, 0.25))
        beam((0.18, 0.2, 0.24), (0.18, 0.3, 0.28), 0.012, "Iron")
        box(0.025, 0.035, 0.025, "Glow", pos=(0.18, 0.3, 0.28))
    if lvl >= 3:
        for sx in (-1, 1):
            box(0.06, 0.26, 0.015, "RedC", pos=(sx * 0.12, top - 0.3, 0.24))          # banieren
        crate(-0.3, 0.3, 0.04, 0.08, 0.2)
        barrel(0.3, 0.3, 0.04)
    return {"smoke": [], "anims": {"flag": flag}}


build_levels("tower", build, args)
