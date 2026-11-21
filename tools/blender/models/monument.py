"""Village Empire — Grand Cathedral (kathedraal, 2×2 tegels), 3 levels. Lichtstenen schip met
leien dak, steunberen en hoge vensters; torenfront met roosvenster, grote poort en spits met
gouden kruis. L2: pinakels en goud. L3: apsis met kegeldak en tuin met fontein.
Bouwen: npm run models -- monument"""
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
setup(seed=6303, extra_palette={"Rose": (0x5A7FD6, 0.04), "RoseR": (0xD94A5A, 0.04)})
SLATE = ("SlateA", "SlateB", "SlateC")


def tall_window(x, y, z, h=0.22, w=0.07):
    box(w + 0.03, h + 0.02, 0.012, "StoneL", pos=(x, y - 0.01, z))
    box(w, h, 0.012, "Glow", pos=(x, y, z + 0.004))
    half_tube((x, y + h, z + 0.004), (0, 0, 1), (0, 1, 0), w / 2, 0.012, "Glow", seg=6, cap=True)
    half_tube((x, y + h, z - 0.002), (0, 0, 1), (0, 1, 0), w / 2 + 0.015, 0.012, "StoneL", seg=6, cap=True)


def build(lvl):
    earth_base(1.8, 1.8, top=0.045, clumps=20, pebbles=6, flowers=8, keep_clear=[(-0.4, 0.7, 0.5, 1.0)])
    # plein voor de poort
    for j in range(2):
        for i in range(5):
            box(0.15, 0.015, 0.15, rnd.choice(("StoneL", "StoneA")), pos=(-0.1 + (i - 2) * 0.16, 0.045, 0.66 + j * 0.16))
    # schip (nok langs x)
    NX, NZ, NW, ND = -0.1, -0.3, 1.2, 0.6
    h = house_body(x=NX, z=NZ, w=NW, d=ND, wall_top=0.78, ridge_y=1.24, roof="slate", wall="StoneL", timber=False, plinth=False)
    for i, x in enumerate((-0.55, -0.3, 0.1, 0.35)):
        tall_window(x, 0.32, h["front"] + 0.002)
    for x in (-0.68, -0.42, -0.18, 0.22, 0.48):                  # steunberen
        box(0.06, 0.62, 0.12, "StoneB", pos=(x, 0.045, h["front"] + 0.05), bevel=0.008)
        cyl(0.0, 0.05, 0.1, 4, "SlateA", pos=(x, 0.665, h["front"] + 0.05), rot=(0, math.pi / 4, 0), cap=False)
    # torenfront met spits
    TX, TZ = -0.1, 0.28
    box(0.5, 1.5, 0.5, "StoneL", pos=(TX, 0.045, TZ), bevel=0.012)
    for k in range(3):
        box(0.53, 0.035, 0.53, "StoneB", pos=(TX, 0.5 + k * 0.45, TZ), bevel=0.008)
    cone_roof(TX, TZ, 1.545, 0.36, 1.1, mats=SLATE, rows=5, seg=8)
    blob(0.05, "Gold", (TX, 2.66, TZ), sub=2)
    box(0.02, 0.2, 0.02, "Gold", pos=(TX, 2.68, TZ))
    box(0.12, 0.02, 0.02, "Gold", pos=(TX, 2.82, TZ))
    for sx in (-1, 1):                                           # hoekpinakels
        for sz in (-1, 1):
            cyl(0.0, 0.055, 0.3, 4, "SlateB", pos=(TX + sx * 0.24, 1.545, TZ + sz * 0.24), rot=(0, math.pi / 4, 0), cap=False)
    # roosvenster en grote poort
    f = TZ + 0.25
    cyl(0.14, 0.14, 0.02, 14, "StoneB", pos=(TX, 0.98, f - 0.005), rot=(math.pi / 2, 0, 0))
    cyl(0.12, 0.12, 0.02, 14, "Rose", pos=(TX, 0.98, f + 0.002), rot=(math.pi / 2, 0, 0), smooth=False)
    cyl(0.05, 0.05, 0.02, 10, "RoseR", pos=(TX, 0.98, f + 0.008), rot=(math.pi / 2, 0, 0), smooth=False)
    box(0.22, 0.32, 0.02, "DoorD", pos=(TX, 0.045, f))
    half_tube((TX, 0.365, f + 0.004), (0, 0, 1), (0, 1, 0), 0.13, 0.03, "StoneB", seg=8, cap=True)
    half_tube((TX, 0.365, f + 0.012), (0, 0, 1), (0, 1, 0), 0.11, 0.02, "DoorD", seg=8, cap=True)
    tall_window(TX, 1.22, f + 0.002, h=0.16, w=0.06)
    # tuin: cipressen
    for i in range(4):
        z = -0.7 + i * 0.32
        cyl(0.02, 0.02, 0.06, 5, "Log", pos=(0.7, 0.045, z))
        cyl(0.0, 0.08, 0.36, 8, "GrassD", pos=(0.7, 0.09, z), cap=False)
    if lvl >= 2:
        for x in (-0.68, -0.18, 0.48):
            blob(0.02, "Gold", (x, 0.77, h["front"] + 0.05), sub=1)
        for sx in (-1, 1):
            beam((NX + sx * (NW / 2 + 0.05), 1.0, NZ), (NX + sx * (NW / 2 + 0.05), 1.3, NZ), 0.04, "StoneB")
            cyl(0.0, 0.05, 0.2, 4, "SlateB", pos=(NX + sx * (NW / 2 + 0.05), 1.3, NZ), rot=(0, math.pi / 4, 0), cap=False)
    if lvl >= 3:
        # apsis aan de linkerkant en fontein
        cyl(0.3, 0.3, 0.7, 12, "StoneL", pos=(NX - NW / 2 - 0.12, 0.045, NZ))
        cone_roof(NX - NW / 2 - 0.12, NZ, 0.74, 0.34, 0.3, mats=SLATE, rows=3, seg=12)
        cyl(0.12, 0.14, 0.08, 12, "StoneB", pos=(0.5, 0.045, 0.6))
        cyl(0.1, 0.1, 0.01, 12, "Water", pos=(0.5, 0.12, 0.6), smooth=False)
        cyl(0.02, 0.03, 0.18, 6, "StoneL", pos=(0.5, 0.12, 0.6))
    return None


build_levels("monument", build, args)
