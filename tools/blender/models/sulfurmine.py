"""Village Empire — Zwavelmijn (Sulfur Mine), 3 levels. Staat op de helling van de vulkaan.

Uitvoer: public/models/sulfurmine.glb met de nodes
    sulfurmine_l1..l3                      het gebouw per level
    <node>_anim_cart / _anim_wheel         ankers voor het rijdende karretje en de katrol (game)
    <node>_pile                            plek voor de uitvoervoorraad (gele zwavelbrokken)

Herkenbaar: een lage hut van donker basalt met een houten afdak op stutten (tegen de hitte en de dampen),
een sorteertafel vol gele kristallen, manden en zakken met zwavel, een karretje op een kort spoor naar de
helling, een rokende fumarole met een gele korst naast de hut, en een bord met een geel kristal.
Level 2: katrolbok met emmer, tweede mand, gereedschapsrek met houwelen. Level 3: tweede afdak met
droogrekken, een ton water (tegen brand) en een kruiwagen met zwavel.
Bouwen: npm run models -- sulfurmine
"""
import math
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "lib"))
import ve_blender as ve  # noqa: E402
from ve_parts import *  # noqa: E402,F401,F403
from ve_parts import rnd  # noqa: E402

args = ve.parse_args()
args.budget = max(args.budget, 4200)
ve.reset_scene()
setup(seed=6611, extra_palette={
    "Basalt": (0x3E3834, 0.06), "BasaltL": (0x5A524C, 0.06), "Ash": (0x77706A, 0.05), "Scorch": (0x1E1A18, 0.02),
    "Sulf": (0xE8C62E, 0.06), "SulfL": (0xFFF08A, 0.04), "SulfD": (0xC09A1E, 0.05),
    "Rail": (0x5A5E64, 0.02), "Rope": (0xC9B48A, 0.03), "Sign": (0xC89A5E, 0.05), "Cloth": (0xB8A57E, 0.05),
})


def lump(x, y, z, r=0.022):
    blob(r, rnd.choice(("Sulf", "SulfL", "SulfD")), (x, y, z), scale=(1.1, 0.8, 1.0), sub=0, smooth=False)


def basalt_ground():
    # donker, asachtig maaiveld met losse stukken basalt
    earth_base(0.88, 0.84, top=0.04, clumps=0, pebbles=0, flowers=0,
               keep_clear=[(-0.2, 0.05, 0.1, 0.5), (0.15, 0.42, 0.15, 0.42)])
    box(0.8, 0.008, 0.76, "Ash", pos=(0, 0.04, 0))
    for _ in range(9):
        blob(rnd.uniform(0.02, 0.04), rnd.choice(("Basalt", "BasaltL")), (rnd.uniform(-0.4, 0.4), 0.045, rnd.uniform(-0.38, 0.38)),
             scale=(1.2, 0.6, 1.0), sub=0, smooth=False)


def hut(lvl):
    # lage hut van basaltblokken met een plat houten dak
    box(0.34, 0.24, 0.28, "Basalt", pos=(-0.2, 0.04, -0.2), bevel=0.01)
    for i in range(5):
        box(0.35, 0.006, 0.285, "BasaltL", pos=(-0.2, 0.08 + i * 0.045, -0.2))
    box(0.4, 0.03, 0.34, "Timber", pos=(-0.2, 0.28, -0.2), bevel=0.004)
    door(-0.2, -0.059, w=0.1, h=0.16)
    # afdak op stutten voor de hut
    for sx in (-0.36, 0.02):
        beam((sx, 0.04, 0.12), (sx, 0.3, 0.12), 0.024, "Timber")
    a = 0.25
    up = Vector((0.0, math.sin(a), -math.cos(a)))
    nrm = Vector((0.0, math.cos(a), math.sin(a)))
    for ci in range(5):
        for ri in range(2):
            shingle((-0.37 + ci * 0.085 + (0.04 if ri else 0), 0.33 + ri * 0.022, 0.16 - ri * 0.08), up, nrm, 0.085, 0.1,
                    rnd.choice(("ShA", "ShB", "ShC")))
    # bord met een geel kristal
    box(0.1, 0.045, 0.012, "Sign", pos=(-0.2, 0.36, -0.05), bevel=0.003)
    cyl(0.0, 0.012, 0.03, 4, "Sulf", pos=(-0.2, 0.345, -0.04), smooth=False)


def sorting_table(x, z):
    box(0.2, 0.014, 0.1, "WoodL", pos=(x, 0.13, z), bevel=0.003)
    for dx in (-0.085, 0.085):
        for dz in (-0.04, 0.04):
            box(0.014, 0.09, 0.014, "Wood", pos=(x + dx, 0.085, z + dz))
    for i in range(7):
        lump(x - 0.07 + (i % 4) * 0.045, 0.155, z - 0.02 + (i // 4) * 0.04, r=0.016)


def basket(x, z, full=True):
    cyl(0.045, 0.038, 0.06, 10, "Basket" if False else "WoodL", pos=(x, 0.04, z), smooth=False)
    if full:
        for i in range(5):
            a = i * 1.26
            lump(x + math.cos(a) * 0.02, 0.105, z + math.sin(a) * 0.02, r=0.016)


def sack(x, z):
    blob(0.04, "Cloth", (x, 0.075, z), scale=(1.0, 1.2, 0.9), sub=1)
    box(0.03, 0.01, 0.03, "Rope", pos=(x, 0.12, z))
    lump(x + 0.015, 0.13, z, r=0.012)


def fumarole(x, z):
    # rokende opening met een gele korst (de game laat er damp uit komen via de zwavelplekken)
    blob(0.1, "SulfD", (x, 0.035, z), scale=(1.2, 0.15, 1.0), sub=1, smooth=False)
    blob(0.035, "Scorch", (x, 0.045, z), scale=(1.2, 0.3, 1.0), sub=0, smooth=False)
    for k in range(9):
        a = k * 0.7
        cyl(0.0, 0.013, rnd.uniform(0.03, 0.06), 4, "Sulf" if k % 2 else "SulfL", pos=(x + math.cos(a) * 0.07, 0.04, z + math.sin(a) * 0.06),
            rot=(math.sin(a) * 0.3, 0, -math.cos(a) * 0.3), smooth=False)


def track():
    for sx in (-0.045, 0.045):
        box(0.012, 0.012, 0.34, "Rail", pos=(sx + 0.28, 0.05, 0.02))
    for i in range(5):
        box(0.13, 0.012, 0.026, "LogD", pos=(0.28, 0.04, -0.12 + i * 0.07), rot=(0, rnd.uniform(-0.06, 0.06), 0))
    box(0.12, 0.05, 0.03, "Timber", pos=(0.28, 0.06, 0.2), bevel=0.004)          # stootblok


def hoist(lvl):
    h = 0.44 if lvl < 3 else 0.5
    x0, z0 = 0.28, -0.24
    for sx in (-0.07, 0.07):
        beam((x0 + sx, 0.04, z0 + 0.06), (x0, h, z0), 0.018, "Timber")
    beam((x0, 0.04, z0 - 0.1), (x0, h, z0), 0.016, "TimberL")
    cyl(0.004, 0.004, h - 0.2, 4, "Rope", pos=(x0, 0.18, z0), smooth=False)
    cyl(0.03, 0.026, 0.05, 8, "Wood", pos=(x0, 0.13, z0), smooth=False)          # emmer
    lump(x0, 0.185, z0, r=0.014)
    return (x0, h - 0.01, z0)


def build(lvl):
    basalt_ground()
    hut(lvl)
    track()
    sorting_table(-0.16, 0.26)
    basket(0.02, 0.33)
    sack(-0.38, 0.12)
    fumarole(0.36, -0.36)
    wheel = (0.28, 0.3, -0.24)
    if lvl >= 2:
        wheel = hoist(lvl)
        basket(-0.38, 0.3)
        # gereedschapsrek met houwelen
        beam((-0.42, 0.04, -0.02), (-0.42, 0.22, -0.02), 0.012, "Timber")
        beam((-0.42, 0.2, -0.08), (-0.42, 0.2, 0.04), 0.01, "Timber")
        for dz in (-0.05, 0.01):
            box(0.006, 0.14, 0.006, "WoodL", pos=(-0.41, 0.06, dz))
            box(0.05, 0.012, 0.012, "Iron", pos=(-0.41, 0.19, dz), rot=(0, 0, 0.4))
    if lvl >= 3:
        barrel(0.08, -0.38, y=0.04)
        # kruiwagen met zwavel
        box(0.12, 0.05, 0.08, "Wood", pos=(-0.02, 0.08, 0.12), rot=(0, 0.4, 0.12), bevel=0.005)
        cyl(0.03, 0.03, 0.012, 8, "LogD", pos=(0.04, 0.07, 0.15), rot=(math.pi / 2, 0, 0.4))
        for k in range(4):
            lump(-0.04 + k * 0.02, 0.12, 0.11 + (k % 2) * 0.02, r=0.016)
        # droogrek
        for sx in (0.4, 0.4):
            beam((sx, 0.04, 0.02), (sx, 0.22, 0.02), 0.012, "Timber")
        box(0.012, 0.012, 0.16, "Timber", pos=(0.4, 0.21, 0.02))
    return {"anims": {"cart": (0.28, 0.058, -0.06), "wheel": wheel}, "pile": (0.2, 0.06, 0.3)}


build_levels("sulfurmine", build, args)
