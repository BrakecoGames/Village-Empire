"""Village Empire — startvoorraad (2×2 tegels, 1 level), vroeger de Stockyard.

Geen hek en geen poort meer: de goederen die de bewoners meebrachten liggen netjes op houten pallets
op aangestampte grond naast het dorpshuis. De stapels zelf tekent de game (VE.StockpileRender) in de
16 vakken; die liggen hier als markers yard_l1_slot0..15 (gelijk aan VE.STORE_SLOTS.yard in js/models.js).
Is de voorraad op, dan verdwijnt het geheel en komt de grond vrij.
Bouwen: npm run models -- yard"""
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
SLOTS = [(-0.63 + i * 0.42, 0.064, -0.63 + j * 0.42) for j in range(4) for i in range(4)]


def pallet(x, z):
    # twee onderbalken en vijf planken: bovenkant op y = 0.064
    for dz in (-0.1, 0.1):
        box(0.34, 0.018, 0.03, "Timber", pos=(x, 0.034, z + dz))
    for k in range(5):
        box(0.05, 0.012, 0.3, "WoodL" if k % 2 else "Wood", pos=(x - 0.14 + k * 0.07, 0.052, z), rot=(0, rnd.uniform(-0.02, 0.02), 0))


def build(lvl):
    # aangestampte grond, zachte rand met gras (sluit aan op het terrein)
    box(1.84, 0.25, 1.84, "EarthD", pos=(0, -0.21, 0), bevel=0.04)
    box(1.72, 0.008, 1.72, "EarthL", pos=(0, 0.036, 0))
    for _ in range(22):
        side = rnd.randrange(4)
        t = rnd.uniform(-0.92, 0.92)
        x, z = [(t, 0.93), (t, -0.93), (0.93, t), (-0.93, t)][side]
        grass_clump(x, z, rnd.uniform(0.8, 1.2), 0.04)
    for _ in range(6):
        pebble(rnd.uniform(-0.85, 0.85), rnd.uniform(-0.85, 0.85), rnd.uniform(0.01, 0.018), 0.04)
    for (x, y, z) in SLOTS:
        pallet(x, z)
    # paaltje met een bordje aan de voorkant en een opgerold dekzeil
    box(0.03, 0.3, 0.03, "LogD", pos=(-0.88, 0.04, 0.88))
    box(0.18, 0.09, 0.015, "WoodL", pos=(-0.82, 0.26, 0.9), bevel=0.003)
    cyl(0.025, 0.025, 0.2, 8, "Canvas", pos=(0.9, 0.065, -0.9), rot=(math.pi / 2, 0, 0), center=True)
    return {"slots": SLOTS}


build_levels("yard", build, args, levels=(1,))
