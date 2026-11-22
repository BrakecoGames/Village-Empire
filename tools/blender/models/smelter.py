"""Village Empire — Smelter (smelterij), drie upgrade-levels in één GLB.

Herkenbaar: een grote, ronde stenen oven met een gloeiende mond en een hoge bakstenen schoorsteen
(rook), een open werkplaats met leien dak, blaasbalgen naast de oven, een kolenbak, een ertsstort,
gietvormen en stapels metaalstaven. De gloed en de blaasbalg bewegen in de game (ankers 'glow' en
'bellows'); vonken komen uit de ovenmond terwijl er gesmolten wordt.
Level 2: tweede blaasbalg-steun, gereedschapsrek, ton met water. Level 3: tweede schoorsteenring,
aambeeld met hamer, extra stapel staven.

Bouwen: npm run models -- smelter
"""
import math
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "lib"))
import ve_blender as ve  # noqa: E402
from ve_parts import *  # noqa: E402,F401,F403
from ve_parts import rnd  # noqa: E402

args = ve.parse_args()
args.budget = max(args.budget, 3800)
ve.reset_scene()
setup(seed=6611, extra_palette={
    "Oven": (0xA4563A, 0.08), "OvenD": (0x7E3E2A, 0.07), "Soot": (0x2A2220, 0.03), "Mouth": (0x1A1210, 0.0),
    "Coal": (0x26262B, 0.06), "CoalS": (0x6F7688, 0.03), "OreR": (0xB0582C, 0.06),
    "IronB": (0x9AA2AA, 0.03), "CopB": (0xC4703E, 0.03), "GoldB": (0xE8B73A, 0.02),
    "Leather": (0x7A4E2A, 0.05), "Mold": (0x6E675E, 0.05), "Water": (0x4A9BD1, 0.02),
})


def furnace(x, z, lvl):
    # ronde stenen oven (bakstenen ringen), mond aan de voorkant (+z)
    for i in range(5):
        r = 0.2 - i * 0.022
        cyl(r, r + 0.01, 0.075, 14, "Oven" if i % 2 else "OvenD", pos=(x, 0.04 + i * 0.072, z), smooth=False)
    cyl(0.1, 0.11, 0.05, 12, "StoneD", pos=(x, 0.4, z), smooth=False)
    # schoorsteen
    top = 0.95 if lvl >= 3 else 0.88
    cyl(0.07, 0.085, top - 0.43, 10, "Brick", pos=(x, 0.43, z), smooth=False)
    cyl(0.085, 0.085, 0.04, 10, "StoneD", pos=(x, top - 0.04, z), smooth=False)
    if lvl >= 3:
        cyl(0.09, 0.09, 0.03, 10, "StoneD", pos=(x, 0.66, z), smooth=False)
    cyl(0.06, 0.06, 0.012, 10, "Soot", pos=(x, top, z), smooth=False)
    # ovenmond met stenen boog en roet
    box(0.12, 0.1, 0.05, "Mouth", pos=(x, 0.06, z + 0.175))
    for k in range(5):
        a = math.pi * (k + 0.5) / 5
        box(0.04, 0.03, 0.04, "StoneL", pos=(x + math.cos(a) * 0.08, 0.13 + math.sin(a) * 0.04, z + 0.19), rot=(0, 0, a - math.pi / 2), bevel=0.004)
    box(0.15, 0.025, 0.05, "StoneD", pos=(x, 0.035, z + 0.2), bevel=0.004)
    blob(0.06, "Soot", (x, 0.2, z + 0.185), scale=(1.2, 0.8, 0.2), sub=1)
    return (x, top + 0.05, z), (x, 0.07, z + 0.203)


def workshop():
    # open werkplaats achter-links: stenen achtermuur, palen voor, leien dak
    box(0.44, 0.3, 0.05, "StoneA", pos=(-0.16, 0.04, -0.33), bevel=0.006)
    box(0.05, 0.3, 0.3, "StoneB", pos=(-0.36, 0.04, -0.2), bevel=0.006)
    for x in (-0.36, 0.04):
        beam((x, 0.04, 0.0), (x, 0.36, 0.0), 0.028, "Timber")
    beam((-0.38, 0.36, 0.0), (0.06, 0.36, 0.0), 0.026, "Timber")
    gable_roof(0.54, 0.24, 0.32, 0.5, 4, 5, x=-0.16, z=-0.17, kind="shingle",
               mats=("SlateA", "SlateB", "SlateA", "SlateC"), ridge_mat="SlateD", ridge_r=0.024, barge_mat="Timber")
    # werkbank met gietvormen
    box(0.24, 0.016, 0.1, "WoodL", pos=(-0.17, 0.13, -0.24), bevel=0.003)
    for sx in (-0.27, -0.07):
        box(0.02, 0.09, 0.08, "Wood", pos=(sx, 0.04, -0.24))
    for i in range(3):
        box(0.06, 0.02, 0.04, "Mold", pos=(-0.25 + i * 0.075, 0.146, -0.24), bevel=0.003)
        box(0.044, 0.008, 0.024, ("IronB", "CopB", "GoldB")[i], pos=(-0.25 + i * 0.075, 0.162, -0.24))


def bellows(x, z):
    # steun; de blaasbalg zelf beweegt in de game (anker 'bellows')
    box(0.12, 0.05, 0.08, "Wood", pos=(x, 0.04, z), bevel=0.004)
    beam((x - 0.04, 0.09, z + 0.0), (x - 0.11, 0.1, z + 0.0), 0.012, "Iron")      # tuit naar de oven
    return (x, 0.09, z)


def bar_stack(x, z, mat, n=3, rot=0.0):
    for l in range(n):
        for c in range(3 - l % 2):
            if l % 2:
                box(0.09, 0.022, 0.034, mat, pos=(x + (c - 0.5) * 0.04, 0.04 + l * 0.024, z), rot=(0, rot + math.pi / 2, 0), bevel=0.004)
            else:
                box(0.09, 0.022, 0.034, mat, pos=(x, 0.04 + l * 0.024, z + (c - 1) * 0.038), rot=(0, rot, 0), bevel=0.004)


def coal_bin(x, z):
    box(0.16, 0.06, 0.13, "Wood", pos=(x, 0.04, z), bevel=0.004)
    for k in range(10):
        blob(rnd.uniform(0.016, 0.024), "Coal" if k % 4 else "CoalS", (x + rnd.uniform(-0.06, 0.06), 0.1 + (k % 3) * 0.008, z + rnd.uniform(-0.05, 0.05)), sub=1, smooth=False)


def ore_heap(x, z):
    for k in range(8):
        a = k * 2.399; r = 0.015 + (k % 4) * 0.014
        blob(rnd.uniform(0.018, 0.026), "OreR" if k % 3 else "StoneD", (x + math.cos(a) * r, 0.055 + (0.015 if k < 3 else 0), z + math.sin(a) * r), scale=(1.1, 0.8, 1.0), sub=1, smooth=False)


def anvil(x, z):
    cyl(0.04, 0.045, 0.06, 8, "LogD", pos=(x, 0.04, z))
    box(0.08, 0.03, 0.04, "Iron", pos=(x, 0.1, z), bevel=0.004)
    box(0.03, 0.012, 0.03, "Iron", pos=(x + 0.05, 0.115, z))
    beam((x - 0.02, 0.135, z + 0.02), (x - 0.07, 0.15, z + 0.05), 0.009, "WoodL")
    box(0.03, 0.02, 0.02, "Iron", pos=(x - 0.02, 0.13, z + 0.02))


def build(lvl):
    earth_base(0.86, 0.84, top=0.04, clumps=6, pebbles=8, flowers=1,
               keep_clear=[(-0.05, 0.12, 0.1, 0.5), (0.0, 0.42, 0.0, 0.42)])
    workshop()
    smoke, mouth = furnace(0.2, 0.02, lvl)
    bel = bellows(0.4, 0.08)
    coal_bin(-0.28, 0.22)
    ore_heap(0.36, -0.28)
    bar_stack(-0.04, -0.06, "IronB", 3)
    if lvl >= 2:
        barrel(-0.38, -0.02, y=0.04)
        cyl(0.044, 0.044, 0.004, 10, "Water", pos=(-0.38, 0.165, -0.02), smooth=False)
        beam((-0.36, 0.04, -0.3), (-0.36, 0.26, -0.3), 0.012, "Timber")         # rek met tangen
        beam((-0.3, 0.2, -0.3), (-0.3, 0.04, -0.29), 0.006, "Iron")
    if lvl >= 3:
        anvil(0.04, 0.3)
        bar_stack(-0.34, 0.36, "CopB", 2, rot=0.3)
    for _ in range(4):
        pebble(rnd.uniform(0.15, 0.4), rnd.uniform(0.28, 0.4), rnd.uniform(0.012, 0.02), 0.04)
    return {"smoke": [smoke], "anims": {"glow": mouth, "bellows": bel}, "pile": (-0.1, 0.04, 0.34)}


build_levels("smelter", build, args)
