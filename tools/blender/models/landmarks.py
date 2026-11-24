"""Village Empire — landschapsobjecten voor de grote wereld, in één GLB (één node per object).

  bridge          middeleeuwse stenen boogbrug over de canyon: lengte 14 langs x (de game schaalt naar de
                  echte breedte), dek bovenop op y = 0, drie bogen en pijlers tot y = -3,4, borstweringen,
                  wapenschilden en lantaarnpalen op de landhoofden
  ruin            verlaten ruïne: ingestorte muren, een spitsboog, gebroken zuilen, puin en mos (2,4 × 2,4)
  cave            grotingang in een rotsheuvel, donkere opening naar +z, druipsteen, mos (2 × 2)
  falls_hidden    verborgen waterval: rotswand met een smalle cascade en een poel met stenen (3 × 2)
  falls_canyon    waterval langs een canyonwand: cascade van y = 0 tot y = -3 met schuim (de game schaalt y)
  stones          oude stenen kring: negen menhirs met twee dekstenen en een altaarsteen (r 1,3)
  monument        verweerd stenen monument: getrapte sokkel, obelisk met runen, mos
  vent            stoomgat bij de vulkaan: donkere rotsen rond een spleet (de stoom is een effect in de game)
  egg_sword       easter egg: zwaard in de steen
  egg_duck        easter egg: reuzenbadeend die op een meer dobbert
  egg_gnomes      easter egg: drie kabouterhuisjes (paddenstoelen met deurtjes en raampjes)
Materiaal 'Fall*' = vallend water: de game laat het in banden naar beneden stromen.

Bouwen: npm run models -- landmarks
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
ve.reset_scene()
setup(seed=6611, extra_palette={
    "BrStone": (0xB9B0A0, 0.06), "BrStoneD": (0x9A9182, 0.06), "BrStoneL": (0xD2CABB, 0.05), "BrDeck": (0x8E867A, 0.05),
    "Ruin": (0xA8A090, 0.07), "RuinD": (0x857D70, 0.06), "Moss2": (0x6E8F3A, 0.06), "Ivy": (0x4E7E30, 0.05),
    "CaveR": (0x8C8478, 0.08), "CaveD": (0x2A2420, 0.0), "CaveM": (0x6F7A4A, 0.05),
    "FallA": (0xD8F0FA, 0.0), "FallB": (0x9FD2EC, 0.0), "Foam": (0xF6FBFD, 0.0), "Pool": (0x3A88B0, 0.0),
    "Menhir": (0x9A958C, 0.07), "MenhirD": (0x7E796F, 0.06), "Lichen": (0xC9C08A, 0.05),
    "Rune": (0x5F7FA8, 0.0), "Basalt": (0x4A4440, 0.06), "BasaltL": (0x6A625C, 0.05), "Sulfur": (0xD9C34A, 0.04),
    "DuckY": (0xF6D32D, 0.02), "DuckO": (0xF08A24, 0.02), "Sword": (0xC9D0D6, 0.02), "Hilt": (0xE0B040, 0.02),
    "ShroomR": (0xD8382E, 0.03), "ShroomW": (0xF7F1E3, 0.02), "ShroomB": (0xB27A48, 0.04), "GnomeHat": (0xC8402F, 0.02),
    "Lamp": (0xFFD27A, 0.0), "BannerB": (0x2F5FA8, 0.02),
})
NODES = []


def node(name, fn, seed):
    LEVEL.clear()
    rnd.seed(seed)
    fn()
    objs = list(LEVEL)
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    if len(objs) > 1:
        bpy.ops.object.join()
    obj = bpy.context.view_layer.objects.active
    obj.data.transform(obj.matrix_world)
    obj.matrix_world = Matrix.Identity(4)
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.0002)
    bm.to_mesh(obj.data)
    bm.free()
    obj.name = obj.data.name = name
    LEVEL.clear()
    NODES.append((name, obj))
    return obj


def rock(x, y, z, s, mat="CaveR", sy=0.7):
    blob(s, mat, (x, y, z), scale=(rnd.uniform(0.9, 1.3), sy, rnd.uniform(0.9, 1.25)), sub=1, smooth=False)


# ------------------------------------------------------------------ brug
def bridge():
    Lh, W = 7.0, 0.95                         # halve lengte, breedte; dek bovenop op y = 0
    span = 2 * Lh / 3                         # drie bogen
    pw = 0.55                                 # pijlerbreedte
    rise = 1.25                               # pijl van de boog (zichtbaar boven het water)
    # plaveisel en dek
    box(2 * Lh, 0.14, W, "BrDeck", pos=(0, -0.14, 0), bevel=0.02)
    for i in range(30):
        x = -Lh + 0.24 + i * (2 * Lh - 0.48) / 29
        box(0.4, 0.012, W - 0.22, "BrStoneL" if i % 2 else "BrStone", pos=(x, 0.0, 0))
    # borstweringen met kantelen
    for sz in (-1, 1):
        box(2 * Lh, 0.3, 0.12, "BrStone", pos=(0, 0.0, sz * (W / 2 - 0.05)), bevel=0.02)
        box(2 * Lh + 0.04, 0.05, 0.16, "BrStoneD", pos=(0, 0.3, sz * (W / 2 - 0.05)), bevel=0.01)
        for i in range(10):
            box(0.28, 0.1, 0.14, "BrStoneL", pos=(-Lh + 0.7 + i * (2 * Lh - 1.4) / 9, 0.35, sz * (W / 2 - 0.05)))
    # bogen: gesloten borstwand met een gebogen onderkant (segmentboog), boogstenen erlangs
    for a in range(3):
        x0 = -Lh + span * a + pw / 2
        x1 = -Lh + span * (a + 1) - pw / 2
        c = x1 - x0
        cx = (x0 + x1) / 2
        R = (c * c / 4 + rise * rise) / (2 * rise)
        cy = -0.14 - rise - (R - rise)            # middelpunt van de cirkel
        steps = 14
        for q in range(steps):
            xa = x0 + c * q / steps
            xb = x0 + c * (q + 1) / steps
            xm = (xa + xb) / 2
            ya = cy + math.sqrt(max(0.0, R * R - (xm - cx) ** 2))   # onderkant boog
            hgt = -0.14 - ya
            if hgt > 0.01:
                box(xb - xa + 0.002, hgt, W - 0.02, "BrStone" if q % 2 else "BrStoneD", pos=(xm, ya, 0))
        for q in range(steps + 1):                 # boogstenen (iets uitstekend, voor en achter)
            xq = x0 + c * q / steps
            yq = cy + math.sqrt(max(0.0, R * R - (xq - cx) ** 2))
            ang = math.atan2(xq - cx, yq - cy)
            for sz in (-1, 1):
                box(0.1, 0.2, 0.06, "BrStoneL", pos=(xq, yq - 0.1, sz * (W / 2 + 0.01)), rot=(0, 0, -ang))
    # pijlers tot diep in de canyon, met stroombrekers
    for k in range(4):
        px = -Lh + span * k
        w = pw if 0 < k < 3 else 0.8
        box(w, 3.4, W + 0.12, "BrStone", pos=(px, -3.55, 0), bevel=0.03)
        if 0 < k < 3:
            cyl(0.0, W * 0.6, 1.4, 4, "BrStoneD", pos=(px, -3.55, 0), rot=(0, math.pi / 4, 0), smooth=False)
        for q in range(5):
            box(0.14, 0.1, 0.06, "BrStoneL", pos=(px + rnd.uniform(-w / 3, w / 3), -3.1 + q * 0.55, (W + 0.12) / 2 + 0.02))
    # landhoofden met lantaarns en vaandels
    for sx in (-1, 1):
        x = sx * (Lh - 0.15)
        for sz in (-1, 1):
            box(0.26, 0.6, 0.26, "BrStoneD", pos=(x, 0.0, sz * (W / 2 + 0.06)), bevel=0.02)
            cyl(0.03, 0.03, 0.4, 6, "Iron", pos=(x, 0.6, sz * (W / 2 + 0.06)), smooth=False)
            box(0.1, 0.12, 0.1, "Lamp", pos=(x, 1.0, sz * (W / 2 + 0.06)))
            cyl(0.0, 0.09, 0.08, 4, "Iron", pos=(x, 1.12, sz * (W / 2 + 0.06)), rot=(0, math.pi / 4, 0), smooth=False)
        box(0.02, 0.34, 0.22, "BannerB", pos=(x + sx * 0.14, 0.14, 0))
        box(0.024, 0.08, 0.08, "Hilt", pos=(x + sx * 0.15, 0.32, 0))


# ------------------------------------------------------------------ ruïne
def ruin():
    # ingestorte muren in een L, met een spitsboog
    for i in range(6):
        h = [0.9, 0.7, 1.05, 0.5, 0.3, 0.6][i]
        box(0.3, h, 0.22, "Ruin" if i % 2 else "RuinD", pos=(-0.9 + i * 0.32, 0.0, -0.9), bevel=0.02)
    for i in range(4):
        h = [0.8, 0.55, 0.35, 0.65][i]
        box(0.22, h, 0.3, "Ruin", pos=(-0.9, 0.0, -0.58 + i * 0.32), bevel=0.02)
    for sx in (-1, 1):
        box(0.18, 1.0, 0.24, "RuinD", pos=(0.55 + sx * 0.3, 0.0, -0.9), bevel=0.02)
    half_tube((0.55, 1.0, -0.9), (0, 0, 1), (0, 1, 0), 0.33, 0.24, "Ruin", seg=8, cap=True)
    # gebroken zuilen
    for (x, z, h) in ((0.2, 0.3, 0.7), (0.8, 0.5, 0.35), (-0.2, 0.75, 0.5)):
        cyl(0.1, 0.12, h, 8, "Ruin", pos=(x, 0.0, z), smooth=False)
        cyl(0.14, 0.14, 0.06, 8, "RuinD", pos=(x, 0.0, z), smooth=False)
    cyl(0.1, 0.1, 0.55, 8, "Ruin", pos=(0.95, 0.12, 0.05), rot=(0, 0, 1.45), smooth=False)        # omgevallen zuil
    for _ in range(14):                                                          # puin
        x, z = rnd.uniform(-1.0, 1.0), rnd.uniform(-0.6, 1.0)
        box(rnd.uniform(0.1, 0.22), rnd.uniform(0.06, 0.12), rnd.uniform(0.1, 0.2), rnd.choice(("Ruin", "RuinD")), pos=(x, 0.0, z), rot=(0, rnd.uniform(0, 3), rnd.uniform(-0.2, 0.2)))
    for (x, y, z, s) in ((-0.8, 0.9, -0.85, 0.14), (-0.4, 1.05, -0.86, 0.12), (-0.88, 0.8, -0.3, 0.12), (0.2, 0.7, 0.3, 0.1)):
        blob(s, "Moss2", (x, y, z), scale=(1.4, 0.4, 1.2), sub=1)
    for i in range(6):                                                           # klimop langs de muur
        blob(0.08, "Ivy", (-0.75 + i * 0.12, 0.25 + (i % 3) * 0.18, -0.78), scale=(1.2, 1.4, 0.5), sub=1)


# ------------------------------------------------------------------ grot
def cave():
    blob(1.05, "CaveR", (0, 0.1, -0.2), scale=(1.0, 0.75, 0.9), sub=2, smooth=False)       # rotsheuvel
    for _ in range(9):
        a = rnd.uniform(0, math.tau)
        rock(math.cos(a) * 0.9, 0.15, math.sin(a) * 0.75 - 0.1, rnd.uniform(0.2, 0.35))
    # donkere opening (halve schijf) met druipsteen
    half_tube((0, 0.0, 0.62), (0, 0, 1), (0, 1, 0), 0.42, 0.3, "CaveD", seg=10, cap=True)
    half_tube((0, 0.0, 0.66), (0, 0, 1), (0, 1, 0), 0.5, 0.12, "CaveR", seg=10, cap=False)
    for i in range(5):
        x = -0.28 + i * 0.14
        cyl(0.0, 0.035, 0.12 + (i % 2) * 0.06, 5, "CaveR", pos=(x, 0.42 - (i % 2) * 0.04, 0.76), rot=(math.pi, 0, 0), smooth=False)
    blob(0.4, "CaveM", (0.2, 0.75, -0.1), scale=(1.4, 0.3, 1.2), sub=1)
    for i in range(4):
        rock(-0.6 + i * 0.4, 0.0, 0.85 + (i % 2) * 0.15, 0.1, "CaveR", sy=0.5)


# ------------------------------------------------------------------ watervallen
def falls_hidden():
    # rotswand achter, cascade in het midden, poel vooraan
    for i in range(7):
        x = -1.3 + i * 0.43
        blob(0.55, "CaveR", (x, 0.6 + (i % 3) * 0.2, -0.6), scale=(1.0, 1.9, 0.8), sub=1, smooth=False)
    box(0.5, 1.8, 0.08, "FallA", pos=(0, 0.05, -0.1))
    for k in range(6):
        box(0.08, 1.7 - k * 0.1, 0.05, "FallB", pos=(-0.2 + k * 0.08, 0.1, -0.05))
    cyl(0.85, 0.85, 0.05, 16, "Pool", pos=(0, 0.0, 0.45), smooth=False)
    for k in range(8):
        a = k * math.tau / 8
        rock(math.cos(a) * 0.95, 0.0, 0.45 + math.sin(a) * 0.85, rnd.uniform(0.12, 0.2))
    for k in range(5):
        blob(0.1, "Foam", (rnd.uniform(-0.25, 0.25), 0.05, rnd.uniform(-0.05, 0.25)), scale=(1.4, 0.5, 1.2), sub=1)
    blob(0.3, "Moss2", (-0.9, 1.2, -0.5), scale=(1.5, 0.4, 1.0), sub=1)
    blob(0.25, "Ivy", (0.8, 1.0, -0.45), scale=(1.2, 0.8, 0.6), sub=1)


def falls_canyon():
    # cascade van de rand (y = 0) naar de bodem (y = -3), licht naar voren (+z) uitwaaierend
    for k in range(8):
        f0, f1 = k / 8, (k + 1) / 8
        y0, y1 = -f0 * 3.0, -f1 * 3.0
        z0, z1 = 0.05 + f0 * 0.25, 0.05 + f1 * 0.25
        w0, w1 = 0.32 + f0 * 0.25, 0.32 + f1 * 0.25
        bm = bmesh.new()
        quad = [(-w0, y0, z0), (w0, y0, z0), (w1, y1, z1), (-w1, y1, z1)]
        bm.faces.new(gverts(bm, quad))                                   # voorkant
        bm.faces.new(list(reversed(gverts(bm, [(x, y, z - 0.004) for x, y, z in quad]))))   # achterkant
        new_obj("fall", bm, "FallA" if k % 2 else "FallB")
    for k in range(7):
        blob(0.16, "Foam", (rnd.uniform(-0.4, 0.4), -3.0, rnd.uniform(0.15, 0.55)), scale=(1.5, 0.5, 1.3), sub=1)
    for k in range(4):
        rock(rnd.uniform(-0.6, 0.6), 0.0, rnd.uniform(-0.3, 0.0), 0.12, "CaveR", sy=0.5)


# ------------------------------------------------------------------ stenen kring en monument
def stones():
    n, R = 9, 1.3
    for i in range(n):
        a = i * math.tau / n
        h = 0.9 + (i % 3) * 0.15
        lean = 0.08 if i % 4 else 0.0
        box(0.22, h, 0.15, "Menhir" if i % 2 else "MenhirD", pos=(math.cos(a) * R, -0.05, math.sin(a) * R), rot=(0, -a, lean), bevel=0.04)
        blob(0.07, "Lichen", (math.cos(a) * R, h * 0.6, math.sin(a) * R), scale=(1.2, 0.6, 0.6), sub=0)
    for i in (0, 4):                          # dekstenen
        a0, a1 = i * math.tau / n, (i + 1) * math.tau / n
        am = (a0 + a1) / 2
        box(0.95, 0.16, 0.2, "MenhirD", pos=(math.cos(am) * R * 0.98, 1.0, math.sin(am) * R * 0.98), rot=(0, -am + math.pi / 2, 0), bevel=0.03)
    box(0.7, 0.25, 0.4, "Menhir", pos=(0, 0.0, 0), bevel=0.04)          # altaarsteen
    for k in range(3):
        box(0.05, 0.05, 0.005, "Rune", pos=(-0.2 + k * 0.2, 0.15, 0.2))


def monument():
    for k, (w, h) in enumerate(((1.4, 0.18), (1.1, 0.18), (0.8, 0.2))):
        box(w, h, w, "Menhir" if k % 2 else "MenhirD", pos=(0, sum(hh for _, hh in ((1.4, 0.18), (1.1, 0.18), (0.8, 0.2))[:k]), 0), bevel=0.03)
    y = 0.56
    cyl(0.18, 0.28, 2.1, 4, "Menhir", pos=(0, y, 0), rot=(0, math.pi / 4, 0), smooth=False)     # obelisk
    cyl(0.0, 0.18, 0.32, 4, "MenhirD", pos=(0, y + 2.1, 0), rot=(0, math.pi / 4, 0), smooth=False)
    for k in range(5):                         # runen
        box(0.12, 0.05, 0.01, "Rune", pos=(0, y + 0.4 + k * 0.3, 0.23 - k * 0.008))
    for (x, z) in ((0.5, 0.45), (-0.55, 0.2), (0.2, -0.6)):
        blob(0.12, "Moss2", (x, 0.2, z), scale=(1.5, 0.4, 1.2), sub=1)
    for k in range(5):
        a = rnd.uniform(0, math.tau)
        box(0.18, 0.1, 0.14, "MenhirD", pos=(math.cos(a) * 0.95, 0.0, math.sin(a) * 0.95), rot=(0, a, 0.2))


def vent():
    for _ in range(8):
        a = rnd.uniform(0, math.tau)
        rock(math.cos(a) * 0.35, 0.0, math.sin(a) * 0.3, rnd.uniform(0.12, 0.2), "Basalt" if rnd.random() < 0.6 else "BasaltL", sy=0.55)
    box(0.5, 0.02, 0.08, "CaveD", pos=(0, 0.0, 0), rot=(0, 0.4, 0))
    for _ in range(4):
        blob(0.05, "Sulfur", (rnd.uniform(-0.25, 0.25), 0.03, rnd.uniform(-0.2, 0.2)), scale=(1.4, 0.4, 1.2), sub=0)


# ------------------------------------------------------------------ easter eggs
def egg_sword():
    blob(0.4, "Menhir", (0, 0.1, 0), scale=(1.2, 0.7, 1.0), sub=1, smooth=False)
    box(0.04, 0.6, 0.012, "Sword", pos=(0, 0.3, 0), rot=(0, 0, 0.08), bevel=0.0)
    box(0.24, 0.035, 0.05, "Hilt", pos=(0.05, 0.88, 0), rot=(0, 0, 0.08))
    box(0.035, 0.16, 0.035, "Ivy", pos=(0.06, 0.9, 0), rot=(0, 0, 0.08))
    blob(0.035, "Hilt", (0.07, 1.08, 0), sub=1)
    for k in range(3):
        blob(0.09, "Moss2", (rnd.uniform(-0.3, 0.3), 0.3, rnd.uniform(-0.25, 0.25)), scale=(1.3, 0.4, 1.1), sub=1)


def egg_duck():
    blob(0.4, "DuckY", (0, 0.18, 0), scale=(1.0, 0.75, 1.3), sub=2)
    blob(0.26, "DuckY", (0, 0.58, 0.3), sub=2)
    blob(0.12, "DuckO", (0, 0.54, 0.56), scale=(1.4, 0.5, 1.2), sub=1)
    for s in (-1, 1):
        blob(0.045, "CaveD", (s * 0.12, 0.66, 0.5), sub=1)
        blob(0.015, "Foam", (s * 0.13, 0.68, 0.54), sub=0)
    blob(0.12, "DuckY", (0, 0.36, -0.5), scale=(0.8, 0.9, 1.0), sub=1)       # staartje


def egg_gnomes():
    for k, (x, z, s) in enumerate(((0, 0, 1.0), (0.55, 0.3, 0.75), (-0.45, 0.4, 0.65))):
        cyl(0.14 * s, 0.17 * s, 0.32 * s, 10, "ShroomW", pos=(x, 0.0, z))
        blob(0.3 * s, "ShroomR" if k != 1 else "ShroomB", (x, 0.34 * s, z), scale=(1.0, 0.55, 1.0), sub=2)
        for q in range(4):
            a = q * 1.6 + k
            blob(0.04 * s, "ShroomW", (x + math.cos(a) * 0.18 * s, 0.44 * s, z + math.sin(a) * 0.18 * s), scale=(1, 0.4, 1), sub=0)
        box(0.08 * s, 0.14 * s, 0.01, "ShroomB", pos=(x, 0.0, z + 0.165 * s))                     # deurtje
        box(0.05 * s, 0.05 * s, 0.01, "Lamp", pos=(x + 0.08 * s, 0.17 * s, z + 0.15 * s))          # raampje
    # een kaboutermutsje op een paaltje
    cyl(0.02, 0.02, 0.2, 5, "ShroomB", pos=(0.2, 0.0, 0.6), smooth=False)
    cyl(0.0, 0.07, 0.16, 8, "GnomeHat", pos=(0.2, 0.2, 0.6), smooth=False)


ASSETS = [("bridge", bridge, 9000), ("ruin", ruin, 1500), ("cave", cave, 1500), ("falls_hidden", falls_hidden, 1500),
          ("falls_canyon", falls_canyon, 600), ("stones", stones, 1200), ("monument", monument, 900), ("vent", vent, 500),
          ("egg_sword", egg_sword, 900), ("egg_duck", egg_duck, 1500), ("egg_gnomes", egg_gnomes, 2400)]
over = []
for n, (name, fn, lim) in enumerate(ASSETS):
    obj = node(name, fn, 6600 + n * 31)
    tris = ve.triangle_count([obj])
    print(f"VE-LANDMARK {name} tris={tris} budget={lim}")
    if tris > lim:
        over.append(f"{name} {tris}>{lim}")
if over:
    raise SystemExit("VE-BLENDER: boven budget: " + ", ".join(over))
use_ao = not os.environ.get("VE_NO_AO")
if use_ao:
    for name, obj in NODES:
        for _, o in NODES:
            o.hide_render = o is not obj
        bake_ao(obj, samples=24, distance=0.2)
    for _, o in NODES:
        o.hide_render = False
for n, (name, obj) in enumerate(NODES):
    obj.matrix_world = Matrix.Translation(M3 @ Vector(((n % 4) * 4.0, 0, (n // 4) * 4.0)))
ve.export_glb(args.out, budget=sum(a[2] for a in ASSETS), vertex_colors=use_ao)
