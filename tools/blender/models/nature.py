"""Village Empire — natuur: bomen, struiken, gras, bloemen, details en easter eggs in één GLB.

Elke node is één samengevoegde mesh met de oorsprong op de grond in het midden (game-assen,
1 eenheid = 1 tegel). De game maakt van elke node één InstancedMesh voor alle exemplaren, dus
het aantal draw calls hangt af van het aantal soorten, niet van het aantal planten.

Materiaalnamen bepalen in de game ook de wind (zie js/nature-glb.js):
  Leaf*/Needle*/Blossom*/Fruit*/Grass*/Seed*/Fl*/Petal*/Berry*  bewegen mee met de wind,
  Twig* een beetje, al het andere (stam, steen, hout) staat stil.
Grassoorten gebruiken lichte 'Grass*'-tinten: de game kleurt ze per exemplaar (natuurlijke groentinten).

Bouwen: npm run models -- nature
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
from ve_parts import rnd, LEVEL, MATS, M3  # noqa: E402

args = ve.parse_args()
ve.reset_scene()
setup(seed=9301, extra_palette={
    # schors
    "BarkOak": (0x6B4A2E, 0.08), "BarkOakD": (0x55391F, 0.06), "BarkBeech": (0x8E8C86, 0.05),
    "BarkBirch": (0xEFEBE0, 0.03), "BarkBirchD": (0x2E2A26, 0.0), "BarkPine": (0x8A5434, 0.07),
    "BarkPineU": (0xB06A3E, 0.06), "BarkSpruce": (0x5A4030, 0.06), "BarkFruit": (0x6E5040, 0.07),
    "MossB": (0x6E8A3A, 0.03), "TwigOak": (0x5E4128, 0.06),
    # loof
    "LeafOakA": (0x4E8F32, 0.03), "LeafOakB": (0x5FA23A, 0.03), "LeafOakC": (0x3F7D2B, 0.03),
    "LeafBeechA": (0x6CAA3C, 0.03), "LeafBeechB": (0x83BC48, 0.03),
    "LeafBirchA": (0x9CC856, 0.03), "LeafBirchB": (0xB4D56A, 0.03),
    "LeafFruitA": (0x5C9E3A, 0.03), "LeafFruitB": (0x72B044, 0.03),
    "LeafOldA": (0x47852F, 0.03), "LeafOldB": (0x5A963A, 0.03),
    "LeafYoung": (0x84C04C, 0.03),
    "NeedlePine": (0x2F6B45, 0.03), "NeedlePineL": (0x3D7D50, 0.03),
    "NeedleSpruceA": (0x285E40, 0.03), "NeedleSpruceB": (0x316C48, 0.03), "NeedleSpruceL": (0x3E7C52, 0.03),
    "FruitApple": (0xD23A2A, 0.06), "FruitAppleY": (0xE8B23A, 0.05), "FruitPear": (0xC9C44A, 0.05),
    "BlossomP": (0xF7B6CC, 0.03), "BlossomW": (0xFBEFF3, 0.03),
    # struiken
    "LeafBushA": (0x4C8E33, 0.03), "LeafBushB": (0x5E9F3B, 0.03), "LeafBushD": (0x3A7429, 0.03),
    "LeafHedge": (0x3F7E2E, 0.03), "BerryR": (0xC8283A, 0.04), "BerryB": (0x3B3F8A, 0.04),
    "FlBushP": (0xE97FA8, 0.03), "FlBushW": (0xFFF6F0, 0.03),
    # gras (licht: de game tint per exemplaar)
    "GrassT": (0xF2F7E8, 0.03), "GrassTL": (0xFFFFF4, 0.03), "SeedHead": (0xF3E6C0, 0.05),
    "GrassWeed": (0xE6F0D6, 0.03),
    # bloemen
    "FlStem": (0x4F8A2E, 0.06), "PetalW": (0xFBF8F0, 0.02), "PetalYc": (0xF4C430, 0.02),
    "PetalRed": (0xE0362E, 0.03), "PetalDark": (0x2A1E1E, 0.0), "PetalYel": (0xFFD23E, 0.03),
    "PetalPurp": (0x9A6AD0, 0.05), "PetalBlue": (0x4F86D8, 0.04), "PetalPink": (0xF49AC0, 0.04),
    # details
    "RockA": (0xA39E94, 0.08), "RockB": (0x8D887F, 0.08), "RockL": (0xC2BDB2, 0.06), "MossR": (0x6F9A3C, 0.03),
    "StumpTop": (0xD9B482, 0.05), "StumpRing": (0xB08A5C, 0.03), "ShroomRed": (0xD8382E, 0.04),
    "ShroomDot": (0xFFF8EC, 0.0), "ShroomStem": (0xF2E8D2, 0.03), "ShroomBrown": (0xB27A48, 0.05),
    "LeafFallO": (0xD9822E, 0.03), "LeafFallY": (0xE0B23A, 0.03), "LeafFallB": (0x9A5A2A, 0.03),
    "Root": (0x6E4C30, 0.07),
    # easter eggs
    "EggEye": (0xFFFFFF, 0.0), "EggPupil": (0x1E1A18, 0.0), "EggDoor": (0x9A5A2E, 0.04), "EggKnob": (0xE8B73A, 0.0),
    "EggWin": (0xFFD27A, 0.0), "EggHouse": (0xC85A3A, 0.04), "EggRoof": (0x3F6FA0, 0.04), "EggLogo": (0xD8402F, 0.0),
    "EggCheek": (0xF28A8A, 0.0),
})

NODES = []           # (naam, object)
TAU = 2 * math.pi


# ------------------------------------------------------------------ bouwstenen
# Klimdata voor eekhoorns (public/models/nature-climb.json): per boomsoort de echte stamlijn (punten + straal)
# en de beloopbare takken, rechtstreeks uit de vormen hieronder (chain/limb). De game legt de eekhoorn daar
# precies tegenaan, dus nooit door de schors heen.
CLIMB = {}
CUR = [None]


def climb_rec(kind, *data):
    c = CUR[0]
    if c is None:
        return
    r = lambda v: round(v, 4)
    if kind == "trunk":
        pts, radii = data
        if not c["trunk"]:
            c["trunk"] = [[r(p[0]), r(p[1]), r(p[2]), r(rr)] for p, rr in zip(pts, radii)]
    elif kind == "limb":
        p0, p1, r0, r1, mat = data
        if not mat.startswith(("Bark", "Twig")):
            return
        if p0[1] <= 0.0 and not c["trunk"]:                 # rechte stam vanaf de grond (beuk, spar, jonge boom)
            c["trunk"] = [[r(p0[0]), r(p0[1]), r(p0[2]), r(r0)], [r(p1[0]), r(p1[1]), r(p1[2]), r(r1)]]
            return
        dx, dy, dz = p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]
        hor = math.hypot(dx, dz)
        # beloopbare tak: dik genoeg, niet te steil en lang genoeg (geen stamverlengstuk of twijgje)
        if p0[1] > 0.1 and r0 >= 0.012 and hor >= 0.06 and dy <= hor * 2.0:
            c["br"].append([r(p0[0]), r(p0[1]), r(p0[2]), r(p1[0]), r(p1[1]), r(p1[2]), r(r0), r(r1)])


def node(name, fn, seed):
    """Bouwt één asset en voegt de delen samen tot node `name` (oorsprong = grond, midden)."""
    LEVEL.clear()
    rnd.seed(seed)
    CUR[0] = CLIMB.setdefault(name, {"trunk": [], "br": []}) if name.startswith("tree_") else None
    fn()
    CUR[0] = None
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
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.0001)
    bm.to_mesh(obj.data)
    bm.free()
    obj.name = obj.data.name = name
    LEVEL.clear()
    NODES.append((name, obj))
    return obj


def limb(p0, p1, r0, r1, mat, seg=6, cap=True, smooth=True, collar=True):
    """Taps toelopende tak/stam tussen twee game-punten (normalen naar buiten).
    Naadloos: de voet begint een stukje binnen de stam of tak waar hij uit groeit, en takken boven de grond
    krijgen een kleine kraag (verdikking) op het aanhechtpunt, zodat er nooit een kier of zwevende tak is."""
    climb_rec("limb", tuple(p0), tuple(p1), r0, r1, mat)
    p0, p1 = Vector(p0), Vector(p1)
    ax = (p1 - p0).normalized()
    if collar and p0.y > 0.03 and r0 >= 0.008 and mat.startswith(("Bark", "Twig", "Root")):
        blob(r0 * 1.25, mat, tuple(p0), sub=1, smooth=True)
    p0 = p0 - ax * (r0 * 0.9)                      # voet in de ouder laten beginnen
    ref = Vector((0, 0, 1)) if abs(ax.z) < 0.9 else Vector((1, 0, 0))
    u = ax.cross(ref).normalized()
    v = ax.cross(u)
    bm = bmesh.new()
    bot, top = [], []
    for i in range(seg):
        a = TAU * i / seg
        d = u * math.cos(a) + v * math.sin(a)
        bot.append(gverts(bm, [tuple(p0 + d * r0)])[0])
        top.append(gverts(bm, [tuple(p1 + d * r1)])[0])
    sides = [bm.faces.new((bot[i], bot[(i + 1) % seg], top[(i + 1) % seg], top[i])) for i in range(seg)]
    caps = [bm.faces.new(top)] if cap and r1 > 0.002 else []
    bm.normal_update()
    P0, AX = M3 @ p0, M3 @ ax
    for f in sides:
        c = f.calc_center_median()
        proj = P0 + AX * (c - P0).dot(AX)
        if f.normal.dot(c - proj) < 0:
            f.normal_flip()
    for f in caps:
        if f.normal.dot(AX) < 0:
            f.normal_flip()
    return new_obj("limb", bm, mat, smooth)


def chain(pts, radii, mat, seg=6):
    """Kromme stam als één doorlopende buis: bij elke knik staat de ring schuin (gemiddelde richting van
    beide stukken, met verbrede 'verstek'-straal), dus geen wigvormige kieren tussen de stukken.
    Onderaan open (zit in de grond), bovenaan dicht."""
    climb_rec("trunk", [tuple(p) for p in pts], list(radii))
    P = [Vector(p) for p in pts]
    n = len(P)
    tang = []
    for i in range(n):
        a = (P[i] - P[i - 1]).normalized() if i > 0 else None
        b = (P[i + 1] - P[i]).normalized() if i < n - 1 else None
        tang.append(((a + b) / 2).normalized() if a and b else (a or b))
    ref = Vector((1, 0, 0)) if abs(tang[0].x) < 0.9 else Vector((0, 0, 1))
    bm = bmesh.new()
    rings = []
    for i in range(n):
        t = tang[i]
        u = (ref - t * ref.dot(t)).normalized()
        v = t.cross(u)
        r = radii[i]
        if 0 < i < n - 1:                           # verstek: de schuine ring iets breder (max. 1,3x)
            a = (P[i] - P[i - 1]).normalized()
            r = r / max(0.77, a.dot(t))
        ring = []
        for k in range(seg):
            ang = TAU * k / seg
            d = u * math.cos(ang) + v * math.sin(ang)
            ring.append(gverts(bm, [tuple(P[i] + d * r)])[0])
        rings.append(ring)
    sides = []
    for i in range(n - 1):
        for k in range(seg):
            sides.append((bm.faces.new((rings[i][k], rings[i][(k + 1) % seg], rings[i + 1][(k + 1) % seg], rings[i + 1][k])), i))
    cap = bm.faces.new(rings[-1])
    bm.normal_update()
    for f, i in sides:
        c = f.calc_center_median()
        mid = M3 @ ((P[i] + P[i + 1]) / 2)
        axis = M3 @ (P[i + 1] - P[i]).normalized()
        proj = mid + axis * (c - mid).dot(axis)
        if f.normal.dot(c - proj) < 0:
            f.normal_flip()
    if cap.normal.dot(M3 @ tang[-1]) < 0:
        cap.normal_flip()
    return new_obj("trunk", bm, mat, True)


def foliage(r, mat, pos, scale=(1, 1, 1), sub=2, jit=0.16, flat=0.0):
    """Organisch bladvolume: icosfeer met deterministische deukjes; `flat` maakt de onderkant vlakker."""
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=sub, radius=1.0)
    for vt in bm.verts:
        g = Vector((vt.co.x, vt.co.z, -vt.co.y))
        n = 1.0 + rnd.uniform(-jit, jit) * 0.6
        if flat and g.y < 0:
            g.y *= (1.0 - flat)
        vt.co = M3 @ Vector((g.x * r * scale[0] * n, g.y * r * scale[1] * n, g.z * r * scale[2] * n))
    return place(new_obj("leaf", bm, mat, True), pos)


def surface_points(c, R, n, ymin=-0.2, sc=(1, 1, 1)):
    """n punten verdeeld over het oppervlak van een bladvolume (voor vruchten, bloesem, bessen)."""
    out = []
    for i in range(n):
        y = ymin + (1 - ymin) * (i + 0.5) / n
        a = i * 2.39996 + rnd.uniform(-0.3, 0.3)
        rr = math.sqrt(max(0.0, 1 - y * y))
        out.append((c[0] + math.cos(a) * rr * R * sc[0], c[1] + y * R * sc[1], c[2] + math.sin(a) * rr * R * sc[2]))
    return out


def tier(y, r, h, mat, n=9, droop=0.035, tips=0.78):
    """Eén laag van een naaldboom: kegel met getande, iets hangende takpunten en een holle onderkant."""
    bm = bmesh.new()
    apex = gverts(bm, [(0, y + h, 0)])[0]
    under = gverts(bm, [(0, y + h * 0.28, 0)])[0]
    ring = []
    off = rnd.uniform(0, TAU)
    for i in range(n * 2):
        a = off + TAU * i / (n * 2)
        rr = r * (1.0 if i % 2 == 0 else tips) * rnd.uniform(0.94, 1.06)
        yy = y - (droop if i % 2 == 0 else 0.0)
        ring.append(gverts(bm, [(math.cos(a) * rr, yy, math.sin(a) * rr)])[0])
    m = len(ring)
    for i in range(m):
        bm.faces.new((ring[i], ring[(i + 1) % m], apex))
        bm.faces.new((ring[(i + 1) % m], ring[i], under))
    bm.normal_update()
    up = M3 @ Vector((0, 1, 0))
    for f in bm.faces:
        c = f.calc_center_median()
        if apex in f.verts:
            out = c - (M3 @ Vector((0, y + h * 0.4, 0)))
            if f.normal.dot(out) < 0:
                f.normal_flip()
        elif f.normal.dot(up) > 0:
            f.normal_flip()
    return new_obj("tier", bm, mat, False)


def roots(r, n, mat, y=0.0, reach=0.12, th=0.022):
    """Wortelaanzetten rond de stamvoet."""
    off = rnd.uniform(0, TAU)
    for i in range(n):
        a = off + TAU * i / n + rnd.uniform(-0.3, 0.3)
        c, s = math.cos(a), math.sin(a)
        limb((c * r * 0.5, y + 0.045, s * r * 0.5), (c * (r + reach), y - 0.015, s * (r + reach)), th, th * 0.45, mat, seg=5)


def blade(x, z, h, lean, a, mat, w=0.009, seg2=False):
    """Grasspriet: driezijdige punt, licht gebogen (seg2 = twee stukken voor lange, buigende sprieten)."""
    dx, dz = math.cos(a), math.sin(a)
    if not seg2:
        top = (x + dx * h * lean, h, z + dz * h * lean)
        limb((x, -0.004, z), top, w, 0.0, mat, seg=3, cap=False, smooth=False)
        return
    mid = (x + dx * h * lean * 0.35, h * 0.55, z + dz * h * lean * 0.35)
    top = (x + dx * h * lean * 1.2, h * 0.92, z + dz * h * lean * 1.2)
    limb((x, -0.004, z), mid, w, w * 0.6, mat, seg=3, cap=False, smooth=False)
    limb(mid, top, w * 0.6, 0.0, mat, seg=3, cap=False, smooth=False)


def flat_leaf(x, y, z, l, w, a, mat, tilt=0.25):
    """Plat blaadje (ruit, 2 driehoeken, bovenkant zichtbaar); tilt > 0 = punt omhoog."""
    bm = bmesh.new()
    ca, sa = math.cos(a), math.sin(a)
    tip_y = y + math.sin(tilt) * l
    pts = [(x, y, z), (x + ca * l * 0.45 - sa * w / 2, y + (tip_y - y) * 0.45, z + sa * l * 0.45 + ca * w / 2),
           (x + ca * l, tip_y, z + sa * l), (x + ca * l * 0.45 + sa * w / 2, y + (tip_y - y) * 0.45, z + sa * l * 0.45 - ca * w / 2)]
    v = gverts(bm, pts)
    f1 = bm.faces.new((v[0], v[1], v[2])); f2 = bm.faces.new((v[0], v[2], v[3]))
    bm.normal_update()
    up = M3 @ Vector((0, 1, 0))
    for f in (f1, f2):
        if f.normal.dot(up) < 0:
            f.normal_flip()
    return new_obj("leaf", bm, mat, False)


def star(c, r_out, r_in, n, mat, cup=0.0, rot=0.0):
    """Bloemkroon als platte ster (2n driehoeken, naar boven); cup > 0 = puntjes iets omhoog."""
    bm = bmesh.new()
    mid = gverts(bm, [c])[0]
    ring = []
    for i in range(n * 2):
        a = rot + TAU * i / (n * 2)
        r = r_out if i % 2 == 0 else r_in
        ring.append(gverts(bm, [(c[0] + math.cos(a) * r, c[1] + (cup if i % 2 == 0 else cup * 0.3), c[2] + math.sin(a) * r)])[0])
    up = M3 @ Vector((0, 1, 0))
    for i in range(len(ring)):
        f = bm.faces.new((mid, ring[i], ring[(i + 1) % len(ring)]))
    bm.normal_update()
    for f in bm.faces:
        if f.normal.dot(up) < 0:
            f.normal_flip()
    return new_obj("star", bm, mat, False)


# ------------------------------------------------------------------ BOMEN (oorsprong = stamvoet)
def oak():
    chain([(0, -0.02, 0), (0.01, 0.2, 0.0), (0.035, 0.38, 0.01), (0.02, 0.5, 0.0)], [0.075, 0.058, 0.046, 0.036], "BarkOak", seg=7)
    roots(0.07, 4, "BarkOak")
    limb((0.03, 0.36, 0.0), (0.2, 0.55, 0.05), 0.03, 0.012, "TwigOak", seg=5)
    limb((0.02, 0.42, 0.0), (-0.16, 0.6, -0.06), 0.026, 0.01, "TwigOak", seg=5)
    limb((0.02, 0.45, 0.0), (0.0, 0.62, 0.18), 0.022, 0.008, "TwigOak", seg=5)
    blobs = [((0.0, 0.7, 0.0), 0.27, "LeafOakA"), ((0.2, 0.62, 0.06), 0.2, "LeafOakB"),
             ((-0.18, 0.66, -0.06), 0.21, "LeafOakA"), ((0.02, 0.86, -0.07), 0.19, "LeafOakB"),
             ((-0.05, 0.62, 0.19), 0.18, "LeafOakC"), ((0.1, 0.78, 0.14), 0.16, "LeafOakB"),
             ((0.08, 0.6, -0.2), 0.16, "LeafOakC"), ((-0.15, 0.82, 0.08), 0.14, "LeafOakB")]
    for c, r, m in blobs:
        foliage(r, m, c, scale=(1.0, 0.86, 1.0), flat=0.25)


def oak_old():
    # dikke, kromme stam met knoest, holte en mos; scheve, brede kroon met een open plek
    chain([(0, -0.02, 0), (0.03, 0.14, 0.01), (-0.02, 0.28, 0.03), (0.03, 0.42, -0.01), (0.07, 0.5, 0.0)],
          [0.11, 0.085, 0.07, 0.058, 0.045], "BarkOakD", seg=8)
    roots(0.1, 6, "Root", reach=0.17, th=0.03)
    blob(0.035, "BarkOakD", (0.06, 0.22, 0.06), sub=1)                         # knoest
    box(0.04, 0.06, 0.012, "EggPupil", pos=(-0.03, 0.15, 0.085), rot=(0, 0.3, 0))  # holte
    blob(0.05, "MossB", (-0.05, 0.08, -0.07), scale=(1.3, 0.6, 1.0), sub=1)
    limb((0.0, 0.3, 0.02), (-0.27, 0.5, 0.08), 0.045, 0.016, "BarkOakD", seg=6)
    limb((-0.2, 0.46, 0.06), (-0.33, 0.48, 0.1), 0.018, 0.006, "TwigOak", seg=4)
    limb((0.05, 0.45, 0.0), (0.28, 0.66, -0.1), 0.04, 0.014, "BarkOakD", seg=6)
    limb((0.04, 0.46, 0.0), (0.05, 0.7, 0.22), 0.03, 0.01, "TwigOak", seg=5)
    blobs = [((-0.28, 0.58, 0.08), 0.2, "LeafOldA"), ((-0.12, 0.72, 0.0), 0.24, "LeafOldB"),
             ((0.12, 0.78, -0.08), 0.25, "LeafOldA"), ((0.3, 0.7, -0.12), 0.19, "LeafOldB"),
             ((0.06, 0.74, 0.22), 0.19, "LeafOldA"), ((-0.1, 0.9, -0.12), 0.17, "LeafOldB"),
             ((0.22, 0.92, 0.06), 0.15, "LeafOldA"), ((-0.32, 0.72, -0.12), 0.14, "LeafOldB")]
    for c, r, m in blobs:
        foliage(r, m, c, scale=(1.05, 0.78, 1.0), flat=0.35, jit=0.2)


def beech():
    limb((0, -0.02, 0), (0, 0.5, 0), 0.06, 0.04, "BarkBeech", seg=7, cap=False)
    roots(0.055, 4, "BarkBeech", reach=0.08, th=0.02)
    limb((0, 0.42, 0), (0.12, 0.62, 0.03), 0.025, 0.01, "BarkBeech", seg=5)
    limb((0, 0.46, 0), (-0.1, 0.66, -0.04), 0.022, 0.01, "BarkBeech", seg=5)
    foliage(0.3, "LeafBeechA", (0, 0.76, 0), scale=(1.0, 0.92, 1.0), sub=2, jit=0.07, flat=0.3)
    for i in range(6):
        a = i * TAU / 6 + 0.3
        foliage(0.13, "LeafBeechB" if i % 2 else "LeafBeechA", (math.cos(a) * 0.24, 0.72 + (i % 3) * 0.06, math.sin(a) * 0.24), jit=0.1)
    foliage(0.14, "LeafBeechB", (0.02, 1.0, 0.0), jit=0.1)


def beech_logo():
    beech()
    # easter egg: een in de schors gekerfd Brakeco-embleem (rond, rood, met een 'B')
    z = 0.052
    cyl(0.028, 0.028, 0.006, 12, "BarkOakD", pos=(0, 0.3, z), rot=(math.pi / 2, 0, 0), smooth=False)
    cyl(0.021, 0.021, 0.006, 12, "EggLogo", pos=(0, 0.3, z + 0.003), rot=(math.pi / 2, 0, 0), smooth=False)
    box(0.005, 0.026, 0.004, "EggEye", pos=(-0.006, 0.287, z + 0.008))
    for yy in (0.287, 0.299, 0.311):
        box(0.011, 0.004, 0.004, "EggEye", pos=(0.0, yy, z + 0.008))
    box(0.004, 0.009, 0.004, "EggEye", pos=(0.006, 0.29, z + 0.008))
    box(0.004, 0.009, 0.004, "EggEye", pos=(0.006, 0.302, z + 0.008))


def birch():
    pts = [(0, -0.02, 0), (0.01, 0.3, 0.0), (0.04, 0.6, 0.01), (0.05, 0.8, 0.0)]
    chain(pts, [0.04, 0.034, 0.026, 0.016], "BarkBirch", seg=6)
    for i in range(7):                                          # zwarte vlekken op de witte stam
        t = 0.05 + i * 0.1
        a = i * 2.1
        x = 0.01 + t * 0.05
        rr = 0.036 - t * 0.012
        box(0.022, 0.012, 0.006, "BarkBirchD", pos=(x + math.cos(a) * rr, t, math.sin(a) * rr), rot=(0, -a + math.pi / 2, 0.15))
    limb((0.03, 0.5, 0.0), (0.15, 0.66, 0.04), 0.012, 0.004, "TwigOak", seg=4)
    limb((0.03, 0.58, 0.0), (-0.1, 0.72, -0.03), 0.01, 0.004, "TwigOak", seg=4)
    blobs = [((0.05, 0.82, 0.0), 0.16), ((0.14, 0.68, 0.05), 0.12), ((-0.07, 0.72, -0.04), 0.12),
             ((0.02, 0.98, -0.02), 0.11), ((0.08, 0.6, -0.08), 0.09), ((-0.04, 0.6, 0.08), 0.09),
             ((0.12, 0.9, 0.08), 0.09)]
    for i, (c, r) in enumerate(blobs):
        foliage(r, "LeafBirchA" if i % 2 == 0 else "LeafBirchB", c, scale=(1.0, 1.25, 1.0), jit=0.2)


def young():
    limb((0, -0.01, 0), (0.01, 0.3, 0), 0.022, 0.012, "BarkFruit", seg=5)
    limb((0.01, 0.22, 0), (0.08, 0.32, 0.02), 0.008, 0.003, "TwigOak", seg=4)
    foliage(0.12, "LeafYoung", (0.0, 0.38, 0.0), scale=(1, 0.95, 1), jit=0.18)
    foliage(0.08, "LeafOakB", (0.07, 0.32, 0.03), jit=0.2)
    foliage(0.07, "LeafYoung", (-0.05, 0.46, -0.02), jit=0.2)
    grass_ring(0.06, 4)


def grass_ring(r, n):
    for i in range(n):
        a = i * TAU / n + 0.4
        blade(math.cos(a) * r, math.sin(a) * r, 0.05, 0.4, a, "LeafYoung", w=0.006)


def pine():
    # grove den: lange kale stam (boven oranje), platte, gelaagde naaldpluimen
    chain([(0, -0.02, 0), (0.0, 0.4, 0.0), (0.03, 0.75, 0.01), (0.02, 1.0, 0.0)], [0.05, 0.04, 0.03, 0.016], "BarkPine", seg=6)
    limb((0.02, 0.6, 0.0), (0.03, 0.95, 0.0), 0.028, 0.014, "BarkPineU", seg=6, cap=False)
    roots(0.045, 3, "BarkPine", reach=0.07, th=0.016)
    pads = [((0.0, 1.02, 0.0), 0.18, 0.42), ((0.15, 0.86, 0.05), 0.15, 0.4), ((-0.13, 0.8, -0.06), 0.15, 0.4),
            ((0.03, 0.72, 0.15), 0.13, 0.42), ((0.05, 0.92, -0.14), 0.13, 0.42), ((-0.07, 0.96, 0.1), 0.11, 0.45)]
    for i, (c, r, sy) in enumerate(pads):
        limb((0.02, c[1] - 0.06, 0.0), (c[0] * 0.8, c[1] - 0.02, c[2] * 0.8), 0.014, 0.006, "BarkPineU", seg=4)
        foliage(r, "NeedlePine" if i % 2 == 0 else "NeedlePineL", c, scale=(1.15, sy, 1.15), jit=0.18, flat=0.2)


def spruce():
    # fijnspar: volle, puntige kegel van hangende lagen
    limb((0, -0.02, 0), (0, 0.32, 0), 0.05, 0.03, "BarkSpruce", seg=6, cap=False)
    mats = ("NeedleSpruceA", "NeedleSpruceB", "NeedleSpruceA", "NeedleSpruceL", "NeedleSpruceB", "NeedleSpruceL")
    layers = [(0.12, 0.36, 0.3), (0.3, 0.31, 0.27), (0.47, 0.26, 0.25), (0.63, 0.21, 0.23), (0.78, 0.15, 0.21), (0.92, 0.09, 0.22)]
    for i, (y, r, h) in enumerate(layers):
        tier(y, r, h, mats[i], n=9 if i < 3 else 7, droop=0.04 - i * 0.005)
    limb((0, 1.08, 0), (0.0, 1.2, 0.0), 0.012, 0.0, "NeedleSpruceL", seg=4, cap=False)


def fruit_tree(fruit, leaves, n_fruit, crown_sy=0.95, pear=False):
    chain([(0, -0.02, 0), (0.01, 0.18, 0.0), (0.03, 0.3, 0.01)], [0.05, 0.04, 0.032], "BarkFruit", seg=6)
    roots(0.045, 3, "BarkFruit", reach=0.06, th=0.016)
    limb((0.03, 0.28, 0.0), (0.15, 0.42, 0.04), 0.022, 0.01, "BarkFruit", seg=5)
    limb((0.03, 0.29, 0.0), (-0.13, 0.44, -0.04), 0.02, 0.01, "BarkFruit", seg=5)
    limb((0.03, 0.3, 0.0), (0.0, 0.46, 0.14), 0.018, 0.008, "BarkFruit", seg=5)
    if pear:
        crowns = [((0.0, 0.56, 0.0), 0.2, (1.0, 1.35, 1.0)), ((0.1, 0.48, 0.06), 0.13, (1, 1.2, 1)),
                  ((-0.09, 0.5, -0.05), 0.13, (1, 1.2, 1)), ((0.0, 0.76, -0.02), 0.12, (1, 1.2, 1))]
    else:
        crowns = [((0.0, 0.52, 0.0), 0.22, (1.15, crown_sy, 1.15)), ((0.17, 0.48, 0.07), 0.14, (1, 0.9, 1)),
                  ((-0.16, 0.5, -0.06), 0.15, (1, 0.9, 1)), ((0.03, 0.62, -0.13), 0.13, (1, 0.9, 1)),
                  ((-0.04, 0.47, 0.16), 0.13, (1, 0.9, 1))]
    for i, (c, r, sc) in enumerate(crowns):
        foliage(r, leaves[i % len(leaves)], c, scale=sc, jit=0.13, flat=0.25)
    main_c, main_r, main_sc = crowns[0]
    for p in surface_points(main_c, main_r * 1.0, n_fruit, ymin=-0.55, sc=main_sc):
        if fruit == "pear":
            blob(0.022, "FruitPear", (p[0], p[1] - 0.01, p[2]), scale=(0.85, 1.25, 0.85), sub=1)
            blob(0.016, "FruitPear", (p[0], p[1] - 0.03, p[2]), sub=1)
        elif fruit == "apple":
            blob(0.024, "FruitApple" if rnd.random() < 0.8 else "FruitAppleY", p, sub=1)
        else:
            blob(0.026, "BlossomP" if rnd.random() < 0.6 else "BlossomW", p, scale=(1.0, 0.7, 1.0), sub=1)
    for c, r, sc in crowns[1:]:
        for p in surface_points(c, r, max(2, n_fruit // 4), ymin=-0.3, sc=sc):
            if fruit == "apple":
                blob(0.022, "FruitApple", p, sub=1)
            elif fruit == "blossom":
                blob(0.024, "BlossomP" if rnd.random() < 0.5 else "BlossomW", p, scale=(1.0, 0.7, 1.0), sub=1)
    if fruit == "apple":                                       # gevallen appels in het gras
        for (x, z) in ((0.16, 0.12), (-0.12, 0.18), (0.05, -0.2)):
            blob(0.022, "FruitApple", (x, 0.015, z), sub=1)
    if fruit == "blossom":                                     # gevallen blaadjes
        for i in range(7):
            a = rnd.uniform(0, TAU); rr = rnd.uniform(0.08, 0.26)
            flat_leaf(math.cos(a) * rr, 0.004, math.sin(a) * rr, 0.02, 0.014, rnd.uniform(0, TAU), "BlossomP", tilt=0)


def apple():
    fruit_tree("apple", ("LeafFruitA", "LeafFruitB"), 14)


def pear():
    fruit_tree("pear", ("LeafFruitB", "LeafFruitA"), 10, pear=True)


def blossom():
    fruit_tree("blossom", ("BlossomP", "BlossomW", "BlossomP", "LeafFruitB", "BlossomP"), 22)


def oak_bird():
    oak()
    # easter egg: vogelhuisje aan de stam, met een rood dak-randje en een rond gaatje
    z = 0.06
    box(0.06, 0.07, 0.05, "EggHouse", pos=(0.02, 0.27, z + 0.02), bevel=0.004)
    prism([(-0.038, 0.0), (0.038, 0.0), (0.0, 0.035)], 0.075, "EggRoof", pos=(0.02, 0.34, z + 0.02), axis="x")
    cyl(0.011, 0.011, 0.004, 10, "EggPupil", pos=(0.02, 0.305, z + 0.046), rot=(math.pi / 2, 0, 0), smooth=False)
    beam((0.02, 0.285, z + 0.046), (0.02, 0.285, z + 0.07), 0.004, "Wood")
    blob(0.016, "EggLogo", (0.035, 0.37, z + 0.02), scale=(1.2, 0.9, 0.9), sub=1)     # roodborstje op het dak
    blob(0.006, "EggPupil", (0.05, 0.375, z + 0.03), sub=0)


# ------------------------------------------------------------------ STRUIKEN
def bush_round():
    foliage(0.11, "LeafBushB", (0, 0.07, 0), scale=(1.1, 0.85, 1.0), jit=0.16, flat=0.4)
    foliage(0.075, "LeafBushA", (0.08, 0.06, 0.04), jit=0.18, flat=0.4)
    foliage(0.06, "LeafBushB", (-0.07, 0.05, -0.03), jit=0.18, flat=0.4)


def bush_big():
    parts = [((0, 0.12, 0), 0.17, "LeafBushA"), ((0.14, 0.1, 0.05), 0.12, "LeafBushB"), ((-0.13, 0.1, -0.04), 0.13, "LeafBushD"),
             ((0.03, 0.2, -0.08), 0.11, "LeafBushB"), ((-0.04, 0.08, 0.13), 0.1, "LeafBushA")]
    for c, r, m in parts:
        foliage(r, m, c, scale=(1.05, 0.85, 1.0), jit=0.17, flat=0.4)


def bush_flower():
    bush_round()
    for p in surface_points((0, 0.075, 0), 0.115, 16, ymin=-0.1, sc=(1.1, 0.85, 1.0)):
        blob(0.016, "FlBushP" if rnd.random() < 0.65 else "FlBushW", p, scale=(1, 0.7, 1), sub=1)


def bush_berry():
    foliage(0.12, "LeafBushD", (0, 0.08, 0), scale=(1.1, 0.8, 1.0), jit=0.16, flat=0.4)
    foliage(0.08, "LeafBushA", (0.09, 0.06, -0.04), jit=0.18, flat=0.4)
    for p in surface_points((0, 0.08, 0), 0.125, 18, ymin=-0.2, sc=(1.1, 0.8, 1.0)):
        blob(0.011, "BerryR" if rnd.random() < 0.7 else "BerryB", p, sub=1)


def hedge():
    # lage heg: rij samengevoegde, iets afgeplatte bollen (± 0.6 lang)
    for i in range(6):
        x = -0.26 + i * 0.105 + rnd.uniform(-0.01, 0.01)
        foliage(0.085, "LeafHedge" if i % 2 else "LeafBushA", (x, 0.08, rnd.uniform(-0.015, 0.015)), scale=(1.0, 1.0, 0.85), jit=0.14, flat=0.5)
    box(0.56, 0.05, 0.11, "LeafHedge", pos=(0, 0.0, 0), bevel=0.02)


def bush_eyes():
    bush_big()
    # easter egg: twee nieuwsgierige oogjes tussen de bladeren
    for sx in (-1, 1):
        blob(0.024, "EggEye", (sx * 0.035, 0.15, 0.165), scale=(1, 1.15, 0.6), sub=1)
        blob(0.012, "EggPupil", (sx * 0.033 + 0.006, 0.148, 0.178), scale=(1, 1.1, 0.5), sub=1)


# ------------------------------------------------------------------ GRAS
def grass_short():
    for i in range(12):
        a = i * 2.4 + rnd.uniform(-0.3, 0.3); rr = rnd.uniform(0.0, 0.045)
        blade(math.cos(a) * rr, math.sin(a) * rr, rnd.uniform(0.05, 0.09), rnd.uniform(0.3, 0.65), a, "GrassT" if i % 3 else "GrassTL", w=0.015)


def grass_mid():
    for i in range(16):
        a = i * 2.4 + rnd.uniform(-0.3, 0.3); rr = rnd.uniform(0.0, 0.065)
        blade(math.cos(a) * rr, math.sin(a) * rr, rnd.uniform(0.08, 0.14), rnd.uniform(0.25, 0.6), a, "GrassT" if i % 3 else "GrassTL", w=0.017)


def grass_tall():
    for i in range(9):
        a = i * 2.4 + rnd.uniform(-0.3, 0.3); rr = rnd.uniform(0.0, 0.05)
        blade(math.cos(a) * rr, math.sin(a) * rr, rnd.uniform(0.16, 0.25), rnd.uniform(0.25, 0.5), a, "GrassT" if i % 2 else "GrassTL", w=0.016, seg2=True)


def grass_bloom():
    for i in range(6):
        a = i * 2.4 + rnd.uniform(-0.3, 0.3); rr = rnd.uniform(0.0, 0.04)
        blade(math.cos(a) * rr, math.sin(a) * rr, rnd.uniform(0.07, 0.11), rnd.uniform(0.3, 0.55), a, "GrassT", w=0.015)
    for i in range(4):                                           # aren/pluimpjes op dunne halmen
        a = i * 1.7 + 0.3; rr = 0.02
        x, z = math.cos(a) * rr, math.sin(a) * rr
        h = rnd.uniform(0.15, 0.21)
        tx, tz = x + math.cos(a) * 0.03, z + math.sin(a) * 0.03
        limb((x, 0, z), (tx, h, tz), 0.004, 0.003, "GrassT", seg=3, cap=False, smooth=False)
        blob(0.014, "SeedHead", (tx, h + 0.018, tz), scale=(0.7, 1.7, 0.7), sub=1)


def weed():
    # rozet van brede blaadjes (paardenbloem/weegbree) met één stengel en knop
    for i in range(6):
        a = i * TAU / 6 + rnd.uniform(-0.2, 0.2)
        flat_leaf(0, 0.012, 0, rnd.uniform(0.05, 0.07), 0.022, a, "GrassWeed", tilt=-0.3)
    limb((0, 0, 0), (0.01, 0.09, 0.0), 0.003, 0.003, "GrassWeed", seg=3, cap=False, smooth=False)
    blob(0.012, "GrassWeed", (0.01, 0.095, 0.0), scale=(1, 1.3, 1), sub=1)


# ------------------------------------------------------------------ BLOEMEN (kleine groepjes)
def stem(x, z, h, lean=0.1, a=0.0):
    top = (x + math.cos(a) * lean * h, h, z + math.sin(a) * lean * h)
    limb((x, -0.004, z), top, 0.0045, 0.003, "FlStem", seg=3, cap=False, smooth=False)
    return top


def petal_ring(c, n, l, w, mat, tilt=0.25, rot=0.0):
    l *= 1.35
    star(c, l, l * 0.35 + w * 0.2, n, mat, cup=max(0.0, -tilt) * l * 0.6 + 0.002, rot=rot)


def cluster(n, spread, fn):
    spread *= 1.35
    for i in range(n):
        a = i * 2.39996 + rnd.uniform(-0.4, 0.4)
        rr = spread * math.sqrt((i + 0.5) / n)
        fn(math.cos(a) * rr, math.sin(a) * rr, i)


def fl_daisy():
    def one(x, z, i):
        t = stem(x, z, rnd.uniform(0.06, 0.09), a=rnd.uniform(0, TAU))
        petal_ring(t, 8, 0.022, 0.009, "PetalW", tilt=0.15, rot=rnd.uniform(0, 1))
        blob(0.009, "PetalYc", (t[0], t[1] + 0.003, t[2]), scale=(1, 0.6, 1), sub=0)
    cluster(5, 0.07, one)
    flat_leaf(0, 0.006, 0, 0.04, 0.016, 0.5, "FlStem", tilt=0)


def fl_poppy():
    def one(x, z, i):
        t = stem(x, z, rnd.uniform(0.1, 0.14), lean=0.18, a=rnd.uniform(0, TAU))
        cyl(0.026, 0.01, 0.024, 7, "PetalRed", pos=(t[0], t[1], t[2]), smooth=True, cap=False)
        cyl(0.01, 0.026, 0.004, 7, "PetalRed", pos=(t[0], t[1] - 0.002, t[2]), smooth=True, cap=True)
        blob(0.008, "PetalDark", (t[0], t[1] + 0.012, t[2]), sub=1)
    cluster(4, 0.06, one)
    for i in range(3):
        flat_leaf(0, 0.01, 0, 0.045, 0.012, i * 2.1, "FlStem", tilt=-0.4)


def fl_yellow():
    def one(x, z, i):
        t = stem(x, z, rnd.uniform(0.05, 0.08), a=rnd.uniform(0, TAU))
        petal_ring(t, 5, 0.014, 0.011, "PetalYel", tilt=-0.35, rot=rnd.uniform(0, 1))
        blob(0.005, "PetalYc", t, sub=0)
    cluster(7, 0.08, one)


def fl_purple():
    # wilde lavendel/salie: rechtopstaande aren van kleine bolletjes
    def one(x, z, i):
        h = rnd.uniform(0.09, 0.14)
        t = stem(x, z, h, lean=0.12, a=rnd.uniform(0, TAU))
        for k in range(3):
            f = 0.6 + k * 0.18
            blob(0.01 - k * 0.0015, "PetalPurp", (x + (t[0] - x) * f, h * f + 0.005, z + (t[2] - z) * f), scale=(1, 1.4, 1), sub=1)
    cluster(6, 0.06, one)


def fl_mix():
    cols = ("PetalBlue", "PetalPink", "PetalW", "PetalBlue", "PetalYel", "PetalPink")

    def one(x, z, i):
        t = stem(x, z, rnd.uniform(0.06, 0.11), a=rnd.uniform(0, TAU))
        petal_ring(t, 6, 0.015, 0.01, cols[i % len(cols)], tilt=-0.2, rot=rnd.uniform(0, 1))
        blob(0.005, "PetalYc", t, sub=0)
    cluster(7, 0.09, one)


# ------------------------------------------------------------------ DETAILS
def stones():
    for i, (x, z, s) in enumerate(((0, 0, 0.045), (0.07, 0.03, 0.03), (-0.05, 0.05, 0.026), (0.02, -0.06, 0.022))):
        blob(s, ("RockA", "RockB", "RockL")[i % 3], (x, s * 0.3, z), scale=(rnd.uniform(1.0, 1.4), 0.65, rnd.uniform(0.9, 1.2)), sub=1)


def mossrock():
    foliage(0.14, "RockB", (0, 0.06, 0), scale=(1.25, 0.75, 1.0), sub=1, jit=0.14)
    foliage(0.08, "RockA", (0.14, 0.03, 0.06), scale=(1.2, 0.7, 1.0), sub=1, jit=0.14)
    foliage(0.12, "MossR", (-0.01, 0.12, -0.01), scale=(1.15, 0.35, 0.9), sub=1, jit=0.12)
    grass_ring(0.17, 5)


def stump(door=False):
    cyl(0.075, 0.09, 0.12, 9, "BarkOak", pos=(0, -0.01, 0), cap=False)
    cyl(0.075, 0.075, 0.006, 9, "StumpTop", pos=(0, 0.106, 0), smooth=False)
    cyl(0.045, 0.045, 0.004, 9, "StumpRing", pos=(0, 0.111, 0), smooth=False)
    cyl(0.02, 0.02, 0.004, 9, "StumpTop", pos=(0, 0.114, 0), smooth=False)
    roots(0.08, 4, "BarkOak", reach=0.07, th=0.022)
    blob(0.035, "MossB", (0.05, 0.03, -0.06), scale=(1.4, 0.5, 1), sub=1)
    if door:
        # easter egg: een miniatuurdeurtje met raampje en lantaarntje
        z = 0.087
        box(0.042, 0.06, 0.008, "EggDoor", pos=(0, 0.0, z), bevel=0.002)
        cyl(0.021, 0.021, 0.008, 10, "EggDoor", pos=(0, 0.06, z - 0.004), rot=(math.pi / 2, 0, 0), arc=(0, math.pi), smooth=False)
        blob(0.004, "EggKnob", (0.013, 0.03, z + 0.006), sub=0)
        cyl(0.009, 0.009, 0.004, 8, "EggWin", pos=(0.04, 0.075, 0.075), rot=(math.pi / 2, 0.5, 0), smooth=False)
        box(0.05, 0.006, 0.03, "StumpTop", pos=(0, -0.002, z + 0.022))    # drempel/stoepje
        for i in range(3):
            blob(0.007, ("RockL", "RockA", "RockL")[i], (-0.025 + i * 0.025, 0.002, z + 0.05), scale=(1.2, 0.5, 1), sub=0)


def branch():
    limb((-0.2, 0.025, 0.0), (0.2, 0.02, 0.03), 0.024, 0.014, "BarkOak", seg=5)
    limb((0.02, 0.025, 0.01), (0.12, 0.03, 0.1), 0.01, 0.004, "TwigOak", seg=4)
    limb((-0.08, 0.025, 0.0), (-0.16, 0.05, -0.08), 0.009, 0.003, "TwigOak", seg=4)
    for p in ((0.12, 0.035, 0.1), (-0.16, 0.055, -0.08)):
        flat_leaf(p[0], p[1], p[2], 0.025, 0.014, rnd.uniform(0, TAU), "LeafFallO", tilt=0.2)


def mushrooms():
    for i, (x, z, s, red) in enumerate(((0, 0, 1.0, True), (0.06, 0.03, 0.7, True), (-0.05, 0.04, 0.6, False), (0.02, -0.05, 0.55, False))):
        cyl(0.01 * s, 0.013 * s, 0.045 * s, 6, "ShroomStem", pos=(x, 0, z), cap=False)
        cap_mat = "ShroomRed" if red else "ShroomBrown"
        blob(0.03 * s, cap_mat, (x, 0.045 * s, z), scale=(1, 0.6, 1), sub=1)
        if red:
            for k in range(5):
                a = k * TAU / 5 + 0.3
                blob(0.005 * s, "ShroomDot", (x + math.cos(a) * 0.018 * s, 0.058 * s, z + math.sin(a) * 0.018 * s), sub=0)
            blob(0.005 * s, "ShroomDot", (x, 0.064 * s, z), sub=0)


def shroom_face():
    # easter egg: een paddenstoel met een vrolijk gezichtje
    cyl(0.022, 0.028, 0.07, 8, "ShroomStem", pos=(0, 0, 0), cap=False)
    blob(0.055, "ShroomRed", (0, 0.07, 0), scale=(1, 0.6, 1), sub=2)
    for k in range(6):
        a = k * TAU / 6
        blob(0.008, "ShroomDot", (math.cos(a) * 0.032, 0.095, math.sin(a) * 0.032), sub=0)
    z = 0.024
    for sx in (-1, 1):
        blob(0.006, "EggPupil", (sx * 0.009, 0.045, z), scale=(1, 1.3, 0.6), sub=1)
        blob(0.005, "EggCheek", (sx * 0.017, 0.035, z - 0.003), scale=(1, 0.7, 0.5), sub=0)
    cyl(0.006, 0.006, 0.003, 8, "EggPupil", pos=(0, 0.032, z + 0.001), rot=(math.pi / 2, 0, 0), arc=(math.pi, math.pi), smooth=False)


def roots_patch():
    for i in range(4):
        a = i * 1.6 + rnd.uniform(-0.2, 0.2)
        x0, z0 = math.cos(a) * 0.04, math.sin(a) * 0.04
        x1, z1 = math.cos(a) * 0.22, math.sin(a) * 0.22
        mx, mz = (x0 + x1) / 2, (z0 + z1) / 2
        limb((x0, -0.01, z0), (mx, 0.025, mz), 0.022, 0.017, "Root", seg=5, cap=False)
        limb((mx, 0.025, mz), (x1, -0.01, z1), 0.017, 0.006, "Root", seg=5)
    blob(0.04, "MossB", (0.0, 0.0, 0.0), scale=(1.4, 0.4, 1.2), sub=1)


def leaves():
    mats = ("LeafFallO", "LeafFallY", "LeafFallB", "LeafFallO", "LeafOakB")
    for i in range(12):
        a = rnd.uniform(0, TAU); rr = rnd.uniform(0.0, 0.2)
        flat_leaf(math.cos(a) * rr, 0.004 + i * 0.0006, math.sin(a) * rr, 0.03, 0.017, rnd.uniform(0, TAU), mats[i % len(mats)], tilt=rnd.uniform(-0.15, 0.15))


# ------------------------------------------------------------------ bouwen
ASSETS = [
    ("tree_oak", oak), ("tree_oak_old", oak_old), ("tree_beech", beech), ("tree_birch", birch),
    ("tree_young", young), ("tree_pine", pine), ("tree_spruce", spruce),
    ("tree_apple", apple), ("tree_pear", pear), ("tree_blossom", blossom),
    ("tree_oak_bird", oak_bird), ("tree_beech_logo", beech_logo),
    ("bush_round", bush_round), ("bush_big", bush_big), ("bush_flower", bush_flower),
    ("bush_berry", bush_berry), ("hedge", hedge), ("bush_eyes", bush_eyes),
    ("grass_short", grass_short), ("grass_mid", grass_mid), ("grass_tall", grass_tall),
    ("grass_bloom", grass_bloom), ("weed", weed),
    ("fl_daisy", fl_daisy), ("fl_poppy", fl_poppy), ("fl_yellow", fl_yellow), ("fl_purple", fl_purple), ("fl_mix", fl_mix),
    ("d_stones", stones), ("d_mossrock", mossrock), ("d_stump", lambda: stump(False)), ("d_branch", branch),
    ("d_mushrooms", mushrooms), ("d_roots", roots_patch), ("d_leaves", leaves),
    ("egg_stump_door", lambda: stump(True)), ("egg_shroom_face", shroom_face),
]
BUDGET = {"tree": 1500, "bush": 900, "hedge": 900, "grass": 160, "weed": 160, "fl": 420, "d": 700, "egg": 900}

OVER = []
for n, (name, fn) in enumerate(ASSETS):
    obj = node(name, fn, 9300 + n * 17)
    tris = ve.triangle_count([obj])
    lim = BUDGET[name.split("_")[0]]
    if name.startswith("tree_") and ("bird" in name or "logo" in name):
        lim += 200
    print(f"VE-NATURE {name} tris={tris} budget={lim}")
    if tris > lim:
        OVER.append(f"{name} {tris}>{lim}")
if OVER:
    raise SystemExit("VE-BLENDER: boven budget: " + ", ".join(OVER))

use_ao = not os.environ.get("VE_NO_AO")
if use_ao:
    for name, obj in NODES:
        for _, o in NODES:
            o.hide_render = o is not obj
        bake_ao(obj, samples=32, distance=0.1)
    for _, o in NODES:
        o.hide_render = False

# overzichtelijk naast elkaar zetten (voor preview.html); de game gebruikt de node-lokale vorm
for n, (name, obj) in enumerate(NODES):
    obj.matrix_world = Matrix.Translation(M3 @ Vector(((n % 8) * 1.1, 0, (n // 8) * 1.1)))

import json  # noqa: E402
with open(os.path.join(os.path.dirname(os.path.abspath(args.out)), "nature-climb.json"), "w", encoding="utf-8") as fh:
    json.dump({k: v for k, v in CLIMB.items() if v["trunk"]}, fh, separators=(",", ":"))
print("VE-CLIMB", {k: (len(v["trunk"]), len(v["br"])) for k, v in CLIMB.items()})
ve.export_glb(args.out, budget=sum(BUDGET[name.split("_")[0]] + 200 for name, _ in NODES), vertex_colors=use_ao)
