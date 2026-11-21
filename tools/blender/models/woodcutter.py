"""Village Empire — Woodcutter (houthakkershut), drie upgrade-levels in één GLB.

Uitvoer: public/models/woodcutter.glb met de nodes
    woodcutter_l1, woodcutter_l2, woodcutter_l3   (meerdere materialen + gebakken AO)
    woodcutter_l<n>_smoke                         top van de schoorsteen (rook)

Herkenbaarheid (stijlgids): blokhut van ronde stammen met uitstekende hoeken, houten
spanendak met wat mos, hakblok met bijl en een flinke houtstapel voor de deur.
Level 2: afdak met kloofhout. Level 3: zaagbok, ton en uithangbord.

Coördinaten zijn GAME-coördinaten (Y omhoog, voordeur aan +Z, 1 eenheid = 1 tegel).
Bouwen: npm run models -- woodcutter
"""
import math
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "lib"))
import ve_blender as ve  # noqa: E402
from ve_parts import *  # noqa: E402,F401,F403
from ve_parts import rnd  # noqa: E402

args = ve.parse_args()
args.budget = max(args.budget, 3400)
ve.reset_scene()
setup(seed=4242, extra_palette={
    "Log": (0x8A5A2B, 0.07), "LogD": (0x6E4522, 0.06), "LogEnd": (0xD9B07A, 0.05),
    "ShA": (0x7A5A3E, 0.08), "ShB": (0x6B4E36, 0.08), "ShC": (0x8A6A48, 0.08), "Moss": (0x7D8646, 0.08),
})

W, D = 0.52, 0.40            # blokhut (x, z), hart-op-hart van de stammen
Y0 = 0.07                    # hart van de onderste stam
R = 0.026                    # straal stam
COURSES = 6
TOP = Y0 + (COURSES - 1) * 0.05 + R + 0.025      # bovenkant muren (incl. zijstammen)
EAVE_Z, EAVE_Y, RIDGE_Y = 0.31, 0.30, 0.61
SHINGLES = ("ShA", "ShA", "ShB", "ShC", "ShB", "ShA", "ShC", "ShB", "ShA")


def log(p0, length, along, mat, r=R, seg=6):
    """Ronde stam met lichte kopse kanten, langs x of z, gecentreerd op p0."""
    x, y, z = p0
    if along == "x":
        cyl(r, r, length, seg, mat, pos=(x - length / 2, y, z), rot=(0, 0, -math.pi / 2))
    else:
        cyl(r, r, length, seg, mat, pos=(x, y, z - length / 2), rot=(math.pi / 2, 0, 0))


def cabin():
    # vulling achter de stammen (geen kieren)
    box(W - 0.02, TOP - 0.05, D - 0.02, "LogD", pos=(0, 0.045, 0))
    for i in range(COURSES):
        y = Y0 + i * 0.05
        m1, m2 = ("Log", "LogD") if i % 2 else ("LogD", "Log")
        for sz in (-1, 1):                                       # voor- en achtergevel
            log((0, y, sz * D / 2), W + 0.09, "x", m1 if sz > 0 else m2)
        for sx in (-1, 1):                                       # zijgevels (half verspringend)
            log((sx * W / 2, y + 0.025, 0), D + 0.09, "z", m2 if sx > 0 else m1)
    # puntgevels van planken + latten
    prof = [(-D / 2 - 0.02, TOP - 0.01), (D / 2 + 0.02, TOP - 0.01), (D / 2 + 0.02, TOP + 0.03), (0, RIDGE_Y - 0.03), (-D / 2 - 0.02, TOP + 0.03)]
    for sx in (-1, 1):
        prism(prof, 0.03, "WoodL", pos=(sx * (W / 2 + 0.005), 0, 0))
        for zz in (-0.1, 0.0, 0.1):
            ytop = RIDGE_Y - 0.04 - abs(zz) * 1.0
            beam((sx * (W / 2 + 0.022), TOP, zz), (sx * (W / 2 + 0.022), ytop, zz), 0.012, "Timber")


def chopping_block(x, z):
    cyl(0.06, 0.066, 0.075, 10, "Log", pos=(x, 0.04, z))
    cyl(0.058, 0.058, 0.006, 10, "LogEnd", pos=(x, 0.113, z), smooth=False)
    # bijl: kop in het blok, steel schuin omhoog
    box(0.05, 0.034, 0.012, "Iron", pos=(x - 0.006, 0.1, z + 0.004), rot=(0, 0.45, 0.25))
    beam((x - 0.01, 0.125, z + 0.004), (x + 0.07, 0.24, z + 0.05), 0.013, "WoodL")
    # kloofhout en spaanders
    for k, (dx, dz) in enumerate(((-0.09, 0.03), (0.07, -0.05), (0.09, 0.05))):
        box(0.03, 0.055, 0.03, "LogEnd" if k % 2 else "Log", pos=(x + dx, 0.04, z + dz),
            rot=(0.0, rnd.uniform(0, 3), rnd.uniform(-0.2, 0.2)))
    for _ in range(5):
        box(0.018, 0.004, 0.008, "LogEnd", pos=(x + rnd.uniform(-0.1, 0.1), 0.042, z + rnd.uniform(-0.08, 0.08)),
            rot=(0, rnd.uniform(0, 3), 0))


def log_stack(x, z, rows=3, length=0.2, along="x"):
    """Stapel stammen met lichte kopse kanten (driehoekig opgestapeld)."""
    for row in range(rows):
        for i in range(rows - row):
            off = (i - (rows - row - 1) / 2) * 0.056
            y = 0.04 + R + row * 0.048
            if along == "x":
                log((x, y, z + off), length, "x", "Log" if (i + row) % 2 else "LogD", seg=6)
            else:
                log((x + off, y, z), length, "z", "Log" if (i + row) % 2 else "LogD", seg=6)


def lean_to(x_wall, z0, z1):
    """Afdak tegen de linker zijgevel met gekloofd brandhout eronder."""
    xo = x_wall - 0.22
    y_hi, y_lo = 0.34, 0.24
    for zz in (z0, z1):
        beam((xo, 0.04, zz), (xo, y_lo, zz), 0.022, "Timber")
    beam((xo, y_lo, z0 - 0.02), (xo, y_lo, z1 + 0.02), 0.02, "Timber")
    run = x_wall - xo + 0.04
    a = math.atan2(y_hi - y_lo, run)
    L = math.hypot(run, y_hi - y_lo)
    up_a = Vector((math.cos(a), math.sin(a), 0.0))
    n_a = Vector((-math.sin(a), math.cos(a), 0.0))
    rows, width = 3, (z1 - z0) + 0.08
    cols = 4
    tw = width / cols
    for ri in range(rows):
        t = (ri + 0.5) / rows
        px = (xo - 0.02) + run * t
        py = y_lo + (y_hi - y_lo) * t + 0.012
        for ci in range(cols):
            pz = z0 - 0.04 + (ci + 0.5) * tw + (0.5 * tw if ri % 2 else 0) - (0.25 * tw)
            pz = min(max(pz, z0 - 0.02), z1 + 0.02)
            shingle((px, py, pz), up_a, n_a, tw - 0.006, L / rows * 1.3, rnd.choice(SHINGLES + ("Moss",)))
    # kloofhout: rijen halve stammen (5-zijdig) onder het afdak
    for row in range(3):
        for i in range(4):
            zz = z0 + 0.03 + i * (z1 - z0 - 0.06) / 3
            cyl(0.022, 0.022, 0.15, 5, "LogEnd" if (i + row) % 3 == 0 else "Log",
                pos=(x_wall - 0.19, 0.06 + row * 0.042, zz), rot=(0, 0, -math.pi / 2))


def sawbuck(x, z):
    for dz in (-0.05, 0.05):
        beam((x - 0.06, 0.04, z + dz), (x + 0.05, 0.17, z + dz), 0.014, "Wood")
        beam((x + 0.06, 0.04, z + dz), (x - 0.05, 0.17, z + dz), 0.014, "Wood")
    log((x, 0.155, z), 0.2, "z", "Log", r=0.024)


def build(lvl):
    earth_base(0.82, 0.74, top=0.04, clumps=10, pebbles=4, flowers=3,
               keep_clear=[(-0.12, 0.14, 0.18, 0.5), (0.14, 0.45, 0.18, 0.5), (-0.45, -0.1, 0.18, 0.5)])
    cabin()
    gable_roof(0.7, EAVE_Z, EAVE_Y, RIDGE_Y, rows=5, cols=6, kind="shingle", mats=SHINGLES + ("Moss",),
               ridge_mat="LogD", barge_mat="Timber", ridge_r=0.028)
    door(0.03, D / 2 + R, w=0.12, h=0.19)
    window(W / 2 + R + 0.004, 0.2, 0.02, "x", lit=True, shutters="ShutterG", w=0.09, h=0.09)
    window(-0.15, 0.2, D / 2 + R + 0.002, "z", lit=False, shutters="Shutter", w=0.08, h=0.08)
    smoke = chimney(-0.15, -0.09, 0.36, 0.8)
    chopping_block(0.28, 0.33)
    # geen vaste houtstapel meer: de game legt de werkelijke voorraad stammen op de marker 'pile'
    blob(0.045, "Leaf", (0.36, 0.06, -0.3), scale=(1, 0.8, 1), sub=2)

    if lvl >= 2:
        lean_to(-W / 2 - R, -0.17, 0.12)

    if lvl >= 3:
        sawbuck(0.38, 0.12)
        barrel(-0.33, -0.27)
        # uithangbord met bijl naast de deur
        beam((0.16, 0.04, D / 2 + 0.09), (0.16, 0.3, D / 2 + 0.09), 0.018, "Timber")
        box(0.1, 0.06, 0.012, "WoodL", pos=(0.16, 0.22, D / 2 + 0.105), bevel=0.003)
        box(0.05, 0.01, 0.004, "Iron", pos=(0.16, 0.245, D / 2 + 0.113), rot=(0, 0, 0.5))
        blob(0.03, "LeafL", (-0.38, 0.06, 0.05), sub=2)
    return {"smoke": [smoke], "pile": (-0.24, 0.04, 0.34)}


build_levels("woodcutter", build, args)
