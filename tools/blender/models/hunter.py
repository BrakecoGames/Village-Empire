"""Village Empire — Hunter's Lodge (jagershut), drie upgrade-levels in één GLB.

Herkenbaar: blokhut van donkere stammen met een bemost spanendak, een veranda met palen en een
bankje, een gewei boven de deur, een droogrek met hammen, een gespannen vacht op een raam van takken,
houtstapel en (level 2+) een rokerijtje. Rook uit de stenen schoorsteen.
Level 2: rokerij met hammen + manden. Level 3: grotere veranda, lantaarn, ton en kist met netten.

Kindvriendelijk: geen wapens of bloed; de jager gebruikt een net (zie de game).
Bouwen: npm run models -- hunter
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
setup(seed=5151, extra_palette={
    "Log": (0x7A4E2A, 0.07), "LogD": (0x5E3A1E, 0.06), "LogEnd": (0xD2A66E, 0.05),
    "Antler": (0xEADCBF, 0.03), "Hide": (0xB98A5A, 0.04), "HideD": (0x8A5E36, 0.04),
    "Ham": (0xC8553F, 0.04), "HamL": (0xF2B8A0, 0.03), "Twine": (0xD9C7A0, 0.03), "Net": (0xCDB98E, 0.03),
    "Basket": (0xB88A4E, 0.06),
})

W, D = 0.46, 0.36
Y0, R, COURSES = 0.07, 0.025, 6
TOP = Y0 + (COURSES - 1) * 0.048 + R + 0.02


def log(p0, length, along, mat, r=R, seg=6):
    x, y, z = p0
    if along == "x":
        cyl(r, r, length, seg, mat, pos=(x - length / 2, y, z), rot=(0, 0, -math.pi / 2))
    else:
        cyl(r, r, length, seg, mat, pos=(x, y, z - length / 2), rot=(math.pi / 2, 0, 0))


def cabin(cx, cz):
    box(W - 0.02, TOP - 0.05, D - 0.02, "LogD", pos=(cx, 0.045, cz))
    for i in range(COURSES):
        y = Y0 + i * 0.048
        m1, m2 = ("Log", "LogD") if i % 2 else ("LogD", "Log")
        for sz in (-1, 1):
            log((cx, y, cz + sz * D / 2), W + 0.08, "x", m1 if sz > 0 else m2)
        for sx in (-1, 1):
            log((cx + sx * W / 2, y + 0.024, cz), D + 0.08, "z", m2 if sx > 0 else m1)
    # kopse kanten op de hoeken
    for sx in (-1, 1):
        for i in range(0, COURSES, 2):
            cyl(R * 0.9, R * 0.9, 0.004, 6, "LogEnd", pos=(cx + sx * (W / 2 + 0.041), Y0 + i * 0.048, cz + D / 2), rot=(0, 0, -math.pi / 2), smooth=False)
    prof = [(-D / 2 - 0.02, TOP - 0.01), (D / 2 + 0.02, TOP - 0.01), (D / 2 + 0.02, TOP + 0.03), (0, 0.6 - 0.03), (-D / 2 - 0.02, TOP + 0.03)]
    for sx in (-1, 1):
        prism(prof, 0.03, "WoodL", pos=(cx + sx * (W / 2 + 0.005), 0, cz))
    gable_roof(W + 0.18, D / 2 + 0.09, TOP - 0.03, 0.6, 5, 5, x=cx, z=cz, kind="shingle",
               mats=("ShA", "ShA", "ShB", "ShC", "ShB", "Moss", "ShA"), ridge_mat="LogD", ridge_r=0.028, barge_mat="Timber")


def antlers(x, y, z):
    box(0.07, 0.05, 0.012, "WoodL", pos=(x, y - 0.02, z), bevel=0.004)          # schildje
    for s in (-1, 1):
        beam((x + s * 0.015, y + 0.01, z + 0.012), (x + s * 0.06, y + 0.07, z + 0.02), 0.009, "Antler")
        beam((x + s * 0.045, y + 0.05, z + 0.017), (x + s * 0.03, y + 0.085, z + 0.02), 0.007, "Antler")
        beam((x + s * 0.06, y + 0.07, z + 0.02), (x + s * 0.08, y + 0.095, z + 0.022), 0.007, "Antler")


def ham(x, y, z, s=1.0):
    beam((x, y + 0.035 * s, z), (x, y + 0.06 * s, z), 0.004, "Twine")
    blob(0.024 * s, "Ham", (x, y, z), scale=(1.0, 1.35, 0.9), sub=1)
    blob(0.012 * s, "HamL", (x + 0.012 * s, y + 0.012 * s, z + 0.012 * s), scale=(1.0, 0.7, 0.6), sub=1)


def drying_rack(x, z, n=3):
    for sx in (-0.08, 0.08):
        beam((x + sx, 0.04, z - 0.02), (x + sx, 0.26, z), 0.016, "Timber")
    beam((x - 0.1, 0.25, z), (x + 0.1, 0.25, z), 0.014, "Timber")
    for i in range(n):
        ham(x - 0.05 + i * 0.05, 0.18, z, 0.9 + 0.1 * (i % 2))


def hide_frame(x, z, rot=0.3):
    # raam van takken met een gespannen vacht
    c, s = math.cos(rot), math.sin(rot)
    def P(dx, y):
        return (x + dx * c, y, z - dx * s)
    beam(P(-0.08, 0.04), P(-0.08, 0.27), 0.012, "LogD")
    beam(P(0.08, 0.04), P(0.08, 0.27), 0.012, "LogD")
    beam(P(-0.09, 0.25), P(0.09, 0.25), 0.011, "LogD")
    beam(P(-0.09, 0.08), P(0.09, 0.08), 0.011, "LogD")
    box(0.13, 0.15, 0.008, "Hide", pos=P(0, 0.09), rot=(0, rot, 0), bevel=0.003)
    blob(0.03, "HideD", P(0.0, 0.17), scale=(1.8, 1.0, 0.25), sub=1)
    for dx, y in ((-0.075, 0.24), (0.075, 0.24), (-0.075, 0.09), (0.075, 0.09)):
        beam(P(dx * 0.8, y), P(dx, y + (0.01 if y > 0.2 else -0.01)), 0.003, "Twine")


def bench(x, z):
    box(0.16, 0.014, 0.05, "WoodL", pos=(x, 0.075, z))
    for sx in (-0.06, 0.06):
        box(0.018, 0.07, 0.04, "Wood", pos=(x + sx, 0.005, z))


def porch(z_front, w, posts_x, roof_y=0.27):
    box(w, 0.02, 0.13, "WoodL", pos=(-0.03, 0.045, z_front + 0.065), bevel=0.004)
    for i in range(int(w / 0.06)):
        box(0.004, 0.003, 0.13, "Wood", pos=(-0.03 - w / 2 + 0.03 + i * 0.06, 0.066, z_front + 0.065))
    for px in posts_x:
        beam((px, 0.06, z_front + 0.12), (px, roof_y, z_front + 0.12), 0.02, "Timber")
    # schuin afdakje van spanen
    a = 0.32
    up = Vector((0.0, math.sin(a), -math.cos(a)))
    nrm = Vector((0.0, math.cos(a), math.sin(a)))
    for ci in range(int(w / 0.08) + 1):
        for ri in range(2):
            shingle((-0.03 - w / 2 + 0.04 + ci * 0.08 + (0.04 if ri else 0), roof_y + 0.015 + ri * 0.03, z_front + 0.15 - ri * 0.07),
                    up, nrm, 0.078, 0.09, rnd.choice(("ShA", "ShB", "ShC", "Moss")))


def basket(x, z, y=0.04):
    cyl(0.04, 0.032, 0.05, 9, "Basket", pos=(x, y, z))
    cyl(0.042, 0.042, 0.008, 9, "LogD", pos=(x, y + 0.05, z), cap=False)


def build(lvl):
    earth_base(0.84, 0.8, top=0.04, clumps=9, pebbles=6, flowers=3,
               keep_clear=[(-0.2, 0.1, 0.12, 0.5)])
    cx, cz = -0.05, -0.1
    cabin(cx, cz)
    door(-0.08, cz + D / 2 + 0.028, w=0.1, h=0.17)
    window(cx + W / 2 + 0.03, 0.2, cz - 0.02, "x", lit=True, shutters="ShutterG", w=0.075, h=0.075)
    window(0.1, 0.2, cz + D / 2 + 0.028, "z", lit=lvl >= 2, shutters="ShutterG", w=0.07, h=0.07)
    antlers(-0.08, 0.3, cz + D / 2 + 0.03)
    smoke = chimney(cx - W / 2 + 0.07, cz - 0.08, 0.3, 0.68)
    porch(cz + D / 2 + 0.03, 0.42 if lvl < 3 else 0.52, (-0.25, 0.15) if lvl < 3 else (-0.3, 0.06, 0.2))
    bench(0.08, cz + D / 2 + 0.1)
    woodpile(cx - W / 2 - 0.05, cz + 0.08, y=0.04, along="z")
    drying_rack(0.28, -0.28)
    hide_frame(-0.33, 0.24, rot=0.5)
    # strik / netten bij de deur
    cyl(0.03, 0.03, 0.006, 10, "Net", pos=(-0.16, 0.2, cz + D / 2 + 0.035), rot=(math.pi / 2, 0, 0), cap=False)
    beam((-0.19, 0.06, cz + D / 2 + 0.04), (-0.17, 0.24, cz + D / 2 + 0.04), 0.008, "WoodL")
    if lvl >= 2:
        # rokerijtje: klein houten hok met hammen en een eigen schoorsteentje
        box(0.12, 0.16, 0.12, "LogD", pos=(0.33, 0.04, 0.02), bevel=0.005)
        prism([(-0.075, 0.2), (0.075, 0.2), (0, 0.27)], 0.14, "ShB", pos=(0.33, 0, 0.02))
        box(0.06, 0.08, 0.01, "DoorD", pos=(0.33, 0.06, 0.081))
        basket(-0.32, -0.36)
        basket(-0.24, -0.38)
    if lvl >= 3:
        barrel(0.36, 0.33, y=0.04)
        crate(-0.36, -0.06, y=0.04, s=0.08, rot=0.3)
        beam((0.2, 0.27, cz + D / 2 + 0.15), (0.2, 0.22, cz + D / 2 + 0.15), 0.006, "Iron")
        box(0.03, 0.04, 0.03, "Glow", pos=(0.2, 0.18, cz + D / 2 + 0.15))
    for _ in range(4):
        pebble(rnd.uniform(0.15, 0.38), rnd.uniform(0.15, 0.38), rnd.uniform(0.012, 0.02), 0.04)
    return {"smoke": [smoke], "pile": (0.3, 0.04, 0.3)}


build_levels("hunter", build, args)
