"""Village Empire — Stockyard (opslagerf, 2×2 tegels, 1 level). Omheind, aangestampt erf met
poort en naambord. De goederenstapels zelf tekent de game (VE.StockpileRender), dus het erf
blijft vrij. Poort aan de voorkant bij x = +0.5 (de deurtegel). Bouwen: npm run models -- yard"""
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
setup(seed=6202)
E = 0.86


def post(x, z, h=0.24):
    box(0.045, h, 0.045, "LogD", pos=(x, 0.05, z), bevel=0.006)
    cyl(0.0, 0.03, 0.03, 4, "LogD", pos=(x, 0.05 + h, z), rot=(0, math.pi / 4, 0), cap=False)


def rail(x1, z1, x2, z2):
    for y in (0.12, 0.22):
        beam((x1, y, z1), (x2, y, z2), 0.026, "Wood")


def build(lvl):
    # aangestampt erf (geen grijze plaat) met graspollen langs de buitenrand
    box(1.8, 0.25, 1.8, "EarthD", pos=(0, -0.2, 0), bevel=0.03)
    box(1.74, 0.012, 1.74, "EarthL", pos=(0, 0.038, 0))
    for _ in range(26):
        side = rnd.randrange(4)
        t = rnd.uniform(-0.9, 0.9)
        x, z = [(t, 0.92), (t, -0.92), (0.92, t), (-0.92, t)][side]
        if side == 0 and 0.2 < x < 0.8:
            continue
        grass_clump(x, z, rnd.uniform(0.8, 1.3), 0.05)
    for _ in range(8):
        pebble(rnd.uniform(-0.8, 0.8), rnd.uniform(-0.8, 0.8), rnd.uniform(0.012, 0.02), 0.05)
    s = E / 3
    for k in range(-3, 4):
        post(k * s, -E)
        post(-E, k * s)
        post(E, k * s)
    rail(-E, -E, E, -E)
    rail(-E, -E, -E, E)
    rail(E, -E, E, E)
    for x in (-E, -E * 2 / 3, -E / 3, 0, 0.24, 0.76, E):
        post(x, E)
    rail(-E, E, 0.24, E)
    rail(0.76, E, E, E)
    # poort met balk en naambord
    post(0.24, E, 0.36)
    post(0.76, E, 0.36)
    beam((0.18, 0.42, E), (0.82, 0.42, E), 0.04, "LogD")
    box(0.3, 0.12, 0.02, "WoodL", pos=(0.5, 0.44, E + 0.02), bevel=0.004)
    box(0.2, 0.025, 0.006, "DoorD", pos=(0.5, 0.485, E + 0.032))
    # dekzeil en gereedschap in een hoek
    box(0.2, 0.05, 0.14, "Canvas", pos=(-0.7, 0.04, -0.7), bevel=0.02, smooth=True)
    beam((-0.8, 0.05, -0.55), (-0.75, 0.3, -0.62), 0.014, "WoodL")
    return None


build_levels("yard", build, args, levels=(1,))
