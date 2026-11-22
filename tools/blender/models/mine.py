"""Village Empire — Mijnschacht: één herbruikbaar model met vier varianten (steenkool, ijzer, koper, goud),
elk in drie upgrade-levels, samen in één GLB.

Uitvoer: public/models/mine.glb met de nodes
    mine_l1..l3                      gedeeld door coalmine, ironmine, coppermine en goldmine
    <node>_anim_cart / _anim_wheel   ankers voor het rijdende mijnkarretje en de draaiende katrol (game)
    <node>_pile                      plek voor de uitvoervoorraad (erts)

Herkenbaar: een rotsheuvel met een donkere schachtingang in een houten stutframe met afdakje,
rails over een houten platform naar buiten, een lantaarn, een katrolbok met touw en een ertsstort.
De variant zie je aan de kleur van de aders in de rots, het erts op de stort en het bordje boven de ingang.
Level 2: extra stutten, tweede lantaarn, kisten. Level 3: hogere bok met dakje, ton, gereedschapsrek.

Bouwen: npm run models -- mine
"""
import math
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "lib"))
import ve_blender as ve  # noqa: E402
from ve_parts import *  # noqa: E402,F401,F403
from ve_parts import rnd  # noqa: E402

args = ve.parse_args()
args.budget = max(args.budget, 3600)
ve.reset_scene()
setup(seed=7301, extra_palette={
    "Rock": (0x8E877A, 0.08), "RockD": (0x6E675E, 0.07), "RockL": (0xA8A194, 0.07),
    "Shaft": (0x17120E, 0.0), "Rail": (0x5A5E64, 0.02), "Rope": (0xC9B48A, 0.03),
    "Vein": (0x26262B, 0.06), "Vein2": (0x6F7688, 0.03),
    "Sign": (0xC89A5E, 0.05),
})

# de variant (steenkool, ijzer, koper, goud) kleurt de game in: materialen "Vein" en "Vein2" krijgen
# per mijntype de kleur van het erts (js/glb-models.js, TYPES.<mijn>.tint). Zo is er maar één model.
VEIN, VEIN2, STONE = "Vein", "Vein2", "RockD"


def rock_hill(vein, vein2):
    # rotsheuvel achter de ingang (de berg loopt erin door)
    for (x, y, z, r, sx, sy, sz, m) in (
        (0.0, 0.1, -0.24, 0.3, 1.45, 0.95, 0.9, "Rock"), (-0.26, 0.06, -0.18, 0.2, 1.1, 1.0, 1.0, "RockD"),
        (0.27, 0.07, -0.2, 0.21, 1.1, 0.95, 1.0, "RockL"), (0.0, 0.3, -0.3, 0.2, 1.3, 0.8, 0.8, "RockD"),
        (-0.34, 0.03, 0.06, 0.1, 1.2, 0.7, 1.0, "Rock"), (0.36, 0.03, 0.02, 0.09, 1.1, 0.7, 1.1, "RockD"),
    ):
        blob(r, m, (x, y, z), scale=(sx, sy, sz), sub=2, smooth=False)
    # aders: brokjes van het erts die uit de rots steken
    for k in range(9):
        a = -2.6 + k * 0.62
        x, z = math.cos(a) * 0.34, -0.22 + math.sin(a) * 0.16
        y = 0.14 + (k % 3) * 0.08
        blob(rnd.uniform(0.024, 0.036), vein if k % 3 else vein2, (x, y, z), scale=(1.2, 0.8, 0.9), sub=1, smooth=False)


def entrance(lvl):
    # donkere schacht en stutframe
    box(0.2, 0.22, 0.06, "Shaft", pos=(0, 0.04, -0.02))
    for sx in (-0.12, 0.12):
        beam((sx, 0.04, 0.02), (sx * 0.92, 0.29, 0.02), 0.034, "Timber")
    beam((-0.16, 0.29, 0.02), (0.16, 0.29, 0.02), 0.036, "Timber")
    for sx in (-1, 1):
        beam((sx * 0.12, 0.2, 0.025), (sx * 0.05, 0.29, 0.025), 0.016, "TimberL")      # schoren
    if lvl >= 2:
        for sx in (-0.19, 0.19):
            beam((sx, 0.04, 0.0), (sx * 0.95, 0.24, 0.0), 0.024, "TimberL")
    # afdakje boven de ingang
    a = 0.42
    up = Vector((0.0, math.sin(a), -math.cos(a)))
    nrm = Vector((0.0, math.cos(a), math.sin(a)))
    for ci in range(4):
        for ri in range(2):
            shingle((-0.12 + ci * 0.08 + (0.04 if ri else 0), 0.33 + ri * 0.032, 0.1 - ri * 0.07),
                    up, nrm, 0.078, 0.09, rnd.choice(("ShA", "ShB", "ShC")))


def rails():
    for sx in (-0.045, 0.045):
        box(0.012, 0.012, 0.44, "Rail", pos=(sx, 0.05, 0.2))
    for i in range(6):
        box(0.13, 0.012, 0.026, "LogD", pos=(0, 0.04, 0.02 + i * 0.075), rot=(0, rnd.uniform(-0.06, 0.06), 0))


def platform():
    box(0.2, 0.024, 0.26, "WoodL", pos=(0.27, 0.035, 0.26), bevel=0.004)
    for i in range(4):
        box(0.004, 0.003, 0.26, "Wood", pos=(0.18 + i * 0.06, 0.06, 0.26))
    for sx in (0.18, 0.36):
        for sz in (0.14, 0.38):
            box(0.018, 0.05, 0.018, "Timber", pos=(sx, -0.01, sz))


def ore_heap(x, z, vein, vein2, stone, n=9):
    for k in range(n):
        a = k * 2.399
        r = 0.02 + (k % 4) * 0.018
        blob(rnd.uniform(0.02, 0.03), vein if k % 3 != 2 else stone, (x + math.cos(a) * r, 0.065 + (0.02 if k < 3 else 0), z + math.sin(a) * r),
             scale=(1.1, 0.8, 1.0), sub=1, smooth=False)
    blob(0.016, vein2, (x, 0.1, z), sub=1, smooth=False)


def lantern(x, y, z):
    beam((x, y + 0.06, z), (x, y, z), 0.006, "Iron")
    box(0.032, 0.042, 0.032, "Iron", pos=(x, y - 0.045, z), bevel=0.003)
    box(0.024, 0.032, 0.036, "Glow", pos=(x, y - 0.04, z))
    box(0.036, 0.024, 0.024, "Glow", pos=(x, y - 0.04, z))


def headframe(lvl):
    h = 0.42 if lvl < 3 else 0.5
    x0 = -0.3
    for sz in (0.02, 0.2):
        beam((x0 - 0.04, 0.04, sz), (x0, h, 0.11), 0.022, "Timber")
        beam((x0 + 0.06, 0.04, sz), (x0, h, 0.11), 0.018, "TimberL")
    beam((x0, h - 0.01, 0.0), (x0, h - 0.01, 0.22), 0.02, "Timber")
    cyl(0.004, 0.004, h - 0.12, 4, "Rope", pos=(x0, 0.1, 0.11), smooth=False)
    box(0.05, 0.04, 0.05, "Wood", pos=(x0, 0.07, 0.11), bevel=0.004)                    # emmer aan het touw
    if lvl >= 3:
        prism([(-0.08, h + 0.02), (0.08, h + 0.02), (0, h + 0.1)], 0.16, "ShB", pos=(x0, 0, 0.11), axis="z")
    return (x0, h + 0.0, 0.11)


def sign(vein, x, y, z):
    box(0.11, 0.05, 0.012, "Sign", pos=(x, y, z), bevel=0.003)
    blob(0.014, vein, (x, y + 0.025, z + 0.01), sub=1, smooth=False)
    box(0.006, 0.05, 0.006, "Iron", pos=(x - 0.04, y + 0.05, z))
    box(0.006, 0.05, 0.006, "Iron", pos=(x + 0.04, y + 0.05, z))


def build(lvl):
    earth_base(0.86, 0.82, top=0.04, clumps=4, pebbles=10, flowers=0,
               keep_clear=[(-0.1, 0.1, 0.0, 0.5), (0.15, 0.4, 0.12, 0.42)])
    rock_hill(VEIN, VEIN2)
    entrance(lvl)
    sign(VEIN, 0.0, 0.34, 0.045)
    rails()
    platform()
    lantern(0.13, 0.32, 0.06)
    if lvl >= 2:
        lantern(-0.13, 0.32, 0.06)
        crate(-0.36, 0.34, y=0.04, s=0.075, rot=0.2)
        crate(-0.3, 0.4, y=0.04, s=0.06, rot=-0.3)
    wheel = headframe(lvl)
    if lvl >= 3:
        barrel(0.38, -0.02, y=0.04)
        # gereedschapsrek met houweel en schop
        beam((0.42, 0.04, 0.12), (0.42, 0.2, 0.12), 0.014, "Timber")
        beam((0.42, 0.18, 0.06), (0.42, 0.18, 0.2), 0.012, "Timber")
        box(0.05, 0.012, 0.012, "Iron", pos=(0.43, 0.16, 0.09), rot=(0, 0, 0.5))
        box(0.03, 0.04, 0.006, "Iron", pos=(0.43, 0.09, 0.17))
    for _ in range(6):
        pebble(rnd.uniform(-0.4, 0.4), rnd.uniform(0.32, 0.4), rnd.uniform(0.012, 0.02), 0.04)
    return {"anims": {"cart": (0.0, 0.058, 0.13), "wheel": wheel}, "pile": (0.27, 0.06, 0.27)}


build_levels("mine", build, args)
