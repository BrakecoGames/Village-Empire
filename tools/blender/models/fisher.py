"""Village Empire — Fisher (vissershut), 3 levels. Houten hut met blauw pannendak op een
vlonder op palen, netten op een rek, bootje en viskist. Bouwen: npm run models -- fisher"""
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
setup(seed=4404, extra_palette={"Net": (0x6D6A55, 0.12), "Fish": (0x9FB3C0, 0.05)})
BLUE = ("TileBlueA", "TileBlueA", "TileBlueB", "TileBlueC")


def boat(c, axis, r, length, mat):
    """Bootje: romp (halve buis, bolling omlaag) met een binnenvloer en bank. De game tekent
    alleen voorkanten; zonder vloer zou je van bovenaf door de romp heen kijken."""
    half_tube(c, axis, (0, -1, 0), r, length, mat, seg=6, cap=True)
    fl = box(r * 1.7, length * 0.92, 0.008, "WoodL", base=False)
    orient(fl, (c[0], c[1] - r * 0.45, c[2]), axis, (0, 1, 0))
    seat = box(r * 1.9, 0.03, 0.012, "Wood", base=False)
    orient(seat, (c[0], c[1] - r * 0.1, c[2]), axis, (0, 1, 0))


def build(lvl):
    # palen tot in de grond/het water en een plankenvlonder
    for sx in (-0.3, -0.05, 0.22):
        for sz in (-0.22, 0.14):
            cyl(0.022, 0.026, 0.32, 6, "LogD", pos=(sx, -0.22, sz))
    for i in range(9):
        box(0.07, 0.022, 0.46, "Wood" if i % 2 else "WoodL", pos=(-0.33 + i * 0.065, 0.075, -0.04), bevel=0.004)
    h = house_body(x=-0.07, z=-0.08, w=0.4, d=0.3, wall_top=0.38, ridge_y=0.62, roof="tile", wall="WoodL",
                   timber=False, y0=0.1, plinth=False, roof_color=BLUE)
    # verticale latten op de houten wand
    for i in range(6):
        beam((-0.25 + i * 0.07, 0.1, h["front"] + 0.004), (-0.25 + i * 0.07, 0.38, h["front"] + 0.004), 0.01, "Wood")
    door(-0.12, h["front"] + 0.006, w=0.1, h=0.17)
    window(h["right"] + 0.002, 0.25, -0.08, "x", lit=True, shutters="Shutter", w=0.07, h=0.08)
    # netten op een rek
    for z in (-0.2, 0.2):
        beam((0.34, 0.0, z), (0.34, 0.3, z), 0.018, "LogD")
    beam((0.34, 0.29, -0.22), (0.34, 0.29, 0.22), 0.014, "LogD")
    box(0.008, 0.2, 0.36, "Net", pos=(0.34, 0.08, 0.0), bevel=0.0)
    for k in range(4):
        blob(0.012, "Gold", (0.345, 0.1 + (k % 2) * 0.09, -0.12 + k * 0.08), sub=0)
    # bootje (halve romp) en viskist
    boat((-0.22, 0.11, 0.32), (1, 0, 0.25), 0.07, 0.32, "Log")
    box(0.1, 0.035, 0.07, "Wood", pos=(0.12, 0.096, 0.13), bevel=0.004)
    for k in range(3):
        blob(0.016, "Fish", (0.1 + k * 0.025, 0.135, 0.13), scale=(1.8, 0.6, 0.8), sub=1)
    if lvl >= 2:
        cyl(0.04, 0.035, 0.08, 8, "Wood", pos=(0.18, 0.097, -0.22))     # emmer/ton
        for k in range(2):
            beam((0.0 + k * 0.05, 0.097, 0.18), (0.08 + k * 0.05, 0.25, 0.1), 0.007, "WoodL")  # hengels
    if lvl >= 3:
        # tweede bootje en lantaarn
        boat((-0.2, 0.1, -0.36), (1, 0, -0.2), 0.06, 0.28, "LogD")
        beam((-0.32, 0.097, 0.16), (-0.32, 0.32, 0.16), 0.014, "Timber")
        box(0.03, 0.04, 0.03, "Glow", pos=(-0.32, 0.28, 0.19), bevel=0.003)
    return None


build_levels("fisher", build, args)
