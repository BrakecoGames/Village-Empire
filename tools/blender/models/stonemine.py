"""Village Empire — Steenmijn (Stone Mine), 3 levels. Hakt bouwsteen uit het gesteente van de berg zelf.

Uitvoer: public/models/stonemine.glb met de nodes
    stonemine_l1..l3                       het gebouw per level
    <node>_anim_cart / _anim_wheel         ankers voor het rijdende mijnkarretje en de draaiende katrol (game)
    <node>_pile                            plek voor de uitvoervoorraad (rechthoekige bouwstenen)

Herkenbaar: een rotswand met uitgehakte, rechthoekige trappen (zaagsneden en boorgaten zichtbaar),
een mijnschacht in een stevig houten stutframe met afdakje, rails naar buiten, een geparkeerd
mijnkarretje vol rechthoekige blokken, een stapel netjes gezaagde bouwstenen op een pallet en een lier.
Level 2: houten bok met katrol boven de groeve, tweede lantaarn, gereedschapskist.
Level 3: tweede karretje, steenhouwersbank met beitels en een slee met een groot blok, hogere bok met dakje.

Bouwen: npm run models -- stonemine
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
setup(seed=7411, extra_palette={
    "Rock": (0x8E877A, 0.07), "RockD": (0x6E675E, 0.06), "RockL": (0xA8A194, 0.06),
    "Cut": (0xC2BAAC, 0.04), "CutD": (0x9C9486, 0.04), "Shaft": (0x17120E, 0.0),
    "Rail": (0x5A5E64, 0.02), "Rope": (0xC9B48A, 0.03), "Drill": (0x2E2A26, 0.0),
    "Sign": (0xC89A5E, 0.05), "Block": (0xBDB4A4, 0.05), "BlockL": (0xD3CCBE, 0.04), "BlockD": (0xA39A8A, 0.05),
})


def stone_block(x, y, z, w=0.075, h=0.05, d=0.06, rot=0.0, mat=None):
    """rechthoekige bouwsteen met een klein afgeschuinde rand"""
    box(w, h, d, mat or rnd.choice(("Block", "BlockL", "BlockD")), pos=(x, y, z), rot=(0, rot, 0), bevel=0.004)


def rock_face(lvl):
    # de berg achter de mijn: brokkige rots met uitgehakte, rechthoekige treden (de groeve)
    for (x, y, z, r, sx, sy, sz, m) in (
        (0.0, 0.08, -0.3, 0.3, 1.5, 1.05, 0.75, "Rock"), (-0.3, 0.05, -0.22, 0.2, 1.1, 1.1, 1.0, "RockD"),
        (0.31, 0.06, -0.24, 0.2, 1.1, 1.0, 1.0, "RockL"), (0.05, 0.36, -0.36, 0.18, 1.5, 0.7, 0.7, "RockD"),
        (-0.38, 0.02, 0.04, 0.09, 1.2, 0.7, 1.0, "Rock"),
    ):
        blob(r, m, (x, y, z), scale=(sx, sy, sz), sub=2, smooth=False)
    # treden van de groeve (rechts van de schacht): strakke, vlakke sneden in lichte, verse steen
    for n, (y, z, w) in enumerate(((0.06, -0.06, 0.26), (0.14, -0.13, 0.22), (0.22, -0.2, 0.18), (0.3, -0.26, 0.14))):
        box(w, 0.08, 0.1, "Cut" if n % 2 == 0 else "CutD", pos=(0.26, y - 0.04, z), bevel=0.003)
        # zaagsnede en boorgaten in de voorkant van elke trede
        box(w * 0.92, 0.004, 0.004, "Drill", pos=(0.26, y - 0.02, z + 0.051))
        for q in range(3):
            cyl(0.004, 0.004, 0.006, 6, "Drill", pos=(0.26 - w * 0.3 + q * w * 0.3, y - 0.05, z + 0.05), rot=(math.pi / 2, 0, 0))
    # half losgehakt blok op de onderste trede
    stone_block(0.2, 0.065, -0.02, w=0.08, h=0.05, d=0.06, rot=0.08, mat="BlockL")
    if lvl >= 2:
        stone_block(0.3, 0.145, -0.1, w=0.07, h=0.045, d=0.055, rot=-0.1)


def entrance(lvl):
    box(0.19, 0.21, 0.06, "Shaft", pos=(-0.12, 0.04, -0.06))
    for sx in (-0.23, -0.01):
        beam((sx, 0.04, -0.02), (sx * 0.98, 0.29, -0.02), 0.034, "Timber")
    beam((-0.27, 0.29, -0.02), (0.03, 0.29, -0.02), 0.036, "Timber")
    for sx, ex in ((-0.23, -0.17), (-0.01, -0.07)):
        beam((sx, 0.2, 0.0), (ex, 0.29, 0.0), 0.016, "TimberL")                     # schoren
    if lvl >= 2:
        for sx in (-0.29, 0.05):
            beam((sx, 0.04, -0.04), (sx, 0.24, -0.04), 0.024, "TimberL")
    # afdakje boven de schacht
    a = 0.42
    up = Vector((0.0, math.sin(a), -math.cos(a)))
    nrm = Vector((0.0, math.cos(a), math.sin(a)))
    for ci in range(4):
        for ri in range(2):
            shingle((-0.23 + ci * 0.075 + (0.037 if ri else 0), 0.33 + ri * 0.032, 0.06 - ri * 0.07),
                    up, nrm, 0.074, 0.09, rnd.choice(("ShA", "ShB", "ShC")))
    # bordje met een bouwsteen
    box(0.1, 0.045, 0.012, "Sign", pos=(-0.12, 0.34, 0.01), bevel=0.003)
    box(0.034, 0.022, 0.006, "BlockL", pos=(-0.12, 0.343, 0.018), bevel=0.002)


def rails(length=0.46):
    for sx in (-0.165, -0.075):
        box(0.012, 0.012, length, "Rail", pos=(sx, 0.05, 0.16))
    for i in range(6):
        box(0.13, 0.012, 0.026, "LogD", pos=(-0.12, 0.04, -0.02 + i * 0.075), rot=(0, rnd.uniform(-0.06, 0.06), 0))
    # stootblok aan het eind
    box(0.12, 0.05, 0.03, "Timber", pos=(-0.12, 0.06, 0.39), bevel=0.004)


def parked_cart(x, z, rot=0.0, full=True):
    """mijnkarretje met ijzeren banden, wielen en een lading rechthoekige blokken"""
    c, s = math.cos(rot), math.sin(rot)
    P = lambda dx, dz: (x + dx * c + dz * s, z - dx * s + dz * c)
    box(0.12, 0.065, 0.15, "Wood", pos=(x, 0.075, z), rot=(0, rot, 0), bevel=0.006)
    for dz in (-0.05, 0.05):
        px, pz = P(0, dz)
        box(0.125, 0.008, 0.008, "Iron", pos=(px, 0.13, pz), rot=(0, rot, 0))
    for dx in (-0.066, 0.066):
        for dz in (-0.045, 0.045):
            px, pz = P(dx, dz)
            cyl(0.022, 0.022, 0.012, 8, "Iron", pos=(px, 0.062, pz), rot=(0, rot, math.pi / 2), center=True)
    if full:
        for q, (dx, dz, dy) in enumerate(((-0.028, -0.034, 0), (0.028, -0.034, 0), (-0.028, 0.034, 0), (0.028, 0.034, 0), (0.0, 0.0, 0.045))):
            px, pz = P(dx, dz)
            stone_block(px, 0.13 + dy, pz, w=0.052, h=0.04, d=0.06, rot=rot + rnd.uniform(-0.12, 0.12))


def pallet_stack(x, z, rows=3):
    """pallet met keurig gestapelde bouwstenen in verband"""
    for i in range(3):
        box(0.2, 0.012, 0.03, "WoodL", pos=(x, 0.046, z - 0.07 + i * 0.07))
    for r in range(rows):
        off = 0.0 if r % 2 == 0 else 0.03
        for q in range(3 - (r % 2)):
            for p in range(2):
                stone_block(x - 0.06 + off + q * 0.06, 0.08 + r * 0.045, z - 0.035 + p * 0.07, w=0.055, h=0.04, d=0.062, rot=0.0)


def lantern(x, y, z):
    beam((x, y + 0.06, z), (x, y, z), 0.006, "Iron")
    box(0.032, 0.042, 0.032, "Iron", pos=(x, y - 0.045, z), bevel=0.003)
    box(0.024, 0.032, 0.036, "Glow", pos=(x, y - 0.04, z))
    box(0.036, 0.024, 0.024, "Glow", pos=(x, y - 0.04, z))


def derrick(lvl):
    """houten bok met katrol boven de groeve: tilt de blokken van de treden"""
    h = 0.5 if lvl < 3 else 0.58
    x0, z0 = 0.3, -0.06
    for sx in (-0.1, 0.1):
        beam((x0 + sx, 0.04, z0 + 0.1), (x0, h, z0), 0.02, "Timber")
    beam((x0, 0.3, z0 - 0.16), (x0, h, z0), 0.02, "TimberL")
    beam((x0, h, z0), (x0 - 0.02, h - 0.02, z0 + 0.12), 0.016, "Timber")
    cyl(0.004, 0.004, h - 0.22, 4, "Rope", pos=(x0 - 0.02, 0.2, z0 + 0.12), smooth=False)
    stone_block(x0 - 0.02, 0.19, z0 + 0.12, w=0.06, h=0.04, d=0.05, mat="BlockL")
    if lvl >= 3:
        prism([(-0.07, h + 0.02), (0.07, h + 0.02), (0, h + 0.09)], 0.12, "ShB", pos=(x0, 0, z0), axis="z")
    return (x0, h - 0.01, z0)


def winch(x, z):
    box(0.1, 0.06, 0.08, "Timber", pos=(x, 0.07, z), bevel=0.004)
    cyl(0.03, 0.03, 0.1, 8, "Wood", pos=(x, 0.12, z), rot=(0, 0, math.pi / 2), center=True)
    cyl(0.031, 0.031, 0.04, 8, "Rope", pos=(x, 0.12, z), rot=(0, 0, math.pi / 2), center=True)
    beam((x + 0.06, 0.12, z), (x + 0.09, 0.17, z + 0.03), 0.008, "Iron")              # slinger


def mason_bench(x, z):
    box(0.18, 0.016, 0.08, "WoodL", pos=(x, 0.12, z), bevel=0.003)
    for dx in (-0.075, 0.075):
        box(0.014, 0.08, 0.06, "Wood", pos=(x + dx, 0.08, z))
    stone_block(x - 0.03, 0.15, z, w=0.07, h=0.04, d=0.05, mat="BlockL")
    box(0.05, 0.006, 0.006, "Iron", pos=(x + 0.05, 0.132, z + 0.02), rot=(0, 0.4, 0))       # beitel
    box(0.03, 0.02, 0.02, "DoorD", pos=(x + 0.06, 0.138, z - 0.02))                           # houten hamer


def build(lvl):
    earth_base(0.88, 0.84, top=0.04, clumps=3, pebbles=12, flowers=0,
               keep_clear=[(-0.2, -0.04, 0.0, 0.5), (0.2, 0.42, 0.12, 0.32)])
    rock_face(lvl)
    entrance(lvl)
    rails()
    lantern(0.01, 0.32, 0.02)
    parked_cart(0.08, 0.3, rot=0.35, full=True)
    pallet_stack(-0.32, 0.26, rows=2 if lvl < 2 else 3)
    winch(-0.34, -0.02)
    wheel = (-0.12, 0.33, 0.06)
    if lvl >= 2:
        lantern(-0.25, 0.32, 0.02)
        wheel = derrick(lvl)
        crate(0.4, 0.1, y=0.04, s=0.065, rot=0.25)
    if lvl >= 3:
        parked_cart(0.42, 0.36, rot=-0.5, full=True)
        mason_bench(0.1, 0.12)
        # slee met een groot ruw blok
        box(0.16, 0.012, 0.09, "WoodL", pos=(0.16, 0.045, -0.04))
        box(0.13, 0.07, 0.08, "Cut", pos=(0.16, 0.087, -0.04), bevel=0.006)
    # verspreid gruis en losse stukjes
    for _ in range(8):
        pebble(rnd.uniform(-0.1, 0.42), rnd.uniform(0.02, 0.4), rnd.uniform(0.01, 0.018), 0.04)
    return {"anims": {"cart": (-0.12, 0.058, 0.09), "wheel": wheel}, "pile": (0.3, 0.06, 0.22)}


build_levels("stonemine", build, args)
