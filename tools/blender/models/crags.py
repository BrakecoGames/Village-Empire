"""Village Empire — rotsformaties voor bergen en kust (referentie: Noorse kustbergen, groen met grijs gesteente).

Uitvoer: public/models/crags.glb met de nodes
    crag_tor        rotskop: gestapelde, hoekige blokken (bergtop, kam, rotspilaar in zee)
    crag_outcrop    gelaagde rotspartij: schuine platen gneis met mos erop (steile helling)
    crag_ridge      grillige rotsrichel langs een kam
    crag_boulders   groepje ronde keien met korstmos
    crag_scree      puinwaaier: veel kleine platte stenen
    crag_cliff      kustklifwand: steile, grillige wand met grasrichels (voorkant = +z, naar zee)
Oorsprong = midden van de tegel op het maaiveld (game-assen: Y omhoog, maten in tegels). De game plaatst ze met
een eigen draaiing en schaal (js/crags.js) en verbergt ze onder gebouwen.

Stijl: knus low-poly, platte facetten, gneis in drie grijstinten met gelaagde banden, mos en korstmos.
Bouwen: npm run models -- crags
"""
import math
import os
import random
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "lib"))
import bmesh  # noqa: E402
import bpy  # noqa: E402
from mathutils import Matrix, Vector, Euler  # noqa: E402
import ve_blender as ve  # noqa: E402
from ve_parts import *  # noqa: E402,F401,F403
from ve_parts import LEVEL, gverts, new_obj  # noqa: E402

args = ve.parse_args()
ve.reset_scene()
setup(seed=8801, extra_palette={
    "Gneiss": (0x84837E, 0.07), "GneissD": (0x63625D, 0.07), "GneissL": (0x9A9890, 0.06), "CliffD": (0x55534F, 0.07),
    "Lichen": (0xA8A870, 0.05), "LichenO": (0xC2A15A, 0.04), "Moss": (0x6E8C3C, 0.06), "Heath": (0x5E7A36, 0.06),
    "Scree": (0xA19E96, 0.06),
})
R = random.Random(8801)


def rock(c, size, mat, n=10, jit=0.34, rot=(0, 0, 0), flat=1.0):
    """hoekige rots: convex omhulsel van punten op een (afgeplatte) ellipsoïde, met platte facetten"""
    bm = bmesh.new()
    pts = []
    for _ in range(n):
        u, v = R.uniform(-1, 1), R.uniform(0, 2 * math.pi)
        s = math.sqrt(1 - u * u)
        d = Vector((s * math.cos(v), u * flat, s * math.sin(v)))
        d *= 1.0 + R.uniform(-jit, jit)
        pts.append(Vector((d.x * size[0], d.y * size[1], d.z * size[2])))
    m = Euler(rot, "XYZ").to_matrix()
    vs = gverts(bm, [tuple(Vector(c) + m @ p) for p in pts])
    bmesh.ops.convex_hull(bm, input=vs)
    for f in list(bm.faces):
        if len(f.verts) < 3:
            bm.faces.remove(f)
    bm.normal_update()
    return new_obj("rock", bm, mat, False)


def finish(name):
    objs = list(LEVEL)
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    obj = bpy.context.view_layer.objects.active
    obj.name = obj.data.name = "crag_" + name
    obj.data.transform(obj.matrix_world)
    obj.matrix_world = Matrix.Identity(4)
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.0003)
    for v in bm.verts:                                     # niet dieper dan 0,2 onder het maaiveld (de game zet het model op de grond)
        if v.co.z < -0.2:
            v.co.z = -0.2
    bm.to_mesh(obj.data)
    bm.free()
    LEVEL.clear()
    print(f"VE-BLENDER-ITEM crag_{name} tris={ve.triangle_count([obj])}")


def tufts(cx, cz, r, n, y=0.0, mat="Moss"):
    for _ in range(n):
        a, d = R.uniform(0, 6.28), R.uniform(0, r)
        rock((cx + math.cos(a) * d, y + 0.01, cz + math.sin(a) * d), (R.uniform(0.04, 0.08), 0.025, R.uniform(0.04, 0.08)), mat, n=8, jit=0.2)


def tor():
    # ruige rotskop: een paar grote, hoekige blokken die tegen elkaar leunen (deels in de grond), met steile
    # gelaagde platen ertegenaan, gevallen blokken eromheen en mos in de spleten (zoals op de bergtop)
    for (x, z, w, h, d, m) in ((-0.12, 0.0, 0.3, 0.5, 0.28, "GneissD"), (0.14, 0.06, 0.26, 0.42, 0.24, "Gneiss"), (0.0, -0.14, 0.24, 0.62, 0.22, "Gneiss")):
        rock((x, h * 0.55, z), (w, h, d), m, n=9, jit=0.3, rot=(R.uniform(-0.15, 0.15), R.uniform(0, 3.1), R.uniform(-0.18, 0.18)))
    for k in range(4):                                                     # steile platen (gelaagd gneis)
        a = k * 1.57 + R.uniform(-0.3, 0.3)
        rock((math.cos(a) * 0.2, 0.28, math.sin(a) * 0.2), (0.06, 0.3, 0.16), R.choice(("GneissL", "GneissD")), n=8, jit=0.25, rot=(0.2, a, 0.25))
    for _ in range(5):
        a = R.uniform(0, 6.28)
        rock((math.cos(a) * 0.46, 0.05, math.sin(a) * 0.46), (0.08, 0.06, 0.07), R.choice(("Gneiss", "GneissL", "Scree")), n=8, jit=0.3)
    for _ in range(4):
        a = R.uniform(0, 6.28)
        rock((math.cos(a) * 0.22, R.uniform(0.35, 0.75), math.sin(a) * 0.22), (0.05, 0.015, 0.04), R.choice(("Lichen", "LichenO")), n=7, jit=0.2)
    tufts(0, 0, 0.5, 7)
    finish("tor")


def outcrop():
    # schuine platen gneis naast elkaar, samen een gekartelde rotspartij; mos op de bovenkant
    for i in range(6):
        x = -0.5 + i * 0.2 + R.uniform(-0.04, 0.04)
        h = R.uniform(0.13, 0.24)
        rock((x, h * 0.55, R.uniform(-0.06, 0.06)), (0.17, h, 0.27), R.choice(("Gneiss", "GneissD", "GneissL")), n=12, jit=0.22,
             rot=(0.42, R.uniform(-0.25, 0.25), R.uniform(-0.12, 0.12)), flat=0.85)
        rock((x, h * 1.15, -0.1), (0.13, 0.025, 0.14), R.choice(("Moss", "Heath", "Lichen")), n=8, jit=0.2, rot=(0.42, 0, 0))
    for _ in range(4):
        rock((R.uniform(-0.5, 0.5), 0.05, R.uniform(0.15, 0.4)), (0.08, 0.05, 0.07), "Scree", n=9, jit=0.25)
    tufts(0, -0.3, 0.5, 5, mat="Heath")
    finish("outcrop")


def ridge():
    # grillige richel: een rij puntige rotsen op een lage voet
    rock((0, 0.08, 0), (0.62, 0.12, 0.22), "GneissD", n=16, jit=0.2)
    for i in range(7):
        x = -0.55 + i * 0.18
        h = R.uniform(0.18, 0.4)
        rock((x, h * 0.75, R.uniform(-0.05, 0.05)), (0.1, h, 0.12), R.choice(("Gneiss", "GneissL", "GneissD")), n=12, jit=0.3,
             rot=(R.uniform(-0.2, 0.2), R.uniform(0, 3), R.uniform(-0.25, 0.25)))
    for _ in range(4):
        rock((R.uniform(-0.5, 0.5), R.uniform(0.2, 0.4), R.uniform(-0.08, 0.08)), (0.05, 0.015, 0.04), "Lichen", n=8)
    tufts(0, 0.25, 0.5, 4)
    finish("ridge")


def boulders():
    for i in range(5):
        a, d = i * 1.3 + R.uniform(-0.3, 0.3), R.uniform(0.05, 0.35)
        s = R.uniform(0.1, 0.24)
        rock((math.cos(a) * d, s * 0.6, math.sin(a) * d), (s, s * 0.75, s * 0.9), R.choice(("Gneiss", "GneissL")), n=18, jit=0.12)
        rock((math.cos(a) * d + 0.02, s * 1.25, math.sin(a) * d), (s * 0.45, s * 0.12, s * 0.4), R.choice(("Lichen", "LichenO", "Moss")), n=8, jit=0.15)
    finish("boulders")


def scree():
    # puinwaaier: kleine platte stenen, dichter bovenaan (-z) en uitwaaierend naar beneden (+z)
    for _ in range(26):
        t = R.random()
        x, z = R.uniform(-0.25 - t * 0.25, 0.25 + t * 0.25), -0.4 + t * 0.8
        s = R.uniform(0.035, 0.08)
        rock((x, s * 0.35, z), (s, s * 0.4, s * 0.85), R.choice(("Scree", "Gneiss", "GneissL", "Scree")), n=8, jit=0.25, rot=(0, R.uniform(0, 3), 0))
    finish("scree")


def cliff():
    # steile kustwand: grillige verticale platen, grasrichels, donkere voet; voorkant (+z) naar zee
    for i in range(6):
        x = -0.48 + i * 0.19 + R.uniform(-0.03, 0.03)
        h = R.uniform(0.45, 0.7)
        rock((x, h * 0.5, R.uniform(-0.04, 0.06)), (0.2, h * 0.55, 0.22), R.choice(("GneissD", "Gneiss", "Gneiss", "CliffD")), n=12, jit=0.2,
             rot=(R.uniform(-0.12, 0.05), R.uniform(-0.25, 0.25), R.uniform(-0.12, 0.12)), flat=1.0)
    for k in range(3):                                       # richels met gras
        y = 0.25 + k * 0.2
        rock((R.uniform(-0.35, 0.35), y, 0.04), (0.12, 0.025, 0.07), R.choice(("Moss", "Heath")), n=8, jit=0.2)
    for _ in range(5):                                       # blokken aan de voet
        rock((R.uniform(-0.5, 0.5), 0.05, R.uniform(0.15, 0.32)), (0.09, 0.07, 0.08), R.choice(("CliffD", "Gneiss")), n=10, jit=0.25)
    finish("cliff")


tor(); outcrop(); ridge(); boulders(); scree(); cliff()
ve.export_glb(args.out, budget=9000)
