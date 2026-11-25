"""Village Empire — zwavelafzettingen rond de vulkaan (drie varianten).

Uitvoer: public/models/sulfur.glb met de nodes sulfur_dep0, sulfur_dep1, sulfur_dep2.
Oorsprong = midden van de tegel op het maaiveld (game-assen: Y omhoog). De game schaalt een afzetting naar de
voorraad (js/sulfur.js): vol = grote gele korst, leeg = alleen de zwartgeblakerde opening.

Herkenbaar: een donkere, geblakerde opening (fumarole) tussen brokken zwart en grijs vulkanisch gesteente,
daaromheen een korst van felgele zwavel met puntige kristallen en lichtere randen, wat okergele vlekken
op de stenen. Variant 1 heeft een kleine schoorsteen van kristal, variant 2 een spleet met een gele rand.
Bouwen: npm run models -- sulfur
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
from ve_parts import LEVEL, rnd  # noqa: E402

args = ve.parse_args()
ve.reset_scene()
setup(seed=6602, extra_palette={
    "Basalt": (0x3E3834, 0.06), "BasaltL": (0x5A524C, 0.06), "Ash": (0x6E6862, 0.05), "Scorch": (0x1E1A18, 0.02),
    "Sulf": (0xE8C62E, 0.06), "SulfL": (0xFFF08A, 0.04), "SulfD": (0xC09A1E, 0.05), "Ochre": (0xB8862E, 0.05),
})


def finish(name):
    objs = list(LEVEL)
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    obj = bpy.context.view_layer.objects.active
    obj.name = obj.data.name = name
    obj.data.transform(obj.matrix_world)
    obj.matrix_world = Matrix.Identity(4)
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.0002)
    bm.to_mesh(obj.data)
    bm.free()
    LEVEL.clear()
    print(f"VE-BLENDER-ITEM {name} tris={ve.triangle_count([obj])}")


def crystals(cx, cz, n, r, h):
    for i in range(n):
        a = i * 2.399 + rnd.uniform(-0.3, 0.3)
        d = r * math.sqrt((i + 0.5) / n)
        x, z = cx + math.cos(a) * d, cz + math.sin(a) * d
        hh = h * rnd.uniform(0.5, 1.0)
        cyl(0.0, rnd.uniform(0.014, 0.024), hh, 4, "SulfL" if i % 3 == 0 else "Sulf", pos=(x, 0.0, z),
            rot=(rnd.uniform(-0.35, 0.35), rnd.uniform(0, 1.5), rnd.uniform(-0.35, 0.35)), smooth=False)


def deposit(v):
    # vulkanische stenen eromheen
    for i in range(4 + v):
        a = i * (6.283 / (4 + v)) + v * 0.6
        r = rnd.uniform(0.22, 0.32)
        blob(rnd.uniform(0.06, 0.1), "Basalt" if i % 2 else "BasaltL", (math.cos(a) * r, 0.02, math.sin(a) * r),
             scale=(1.2, 0.65, 1.0), sub=1, smooth=False)
        if i % 2 == 0:
            blob(0.03, "Ochre", (math.cos(a) * r * 0.85, 0.06, math.sin(a) * r * 0.85), scale=(1.3, 0.3, 1.1), sub=0, smooth=False)
    # gele korst (platte, onregelmatige plaat) met een donkere opening
    blob(0.2, "Sulf", (0, -0.01, 0), scale=(1.15, 0.16, 1.0), sub=2, smooth=False)
    blob(0.13, "SulfD", (0.03, 0.005, -0.02), scale=(1.0, 0.14, 0.9), sub=1, smooth=False)
    blob(0.06, "Scorch", (0.0, 0.012, 0.0), scale=(1.2, 0.3, 1.0), sub=1, smooth=False)
    cyl(0.04, 0.05, 0.03, 8, "Ash", pos=(0, 0.0, 0), smooth=False, cap=False)
    crystals(0.0, 0.0, 16 + v * 3, 0.2, 0.08)
    if v == 1:
        # kleine schoorsteen van kristal rond de opening
        for k in range(6):
            a = k * 1.047
            cyl(0.0, 0.022, 0.12, 4, "Sulf", pos=(math.cos(a) * 0.05, 0.0, math.sin(a) * 0.05), rot=(math.sin(a) * 0.25, 0, -math.cos(a) * 0.25), smooth=False)
    if v == 2:
        # spleet met een gele rand
        box(0.3, 0.02, 0.035, "Scorch", pos=(0.02, 0.0, 0.08), rot=(0, 0.5, 0))
        for k in range(7):
            t = (k - 3) / 3.0
            x, z = 0.02 + t * 0.13, 0.08 - t * 0.07
            for s in (-1, 1):
                cyl(0.0, 0.014, 0.05, 4, "SulfL", pos=(x + s * 0.02, 0.0, z + s * 0.03), smooth=False)
    finish(f"sulfur_dep{v}")


for v in range(3):
    deposit(v)
ve.export_glb(args.out, budget=4000)
