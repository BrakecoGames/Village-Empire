"""Village Empire — gedeelde bouwstenen voor gebouwmodellen in Blender.

Alle coördinaten zijn GAME-coördinaten (Three.js): Y omhoog, voordeur aan +Z,
1 eenheid = 1 tegel, oorsprong = midden van de tegel op maaiveld. `place` zet om naar
Blender (Z omhoog); de glTF-export zet het terug naar Y-up.

Gebruik in een modelscript:
    from ve_parts import *
    setup(seed=1207, extra_palette={...})
    def build(lvl): ...; return (x, y, z)   # top van de schoorsteen (rook) of None
    build_levels("house", build, args)

Stijl: zie docs/STIJLGIDS.md
"""
import math
import os
import random

import bmesh
import bpy
from mathutils import Euler, Matrix, Vector

import ve_blender as ve

# ------------------------------------------------------------------ palet (sRGB-hex, jitter)
BASE_PAL = {
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
    # gronding (stijlgids): aangestampte aarde en gras dat aansluit op het terrein
    "Earth": (0x8A6A45, 0.06), "EarthD": (0x6E5236, 0.05), "EarthL": (0xA8865A, 0.07),
    "Grass": (0x6AA53C, 0.10), "GrassD": (0x4F8A30, 0.10), "GrassY": (0x96C050, 0.10),
}
MATS = {}
LEVEL = []                 # objecten van het level dat nu gebouwd wordt
rnd = random.Random(1)


def setup(seed=1, extra_palette=None):
    pal = dict(BASE_PAL)
    pal.update(extra_palette or {})
    MATS.clear()
    for k, (c, j) in pal.items():
        MATS[k] = ve.material(f"{k}@{j}", ve.hex_color(c), roughness=0.9)
    rnd.seed(seed)
    LEVEL.clear()


# ------------------------------------------------------------------ coördinaten
# game (x, y, z) -> blender (x, -z, y)
M3 = Matrix(((1, 0, 0), (0, 0, -1), (0, 1, 0)))
M4 = M3.to_4x4()



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
def orient(obj, center, axis, bulge, kick=0.0, twist=0.0):
    """Zet een object neer met lokale game-Y langs `axis` en lokale game-Z langs `bulge`.
    Expliciete basisvectoren i.p.v. Euler-hoeken: de oriëntatie klopt gegarandeerd.
    kick kantelt de as zodat het 'onderste' uiteinde (−axis) naar buiten (bulge) steekt."""
    up, nrm = Vector(axis).normalized(), Vector(bulge).normalized()
    y = (up * math.cos(kick) - nrm * math.sin(kick)).normalized()
    z = (nrm * math.cos(kick) + up * math.sin(kick)).normalized()
    x = y.cross(z).normalized()
    if twist:
        q = Matrix.Rotation(twist, 3, z)
        x, y = q @ x, q @ y
    G = Matrix.Translation(Vector(center)) @ Matrix((
        (x.x, y.x, z.x, 0), (x.y, y.y, z.y, 0), (x.z, y.z, z.z, 0), (0, 0, 0, 1)))
    obj.matrix_world = M4 @ G @ M4.transposed()
    return obj


def half_tube(center, axis, bulge, r, length, mat, seg=3, cap=False, kick=0.0, twist=0.0):
    """Halve buis (dakpan, nokpan, deurboog) met as langs `axis` en bolling richting `bulge`."""
    obj = cyl(r, r, length, seg, mat, arc=(0.0, math.pi), cap=cap, center=True)
    return orient(obj, center, axis, bulge, kick, twist)


def tile(center, up, nrm, r, length, mat, kick=0.11, twist=0.0):
    """Eén holle dakpan: as langs de helling omhoog (up), bolling naar buiten (nrm)."""
    return half_tube(center, up, nrm, r, length, mat, seg=3, kick=kick, twist=twist)


def shingle(center, up, nrm, w, length, mat, t=0.012, kick=0.13, twist=0.0):
    """Eén houten dakspaan: plankje langs de helling, onderrand licht opgetild."""
    obj = box(w, length, t, mat, base=False)
    return orient(obj, center, up, nrm, kick, twist)


ROOF_TILE_MATS = ("RoofA", "RoofA", "RoofB", "RoofC")


def tiled_roof(x0, x1, eave_z, eave_y, ridge_z, ridge_y, rows, cols, side, kick=0.11, r_tile=None, deck=True,
               kind="tile", mats=ROOF_TILE_MATS):
    """Dakvlak van holle pannen (kind='tile') of houten spanen (kind='shingle') in rijen
    die trapsgewijs overlappen. Het vlak loopt af van de nok (ridge_z) naar de goot (eave_z)."""
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
        stagger = (0.12 if ri % 2 else -0.12) * tw          # verspringende rijen: leest als pannen, niet als planken
        if kind == "shingle":
            stagger = (0.5 if ri % 2 else 0.0) * tw          # spanen: halve plank verspringen
            c = E + up * t + nrm * 0.01
        else:
            c = E + up * t + nrm * (r * 0.35)
        for ci in range(cols + (1 if kind == "shingle" and ri % 2 else 0)):
            x = x0 + (ci + 0.5) * tw + stagger - (tw if kind == "shingle" and ri % 2 else 0)
            if kind == "shingle":
                xa, xb = max(x0, x - tw / 2), min(x1, x + tw / 2)
                if xb - xa < tw * 0.3:
                    continue
                shingle(((xa + xb) / 2, c.y, c.z), up, nrm, (xb - xa) - 0.006, tl, rnd.choice(mats),
                        kick=kick, twist=rnd.uniform(-0.02, 0.02))
            else:
                tile((x, c.y, c.z), up, nrm, r, tl, rnd.choice(mats), kick=kick, twist=rnd.uniform(-0.03, 0.03))
    return L, a


def gable_roof(w, depth_half, eave_y, ridge_y, rows, cols, x=0.0, z=0.0, ridge_r=0.032,
               kind="tile", mats=ROOF_TILE_MATS, ridge_mat="Ridge", barge_mat="Timber"):
    x0, x1 = x - w / 2, x + w / 2
    for s in (1, -1):
        tiled_roof(x0, x1, z + s * depth_half, eave_y, z, ridge_y, rows, cols, s, kind=kind, mats=mats,
                   kick=0.13 if kind == "shingle" else 0.11)
    if kind == "shingle":
        # nokbalk: ronde stam langs x
        cyl(ridge_r, ridge_r, w + 0.05, 7, ridge_mat, pos=(x0 - 0.025, ridge_y + 0.006, z), rot=(0, 0, -math.pi / 2))
    else:
        # nokpannen (halve buis langs x)
        half_tube(((x0 + x1) / 2, ridge_y + 0.004, z), (1, 0, 0), (0, 1, 0), ridge_r, w + 0.03, ridge_mat, seg=6, cap=True)
    run = depth_half
    for xx in (x0 - 0.008, x1 + 0.008):                       # windveren
        for s in (1, -1):
            beam((xx, eave_y - 0.01, z + s * (run + 0.005)), (xx, ridge_y + 0.005, z), 0.026, barge_mat)


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




# ------------------------------------------------------------------ gronding (stijlgids)
def grass_clump(x, z, s=1.0, y=0.0, blades=4):
    """Pol gras: dunne, licht uitwaaierende sprieten (3 driehoeken per spriet)."""
    cols = ("Grass", "GrassD", "GrassY", "Grass")
    for b in range(blades):
        a = rnd.uniform(0, 2 * math.pi)
        lean = rnd.uniform(0.25, 0.55)
        h = s * rnd.uniform(0.05, 0.085)
        r = s * 0.009
        dx, dz = math.cos(a) * r * 0.8, math.sin(a) * r * 0.8
        cyl(0.0, r, h, 3, rnd.choice(cols), pos=(x + dx, y - 0.005, z + dz),
            rot=(math.sin(a) * lean, 0, -math.cos(a) * lean), smooth=False, cap=False)


def pebble(x, z, s=0.02, y=0.0):
    blob(s, rnd.choice(("StoneA", "StoneB", "StoneL")), (x, y + s * 0.25, z),
         scale=(rnd.uniform(1.0, 1.5), 0.55, rnd.uniform(0.9, 1.3)), sub=1)


def earth_base(w, d, top=0.04, clumps=12, pebbles=6, flowers=3, keep_clear=()):
    """Natuurlijke fundering: aangestampte aarde (geen grijze sokkel). De zijkanten zijn
    aardekleurig, zodat een helling eruitziet als een aardwal; langs de rand graspollen,
    keien en bloemetjes. keep_clear: lijst (x0, x1, z0, z1) waar niets mag (deur, stoep)."""
    box(w, 0.2 + top, d, "EarthD", pos=(0, -0.2, 0), bevel=0.03)
    box(w - 0.04, 0.012, d - 0.04, "Earth", pos=(0, top - 0.008, 0))

    def clear(x, z):
        return not any(x0 <= x <= x1 and z0 <= z <= z1 for (x0, x1, z0, z1) in keep_clear)

    def rim_point():
        side = rnd.randrange(4)
        t = rnd.uniform(-0.5, 0.5)
        o = rnd.uniform(-0.03, 0.02)
        if side == 0:
            return t * w, d / 2 + o
        if side == 1:
            return t * w, -d / 2 - o
        if side == 2:
            return w / 2 + o, t * d
        return -w / 2 - o, t * d

    def scatter(n_want, fn):
        n = tries = 0
        while n < n_want and tries < n_want * 10:
            tries += 1
            x, z = rim_point()
            if clear(x, z):
                fn(x, z)
                n += 1

    scatter(clumps, lambda x, z: grass_clump(x, z, s=rnd.uniform(0.8, 1.3), y=top))
    scatter(pebbles, lambda x, z: pebble(x, z, s=rnd.uniform(0.015, 0.026), y=top - 0.004))
    scatter(flowers, lambda x, z: blob(0.009, rnd.choice(("FlWhite", "FlYel", "FlPink")), (x, top + 0.035, z), sub=0))


# ------------------------------------------------------------------ ambient occlusion
def bake_ao(obj, samples=48, distance=0.12):
    """Bakt ambient occlusion (Cycles) in een vertex-kleur 'AO' (per hoekpunt), met een
    tijdelijk grondvlak zodat muurvoeten en hoeken aan de grond zacht donkerder worden.
    Kost in de game niets: de waarde wordt bij het laden in de vertex-kleuren verrekend."""
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = samples
    if scene.world is None:
        scene.world = bpy.data.worlds.new("World")
    scene.world.light_settings.distance = distance
    me = obj.data
    attr = me.color_attributes.get("AO") or me.color_attributes.new("AO", "BYTE_COLOR", "CORNER")
    me.color_attributes.active_color = attr
    try:
        me.color_attributes.render_color_index = me.color_attributes.active_color_index
    except Exception:
        pass
    bpy.ops.mesh.primitive_plane_add(size=6, location=(0, 0, -0.002))
    ground = bpy.context.active_object
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.bake(type="AO", target="VERTEX_COLORS", use_clear=True, margin=0)
    bpy.data.objects.remove(ground, do_unlink=True)


# ------------------------------------------------------------------ levels bouwen en exporteren
def build_levels(prefix, build_fn, args, levels=(1, 2, 3), ao=True):
    """Bouwt per level één samengevoegde mesh `<prefix>_l<n>` (+ rookmarker), bakt AO en exporteert."""
    built = []
    for lvl in levels:
        LEVEL.clear()
        smoke = build_fn(lvl)
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
        obj.name = obj.data.name = f"{prefix}_l{lvl}"
        bm = bmesh.new()
        bm.from_mesh(obj.data)
        bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.0002)
        bm.to_mesh(obj.data)
        bm.free()
        # oorsprong exact op (0,0,0) = midden tegel op maaiveld; node heeft geen eigen transformatie
        obj.data.transform(obj.matrix_world)
        obj.matrix_world = Matrix.Identity(4)
        if smoke is not None:
            emp = bpy.data.objects.new(f"{prefix}_l{lvl}_smoke", None)
            bpy.context.collection.objects.link(emp)
            place(emp, smoke)
        tris = ve.triangle_count([obj])
        if tris > args.budget:
            raise SystemExit(f"VE-BLENDER: {prefix}_l{lvl} heeft {tris} driehoeken > budget {args.budget}")
        built.append((obj, lvl, tris))
    use_ao = ao and not os.environ.get("VE_NO_AO")
    if use_ao:
        for obj, _, _ in built:
            for o, _, _ in built:
                o.hide_render = o is not obj
            bake_ao(obj)
        for o, _, _ in built:
            o.hide_render = False
    for obj, lvl, tris in built:
        print(f"VE-BLENDER-LEVEL {prefix}_l{lvl} tris={tris} materials={len(obj.data.materials)}")
    ve.export_glb(args.out, budget=args.budget * len(levels), vertex_colors=use_ao)
