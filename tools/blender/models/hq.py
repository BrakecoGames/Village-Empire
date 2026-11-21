"""Village Empire — Village Hall (dorpshuis, 2×2 tegels, 1 level). Middelpunt van elk dorp:
stenen hal met vakwerkverdieping en pannendak, ronde donjon met leien kegeldak en vlag
(marker 'flag'), poortgebouw, waterput en goederen op het voorplein.
Bouwen: npm run models -- hq"""
import math
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "lib"))
import ve_blender as ve  # noqa: E402
from ve_parts import *  # noqa: E402,F401,F403
from ve_parts import rnd  # noqa: E402

args = ve.parse_args()
args.budget = max(args.budget, 6500)
ve.reset_scene()
setup(seed=6101)


def build(lvl):
    earth_base(1.76, 1.76, top=0.045, clumps=22, pebbles=8, flowers=8,
               keep_clear=[(-0.4, 0.6, 0.3, 0.95)])
    # voorplein met platen
    for j in range(3):
        for i in range(6):
            box(0.15, 0.015, 0.15, rnd.choice(("StoneL", "StoneA", "StoneL")), pos=(-0.45 + i * 0.16 + (0.05 if j % 2 else 0), 0.045, 0.5 + j * 0.16),
                rot=(0, rnd.uniform(-0.05, 0.05), 0))
    # hal: stenen begane grond + vakwerkverdieping
    X, Z, W, D = -0.1, -0.2, 1.22, 0.86
    box(W, 0.5, D, "StoneA", pos=(X, 0.045, Z), bevel=0.01)
    for sx in (-1, 1):
        for k in range(5):
            box(0.07, 0.07, 0.07, "StoneL" if k % 2 else "StoneB", pos=(X + sx * (W / 2 - 0.02), 0.08 + k * 0.1, Z + D / 2 - 0.02), bevel=0.008)
    box(W + 0.05, 0.035, D + 0.05, "Timber", pos=(X, 0.545, Z))
    h = house_body(x=X, z=Z, w=W + 0.04, d=D + 0.04, wall_top=0.98, ridge_y=1.46, roof="tile", wall="Plaster",
                   y0=0.58, plinth=False)
    for i, x in enumerate((-0.55, -0.25, 0.05, 0.35)):
        window(x, 0.72, h["front"] + 0.002, "z", lit=i % 2 == 0, shutters="Shutter", w=0.1, h=0.11)
        flower_box(x, 0.66, h["front"], "z", n=3)
    for x in (-0.55, 0.35):
        window(x, 0.24, Z + D / 2 + 0.004, "z", lit=True, shutters=None, w=0.09, h=0.1)
    window(X + W / 2 + 0.006, 0.75, Z, "x", lit=True, shutters="Shutter", w=0.1, h=0.11)
    s1 = chimney(-0.45, -0.38, 1.1, 1.62)
    s2 = chimney(0.2, -0.05, 1.1, 1.58)
    # ronde donjon met kantelen
    tx, tz = 0.58, -0.45
    cyl(0.27, 0.3, 1.55, 14, "StoneA", pos=(tx, 0.045, tz))
    for k in range(4):
        cyl(0.302 - k * 0.008, 0.302 - k * 0.008, 0.035, 14, "StoneB", pos=(tx, 0.3 + k * 0.33, tz), smooth=True, cap=False)
    for i in range(12):
        a = i / 12 * 2 * math.pi
        box(0.07, 0.09, 0.07, "StoneL", pos=(tx + math.cos(a) * 0.28, 1.6, tz + math.sin(a) * 0.28), rot=(0, -a, 0), bevel=0.008)
    cyl(0.31, 0.31, 0.05, 14, "StoneB", pos=(tx, 1.56, tz))
    cone_roof(tx, tz, 1.64, 0.36, 0.58, mats=("SlateA", "SlateB", "SlateC"), rows=4, seg=12)
    flag = flag_pole(tx, tz, 2.2, 0.26)
    for k in range(3):
        window(tx + 0.29, 0.42 + k * 0.38, tz, "x", lit=k == 1, shutters=None, w=0.07, h=0.1)
    # poortgebouw met boog
    gx, gz = 0.1, 0.32
    box(0.5, 0.44, 0.26, "StoneA", pos=(gx, 0.045, gz), bevel=0.008)
    gable_roof(0.62, 0.18, 0.42, 0.66, 3, 6, x=gx, z=gz, kind="tile", mats=ROOFS["tile"][1], ridge_mat="Ridge", ridge_r=0.026)
    box(0.2, 0.26, 0.02, "DoorD", pos=(gx, 0.045, gz + 0.13))
    half_tube((gx, 0.3, gz + 0.135), (0, 0, 1), (0, 1, 0), 0.11, 0.03, "StoneB", seg=8, cap=True)
    half_tube((gx, 0.3, gz + 0.145), (0, 0, 1), (0, 1, 0), 0.1, 0.02, "DoorD", seg=8, cap=True)
    box(0.18, 0.06, 0.015, "BlueC", pos=(gx, 0.45, gz + 0.135), bevel=0.003)          # wapenschild-band
    box(0.05, 0.05, 0.006, "Gold", pos=(gx, 0.455, gz + 0.145))
    # waterput en goederen
    cyl(0.08, 0.09, 0.12, 10, "StoneB", pos=(0.66, 0.045, 0.2))
    cyl(0.065, 0.065, 0.01, 10, "Water", pos=(0.66, 0.16, 0.2), smooth=False)
    for sx in (-1, 1):
        beam((0.66 + sx * 0.075, 0.045, 0.2), (0.66 + sx * 0.075, 0.33, 0.2), 0.014, "Timber")
    for s in (-1, 1):
        box(0.11, 0.014, 0.16, "RoofA", pos=(0.66 + s * 0.045, 0.35, 0.2), rot=(0, 0, -s * 0.6), base=False)
    barrel(0.55, 0.62, 0.045)
    barrel(0.68, 0.55, 0.045)
    crate(-0.62, 0.62, 0.045, 0.09, 0.3)
    crate(-0.74, 0.55, 0.045, 0.08)
    crate(-0.68, 0.58, 0.135, 0.07, 0.6)
    sack(-0.52, 0.72, 0.045, 0.035)
    return {"smoke": [s1, s2], "anims": {"flag": flag}}


build_levels("hq", build, args, levels=(1,))
