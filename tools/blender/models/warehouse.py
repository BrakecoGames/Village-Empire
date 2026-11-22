"""Village Empire — Storehouse (open opslagloods), 3 levels.

Een open houten loods: achterwand en zijschotten van planken, een lessenaarsdak van leien over de achterste
rij vakken, en een vloer van planken met lage schotjes tussen de vakken. De goederen liggen zichtbaar in de
vakken; de game (VE.StockpileRender) legt daar de echte inhoud van de opslag als nette stapels neer.
Vakken: markers warehouse_l<n>_slot<i> (gelijk aan VE.STORE_SLOTS.warehouse in js/models.js).
  level 1: 6 vakken (60 goederen) · level 2: 9 vakken (80) · level 3: 9 vakken (100), met lantaarn en hijsbalk.
Deur (looproute van de dragers) aan de voorkant, +z. Bouwen: npm run models -- warehouse"""
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

FLOOR_Y = 0.055
XS = [-0.27, 0.0, 0.27]


def rows(lvl):
    return [-0.2, 0.16] if lvl == 1 else [-0.28, -0.04, 0.2]   # level 2 en 3: drie rijen diep


def slots(lvl):
    return [(x, FLOOR_Y, z) for z in rows(lvl) for x in XS]


def roof(x0, x1, z_back, y_back, z_front, y_front, rows=5):
    """lessenaarsdak van leien, aflopend naar voren"""
    ang = math.atan2(y_back - y_front, z_front - z_back)
    length = math.hypot(z_front - z_back, y_back - y_front)
    w = x1 - x0
    box(w + 0.02, 0.014, length + 0.04, "RoofDeck", pos=((x0 + x1) / 2, (y_back + y_front) / 2 - 0.012, (z_back + z_front) / 2), rot=(ang, 0, 0), base=False)
    for r in range(rows):
        t = (r + 0.5) / rows
        z = z_back + (z_front - z_back) * t
        y = y_back + (y_front - y_back) * t
        for c in range(6):
            sw = w / 6
            box(sw * 0.97, 0.012, length / rows * 1.18, ["SlateA", "SlateB", "SlateC"][(r + c) % 3],
                pos=(x0 + sw * (c + 0.5), y + 0.004, z), rot=(ang + 0.06, rnd.uniform(-0.015, 0.015), 0), base=False)


def build(lvl):
    earth_base(0.92, 0.9, top=0.04, clumps=7, pebbles=3, flowers=1, keep_clear=[(-0.48, 0.48, -0.45, 0.34)])
    S = slots(lvl)
    half = 0.45
    # vloer van planken op twee balken
    for z in (-0.33, 0.0, 0.24):
        box(0.92, 0.02, 0.04, "Timber", pos=(0, 0.035, z))
    for k in range(9):
        z = -0.4 + k * 0.088
        box(0.9, 0.008, 0.084, "Wood" if k % 2 else "WoodL", pos=(0, 0.047, z))
    # achterwand en zijschotten (verticale planken) met staanders
    for i in range(11):
        x = -0.43 + i * 0.086
        box(0.084, 0.5, 0.02, "WoodL" if i % 2 else "Wood", pos=(x, 0.05, -0.44))
    for sx in (-1, 1):
        for k in range(4):
            box(0.02, 0.36 - k * 0.02, 0.1, "Wood" if k % 2 else "WoodL", pos=(sx * 0.46, 0.05, -0.39 + k * 0.1))
        beam((sx * 0.46, 0.05, -0.45), (sx * 0.46, 0.6, -0.45), 0.035, "Timber")
        beam((sx * 0.46, 0.05, -0.02), (sx * 0.46, 0.47, -0.02), 0.035, "Timber")
        beam((sx * 0.46, 0.47, -0.02), (sx * 0.46, 0.6, -0.45), 0.03, "Timber")
    beam((-0.47, 0.47, -0.02), (0.47, 0.47, -0.02), 0.034, "Timber")      # voorste dakbalk
    roof(-0.5, 0.5, -0.5, 0.64, 0.04, 0.47)
    # lage schotjes tussen de vakken en een kantplank aan de voorkant
    for i in range(len(XS) - 1):
        x = (XS[i] + XS[i + 1]) / 2
        for z in rows(lvl):
            box(0.018, 0.07, 0.22, "Timber", pos=(x, FLOOR_Y - 0.004, z))
    box(0.9, 0.035, 0.022, "Timber", pos=(0, FLOOR_Y - 0.004, 0.31))
    # bordje met een krat erop
    box(0.2, 0.08, 0.015, "WoodL", pos=(0, 0.5, -0.005), bevel=0.003)
    box(0.04, 0.04, 0.004, "DoorD", pos=(0, 0.52, 0.004))
    if lvl >= 2:
        # lantaarn aan de dakbalk
        cyl(0.003, 0.003, 0.06, 4, "Iron", pos=(0.4, 0.41, 0.0), smooth=False)
        box(0.035, 0.045, 0.035, "Glow", pos=(0.4, 0.37, 0.0))
        cyl(0.0, 0.028, 0.02, 4, "Iron", pos=(0.4, 0.415, 0.0), rot=(0, math.pi / 4, 0), cap=False)
    if lvl >= 3:
        # hijsbalk met katrol boven de linkerkant
        beam((-0.42, 0.6, -0.4), (-0.42, 0.82, -0.4), 0.03, "Timber")
        beam((-0.42, 0.8, -0.4), (-0.42, 0.8, -0.1), 0.026, "Timber")
        cyl(0.02, 0.02, 0.014, 8, "Iron", pos=(-0.42, 0.78, -0.12), rot=(0, 0, -math.pi / 2), center=True)
        cyl(0.003, 0.003, 0.28, 4, "DoorD", pos=(-0.42, 0.5, -0.12), smooth=False)
    return {"slots": S}


build_levels("warehouse", build, args)
