"""Village Empire — dorpelingen: gedeeld rig, losse lichaamsdelen/varianten en alle animaties in één GLB.

Opbouw (game-assen: Y omhoog, gezicht naar +Z, voeten op y = 0; de game schaalt ×1.28):
  rig_*            lege nodes = het gedeelde 'skelet' (root, hips, torso, head, armR/L, legR/L, tool, carry)
  <node>__<deel>   meshdelen die aan die node vastzitten, bijv. head__face_a, head__hat_straw, legR__boot
                   'Tint'-materiaal = wit; de game kleurt het per bewoner (huid, kleding, haar, beroep)
  animaties        NLA-tracks op de rig-nodes → één glTF-animatie per clip (idle, walk, chop, ...)

Waarom zo (en geen skinned mesh): elke deel-variant wordt in de game één InstancedMesh voor ALLE
bewoners samen, dus een vast, klein aantal draw calls — ook met 100+ bewoners. De animaties
worden per bewoner op de CPU gesampled (11 nodes) en in de instance-matrices verwerkt.

Bouwen: npm run models -- settler
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
from ve_parts import rnd, LEVEL, MATS, M3, M4  # noqa: E402

args = ve.parse_args()
ve.reset_scene()
setup(seed=8101, extra_palette={
    "Tint": (0xFFFFFF, 0.0),
    "Eye": (0x24160E, 0.0), "Brow": (0x4A3020, 0.0), "Nose": (0xE48F6C, 0.0), "Cheek": (0xF2958A, 0.0),
    "Mouth": (0x8A3226, 0.0), "Teeth": (0xFBF6EA, 0.0), "Sparkle": (0xFFFFFF, 0.0), "Freckle": (0xB8734A, 0.0),
    "Steel": (0x9AA1A8, 0.02), "Collar": (0xF4F0E8, 0.0), "Buckle": (0xFFE9A0, 0.0), "BeltC": (0x5A4028, 0.0),
    "Apron": (0xF2EADB, 0.0), "ApronB": (0x8A5A34, 0.0), "Feather": (0xD94A3A, 0.0), "FeatherG": (0x6AAA3E, 0.0),
    "Carrot": (0xE8742A, 0.0), "Duck": (0xF6D32D, 0.0), "Beak": (0xF08A24, 0.0), "Teddy": (0xA8743E, 0.0),
    "LogoR": (0xD8402F, 0.0), "Gold2": (0xE8B73A, 0.0), "Glass2": (0xBFE3F2, 0.0), "Bee": (0xF2C230, 0.0),
    "BeeB": (0x2A2420, 0.0), "Snail": (0xB98A5E, 0.0), "SnailB": (0x8FAF6A, 0.0), "Frog": (0x6FB43F, 0.0),
    "Cheese": (0xF7C948, 0.0), "Leek": (0xD8E8B0, 0.0), "LeekG": (0x5E9A3A, 0.0), "Patch": (0xC85A8A, 0.0),
    "Bandaid": (0xF0C9A0, 0.0), "Ribbon": (0xD94A8A, 0.0), "Nest": (0x8A6A3A, 0.0), "EggB": (0xBFE0F0, 0.0),
    "Pencil": (0xF2C14E, 0.0), "Spoon": (0xC9CED4, 0.0), "Quill": (0xF7F3EA, 0.0), "Horse": (0x7A7F86, 0.0),
    "Lantern": (0xFFD27A, 0.0),
})

# ------------------------------------------------------------------ rig (game-coördinaten, rustpose)
NODES = {   # naam: (ouder, wereldpositie in rust)
    "root": (None, (0, 0, 0)),
    "hips": ("root", (0, 0.085, 0)),
    "legR": ("hips", (0.027, 0.085, 0)), "legL": ("hips", (-0.027, 0.085, 0)),
    "torso": ("hips", (0, 0.09, 0)),
    "head": ("torso", (0, 0.195, 0)),
    "armR": ("torso", (0.062, 0.18, 0)), "armL": ("torso", (-0.062, 0.18, 0)),
    "tool": ("armR", (0.062, 0.092, 0.012)),
    "carry": ("torso", (0, 0.15, 0.09)),
}
RIG = {}


def make_rig():
    for name, (parent, pos) in NODES.items():
        o = bpy.data.objects.new("rig_" + name, None)
        bpy.context.collection.objects.link(o)
        o.rotation_mode = "XYZ"
        if parent:
            o.parent = RIG[parent]
            local = Vector(pos) - Vector(NODES[parent][1])
        else:
            local = Vector(pos)
        o.location = M3 @ local
        RIG[name] = o


# ------------------------------------------------------------------ hulpjes
def part(node, name, fn):
    """Bouwt één meshdeel (via de ve_parts-primitieven) en voegt het samen tot '<node>__<name>'."""
    LEVEL.clear()
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
    obj.name = obj.data.name = f"{node}__{name}"
    LEVEL.clear()
    return obj


def dome(center, r, cut_y, back=0.0, mat="Tint", sx=1.0, sy=1.0, sz=1.0, seg=14, rings=9):
    """Bol die onder een (licht kantelend) vlak is afgesneden: kapsels, mutsen, helmen.
    cut_y = hoogte van de snede t.o.v. het middelpunt; back > 0 laat de snede achter lager lopen."""
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=rings, radius=r)
    for v in bm.verts:
        g = Vector((v.co.x * sx, v.co.z * sy, -v.co.y * sz))          # bol in game-assen
        v.co = M3 @ g
    # snedevlak in game-assen: normaal (0, 1, -back) genormaliseerd → achter lager
    n_g = Vector((0, 1, -back)).normalized()
    bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], dist=0.0001,
                           plane_co=M3 @ Vector((0, cut_y, 0)), plane_no=M3 @ n_g, clear_inner=True)
    obj = new_obj("dome", bm, mat, smooth=True)
    obj.location = M3 @ Vector(center)
    return obj


HC = 0.265          # hoogte middelpunt hoofd
HR = 0.066          # straal hoofd (groot, cartoonesk)


def fz(x, y, off=0.0):
    """Diepte (z) van het hoofdoppervlak op (x, y) plus `off`: gezichtsdelen liggen op de bol, niet erin."""
    d = HR * HR - x * x - ((y - HC) / 0.97) ** 2
    return math.sqrt(max(d, 0.0)) * 0.98 + off


def eye(x, y, size=1.0, lid=False, look=0.0):
    """Cartoonoog: oogwit, pupil en glinstering; lid = halfgesloten (slaperig)."""
    z = fz(x, y)
    blob(0.0155 * size, "Sparkle", (x, y, z - 0.002), scale=(0.82, 1.12, 0.45), sub=2)
    blob(0.0092 * size, "Eye", (x + look, y - 0.002, z + 0.0045), scale=(0.9, 1.05, 0.45), sub=1)
    blob(0.0034 * size, "Sparkle", (x + look + 0.003, y + 0.003, z + 0.0085), sub=0)
    if lid:
        blob(0.0165 * size, "Tint", (x, y + 0.006, z - 0.001), scale=(0.9, 0.62, 0.5), sub=1)


def brow(x, y, rot, w=0.022, t=0.0065):
    box(w, t, 0.006, "Brow", pos=(x, y, fz(x, y, 0.002)), rot=(-0.2, 0, rot), base=False, bevel=0.002)


def smile(y, w=0.012, curve=0.004):
    """Glimlach: midden plus twee opkrullende mondhoeken, op het oppervlak."""
    box(w * 1.4, 0.0055, 0.006, "Mouth", pos=(0, y, fz(0, y, 0.001)), base=False)
    for sx in (-1, 1):
        x = sx * w * 0.95
        box(0.009, 0.0055, 0.006, "Mouth", pos=(x, y + curve * 0.6, fz(x, y + curve * 0.6, 0.0)),
            rot=(0, sx * 0.25, sx * 0.55), base=False)


def head_base():
    blob(HR, "Tint", (0, HC, 0), scale=(1.0, 0.97, 0.98), sub=2)
    for sx in (-1, 1):
        blob(0.016, "Tint", (sx * HR * 0.98, HC - 0.004, -0.004), scale=(0.6, 1.0, 0.85), sub=1)   # oren


def face_a():          # vrolijk: grote ronde neus, blosjes, brede glimlach
    head_base()
    blob(0.017, "Nose", (0, HC - 0.008, fz(0, HC - 0.008, -0.002)), sub=1)
    for sx in (-1, 1):
        eye(sx * 0.024, HC + 0.011)
        brow(sx * 0.025, HC + 0.034, sx * 0.18)
        blob(0.011, "Cheek", (sx * 0.037, HC - 0.012, fz(sx * 0.037, HC - 0.012, -0.004)), scale=(1, 0.7, 0.45), sub=1)
    smile(HC - 0.03)


def face_b():          # slaperig: halfgesloten oogleden, dikke wenkbrauwen, puntneus, scheef lachje
    head_base()
    blob(0.014, "Nose", (0, HC - 0.006, fz(0, HC - 0.006, 0.0)), scale=(0.9, 1.15, 1.35), sub=1)
    for sx in (-1, 1):
        eye(sx * 0.024, HC + 0.009, size=0.95, lid=True)
        brow(sx * 0.025, HC + 0.031, -sx * 0.12, w=0.026, t=0.01)
    box(0.02, 0.0055, 0.006, "Mouth", pos=(0.005, HC - 0.03, fz(0.005, HC - 0.03, 0.001)), rot=(0, 0, 0.14), base=False)


def face_c():          # brede grijns met tandjes, ondeugende blik, sproetjes
    head_base()
    blob(0.015, "Nose", (0, HC - 0.006, fz(0, HC - 0.006, -0.002)), sub=1)
    for sx in (-1, 1):
        eye(sx * 0.022, HC + 0.013, size=0.9, look=0.003)
        brow(sx * 0.023, HC + 0.033, sx * 0.32, w=0.019)
        for k in range(3):
            x, y = sx * (0.03 + k * 0.006), HC - 0.008 - (k % 2) * 0.004
            blob(0.0024, "Freckle", (x, y, fz(x, y, 0.0)), sub=0)
    y = HC - 0.026
    half_tube((0, y, fz(0, y, -0.006)), (1, 0, 0), (0, -1, 0.35), 0.018, 0.01, "Mouth", seg=6, cap=True)
    box(0.022, 0.006, 0.004, "Teeth", pos=(0, y - 0.002, fz(0, y - 0.002, 0.0015)), base=False)


# ------------------------------------------------------------------ onderdelen bouwen
make_rig()
P = []

# lichaam (2 bouwtypes), riem, schort
def torso_slim():
    cyl(0.047, 0.06, 0.105, 12, "Tint", pos=(0, 0.085, 0))
    for sx in (-1, 1):
        blob(0.021, "Tint", (sx * 0.055, 0.18, 0), sub=1)
    cyl(0.03, 0.04, 0.013, 12, "Collar", pos=(0, 0.186, 0))


def torso_round():
    cyl(0.05, 0.066, 0.105, 12, "Tint", pos=(0, 0.085, 0))
    blob(0.058, "Tint", (0, 0.125, 0.014), scale=(1.0, 0.9, 0.95), sub=2)
    for sx in (-1, 1):
        blob(0.022, "Tint", (sx * 0.058, 0.18, 0), sub=1)
    cyl(0.031, 0.042, 0.013, 12, "Collar", pos=(0, 0.186, 0))


P.append(part("torso", "body_slim", torso_slim))
P.append(part("torso", "body_round", torso_round))
P.append(part("torso", "belt_slim", lambda: (cyl(0.062, 0.062, 0.014, 12, "BeltC", pos=(0, 0.1, 0), smooth=False),
                                              box(0.018, 0.016, 0.006, "Buckle", pos=(0, 0.099, 0.062)))))
P.append(part("torso", "belt_round", lambda: (cyl(0.072, 0.072, 0.014, 12, "BeltC", pos=(0, 0.1, 0.004), smooth=False),
                                               box(0.018, 0.016, 0.006, "Buckle", pos=(0, 0.099, 0.077)))))
P.append(part("torso", "apron", lambda: (box(0.085, 0.1, 0.006, "Apron", pos=(0, 0.06, 0.07), rot=(-0.12, 0, 0), bevel=0.002),
                                          box(0.03, 0.02, 0.004, "ApronB", pos=(0, 0.09, 0.075), rot=(-0.12, 0, 0)))))

# benen, laarzen, armen, handen (gemodelleerd aan de rechterkant; de game gebruikt ze voor beide kanten)
P.append(part("legR", "leg", lambda: cyl(0.018, 0.02, 0.06, 8, "Tint", pos=(0.027, 0.028, 0))))
P.append(part("legR", "boot", lambda: blob(0.023, "Tint", (0.027, 0.018, 0.009), scale=(0.95, 0.65, 1.35), sub=1)))
P.append(part("armR", "sleeve", lambda: (cyl(0.018, 0.016, 0.075, 8, "Tint", pos=(0.062, 0.108, 0)),
                                          blob(0.018, "Tint", (0.062, 0.178, 0), sub=1))))
P.append(part("armR", "hand", lambda: blob(0.019, "Tint", (0.062, 0.094, 0.002), scale=(0.95, 1.05, 0.9), sub=1)))

# hoofden
P.append(part("head", "face_a", face_a))
P.append(part("head", "face_b", face_b))
P.append(part("head", "face_c", face_c))

# kapsels (Tint = haarkleur)
def hair_cap():
    dome((0, HC + 0.004, -0.004), HR + 0.006, -0.01, back=0.9, sx=1.03, sz=1.04)


def hair_short():
    hair_cap()
    for sx in (-1, 1):
        box(0.012, 0.03, 0.03, "Tint", pos=(sx * 0.064, HC - 0.012, -0.012), bevel=0.004, smooth=True)


def hair_long():
    hair_cap()
    blob(0.062, "Tint", (0, HC - 0.03, -0.03), scale=(1.05, 1.2, 0.7), sub=2)
    for sx in (-1, 1):
        blob(0.02, "Tint", (sx * 0.06, HC - 0.035, 0.0), scale=(0.7, 1.9, 0.9), sub=1)


def hair_curly():
    hair_cap()
    for i in range(9):
        a = i / 9 * 2 * math.pi
        blob(0.017, "Tint", (math.cos(a) * 0.06, HC + 0.012 + (i % 2) * 0.012, math.sin(a) * 0.058 - 0.006), sub=1)


def hair_ponytail():
    hair_cap()
    blob(0.02, "Tint", (0, HC + 0.01, -0.07), sub=1)
    blob(0.022, "Tint", (0, HC - 0.03, -0.08), scale=(0.8, 1.8, 0.8), sub=1)


P.append(part("head", "hair_short", hair_short))
P.append(part("head", "hair_long", hair_long))
P.append(part("head", "hair_curly", hair_curly))
P.append(part("head", "hair_ponytail", hair_ponytail))

# baarden en snorren (Tint = haarkleur)
def mustache(scale=1.0):
    for sx in (-1, 1):
        blob(0.014 * scale, "Tint", (sx * 0.014 * scale, HC - 0.018, fz(sx * 0.014 * scale, HC - 0.018, 0.003)), scale=(1.6, 0.6, 0.7), sub=1)
        blob(0.006 * scale, "Tint", (sx * 0.036 * scale, HC - 0.01 * scale, fz(min(sx * 0.036 * scale, 0.05), HC - 0.01, -0.002)), sub=1)


P.append(part("head", "beard_mustache", mustache))
P.append(part("head", "beard_full", lambda: (blob(0.05, "Tint", (0, HC - 0.04, 0.026), scale=(1.15, 0.95, 0.75), sub=2), mustache())))
P.append(part("head", "beard_goatee", lambda: blob(0.016, "Tint", (0, HC - 0.046, fz(0, HC - 0.046, -0.004)), scale=(1, 1.4, 0.8), sub=1)))
# easter egg: veel te grote snor
P.append(part("head", "egg_bigmustache", lambda: mustache(2.1)))
# easter egg: gevlochten baard met strikje
P.append(part("head", "egg_braid", lambda: (blob(0.046, "Tint", (0, HC - 0.04, 0.03), scale=(1.1, 0.9, 0.7), sub=2), mustache(),
                                             *[blob(0.013, "Tint", (0, HC - 0.085 - k * 0.018, 0.045), sub=1) for k in range(3)],
                                             blob(0.008, "Ribbon", (-0.009, HC - 0.13, 0.048), scale=(1.4, 1, 0.6), sub=0),
                                             blob(0.008, "Ribbon", (0.009, HC - 0.13, 0.048), scale=(1.4, 1, 0.6), sub=0))))

# hoeden per beroep (Tint = tweede beroepskleur)
HT = HC + 0.045     # hoogte hoedrand


def hat_straw():
    cyl(0.088, 0.088, 0.007, 16, "Tint", pos=(0, HT, 0))
    cyl(0.046, 0.054, 0.045, 14, "Tint", pos=(0, HT, 0))
    cyl(0.055, 0.055, 0.01, 14, "BeltC", pos=(0, HT + 0.006, 0), cap=False)


def hat_wide():
    cyl(0.11, 0.11, 0.007, 18, "Tint", pos=(0, HT - 0.004, 0))
    dome((0, HT, 0), 0.056, 0.0, sy=0.8)
    cyl(0.057, 0.057, 0.012, 14, "Feather", pos=(0, HT + 0.002, 0), cap=False)


def hat_beanie():
    dome((0, HC + 0.012, -0.002), HR + 0.008, 0.026, back=0.3, sy=1.05)          # rand boven de wenkbrauwen
    cyl(HR + 0.002, HR + 0.006, 0.016, 14, "Tint", pos=(0, HC + 0.036, -0.002), cap=False)
    blob(0.017, "Collar", (0, HC + HR + 0.02, -0.002), sub=1)


def hat_hood():          # bouwer: zachte kap met opgerolde rand
    dome((0, HC + 0.01, -0.004), HR + 0.009, 0.026, back=0.5)                     # rand boven de wenkbrauwen
    cyl(HR + 0.003, HR + 0.006, 0.012, 14, "BeltC", pos=(0, HC + 0.034, -0.004), cap=False)


def hat_feather():       # boswachter: alpenhoed met smalle rand, band en veer
    cyl(0.032, 0.05, 0.052, 12, "Tint", pos=(0, HT - 0.004, 0))
    blob(0.034, "Tint", (0, HT + 0.046, 0), scale=(1.0, 0.35, 0.9), sub=1)
    cyl(0.078, 0.078, 0.006, 16, "Tint", pos=(0, HT - 0.006, 0), rot=(-0.12, 0, 0))
    cyl(0.051, 0.051, 0.011, 12, "BeltC", pos=(0, HT, 0), cap=False)
    beam((0.036, HT + 0.004, -0.015), (0.075, HT + 0.085, -0.045), 0.007, "Feather")


def hat_helmet():        # mijnwerker/steenhouwer: helm met lampje
    dome((0, HC + 0.004, 0), HR + 0.01, 0.006, sy=1.0)
    cyl(HR + 0.02, HR + 0.02, 0.006, 16, "Tint", pos=(0, HC + 0.006, 0))
    box(0.018, 0.018, 0.012, "Lantern", pos=(0, HC + 0.035, HR + 0.006), bevel=0.003)


def hat_floppy():        # molenaar: zachte meelmuts
    blob(0.062, "Tint", (0.008, HT + 0.012, -0.004), scale=(1.1, 0.55, 1.05), sub=2)
    cyl(HR + 0.004, HR + 0.006, 0.012, 14, "Tint", pos=(0, HT - 0.012, 0), cap=False)


def hat_toque(tall=1.0):  # bakker: koksmuts
    cyl(0.044, 0.042, 0.05 * tall, 14, "Tint", pos=(0, HT - 0.012, 0))
    for i in range(6):
        a = i / 6 * 2 * math.pi
        blob(0.027, "Tint", (math.cos(a) * 0.026, HT + 0.04 * tall + 0.01, math.sin(a) * 0.026), sub=1)
    blob(0.03, "Tint", (0, HT + 0.05 * tall + 0.012, 0), sub=1)


def hat_souwester():     # visser
    dome((0, HC + 0.004, 0), HR + 0.009, 0.004, back=0.3)
    half_tube((0, HC + 0.008, -0.01), (1, 0, 0), (0, -0.5, -1), 0.085, 0.16, "Tint", seg=8, cap=False)


def hat_beret():         # wijnboer
    blob(0.068, "Tint", (0.012, HT + 0.002, 0), scale=(1.05, 0.32, 1.0), sub=2)
    cyl(0.003, 0.004, 0.012, 5, "BeltC", pos=(0.012, HT + 0.022, 0))


def hat_bycocket():      # koopman: bolle kruin, rand achter opgeslagen en voor puntig, met veer
    cyl(0.034, 0.05, 0.048, 12, "Tint", pos=(0, HT - 0.004, 0))
    blob(0.035, "Tint", (0, HT + 0.044, 0), scale=(1.0, 0.4, 0.95), sub=1)
    cyl(0.08, 0.08, 0.006, 16, "Tint", pos=(0, HT - 0.002, 0.006), rot=(-0.35, 0, 0))      # achter omhoog
    cyl(0.051, 0.051, 0.01, 12, "Gold2", pos=(0, HT + 0.002, 0), cap=False)
    beam((-0.03, HT + 0.012, -0.02), (-0.07, HT + 0.1, -0.06), 0.007, "Feather")


def hat_bandana():       # waard
    dome((0, HC + 0.004, -0.004), HR + 0.008, 0.012, back=0.4)
    blob(0.014, "Tint", (0, HC + 0.01, -HR - 0.004), sub=1)
    for sx in (-1, 1):
        blob(0.011, "Tint", (sx * 0.012, HC - 0.004, -HR - 0.01), scale=(0.8, 1.6, 0.6), sub=1)


def hat_flatcap():       # zager
    dome((0, HC + 0.01, -0.004), HR + 0.008, 0.026, back=0.2, sy=0.8)
    blob(0.034, "Tint", (0, HC + 0.035, HR - 0.006), scale=(1.25, 0.2, 0.9), sub=1)       # platte klep naar voren


def hat_kettle():        # wachter: ijzeren hoed
    dome((0, HC + 0.006, 0), HR + 0.01, 0.006)
    cyl(0.1, 0.1, 0.008, 18, "Tint", pos=(0, HC + 0.012, 0))


def hat_nightcap():      # easter egg: slaapmuts met kwast
    dome((0, HC + 0.006, -0.002), HR + 0.008, 0.016)
    cyl(0.0, 0.05, 0.12, 10, "Tint", pos=(0, HC + 0.05, -0.002), rot=(-0.9, 0, 0.2), cap=False)
    blob(0.016, "Collar", (0.02, HC + 0.12, -0.08), sub=1)


for name, fn in (("hat_straw", hat_straw), ("hat_wide", hat_wide), ("hat_beanie", hat_beanie), ("hat_hood", hat_hood),
                 ("hat_feather", hat_feather), ("hat_helmet", hat_helmet), ("hat_floppy", hat_floppy),
                 ("hat_toque", hat_toque), ("egg_tall_toque", lambda: hat_toque(2.6)), ("hat_souwester", hat_souwester),
                 ("hat_beret", hat_beret), ("hat_bycocket", hat_bycocket), ("hat_bandana", hat_bandana),
                 ("hat_flatcap", hat_flatcap), ("hat_kettle", hat_kettle), ("egg_nightcap", hat_nightcap)):
    P.append(part("head", name, fn))

# ------------------------------------------------------------------ easter eggs (vaste kleuren)
TOP = HC + 0.1      # ongeveer bovenop een hoed
EGGS = {
    ("head", "egg_carrot"): lambda: (cyl(0.0, 0.009, 0.06, 6, "Carrot", pos=(0.07, HC + 0.02, -0.01), rot=(0.3, 0, -0.9)),
                                     blob(0.008, "LeekG", (0.05, HC + 0.03, -0.012), scale=(1, 1.6, 1), sub=0)),
    ("head", "egg_pencil"): lambda: (cyl(0.004, 0.004, 0.07, 6, "Pencil", pos=(0.066, HC + 0.006, -0.03), rot=(math.pi / 2, 0.3, 0)),
                                     cyl(0.0, 0.004, 0.008, 6, "Brow", pos=(0.066, HC + 0.006, 0.04), rot=(math.pi / 2, 0.3, 0))),
    ("head", "egg_duck"): lambda: (blob(0.018, "Duck", (0, TOP, -0.004), scale=(1, 0.85, 1.25), sub=1),
                                   blob(0.012, "Duck", (0, TOP + 0.017, 0.014), sub=1),
                                   blob(0.006, "Beak", (0, TOP + 0.015, 0.027), scale=(1.2, 0.5, 1), sub=0)),
    ("head", "egg_monocle"): lambda: (cyl(0.013, 0.013, 0.003, 12, "Gold2", pos=(0.024, HC + 0.01, HR + 0.002), rot=(math.pi / 2, 0, 0), smooth=False),
                                      cyl(0.011, 0.011, 0.004, 12, "Glass2", pos=(0.024, HC + 0.01, HR + 0.002), rot=(math.pi / 2, 0, 0), smooth=False),
                                      beam((0.034, HC + 0.0, HR - 0.002), (0.05, HC - 0.06, 0.04), 0.0025, "Gold2")),
    ("head", "egg_eyepatch"): lambda: (cyl(0.012, 0.012, 0.004, 10, "BeeB", pos=(-0.024, HC + 0.01, HR - 0.004), rot=(math.pi / 2, 0, 0)),
                                       cyl(HR + 0.002, HR + 0.002, 0.004, 16, "BeeB", pos=(0, HC + 0.02, 0), rot=(0.35, 0, 0.3), cap=False)),
    ("head", "egg_bandaid"): lambda: (box(0.028, 0.008, 0.006, "Bandaid", pos=(0, HC - 0.003, HR + 0.01), rot=(0, 0, 0.5), base=False),
                                      box(0.006, 0.026, 0.006, "Bandaid", pos=(0, HC - 0.003, HR + 0.011), rot=(0, 0, 0.5), base=False)),
    ("head", "egg_flower"): lambda: (*[blob(0.008, "FlPink", (0.05 + math.cos(a) * 0.008, HT + 0.012 + math.sin(a) * 0.008, 0.03), sub=0)
                                       for a in (0, 1.26, 2.5, 3.8, 5.0)], blob(0.006, "Buckle", (0.05, HT + 0.012, 0.034), sub=0)),
    ("head", "egg_spoon"): lambda: (beam((0.04, HT, 0.03), (0.055, HT + 0.06, 0.02), 0.004, "Spoon"),
                                    blob(0.009, "Spoon", (0.057, HT + 0.068, 0.019), scale=(1, 1.4, 0.4), sub=1)),
    ("head", "egg_quill"): lambda: beam((-0.066, HC - 0.01, -0.02), (-0.09, HC + 0.07, -0.05), 0.006, "Quill"),
    ("head", "egg_bee"): lambda: (blob(0.009, "Bee", (0.11, HC + 0.06, 0), scale=(1.4, 1, 1), sub=1),
                                  box(0.003, 0.012, 0.012, "BeeB", pos=(0.11, HC + 0.055, 0)),
                                  blob(0.007, "Sparkle", (0.11, HC + 0.07, 0.006), scale=(0.6, 1, 1.6), sub=0)),
    ("head", "egg_snail"): lambda: (blob(0.013, "Snail", (0.0, TOP - 0.006, 0.0), scale=(0.7, 1, 1), sub=1),
                                    blob(0.008, "SnailB", (0.0, TOP - 0.014, 0.018), scale=(0.8, 0.6, 1.8), sub=1)),
    ("head", "egg_nest"): lambda: (cyl(0.03, 0.022, 0.016, 10, "Nest", pos=(0, TOP - 0.012, 0)),
                                   blob(0.009, "EggB", (0.005, TOP + 0.006, 0), scale=(1, 1.25, 1), sub=1),
                                   blob(0.009, "EggB", (-0.008, TOP + 0.004, 0.006), scale=(1, 1.25, 1), sub=1)),
    ("torso", "egg_frog"): lambda: (blob(0.015, "Frog", (0.058, 0.205, 0.0), scale=(1.1, 0.8, 1.2), sub=1),
                                    blob(0.004, "Sparkle", (0.051, 0.215, 0.012), sub=0), blob(0.004, "Sparkle", (0.065, 0.215, 0.012), sub=0)),
    ("torso", "egg_teddy"): lambda: (blob(0.013, "Teddy", (0.05, 0.075, 0.046), sub=1), blob(0.01, "Teddy", (0.05, 0.095, 0.048), sub=1),
                                     blob(0.004, "Teddy", (0.044, 0.104, 0.048), sub=0), blob(0.004, "Teddy", (0.056, 0.104, 0.048), sub=0)),
    ("torso", "egg_logo"): lambda: (cyl(0.013, 0.013, 0.004, 10, "LogoR", pos=(-0.026, 0.155, 0.046), rot=(math.pi / 2 - 0.25, 0, 0), smooth=False),
                                    box(0.004, 0.016, 0.003, "Sparkle", pos=(-0.03, 0.155, 0.049), rot=(-0.25, 0, 0), base=False),
                                    blob(0.0055, "Sparkle", (-0.025, 0.16, 0.049), scale=(1, 0.8, 0.4), sub=0),
                                    blob(0.0055, "Sparkle", (-0.025, 0.15, 0.049), scale=(1, 0.8, 0.4), sub=0)),
    ("torso", "egg_lantern"): lambda: (box(0.014, 0.022, 0.014, "Lantern", pos=(-0.064, 0.07, 0.02), bevel=0.002),
                                       cyl(0.009, 0.009, 0.004, 6, "Iron", pos=(-0.064, 0.092, 0.02))),
    ("torso", "egg_horseshoe"): lambda: half_tube((0.064, 0.085, 0.02), (0, 0, 1), (0, -1, 0), 0.014, 0.006, "Horse", seg=8),
    ("torso", "egg_apple"): lambda: (blob(0.014, "Apple", (-0.062, 0.088, 0.03), sub=1), blob(0.004, "LeekG", (-0.062, 0.104, 0.03), sub=0)),
    ("torso", "egg_cheese"): lambda: cyl(0.0, 0.02, 0.016, 3, "Cheese", pos=(0.062, 0.08, 0.026), rot=(0, 0.4, 0), smooth=False),
    ("torso", "egg_leek"): lambda: (box(0.06, 0.06, 0.03, "Sack", pos=(0, 0.11, -0.068), bevel=0.01, smooth=True),
                                    cyl(0.008, 0.008, 0.08, 8, "Leek", pos=(0.015, 0.15, -0.072)),
                                    cyl(0.0, 0.014, 0.04, 6, "LeekG", pos=(0.015, 0.225, -0.072), cap=False)),
    ("legR", "egg_patch"): lambda: box(0.022, 0.02, 0.006, "Patch", pos=(0.027, 0.05, 0.018), bevel=0.002),
}
for (node, name), fn in EGGS.items():
    P.append(part(node, name, fn))

# ------------------------------------------------------------------ animaties
FPS = 24
CLIPS = {}


def clip(name, frames, keys):
    """keys: lijst van (t 0..1, {node: dict(rx, ry, rz in game-assen, dy = extra hoogte)}).
    'tool' wordt opgegeven als hoek t.o.v. het LICHAAM (zoals de oude renderer: 0 = gereedschap
    rechtop in de hand); omdat de tool-node aan de arm hangt, trekken we hier de armhoek eraf."""
    for _, d in keys:
        if "tool" in d and "armR" in d:
            d["tool"] = dict(d["tool"], rx=d["tool"].get("rx", 0.0) - d["armR"].get("rx", 0.0))
    CLIPS[name] = (frames, keys)


def k(**kw):
    return kw


A = 0.12   # standaard spreiding van de armen
clip("idle", 96, [
    (0.0, {"armR": k(rz=A), "armL": k(rz=-A), "head": k()}),
    (0.15, {"hips": k(dy=0.002), "armR": k(rz=A, rx=-0.04), "armL": k(rz=-A, rx=0.04), "torso": k(rx=-0.02)}),
    (0.25, {"head": k(ry=0.45, rx=0.04)}),
    (0.38, {"head": k(ry=0.45, rx=-0.03)}),
    (0.4, {"hips": k(dy=0.0), "armR": k(rz=A), "armL": k(rz=-A), "torso": k()}),
    (0.52, {"head": k()}),
    (0.65, {"head": k(ry=-0.4, rz=0.08), "hips": k(dy=0.002), "torso": k(rx=-0.02)}),
    (0.8, {"head": k(ry=-0.4, rz=0.08)}),
    (0.9, {"hips": k(dy=0.0), "torso": k()}),
    (1.0, {"armR": k(rz=A), "armL": k(rz=-A), "head": k()}),
])
clip("idle_hat", 48, [   # hoed rechtzetten
    (0.0, {"armR": k(rz=A), "head": k()}),
    (0.3, {"armR": k(rx=-2.55, rz=0.55), "head": k(rx=0.12, rz=0.12)}),
    (0.42, {"armR": k(rx=-2.65, rz=0.45), "head": k(rx=0.05, rz=-0.05)}),
    (0.55, {"armR": k(rx=-2.55, rz=0.55), "head": k(rx=0.1, rz=0.1)}),
    (0.85, {"armR": k(rz=A), "head": k()}),
    (1.0, {"armR": k(rz=A), "head": k()}),
])
clip("wave", 24, [
    (0.0, {"armL": k(rz=-A), "head": k()}),
    # arm zijwaarts omhoog: met de grote kop en korte armpjes zou 'naar voren omhoog' voor het gezicht eindigen
    (0.15, {"armL": k(rx=-0.25, rz=-2.15), "head": k(rz=0.1, ry=-0.15)}),
    (0.3, {"armL": k(rx=-0.25, rz=-2.55)}),
    (0.45, {"armL": k(rx=-0.25, rz=-2.1)}),
    (0.6, {"armL": k(rx=-0.25, rz=-2.55)}),
    (0.75, {"armL": k(rx=-0.25, rz=-2.15), "head": k(rz=0.1, ry=-0.15)}),
    (1.0, {"armL": k(rz=-A), "head": k()}),
])
clip("cheer", 22, [      # vrolijk sprongetje met armen omhoog
    (0.0, {"hips": k(), "armR": k(rz=A), "armL": k(rz=-A), "legR": k(), "legL": k(), "head": k()}),
    (0.15, {"hips": k(dy=-0.012), "legR": k(rx=-0.3), "legL": k(rx=-0.3), "torso": k(rx=0.1)}),
    (0.4, {"hips": k(dy=0.05), "armR": k(rx=-0.35, rz=2.3), "armL": k(rx=-0.35, rz=-2.3), "legR": k(rx=0.2), "legL": k(rx=0.25),
           "head": k(rx=-0.25), "torso": k(rx=-0.08)}),
    (0.6, {"hips": k(dy=0.03), "armR": k(rx=-0.3, rz=2.05), "armL": k(rx=-0.3, rz=-2.05)}),
    (0.8, {"hips": k(dy=-0.006), "legR": k(rx=-0.15), "legL": k(rx=-0.15), "torso": k(rx=0.06), "head": k()}),
    (1.0, {"hips": k(), "armR": k(rz=A), "armL": k(rz=-A), "legR": k(), "legL": k(), "torso": k()}),
])
WALK_LEG, WALK_ARM = 0.7, 0.55
clip("walk", 24, [
    (0.0, {"legR": k(rx=-WALK_LEG), "legL": k(rx=WALK_LEG), "armR": k(rx=WALK_ARM, rz=A), "armL": k(rx=-WALK_ARM, rz=-A),
           "hips": k(), "torso": k(ry=0.07, rx=0.04), "head": k(ry=-0.05)}),
    (0.25, {"legR": k(), "legL": k(), "armR": k(rz=A), "armL": k(rz=-A), "hips": k(dy=0.012), "head": k(rx=-0.03)}),
    (0.5, {"legR": k(rx=WALK_LEG), "legL": k(rx=-WALK_LEG), "armR": k(rx=-WALK_ARM, rz=A), "armL": k(rx=WALK_ARM, rz=-A),
           "hips": k(), "torso": k(ry=-0.07, rx=0.04), "head": k(ry=0.05)}),
    (0.75, {"legR": k(), "legL": k(), "armR": k(rz=A), "armL": k(rz=-A), "hips": k(dy=0.012), "head": k(rx=-0.03)}),
    (1.0, {"legR": k(rx=-WALK_LEG), "legL": k(rx=WALK_LEG), "armR": k(rx=WALK_ARM, rz=A), "armL": k(rx=-WALK_ARM, rz=-A),
           "hips": k(), "torso": k(ry=0.07, rx=0.04), "head": k(ry=-0.05)}),
])
CARRY_ARM = dict(rx=-0.95)
clip("carry", 24, [
    (0.0, {"legR": k(rx=-0.6), "legL": k(rx=0.6), "armR": k(rz=0.04, **CARRY_ARM), "armL": k(rz=-0.04, **CARRY_ARM),
           "hips": k(), "torso": k(rx=-0.06, ry=0.03), "head": k(rx=-0.04)}),
    (0.25, {"legR": k(), "legL": k(), "hips": k(dy=0.01)}),
    (0.5, {"legR": k(rx=0.6), "legL": k(rx=-0.6), "hips": k(), "torso": k(rx=-0.06, ry=-0.03)}),
    (0.75, {"legR": k(), "legL": k(), "hips": k(dy=0.01)}),
    (1.0, {"legR": k(rx=-0.6), "legL": k(rx=0.6), "armR": k(rz=0.04, **CARRY_ARM), "armL": k(rz=-0.04, **CARRY_ARM),
           "hips": k(), "torso": k(rx=-0.06, ry=0.03), "head": k(rx=-0.04)}),
])
clip("carry_idle", 48, [
    (0.0, {"armR": k(rz=0.04, **CARRY_ARM), "armL": k(rz=-0.04, **CARRY_ARM), "torso": k(rx=-0.05), "head": k()}),
    (0.5, {"armR": k(rz=0.04, rx=-0.9), "armL": k(rz=-0.04, rx=-0.9), "torso": k(rx=-0.07), "hips": k(dy=0.002), "head": k(ry=0.2)}),
    (1.0, {"armR": k(rz=0.04, **CARRY_ARM), "armL": k(rz=-0.04, **CARRY_ARM), "torso": k(rx=-0.05), "hips": k(), "head": k()}),
])


def swing(name, frames, wind_arm, wind_tool, hit_arm, hit_tool, t_wind, t_hit, lean=(-0.1, 0.2), two_hands=True, crouch=0.0):
    """Hak-/sla-beweging: opzwaaien (windup) en neerslaan (impact). De impact valt aan het eind van de
    cyclus, zodat het geluid in de game (op elke volle periode) samenvalt met de klap."""
    def pose(arm, tool, lean_x, dy):
        d = {"armR": k(rx=arm, rz=0.06), "tool": k(rx=tool), "torso": k(rx=lean_x), "hips": k(dy=dy),
             "legR": k(rx=-crouch), "legL": k(rx=crouch * 0.6)}
        d["armL"] = k(rx=arm * 0.9, rz=-0.3) if two_hands else k(rx=-0.6, rz=-A)
        return d
    rest_arm, rest_tool = wind_arm * 0.7 + hit_arm * 0.3, wind_tool * 0.6 + hit_tool * 0.4
    clip(name, frames, [
        (0.0, pose(rest_arm, rest_tool, 0.0, -crouch * 0.03)),
        (t_wind, pose(wind_arm, wind_tool, lean[0], -crouch * 0.03)),
        (t_hit, pose(hit_arm, hit_tool, lean[1], -crouch * 0.03 - 0.004)),
        (1.0, pose(rest_arm, rest_tool, 0.0, -crouch * 0.03)),
    ])


swing("chop", 18, -1.9, -1.35, -0.45, 1.6, 0.6, 0.9)                         # houthakken
swing("pick", 15, -2.4, -1.0, -0.3, 1.3, 0.58, 0.9, lean=(-0.15, 0.3))       # mijnwerken / steenhouwen
swing("hammer", 11, -1.9, -0.6, -0.6, 1.2, 0.55, 0.92, lean=(0.25, 0.35), two_hands=False, crouch=0.5)  # bouwen
clip("harvest", 25, [    # zeis: draaien vanuit het middel
    (0.0, {"torso": k(ry=0.45, rx=0.15), "armR": k(rx=-1.0, rz=0.3), "armL": k(rx=-0.9, rz=-0.1), "tool": k(rx=0.8), "hips": k(dy=-0.004)}),
    (0.5, {"torso": k(ry=-0.45, rx=0.15), "armR": k(rx=-1.0, rz=-0.1), "armL": k(rx=-0.9, rz=-0.45), "tool": k(rx=1.7), "hips": k(dy=-0.006)}),
    (1.0, {"torso": k(ry=0.45, rx=0.15), "armR": k(rx=-1.0, rz=0.3), "armL": k(rx=-0.9, rz=-0.1), "tool": k(rx=0.8), "hips": k(dy=-0.004)}),
])
clip("dig", 30, [        # spade: duwen en opwippen
    (0.0, {"torso": k(rx=0.25), "armR": k(rx=-0.3, rz=0.06), "armL": k(rx=-0.5, rz=-0.2), "tool": k(rx=2.2), "hips": k(dy=-0.004), "legR": k(rx=-0.35)}),
    (0.5, {"torso": k(rx=0.45), "armR": k(rx=-0.05, rz=0.06), "armL": k(rx=-0.25, rz=-0.2), "tool": k(rx=2.85), "hips": k(dy=-0.014), "legR": k(rx=-0.55)}),
    (1.0, {"torso": k(rx=0.25), "armR": k(rx=-0.3, rz=0.06), "armL": k(rx=-0.5, rz=-0.2), "tool": k(rx=2.2), "hips": k(dy=-0.004), "legR": k(rx=-0.35)}),
])
clip("sow", 30, [        # zaaien: voorover, zaad uitstrooien
    (0.0, {"torso": k(rx=0.35), "armR": k(rx=-0.6, rz=0.2), "armL": k(rx=-0.9, rz=-0.2), "head": k(rx=0.1), "hips": k(dy=-0.004)}),
    (0.45, {"torso": k(rx=0.3, ry=-0.15), "armR": k(rx=-1.4, rz=0.65), "hips": k(dy=-0.012)}),
    (1.0, {"torso": k(rx=0.35), "armR": k(rx=-0.6, rz=0.2), "armL": k(rx=-0.9, rz=-0.2), "head": k(rx=0.1), "hips": k(dy=-0.004)}),
])
clip("fish", 108, [      # hengel vasthouden, af en toe een rukje
    (0.0, {"armR": k(rx=-0.9, rz=0.06), "armL": k(rx=-0.85, rz=-0.25), "tool": k(rx=0.85), "torso": k(rx=0.05), "head": k(rx=0.08)}),
    (0.4, {"tool": k(rx=0.9), "head": k(rx=0.12, ry=0.1)}),
    (0.6, {"tool": k(rx=0.72), "armR": k(rx=-1.05, rz=0.06), "head": k(rx=0.02)}),
    (0.7, {"tool": k(rx=0.85), "armR": k(rx=-0.9, rz=0.06)}),
    (1.0, {"armR": k(rx=-0.9, rz=0.06), "armL": k(rx=-0.85, rz=-0.25), "tool": k(rx=0.85), "torso": k(rx=0.05), "head": k(rx=0.08)}),
])


def bake_clips():
    """Elke clip als NLA-track op alle rig-nodes; niet-genoemde nodes blijven in rust.
    Waarden worden per node lineair tussen de keys gezet (cyclisch: t = 1 == t = 0)."""
    for cname, (frames, keys) in CLIPS.items():
        for nname, o in RIG.items():
            # sleutels voor deze node: houd de laatst genoemde waarde vast tot de volgende key
            pts = [(t, d[nname]) for t, d in keys if nname in d]
            o.animation_data_create()
            act = bpy.data.actions.new(f"{cname}_{nname}")
            o.animation_data.action = act
            rest = Vector(o.location)
            if not pts:
                pts = [(0.0, {}), (1.0, {})]
            for t, v in pts:
                f = round(t * frames)
                rx, ry, rz = v.get("rx", 0.0), v.get("ry", 0.0), v.get("rz", 0.0)
                o.rotation_euler = (rx, -rz, ry)                  # game (X, Y, Z) → blender (X, -Z, Y)
                o.location = rest + Vector((0, 0, v.get("dy", 0.0)))
                o.keyframe_insert("rotation_euler", frame=f)
                if nname == "hips":
                    o.keyframe_insert("location", frame=f)
            o.location = rest
            o.rotation_euler = (0, 0, 0)
            tr = o.animation_data.nla_tracks.new()
            tr.name = cname
            tr.strips.new(cname, 0, act)
            o.animation_data.action = None


bake_clips()
bpy.context.scene.render.fps = FPS

# ------------------------------------------------------------------ statistiek + export
tri = {o.name: sum(len(p.vertices) - 2 for p in o.data.polygons) for o in P}
typical = ["torso__body_round", "torso__belt_round", "head__face_a", "head__hair_short", "head__hat_straw",
           "head__beard_mustache", "legR__leg", "legR__leg", "legR__boot", "legR__boot",
           "armR__sleeve", "armR__sleeve", "armR__hand", "armR__hand"]
print("VE-SETTLER parts=%d clips=%d typical_tris=%d max_part=%s" % (
    len(P), len(CLIPS), sum(tri[n] for n in typical), max(tri.items(), key=lambda kv: kv[1])))
for n_, t_ in sorted(tri.items()):
    print("VE-PART", n_, t_)

avail = {p.identifier for p in bpy.ops.export_scene.gltf.get_rna_type().properties}
opts = dict(filepath=os.path.abspath(args.out), export_format="GLB", use_selection=False, export_apply=True,
            export_yup=True, export_cameras=False, export_lights=False, export_texcoords=False, export_normals=True,
            export_materials="EXPORT", export_animations=True, export_animation_mode="NLA_TRACKS",
            export_force_sampling=True, export_draco_mesh_compression_enable=False, export_vertex_color="NONE",
            export_optimize_animation_size=False, export_optimize_animation_keep_anim_object=True)
os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
bpy.ops.export_scene.gltf(**{k_: v_ for k_, v_ in opts.items() if k_ in avail or k_ == "filepath"})
size = os.path.getsize(args.out)
print(f"VE-BLENDER-OK {args.out} tris={sum(tri.values())} bytes={size}")
