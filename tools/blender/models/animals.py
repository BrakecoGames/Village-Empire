"""Village Empire — wilde dieren: konijn, ree, hert, wild zwijn, vos, eekhoorn en zangvogel, met animaties.

Opbouw per soort (game-assen: Y omhoog, kop naar +Z, poten op y = 0), net als de bewoners (settler.py):
  rig_<soort>_<node>        lege nodes = het skelet (root, body, head, tail, legFL/FR/BL/BR; vogel: wingL/R)
  <soort>__<node>__<deel>   meshdelen. 'legF' / 'legB' = hetzelfde deel aan beide kanten (linker- en rechterpoot)
  <soort>_<clip>            animaties (NLA-tracks): idle, walk, run, eat, alert, rest
                            + konijn: alert = rechtop zitten en rondkijken; vos: pounce (sprongetje);
                              eekhoorn: eat = rechtop met een nootje; vogel: idle (pikken), walk (hupjes), fly
Stijl: knus en cartoonesk, grote ogen met een lichtpuntje, zachte ronde vormen, geen enge details.

In de game is elk deel één InstancedMesh voor alle dieren van die soort (weinig draw calls); de clips worden
per dier op de CPU gesampled (js/wildlife.js).
Bouwen: npm run models -- animals
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
from ve_parts import rnd, LEVEL, M3, new_obj, gverts  # noqa: E402

args = ve.parse_args()
ve.reset_scene()
setup(seed=4401, extra_palette={
    "Eye": (0x1E140E, 0.0), "Spark": (0xFFFFFF, 0.0), "Nose": (0x2A1C16, 0.0), "Pink": (0xF2A0A8, 0.0), "White": (0xF6F1E6, 0.02),
    # konijn
    "Rab": (0xA88A6A, 0.03), "RabL": (0xD9C4A6, 0.02), "RabD": (0x8A6E52, 0.03),
    # ree
    "Roe": (0xB8733C, 0.03), "RoeL": (0xE8D2B0, 0.02), "RoeD": (0x8E5A30, 0.03),
    # hert
    "Deer": (0x9A5F34, 0.03), "DeerL": (0xE2C9A2, 0.02), "DeerD": (0x6E4226, 0.03), "Antler": (0xE0CDA6, 0.03), "Hoof": (0x3A2A20, 0.0),
    # zwijn
    "Boar": (0x5A4638, 0.04), "BoarD": (0x3A2C24, 0.04), "BoarL": (0x7A6250, 0.03), "Snout": (0xD89A8A, 0.0), "Tusk": (0xF4EEDC, 0.0),
    # vos
    "Fox": (0xE0722E, 0.03), "FoxD": (0xB5521E, 0.03), "Sock": (0x2E2420, 0.02),
    # eekhoorn
    "Sq": (0xB4542A, 0.03), "SqL": (0xF0DDBE, 0.02), "Nut": (0x8A5A2B, 0.03),
    # vogel
    "Bird": (0x8A6A4A, 0.03), "BirdL": (0xE6D2B2, 0.02), "BirdD": (0x5E4632, 0.03), "Beak": (0xF0A23A, 0.0), "Robin": (0xE07A3A, 0.02),
    "TitG": (0x8FA65A, 0.03), "TitY": (0xF2D24A, 0.02), "TitB": (0x3F7FD0, 0.02), "TitW": (0x5A8AC8, 0.03), "TitBk": (0x2A2A30, 0.0),
    "Black": (0x2A2826, 0.03), "BlackL": (0x3A3632, 0.03), "BlackW": (0x1F1D1C, 0.02),
    "Tint": (0xFFFFFF, 0.0), "BflyB": (0x2E2622, 0.0), "BflySpot": (0xFFF6E0, 0.0),
})

RIGS = {}        # soort -> {node: object}
NODEPOS = {}     # soort -> {node: (ouder, wereldpositie)}
CLIPS = {}       # soort -> {clip: (frames, keys)}
PARTS = []


def k(**kw):
    return kw


def limb(p0, p1, r0, r1, mat, seg=7, cap=True, smooth=True):
    """Ronde, taps toelopende vorm tussen twee punten (poot, hals, oor), normalen naar buiten."""
    p0, p1 = Vector(p0), Vector(p1)
    ax = (p1 - p0).normalized()
    ref = Vector((0, 0, 1)) if abs(ax.z) < 0.9 else Vector((1, 0, 0))
    u = ax.cross(ref).normalized()
    v = ax.cross(u)
    bm = bmesh.new()
    bot, top = [], []
    for i in range(seg):
        a = 2 * math.pi * i / seg
        d = u * math.cos(a) + v * math.sin(a)
        bot.append(gverts(bm, [tuple(p0 + d * r0)])[0])
        top.append(gverts(bm, [tuple(p1 + d * r1)])[0])
    sides = [bm.faces.new((bot[i], bot[(i + 1) % seg], top[(i + 1) % seg], top[i])) for i in range(seg)]
    caps = []
    if cap and r1 > 0.002:
        caps.append((bm.faces.new(top), 1))
    if cap and r0 > 0.002:
        caps.append((bm.faces.new(list(reversed(bot))), -1))
    bm.normal_update()
    P0, AX = M3 @ p0, M3 @ ax
    for f in sides:
        c = f.calc_center_median()
        proj = P0 + AX * (c - P0).dot(AX)
        if f.normal.dot(c - proj) < 0:
            f.normal_flip()
    for f, sg in caps:
        if f.normal.dot(AX) * sg < 0:
            f.normal_flip()
    return new_obj("limb", bm, mat, smooth)


def make_rig(sp, nodes):
    NODEPOS[sp] = nodes
    RIGS[sp] = {}
    for name, (parent, pos) in nodes.items():
        o = bpy.data.objects.new(f"rig_{sp}_{name}", None)
        bpy.context.collection.objects.link(o)
        o.rotation_mode = "XYZ"
        if parent:
            o.parent = RIGS[sp][parent]
            local = Vector(pos) - Vector(nodes[parent][1])
        else:
            local = Vector(pos)
        o.location = M3 @ local
        RIGS[sp][name] = o


def part(sp, node, name, fn):
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
    obj.name = obj.data.name = f"{sp}__{node}__{name}"
    LEVEL.clear()
    PARTS.append(obj)
    return obj


def clip(sp, name, frames, keys):
    CLIPS.setdefault(sp, {})[name] = (frames, keys)


def eyes(cx, cy, cz, sep, r, fwd=0.0, side=True):
    """Grote ogen met een lichtpuntje. side: ogen opzij van de kop (dieren), anders vooraan."""
    for s in (-1, 1):
        if side:
            x, z = cx + s * sep, cz + fwd
        else:
            x, z = cx + s * sep, cz
        blob(r, "Eye", (x, cy, z), scale=(0.8 if side else 1.0, 1.0, 1.0), sub=1)
        blob(r * 0.35, "Spark", (x + s * r * 0.45 * (1 if side else 0.3), cy + r * 0.4, z + r * 0.55), sub=0)


def leg(x, top, foot_y, r, mat, hoof=None, paw=None, z=0.0, knee_z=0.0):
    """Poot van `top` naar de grond, licht taps; optioneel hoef of pootje."""
    mid = (x, (top + foot_y) * 0.5, z + knee_z)
    limb((x, top, z), mid, r * 1.15, r * 0.85, mat)
    limb(mid, (x, foot_y + 0.008, z), r * 0.85, r * 0.7, mat)
    blob(r * 0.85, mat, mid, sub=1)
    if hoof:
        cyl(r * 0.85, r * 1.0, 0.014, 6, hoof, pos=(x, foot_y, z), smooth=False)
    if paw:
        blob(r * 1.2, paw, (x, foot_y + r * 0.6, z + r * 0.5), scale=(1.0, 0.7, 1.3), sub=1)


def walk_keys(L=0.5, bob=0.006, pitch=0.0):
    """Stapvoets (diagonale paren): LV + RA samen, RV + LA samen."""
    return [
        (0.0, {"legFL": k(rx=-L), "legBR": k(rx=-L), "legFR": k(rx=L), "legBL": k(rx=L), "body": k(rx=pitch), "head": k(rx=0.05)}),
        (0.25, {"legFL": k(), "legBR": k(), "legFR": k(), "legBL": k(), "body": k(dy=bob, rx=pitch), "head": k(rx=-0.03)}),
        (0.5, {"legFL": k(rx=L), "legBR": k(rx=L), "legFR": k(rx=-L), "legBL": k(rx=-L), "body": k(rx=pitch), "head": k(rx=0.05)}),
        (0.75, {"legFL": k(), "legBR": k(), "legFR": k(), "legBL": k(), "body": k(dy=bob, rx=pitch), "head": k(rx=-0.03)}),
        (1.0, {"legFL": k(rx=-L), "legBR": k(rx=-L), "legFR": k(rx=L), "legBL": k(rx=L), "body": k(rx=pitch), "head": k(rx=0.05)}),
    ]


def gallop_keys(F=0.9, B=0.9, lift=0.03, tilt=0.12):
    """Galop: voorpoten samen, achterpoten samen, lijf golft op en neer."""
    return [
        (0.0, {"legFL": k(rx=-F), "legFR": k(rx=-F * 0.8), "legBL": k(rx=B * 0.6), "legBR": k(rx=B * 0.5), "body": k(rx=tilt, dy=0.0), "head": k(rx=0.15), "tail": k(rx=-0.3)}),
        (0.3, {"legFL": k(rx=F * 0.4), "legFR": k(rx=F * 0.5), "legBL": k(rx=-B), "legBR": k(rx=-B * 0.85), "body": k(rx=-tilt, dy=lift), "head": k(rx=-0.1), "tail": k(rx=-0.6)}),
        (0.6, {"legFL": k(rx=F * 0.8), "legFR": k(rx=F * 0.6), "legBL": k(rx=-B * 0.3), "legBR": k(rx=-B * 0.2), "body": k(rx=0.0, dy=lift * 0.6), "head": k(rx=0.0), "tail": k(rx=-0.45)}),
        (1.0, {"legFL": k(rx=-F), "legFR": k(rx=-F * 0.8), "legBL": k(rx=B * 0.6), "legBR": k(rx=B * 0.5), "body": k(rx=tilt, dy=0.0), "head": k(rx=0.15), "tail": k(rx=-0.3)}),
    ]


def idle_keys(look=0.5, tail=0.25):
    return [
        (0.0, {"head": k(), "body": k(), "tail": k()}),
        (0.2, {"body": k(dy=0.002), "tail": k(ry=tail)}),
        (0.3, {"head": k(ry=look, rx=-0.05), "tail": k(ry=-tail * 0.6)}),
        (0.5, {"head": k(ry=look, rx=-0.05), "body": k(), "tail": k(ry=tail * 0.4)}),
        (0.62, {"head": k(rz=0.12, ry=-look * 0.4)}),                                  # nieuwsgierig kopje scheef
        (0.8, {"head": k(rz=0.12, ry=-look * 0.4), "body": k(dy=0.002), "tail": k()}),
        (1.0, {"head": k(), "body": k(), "tail": k()}),
    ]


def eat_keys(down=0.95, body_dy=-0.006):
    return [
        (0.0, {"head": k(rx=down), "body": k(dy=body_dy, rx=0.05), "tail": k()}),
        (0.25, {"head": k(rx=down + 0.12, ry=0.1), "tail": k(ry=0.25)}),
        (0.5, {"head": k(rx=down - 0.05, ry=-0.08), "body": k(dy=body_dy * 0.8, rx=0.05), "tail": k(ry=-0.2)}),
        (0.75, {"head": k(rx=down + 0.1, ry=0.05), "tail": k(ry=0.15)}),
        (1.0, {"head": k(rx=down), "body": k(dy=body_dy, rx=0.05), "tail": k()}),
    ]


def alert_keys(look=0.7):
    return [
        (0.0, {"head": k(rx=-0.3), "tail": k(rx=-0.35), "body": k(dy=0.003)}),
        (0.3, {"head": k(rx=-0.32, ry=look)}),
        (0.6, {"head": k(rx=-0.3, ry=-look * 0.8)}),
        (1.0, {"head": k(rx=-0.3), "tail": k(rx=-0.35), "body": k(dy=0.003)}),
    ]


def rest_keys(body_h, fold=1.35):
    """Liggen: lijf omlaag, poten onder de buik gevouwen (voorpoten naar achteren, achterpoten naar voren),
    kop rustig opzij; langzaam ademen."""
    dy = -body_h * 0.6
    legs = {"legFL": k(rx=fold), "legFR": k(rx=fold * 0.95), "legBL": k(rx=-fold), "legBR": k(rx=-fold * 0.95)}
    p0 = dict(legs, body=k(dy=dy), head=k(rx=0.2, ry=0.35), tail=k())
    return [
        (0.0, p0),
        (0.5, {"body": k(dy=dy + 0.0025), "head": k(rx=0.25, ry=0.4)}),
        (1.0, p0),
    ]


def with_neck(keys, nrx=0.0):
    """Clips van viervoeters zonder hals ook bruikbaar voor herten: de hals volgt de kop een beetje."""
    out = []
    for t, d in keys:
        d = dict(d)
        hd = d.get("head")
        if hd is not None:
            d["neck"] = k(rx=nrx + hd.get("rx", 0.0) * 0.5, ry=hd.get("ry", 0.0) * 0.35)
            d["head"] = dict(hd, rx=hd.get("rx", 0.0) * 0.5, ry=hd.get("ry", 0.0) * 0.65)
        elif t in (0.0, 1.0):
            d["neck"] = k(rx=nrx)
        out.append((t, d))
    return out


def quad_nodes(hb, body_len, lx, leg_top, head, tail, neck=None):
    """Skelet van een viervoeter. leg_top, head, tail en neck zijn plekken t.o.v. het midden van het lijf
    (y = 0 op lijfhoogte hb); de draaipunten zitten bij de heup, de schouder, de nek en de staartwortel."""
    zf, zb = body_len * 0.36, -body_len * 0.36
    W = lambda p: (p[0], hb + p[1], p[2])
    n = {
        "root": (None, (0, 0, 0)),
        "body": ("root", (0, hb, 0)),
        "tail": ("body", W(tail)),
        "legFL": ("body", (-lx, hb + leg_top, zf)), "legFR": ("body", (lx, hb + leg_top, zf)),
        "legBL": ("body", (-lx, hb + leg_top, zb)), "legBR": ("body", (lx, hb + leg_top, zb)),
    }
    if neck:
        n["neck"] = ("body", W(neck))
        n["head"] = ("neck", W(head))
    else:
        n["head"] = ("body", W(head))
    return n


# ================================================================== konijn
def rabbit():
    sp = "rabbit"
    make_rig(sp, quad_nodes(0.05, 0.1, 0.026, -0.015, (0, 0.035, 0.045), (0, 0.01, -0.055)))
    part(sp, "body", "body", lambda: (
        blob(0.05, "Rab", (0, 0.055, -0.01), scale=(0.95, 0.85, 1.15), sub=2),
        blob(0.034, "RabL", (0, 0.04, 0.022), scale=(0.85, 0.8, 0.9), sub=1),                # buik
        blob(0.032, "Rab", (-0.03, 0.04, -0.035), scale=(0.7, 0.9, 1.0), sub=1),             # achterbouten
        blob(0.032, "Rab", (0.03, 0.04, -0.035), scale=(0.7, 0.9, 1.0), sub=1)))
    def head():
        blob(0.034, "Rab", (0, 0.095, 0.06), scale=(0.95, 0.9, 1.0), sub=2)
        blob(0.016, "RabL", (0, 0.084, 0.088), scale=(1.1, 0.8, 0.8), sub=1)               # snuitje
        blob(0.006, "Pink", (0, 0.092, 0.097), sub=1)
        eyes(0, 0.104, 0.07, 0.024, 0.009, fwd=0.006)
        for s in (-1, 1):                                                                  # lange oren
            limb((s * 0.012, 0.118, 0.05), (s * 0.027, 0.195, 0.035), 0.009, 0.007, "Rab")
            limb((s * 0.0128, 0.124, 0.057), (s * 0.026, 0.185, 0.043), 0.005, 0.004, "Pink")
    part(sp, "head", "head", head)
    part(sp, "tail", "tail", lambda: blob(0.017, "White", (0, 0.065, -0.068), sub=1))
    part(sp, "legF", "leg", lambda: leg(-0.026, 0.035, 0.0, 0.007, "Rab", paw="RabL", z=0.036))
    part(sp, "legB", "leg", lambda: (blob(0.012, "RabL", (-0.026, 0.006, -0.03), scale=(0.9, 0.5, 2.0), sub=1),))
    clip(sp, "idle", 96, idle_keys(0.45, 0.2) + [])
    # hupjes: achterpoten duwen af, lijf maakt een boogje
    clip(sp, "walk", 16, [
        (0.0, {"body": k(rx=0.0), "legBL": k(), "legBR": k(), "legFL": k(), "legFR": k(), "head": k()}),
        (0.25, {"body": k(dy=0.018, rx=-0.25), "legBL": k(rx=-0.7), "legBR": k(rx=-0.7), "legFL": k(rx=-0.5), "legFR": k(rx=-0.5), "head": k(rx=0.1)}),
        (0.55, {"body": k(dy=0.012, rx=0.2), "legBL": k(rx=0.3), "legBR": k(rx=0.3), "legFL": k(rx=0.5), "legFR": k(rx=0.5)}),
        (1.0, {"body": k(rx=0.0), "legBL": k(), "legBR": k(), "legFL": k(), "legFR": k(), "head": k()}),
    ])
    clip(sp, "run", 10, [
        (0.0, {"body": k(rx=0.1), "legBL": k(rx=0.4), "legBR": k(rx=0.4), "legFL": k(rx=-0.6), "legFR": k(rx=-0.6), "head": k(), "tail": k()}),
        (0.3, {"body": k(dy=0.04, rx=-0.3), "legBL": k(rx=-1.0), "legBR": k(rx=-1.0), "legFL": k(rx=-0.9), "legFR": k(rx=-0.9), "head": k(rx=0.15)}),
        (0.65, {"body": k(dy=0.03, rx=0.25), "legBL": k(rx=0.5), "legBR": k(rx=0.5), "legFL": k(rx=0.7), "legFR": k(rx=0.7), "head": k(rx=-0.1)}),
        (1.0, {"body": k(rx=0.1), "legBL": k(rx=0.4), "legBR": k(rx=0.4), "legFL": k(rx=-0.6), "legFR": k(rx=-0.6), "head": k(), "tail": k()}),
    ])
    clip(sp, "eat", 40, eat_keys(0.7, -0.004) + [])
    # rechtop zitten en rondkijken, met trillend neusje
    clip(sp, "alert", 48, [
        (0.0, {"body": k(rx=-0.95, dy=0.02), "head": k(rx=0.75), "legFL": k(rx=0.6), "legFR": k(rx=0.6), "legBL": k(rx=-0.95), "legBR": k(rx=-0.95)}),
        (0.25, {"head": k(rx=0.75, ry=0.6)}),
        (0.35, {"head": k(rx=0.7, ry=0.6, rz=0.08)}),
        (0.6, {"head": k(rx=0.75, ry=-0.6)}),
        (0.75, {"head": k(rx=0.7, ry=-0.55, rz=-0.08)}),
        (1.0, {"body": k(rx=-0.95, dy=0.02), "head": k(rx=0.75), "legFL": k(rx=0.6), "legFR": k(rx=0.6), "legBL": k(rx=-0.95), "legBR": k(rx=-0.95)}),
    ])
    clip(sp, "rest", 60, [
        (0.0, {"body": k(dy=-0.012), "legFL": k(rx=-1.2), "legFR": k(rx=-1.2), "head": k(rx=0.15)}),
        (0.5, {"body": k(dy=-0.01), "head": k(rx=0.2, ry=0.15)}),
        (1.0, {"body": k(dy=-0.012), "legFL": k(rx=-1.2), "legFR": k(rx=-1.2), "head": k(rx=0.15)}),
    ])


# ================================================================== ree en hert (zelfde bouw, ander formaat)
def cervid(sp, s, mat, light, dark, antlers):
    hb, L = 0.2 * s, 0.26 * s
    make_rig(sp, quad_nodes(hb, L, 0.045 * s, -0.012 * s, (0, 0.125 * s, 0.155 * s), (0, 0.03 * s, -0.14 * s), neck=(0, 0.0, 0.085 * s)))
    def body():
        blob(0.1 * s, mat, (0, hb + 0.01 * s, 0), scale=(0.62, 0.68, 1.35), sub=2)
        blob(0.06 * s, light, (0, hb - 0.03 * s, 0.01 * s), scale=(0.7, 0.55, 1.5), sub=1)          # lichte buik
        blob(0.036 * s, "White", (0, hb - 0.005 * s, -0.125 * s), scale=(0.85, 0.9, 0.45), sub=1)   # witte spiegel
        blob(0.045 * s, mat, (0, hb + 0.03 * s, 0.085 * s), scale=(0.8, 0.9, 0.9), sub=1)            # schoft
    part(sp, "body", "body", body)
    part(sp, "neck", "neck", lambda: (
        limb((0, hb + 0.0 * s, 0.085 * s), (0, hb + 0.135 * s, 0.16 * s), 0.038 * s, 0.025 * s, mat, seg=9),
        blob(0.026 * s, light, (0, hb + 0.06 * s, 0.13 * s), scale=(0.8, 1.6, 0.6), sub=1)))        # lichte keel
    def head():
        hy, hz = hb + 0.15 * s, 0.175 * s
        blob(0.042 * s, mat, (0, hy, hz), scale=(0.85, 0.9, 1.05), sub=2)
        blob(0.026 * s, light, (0, hy - 0.012 * s, hz + 0.04 * s), scale=(0.85, 0.75, 1.2), sub=1)    # snuit
        blob(0.009 * s, "Nose", (0, hy - 0.005 * s, hz + 0.066 * s), sub=1)
        eyes(0, hy + 0.012 * s, hz + 0.012 * s, 0.032 * s, 0.009 * s, fwd=0.004)
        for side in (-1, 1):
            limb((side * 0.022 * s, hy + 0.028 * s, hz - 0.012 * s), (side * 0.065 * s, hy + 0.062 * s, hz - 0.03 * s), 0.013 * s, 0.003 * s, mat)   # oren
            limb((side * 0.025 * s, hy + 0.033 * s, hz - 0.006 * s), (side * 0.058 * s, hy + 0.058 * s, hz - 0.022 * s), 0.007 * s, 0.002 * s, "Pink")
    part(sp, "head", "head", head)
    if antlers:
        def antler():
            hy, hz = hb + 0.15 * s, 0.175 * s
            for side in (-1, 1):
                b = (side * 0.016 * s, hy + 0.035 * s, hz - 0.012 * s)
                m1 = (side * 0.05 * s, hy + 0.11 * s, hz - 0.03 * s)
                top = (side * 0.06 * s, hy + 0.17 * s, hz - 0.01 * s)
                limb(b, m1, 0.006 * s, 0.005 * s, "Antler", seg=5); limb(m1, top, 0.005 * s, 0.003 * s, "Antler", seg=5)
                limb((side * 0.032 * s, hy + 0.07 * s, hz - 0.02 * s), (side * 0.03 * s, hy + 0.1 * s, hz + 0.03 * s), 0.004 * s, 0.0025 * s, "Antler", seg=5)
                limb(m1, (side * 0.085 * s, hy + 0.14 * s, hz - 0.06 * s), 0.004 * s, 0.0025 * s, "Antler", seg=5)
                limb((side * 0.057 * s, hy + 0.15 * s, hz - 0.018 * s), (side * 0.04 * s, hy + 0.19 * s, hz + 0.01 * s), 0.0035 * s, 0.002 * s, "Antler", seg=5)
        part(sp, "head", "antlers", antler)
    part(sp, "tail", "tail", lambda: blob(0.014 * s, dark, (0, hb + 0.02 * s, -0.145 * s), scale=(0.8, 1.2, 0.6), sub=1))
    part(sp, "legF", "leg", lambda: leg(-0.045 * s, hb - 0.01 * s, 0.0, 0.011 * s, mat, hoof="Hoof", z=0.094 * s, knee_z=0.006 * s))
    part(sp, "legB", "leg", lambda: (blob(0.035 * s, mat, (-0.045 * s, hb - 0.02 * s, -0.094 * s), scale=(0.7, 1.1, 1.0), sub=1),
                                     leg(-0.045 * s, hb - 0.03 * s, 0.0, 0.011 * s, mat, hoof="Hoof", z=-0.094 * s, knee_z=-0.012 * s)))
    clip(sp, "idle", 120, with_neck(idle_keys(0.55, 0.3)))
    clip(sp, "walk", 26, with_neck(walk_keys(0.42, 0.006), 0.12))
    clip(sp, "run", 14, with_neck(gallop_keys(0.85, 0.95, 0.05 * s, 0.14), 0.45))
    # grazen: hals helemaal omlaag, snuit in het gras, voorpoten iets naar voren, af en toe even opkijken
    def graze(extra=None, n=1.95, h=0.35):
        d = {"neck": k(rx=n), "head": k(rx=h), "body": k(rx=0.22, dy=-0.012 * s), "legFL": k(rx=-0.22), "legFR": k(rx=-0.18), "legBL": k(rx=0.12), "legBR": k(rx=0.12), "tail": k()}
        d.update(extra or {})
        return d
    clip(sp, "eat", 72, [(0.0, graze()), (0.2, graze({"head": k(rx=0.45, ry=0.15)}, 2.0)), (0.4, graze({"head": k(rx=0.3, ry=-0.12), "tail": k(ry=0.3)}, 1.9)),
                         (0.6, graze({"head": k(rx=0.42)}, 2.0)), (0.8, graze({"head": k(rx=0.35, ry=0.1), "tail": k(ry=-0.3)}, 1.92)), (1.0, graze())])
    clip(sp, "alert", 60, [(0.0, {"neck": k(rx=-0.18), "head": k(rx=-0.1), "tail": k(rx=-0.5), "body": k(dy=0.004 * s)}),
                           (0.3, {"neck": k(rx=-0.2, ry=0.15), "head": k(rx=-0.1, ry=0.6)}),
                           (0.6, {"neck": k(rx=-0.18, ry=-0.12), "head": k(rx=-0.08, ry=-0.55, rz=0.1)}),
                           (1.0, {"neck": k(rx=-0.18), "head": k(rx=-0.1), "tail": k(rx=-0.5), "body": k(dy=0.004 * s)})])
    clip(sp, "rest", 72, with_neck(rest_keys(hb, 1.45), 0.25))


# ================================================================== wild zwijn
def boar():
    sp, hb = "boar", 0.11
    make_rig(sp, quad_nodes(hb, 0.22, 0.045, -0.025, (0, 0.012, 0.085), (0, 0.035, -0.12)))
    def body():
        blob(0.1, "Boar", (0, hb + 0.01, -0.005), scale=(0.72, 0.75, 1.25), sub=2)
        blob(0.08, "BoarL", (0, hb - 0.02, 0.0), scale=(0.75, 0.55, 1.2), sub=1)
        for i in range(6):                                                              # borstelige rug
            box(0.02, 0.026, 0.024, "BoarD", pos=(0, hb + 0.07 - abs(i - 2) * 0.006, 0.06 - i * 0.026), rot=(0.3, 0, 0))
    part(sp, "body", "body", body)
    def head():
        y, z = hb + 0.0, 0.13
        blob(0.055, "Boar", (0, y, z), scale=(0.85, 0.85, 1.1), sub=2)
        cyl(0.024, 0.03, 0.05, 10, "BoarL", pos=(0, y - 0.012, z + 0.04), rot=(math.pi / 2, 0, 0))   # snuit
        cyl(0.025, 0.025, 0.006, 10, "Snout", pos=(0, y - 0.012, z + 0.09), rot=(math.pi / 2, 0, 0))
        for s in (-1, 1):
            blob(0.004, "BoarD", (s * 0.009, y - 0.012, z + 0.097), sub=0)
            limb((s * 0.02, y - 0.02, z + 0.06), (s * 0.03, y + 0.005, z + 0.075), 0.004, 0.0015, "Tusk", seg=5)    # slagtandjes
            limb((s * 0.025, y + 0.035, z - 0.01), (s * 0.048, y + 0.072, z - 0.028), 0.012, 0.003, "BoarD")  # oren
        eyes(0, y + 0.02, z + 0.025, 0.033, 0.008, fwd=0.004)
    part(sp, "head", "head", head)
    part(sp, "tail", "tail", lambda: (limb((0, hb + 0.04, -0.125), (0.005, hb - 0.01, -0.14), 0.0035, 0.002, "BoarD", seg=5),
                                      blob(0.008, "BoarD", (0.006, hb - 0.015, -0.142), sub=0)))
    part(sp, "legF", "leg", lambda: leg(-0.045, hb - 0.03, 0.0, 0.012, "BoarD", hoof="Hoof", z=0.079))
    part(sp, "legB", "leg", lambda: leg(-0.045, hb - 0.03, 0.0, 0.013, "BoarD", hoof="Hoof", z=-0.079))
    clip(sp, "idle", 96, idle_keys(0.35, 0.5))
    clip(sp, "walk", 20, walk_keys(0.5, 0.005))
    clip(sp, "run", 12, gallop_keys(0.75, 0.8, 0.025, 0.08))
    # wroeten: snuit in de grond, kopje heen en weer
    clip(sp, "eat", 40, [
        (0.0, {"head": k(rx=0.55), "body": k(rx=0.08, dy=-0.004), "tail": k(ry=0.4)}),
        (0.2, {"head": k(rx=0.7, ry=0.25)}),
        (0.4, {"head": k(rx=0.5, ry=-0.2), "tail": k(ry=-0.4)}),
        (0.6, {"head": k(rx=0.72, ry=0.15)}),
        (0.8, {"head": k(rx=0.55, ry=-0.25), "tail": k(ry=0.4)}),
        (1.0, {"head": k(rx=0.55), "body": k(rx=0.08, dy=-0.004), "tail": k(ry=0.4)}),
    ])
    clip(sp, "alert", 48, alert_keys(0.5))
    clip(sp, "rest", 72, rest_keys(hb, 1.3))


# ================================================================== vos
def fox():
    sp, hb = "fox", 0.085
    make_rig(sp, quad_nodes(hb, 0.18, 0.03, -0.02, (0, 0.028, 0.085), (0, 0.012, -0.085)))
    part(sp, "body", "body", lambda: (
        blob(0.07, "Fox", (0, hb + 0.005, 0), scale=(0.62, 0.62, 1.4), sub=2),
        blob(0.045, "White", (0, hb - 0.01, 0.06), scale=(0.75, 0.75, 0.9), sub=1)))
    def head():
        y, z = hb + 0.045, 0.11
        blob(0.04, "Fox", (0, y, z), scale=(1.0, 0.85, 0.95), sub=2)
        blob(0.025, "White", (0, y - 0.012, z + 0.02), scale=(1.15, 0.6, 0.9), sub=1)
        cyl(0.004, 0.02, 0.045, 8, "Fox", pos=(0, y - 0.006, z + 0.03), rot=(math.pi / 2, 0, 0))   # spitse snuit
        blob(0.007, "Nose", (0, y - 0.006, z + 0.077), sub=1)
        eyes(0, y + 0.01, z + 0.022, 0.022, 0.008, fwd=0.003)
        for s in (-1, 1):
            cyl(0.0, 0.017, 0.05, 4, "Fox", pos=(s * 0.022, y + 0.025, z - 0.01), rot=(0, 0, s * -0.25), smooth=False)
            cyl(0.0, 0.009, 0.032, 4, "Sock", pos=(s * 0.024, y + 0.045, z - 0.008), rot=(0, 0, s * -0.25), smooth=False)
    part(sp, "head", "head", head)
    def tail():
        y = hb + 0.015
        for i, (r, mat) in enumerate(((0.028, "Fox"), (0.034, "Fox"), (0.032, "FoxD"), (0.024, "White"))):
            blob(r, mat, (0, y - i * 0.012, -0.1 - i * 0.035), scale=(0.85, 0.85, 1.25), sub=1)
    part(sp, "tail", "tail", tail)
    part(sp, "legF", "leg", lambda: leg(-0.03, hb - 0.02, 0.0, 0.008, "Sock", paw="Sock", z=0.065))
    part(sp, "legB", "leg", lambda: (blob(0.025, "Fox", (-0.03, hb - 0.02, -0.065), scale=(0.7, 1.0, 1.0), sub=1),
                                     leg(-0.03, hb - 0.025, 0.0, 0.008, "Sock", paw="Sock", z=-0.065)))
    clip(sp, "idle", 96, idle_keys(0.6, 0.45))
    clip(sp, "walk", 22, walk_keys(0.45, 0.003, pitch=0.04))                            # sluipend: laag en voorzichtig
    clip(sp, "run", 12, gallop_keys(0.9, 0.95, 0.035, 0.14))
    clip(sp, "eat", 48, eat_keys(0.85, -0.006))
    clip(sp, "alert", 48, alert_keys(0.8))
    clip(sp, "rest", 72, rest_keys(hb, 1.35))
    # sprongetje (muizen): laag ineenduiken, hoge boog met de voorpoten vooruit, landen met de neus in het gras
    clip(sp, "pounce", 28, [
        (0.0, {"body": k(dy=-0.02, rx=0.1), "legFL": k(rx=-0.6), "legFR": k(rx=-0.6), "legBL": k(rx=0.7), "legBR": k(rx=0.7), "head": k(rx=0.2), "tail": k(rx=0.2)}),
        (0.35, {"body": k(dy=0.12, rx=-0.5), "legFL": k(rx=-1.3), "legFR": k(rx=-1.3), "legBL": k(rx=0.9), "legBR": k(rx=0.9), "head": k(rx=0.3), "tail": k(rx=-0.5)}),
        (0.6, {"body": k(dy=0.06, rx=0.7), "legFL": k(rx=-1.4), "legFR": k(rx=-1.4), "head": k(rx=0.6), "tail": k(rx=-0.8)}),
        (0.8, {"body": k(dy=-0.01, rx=0.35), "legFL": k(rx=-0.3), "legFR": k(rx=-0.3), "legBL": k(), "legBR": k(), "head": k(rx=0.9), "tail": k(rx=-0.6)}),
        (1.0, {"body": k(dy=0.0, rx=0.0), "legFL": k(), "legFR": k(), "legBL": k(), "legBR": k(), "head": k(), "tail": k()}),
    ])


# ================================================================== eekhoorn
def squirrel():
    sp, hb = "squirrel", 0.03
    make_rig(sp, quad_nodes(hb, 0.06, 0.013, -0.008, (0, 0.022, 0.028), (0, 0.002, -0.028)))
    part(sp, "body", "body", lambda: (
        blob(0.026, "Sq", (0, hb + 0.004, 0), scale=(0.8, 0.85, 1.25), sub=2),
        blob(0.016, "SqL", (0, hb - 0.002, 0.014), scale=(0.8, 0.8, 1.0), sub=1)))
    def head():
        y, z = hb + 0.03, 0.035
        blob(0.019, "Sq", (0, y, z), sub=2)
        blob(0.009, "SqL", (0, y - 0.006, z + 0.014), scale=(1.1, 0.8, 0.9), sub=1)
        blob(0.0035, "Nose", (0, y - 0.002, z + 0.022), sub=0)
        eyes(0, y + 0.004, z + 0.008, 0.014, 0.0055, fwd=0.002)
        for s in (-1, 1):
            cyl(0.0, 0.006, 0.02, 4, "Sq", pos=(s * 0.009, y + 0.013, z - 0.004), smooth=False)
            blob(0.003, "SqL", (s * 0.009, y + 0.034, z - 0.004), sub=0)                       # pluimpjes
    part(sp, "head", "head", head)
    def tail():
        pts = [(0, hb + 0.0, -0.03, 0.013), (0, hb + 0.02, -0.045, 0.017), (0, hb + 0.045, -0.05, 0.019), (0, hb + 0.068, -0.04, 0.017), (0, hb + 0.078, -0.022, 0.012)]
        for i, (x, y, z, r) in enumerate(pts):
            blob(r, "Sq" if i % 2 == 0 else "SqL" if i == 3 else "Sq", (x, y, z), scale=(0.8, 1.0, 1.0), sub=1)
    part(sp, "tail", "tail", tail)
    part(sp, "legF", "leg", lambda: leg(-0.013, hb - 0.008, 0.0, 0.004, "Sq", paw="SqL", z=0.02))
    part(sp, "legB", "leg", lambda: (blob(0.012, "Sq", (-0.014, hb - 0.012, -0.018), scale=(0.7, 1.0, 1.2), sub=1),
                                     leg(-0.013, hb - 0.014, 0.0, 0.004, "Sq", paw="SqL", z=-0.02)))
    clip(sp, "idle", 72, [
        (0.0, {"head": k(), "tail": k(), "body": k()}),
        (0.15, {"tail": k(rx=-0.3)}), (0.22, {"tail": k(rx=0.1)}), (0.29, {"tail": k(rx=-0.3)}), (0.36, {"tail": k()}),   # staartje trilt
        (0.5, {"head": k(ry=0.6, rx=-0.15)}),
        (0.7, {"head": k(ry=-0.5, rx=-0.1)}),
        (1.0, {"head": k(), "tail": k(), "body": k()}),
    ])
    clip(sp, "walk", 10, gallop_keys(0.7, 0.8, 0.012, 0.15))
    clip(sp, "run", 8, gallop_keys(0.95, 1.0, 0.02, 0.2))
    # rechtop met een nootje
    def nut_pose(extra):
        d = {"body": k(rx=-1.0, dy=0.012), "head": k(rx=0.85), "legFL": k(rx=-1.6), "legFR": k(rx=-1.6), "legBL": k(rx=-0.9), "legBR": k(rx=-0.9), "tail": k(rx=1.25)}
        d.update(extra)
        return d
    clip(sp, "eat", 36, [(0.0, nut_pose({})), (0.25, nut_pose({"head": k(rx=0.95)})), (0.5, nut_pose({})), (0.75, nut_pose({"head": k(rx=0.95, ry=0.1)})), (1.0, nut_pose({}))])
    clip(sp, "alert", 40, [(0.0, nut_pose({"head": k(rx=0.75)})), (0.4, nut_pose({"head": k(rx=0.75, ry=0.7)})), (0.8, nut_pose({"head": k(rx=0.75, ry=-0.6)})), (1.0, nut_pose({"head": k(rx=0.75)}))])
    clip(sp, "rest", 60, rest_keys(hb, 1.2))


# ================================================================== zangvogel
BIRDS = {   # soort: (lijf, borst, kop, vleugel, snavel)
    "bird": ("Bird", "Robin", "BirdD", "BirdD", "Beak"),           # roodborstje
    "tit": ("TitG", "TitY", "TitB", "TitW", "TitBk"),                # pimpelmees: blauw petje, gele borst
    "blackbird": ("Black", "BlackL", "Black", "BlackW", "Beak"),     # merel: zwart met oranje snavel
}


def bird(sp="bird"):
    """Zangvogel met gevederde vleugels (waaier van platte veren) en clips voor pikken, hupjes, fladderen en zweven."""
    cb, cc, ch, cw, ck = BIRDS[sp]
    sz = 1.12 if sp == "blackbird" else 0.92 if sp == "tit" else 1.0
    hb = 0.025 * sz
    make_rig(sp, {
        "root": (None, (0, 0, 0)), "body": ("root", (0, hb, 0)), "head": ("body", (0, hb + 0.018 * sz, 0.012 * sz)),
        "tail": ("body", (0, hb + 0.004 * sz, -0.018 * sz)),
        "wingL": ("body", (-0.012 * sz, hb + 0.012 * sz, 0.004 * sz)), "wingR": ("body", (0.012 * sz, hb + 0.012 * sz, 0.004 * sz)),
    })
    part(sp, "body", "body", lambda: (
        blob(0.021 * sz, cb, (0, hb + 0.004 * sz, -0.002 * sz), scale=(0.85, 0.85, 1.2), sub=2),
        blob(0.016 * sz, cc, (0, hb + 0.001 * sz, 0.009 * sz), scale=(0.85, 0.85, 0.7), sub=1),
        limb((-0.006 * sz, hb - 0.012 * sz, 0.0), (-0.006 * sz, 0.0, 0.002), 0.0016, 0.0012, "Beak", seg=4),
        limb((0.006 * sz, hb - 0.012 * sz, 0.0), (0.006 * sz, 0.0, 0.002), 0.0016, 0.0012, "Beak", seg=4)))
    def head():
        y, z = hb + 0.024 * sz, 0.016 * sz
        blob(0.014 * sz, ch, (0, y, z), sub=2)
        if sp == "tit":
            blob(0.0145 * sz, "TitW", (0, y - 0.004 * sz, z + 0.002 * sz), scale=(1.02, 0.6, 0.95), sub=1)   # witte wangen
            blob(0.009 * sz, "TitB", (0, y + 0.008 * sz, z), scale=(1.2, 0.6, 1.2), sub=1)                  # blauw petje
        cyl(0.0, 0.005 * sz, 0.012 * sz, 6, ck, pos=(0, y - 0.002 * sz, z + 0.011 * sz), rot=(math.pi / 2, 0, 0), smooth=False)
        eyes(0, y + 0.003 * sz, z + 0.004 * sz, 0.011 * sz, 0.004 * sz, fwd=0.002)
    part(sp, "head", "head", head)
    def tail():
        for i, off in enumerate((-0.006, 0.0, 0.006)):
            box(0.007 * sz, 0.003, 0.026 * sz, cw, pos=(off * sz, hb + 0.006 * sz, -0.028 * sz), rot=(-0.35, off * 6, 0))
    part(sp, "tail", "tail", tail)
    def wing(side):
        def f():
            # vleugel: waaier van platte veren vanaf de schouder naar buiten en iets naar achteren
            x0 = side * 0.012 * sz
            for i in range(4):
                L = (0.034 - i * 0.004) * sz
                ang = side * (0.15 + i * 0.22)
                cx, cz = x0 + side * L * 0.5 * math.cos(i * 0.22), -0.004 * sz - i * 0.006 * sz
                box(L, 0.0028, 0.011 * sz, cw if i else cb, pos=(cx, hb + 0.012 * sz, cz), rot=(0, ang * 0.4, 0))
        return f
    part(sp, "wingL", "wing", wing(-1))
    part(sp, "wingR", "wing", wing(1))
    clip(sp, "idle", 48, [                                                          # rondkijken en pikken
        (0.0, {"head": k(), "body": k(), "tail": k(), "wingL": k(ry=-1.35, rz=0.25), "wingR": k(ry=1.35, rz=-0.25)}),
        (0.15, {"head": k(ry=0.6)}), (0.3, {"head": k(ry=-0.5)}),
        (0.45, {"head": k(rx=0.9), "body": k(rx=0.35), "tail": k(rx=-0.4)}), (0.52, {"head": k(rx=0.2), "body": k(rx=0.1)}),
        (0.6, {"head": k(rx=0.9), "body": k(rx=0.35), "tail": k(rx=-0.4)}), (0.7, {"head": k(), "body": k(), "tail": k(rx=0.2)}),
        (1.0, {"head": k(), "body": k(), "tail": k(), "wingL": k(ry=-1.35, rz=0.25), "wingR": k(ry=1.35, rz=-0.25)}),
    ])
    clip(sp, "walk", 12, [
        (0.0, {"body": k(), "tail": k(), "wingL": k(ry=-1.35, rz=0.25), "wingR": k(ry=1.35, rz=-0.25)}), (0.4, {"body": k(dy=0.012, rx=-0.15), "tail": k(rx=0.3)}),
        (1.0, {"body": k(), "tail": k(), "wingL": k(ry=-1.35, rz=0.25), "wingR": k(ry=1.35, rz=-0.25)}),
    ])
    # fladderen: vleugels ver omhoog, krachtige neerslag; lijf deint mee
    clip(sp, "fly", 10, [
        (0.0, {"wingL": k(rz=1.15, ry=0.1), "wingR": k(rz=-1.15, ry=-0.1), "body": k(rx=-0.12, dy=-0.002), "tail": k(rx=0.15), "head": k(rx=-0.1)}),
        (0.45, {"wingL": k(rz=-0.75, ry=-0.15), "wingR": k(rz=0.75, ry=0.15), "body": k(rx=-0.08, dy=0.004)}),
        (0.7, {"wingL": k(rz=-0.35), "wingR": k(rz=0.35)}),
        (1.0, {"wingL": k(rz=1.15, ry=0.1), "wingR": k(rz=-1.15, ry=-0.1), "body": k(rx=-0.12, dy=-0.002), "tail": k(rx=0.15), "head": k(rx=-0.1)}),
    ])
    # zweven: vleugels gestrekt, licht wiegend, staart gespreid
    clip(sp, "glide", 36, [
        (0.0, {"wingL": k(rz=0.12), "wingR": k(rz=-0.12), "body": k(rx=-0.05), "tail": k(rx=0.1), "head": k(rx=-0.15)}),
        (0.5, {"wingL": k(rz=0.2), "wingR": k(rz=-0.2), "body": k(rx=-0.02, dy=0.002), "tail": k(rx=0.05), "head": k(rx=-0.1, ry=0.15)}),
        (1.0, {"wingL": k(rz=0.12), "wingR": k(rz=-0.12), "body": k(rx=-0.05), "tail": k(rx=0.1), "head": k(rx=-0.15)}),
    ])
    clip(sp, "alert", 24, [(0.0, {"head": k(rx=-0.2, ry=0.5), "tail": k(rx=0.4), "wingL": k(ry=-1.35, rz=0.25), "wingR": k(ry=1.35, rz=-0.25)}), (0.5, {"head": k(rx=-0.2, ry=-0.5)}),
                           (1.0, {"head": k(rx=-0.2, ry=0.5), "tail": k(rx=0.4), "wingL": k(ry=-1.35, rz=0.25), "wingR": k(ry=1.35, rz=-0.25)})])


def butterfly():
    """Vlinder (geen rig): lijfje en twee vleugels. De vleugels zijn wit (de game kleurt ze per vlinder) met
    donkere randen en lichte vlekjes; ze scharnieren langs het lijf (de game laat ze open en dicht gaan)."""
    def body():
        limb((0, 0.0, -0.012), (0, 0.002, 0.012), 0.0035, 0.003, "BflyB", seg=6)
        blob(0.0042, "BflyB", (0, 0.002, 0.014), sub=1)
        for s_ in (-1, 1):
            limb((s_ * 0.0015, 0.004, 0.016), (s_ * 0.007, 0.012, 0.026), 0.0006, 0.0005, "BflyB", seg=3)
            blob(0.0012, "BflyB", (s_ * 0.007, 0.012, 0.026), sub=0)
    part_free("butterfly__body", body)
    def wing(side):
        def f():
            blob(0.018, "Tint", (side * 0.017, 0.0, 0.006), scale=(1.0, 0.06, 0.8), sub=1)          # voorvleugel
            blob(0.013, "Tint", (side * 0.013, 0.0, -0.011), scale=(1.0, 0.06, 0.85), sub=1)        # achtervleugel
            blob(0.008, "BflyB", (side * 0.03, 0.0012, 0.011), scale=(1.0, 0.08, 0.9), sub=1)      # donkere vleugelpunt
            blob(0.0035, "BflySpot", (side * 0.019, 0.0016, 0.006), scale=(1.0, 0.12, 1.0), sub=0)  # lichte vlek
            blob(0.003, "BflySpot", (side * 0.014, 0.0016, -0.012), scale=(1.0, 0.12, 1.0), sub=0)
        return f
    part_free("butterfly__wingL", wing(-1))
    part_free("butterfly__wingR", wing(1))


def part_free(name, fn):
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
    obj.name = obj.data.name = name
    LEVEL.clear()
    PARTS.append(obj)
    return obj


# ================================================================== bouwen
rabbit()
cervid("roe", 0.85, "Roe", "RoeL", "RoeD", antlers=False)
cervid("deer", 1.12, "Deer", "DeerL", "DeerD", antlers=True)
boar()
fox()
squirrel()
bird("bird")
bird("tit")
bird("blackbird")
butterfly()


def bake_clips():
    """Elke clip als NLA-track <soort>_<clip> op de rig-nodes van die soort."""
    for sp, clips in CLIPS.items():
        for cname, (frames, keys) in clips.items():
            moved = {n for _, d in keys for n, v in d.items() if "dy" in v}
            for nname, o in RIGS[sp].items():
                pts = [(t, d[nname]) for t, d in keys if nname in d]
                o.animation_data_create()
                act = bpy.data.actions.new(f"{sp}_{cname}_{nname}")
                o.animation_data.action = act
                rest = Vector(o.location)
                if not pts:
                    pts = [(0.0, {}), (1.0, {})]
                if pts[0][0] > 0:
                    pts = [(0.0, {})] + pts
                if pts[-1][0] < 1:
                    pts = pts + [(1.0, pts[0][1])]
                for t, v in pts:
                    f = round(t * frames)
                    rx, ry, rz = v.get("rx", 0.0), v.get("ry", 0.0), v.get("rz", 0.0)
                    o.rotation_euler = (rx, -rz, ry)                  # game (X, Y, Z) -> blender (X, -Z, Y)
                    o.location = rest + Vector((0, 0, v.get("dy", 0.0)))
                    o.keyframe_insert("rotation_euler", frame=f)
                    if nname in moved:
                        o.keyframe_insert("location", frame=f)
                o.location = rest
                o.rotation_euler = (0, 0, 0)
                tr = o.animation_data.nla_tracks.new()
                tr.name = f"{sp}_{cname}"
                tr.strips.new(f"{sp}_{cname}", 0, act)
                o.animation_data.action = None


bake_clips()
bpy.context.scene.render.fps = 24

tri = {o.name: sum(len(p.vertices) - 2 for p in o.data.polygons) for o in PARTS}
per = {}
for n_, t_ in tri.items():
    s_ = n_.split("__")[0]
    mult = 2 if "__legF__" in n_ or "__legB__" in n_ else 1
    per[s_] = per.get(s_, 0) + t_ * mult
print("VE-ANIMALS", per, "clips", {s: len(c) for s, c in CLIPS.items()})

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
