"""Village Empire — goederen (items) voor de voorraadstapels en in de handen van dragers.

Eén node per goed: item_<goed>. Oorsprong = midden van het item (game-assen: Y omhoog), zodat de
stapelindelingen in js/fx.js (VE.PILE_LAYOUT) ze precies naast en op elkaar kunnen leggen.
Maten in tegels. De game gebruikt per goed één InstancedMesh: elk exemplaar is exact dezelfde vorm.

Gehakte bouwstenen (item_stone) zijn rechthoekige blokken van precies 0,09 × 0,05 × 0,06
(= VE.STONE_BLOCK in js/models.js), met een kleine afschuining zodat de voegen zichtbaar zijn.
Graan (schoof) komt uit de natuurmodellen en zit hier niet in.
Bouwen: npm run models -- items
"""
import math
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "lib"))
import bmesh  # noqa: E402
import bpy  # noqa: E402
from mathutils import Matrix  # noqa: E402
import ve_blender as ve  # noqa: E402
from ve_parts import *  # noqa: E402,F401,F403
from ve_parts import LEVEL, gverts, new_obj  # noqa: E402

args = ve.parse_args()
ve.reset_scene()
setup(seed=7301, extra_palette={
    "Bark": (0x8A5A2B, 0.05), "BarkD": (0x6E4522, 0.04), "EndW": (0xE2B77C, 0.03), "Ring": (0xC89A5E, 0.02),
    "Board": (0xE0AA66, 0.04), "Board2": (0xD39A55, 0.04),
    "Cut": (0xA9AAA4, 0.035), "CutTop": (0xB9BAB3, 0.03),
    "Flour": (0xF4ECDB, 0.02), "Tie": (0xA89474, 0.03),
    "Crust": (0xD08B3E, 0.04), "CrustL": (0xE8B070, 0.03),
    "Fish": (0x79B3DF, 0.03), "FishD": (0x5F9BC9, 0.03), "Belly": (0xD8E8F0, 0.02),
    "Basket": (0xB08050, 0.05), "Grape": (0x6B2D7A, 0.05),
    "Barrel": (0x9C6B3F, 0.05), "Hoop": (0x55575C, 0.0),
    "Ham": (0xC8553F, 0.03), "Fat": (0xF2B8A0, 0.02), "Bone": (0xF3EAD6, 0.02),
    "Coal": (0x2E2E34, 0.05), "CoalL": (0x45454C, 0.04),
    "RockI": (0x6E5A4C, 0.05), "RockC": (0x8A6A50, 0.05), "RockG": (0x8F8A82, 0.05),
    "VeinI": (0xC0612F, 0.03), "VeinC": (0x3FAE94, 0.03), "VeinG": (0xF2C443, 0.02),
    "BarI": (0x9AA2AA, 0.02), "BarC": (0xC4703E, 0.02), "BarG": (0xE8B73A, 0.02),
    # wapens
    "Steel": (0xC4CBD2, 0.02), "SteelD": (0x7E868E, 0.03), "Grip": (0x5A3A24, 0.04), "Pommel": (0xD9A93A, 0.02),
    "Shaft": (0xA0703F, 0.04), "BowW": (0x8E5E30, 0.04), "String": (0xEDE3C8, 0.0),
    # trainingsuitrusting
    "Pad": (0x8A5A3A, 0.05), "PadL": (0xA8744A, 0.04), "Practice": (0xC89A5E, 0.05), "Tie2": (0xCDB384, 0.03), "Boss": (0xC9A24A, 0.02),
})
STONE = (0.09, 0.05, 0.06)
NODES = []


def finish(name):
    objs = list(LEVEL)
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    obj = bpy.context.view_layer.objects.active
    obj.name = obj.data.name = "item_" + name
    obj.data.transform(obj.matrix_world)
    obj.matrix_world = Matrix.Identity(4)
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.00005)
    bm.to_mesh(obj.data)
    bm.free()
    LEVEL.clear()
    NODES.append((obj, ve.triangle_count([obj])))


def log():
    cyl(0.035, 0.035, 0.24, 8, "Bark", rot=(0, 0, math.pi / 2), center=True)
    for sx in (-1, 1):                                   # zaagvlakken met jaarringen
        cyl(0.031, 0.031, 0.004, 8, "EndW", pos=(sx * 0.12, 0, 0), rot=(0, 0, math.pi / 2), center=True)
        cyl(0.014, 0.014, 0.0045, 6, "Ring", pos=(sx * 0.12, 0, 0), rot=(0, 0, math.pi / 2), center=True)
    box(0.07, 0.006, 0.02, "BarkD", pos=(0.03, 0.032, 0.0), rot=(0.3, 0, 0))   # schorsplaat
    finish("log")


def plank():
    box(0.24, 0.019, 0.06, "Board", pos=(0, -0.02, 0), base=True, bevel=0.002)
    box(0.24, 0.019, 0.06, "Board2", pos=(0, 0.0, 0), base=True, bevel=0.002)
    finish("plank")


def stone():
    w, h, d = STONE
    # exact rechthoekig, alle blokken identiek; een smalle afschuining laat de voegen zien
    box(w, h, d, "Cut", pos=(0, -h / 2, 0), base=True, bevel=0.004)
    box(w * 0.86, 0.001, d * 0.8, "CutTop", pos=(0, h / 2 - 0.0004, 0), base=True)      # licht gehakt bovenvlak
    finish("stone")


def flour():
    blob(0.055, "Flour", (0, -0.004, 0), scale=(1.0, 1.05, 0.95), sub=2)
    cyl(0.016, 0.02, 0.022, 7, "Tie", pos=(0, 0.045, 0))
    blob(0.018, "Flour", (0, 0.072, 0), scale=(1.1, 0.6, 1.1), sub=1)
    finish("flour")


def bread():
    blob(0.05, "Crust", (0, 0, 0), scale=(1.5, 0.75, 1.0), sub=2)
    for k in (-1, 0, 1):
        box(0.012, 0.006, 0.05, "CrustL", pos=(k * 0.03, 0.03, 0), rot=(0, 0.5, 0), base=True)
    finish("bread")


def fish():
    blob(0.04, "Fish", (0, 0, 0), scale=(2.0, 0.75, 0.6), sub=2)
    blob(0.03, "Belly", (0, -0.012, 0), scale=(2.1, 0.45, 0.55), sub=1)
    cyl(0.0, 0.03, 0.05, 4, "FishD", pos=(-0.1, 0, 0), rot=(0, 0, math.pi / 2), center=True)
    finish("fish")


def grape():
    cyl(0.06, 0.045, 0.06, 10, "Basket", pos=(0, -0.03, 0))
    cyl(0.062, 0.062, 0.008, 10, "BarkD", pos=(0, 0.024, 0))
    for i in range(7):
        a = i * 0.9
        blob(0.022, "Grape", (math.cos(a) * 0.028 * (i % 2 + 0.3), 0.038 + (i % 3) * 0.008, math.sin(a) * 0.025), sub=1)
    finish("grape")


def wine():
    cyl(0.046, 0.042, 0.055, 10, "Barrel", pos=(0, -0.055, 0))
    cyl(0.042, 0.046, 0.055, 10, "Barrel", pos=(0, 0.0, 0))
    for y in (-0.045, 0.0, 0.045):
        cyl(0.0475, 0.0475, 0.008, 10, "Hoop", pos=(0, y - 0.004, 0), smooth=False)
    cyl(0.04, 0.04, 0.002, 10, "BarkD", pos=(0, 0.055, 0))
    finish("wine")


def meat():
    blob(0.05, "Ham", (0, 0, 0.01), scale=(1.25, 0.85, 1.0), sub=2)
    blob(0.03, "Fat", (0.035, 0.025, 0.01), scale=(1.2, 0.5, 1.0), sub=1)
    cyl(0.012, 0.012, 0.07, 6, "Bone", pos=(-0.07, -0.0, 0.0), rot=(0, 0, math.pi / 2), center=True)
    blob(0.017, "Bone", (-0.105, 0, 0), sub=1)
    finish("meat")


def lumps(mat, mat2, n=4, r=0.03):
    for i in range(n):
        blob(r + (i % 2) * 0.008, mat if i % 2 else mat2, ((i % 2 - 0.5) * 0.05, (i // 2) * 0.03 - 0.01, (i - 1.5) * 0.012),
             scale=(1.0, 0.8, 0.9), sub=0, smooth=False)


def coal():
    lumps("Coal", "CoalL")
    finish("coal")


def ore(key, rock, vein):
    blob(0.055, rock, (0, 0, 0), scale=(1.0, 0.8, 0.95), sub=1, smooth=False)
    for i in range(4):
        a = i * 1.6
        blob(0.016, vein, (math.cos(a) * 0.045, 0.012 + (i % 2) * 0.015, math.sin(a) * 0.04), sub=0, smooth=False)
    finish(key)


def bar(key, mat):
    # ingot: afgeknotte rechthoekige vorm (onder 0,12 × 0,05, boven 0,094 × 0,034, 0,035 hoog), alle staven gelijk
    bm = bmesh.new()
    lo, hi, h = (0.06, 0.025), (0.047, 0.017), 0.035
    v = gverts(bm, [(-lo[0], -h / 2, -lo[1]), (lo[0], -h / 2, -lo[1]), (lo[0], -h / 2, lo[1]), (-lo[0], -h / 2, lo[1]),
                    (-hi[0], h / 2, -hi[1]), (hi[0], h / 2, -hi[1]), (hi[0], h / 2, hi[1]), (-hi[0], h / 2, hi[1])])
    for f in ((0, 1, 2, 3), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)):
        bm.faces.new([v[i] for i in f])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    new_obj("bar", bm, mat)
    finish(key)


def along_x(obj):
    return obj


def sword():
    # kling 0,2 met punt, pareerstang, gevest en knop: totaal ~0,29 lang
    box(0.2, 0.008, 0.024, "Steel", pos=(0.03, -0.004, 0), bevel=0.002)
    box(0.18, 0.009, 0.006, "SteelD", pos=(0.03, -0.0045, 0))                               # bloedgroef
    cyl(0.0, 0.0125, 0.03, 4, "Steel", pos=(0.13, 0, 0), rot=(math.pi / 4, 0, -math.pi / 2), smooth=False)
    box(0.014, 0.014, 0.075, "SteelD", pos=(-0.077, -0.007, 0), bevel=0.002)                 # pareerstang
    box(0.05, 0.016, 0.017, "Grip", pos=(-0.11, -0.008, 0))
    blob(0.013, "Pommel", (-0.142, 0, 0), sub=1, smooth=False)
    finish("sword")


def spear():
    cyl(0.007, 0.007, 0.28, 6, "Shaft", pos=(-0.15, 0, 0), rot=(0, 0, -math.pi / 2), smooth=False)
    cyl(0.009, 0.009, 0.02, 6, "SteelD", pos=(0.125, 0, 0), rot=(0, 0, -math.pi / 2), smooth=False)   # huls
    cyl(0.0, 0.018, 0.06, 4, "Steel", pos=(0.145, 0, 0), rot=(math.pi / 4, 0, -math.pi / 2), smooth=False)
    finish("spear")


def battleaxe():
    box(0.25, 0.014, 0.014, "Shaft", pos=(-0.02, -0.007, 0))
    box(0.04, 0.012, 0.03, "SteelD", pos=(0.085, -0.006, 0), bevel=0.002)                    # oog
    for s in (-1, 1):                                                                         # dubbel blad
        box(0.03, 0.01, 0.04, "Steel", pos=(0.085, -0.005, s * 0.035), bevel=0.002)
        box(0.05, 0.011, 0.014, "Steel", pos=(0.085, -0.0055, s * 0.058), bevel=0.002)
    box(0.02, 0.016, 0.018, "Grip", pos=(-0.13, -0.008, 0))
    finish("battleaxe")


def dagger():
    box(0.085, 0.006, 0.018, "Steel", pos=(0.025, -0.003, 0), bevel=0.0015)
    cyl(0.0, 0.009, 0.02, 4, "Steel", pos=(0.067, 0, 0), rot=(math.pi / 4, 0, -math.pi / 2), smooth=False)
    box(0.01, 0.012, 0.045, "SteelD", pos=(-0.022, -0.006, 0))
    box(0.035, 0.013, 0.013, "Grip", pos=(-0.045, -0.0065, 0))
    blob(0.009, "Pommel", (-0.066, 0, 0), sub=1, smooth=False)
    finish("dagger")


def bow():
    # gebogen boog uit 6 stukjes langs een boog; pees als rechte lijn tussen de uiteinden
    R, n = 0.15, 6
    pts = [(R * math.sin(t), -R * math.cos(t) + 0.12) for t in [(-0.95 + 1.9 * i / n) for i in range(n + 1)]]
    for i in range(n):
        (x0, z0), (x1, z1) = pts[i], pts[i + 1]
        L = math.hypot(x1 - x0, z1 - z0)
        a = math.atan2(z1 - z0, x1 - x0)
        mid = i in (n // 2 - 1, n // 2)
        box(L * 1.06, 0.012 if mid else 0.01, 0.014 if mid else 0.011, "Grip" if mid else "BowW",
            pos=((x0 + x1) / 2, -0.006, (z0 + z1) / 2), rot=(0, -a, 0))
    (xa, za), (xb, zb) = pts[0], pts[-1]
    box(xb - xa, 0.003, 0.003, "String", pos=(0, -0.0015, za))
    finish("bow")


def crossbow():
    box(0.19, 0.02, 0.03, "BowW", pos=(-0.01, -0.01, 0), bevel=0.003)                       # kolf
    box(0.05, 0.022, 0.02, "Grip", pos=(-0.09, -0.011, 0))
    box(0.014, 0.012, 0.17, "SteelD", pos=(0.07, -0.006, 0), bevel=0.002)                   # stalen boog
    for s in (-1, 1):
        box(0.03, 0.01, 0.012, "SteelD", pos=(0.06, -0.005, s * 0.085), rot=(0, s * 0.5, 0))
    box(0.004, 0.003, 0.16, "String", pos=(0.035, 0.0, 0))
    box(0.08, 0.004, 0.004, "Shaft", pos=(0.05, 0.004, 0))                                   # pijl
    finish("crossbow")


def gear():
    # trainingsuitrusting: gewatteerd oefenschild met daarop drie houten oefenzwaarden en een bundel stompe pijlen
    cyl(0.052, 0.052, 0.016, 12, "Pad", pos=(0, -0.026, 0), smooth=False)
    cyl(0.046, 0.046, 0.004, 12, "PadL", pos=(0, -0.011, 0), smooth=False, cap=False)
    cyl(0.016, 0.016, 0.006, 8, "Boss", pos=(0, -0.012, 0), smooth=False)
    for k in range(3):
        z = (k - 1) * 0.02
        box(0.13, 0.009, 0.016, "Practice", pos=(0.02, -0.006 + k * 0.004, z), rot=(0, (k - 1) * 0.12, 0), bevel=0.002)
        box(0.012, 0.012, 0.04, "Pad", pos=(-0.047, -0.006 + k * 0.004, z), rot=(0, (k - 1) * 0.12, 0))
        box(0.03, 0.011, 0.011, "Grip", pos=(-0.066, -0.006 + k * 0.004, z), rot=(0, (k - 1) * 0.12, 0))
    cyl(0.01, 0.01, 0.06, 6, "Tie2", pos=(0.0, 0.006, 0), rot=(math.pi / 2, 0, 0), center=True, smooth=False)
    finish("gear")


log(); plank(); stone(); flour(); bread(); fish(); grape(); wine(); meat(); coal()
ore("ironore", "RockI", "VeinI"); ore("copperore", "RockC", "VeinC"); ore("goldore", "RockG", "VeinG")
bar("ironbar", "BarI"); bar("copperbar", "BarC"); bar("goldbar", "BarG")
sword(); spear(); battleaxe(); dagger(); bow(); crossbow(); gear()
for obj, tris in NODES:
    print(f"VE-BLENDER-ITEM {obj.name} tris={tris}")
ve.export_glb(args.out, budget=8000)
