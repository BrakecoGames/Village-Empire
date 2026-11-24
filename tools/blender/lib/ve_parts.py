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
    # rode pannen: geglazuurde terracotta golfpannen (zie pan()), weinig variatie zoals echt geglazuurd
    "RoofA": (0xC0583A, 0.03), "RoofB": (0xB24E32, 0.03), "RoofC": (0xC96640, 0.03),
    "RoofDeck": (0x6E2A1C, 0.03), "Ridge": (0xA4462C, 0.03),
    "StoneA": (0xB5AE9F, 0.08), "StoneB": (0x9E978A, 0.08), "StoneD": (0x8E877A, 0.06), "StoneL": (0xCFC8B8, 0.06),
    "Brick": (0xA8553A, 0.08),
    "Door": (0x7A4A28, 0.08), "DoorD": (0x4B2F1C, 0.04), "Iron": (0x4A4D52, 0.0),
    "Glow": (0xFFD27A, 0.0), "Glass": (0x2C3A4E, 0.0),
    "Shutter": (0x3F7FAF, 0.06), "ShutterG": (0x4E8A4A, 0.06),
    "WoodL": (0xC89A5E, 0.08), "Wood": (0xA0703F, 0.08), "Soil": (0x5A3E28, 0.05),
    "Leaf": (0x4B8A30, 0.10), "LeafL": (0x6AAA3E, 0.10),
    "FlRed": (0xE84A5F, 0.0), "FlYel": (0xFFD166, 0.0), "FlPink": (0xF78FB3, 0.0), "FlWhite": (0xF7F3EA, 0.0),
    # daken
    "Thatch": (0xDCB65E, 0.07), "ThatchD": (0xC9A048, 0.07), "ThatchL": (0xE6C66E, 0.07),
    "SlateA": (0x5F6C80, 0.07), "SlateB": (0x4E5A6C, 0.07), "SlateC": (0x6E7B8E, 0.07), "SlateD": (0x434E5E, 0.05),
    "ShA": (0x7A5A3E, 0.08), "ShB": (0x6B4E36, 0.08), "ShC": (0x8A6A48, 0.08), "Moss": (0x7D8646, 0.08),
    "TileBlueA": (0x3F6FA0, 0.03), "TileBlueB": (0x355F8C, 0.03), "TileBlueC": (0x4A7DB0, 0.03),   # geglazuurde blauwe golfpannen
    "TilePurpA": (0x7A3F6E, 0.07), "TilePurpB": (0x6A3360, 0.07), "TilePurpC": (0x864C7A, 0.07),
    "TileDarkA": (0x8A3E2C, 0.07), "TileDarkB": (0x7A3424, 0.07), "TileDarkC": (0x9A4A36, 0.07),
    "Log": (0x8A5A2B, 0.07), "LogD": (0x6E4522, 0.06), "LogEnd": (0xD9B07A, 0.05),
    # goederen en accenten
    "Hay": (0xE8C860, 0.08), "Sack": (0xD9C7A0, 0.06), "Canvas": (0xF4ECD8, 0.04), "Cream": (0xFFF3D6, 0.03),
    "RedC": (0xD8402F, 0.05), "BlueC": (0x2F6FB0, 0.05), "Purple": (0x6E3463, 0.06), "Gold": (0xE8B73A, 0.03),
    "Water": (0x4A9BD1, 0.03), "Grape": (0x6B2D7A, 0.06), "Bread": (0xD08B3E, 0.06), "Apple": (0xC8402F, 0.05),
    "Pumpkin": (0xE08A2E, 0.05), "Cabbage": (0x8DBF4A, 0.06), "BarnRed": (0xA8402C, 0.06), "Wine": (0x7B1E3A, 0.04),
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


# pannen die als geglazuurde golfpan (pan) gebouwd worden: rood, donkerrood en blauw
RED_PANS = ("RoofA", "RoofB", "RoofC", "TileDarkA", "TileDarkB", "TileDarkC", "TileBlueA", "TileBlueB", "TileBlueC")


def strands(lines, mats=("ThatchL", "ThatchD"), wid=0.01):
    """Rietstengels als dunne strookjes op een rieten dak: lines = [(p0, p1, n), ...] in game-assen
    (n = buitenkant). Twee kleuren door elkaar, één object per kleur (2 driehoeken per stengel)."""
    for mi, mat in enumerate(mats):
        bm = bmesh.new()
        faces = []
        for i, (p0, p1, n) in enumerate(lines):
            if i % len(mats) != mi:
                continue
            p0, p1, n = Vector(p0), Vector(p1), Vector(n).normalized()
            d = (p1 - p0).normalized()
            side = d.cross(n).normalized() * (wid / 2)
            lift = n * 0.003
            v = gverts(bm, [tuple(p0 - side + lift), tuple(p0 + side + lift), tuple(p1 + side * 0.6 + lift), tuple(p1 - side * 0.6 + lift)])
            faces.append((bm.faces.new(v), M3 @ n))
        if not faces:
            bm.free()
            continue
        bm.normal_update()
        for f, bn in faces:
            if f.normal.dot(bn) < 0:
                f.normal_flip()
        new_obj("strands", bm, mat)


def pan(center, up, nrm, w, length, mat, kick=0.09, amp=None):
    """Eén geglazuurde golfpan (zoals een moderne keramische S-pan): over de breedte een zachte golf
    (brede holte en ronde rug) en onderaan een dikke, ronde neus die over de rij eronder valt.
    Naast elkaar sluiten de golven naadloos aan (periodiek profiel), zodat een rij één doorlopende
    golflijn vormt. Glad gearceerd. 20 driehoeken."""
    S = 5
    amp = amp if amp is not None else w * 0.22
    lipW, lipT = min(0.02, length * 0.2), w * 0.16
    prof = lambda u: amp * (0.5 + 0.5 * math.cos(2 * math.pi * (u - 0.68))) - amp * 0.5
    bm = bmesh.new()
    top, a, b = [], [], []
    for k in range(S + 1):
        u = k / S
        x, z = -w / 2 + w * u, prof(u)
        top.append(gverts(bm, [(x, length / 2, z)])[0])
        a.append(gverts(bm, [(x, -length / 2 + lipW, z)])[0])
        b.append(gverts(bm, [(x, -length / 2, z + lipT * 0.45)])[0])
    for k in range(S):
        for r0, r1 in ((a, top), (b, a)):
            bm.faces.new((r0[k], r0[k + 1], r1[k + 1], r1[k]))
    bm.normal_update()
    for f in bm.faces:                                   # buitenkant (game +z = blender -y) naar buiten
        if f.normal.y > 0:
            f.normal_flip()
    obj = new_obj("pan", bm, mat, smooth=True)
    orient(obj, center, up, nrm, kick)
    PANS[0] += 1
    return obj


PANS = [0]          # golfpannen in het huidige level: krijgen een eigen driehoeksbudget (zie build_levels)


def tile(center, up, nrm, r, length, mat, kick=0.11, twist=0.0):
    """Eén dakpan: as langs de helling omhoog (up), bolling naar buiten (nrm).
    Rode pannen zijn geglazuurde golfpannen (pan); de andere kleuren blijven holle pannen."""
    if mat in RED_PANS:
        c = Vector(center) - Vector(nrm).normalized() * (r * 0.2)
        return pan(tuple(c), up, nrm, r / 0.52, length, mat, kick=kick * 0.8)
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
        deck_mat = mats[-1] if kind == "tile" and mats[0].startswith("TileBlue") else "RoofDeck"   # blauw dak: blauw onderdak
        box(width + 0.02, 0.022, L + 0.03, deck_mat, pos=((x0 + x1) / 2, mid.y, mid.z), rot=(rx, 0, 0), base=False)
    for ri in range(rows):
        t = (ri + 0.5) * L / rows
        if kind == "thatch":
            # riet: dikke, afgeronde lagen over de volle breedte, trapsgewijs, met losse rietstengels erop
            c = E + up * t + nrm * 0.022
            obj = box(width + 0.05, tl * 1.05, 0.04, rnd.choice(mats), base=False, bevel=0.016, smooth=True)
            k = kick * 1.2
            orient(obj, ((x0 + x1) / 2, c.y, c.z), up, nrm, k, rnd.uniform(-0.01, 0.01))
            yk = (up * math.cos(k) - nrm * math.sin(k)).normalized()
            zk = (nrm * math.cos(k) + up * math.sin(k)).normalized()
            cc = Vector(((x0 + x1) / 2, c.y, c.z)) + zk * 0.02
            lines = []
            n = int((width + 0.04) / 0.012)
            for q in range(n):
                xx = -(width + 0.04) / 2 + (q + rnd.uniform(0.2, 0.8)) * (width + 0.04) / n
                lo = rnd.uniform(0.42, 0.5) * tl * 1.05
                hi = rnd.uniform(0.25, 0.5) * tl
                lines.append((cc + Vector((xx, 0, 0)) - yk * lo, cc + Vector((xx + rnd.uniform(-0.006, 0.006), 0, 0)) + yk * hi, zk))
            strands(lines, mats=("ThatchL", "Thatch", "ThatchD"), wid=0.006)
            if ri == 0:
                # dikke, afgesneden rietrand langs de goot (zoals bij een echt rieten dak)
                e = E + nrm * 0.03 - up * 0.004
                cyl(0.026, 0.026, width + 0.06, 8, "ThatchD", pos=(x0 - 0.03, e.y, e.z), rot=(0, 0, -math.pi / 2))
            continue
        stagger = (0.12 if ri % 2 else -0.12) * tw          # verspringende rijen: leest als pannen, niet als planken
        if kind == "tile" and mats[0] in RED_PANS:
            stagger = 0.0                                    # golfpannen: de golven lopen recht door, rij op rij
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
    elif kind == "thatch":
        # dikke, ronde rietnok
        cyl(ridge_r * 1.5, ridge_r * 1.5, w + 0.07, 8, ridge_mat, pos=(x0 - 0.035, ridge_y + 0.002, z), rot=(0, 0, -math.pi / 2))
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




# ------------------------------------------------------------------ samengestelde gebouwdelen
ROOFS = {   # soort -> (bouwwijze, materialen, nokmateriaal, nokstraal, plankmaat)
    "tile": ("tile", ROOF_TILE_MATS, "Ridge", 0.032, 0.11),
    "slate": ("shingle", ("SlateA", "SlateB", "SlateA", "SlateC"), "SlateD", 0.026, 0.1),
    "shingle": ("shingle", ("ShA", "ShA", "ShB", "ShC", "ShB", "ShA", "Moss"), "LogD", 0.028, 0.12),
    "thatch": ("thatch", ("Thatch", "ThatchD", "ThatchL", "Thatch"), "ThatchD", 0.03, 0.1),
}


def house_body(x=0.0, z=0.0, w=0.5, d=0.4, wall_top=0.42, ridge_y=0.72, roof="tile", wall="Plaster",
               timber=True, over=0.08, y0=0.06, plinth=True, roof_color=None):
    """Huis met puntgevels links/rechts, nok langs x en voorgevel aan +z: muren (stuc of steen),
    vakwerk, natuurstenen plint en een dak van de gekozen soort. Geeft handige maten terug."""
    apex = ridge_y - 0.04
    prism([(-d / 2, y0), (d / 2, y0), (d / 2, wall_top), (0, apex), (-d / 2, wall_top)], w, wall,
          pos=(x, 0, z), bevel=0.006)
    t = 0.026
    hx, hz = w / 2 + 0.004, d / 2 + 0.004
    if timber:
        mid = (y0 + wall_top) / 2
        for sx in (-1, 1):
            for sz in (-1, 1):
                beam((x + sx * hx, y0, z + sz * hz), (x + sx * hx, wall_top, z + sz * hz), t)
        for sz in (-1, 1):
            beam((x - hx, wall_top - 0.012, z + sz * hz), (x + hx, wall_top - 0.012, z + sz * hz), t)
            beam((x - hx, mid, z + sz * hz), (x + hx, mid, z + sz * hz), t * 0.9)
        for sx in (-1, 1):
            beam((x + sx * hx, wall_top - 0.012, z - hz), (x + sx * hx, wall_top - 0.012, z + hz), t)
            beam((x + sx * hx, wall_top, z), (x + sx * hx, apex - 0.01, z), t * 0.9)
            beam((x + sx * hx, y0 + 0.02, z - hz + 0.02), (x + sx * hx, mid, z - 0.03), t * 0.8)
            beam((x + sx * hx, mid, z + 0.03), (x + sx * hx, wall_top - 0.02, z + hz - 0.02), t * 0.8)
    elif wall.startswith("Stone"):
        # metselwerk: een paar uitstekende stenen en hoekstenen voor textuur
        for sx in (-1, 1):
            for k in range(3):
                yy = y0 + 0.03 + k * (wall_top - y0) / 3
                box(0.05, 0.045, 0.05, "StoneL" if k % 2 else "StoneB", pos=(x + sx * (w / 2 - 0.018), yy, z + d / 2 - 0.018), bevel=0.006)
        for _ in range(5):
            box(rnd.uniform(0.04, 0.07), 0.03, 0.01, rnd.choice(("StoneL", "StoneB")),
                pos=(x + rnd.uniform(-w / 2 + 0.06, w / 2 - 0.06), rnd.uniform(y0 + 0.04, wall_top - 0.05), z + d / 2 + 0.004))
    kind, mats, rmat, rr, piece = ROOFS[roof]
    if roof_color:
        mats = roof_color
        if kind == "tile":
            rmat = roof_color[2]                 # nokpannen in de kleur van het dak (blauw, donkerrood)
    s = (ridge_y - (wall_top + 0.03)) / (d / 2)
    eave_y = wall_top + 0.03 - s * over
    L = math.hypot(d / 2 + over, ridge_y - eave_y)
    rows = max(3, round(L / (0.085 if kind == "thatch" else 0.095)))
    cols = max(3, round((w + 0.16) / piece))
    gable_roof(w + 0.16, d / 2 + over, eave_y, ridge_y, rows, cols, x=x, z=z, kind=kind, mats=mats,
               ridge_mat=rmat, ridge_r=rr, barge_mat="Timber" if kind != "thatch" else "ThatchD")
    if plinth:
        stone_plinth(x - w / 2, x + w / 2, z - d / 2, z + d / 2, y=y0, n_front=max(3, round(w / 0.12)), n_side=max(3, round(d / 0.12)))
    return {"front": z + d / 2 + 0.004, "back": z - d / 2, "left": x - w / 2, "right": x + w / 2 + 0.004,
            "top": wall_top, "ridge": ridge_y, "x": x, "z": z}


def cone_roof(x, z, y, r, h, mats=("Thatch", "ThatchD", "ThatchL"), rows=4, seg=12, tip_mat=None):
    """Kegeldak in overlappende ringen (riet of leien), met piek. Riet krijgt rietstengels, een dikke
    afgesneden rand langs de goot en een nokkap, zoals een echt rieten kegeldak."""
    thatch = mats[0].startswith("Thatch")
    lines = []
    for i in range(rows):
        f0, f1 = i / rows, (i + 1) / rows
        r0, r1 = r * (1 - f0 * 0.92), r * (1 - f1 * 0.92)
        y0, hh = y + h * f0 * 0.92, h / rows * 1.15
        cyl(r1 * 0.98, r0 * 1.04, hh, seg, rnd.choice(mats), pos=(x, y0, z), cap=False)
        if thatch:
            ra, rb = r0 * 1.04, r1 * 0.98
            slope = math.atan2(ra - rb, hh)
            n = max(10, int(2 * math.pi * ra / 0.028))
            for q in range(n):
                a = (q + rnd.uniform(0.2, 0.8)) / n * 2 * math.pi
                ca, sa = math.cos(a), math.sin(a)
                lo, hi = rnd.uniform(0.0, 0.08), rnd.uniform(0.55, 0.95)
                pa = Vector((x + ca * (ra + (rb - ra) * lo), y0 + hh * lo, z + sa * (ra + (rb - ra) * lo)))
                pb = Vector((x + ca * (ra + (rb - ra) * hi), y0 + hh * hi, z + sa * (ra + (rb - ra) * hi)))
                lines.append((pa, pb, (ca * math.cos(slope), math.sin(slope), sa * math.cos(slope))))
    if thatch:
        strands(lines)
        cyl(r * 1.06, r * 1.08, 0.035, seg * 2, "ThatchD", pos=(x, y - 0.012, z), cap=False)      # dikke rand
        cyl(r * 0.2, r * 0.26, h * 0.12, seg, "ThatchD", pos=(x, y + h * 0.84, z), cap=False)     # nokkap
    cyl(0.0, r * 0.14, h * 0.16, seg, tip_mat or mats[0], pos=(x, y + h * 0.9, z), cap=False)


def pyramid_roof(x, z, y, half, h, mats=ROOF_TILE_MATS, rows=5, ridge_mat="Ridge", tw=0.12):
    """Vierkant piramidedak van geglazuurde golfpannen, recht op een vierkante onderbouw (de hoeken
    liggen op de diagonalen, dus boven hoekpalen). Onderdak, pannen per dakvlak, hoekkepers met
    nokpannen en een piek."""
    A = Vector((x, y + h, z))
    # onderdak: vier driehoeken
    bm = bmesh.new()
    cs = [Vector((x + sx * half, y, z + sz * half)) for sx, sz in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
    faces = []
    for i in range(4):
        a, b = cs[i], cs[(i + 1) % 4]
        out = ((a + b) / 2 - Vector((x, y, z)))
        out.y = 0
        v = gverts(bm, [tuple(a - Vector((0, 0.012, 0))), tuple(b - Vector((0, 0.012, 0))), tuple(A - Vector((0, 0.012, 0)))])
        faces.append((bm.faces.new(v), M3 @ (out.normalized() + Vector((0, 1, 0)))))
    bm.normal_update()
    for f, bn in faces:
        if f.normal.dot(bn) < 0:
            f.normal_flip()
    new_obj("deck", bm, "RoofDeck")
    for dx, dz in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        d = Vector((dx, 0, dz))
        E = Vector((x, y, z)) + d * half
        up = (A - E).normalized()
        lat = Vector((-dz, 0, dx))
        nrm = up.cross(lat).normalized()
        if nrm.dot(d) < 0:
            nrm = -nrm
        L = (A - E).length
        for ri in range(rows):
            t = (ri + 0.5) / rows
            wt = 2 * half * (1 - t) * 0.98
            n = max(1, int(wt / tw + 0.35))
            c = E + (A - E) * t + nrm * 0.006
            for k in range(n):
                off = (k - (n - 1) / 2) * tw
                pan(tuple(c + lat * off), up, nrm, tw, L / rows * 1.25, rnd.choice(mats), kick=0.08)
    for sx, sz in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
        C = Vector((x + sx * half, y, z + sz * half))
        D = (A - C).normalized()
        H = Vector((sx, 0, sz)).normalized()
        bulge = (H - D * H.dot(D)).normalized()
        half_tube(tuple((A + C) / 2 + bulge * 0.012), tuple(D), tuple(bulge), 0.022, (A - C).length + 0.02, ridge_mat, seg=5, cap=True)
    cyl(0.0, 0.04, 0.06, 8, ridge_mat, pos=(x, y + h - 0.01, z))


def crate(x, z, y=0.0, s=0.08, rot=0.0):
    box(s, s, s, "WoodL", pos=(x, y, z), rot=(0, rot, 0), bevel=0.006)
    beam((x - s / 2 * math.cos(rot), y + s * 0.5, z + s / 2 * math.sin(rot) + 0.0), (x + s / 2 * math.cos(rot), y + s * 0.5, z - s / 2 * math.sin(rot)), 0.01, "Wood")


def sack(x, z, y=0.0, s=0.045, mat="Sack"):
    blob(s, mat, (x, y + s * 0.8, z), scale=(1.0, 1.25, 0.85), sub=1)
    blob(s * 0.35, mat, (x, y + s * 1.85, z), scale=(1, 0.6, 1), sub=0)


def hay_bale(x, z, y=0.0, along="x", r=0.06, l=0.11):
    rot = (0, 0, -math.pi / 2) if along == "x" else (math.pi / 2, 0, 0)
    p = (x - l / 2, y + r, z) if along == "x" else (x, y + r, z - l / 2)
    cyl(r, r, l, 10, "Hay", pos=p, rot=rot)


def stall(x, z, c1="RedC", c2="Canvas", goods=("Apple", "Cabbage", "Pumpkin"), w=0.26, d=0.16):
    """Marktkraam: palen, toonbank met waren en een gestreepte luifel (halve buizen)."""
    for sx in (-1, 1):
        for sz in (-1, 1):
            box(0.018, 0.27, 0.018, "Timber", pos=(x + sx * w / 2, 0.04, z + sz * d / 2))
    box(w, 0.07, d * 0.8, "Wood", pos=(x, 0.04, z + 0.01), bevel=0.006)
    n = 5
    for s_ in range(n):
        xx = x - w / 2 + (s_ + 0.5) * w / n
        half_tube((xx, 0.3, z), (0, -0.25, 1), (0, 1, 0.25), w / n * 0.55, d + 0.06, c1 if s_ % 2 else c2, seg=4, cap=False)
    for g in range(4):
        blob(0.022, goods[g % len(goods)], (x - w / 2 + 0.05 + g * (w - 0.1) / 3, 0.125, z + 0.02), sub=1)


def flag_pole(x, z, y0, h):
    """Vlaggenmast; de vlag zelf is een animatie in de game (marker 'flag')."""
    cyl(0.008, 0.01, h, 6, "Iron", pos=(x, y0, z))
    blob(0.014, "Gold", (x, y0 + h + 0.008, z), sub=1)
    return (x + 0.005, y0 + h, z)


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
    extra = 0
    for lvl in levels:
        LEVEL.clear()
        PANS[0] = 0
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
        # markers: rook uit schoorstenen en ankerpunten voor geanimeerde delen (vlag, wieken, zaag).
        # build_fn geeft None, één (x,y,z) of {"smoke": [(x,y,z), ...], "anims": {"flag": (x,y,z)}} terug.
        info = smoke if isinstance(smoke, dict) else {"smoke": [smoke] if smoke is not None else []}
        markers = [(f"{prefix}_l{lvl}_smoke" + ("" if i == 0 else str(i + 1)), p) for i, p in enumerate(info.get("smoke", []))]
        markers += [(f"{prefix}_l{lvl}_anim_{k}", p) for k, p in info.get("anims", {}).items()]
        # "pile": waar de game de werkelijke uitvoervoorraad als stapel neerlegt (y = grondniveau)
        if info.get("pile"):
            markers.append((f"{prefix}_l{lvl}_pile", info["pile"]))
        # "slot0", "slot1", ...: vakken waar de game de inhoud van een opslag als nette stapels neerlegt
        for i, p in enumerate(info.get("slots", [])):
            markers.append((f"{prefix}_l{lvl}_slot{i}", p))
        # "in0", "in1", ...: stapels aangeleverde grondstoffen van een werkplaats (volgorde = VE.RES_ORDER)
        for i, p in enumerate(info.get("inp", [])):
            markers.append((f"{prefix}_l{lvl}_in{i}", p))
        # "rack": voetplank van een wapenrek (midden, bovenkant); de game zet daar de gesmede wapens rechtop
        if info.get("rack"):
            markers.append((f"{prefix}_l{lvl}_rack", info["rack"]))
        for name, p in markers:
            emp = bpy.data.objects.new(name, None)
            bpy.context.collection.objects.link(emp)
            place(emp, p)
        tris = ve.triangle_count([obj])
        # geglazuurde golfpannen kosten 20 i.p.v. 6 driehoeken per pan: dat verschil krijgt het model erbij
        budget = args.budget + PANS[0] * 14
        extra = max(extra, PANS[0] * 14)
        if tris > budget:
            raise SystemExit(f"VE-BLENDER: {prefix}_l{lvl} heeft {tris} driehoeken > budget {budget}")
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
    ve.export_glb(args.out, budget=(args.budget + extra) * len(levels), vertex_colors=use_ao)
