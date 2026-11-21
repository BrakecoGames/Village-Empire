"""Village Empire — Windmill (molen), 3 levels. Taps toelopende witte romp op een stenen voet,
houten omloop, rieten kegeldak. De wieken draaien in de game op marker 'sails'.
Bouwen: npm run models -- windmill"""
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
setup(seed=4202)


def build(lvl):
    earth_base(0.76, 0.76, top=0.04, clumps=10, pebbles=4, flowers=4, keep_clear=[(-0.1, 0.1, 0.2, 0.5)])
    # stenen voet + witte romp
    cyl(0.31, 0.33, 0.14, 14, "StoneB", pos=(0, 0.03, 0), smooth=False)
    for i in range(10):
        a = i / 10 * 2 * math.pi
        box(0.07, 0.05, 0.03, rnd.choice(("StoneA", "StoneL")), pos=(math.cos(a) * 0.32, 0.06, math.sin(a) * 0.32), rot=(0, -a + math.pi / 2, 0), bevel=0.008)
    cyl(0.2, 0.29, 0.82, 14, "Plaster", pos=(0, 0.16, 0))
    # houten omloop
    cyl(0.31, 0.31, 0.03, 14, "Wood", pos=(0, 0.52, 0), smooth=False)
    for i in range(12):
        a = i / 12 * 2 * math.pi
        beam((math.cos(a) * 0.3, 0.55, math.sin(a) * 0.3), (math.cos(a) * 0.3, 0.63, math.sin(a) * 0.3), 0.012, "Timber")
        beam((math.cos(a) * 0.3, 0.41, math.sin(a) * 0.3), (math.cos(a) * 0.235, 0.52, math.sin(a) * 0.235), 0.014, "Timber")
    cyl(0.302, 0.302, 0.012, 14, "Timber", pos=(0, 0.625, 0), cap=False)
    # kap (riet) en as
    cyl(0.215, 0.215, 0.05, 14, "Timber", pos=(0, 0.96, 0))
    cone_roof(0, 0, 1.0, 0.27, 0.38, rows=4, seg=12)
    cyl(0.028, 0.028, 0.16, 8, "Timber", pos=(0, 1.0, 0.16), rot=(math.pi / 2, 0, 0))
    door(0.0, 0.275, w=0.11, h=0.19)
    window(0.0, 0.7, 0.215, "z", lit=True, shutters=None, w=0.07, h=0.08)
    window(0.24, 0.32, 0.0, "x", lit=False, shutters="Shutter", w=0.07, h=0.08)
    # meelzakken
    for k, (x, z) in enumerate(((0.3, 0.26), (0.36, 0.18), (0.24, 0.32))):
        sack(x, z, 0.04, 0.04)
    if lvl >= 2:
        sack(0.32, 0.22, 0.11, 0.035)
        fence((-0.38, 0.2), (-0.38, -0.2), 3)
    if lvl >= 3:
        crate(-0.3, 0.3, 0.04, 0.08, 0.3)
        sack(-0.3, 0.3, 0.12, 0.032)
        blob(0.05, "Leaf", (-0.32, 0.07, -0.3), sub=2)
    return {"smoke": [], "anims": {"sails": (0.0, 1.0, 0.31)}}


build_levels("windmill", build, args)
