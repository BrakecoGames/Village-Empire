"""Village Empire — Cottage (woonhuis), drie upgrade-levels in één GLB.

Uitvoer: public/models/house.glb met de nodes
    house_l1, house_l2, house_l3      één mesh per level (meerdere materialen)
    house_l1_smoke, ...               lege markers: top van de schoorsteen (rook)

Coördinaten in dit script zijn GAME-coördinaten (Three.js): Y omhoog, voordeur aan +Z,
1 eenheid = 1 tegel, oorsprong = midden van de tegel op maaiveld. De fundering zakt tot
y = -0.2 in het terrein, net als bij de procedurele gebouwen. De helper `place` zet om
naar Blender (Z omhoog); de glTF-export zet het weer terug naar Y-up.

Kleuren: materialen met naam "Naam@j" → j = kleurvariatie per driehoek die de game
toevoegt (zelfde techniek als de procedurele modellen).

Bouwen: npm run models -- house
"""
import math
import os
import random
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "lib"))
import bmesh  # noqa: E402
import bpy  # noqa: E402
from mathutils import Euler, Matrix, Vector  # noqa: E402
import ve_blender as ve  # noqa: E402

args = ve.parse_args()
args.budget = max(args.budget, 3200)   # per level; level 3 (met dakkapel en aanbouw) zit net boven 3000
ve.reset_scene()
rnd = random.Random(1207)

# ------------------------------------------------------------------ materialen
PAL = {
    "Plaster": (0xF3E5C8, 0.03), "Plaster2": (0xEAD2A6, 0.03),
    "Timber": (0x6A4226, 0.07), "TimberL": (0x8A5A34, 0.06),
    "RoofA": (0xC2492E, 0.07), "RoofB": (0xAD3E28, 0.07), "RoofC": (0xD0603C, 0.07),
    "RoofDeck": (0x6E2A1C, 0.03), "Ridge": (0x8E3322, 0.05),
    "StoneA": (0xB5AE9F, 0.08), "StoneB": (0x9E978A, 0.08), "StoneD": (0x8E877A, 0.06), "StoneL": (0xCFC8B8, 0.06),
    "Brick": (0xA8553A, 0.08),
    "Door": (0x7A4A28, 0.08), "DoorD": (0x4B2F1C, 0.04), "Iron": (0x4A4D52, 0.0),
    "Glow": (0xFFD27A, 0.0), "Glass": (0x2C3A4E, 0.0),
    "Shutter": (0x3F7FAF, 0.06), "ShutterG": (0x4E8A4A, 0.06),
    "WoodL": (0xC89A5E, 0.08), "Wood": (0xA0703F, 0.08), "Soil": (0x5A3E28, 0.05),
    "Leaf": (0x4B8A30, 0.10), "LeafL": (0x6AAA3E, 0.10),
    "FlRed": (0xE84A5F, 0.0), "FlYel": (0xFFD166, 0.0), "FlPink": (0xF78FB3, 0.0), "FlWhite": (0xF7F3EA, 0.0),
}
MATS = {k: ve.material(f"{k}@{j}", ve.hex_color(c), roughness=0.9) for k, (c, j) in PAL.items()}

# ------------------------------------------------------------------ coördinaten
# game (x, y, z) -> blender (x, -z, y)
M3 = Matrix(((1, 0, 0), (0, 0, -1), (0, 1, 0)))
M4 = M3.to_4x4()

LEVEL = []          # objecten van het level dat nu gebouwd wordt


def place(obj, pos=(0, 0, 0), rot=(0, 0, 0)):
    """Zet een object op game-positie/rotatie (Euler XYZ in game-assen, zoals Three.js)."""
    G = Matrix.Translation(Vector(pos)) @ Euler(rot, "XYZ").to_matrix().to_4x4()
    obj.matrix_world = M4 @ G @ M4.transposed()
    return obj


def new_obj(name, bm, mat, smooth=False):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me); bm.free()
    obj = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(obj)
    me.materials.append(MATS[mat])
    for p in me.polygons:
        p.use_smooth = smooth
    if smooth:
        me.set_sharp_from_angle(angle=math.radians(50))
    LEVEL.append(obj)
    return obj


def gverts(bm, pts):
    """Voegt game-lokale punten toe als Blender-vertices."""
    return [bm.verts.new(M3 @ Vector(p)) for p in pts]


def box(w, h, d, mat, pos=(0, 0, 0), rot=(0, 0, 0), bevel=0.0, base=True, smooth=False):
    """Kubus w×h×d (game-assen); `base`: pos is het midden van de onderkant."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        g = Vector((v.co.x * w, v.co.z * h + (h / 2 if base else 0), -v.co.y * d))
        v.co = M3 @ g
    # afronden kost 44 i.p.v. 12 driehoeken: alleen waar het zichtbaar is (grotere delen of keien)
    if bevel > 0 and (smooth or min(w, h, d) >= 0.04):
        bmesh.ops.bevel(bm, geom=list(bm.edges), offset=min(bevel, w / 2.2, h / 2.2, d / 2.2),
                        segments=1, profile=0.5, affect="EDGES", clamp_overlap=True)
    return place(new_obj("box", bm, mat, smooth), pos, rot)


def cyl(r_top, r_bot, h, seg, mat, pos=(0, 0, 0), rot=(0, 0, 0), smooth=True, cap=True, arc=None, center=False):
    """Cilinder langs game-Y, basis op pos (of midden bij center=True).
    `arc` = (start, lengte) in radialen voor een halve buis (dakpan, nok, boog).

    Normalen worden expliciet naar buiten gezet: bij open vormen (halve buis) kan
    recalc_face_normals binnen en buiten niet onderscheiden, en de game tekent alleen
    voorkanten (FrontSide)."""
    bm = bmesh.new()
    full = arc is None
    a0, al = (0.0, 2 * math.pi) if full else arc
    n = seg if full else seg + 1
    y0 = -h / 2 if center else 0.0
    bot, top = [], []
    for i in range(n):
        a = a0 + al * i / seg
        c, s = math.cos(a), math.sin(a)
        bot.append(gverts(bm, [(c * r_bot, y0, s * r_bot)])[0])
        top.append(gverts(bm, [(c * r_top, y0 + h, s * r_top)])[0])
    sides = []
    for i in (range(seg) if full else range(n - 1)):
        j = (i + 1) % n
        sides.append(bm.faces.new((bot[i], bot[j], top[j], top[i])))
    caps = []
    if cap:
        caps = [(bm.faces.new(list(reversed(bot))), -1), (bm.faces.new(top), 1)]
    bm.normal_update()
    # in Blender-coördinaten ligt de as langs Z (= game-Y)
    for f in sides:
        cen = f.calc_center_median()
        if f.normal.dot(Vector((cen.x, cen.y, 0.0))) < 0:
            f.normal_flip()
    for f, sgn in caps:
        if f.normal.z * sgn < 0:
            f.normal_flip()
    return place(new_obj("cyl", bm, mat, smooth), pos, rot)


def blob(r, mat, pos, scale=(1, 1, 1), sub=1, smooth=True):
    """Ronde vorm (struik, bloem, kei)."""
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=sub, radius=1.0)
    for v in bm.verts:
        g = Vector((v.co.x * r * scale[0], v.co.z * r * scale[1], -v.co.y * r * scale[2]))
        v.co = M3 @ g
    return place(new_obj("blob", bm, mat, smooth), pos)


def prism(profile, length, mat, pos=(0, 0, 0), rot=(0, 0, 0), axis="x", bevel=0.0):
    """Extrudeert een 2D-profiel [(a, y), ...] over `length`. axis 'x': a = game-z, extrusie langs x."""
    bm = bmesh.new()
    h = length / 2
    if axis == "x":
        f = [(-h, y, a) for a, y in profile]; b = [(h, y, a) for a, y in profile]
    else:
        f = [(a, y, -h) for a, y in profile]; b = [(a, y, h) for a, y in profile]
    vf, vb = gverts(bm, f), gverts(bm, b)
    n = len(profile)
    bm.faces.new(vf); bm.faces.new(list(reversed(vb)))
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((vf[i], vb[i], vb[j], vf[j]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    if bevel > 0:
        bmesh.ops.bevel(bm, geom=list(bm.edges), offset=bevel, segments=1, profile=0.5, affect="EDGES", clamp_overlap=True)
    return place(new_obj("prism", bm, mat), pos, rot)


def beam(p0, p1, t, mat="Timber"):
    """Balk met doorsnede t×t tussen twee game-punten."""
    p0, p1 = Vector(p0), Vector(p1)
    d = p1 - p0
    L = d.length
    obj = box(t, L, t, mat, base=False)
    # oriënteer lokale game-Y op d
    q = Vector((0, 1, 0)).rotation_difference(d.normalized())
    G = Matrix.Translation((p0 + p1) / 2) @ q.to_matrix().to_4x4()
    obj.matrix_world = M4 @ G @ M4.transposed()
    return obj


# ------------------------------------------------------------------ onderdelen
def half_tube(center, axis, bulge, r, length, mat, seg=3, cap=False, kick=0.0, twist=0.0):
    """Halve buis (dakpan, nokpan, deurboog) met as langs `axis` en bolling richting `bulge`.
    Expliciete basisvectoren i.p.v. Euler-hoeken: de bolling wijst gegarandeerd de goede kant op.
    kick kantelt de as zodat het 'onderste' uiteinde (−axis) naar buiten steekt."""
    up, nrm = Vector(axis).normalized(), Vector(bulge).normalized()
    y = (up * math.cos(kick) - nrm * math.sin(kick)).normalized()     # as
    z = (nrm * math.cos(kick) + up * math.sin(kick)).normalized()     # bolling
    x = y.cross(z).normalized()
    if twist:
        q = Matrix.Rotation(twist, 3, z)
        x, y = q @ x, q @ y
    obj = cyl(r, r, length, seg, mat, arc=(0.0, math.pi), cap=cap, center=True)
    # lokale cilinder: as = game-Y, bolling = game-Z (boog van 0..π loopt via +Z), breedte = game-X
    G = Matrix.Translation(Vector(center)) @ Matrix((
        (x.x, y.x, z.x, 0), (x.y, y.y, z.y, 0), (x.z, y.z, z.z, 0), (0, 0, 0, 1)))
    obj.matrix_world = M4 @ G @ M4.transposed()
    return obj


def tile(center, up, nrm, r, length, mat, kick=0.11, twist=0.0):
    """Eén holle dakpan: as langs de helling omhoog (up), bolling naar buiten (nrm)."""
    return half_tube(center, up, nrm, r, length, mat, seg=3, kick=kick, twist=twist)


def tiled_roof(x0, x1, eave_z, eave_y, ridge_z, ridge_y, rows, cols, side, kick=0.11, r_tile=None, deck=True):
    """Dakvlak van holle pannen (halve buizen) in rijen die trapsgewijs overlappen.
    side = +1: vlak loopt af naar +z (voorkant), -1 naar -z, of 'x+' / 'x-' voor lessenaarsdak langs x."""
    run = abs(eave_z - ridge_z); rise = ridge_y - eave_y
    L = math.hypot(run, rise); a = math.atan2(rise, run)
    width = x1 - x0
    tw = width / cols
    r = r_tile or tw * 0.52
    tl = L / rows * 1.25
    sgn = 1 if eave_z > ridge_z else -1
    up = Vector((0, math.sin(a), -sgn * math.cos(a)))                 # langs het dak omhoog
    nrm = Vector((0, math.cos(a), sgn * math.sin(a)))                 # naar buiten
    E = Vector((0, eave_y, eave_z))
    rx = a if sgn > 0 else -a
    if deck:
        mid = E + up * (L / 2) - nrm * 0.012
        box(width + 0.02, 0.022, L + 0.03, "RoofDeck", pos=((x0 + x1) / 2, mid.y, mid.z), rot=(rx, 0, 0), base=False)
    for ri in range(rows):
        t = (ri + 0.5) * L / rows
        c = E + up * t + nrm * (r * 0.35)
        stagger = (0.12 if ri % 2 else -0.12) * tw          # verspringende rijen: leest als pannen, niet als planken
        for ci in range(cols):
            x = x0 + (ci + 0.5) * tw + stagger
            mat = rnd.choice(("RoofA", "RoofA", "RoofB", "RoofC"))
            tile((x, c.y, c.z), up, nrm, r, tl, mat, kick=kick, twist=rnd.uniform(-0.03, 0.03))
    return L, a


def gable_roof(w, depth_half, eave_y, ridge_y, rows, cols, x=0.0, z=0.0, ridge_r=0.032):
    x0, x1 = x - w / 2, x + w / 2
    for s in (1, -1):
        tiled_roof(x0, x1, z + s * depth_half, eave_y, z, ridge_y, rows, cols, s)
    # nokpannen (halve buis langs x) + windveren
    half_tube(((x0 + x1) / 2, ridge_y + 0.004, z), (1, 0, 0), (0, 1, 0), ridge_r, w + 0.03, "Ridge", seg=6, cap=True)
    run, rise = depth_half, ridge_y - eave_y
    for xx in (x0 - 0.008, x1 + 0.008):
        for s in (1, -1):
            beam((xx, eave_y - 0.01, z + s * (run + 0.005)), (xx, ridge_y + 0.005, z), 0.026, "Timber")


def window(x, y, z, face="z", lit=False, shutters="Shutter", w=0.1, h=0.11):
    """Raam met kozijn, kruis, luiken en vensterbank. face: 'z' (+z gevel) of 'x' / '-x'."""
    if face == "z":
        rot = (0, 0, 0); off = lambda dx, dy, dz: (x + dx, y + dy, z + dz)
    elif face == "x":
        rot = (0, math.pi / 2, 0); off = lambda dx, dy, dz: (x + dz, y + dy, z - dx)
    else:
        rot = (0, -math.pi / 2, 0); off = lambda dx, dy, dz: (x - dz, y + dy, z + dx)
    t = 0.018
    box(w + 2 * t, h + t, 0.016, "Timber", pos=off(0, 0, 0.0), rot=rot)                   # kozijn (achter het glas)
    box(w, h, 0.01, "Glow" if lit else "Glass", pos=off(0, 0, 0.007), rot=rot)
    box(w + 2 * t + 0.02, t, 0.045, "WoodL", pos=off(0, -t, 0.014), rot=rot, bevel=0.004)  # vensterbank
    box(0.008, h, 0.014, "Timber", pos=off(0, 0, 0.012), rot=rot)                          # kruis
    box(w, 0.008, 0.014, "Timber", pos=off(0, h * 0.55, 0.012), rot=rot)
    if shutters:
        sw = w * 0.5
        for sx in (-1, 1):
            # open luiken, iets naar buiten gedraaid
            box(sw, h + 0.008, 0.008, shutters, pos=off(sx * (w / 2 + t + sw / 2 - 0.004), -0.004, 0.02 + sw * 0.18),
                rot=(rot[0], rot[1] - sx * 0.35, rot[2]), bevel=0.002)


def flower_box(x, y, z, face="z", n=4):
    if face == "z":
        rot = (0, 0, 0); off = lambda dx, dy, dz: (x + dx, y + dy, z + dz)
    else:
        rot = (0, math.pi / 2, 0); off = lambda dx, dy, dz: (x + dz, y + dy, z - dx)
    bw = 0.03 * n + 0.02
    box(bw, 0.035, 0.045, "Wood", pos=off(0, 0, 0.03), rot=rot, bevel=0.004)
    box(bw - 0.01, 0.006, 0.035, "Soil", pos=off(0, 0.033, 0.03), rot=rot)
    cols = ("FlRed", "FlYel", "FlPink", "FlWhite", "FlRed")
    for i in range(n):
        dx = -bw / 2 + 0.02 + i * 0.03
        if i % 2 == 0:
            blob(0.02, "Leaf", off(dx + 0.014, 0.045, 0.03), scale=(1.4, 0.8, 1.0), sub=1)
        blob(0.013, cols[i % len(cols)], off(dx, 0.062, 0.034), sub=0)


def door(x, z, w=0.13, h=0.19):
    """Houten deur met planken, boog en beslag, aan de +z-gevel."""
    box(w + 0.04, h + 0.02, 0.026, "Timber", pos=(x, 0.06, z))                          # kozijn
    plank = w / 3
    for i in range(3):
        box(plank - 0.004, h, 0.02, "Door", pos=(x - w / 2 + plank * (i + 0.5), 0.06, z + 0.01), bevel=0.003)
    # boog boven de deur (halve schijf)
    half_tube((x, 0.06 + h, z), (0, 0, 1), (0, 1, 0), w / 2 + 0.02, 0.026, "Timber", seg=8, cap=True)
    half_tube((x, 0.06 + h, z + 0.01), (0, 0, 1), (0, 1, 0), w / 2, 0.02, "DoorD", seg=8, cap=True)
    for yy in (0.1, 0.2):
        box(w * 0.8, 0.012, 0.006, "Iron", pos=(x - 0.005, yy, z + 0.022))               # scharnieren
    blob(0.011, "Iron", (x + w * 0.3, 0.16, z + 0.028), sub=0)                             # klink
    box(w + 0.07, 0.025, 0.08, "StoneL", pos=(x, -0.005, z + 0.06), bevel=0.008)          # stoep


def stone_plinth(x0, x1, z0, z1, y=0.06, n_front=5, n_side=4):
    """Rij afgeronde natuurstenen rond de muurvoet (voor en rechterzijkant zichtbaar)."""
    def stone(px, pz, along_x):
        s = rnd.uniform(0.045, 0.06)
        w, d = (s * rnd.uniform(1.1, 1.5), 0.04) if along_x else (0.04, s * rnd.uniform(1.1, 1.5))
        box(w, rnd.uniform(0.035, 0.05), d, rnd.choice(("StoneA", "StoneB", "StoneL")),
            pos=(px, y - 0.012, pz), rot=(0, rnd.uniform(-0.12, 0.12), 0), bevel=0.012, smooth=True)
    for i in range(n_front):
        stone(x0 + (x1 - x0) * (i + 0.5) / n_front, z1 + 0.012, True)
    for i in range(n_side):
        stone(x1 + 0.012, z0 + (z1 - z0) * (i + 0.5) / n_side, False)


def chimney(x, z, y0, top):
    h = top - y0
    box(0.1, h, 0.1, "StoneB", pos=(x, y0, z), bevel=0.008)
    for i in range(3):                                         # uitstekende stenen
        yy = y0 + h * (0.35 + 0.2 * i)
        box(0.05, 0.03, 0.012, "StoneL", pos=(x + rnd.uniform(-0.025, 0.025), yy, z + 0.053), bevel=0.004)
    box(0.13, 0.03, 0.13, "StoneD", pos=(x, top, z), bevel=0.008)                       # kap
    cyl(0.026, 0.032, 0.05, 8, "Brick", pos=(x, top + 0.03, z))                         # pot
    return (x, top + 0.09, z)


def barrel(x, z, y=0.06):
    cyl(0.052, 0.046, 0.12, 10, "Wood", pos=(x, y, z))
    for yy in (0.025, 0.09):
        cyl(0.054, 0.054, 0.012, 10, "Iron", pos=(x, y + yy, z), cap=False)


def woodpile(x, z, y=0.06, along="z"):
    k = 0
    for row in range(2):
        for i in range(3 - row):
            off = -0.045 + i * 0.045 + row * 0.022
            pos = (x, y + 0.02 + row * 0.036, z + off) if along == "z" else (x + off, y + 0.02 + row * 0.036, z)
            rot = (0, 0, math.pi / 2) if along == "z" else (math.pi / 2, 0, 0)
            p = list(pos)
            if along == "z": p[0] -= 0.06
            else: p[2] -= 0.06
            cyl(0.02, 0.02, 0.12, 6, "Wood" if k % 2 else "TimberL", pos=tuple(p), rot=rot)
            k += 1


def fence(p0, p1, posts):
    for i in range(posts + 1):
        t = i / posts
        box(0.02, 0.11, 0.02, "Wood", pos=(p0[0] + (p1[0] - p0[0]) * t, 0.04, p0[1] + (p1[1] - p0[1]) * t), bevel=0.004)
    for yy in (0.08, 0.12):
        beam((p0[0], yy, p0[1]), (p1[0], yy, p1[1]), 0.012, "WoodL")


# ------------------------------------------------------------------ het huis
W, D = 0.6, 0.46                     # muren (x, z)
WALL_Y0, WALL_TOP = 0.06, 0.475      # muurvoet, muurtop (voor/achter)
EAVE_Z, EAVE_Y = 0.33, 0.39          # dakgoot (overstek)
RIDGE_Y = 0.78
APEX_Y = 0.745


def main_house(lvl):
    # fundering (zakt in het terrein, zoals de procedurele gebouwen)
    box(0.8, 0.26, 0.7, "StoneD", pos=(0, -0.2, 0.0), bevel=0.02)
    box(0.74, 0.02, 0.64, "StoneL", pos=(0, 0.045, 0.0), bevel=0.006)
    # muren: zeshoekig profiel (met puntgevels) over de breedte geëxtrudeerd
    prof = [(-D / 2, WALL_Y0), (D / 2, WALL_Y0), (D / 2, WALL_TOP), (0, APEX_Y), (-D / 2, WALL_TOP)]
    prism(prof, W, "Plaster", bevel=0.006)
    # vakwerk
    t = 0.028
    hx, hz = W / 2 + 0.004, D / 2 + 0.004
    for sx in (-1, 1):
        for sz in (-1, 1):
            beam((sx * hx, WALL_Y0, sz * hz), (sx * hx, WALL_TOP, sz * hz), t)
    for sz in (-1, 1):                                                   # voor/achter regels
        beam((-hx, WALL_TOP - 0.012, sz * hz), (hx, WALL_TOP - 0.012, sz * hz), t)
        beam((-hx, 0.26, sz * hz), (hx, 0.26, sz * hz), t * 0.9)
    for sx in (-1, 1):                                                   # zijgevels
        beam((sx * hx, WALL_TOP - 0.012, -hz), (sx * hx, WALL_TOP - 0.012, hz), t)
        beam((sx * hx, WALL_TOP, 0), (sx * hx, APEX_Y - 0.01, 0), t * 0.9)          # makelaar
        beam((sx * hx, WALL_Y0 + 0.02, -hz + 0.02), (sx * hx, 0.26, -0.04), t * 0.8)  # schoren
        beam((sx * hx, 0.26, 0.04), (sx * hx, WALL_TOP - 0.02, hz - 0.02), t * 0.8)
    # schoren naast de deur
    beam((0.04, WALL_Y0 + 0.02, hz), (0.07, 0.25, hz), t * 0.8)
    beam((-0.27, 0.27, hz), (-0.2, WALL_TOP - 0.02, hz), t * 0.8)

    # dak met holle pannen
    gable_roof(0.78, EAVE_Z, EAVE_Y, RIDGE_Y, rows=5, cols=7)

    # deur, ramen, bloembakken
    door(-0.1, D / 2 + 0.004)
    window(0.15, 0.16, D / 2 + 0.006, "z", lit=True)
    flower_box(0.15, 0.115, D / 2 + 0.004, "z", n=4)
    window(W / 2 + 0.006, 0.17, 0.0, "x", lit=False, shutters="ShutterG")
    flower_box(W / 2 + 0.004, 0.125, 0.0, "x", n=3)
    window(W / 2 + 0.006, 0.52, 0.0, "x", lit=True, shutters=None, w=0.07, h=0.08)   # zolderraam in de gevel

    # natuurstenen plint
    stone_plinth(-W / 2, W / 2, -D / 2, D / 2)

    # schoorsteen achter de nok
    smoke = chimney(0.17, -0.09, 0.45, 0.94)

    # details
    barrel(-0.33, 0.29)
    blob(0.06, "Leaf", (0.33, 0.07, 0.27), scale=(1.0, 0.85, 1.0), sub=2)       # struikje op de hoek
    blob(0.04, "LeafL", (0.27, 0.07, 0.31), scale=(1.0, 0.8, 1.0), sub=2)
    box(0.012, 0.012, 0.05, "Iron", pos=(0.02, 0.3, D / 2 + 0.03))              # lantaarnarm
    box(0.035, 0.045, 0.035, "Glow", pos=(0.02, 0.255, D / 2 + 0.055), bevel=0.004)
    box(0.045, 0.012, 0.045, "Iron", pos=(0.02, 0.3, D / 2 + 0.055))

    if lvl >= 2:
        # aanbouw links met lessenaarsdak en houtopslag
        ax, aw, ad = -0.43, 0.22, 0.36
        box(aw + 0.06, 0.22, ad + 0.08, "StoneD", pos=(ax - 0.01, -0.17, 0.0), bevel=0.015)
        box(aw, 0.26, ad, "Plaster2", pos=(ax, WALL_Y0, 0.0), bevel=0.005)
        for sz in (-1, 1):
            beam((ax - aw / 2 - 0.003, WALL_Y0, sz * (ad / 2 + 0.003)), (ax - aw / 2 - 0.003, WALL_Y0 + 0.26, sz * (ad / 2 + 0.003)), t)
        beam((ax - aw / 2, WALL_Y0 + 0.25, ad / 2 + 0.004), (ax + aw / 2, WALL_Y0 + 0.25, ad / 2 + 0.004), t)
        # lessenaarsdak: loopt af naar -x  -> gebruik een gekanteld 'zadeldak'-vlak langs z
        rows, cols = 3, 4
        roof_w = ad + 0.1
        y_hi, y_lo = WALL_Y0 + 0.36, WALL_Y0 + 0.24
        run = aw + 0.06
        a = math.atan2(y_hi - y_lo, run)
        L = math.hypot(run, y_hi - y_lo)
        tw = roof_w / cols
        r = tw * 0.52
        box(L + 0.02, 0.022, roof_w + 0.02, "RoofDeck", pos=(ax - 0.02, (y_hi + y_lo) / 2 - 0.012, 0.0), rot=(0, 0, a), base=False)
        up_a = (math.cos(a), math.sin(a), 0.0)          # dak loopt omhoog naar het huis (+x)
        n_a = (-math.sin(a), math.cos(a), 0.0)
        for ri in range(rows):
            tpos = (ri + 0.5) / rows
            px = (ax + aw / 2 + 0.01) - run * tpos
            py = y_hi - (y_hi - y_lo) * tpos + r * 0.35 * math.cos(a)
            px -= r * 0.35 * math.sin(a)
            stagger = (0.12 if ri % 2 else -0.12) * tw
            for ci in range(cols):
                pz = -roof_w / 2 + (ci + 0.5) * tw + stagger
                tile((px, py, pz), up_a, n_a, r, L / rows * 1.25, rnd.choice(("RoofA", "RoofB", "RoofC")),
                     twist=rnd.uniform(-0.03, 0.03))
        window(ax, 0.15, ad / 2 + 0.004, "z", lit=True, shutters="Shutter", w=0.08, h=0.09)
        woodpile(ax - 0.17, 0.0)
        fence((0.38, 0.08), (0.38, 0.33), 3)
        blob(0.03, "LeafL", (0.42, 0.06, 0.2), sub=1)

    if lvl >= 3:
        # dakkapel op het voordakvlak: voorgevel steekt net buiten het dak, achterkant zit erin
        fz, dy, dxc = 0.26, 0.45, -0.12
        box(0.17, 0.19, 0.16, "Plaster", pos=(dxc, dy, fz - 0.08))
        prism([(-0.085, 0.0), (0.085, 0.0), (0.0, 0.065)], 0.012, "Plaster", pos=(dxc, dy + 0.19, fz - 0.006), axis="z")
        for sx in (-1, 1):
            beam((dxc + sx * 0.087, dy, fz + 0.002), (dxc + sx * 0.087, dy + 0.19, fz + 0.002), 0.02)
        beam((dxc - 0.095, dy + 0.19, fz + 0.002), (dxc + 0.095, dy + 0.19, fz + 0.002), 0.02)
        window(dxc, dy + 0.08, fz + 0.004, "z", lit=True, shutters=None, w=0.08, h=0.08)
        # zadeldakje van de dakkapel (nok langs z)
        for s in (-1, 1):
            box(0.13, 0.018, 0.22, rnd.choice(("RoofA", "RoofB")), pos=(dxc + s * 0.05, dy + 0.225, fz - 0.09), rot=(0, 0, -s * 0.75), base=False, bevel=0.004)
        half_tube((dxc, dy + 0.262, fz - 0.09), (0, 0, 1), (0, 1, 0), 0.018, 0.22, "Ridge", seg=6, cap=True)
        # bankje en extra bloempotten
        box(0.16, 0.012, 0.05, "WoodL", pos=(0.2, 0.1, D / 2 + 0.08), bevel=0.003)
        for sx in (-1, 1):
            box(0.012, 0.045, 0.04, "Wood", pos=(0.2 + sx * 0.065, 0.055, D / 2 + 0.08))
        for px in (-0.24, 0.35):
            cyl(0.022, 0.017, 0.035, 8, "Brick", pos=(px, 0.06, D / 2 + 0.1))
            blob(0.022, "Leaf", (px, 0.105, D / 2 + 0.1), sub=1)
            blob(0.011, "FlRed" if px < 0 else "FlYel", (px + 0.008, 0.125, D / 2 + 0.108), sub=0)
    return smoke


# ------------------------------------------------------------------ bouw & export
summary = []
for lvl in (1, 2, 3):
    LEVEL.clear()
    smoke = main_house(lvl)
    objs = list(LEVEL)
    if os.environ.get("VE_DEBUG"):
        per = {}
        for o in objs:
            k = o.data.materials[0].name.split("@")[0] + ":" + o.name.split(".")[0]
            per[k] = per.get(k, 0) + sum(len(p.vertices) - 2 for p in o.data.polygons)
        print("VE-DEBUG", lvl, sorted(per.items(), key=lambda kv: -kv[1])[:14])
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    obj = bpy.context.view_layer.objects.active
    obj.name = obj.data.name = f"house_l{lvl}"
    # dubbele/ongebruikte vertices opruimen
    bm = bmesh.new(); bm.from_mesh(obj.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.0002)
    bm.to_mesh(obj.data); bm.free()
    # oorsprong exact op (0,0,0) = midden tegel op maaiveld; node heeft dan geen eigen transformatie
    obj.data.transform(obj.matrix_world)
    obj.matrix_world = Matrix.Identity(4)
    emp = bpy.data.objects.new(f"house_l{lvl}_smoke", None)
    bpy.context.collection.objects.link(emp)
    place(emp, smoke)
    tris = ve.triangle_count([obj])
    summary.append((lvl, tris, len(obj.data.materials)))
    if tris > args.budget:
        raise SystemExit(f"VE-BLENDER: house_l{lvl} heeft {tris} driehoeken > budget {args.budget}")

for lvl, tris, nm in summary:
    print(f"VE-BLENDER-LEVEL house_l{lvl} tris={tris} materials={nm}")

# budget geldt per level; het bestand bevat er drie
ve.export_glb(args.out, budget=args.budget * 3)
