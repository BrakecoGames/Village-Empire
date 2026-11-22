"""Village Empire — ertsaders in de bergen: steenkool, ijzer, koper en goud, elk in twee varianten.

Uitvoer: public/models/ores.glb met de nodes ore_<soort>_<0|1> (coal, iron, copper, gold).
Een ader is een lage rotspartij (ca. 0,5 tegel breed) waar het erts zichtbaar uitsteekt, zodat je
vanaf de normale camerahoogte direct ziet wat er ligt:
  steenkool  zwarte, licht glanzende brokken en lagen in donkere rots
  ijzer      donkerbruine rots met roestrode aders en roestvlekken
  koper      bruine rots met groene en turquoise kristallen (malachiet, azuriet)
  goud       grijze rots met smalle goudkleurige aders en een paar glinsterende klompjes
De game schaalt een ader kleiner naarmate hij leger raakt (js/mining.js).

Bouwen: npm run models -- ores
"""
import math
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "lib"))
import bmesh  # noqa: E402
import bpy  # noqa: E402
from mathutils import Matrix, Vector  # noqa: E402
import ve_blender as ve  # noqa: E402
from ve_parts import *  # noqa: E402,F401,F403
from ve_parts import rnd, LEVEL, M3  # noqa: E402

args = ve.parse_args()
args.budget = max(args.budget, 900)
ve.reset_scene()
setup(seed=9901, extra_palette={
    "RockC": (0x5A5650, 0.07), "RockCD": (0x46423E, 0.06),
    "Coal": (0x232328, 0.05), "CoalG": (0x5E6678, 0.03),
    "RockI": (0x6E5A4C, 0.07), "RockID": (0x584638, 0.06), "Rust": (0xB4582A, 0.06), "RustL": (0xD27A3E, 0.05),
    "RockU": (0x8A6A50, 0.07), "RockUD": (0x6E5440, 0.06), "Mala": (0x2F9E6E, 0.05), "Azur": (0x4FC4C8, 0.04), "MalaL": (0x7FDDB0, 0.04),
    "RockG": (0x9A958C, 0.06), "RockGD": (0x7E7A72, 0.06), "GoldV": (0xF2C443, 0.03), "GoldL": (0xFFE58A, 0.02),
})


def rock(x, z, r, mat, sy=0.6, sx=1.0, sz=1.0, y=0.0):
    blob(r, mat, (x, y + r * sy * 0.55, z), scale=(sx, sy, sz), sub=1, smooth=False)


def crystal(x, y, z, h, r, mat, tilt=0.3, yaw=0.0):
    """Zeskantige kristalpunt (koper) of brok, schuin uit de rots."""
    cyl(r * 0.25, r, h, 6, mat, pos=(x, y, z), rot=(tilt * math.cos(yaw), yaw, tilt * math.sin(yaw)), smooth=False)


def band(p0, p1, w, mat):
    """Platte ader (strook) over het rotsoppervlak."""
    beam(p0, p1, w, mat)


def outcrop(base, dark, v):
    n = 4 + v
    for k in range(n):
        a = k * 2.2 + v * 0.7
        d = 0.0 if k == 0 else 0.1 + (k % 3) * 0.05
        rock(math.cos(a) * d, math.sin(a) * d, 0.16 - k * 0.018 + rnd.uniform(-0.01, 0.01), base if k % 2 == 0 else dark,
             sy=rnd.uniform(0.5, 0.75), sx=rnd.uniform(0.9, 1.25), sz=rnd.uniform(0.9, 1.2))


def coal(v):
    outcrop("RockC", "RockCD", v)
    # zwarte lagen en glanzende brokken
    for k in range(5 + v * 2):
        a = k * 1.9 + v
        r = 0.04 + (k % 3) * 0.045
        blob(rnd.uniform(0.036, 0.05), "Coal", (math.cos(a) * r, 0.12 + (k % 2) * 0.04, math.sin(a) * r),
             scale=(1.2, 0.75, 1.0), sub=1, smooth=False)
    for k in range(3):
        blob(0.014, "CoalG", (rnd.uniform(-0.08, 0.08), 0.17 + k * 0.012, rnd.uniform(-0.06, 0.06)), sub=0, smooth=False)
    band((-0.14, 0.1, 0.08), (0.12, 0.14, 0.1), 0.034, "Coal")


def iron(v):
    outcrop("RockI", "RockID", v)
    for k in range(3 + v):
        a = k * 2.1 + v * 0.5
        x0, z0 = math.cos(a) * 0.14, math.sin(a) * 0.12
        band((x0, 0.09, z0), (x0 * 0.2, 0.18 + (k % 2) * 0.03, z0 * 0.2), 0.032, "Rust" if k % 2 else "RustL")
    for k in range(6):
        a = k * 1.1
        blob(rnd.uniform(0.03, 0.042), "RustL" if k % 2 else "Rust", (math.cos(a) * 0.1, 0.14 + (k % 2) * 0.03, math.sin(a) * 0.09), scale=(1.3, 0.55, 1.1), sub=1, smooth=False)


def copper(v):
    outcrop("RockU", "RockUD", v)
    for k in range(4 + v):
        a = k * 1.7 + v
        r = 0.05 + (k % 3) * 0.04
        x, z = math.cos(a) * r, math.sin(a) * r
        for c in range(3):
            crystal(x + c * 0.012, 0.12 + (k % 2) * 0.03, z + c * 0.01, rnd.uniform(0.06, 0.1), rnd.uniform(0.014, 0.02),
                    ("Mala", "Azur", "MalaL")[(k + c) % 3], tilt=rnd.uniform(0.2, 0.6), yaw=a + c)
    for k in range(4):
        blob(rnd.uniform(0.026, 0.034), "Mala", (rnd.uniform(-0.12, 0.12), 0.11, rnd.uniform(-0.1, 0.1)), scale=(1.3, 0.6, 1.1), sub=1, smooth=False)


def gold(v):
    outcrop("RockG", "RockGD", v)
    for k in range(3 + v):
        a = k * 2.3 + v
        x0, z0 = math.cos(a) * 0.13, math.sin(a) * 0.11
        band((x0, 0.1, z0), (x0 * 0.1 + 0.02, 0.19, z0 * 0.1), 0.02, "GoldV")
    for k in range(4 + v):
        a = k * 1.8
        blob(rnd.uniform(0.02, 0.03), "GoldV" if k % 2 else "GoldL", (math.cos(a) * 0.09, 0.15 + (k % 3) * 0.02, math.sin(a) * 0.08),
             scale=(1.1, 0.8, 1.0), sub=1, smooth=False)
    for k in range(2):
        crystal(rnd.uniform(-0.05, 0.05), 0.19, rnd.uniform(-0.04, 0.04), 0.04, 0.014, "GoldL", tilt=0.3, yaw=k * 2)


KINDS = {"coal": coal, "iron": iron, "copper": copper, "gold": gold}
built = []
for key, fn in KINDS.items():
    for v in range(2):
        LEVEL.clear()
        rnd.seed(9901 + v * 17 + len(key))
        fn(v)
        objs = list(LEVEL)
        bpy.ops.object.select_all(action="DESELECT")
        for o in objs:
            o.select_set(True)
        bpy.context.view_layer.objects.active = objs[0]
        bpy.ops.object.join()
        obj = bpy.context.view_layer.objects.active
        obj.name = obj.data.name = f"ore_{key}_{v}"
        obj.data.transform(obj.matrix_world)
        obj.matrix_world = Matrix.Identity(4)
        built.append(obj)
        print("VE-ORE", obj.name, ve.triangle_count([obj]))
if not os.environ.get("VE_NO_AO"):
    for obj in built:
        for o in built:
            o.hide_render = o is not obj
        bake_ao(obj, samples=32, distance=0.08)
    for o in built:
        o.hide_render = False
ve.export_glb(args.out, budget=args.budget * len(built), vertex_colors=not os.environ.get("VE_NO_AO"))
