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
    "Fox": (0xE0722E, 0.03), "FoxD": (0xB5521E, 0.03), "Sock": (0x2E2420, 0.02), "FoxEye": (0xD89A2A, 0.0),
    # eekhoorn
    "Sq": (0xB4542A, 0.012), "SqL": (0xF0DDBE, 0.008), "SqD": (0x8E3E1E, 0.012), "Nut": (0x8A5A2B, 0.03),
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


# ================================================================== landdieren (v2)
# Nieuw skelet voor viervoeters: per poot een bovenpoot (legXX, draait in de schouder/heup) en een onderpoot
# (shinXX, knie/hak), oren (earL/earR), staart (tail1, en bij de vos tail2) en bij herten een nek. Loopcycli
# worden berekend: per poot een standfase (hoef op de grond, schuift naar achteren) en een zwaaifase (knie
# gebogen, poot naar voren), diagonale paren bij stappen/draven, voor- en achterpaar bij galop.
# Conventie (game-assen): rx < 0 = poot naar voren, rx > 0 = naar achteren; shin rx > 0 = onderpoot klapt
# naar achteren (knie buigt). Oren: rz naar buiten, rx > 0 = plat naar achteren.
LEGS = ("FL", "FR", "BL", "BR")


def rig4(sp, hb, lx, shoulder, hip, knee, hock, head, neck=None, ear=None, tails=()):
    """shoulder/hip: (y, z) van het draaipunt; knee/hock: (y, dz) t.o.v. dat punt; head/neck/ear: wereldplek."""
    n = {"root": (None, (0, 0, 0)), "body": ("root", (0, hb, 0))}
    for s, x in (("L", -lx), ("R", lx)):
        n["legF" + s] = ("body", (x, shoulder[0], shoulder[1]))
        n["shinF" + s] = ("legF" + s, (x, knee[0], shoulder[1] + knee[1]))
        n["legB" + s] = ("body", (x, hip[0], hip[1]))
        n["shinB" + s] = ("legB" + s, (x, hock[0], hip[1] + hock[1]))
    if neck:
        n["neck"] = ("body", neck)
        n["head"] = ("neck", head)
    else:
        n["head"] = ("body", head)
    if ear:
        n["earL"] = ("head", (-ear[0], ear[1], ear[2]))
        n["earR"] = ("head", (ear[0], ear[1], ear[2]))
    parent = "body"
    for i, p in enumerate(tails):
        n["tail%d" % (i + 1)] = (parent, p)
        parent = "tail%d" % (i + 1)
    make_rig(sp, n)
    return n


def E(rz=0.22, rx=0.0, ry=0.0):
    """beide oren: naar buiten gekanteld (spiegelbeeldig)"""
    return {"earL": k(rz=rz, rx=rx, ry=ry), "earR": k(rz=-rz, rx=rx, ry=-ry)}


def merge(*ds):
    out = {}
    for d in ds:
        out.update(d)
    return out


def gait(L, K, bob, pitch=0.0, phases=None, steps=12, extra=None, swing=0.5):
    """Berekende loopcyclus. phases: fase per poot (0..1). Standfase: rx van -L naar +L; zwaaifase terug met
    gebogen knie (sinus). extra(t) voegt kop/staart/oren toe."""
    phases = phases or {"FL": 0.0, "BR": 0.0, "FR": 0.5, "BL": 0.5}
    keys = []
    for st in range(steps + 1):
        t = st / steps
        d = {}
        for name, ph in phases.items():
            p = (t + ph) % 1.0
            if p < 1 - swing:
                a = -L + 2 * L * (p / (1 - swing)); kn = 0.0
            else:
                q = (p - (1 - swing)) / swing; a = L - 2 * L * (0.5 - 0.5 * math.cos(q * math.pi)); kn = K * math.sin(q * math.pi)
            d["leg" + name] = k(rx=a)
            d["shin" + name] = k(rx=kn)
        d["body"] = k(dy=bob * abs(math.sin(t * 2 * math.pi)), rx=pitch)
        if extra:
            d.update(extra(t))
        keys.append((t, d))
    return keys


def stand(extra=None, spread=0.0):
    d = {}
    for name in LEGS:
        d["leg" + name] = k(rx=(-spread if name[0] == "F" else spread))
        d["shin" + name] = k()
    d.update(extra or {})
    return d


def lying(hb, extra=None, fold=1.0):
    d = {"body": k(dy=-hb * 0.62)}
    for s in ("L", "R"):
        d["legF" + s] = k(rx=1.25 * fold); d["shinF" + s] = k(rx=-2.3 * fold)       # voorpoten onder de borst
        d["legB" + s] = k(rx=-1.0 * fold); d["shinB" + s] = k(rx=2.2 * fold)        # achterpoten onder de buik
    d.update(extra or {})
    return d


def leap_keys(extra=None, lift=0.04):
    """sprong (niet herhalend): ineenduiken, afzetten, vlucht met opgevouwen voorpoten, landen"""
    fr = lambda a, b: {"legFL": k(rx=a), "legFR": k(rx=a), "shinFL": k(rx=b), "shinFR": k(rx=b)}
    bk = lambda a, b: {"legBL": k(rx=a), "legBR": k(rx=a), "shinBL": k(rx=b), "shinBR": k(rx=b)}
    ex = extra or (lambda t: {})
    return [
        (0.0, merge(fr(-0.2, 0.3), bk(-0.5, 0.9), {"body": k(dy=-lift * 0.4, rx=0.15)}, ex(0.0))),
        (0.22, merge(fr(-1.2, 1.9), bk(1.0, 0.1), {"body": k(dy=lift * 0.6, rx=-0.35)}, ex(0.22))),
        (0.55, merge(fr(-1.0, 1.7), bk(1.2, 0.6), {"body": k(dy=lift, rx=0.0)}, ex(0.55))),
        (0.82, merge(fr(-0.7, 0.1), bk(0.4, 1.4), {"body": k(dy=lift * 0.3, rx=0.3)}, ex(0.82))),
        (1.0, merge(fr(0.0, 0.0), bk(0.0, 0.0), {"body": k(dy=0.0, rx=0.0)}, ex(1.0))),
    ]


def leg_seg(x, top, bot, r0, r1, mat, joint=True):
    limb(top, bot, r0, r1, mat, seg=7)
    if joint:
        blob(r0 * 1.05, mat, top, sub=1)


def hoof(x, y, z, r, mat="Hoof"):
    cyl(r * 0.9, r * 1.1, r * 1.4, 7, mat, pos=(x, y, z), smooth=False)


# ------------------------------------------------------------------ konijn
def rabbit():
    sp, hb = "rabbit", 0.05
    rig4(sp, hb, 0.022, shoulder=(0.045, 0.034), hip=(0.05, -0.034), knee=(0.02, 0.002), hock=(0.018, 0.01),
         head=(0, 0.088, 0.056), ear=(0.012, 0.122, 0.05), tails=[(0, 0.066, -0.066)])
    def body():
        blob(0.048, "Rab", (0, 0.056, -0.012), scale=(0.92, 0.86, 1.18), sub=2)            # peervormig lijf
        blob(0.034, "RabL", (0, 0.04, 0.02), scale=(0.82, 0.72, 0.95), sub=1)              # lichte buik
        blob(0.028, "Rab", (0, 0.07, 0.03), scale=(0.9, 0.9, 0.9), sub=1)                  # schouders
    part(sp, "body", "body", body)
    def head():
        y, z = 0.094, 0.064
        blob(0.031, "Rab", (0, y, z), scale=(0.92, 0.9, 1.08), sub=2)
        blob(0.017, "RabL", (0, y - 0.011, z + 0.024), scale=(1.15, 0.75, 0.85), sub=1)    # wangen en snuitje
        blob(0.0055, "Pink", (0, y - 0.004, z + 0.033), sub=1)                              # neusje
        box(0.006, 0.004, 0.003, "White", pos=(0, y - 0.017, z + 0.03))                    # tandjes
        eyes(0, y + 0.006, z + 0.008, 0.022, 0.0085, fwd=0.006)
        for s in (-1, 1):                                                                   # snorharen
            beam((s * 0.012, y - 0.008, z + 0.028), (s * 0.034, y - 0.004, z + 0.026), 0.0008, "White")
    part(sp, "head", "head", head)
    def ear():                                                                              # lang oor met roze binnenkant en donker puntje
        x, y, z = -0.012, 0.122, 0.05
        limb((x, y - 0.006, z), (x, y + 0.012, z - 0.003), 0.007, 0.008, "Rab", seg=7)          # oorwortel
        blob(0.04, "Rab", (x, y + 0.036, z - 0.01), scale=(0.3, 1.0, 0.22), sub=2)
        blob(0.012, "RabD", (x, y + 0.07, z - 0.016), scale=(0.75, 1.0, 0.6), sub=1)
        blob(0.033, "Pink", (x, y + 0.035, z - 0.004), scale=(0.2, 0.92, 0.12), sub=1)
    part(sp, "ear", "ear", ear)
    part(sp, "tail1", "tail", lambda: blob(0.016, "White", (0, 0.068, -0.07), scale=(1.0, 0.95, 0.85), sub=1))
    def legF():
        x = -0.022
        leg_seg(x, (x, 0.045, 0.034), (x, 0.022, 0.036), 0.0095, 0.0075, "Rab")
    def shinF():
        x = -0.022
        limb((x, 0.022, 0.036), (x, 0.006, 0.038), 0.0075, 0.0062, "Rab", seg=6)
        blob(0.0065, "RabL", (x, 0.004, 0.043), scale=(1.0, 0.6, 1.4), sub=1)
    def legB():                                                                             # kracht in de dij
        x = -0.022
        blob(0.026, "Rab", (x, 0.046, -0.034), scale=(0.62, 0.95, 1.15), sub=1)
        limb((x, 0.04, -0.03), (x, 0.018, -0.024), 0.01, 0.007, "Rab", seg=6)
    def shinB():                                                                            # lange achtervoet
        x = -0.022
        limb((x, 0.018, -0.024), (x, 0.006, -0.012), 0.0065, 0.0055, "Rab", seg=6)
        blob(0.0075, "RabL", (x, 0.004, 0.0), scale=(0.9, 0.5, 2.4), sub=1)
    part(sp, "legF", "leg", legF); part(sp, "shinF", "shin", shinF)
    part(sp, "legB", "thigh", legB); part(sp, "shinB", "foot", shinB)
    T = lambda a: {"tail1": k(rx=a)}
    clip(sp, "idle", 96, [
        (0.0, stand(merge(E(0.12), {"head": k(), "body": k()}, T(0)))),
        (0.15, merge(E(0.12, rx=-0.1), {"head": k(rx=0.04)})),
        (0.2, {"head": k(rx=0.0)}), (0.24, {"head": k(rx=0.04)}), (0.28, {"head": k(rx=0.0)}),           # neusje trilt
        (0.45, merge(E(0.2, ry=0.4), {"head": k(ry=0.5, rx=-0.05)})),
        (0.55, merge({"earL": k(rz=0.12, rx=0.3)}, {"earR": k(rz=-0.12)})),                              # één oor draait weg
        (0.7, merge(E(0.15), {"head": k(ry=-0.4)})),
        (0.85, merge(E(0.12), {"head": k(rz=0.1)}, T(-0.3))), (0.9, T(0)),
        (1.0, stand(merge(E(0.12), {"head": k(), "body": k()}, T(0)))),
    ])
    # hupjes: achterpoten duwen samen af, voorpoten vangen op, lijf in een boog, oren naar achteren
    def hop(n, lift, reach, ears):
        def frm(fa, fk, ba, bk, dy, rx, er):
            return merge({"legFL": k(rx=fa), "legFR": k(rx=fa), "shinFL": k(rx=fk), "shinFR": k(rx=fk),
                          "legBL": k(rx=ba), "legBR": k(rx=ba), "shinBL": k(rx=bk), "shinBR": k(rx=bk),
                          "body": k(dy=dy, rx=rx), "head": k(rx=-rx * 0.6)}, E(0.1, rx=er), T(-0.2))
        clip(sp, n[0], n[1], [
            (0.0, frm(0.2, 0.3, -0.5, 0.9, 0.0, 0.08, ears)),
            (0.22, frm(-reach, 0.6, reach * 1.1, 0.0, lift, -0.3, ears + 0.2)),
            (0.5, frm(-reach * 0.8, 0.1, reach * 0.6, 0.6, lift * 0.7, 0.05, ears + 0.25)),
            (0.72, frm(0.4, 0.5, -0.9, 1.4, lift * 0.15, 0.25, ears)),
            (1.0, frm(0.2, 0.3, -0.5, 0.9, 0.0, 0.08, ears)),
        ])
    hop(("walk", 16), 0.02, 0.7, 0.25)
    hop(("run", 10), 0.05, 1.1, 0.7)
    clip(sp, "eat", 44, [
        (0.0, stand(merge({"head": k(rx=0.75), "body": k(rx=0.12, dy=-0.004)}, E(0.08, rx=0.4), T(0)))),
        (0.2, {"head": k(rx=0.82)}), (0.25, {"head": k(rx=0.75)}), (0.3, {"head": k(rx=0.82)}),             # knabbelen
        (0.5, merge({"head": k(rx=0.7, ry=0.15)}, {"earL": k(rz=0.08, rx=0.15)})),
        (0.75, merge({"head": k(rx=0.8, ry=-0.1)}, E(0.08, rx=0.4))),
        (1.0, stand(merge({"head": k(rx=0.75), "body": k(rx=0.12, dy=-0.004)}, E(0.08, rx=0.4), T(0)))),
    ])
    # rechtop zitten en rondkijken: oren recht omhoog
    up = lambda h: merge({"body": k(rx=-0.95, dy=0.02), "head": k(rx=0.75 + h.get("rx", 0), ry=h.get("ry", 0)),
                          "legFL": k(rx=0.6), "legFR": k(rx=0.6), "shinFL": k(rx=-0.5), "shinFR": k(rx=-0.5),
                          "legBL": k(rx=-0.95), "legBR": k(rx=-0.95), "shinBL": k(rx=1.0), "shinBR": k(rx=1.0)}, E(0.05, rx=-0.15))
    clip(sp, "alert", 48, [(0.0, up({})), (0.25, up({"ry": 0.6})), (0.35, up({"ry": 0.6, "rx": -0.05})), (0.6, up({"ry": -0.6})), (1.0, up({}))])
    clip(sp, "rest", 60, [(0.0, lying(0.05, merge({"head": k(rx=0.15)}, E(0.1, rx=1.2)), 0.8)), (0.5, {"body": k(dy=-0.03)}),
                          (1.0, lying(0.05, merge({"head": k(rx=0.15)}, E(0.1, rx=1.2)), 0.8))])
    clip(sp, "jump", 24, leap_keys(lambda t: merge(E(0.1, rx=0.6), T(-0.3)), lift=0.06))


# ------------------------------------------------------------------ ree en hert
def cervid(sp, s, mat, light, dark, antlers):
    hb, L = 0.2 * s, 0.26 * s
    zf, zb, lx = 0.09 * s, -0.095 * s, 0.042 * s
    rig4(sp, hb, lx, shoulder=(hb + 0.01 * s, zf), hip=(hb + 0.0 * s, zb), knee=(hb * 0.48, 0.0), hock=(hb * 0.52, -0.012 * s),
         head=(0, hb + 0.15 * s, 0.17 * s), neck=(0, hb + 0.03 * s, 0.085 * s), ear=(0.022 * s, hb + 0.178 * s, 0.16 * s),
         tails=[(0, hb + 0.03 * s, -0.14 * s)])
    def body():
        blob(0.1 * s, mat, (0, hb + 0.01 * s, -0.005 * s), scale=(0.6, 0.66, 1.38), sub=2)       # slank lijf
        blob(0.06 * s, light, (0, hb - 0.035 * s, 0.01 * s), scale=(0.68, 0.5, 1.45), sub=1)     # lichte buik
        blob(0.05 * s, mat, (0, hb + 0.035 * s, 0.08 * s), scale=(0.75, 0.9, 0.9), sub=1)        # schoft
        blob(0.052 * s, mat, (0, hb + 0.02 * s, -0.09 * s), scale=(0.78, 0.85, 0.9), sub=1)      # kruis
        blob(0.04 * s, "White" if sp == "roe" else "DeerL", (0, hb + 0.0 * s, -0.128 * s), scale=(0.9, 0.95, 0.4), sub=1)   # spiegel
    part(sp, "body", "body", body)
    def neck():
        limb((0, hb + 0.02 * s, 0.08 * s), (0, hb + 0.14 * s, 0.155 * s), 0.04 * s, 0.026 * s, mat, seg=9)
        blob(0.026 * s, light, (0, hb + 0.07 * s, 0.135 * s), scale=(0.75, 1.6, 0.55), sub=1)    # lichte keel
        if sp == "deer":
            for i in range(4):                                                                  # manen (edelhert)
                blob(0.022 * s, dark, (0, hb + 0.04 * s + i * 0.025 * s, 0.11 * s + i * 0.012 * s), scale=(1.1, 0.9, 0.9), sub=1)
    part(sp, "neck", "neck", neck)
    def head():
        hy, hz = hb + 0.155 * s, 0.18 * s
        blob(0.04 * s, mat, (0, hy, hz), scale=(0.85, 0.9, 1.05), sub=2)
        limb((0, hy - 0.006 * s, hz + 0.02 * s), (0, hy - 0.014 * s, hz + 0.07 * s), 0.024 * s, 0.015 * s, mat, seg=8)   # snuit
        blob(0.016 * s, light, (0, hy - 0.02 * s, hz + 0.05 * s), scale=(1.0, 0.7, 1.4), sub=1)  # lichte kin
        blob(0.011 * s, "Nose", (0, hy - 0.012 * s, hz + 0.074 * s), scale=(1.1, 0.8, 0.7), sub=1)
        eyes(0, hy + 0.012 * s, hz + 0.012 * s, 0.03 * s, 0.009 * s, fwd=0.004)
        for side in (-1, 1):
            blob(0.006 * s, dark, (side * 0.03 * s, hy + 0.004 * s, hz + 0.012 * s), sub=0)       # traanvlek
    part(sp, "head", "head", head)
    def ear():
        x, y, z = -0.022 * s, hb + 0.178 * s, 0.16 * s
        limb((x, y - 0.006 * s, z), (x, y + 0.008 * s, z - 0.003 * s), 0.008 * s, 0.009 * s, mat, seg=7)
        blob(0.03 * s, mat, (x, y + 0.026 * s, z - 0.008 * s), scale=(0.34, 1.0, 0.62), sub=2)
        blob(0.025 * s, "Pink", (x, y + 0.026 * s, z - 0.001 * s), scale=(0.22, 0.85, 0.42), sub=1)
        blob(0.008 * s, dark, (x, y + 0.054 * s, z - 0.012 * s), scale=(0.6, 0.8, 0.8), sub=0)
    part(sp, "ear", "ear", ear)
    if antlers:
        def antler():
            hy, hz = hb + 0.155 * s, 0.18 * s
            for side in (-1, 1):
                b = (side * 0.015 * s, hy + 0.034 * s, hz - 0.012 * s)
                if sp == "roe":                                                                 # reebok: klein gewei met drie enden
                    m1 = (side * 0.022 * s, hy + 0.085 * s, hz - 0.005 * s); top = (side * 0.026 * s, hy + 0.12 * s, hz - 0.02 * s)
                    limb(b, m1, 0.006 * s, 0.0045 * s, "Antler", seg=5); limb(m1, top, 0.0045 * s, 0.002 * s, "Antler", seg=5)
                    limb(m1, (side * 0.02 * s, hy + 0.1 * s, hz + 0.02 * s), 0.0035 * s, 0.0015 * s, "Antler", seg=5)
                    blob(0.008 * s, "Antler", b, sub=0)                                          # rozenkrans
                    continue
                m1 = (side * 0.05 * s, hy + 0.11 * s, hz - 0.03 * s)
                m2 = (side * 0.07 * s, hy + 0.165 * s, hz - 0.035 * s)
                top = (side * 0.065 * s, hy + 0.215 * s, hz - 0.01 * s)
                limb(b, m1, 0.007 * s, 0.0055 * s, "Antler", seg=6); limb(m1, m2, 0.0055 * s, 0.0045 * s, "Antler", seg=6)
                limb(m2, top, 0.0045 * s, 0.0025 * s, "Antler", seg=5)
                limb((side * 0.025 * s, hy + 0.055 * s, hz - 0.018 * s), (side * 0.03 * s, hy + 0.075 * s, hz + 0.035 * s), 0.0045 * s, 0.002 * s, "Antler", seg=5)
                limb(m1, (side * 0.048 * s, hy + 0.125 * s, hz + 0.03 * s), 0.004 * s, 0.002 * s, "Antler", seg=5)
                limb(m2, (side * 0.095 * s, hy + 0.19 * s, hz - 0.06 * s), 0.0038 * s, 0.002 * s, "Antler", seg=5)
                limb(m2, (side * 0.05 * s, hy + 0.2 * s, hz + 0.02 * s), 0.0035 * s, 0.0018 * s, "Antler", seg=5)
        part(sp, "head", "antlers", antler)
    part(sp, "tail1", "tail", lambda: (blob(0.013 * s, dark if sp == "deer" else light, (0, hb + 0.02 * s, -0.145 * s), scale=(0.8, 1.3, 0.55), sub=1)))
    def legF():
        x = -lx
        blob(0.032 * s, mat, (x, hb - 0.0 * s, zf), scale=(0.6, 1.2, 0.85), sub=1)               # schouder
        leg_seg(x, (x, hb - 0.01 * s, zf), (x, hb * 0.48, zf), 0.013 * s, 0.01 * s, mat)
    def shinF():
        x = -lx
        leg_seg(x, (x, hb * 0.48, zf), (x, 0.016 * s, zf + 0.002 * s), 0.0085 * s, 0.007 * s, light if sp == "roe" else mat)
        hoof(x, 0.0, zf + 0.004 * s, 0.008 * s)
    def legB():
        x = -lx
        blob(0.04 * s, mat, (x, hb - 0.015 * s, zb), scale=(0.6, 1.15, 1.05), sub=1)              # dij
        leg_seg(x, (x, hb - 0.03 * s, zb), (x, hb * 0.52, zb - 0.012 * s), 0.014 * s, 0.01 * s, mat)
    def shinB():
        x = -lx
        leg_seg(x, (x, hb * 0.52, zb - 0.012 * s), (x, 0.016 * s, zb), 0.0085 * s, 0.007 * s, mat)
        hoof(x, 0.0, zb + 0.002 * s, 0.008 * s)
    part(sp, "legF", "leg", legF); part(sp, "shinF", "shin", shinF)
    part(sp, "legB", "thigh", legB); part(sp, "shinB", "shin", shinB)
    NE = lambda n, h, ry=0.0: {"neck": k(rx=n, ry=ry * 0.4), "head": k(rx=h, ry=ry * 0.6)}
    T = lambda a, ry=0.0: {"tail1": k(rx=a, ry=ry)}
    clip(sp, "idle", 120, [
        (0.0, stand(merge(NE(0, 0), E(0.75), T(0)))),
        (0.2, merge(NE(-0.05, 0.02, 0.6), E(0.75, ry=0.3))),
        (0.32, {"earR": k(rz=-0.3, rx=0.4)}), (0.38, {"earR": k(rz=-0.3)}),                     # oorflapje
        (0.5, merge(NE(0.02, 0.0, -0.5), E(0.75))),
        (0.7, merge(NE(0.0, 0.0), T(0, 0.4))), (0.76, T(0, -0.4)), (0.82, T(0, 0.3)), (0.88, T(0)),   # staartje zwaait
        (1.0, stand(merge(NE(0, 0), E(0.75), T(0)))),
    ])
    walk_x = lambda t: merge(NE(0.06 + 0.06 * math.sin(t * 4 * math.pi), 0.0), E(0.75), T(0, 0.15 * math.sin(t * 2 * math.pi)))
    clip(sp, "walk", 26, gait(0.4, 0.9, 0.006 * s, extra=walk_x))
    run_x = lambda t: merge(NE(0.4 + 0.12 * math.sin(t * 2 * math.pi), -0.1), E(0.75, rx=0.5), T(-0.6))
    clip(sp, "run", 14, gait(0.95, 1.7, 0.06 * s, phases={"FL": 0.0, "FR": 0.08, "BL": 0.5, "BR": 0.58}, steps=12, extra=run_x, swing=0.6))
    def graze(extra=None, n=1.95, h=0.35):
        d = stand(merge({"neck": k(rx=n), "head": k(rx=h), "body": k(rx=0.2, dy=-0.012 * s)}, E(0.8, rx=0.1), T(0)), spread=0.15)
        d.update(extra or {})
        return d
    clip(sp, "eat", 72, [(0.0, graze()), (0.2, graze({"head": k(rx=0.45, ry=0.15)}, 2.0)), (0.4, graze(merge({"head": k(rx=0.3, ry=-0.12)}, T(0, 0.4)), 1.9)),
                         (0.5, graze({"earL": k(rz=0.35, rx=0.5)})), (0.6, graze({"head": k(rx=0.42)}, 2.0)),
                         (0.8, graze(merge({"head": k(rx=0.35, ry=0.1)}, T(0, -0.4)), 1.92)), (1.0, graze())])
    al = lambda ry, extra=None: stand(merge(NE(-0.2, -0.1, ry), E(0.55, rx=-0.25), T(-0.8), {"body": k(dy=0.004 * s)}, extra or {}))
    clip(sp, "alert", 60, [(0.0, al(0)), (0.3, al(0.6)), (0.6, al(-0.5, {"head": k(rx=-0.08, ry=-0.3, rz=0.1)})), (1.0, al(0))])
    clip(sp, "rest", 72, [(0.0, lying(hb, merge(NE(0.25, 0.2, 0.4), E(0.75), T(0)))), (0.5, merge({"body": k(dy=-hb * 0.6)}, NE(0.27, 0.22, 0.45))),
                          (1.0, lying(hb, merge(NE(0.25, 0.2, 0.4), E(0.75), T(0))))])
    clip(sp, "jump", 22, leap_keys(lambda t: merge(NE(0.75 - 0.4 * math.sin(t * math.pi), 0.0), E(0.75, rx=0.5), T(-0.9)), lift=0.12 * s))


# ------------------------------------------------------------------ wild zwijn
def boar():
    sp, hb = "boar", 0.11
    lx, zf, zb = 0.042, 0.075, -0.08
    rig4(sp, hb, lx, shoulder=(hb - 0.005, zf), hip=(hb - 0.01, zb), knee=(hb * 0.45, 0.0), hock=(hb * 0.5, -0.008),
         head=(0, hb + 0.005, 0.12), ear=(0.026, hb + 0.045, 0.115), tails=[(0, hb + 0.035, -0.128)])
    def body():
        blob(0.1, "Boar", (0, hb + 0.012, -0.01), scale=(0.7, 0.76, 1.25), sub=2)               # tonvormig lijf
        blob(0.07, "Boar", (0, hb + 0.04, 0.05), scale=(0.75, 0.95, 0.85), sub=1)               # hoge schouders (bult)
        blob(0.075, "BoarL", (0, hb - 0.03, 0.0), scale=(0.72, 0.5, 1.2), sub=1)
        for i in range(9):                                                                      # borstelkam over de rug
            y = hb + 0.088 - abs(i - 3) * 0.006
            cyl(0.0, 0.012, 0.03, 4, "BoarD", pos=(0, y - 0.012, 0.085 - i * 0.022), rot=(-0.4, 0, 0), smooth=False)
    part(sp, "body", "body", body)
    def head():
        y, z = hb + 0.005, 0.12
        blob(0.052, "Boar", (0, y, z), scale=(0.82, 0.88, 1.12), sub=2)
        cyl(0.022, 0.03, 0.06, 10, "BoarL", pos=(0, y - 0.016, z + 0.035), rot=(math.pi / 2 - 0.15, 0, 0))   # lange snuit
        cyl(0.023, 0.023, 0.008, 10, "Snout", pos=(0, y - 0.025, z + 0.094), rot=(math.pi / 2 - 0.15, 0, 0))  # neusschijf
        for s in (-1, 1):
            blob(0.0045, "BoarD", (s * 0.009, y - 0.025, z + 0.1), sub=0)
            limb((s * 0.019, y - 0.03, z + 0.06), (s * 0.03, y - 0.005, z + 0.072), 0.0045, 0.0015, "Tusk", seg=5)   # slagtanden
            blob(0.016, "BoarD", (s * 0.032, y - 0.005, z + 0.005), scale=(0.5, 1.2, 1.0), sub=1)    # bakkebaarden
        eyes(0, y + 0.02, z + 0.025, 0.032, 0.0075, fwd=0.004)
    part(sp, "head", "head", head)
    def ear():
        x, y, z = -0.026, hb + 0.045, 0.115
        cyl(0.0, 0.013, 0.038, 4, "BoarD", pos=(x, y - 0.006, z), rot=(-0.4, 0, 0.2), smooth=False)
    part(sp, "ear", "ear", ear)
    part(sp, "tail1", "tail", lambda: (limb((0, hb + 0.035, -0.128), (0.004, hb - 0.015, -0.142), 0.0035, 0.0022, "BoarD", seg=5),
                                       blob(0.009, "BoarD", (0.005, hb - 0.02, -0.143), scale=(0.8, 1.3, 0.8), sub=0)))
    def legF():
        x = -lx
        blob(0.034, "Boar", (x, hb - 0.012, zf), scale=(0.55, 1.1, 0.85), sub=1)
        leg_seg(x, (x, hb - 0.03, zf), (x, hb * 0.45, zf), 0.014, 0.011, "BoarD")
    def shinF():
        x = -lx
        leg_seg(x, (x, hb * 0.45, zf), (x, 0.014, zf + 0.003), 0.01, 0.008, "BoarD")
        hoof(x, 0.0, zf + 0.004, 0.0095)
    def legB():
        x = -lx
        blob(0.04, "Boar", (x, hb - 0.015, zb), scale=(0.6, 1.1, 1.05), sub=1)
        leg_seg(x, (x, hb - 0.03, zb), (x, hb * 0.5, zb - 0.008), 0.015, 0.011, "BoarD")
    def shinB():
        x = -lx
        leg_seg(x, (x, hb * 0.5, zb - 0.008), (x, 0.014, zb), 0.01, 0.008, "BoarD")
        hoof(x, 0.0, zb + 0.002, 0.0095)
    part(sp, "legF", "leg", legF); part(sp, "shinF", "shin", shinF)
    part(sp, "legB", "thigh", legB); part(sp, "shinB", "shin", shinB)
    T = lambda ry, rx=0.0: {"tail1": k(ry=ry, rx=rx)}
    clip(sp, "idle", 96, [(0.0, stand(merge({"head": k()}, E(0.35), T(0)))), (0.25, merge({"head": k(ry=0.35, rx=0.1)}, T(0.5))), (0.3, T(-0.5)),
                          (0.35, T(0.4)), (0.4, T(0)), (0.55, merge({"head": k(rx=0.15)}, {"earL": k(rz=0.35, rx=0.4)})),
                          (0.75, merge({"head": k(ry=-0.3)}, E(0.35))), (1.0, stand(merge({"head": k()}, E(0.35), T(0))))])
    clip(sp, "walk", 20, gait(0.45, 0.8, 0.005, extra=lambda t: merge({"head": k(rx=0.05 + 0.05 * math.sin(t * 4 * math.pi))}, E(0.35), T(0.4 * math.sin(t * 2 * math.pi)))))
    clip(sp, "run", 12, gait(0.8, 1.3, 0.03, phases={"FL": 0.0, "FR": 0.1, "BL": 0.5, "BR": 0.6}, extra=lambda t: merge({"head": k(rx=0.1)}, E(0.35, rx=0.4), T(0, -0.8)), swing=0.55))
    # wroeten: snuit in de grond, kop schuift heen en weer, voorpoten iets wijd
    root_ = lambda rx, ry, extra=None: stand(merge({"head": k(rx=rx, ry=ry), "body": k(rx=0.1, dy=-0.005)}, E(0.4), extra or {}), spread=0.12)
    clip(sp, "eat", 40, [(0.0, root_(0.55, 0, T(0.4))), (0.2, root_(0.72, 0.25)), (0.4, root_(0.5, -0.2, T(-0.4))), (0.6, root_(0.75, 0.15)),
                         (0.8, root_(0.55, -0.25, T(0.4))), (1.0, root_(0.55, 0, T(0.4)))])
    al = lambda ry: stand(merge({"head": k(rx=-0.2, ry=ry)}, E(0.2, rx=-0.3), T(0, -0.6), {"body": k(dy=0.004)}))
    clip(sp, "alert", 48, [(0.0, al(0)), (0.3, al(0.5)), (0.6, al(-0.45)), (1.0, al(0))])
    clip(sp, "rest", 72, [(0.0, lying(hb, merge({"head": k(rx=0.25, ry=0.3)}, E(0.4, rx=0.5)), 0.85)), (0.5, {"body": k(dy=-hb * 0.6)}),
                          (1.0, lying(hb, merge({"head": k(rx=0.25, ry=0.3)}, E(0.4, rx=0.5)), 0.85))])
    clip(sp, "jump", 20, leap_keys(lambda t: merge(E(0.35, rx=0.4), T(0, -0.6)), lift=0.04))


# ------------------------------------------------------------------ vos
def fox():
    sp, hb = "fox", 0.085
    lx, zf, zb = 0.026, 0.06, -0.06
    rig4(sp, hb, lx, shoulder=(hb - 0.005, zf), hip=(hb - 0.005, zb), knee=(hb * 0.47, 0.0), hock=(hb * 0.48, -0.01),
         head=(0, hb + 0.03, 0.09), ear=(0.018, hb + 0.07, 0.098), tails=[(0, hb + 0.01, -0.085), (0, hb - 0.01, -0.135)])
    def body():
        blob(0.066, "Fox", (0, hb + 0.004, -0.005), scale=(0.6, 0.62, 1.42), sub=2)
        blob(0.04, "White", (0, hb - 0.01, 0.058), scale=(0.72, 0.85, 0.85), sub=1)             # witte borst
        blob(0.038, "Fox", (0, hb + 0.015, 0.05), scale=(0.75, 0.85, 0.8), sub=1)
    part(sp, "body", "body", body)
    def head():
        y, z = hb + 0.045, 0.108
        blob(0.036, "Fox", (0, y, z), scale=(1.05, 0.85, 0.95), sub=2)
        blob(0.022, "White", (0, y - 0.012, z + 0.018), scale=(1.25, 0.6, 0.9), sub=1)         # witte wangen
        cyl(0.004, 0.018, 0.048, 8, "Fox", pos=(0, y - 0.008, z + 0.024), rot=(math.pi / 2, 0, 0))   # spitse snuit
        cyl(0.003, 0.011, 0.04, 8, "White", pos=(0, y - 0.015, z + 0.026), rot=(math.pi / 2, 0, 0))
        blob(0.0065, "Nose", (0, y - 0.008, z + 0.072), sub=1)
        for s in (-1, 1):                                                                       # amberkleurige ogen
            blob(0.0075, "FoxEye", (s * 0.017, y + 0.01, z + 0.024), scale=(1.0, 0.8, 0.6), sub=1)
            blob(0.0035, "Eye", (s * 0.018, y + 0.01, z + 0.029), scale=(0.6, 1.0, 0.5), sub=0)
            blob(0.0018, "Spark", (s * 0.019, y + 0.012, z + 0.031), sub=0)
    part(sp, "head", "head", head)
    def ear():
        x, y, z = -0.018, hb + 0.07, 0.098
        cyl(0.0, 0.016, 0.042, 5, "Fox", pos=(x, y - 0.004, z), smooth=False)
        cyl(0.0, 0.009, 0.026, 5, "Sock", pos=(x, y + 0.017, z), smooth=False)                 # zwarte puntjes
        cyl(0.0, 0.009, 0.028, 5, "White", pos=(x, y - 0.002, z + 0.006), smooth=False)        # licht binnenoor
    part(sp, "ear", "ear", ear)
    def tail1():
        limb((0, hb + 0.01, -0.085), (0, hb - 0.008, -0.135), 0.016, 0.025, "Fox", seg=9)
        blob(0.025, "Fox", (0, hb - 0.008, -0.135), sub=1)
    def tail2():                                                                                # volle staart met witte punt
        limb((0, hb - 0.008, -0.135), (0, hb - 0.03, -0.19), 0.025, 0.018, "FoxD", seg=9)
        limb((0, hb - 0.03, -0.19), (0, hb - 0.04, -0.215), 0.018, 0.004, "White", seg=9)
        blob(0.018, "White", (0, hb - 0.03, -0.19), sub=1)
    part(sp, "tail1", "tail", tail1); part(sp, "tail2", "tail", tail2)
    def legF():
        x = -lx
        leg_seg(x, (x, hb - 0.005, zf), (x, hb * 0.47, zf), 0.01, 0.0075, "Fox")
    def shinF():
        x = -lx
        leg_seg(x, (x, hb * 0.47, zf), (x, 0.008, zf + 0.004), 0.0072, 0.0062, "Sock")
        blob(0.0085, "Sock", (x, 0.006, zf + 0.01), scale=(1.0, 0.65, 1.4), sub=1)
    def legB():
        x = -lx
        blob(0.026, "Fox", (x, hb - 0.012, zb), scale=(0.6, 1.1, 1.05), sub=1)
        leg_seg(x, (x, hb - 0.02, zb), (x, hb * 0.48, zb - 0.01), 0.011, 0.008, "Fox")
    def shinB():
        x = -lx
        leg_seg(x, (x, hb * 0.48, zb - 0.01), (x, 0.008, zb), 0.0072, 0.0062, "Sock")
        blob(0.0085, "Sock", (x, 0.006, zb + 0.008), scale=(1.0, 0.65, 1.4), sub=1)
    part(sp, "legF", "leg", legF); part(sp, "shinF", "shin", shinF)
    part(sp, "legB", "thigh", legB); part(sp, "shinB", "shin", shinB)
    T = lambda a1, a2, r1=0.0, r2=0.0: {"tail1": k(rx=a1, ry=r1), "tail2": k(rx=a2, ry=r2)}
    clip(sp, "idle", 96, [(0.0, stand(merge({"head": k()}, E(0.12), T(0, 0)))),
                          (0.2, merge({"head": k(ry=0.55, rx=-0.05)}, E(0.12, ry=0.3), T(0, 0, 0.25, 0.35))),
                          (0.45, merge({"head": k(rz=0.15, ry=0.2)}, {"earL": k(rz=0.25, rx=0.3)})),                 # kopje scheef, luisteren
                          (0.65, merge({"head": k(ry=-0.4)}, E(0.12), T(0, 0, -0.25, -0.35))),
                          (1.0, stand(merge({"head": k()}, E(0.12), T(0, 0))))])
    clip(sp, "walk", 22, gait(0.45, 1.0, 0.004, pitch=0.04, extra=lambda t: merge({"head": k(rx=0.12)}, E(0.12), T(0.1, 0.1, 0.25 * math.sin(t * 2 * math.pi), 0.3 * math.sin(t * 2 * math.pi - 0.8)))))
    clip(sp, "run", 12, gait(0.95, 1.6, 0.035, phases={"FL": 0.0, "FR": 0.08, "BL": 0.5, "BR": 0.58}, extra=lambda t: merge({"head": k(rx=0.15)}, E(0.12, rx=0.5), T(-0.35, 0.15)), swing=0.6))
    sniff = lambda rx, ry, extra=None: stand(merge({"head": k(rx=rx, ry=ry), "body": k(rx=0.08, dy=-0.005)}, E(0.15, rx=-0.1), extra or {}))
    clip(sp, "eat", 48, [(0.0, sniff(0.85, 0, T(0, 0))), (0.25, sniff(0.95, 0.2, T(0, 0, 0.3, 0.3))), (0.5, sniff(0.8, -0.15)), (0.75, sniff(0.95, 0.05, T(0, 0, -0.3, -0.3))), (1.0, sniff(0.85, 0, T(0, 0)))])
    al = lambda ry: stand(merge({"head": k(rx=-0.25, ry=ry)}, E(0.05, rx=-0.2), T(-0.3, 0.2), {"body": k(dy=0.004)}))
    clip(sp, "alert", 48, [(0.0, al(0)), (0.3, al(0.6)), (0.6, al(-0.5)), (1.0, al(0))])
    # opgerold slapen: staart om het lijf heen
    curl = merge({"head": k(rx=0.35, ry=0.9)}, E(0.2, rx=0.6), T(0.4, 0.3, 1.0, 1.2))
    clip(sp, "rest", 72, [(0.0, lying(hb, curl)), (0.5, {"body": k(dy=-hb * 0.59)}), (1.0, lying(hb, curl))])
    # muizensprong: ineenduiken, hoge boog met de voorpoten vooruit, neus in het gras
    clip(sp, "pounce", 28, [
        (0.0, stand(merge({"body": k(dy=-0.02, rx=0.1), "head": k(rx=0.2)}, E(0.05, rx=-0.2), T(0.2, 0.1)))),
        (0.35, merge({"body": k(dy=0.12, rx=-0.5), "legFL": k(rx=-1.3), "legFR": k(rx=-1.3), "shinFL": k(rx=0.3), "shinFR": k(rx=0.3),
                      "legBL": k(rx=0.9), "legBR": k(rx=0.9), "shinBL": k(rx=0.4), "shinBR": k(rx=0.4), "head": k(rx=0.3)}, T(-0.5, 0.2))),
        (0.6, merge({"body": k(dy=0.06, rx=0.7), "legFL": k(rx=-1.4), "legFR": k(rx=-1.4), "head": k(rx=0.6)}, T(-0.8, 0.3))),
        (0.8, merge({"body": k(dy=-0.01, rx=0.35), "legFL": k(rx=-0.3), "legFR": k(rx=-0.3), "legBL": k(), "legBR": k(), "shinBL": k(), "shinBR": k(), "head": k(rx=0.9)}, T(-0.6, 0.2))),
        (1.0, stand(merge({"body": k(dy=0.0, rx=0.0), "head": k()}, E(0.12), T(0, 0)))),
    ])
    clip(sp, "jump", 22, leap_keys(lambda t: merge(E(0.1, rx=0.4), T(-0.4, 0.1)), lift=0.07))


# ================================================================== eekhoorn
def squirrel():
    """Rode eekhoorn (nieuw): slank lijf met lichte buik, sterke achterpoten (dijen), kleine voorpootjes met
    vingertjes, oortjes met pluimen en een grote, volle staart in een S-boog in drie delen (tail1-3), zodat hij
    vloeiend golft, sleept bij het klimmen en wappert bij een sprong. Rond 1.000 driehoeken.
    Clips: idle, walk (huppen), run (galop), forage (snuffelen/graven), sit (rechtop met nootje), alert,
    rest, climb (kop omhoog tegen de stam), descend (kop omlaag), jump (sprong tussen takken), perch."""
    sp, hb = "squirrel", 0.03
    nodes = {
        "root": (None, (0, 0, 0)),
        "body": ("root", (0, hb, 0)),
        "head": ("body", (0, hb + 0.016, 0.03)),
        "tail1": ("body", (0, hb + 0.004, -0.03)),
        "tail2": ("tail1", (0, hb + 0.03, -0.05)),
        "tail3": ("tail2", (0, hb + 0.06, -0.046)),
        "legFL": ("body", (-0.011, hb - 0.004, 0.019)), "legFR": ("body", (0.011, hb - 0.004, 0.019)),
        "legBL": ("body", (-0.013, hb - 0.002, -0.017)), "legBR": ("body", (0.013, hb - 0.002, -0.017)),
    }
    make_rig(sp, nodes)

    def body():
        blob(0.025, "Sq", (0, hb + 0.003, 0.002), scale=(0.74, 0.8, 1.4), sub=2)            # slank, lang lijf
        blob(0.017, "SqL", (0, hb - 0.004, 0.012), scale=(0.78, 0.7, 1.25), sub=1)           # lichte buik/borst
        blob(0.0135, "Sq", (0, hb + 0.012, 0.024), scale=(0.9, 1.0, 1.1), sub=1)            # nek: kop en lijf vloeien in elkaar
    part(sp, "body", "body", body)

    def head():
        y, z = hb + 0.024, 0.04
        blob(0.0165, "Sq", (0, y, z), scale=(0.95, 0.92, 1.12), sub=2)                      # schedel
        blob(0.0105, "Sq", (0, y - 0.003, z + 0.013), scale=(0.95, 0.85, 1.05), sub=1)      # snuit
        blob(0.008, "SqL", (0, y - 0.008, z + 0.011), scale=(1.15, 0.6, 1.0), sub=0)        # witte wangen/kin
        blob(0.0032, "Nose", (0, y - 0.001, z + 0.0225), sub=0)
        for s in (-1, 1):
            blob(0.0042, "Eye", (s * 0.0098, y + 0.004, z + 0.007), scale=(0.75, 1.0, 1.0), sub=0)
            blob(0.0014, "Spark", (s * 0.0112, y + 0.0058, z + 0.0095), sub=0)
            # oortje met een pluim (eekhoorns hebben pluimpjes op de oren)
            cyl(0.0, 0.0055, 0.016, 5, "Sq", pos=(s * 0.0085, y + 0.011, z - 0.003), rot=(-0.15, 0, s * -0.28), smooth=False)
            blob(0.0032, "SqD", (s * 0.0122, y + 0.027, z - 0.006), scale=(0.8, 1.6, 0.8), sub=0)
    part(sp, "head", "head", head)

    # staart: drie delen, samen een grote S-boog; elk deel twee volle bollen (licht aan de onderkant)
    def tail1():
        limb((0, hb + 0.004, -0.026), (0, hb + 0.022, -0.05), 0.009, 0.0165, "Sq", seg=8)
        blob(0.0165, "Sq", (0, hb + 0.022, -0.05), scale=(0.9, 1.0, 1.0), sub=1)
    def tail2():
        limb((0, hb + 0.022, -0.05), (0, hb + 0.058, -0.054), 0.0168, 0.0195, "Sq", seg=8)
        limb((0, hb + 0.026, -0.058), (0, hb + 0.056, -0.064), 0.011, 0.012, "SqD", seg=6)  # donkerder rugzijde
        blob(0.0195, "Sq", (0, hb + 0.058, -0.054), scale=(0.9, 1.0, 1.0), sub=2)
    def tail3():
        limb((0, hb + 0.058, -0.054), (0, hb + 0.081, -0.03), 0.0195, 0.012, "Sq", seg=8)
        blob(0.0125, "Sq", (0, hb + 0.081, -0.029), scale=(0.9, 0.95, 1.1), sub=1)          # krul naar voren
        blob(0.0062, "SqL", (0, hb + 0.083, -0.018), scale=(0.9, 0.8, 1.0), sub=0)
    part(sp, "tail1", "tail", tail1)
    part(sp, "tail2", "tail", tail2)
    part(sp, "tail3", "tail", tail3)

    def legF():                                  # klein voorpootje met handje
        x, top, z = -0.011, hb - 0.004, 0.019
        limb((x, top, z), (x, 0.012, z + 0.004), 0.0042, 0.003, "Sq", seg=5)
        blob(0.0042, "SqL", (x, 0.004, z + 0.007), scale=(1.0, 0.6, 1.35), sub=0)
    def legB():                                  # sterke dij en lange achtervoet
        x, top, z = -0.013, hb - 0.002, -0.017
        blob(0.0115, "Sq", (x - 0.002, top - 0.004, z + 0.002), scale=(0.7, 1.0, 1.2), sub=1)
        limb((x, top - 0.01, z - 0.002), (x, 0.006, z + 0.002), 0.0048, 0.0034, "Sq", seg=5)
        blob(0.0048, "SqL", (x, 0.004, z + 0.01), scale=(0.85, 0.55, 1.9), sub=0)
    part(sp, "legF", "leg", legF)
    part(sp, "legB", "leg", legB)

    # ---- animaties (staart met faseverschil: tail1 → tail2 → tail3 golft na)
    def T(a, b, c):
        return {"tail1": k(rx=a), "tail2": k(rx=b), "tail3": k(rx=c)}

    def merge(*ds):
        out = {}
        for d in ds:
            out.update(d)
        return out
    clip(sp, "idle", 72, [
        (0.0, merge({"head": k(), "body": k()}, T(0, 0, 0))),
        (0.12, T(-0.25, 0.15, 0.25)), (0.18, T(0.12, -0.2, -0.2)), (0.24, T(-0.25, 0.15, 0.25)), (0.3, T(0, 0, 0)),   # staart trilt
        (0.5, merge({"head": k(ry=0.6, rx=-0.15)}, T(0.05, 0.05, -0.08))),
        (0.7, merge({"head": k(ry=-0.5, rx=-0.1)}, T(-0.05, 0.08, 0.1))),
        (1.0, merge({"head": k(), "body": k()}, T(0, 0, 0))),
    ])
    # huppen: achterpoten samen, voorpoten samen; de staart golft mee
    def bound(n, F, B, lift, tilt):
        return [
            (0.0, merge({"legFL": k(rx=-F), "legFR": k(rx=-F * 0.85), "legBL": k(rx=B * 0.7), "legBR": k(rx=B * 0.6), "body": k(rx=tilt), "head": k(rx=0.12)}, T(-0.55, 0.3, 0.25))),
            (0.3, merge({"legFL": k(rx=F * 0.5), "legFR": k(rx=F * 0.6), "legBL": k(rx=-B), "legBR": k(rx=-B * 0.9), "body": k(rx=-tilt, dy=lift), "head": k(rx=-0.1)}, T(-0.75, 0.15, 0.1))),
            (0.6, merge({"legFL": k(rx=F * 0.8), "legFR": k(rx=F * 0.7), "legBL": k(rx=-B * 0.3), "legBR": k(rx=-B * 0.2), "body": k(dy=lift * 0.5), "head": k()}, T(-0.6, 0.35, 0.3))),
            (1.0, merge({"legFL": k(rx=-F), "legFR": k(rx=-F * 0.85), "legBL": k(rx=B * 0.7), "legBR": k(rx=B * 0.6), "body": k(rx=tilt), "head": k(rx=0.12)}, T(-0.55, 0.3, 0.25))),
        ]
    clip(sp, "walk", 12, bound(0, 0.7, 0.8, 0.01, 0.12))
    clip(sp, "run", 8, bound(0, 1.0, 1.05, 0.018, 0.2))
    # snuffelen en graven: neus in het gras, voorpootjes krabben om beurten
    F0 = merge({"head": k(rx=0.75), "body": k(rx=0.2, dy=-0.004), "legFL": k(rx=-0.3), "legFR": k(rx=0.2)}, T(-0.3, 0.25, 0.3))
    clip(sp, "forage", 30, [
        (0.0, F0),
        (0.25, merge({"head": k(rx=0.85, ry=0.12), "legFL": k(rx=0.25), "legFR": k(rx=-0.35)}, T(-0.25, 0.3, 0.35))),
        (0.5, merge({"head": k(rx=0.7, ry=-0.1), "legFL": k(rx=-0.35), "legFR": k(rx=0.25)}, T(-0.35, 0.2, 0.25))),
        (0.75, merge({"head": k(rx=0.9), "legFL": k(rx=0.2), "legFR": k(rx=-0.3)}, T(-0.3, 0.28, 0.32))),
        (1.0, F0),
    ])
    # rechtop met een nootje (op de achterpoten, staart tegen de rug)
    def up(extra):
        d = merge({"body": k(rx=-1.0, dy=0.012), "head": k(rx=0.85), "legFL": k(rx=-1.65), "legFR": k(rx=-1.65), "legBL": k(rx=-0.95), "legBR": k(rx=-0.95)},
                  T(1.15, 0.25, 0.3))
        d.update(extra)
        return d
    clip(sp, "sit", 36, [(0.0, up({})), (0.25, up({"head": k(rx=0.95), "legFL": k(rx=-1.75), "legFR": k(rx=-1.75)})), (0.5, up({})),
                         (0.75, up({"head": k(rx=0.95, ry=0.12), "legFL": k(rx=-1.75), "legFR": k(rx=-1.75)})), (1.0, up({}))])
    clip(sp, "eat", 36, [(0.0, up({})), (0.5, up({"head": k(rx=0.95)})), (1.0, up({}))])
    clip(sp, "alert", 40, [(0.0, up({"head": k(rx=0.75)})), (0.4, up({"head": k(rx=0.75, ry=0.7)})), (0.8, up({"head": k(rx=0.75, ry=-0.6)})), (1.0, up({"head": k(rx=0.75)}))])
    R0 = merge({"body": k(dy=-0.012), "head": k(rx=0.25, ry=0.3), "legFL": k(rx=1.2), "legFR": k(rx=1.2), "legBL": k(rx=-1.1), "legBR": k(rx=-1.1)},
               {"tail1": k(rx=0.6, ry=0.4), "tail2": k(rx=0.6), "tail3": k(rx=0.4)})
    clip(sp, "rest", 60, [(0.0, R0), (0.5, {"body": k(dy=-0.0105)}), (1.0, R0)])
    # klimmen (kop omhoog): de game draait hem met de buik tegen de stam. Poten wijd (grijpen om de stam),
    # om beurten voor- en achterpaar; de staart sleept laag achter hem aan en golft
    G = 0.45
    clip(sp, "climb", 14, [
        (0.0, merge({"legFL": k(rx=-1.1, rz=G), "legFR": k(rx=-1.0, rz=-G), "legBL": k(rx=0.6, rz=G), "legBR": k(rx=0.5, rz=-G), "body": k(rx=0.1), "head": k(rx=-0.2)}, T(-1.25, 0.25, 0.3))),
        (0.4, merge({"legFL": k(rx=0.4, rz=G), "legFR": k(rx=0.5, rz=-G), "legBL": k(rx=-0.9, rz=G), "legBR": k(rx=-1.0, rz=-G), "body": k(rx=-0.12, dy=0.006), "head": k(rx=-0.05)}, T(-1.15, 0.12, 0.2))),
        (0.7, merge({"legFL": k(rx=0.6, rz=G), "legFR": k(rx=0.6, rz=-G), "legBL": k(rx=-0.2, rz=G), "legBR": k(rx=-0.3, rz=-G), "body": k(dy=0.003)}, T(-1.3, 0.32, 0.38))),
        (1.0, merge({"legFL": k(rx=-1.1, rz=G), "legFR": k(rx=-1.0, rz=-G), "legBL": k(rx=0.6, rz=G), "legBR": k(rx=0.5, rz=-G), "body": k(rx=0.1), "head": k(rx=-0.2)}, T(-1.25, 0.25, 0.3))),
    ])
    # afdalen (kop omlaag): achtervoeten naar achteren gedraaid (houden zich vast boven hem), voorpoten tasten
    # omlaag, kopje omhoog om rond te kijken; de staart wijst omhoog langs de stam
    clip(sp, "descend", 18, [
        (0.0, merge({"legFL": k(rx=-0.9, rz=G), "legFR": k(rx=-0.6, rz=-G), "legBL": k(rx=1.35, rz=G), "legBR": k(rx=1.2, rz=-G), "body": k(rx=0.05), "head": k(rx=-0.45)}, T(-1.2, 0.2, 0.3))),
        (0.5, merge({"legFL": k(rx=-0.6, rz=G), "legFR": k(rx=-0.95, rz=-G), "legBL": k(rx=1.2, rz=G), "legBR": k(rx=1.4, rz=-G), "body": k(rx=0.0, dy=0.003), "head": k(rx=-0.35, ry=0.2)}, T(-1.1, 0.1, 0.18))),
        (1.0, merge({"legFL": k(rx=-0.9, rz=G), "legFR": k(rx=-0.6, rz=-G), "legBL": k(rx=1.35, rz=G), "legBR": k(rx=1.2, rz=-G), "body": k(rx=0.05), "head": k(rx=-0.45)}, T(-1.2, 0.2, 0.3))),
    ])
    # sprong (niet herhalend, 0 → 1 = afzet → vlucht → landing): gestrekt, staart als roer recht naar achteren
    clip(sp, "jump", 24, [
        (0.0, merge({"body": k(dy=-0.006, rx=0.15), "legFL": k(rx=-0.4), "legFR": k(rx=-0.4), "legBL": k(rx=0.8), "legBR": k(rx=0.8), "head": k(rx=0.15)}, T(-0.5, 0.25, 0.2))),
        (0.2, merge({"body": k(rx=-0.3), "legFL": k(rx=-1.4), "legFR": k(rx=-1.4), "legBL": k(rx=1.3), "legBR": k(rx=1.3), "head": k(rx=-0.15)}, T(-1.35, 0.1, 0.05))),
        (0.7, merge({"body": k(rx=0.15), "legFL": k(rx=-1.3), "legFR": k(rx=-1.25), "legBL": k(rx=0.9), "legBR": k(rx=0.95), "head": k(rx=0.05)}, T(-1.2, 0.15, 0.15))),
        (1.0, merge({"body": k(dy=-0.004, rx=0.2), "legFL": k(rx=-0.3), "legFR": k(rx=-0.3), "legBL": k(rx=0.5), "legBR": k(rx=0.5), "head": k(rx=0.1)}, T(-0.6, 0.2, 0.15))),
    ])
    # op een tak zitten: ineengedoken, staart als een vraagteken over de rug, af en toe rondkijken
    P0 = merge({"body": k(dy=-0.006, rx=-0.12), "head": k(rx=-0.05), "legFL": k(rx=0.5), "legFR": k(rx=0.5), "legBL": k(rx=-0.6), "legBR": k(rx=-0.6)}, T(0.2, 0.3, 0.45))
    clip(sp, "perch", 80, [
        (0.0, P0),
        (0.3, merge({"head": k(ry=0.55, rx=-0.1)}, T(0.25, 0.25, 0.5))),
        (0.45, T(0.1, 0.4, 0.3)), (0.5, T(0.3, 0.2, 0.55)), (0.55, T(0.12, 0.38, 0.35)),
        (0.75, merge({"head": k(ry=-0.5, rx=-0.05)}, T(0.2, 0.3, 0.45))),
        (1.0, P0),
    ])


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
cervid("roe", 0.85, "Roe", "RoeL", "RoeD", antlers=True)
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
    mult = 2 if any(f"__{p_}__" in n_ for p_ in ("legF", "legB", "shinF", "shinB", "ear")) else 1
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
