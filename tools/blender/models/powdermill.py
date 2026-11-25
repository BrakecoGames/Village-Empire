"""Village Empire — Buskruitwerkplaats (Gunpowder Workshop), 3 levels.

Uitvoer: public/models/powdermill.glb met de nodes
    powdermill_l1..l3          het gebouw per level
    powdermill_part_stamp      de drie stampers van de stampmolen (bewegen op en neer, anker 'stamp')
    <node>_anim_stamp          anker voor de stampers
    <node>_pile                plek voor de uitvoervoorraad (vaatjes buskruit)
    <node>_in0..in2            stapels aangeleverde zwavel, steenkool en hout

Herkenbaar: een stevige werkplaats van natuursteen met een vakwerk-verdieping en een leien dak, géén
schoorsteen (vuur en kruit gaan niet samen). Opzij een open afdak met een houten stampmolen: een nokkenas
met drie zware stampers boven een eikenhouten trog. Een waarschuwingsbord met een rood teken, een ton water
met emmer, zeven, een droogrek met platte bakken kruit en een rek met verzegelde vaatjes.
Level 2: tweede rek vaatjes, een weegschaal op een tafel. Level 3: een stenen kruitkelder met een ijzeren deur
en een bliksemafleider.
Bouwen: npm run models -- powdermill
"""
import math
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "lib"))
import ve_blender as ve  # noqa: E402
from ve_parts import *  # noqa: E402,F401,F403
from ve_parts import rnd  # noqa: E402

args = ve.parse_args()
args.budget = max(args.budget, 5200)
ve.reset_scene()
setup(seed=6621, extra_palette={
    "Keg": (0x6A4A30, 0.05), "KegD": (0x4E3622, 0.04), "Powder": (0x2A2A2E, 0.03), "Seal": (0xA8322A, 0.03),
    "Warn": (0xB03A2A, 0.03), "WarnW": (0xF2EAD8, 0.02), "Oak": (0x7A5230, 0.05), "Sieve": (0xC9B48A, 0.04),
    "Sulf": (0xE8C62E, 0.06), "Brass": (0xC9A24A, 0.02),
})


def keg(x, y, z, r=0.032, h=0.062):
    cyl(r * 0.9, r, h * 0.5, 10, "Keg", pos=(x, y, z))
    cyl(r, r * 0.9, h * 0.5, 10, "Keg", pos=(x, y + h * 0.5, z))
    for yy in (y + h * 0.18, y + h * 0.78):
        cyl(r * 1.05, r * 1.05, 0.006, 10, "Iron", pos=(x, yy, z), smooth=False)
    cyl(r * 0.85, r * 0.85, 0.003, 10, "Powder", pos=(x, y + h, z), smooth=False)
    cyl(r * 0.25, r * 0.25, 0.003, 8, "Seal", pos=(x + r * 0.3, y + h + 0.002, z), smooth=False)


def keg_rack(x, z, rows=2):
    for sx in (-0.11, 0.11):
        box(0.02, 0.06 + rows * 0.07, 0.08, "Timber", pos=(x + sx, 0.04, z))
    for r in range(rows):
        box(0.24, 0.012, 0.08, "WoodL", pos=(x, 0.06 + r * 0.075, z))
        for c in range(3):
            keg(x - 0.07 + c * 0.07, 0.066 + r * 0.075, z, r=0.026, h=0.05)


def workshop(lvl):
    # natuursteen beneden, vakwerk boven, leien dak, geen schoorsteen
    h = house_body(x=-0.14, z=-0.16, w=0.46, d=0.36, wall_top=0.46, ridge_y=0.74, roof="slate", wall="Plaster", timber=True)
    box(0.47, 0.2, 0.37, "StoneA", pos=(-0.14, 0.04, -0.16), bevel=0.006)
    door(-0.24, h["front"], w=0.11, h=0.18)
    window(-0.04, 0.3, h["front"] + 0.002, "z", lit=False, shutters="Shutter", w=0.08, h=0.08)
    window(h["left"] - 0.002, 0.3, -0.16, "x", lit=False, shutters="Shutter", w=0.08, h=0.08)
    # waarschuwingsbord: rood ruitje met een wit vlammetje
    box(0.08, 0.08, 0.01, "Warn", pos=(-0.04, 0.17, h["front"] + 0.006), rot=(0, 0, math.pi / 4))
    box(0.02, 0.04, 0.004, "WarnW", pos=(-0.04, 0.17, h["front"] + 0.012))


def stamp_mill():
    # open afdak met een trog en een nokkenas; de stampers zelf zijn een los deel (part_stamp)
    for sx in (0.12, 0.42):
        for sz in (0.0, 0.26):
            beam((sx, 0.04, sz), (sx, 0.42, sz), 0.026, "Timber")
    a = 0.3
    up = Vector((math.sin(a), math.cos(a), 0.0))
    nrm = Vector((math.cos(a), -math.sin(a), 0.0)) * -1
    for ci in range(4):
        for ri in range(2):
            shingle((0.2 + ri * 0.09, 0.45 + ri * 0.024, -0.02 + ci * 0.085 + (0.04 if ri else 0)), Vector((0.0, math.cos(a), -math.sin(a))),
                    Vector((0.0, math.sin(a), math.cos(a))), 0.085, 0.1, rnd.choice(("ShA", "ShB", "ShC")))
    box(0.3, 0.07, 0.1, "Oak", pos=(0.27, 0.04, 0.13), bevel=0.006)                 # trog
    box(0.26, 0.01, 0.07, "Powder", pos=(0.27, 0.11, 0.13))                         # kruit in de trog
    cyl(0.022, 0.022, 0.32, 8, "Timber", pos=(0.27, 0.34, 0.03), rot=(0, 0, math.pi / 2), center=True)   # nokkenas
    for i in range(3):
        box(0.024, 0.018, 0.05, "Iron", pos=(0.2 + i * 0.07, 0.34, 0.06))           # nokken
    beam((0.12, 0.38, 0.13), (0.42, 0.38, 0.13), 0.02, "Timber")                    # geleider
    cyl(0.05, 0.05, 0.02, 10, "Oak", pos=(0.44, 0.34, 0.03), rot=(0, 0, math.pi / 2), center=True)       # handwiel


def stamps():
    # drie zware stampers (oorsprong: anker 'stamp', midden boven de trog)
    for i in range(3):
        x = (i - 1) * 0.07
        box(0.032, 0.2, 0.032, "Oak", pos=(x, 0.0, 0.0), bevel=0.003)
        box(0.04, 0.03, 0.04, "Iron", pos=(x, -0.005, 0.0), bevel=0.003)


def yard(lvl):
    keg_rack(-0.3, 0.3, rows=2)
    # ton water met emmer
    barrel(0.4, -0.3, y=0.04)
    cyl(0.025, 0.02, 0.04, 8, "Wood", pos=(0.33, 0.04, -0.24))
    # zeven en een droogrek met platte bakken kruit
    for k in range(2):
        cyl(0.045, 0.045, 0.014, 12, "Sieve", pos=(0.02 + k * 0.03, 0.05 + k * 0.016, 0.36), smooth=False)
    for sx in (-0.42, -0.42):
        pass
    if lvl >= 2:
        keg_rack(-0.3, 0.16 if lvl < 3 else 0.16, rows=1)
        # tafel met een weegschaal
        box(0.12, 0.012, 0.07, "WoodL", pos=(0.04, 0.13, 0.26))
        for dx in (-0.05, 0.05):
            box(0.012, 0.09, 0.012, "Wood", pos=(0.04 + dx, 0.085, 0.26))
        beam((0.04, 0.136, 0.26), (0.04, 0.2, 0.26), 0.006, "Brass")
        beam((0.0, 0.2, 0.26), (0.08, 0.2, 0.26), 0.005, "Brass")
        for dx in (0.0, 0.08):
            cyl(0.018, 0.012, 0.006, 8, "Brass", pos=(0.04 - 0.04 + dx, 0.17, 0.26), smooth=False)
    if lvl >= 3:
        # stenen kruitkelder met ijzeren deur en een bliksemafleider op het huis
        box(0.16, 0.12, 0.14, "StoneB", pos=(0.36, 0.04, -0.3), bevel=0.01)
        box(0.18, 0.02, 0.16, "SlateA", pos=(0.36, 0.16, -0.3))
        box(0.06, 0.08, 0.006, "Iron", pos=(0.36, 0.08, -0.229))
        beam((-0.14, 0.72, -0.16), (-0.14, 0.86, -0.16), 0.006, "Iron")


def build(lvl):
    earth_base(0.88, 0.84, top=0.04, clumps=6, pebbles=6, flowers=1,
               keep_clear=[(-0.32, -0.14, 0.02, 0.5), (0.1, 0.46, -0.02, 0.3)])
    workshop(lvl)
    stamp_mill()
    yard(lvl)
    return {"anims": {"stamp": (0.27, 0.22, 0.13)}, "pile": (0.0, 0.06, 0.42),
            "inp": [(0.42, 0.06, 0.4), (0.42, 0.06, 0.3), (-0.42, 0.06, 0.06)]}


build_levels("powdermill", build, args, parts={"stamp": stamps})
