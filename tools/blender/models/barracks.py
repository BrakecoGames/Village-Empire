"""Village Empire — Barracks (kazerne), drie upgrade-levels in één GLB (2 × 2 tegels).

Herkenbaar aan:
  - een lange vakwerk-slaapzaal achterop (level 1 houten spanen, level 2 stenen voet en rode pannen,
    level 3 een stenen hal met leien dak en een hoektoren met kantelen en vaandel);
  - een omheind oefenterrein met aangestampt zand en een poort met wapenschild (vóór de ingang);
  - houten oefenpoppen met strozakken (los onderdeel 'dummy': de game laat ze knikken bij elke klap),
    ronde schietschijven van stro met gekleurde ringen en een oefenpaal voor speervechters;
  - twee lege wapenrekken (markers rack0, rack1: de game zet de echte wapens erin) en een pallet voor
    de trainingsuitrusting (marker in0);
  - een vaandel op een mast (anker 'flag').
Oefenplekken (markers st<i>_<soort> met kijkrichting, tg<i> = pop/schijf): level 1 heeft een pop, een schijf
en de oefenpaal; level 2 een tweede pop, level 3 een tweede schietbaan.

Bouwen: npm run models -- barracks
"""
import math
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "lib"))
import ve_blender as ve  # noqa: E402
from ve_parts import *  # noqa: E402,F401,F403
from ve_parts import rnd  # noqa: E402

args = ve.parse_args()
args.budget = max(args.budget, 6200)
ve.reset_scene()
setup(seed=9133, extra_palette={
    "Sand": (0xD8C08A, 0.05), "SandD": (0xC4A872, 0.05), "Straw": (0xE2C46A, 0.08), "StrawD": (0xC9A64C, 0.07),
    "Burlap": (0xBFA77A, 0.06), "Rope": (0xCDB384, 0.04), "RingR": (0xC8402F, 0.03), "RingW": (0xF4ECD8, 0.02),
    "Banner": (0x2F5FA8, 0.03), "BannerG": (0xE8B73A, 0.02), "Steel": (0xB8C0C8, 0.02), "Pad": (0x8A5A3A, 0.05),
})

H_Z, H_D = -0.64, 0.58           # slaapzaal: midden en diepte (voorgevel op z = -0.35)
GATE = (0.3, 0.7)                # opening in de omheining vóór de ingang (deur van het gebouw op x = 0,5)


def weapon_rack(x, z):
    """leeg wapenrek met zes gleuven (zelfde maat als bij de wapensmederij): voetplank, staanders en een
    bovenregel met pinnen. Geeft de plek van de voetplank terug (marker rack<i>)."""
    W, top = 0.34, 0.064
    box(W + 0.02, 0.024, 0.075, "Wood", pos=(x, 0.04, z), bevel=0.003)
    for k in range(7):
        box(0.008, 0.016, 0.06, "WoodL", pos=(x + (k - 3) * 0.05, top, z))
    for dx in (-W / 2 - 0.004, W / 2 + 0.004):
        beam((x + dx, 0.04, z - 0.03), (x + dx, 0.235, z - 0.04), 0.02, "Timber")
    beam((x - W / 2 - 0.012, 0.215, z - 0.05), (x + W / 2 + 0.012, 0.215, z - 0.05), 0.018, "Timber")
    for k in range(7):
        beam((x + (k - 3) * 0.05, 0.215, z - 0.045), (x + (k - 3) * 0.05, 0.215, z - 0.015), 0.007, "Iron")
    return (x, top, z)


def target(x, z):
    """ronde schietschijf van stro op een schraag, met de voorkant naar +x (naar de schutter)"""
    cy = 0.21
    for dz in (-0.07, 0.07):                                           # schraag
        beam((x - 0.06, 0.04, z + dz), (x + 0.01, cy + 0.06, z + dz * 0.6), 0.016, "Timber")
        beam((x + 0.05, 0.04, z + dz), (x + 0.01, cy + 0.06, z + dz * 0.6), 0.014, "TimberL")
    cyl(0.11, 0.11, 0.05, 14, "Straw", pos=(x - 0.01, cy, z), rot=(0, 0, -math.pi / 2), center=True, smooth=False)
    for r, m, t in ((0.085, "RingW", 0.052), (0.062, "RingR", 0.054), (0.04, "RingW", 0.056), (0.02, "BannerG", 0.058)):
        cyl(r, r, t, 14, m, pos=(x - 0.01, cy, z), rot=(0, 0, -math.pi / 2), center=True, smooth=False)
    for k in range(4):                                                  # touw rond de strokern
        a = k * math.pi / 2 + 0.4
        box(0.054, 0.006, 0.006, "Rope", pos=(x - 0.01, cy + math.sin(a) * 0.108, z + math.cos(a) * 0.108), base=False)
    return (x + 0.02, cy, z)                                            # doel: midden van de voorkant


def pell(x, z):
    """oefenpaal voor speervechters: eiken paal met strokragen en een dwarsarm (stoten en pareren)"""
    cyl(0.03, 0.035, 0.36, 8, "LogD", pos=(x, 0.04, z), smooth=False)
    cyl(0.04, 0.04, 0.012, 8, "LogEnd", pos=(x, 0.4, z), smooth=False)
    for y in (0.16, 0.26):
        cyl(0.048, 0.048, 0.05, 10, "Straw", pos=(x, y, z), smooth=False)
        cyl(0.05, 0.05, 0.008, 10, "Rope", pos=(x, y + 0.02, z), smooth=False, cap=False)
    beam((x - 0.01, 0.33, z - 0.1), (x - 0.01, 0.33, z + 0.1), 0.02, "Timber")
    box(0.07, 0.012, 0.07, "StoneB", pos=(x, 0.04, z), bevel=0.004)
    return (x + 0.04, 0.22, z)


def dummy_part():
    """oefenpop (los onderdeel, voet op de oorsprong; gezicht naar -x, naar de oefenplek): paal met
    kruisvoet, strozak als lijf, jutezak als hoofd, dwarsarm met strobundels en een houten schildje"""
    for a in (0.0, math.pi / 2):
        box(0.16, 0.02, 0.03, "Timber", pos=(0, 0.0, 0), rot=(0, a, 0))
    cyl(0.016, 0.02, 0.36, 6, "Wood", pos=(0, 0.0, 0), smooth=False)
    blob(0.06, "Straw", (0, 0.2, 0), scale=(0.95, 1.35, 1.05), sub=1, smooth=False)
    cyl(0.064, 0.064, 0.01, 8, "Rope", pos=(0, 0.16, 0), smooth=False, cap=False)
    cyl(0.06, 0.06, 0.01, 8, "Rope", pos=(0, 0.25, 0), smooth=False, cap=False)
    blob(0.042, "Burlap", (0, 0.335, 0), scale=(1, 1.05, 1), sub=1, smooth=False)
    box(0.012, 0.012, 0.03, "Pad", pos=(-0.04, 0.33, 0), base=False)                  # 'neus' (gezicht naar -x)
    beam((0, 0.27, -0.13), (0, 0.27, 0.13), 0.018, "Timber")
    for s in (-1, 1):
        blob(0.026, "StrawD", (0, 0.27, s * 0.125), scale=(0.9, 0.9, 1.4), sub=0, smooth=False)
    cyl(0.05, 0.05, 0.012, 9, "Wood", pos=(-0.02, 0.24, 0.13), rot=(0, 0, math.pi / 2), center=True, smooth=False)   # schildje
    cyl(0.016, 0.016, 0.016, 6, "Iron", pos=(-0.026, 0.24, 0.13), rot=(0, 0, math.pi / 2), center=True, smooth=False)


def palisade(p0, p1, posts):
    """lage omheining van ronde palen met twee regels"""
    for i in range(posts + 1):
        t = i / posts
        x, z = p0[0] + (p1[0] - p0[0]) * t, p0[1] + (p1[1] - p0[1]) * t
        cyl(0.012, 0.016, 0.17, 4, "Log", pos=(x, 0.04, z), rot=(0, 0.4, 0), smooth=False, cap=False)
    for yy in (0.09, 0.15):
        beam((p0[0], yy, p0[1]), (p1[0], yy, p1[1]), 0.012, "WoodL")


def gate():
    x0, x1 = GATE
    for x in (x0, x1):
        box(0.04, 0.32, 0.04, "Timber", pos=(x, 0.04, 0.93), bevel=0.004)
        cyl(0.0, 0.03, 0.04, 4, "LogD", pos=(x, 0.36, 0.93), smooth=False)
    beam((x0 - 0.03, 0.3, 0.93), (x1 + 0.03, 0.3, 0.93), 0.024, "Timber")
    # wapenschild boven de poort: blauw met goud en gekruiste zwaarden
    box(0.11, 0.09, 0.014, "Banner", pos=(0.5, 0.315, 0.945), bevel=0.003)
    cyl(0.0, 0.055, 0.04, 3, "Banner", pos=(0.5, 0.315, 0.945), rot=(math.pi, 0, 0), smooth=False)
    box(0.028, 0.028, 0.006, "BannerG", pos=(0.5, 0.34, 0.954))
    for s in (-1, 1):
        box(0.006, 0.11, 0.006, "Steel", pos=(0.5, 0.3, 0.958), rot=(0, 0, s * 0.75))


def hall(lvl):
    """slaapzaal achterop; voorgevel (z = -0.35) kijkt uit op het oefenterrein"""
    if lvl == 1:
        h = house_body(x=0.0, z=H_Z, w=1.6, d=H_D, wall_top=0.4, ridge_y=0.74, roof="tile", wall="Plaster", timber=True)
    elif lvl == 2:
        box(1.64, 0.14, H_D + 0.04, "StoneA", pos=(0.0, 0.04, H_Z), bevel=0.008)
        h = house_body(x=0.0, z=H_Z, w=1.6, d=H_D, wall_top=0.44, ridge_y=0.8, roof="tile", wall="Plaster", timber=True, y0=0.17, plinth=False, roof_color=("TileDarkA", "TileDarkB", "TileDarkC", "TileDarkA"))
    else:
        h = house_body(x=-0.1, z=H_Z, w=1.4, d=H_D, wall_top=0.48, ridge_y=0.86, roof="tile", wall="StoneA", timber=False, roof_color=("SlateA", "SlateB", "SlateC", "SlateA"))
    f = h["front"]
    door(0.25, f, w=0.13, h=0.2)
    for x in ((-0.62, -0.38, -0.14) if lvl < 3 else (-0.62, -0.38)):
        window(x, 0.27, f + 0.002, "z", lit=lvl >= 2 and x > -0.5, shutters="Shutter" if lvl < 3 else None, w=0.07, h=0.07)
    window(0.55, 0.27, f + 0.002, "z", lit=True, shutters="Shutter" if lvl < 3 else None, w=0.07, h=0.07)
    # oefenschilden aan de gevel (boven de rekken)
    for k, x in enumerate((-0.5, -0.27)):
        cyl(0.04, 0.04, 0.01, 10, "Banner" if k == 0 else "RedC", pos=(x, 0.36, f + 0.004), rot=(math.pi / 2, 0, 0), smooth=False)
        cyl(0.014, 0.014, 0.014, 6, "BannerG", pos=(x, 0.36, f + 0.006), rot=(math.pi / 2, 0, 0), smooth=False)
    smoke = chimney(-0.45 if lvl < 3 else -0.5, H_Z - 0.06, h["ridge"] - 0.2, h["ridge"] + 0.16)
    return h, smoke


def tower():
    """level 3: vierkante hoektoren met kantelen (achter-rechts), vaandel bovenop"""
    tx, tz, s = 0.74, -0.7, 0.34
    box(s, 1.0, s, "StoneA", pos=(tx, 0.04, tz), bevel=0.01)
    for k in range(4):
        box(s + 0.02, 0.03, s + 0.02, "StoneB", pos=(tx, 0.28 + k * 0.22, tz))
    box(s + 0.06, 0.05, s + 0.06, "StoneD", pos=(tx, 1.04, tz), bevel=0.006)
    for i in range(3):
        for sgn in (-1, 1):
            box(0.07, 0.07, 0.05, "StoneL", pos=(tx - 0.12 + i * 0.12, 1.09, tz + sgn * (s / 2 + 0.005)))
            box(0.05, 0.07, 0.07, "StoneL", pos=(tx + sgn * (s / 2 + 0.005), 1.09, tz - 0.12 + i * 0.12))
    window(tx, 0.55, tz + s / 2 + 0.004, "z", lit=True, shutters=None, w=0.06, h=0.09)
    window(tx - s / 2 - 0.004, 0.8, tz, "-x", lit=False, shutters=None, w=0.05, h=0.08)
    return flag_pole(tx, tz, 1.09, 0.32)


def build(lvl):
    earth_base(1.92, 1.92, top=0.04, clumps=18, pebbles=8, flowers=4, keep_clear=[(GATE[0] - 0.05, GATE[1] + 0.05, 0.8, 1.0)])
    # oefenterrein: aangestampt zand met wat sporen
    box(1.78, 0.008, 1.22, "Sand", pos=(0.0, 0.036, 0.32))
    for _ in range(9):
        box(rnd.uniform(0.06, 0.16), 0.004, rnd.uniform(0.04, 0.08), "SandD",
            pos=(rnd.uniform(-0.6, 0.6), 0.044, rnd.uniform(-0.15, 0.85)), rot=(0, rnd.uniform(0, 3.1), 0))
    h, smoke = hall(lvl)
    # omheining met poort
    palisade((-0.93, -0.33), (-0.93, 0.93), 6)
    palisade((0.93, -0.33), (0.93, 0.93), 6)
    palisade((-0.93, 0.93), (GATE[0] - 0.02, 0.93), 5)
    palisade((GATE[1] + 0.02, 0.93), (0.93, 0.93), 2)
    gate()
    # wapenrekken tegen de voorgevel en een pallet voor de trainingsuitrusting
    racks = [weapon_rack(-0.6, -0.27), weapon_rack(-0.18, -0.27)]
    box(0.2, 0.02, 0.15, "Wood", pos=(0.66, 0.04, -0.2), bevel=0.003)
    for dx in (-0.06, 0.0, 0.06):
        box(0.03, 0.012, 0.15, "WoodL", pos=(0.66 + dx, 0.06, -0.2))
    gear = (0.66, 0.072, -0.2)
    # oefenplekken: (stand, kijkrichting, soort, doel)
    E, W_ = math.pi / 2, -math.pi / 2
    t1 = target(-0.84, 0.14)
    drill = [((0.44, 0.04, 0.08), E, "dummy", (0.72, 0.22, 0.08)),
             ((0.0, 0.04, 0.14), W_, "target", t1),
             ((-0.28, 0.04, 0.7), W_, "drill", pell(-0.6, 0.7))]
    anims = {"dummy0": (0.72, 0.04, 0.08)}
    if lvl >= 2:
        drill.append(((0.44, 0.04, 0.52), E, "dummy", (0.72, 0.22, 0.52)))
        anims["dummy1"] = (0.72, 0.04, 0.52)
    if lvl >= 3:
        drill.append(((0.0, 0.04, 0.42), W_, "target", target(-0.84, 0.42)))
    # vaandel en aankleding
    if lvl >= 3:
        anims["flag"] = tower()
    else:
        beam((0.86, 0.04, -0.28), (0.86, 0.66, -0.28), 0.018, "Timber")
        anims["flag"] = (0.865, 0.66, -0.28)
        blob(0.016, "BannerG", (0.86, 0.675, -0.28), sub=1)
    hay_bale(-0.72, 0.87, y=0.04, along="x", r=0.05, l=0.12)
    hay_bale(-0.56, 0.88, y=0.04, along="x", r=0.05, l=0.11)
    hay_bale(-0.64, 0.87, y=0.14, along="x", r=0.045, l=0.1)
    barrel(0.43, -0.24, y=0.04)                                          # ton met houten oefenzwaarden
    for k in range(4):
        box(0.01, 0.13, 0.016, "WoodL", pos=(0.42 + (k % 2) * 0.02, 0.12, -0.25 + (k // 2) * 0.02), rot=(0.15 * (k - 1.5), 0, 0.1 * (k - 1.5)))
    if lvl >= 2:
        # bank langs de omheining en een drinkbak
        box(0.3, 0.02, 0.06, "Wood", pos=(0.1, 0.12, 0.85), bevel=0.004)
        for dx in (-0.12, 0.12):
            box(0.02, 0.08, 0.05, "Timber", pos=(0.1 + dx, 0.04, 0.85))
        box(0.08, 0.06, 0.18, "Wood", pos=(0.8, 0.04, 0.8), bevel=0.004)      # drinkbak
        box(0.06, 0.004, 0.16, "Water", pos=(0.8, 0.098, 0.8))
    if lvl >= 3:
        # tweede vaandel aan de gevel
        box(0.1, 0.2, 0.008, "Banner", pos=(0.0, 0.18, h["front"] + 0.01))
        box(0.04, 0.04, 0.006, "BannerG", pos=(0.0, 0.3, h["front"] + 0.016))
    for _ in range(3):
        pebble(rnd.uniform(-0.4, 0.2), rnd.uniform(0.3, 0.6), rnd.uniform(0.012, 0.02), 0.04)
    return {"smoke": [smoke], "anims": anims, "racks": racks, "inp": [gear], "drill": drill}


build_levels("barracks", build, args, parts={"dummy": dummy_part})
