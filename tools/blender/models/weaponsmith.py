"""Village Empire — Weaponsmith (wapensmederij), drie upgrade-levels in één GLB.

Herkenbaar aan:
  - een vakwerk-smidse met rode golfpannen en een bakstenen schoorsteen (rook);
  - een open smidshaard onder een afdak met gloeiende kolen (anker 'glow', vonken) en een blaasbalg
    (anker 'bellows', beweegt);
  - een aambeeld op een eiken stronk vóór de smidse. Daarop ligt het wapen dat gesmeed wordt
    (anker 'hotblade': gloeit tijdens het smeden, vonken bij elke hamerslag; de smid staat ervoor);
  - wapenrekken met zwaarden, speren en strijdbijlen, een schild aan de muur en een uithangbord met
    gekruiste zwaarden;
  - een ton met water om te blussen.
Level 2: slijpsteen, gereedschapsrek met tangen, tweede wapenrek. Level 3: hogere schoorsteen, bogen en
kruisbogen aan de muur, schildenrek.
De werkelijke voorraad wapens (max. 6) ligt op de marker 'pile' (VE.StockpileRender).

Bouwen: npm run models -- weaponsmith
"""
import math
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "lib"))
import ve_blender as ve  # noqa: E402
from ve_parts import *  # noqa: E402,F401,F403
from ve_parts import rnd  # noqa: E402

args = ve.parse_args()
args.budget = max(args.budget, 4200)
ve.reset_scene()
setup(seed=7712, extra_palette={
    "Hearth": (0x8E4A34, 0.08), "HearthD": (0x6A3424, 0.06), "Soot": (0x2A2220, 0.03), "Coals": (0x3A1A12, 0.04),
    "Steel": (0xB8C0C8, 0.02), "SteelD": (0x7E868E, 0.03), "Leather": (0x6A4228, 0.05), "Grip": (0x4A2E1C, 0.04),
    "Shield": (0x2F6FB0, 0.04), "ShieldR": (0xC8402F, 0.04), "Water": (0x4A9BD1, 0.02), "Grind": (0x9C968A, 0.05),
    "Bow": (0x9A6A3A, 0.04), "String": (0xEDE3C8, 0.0),
})


def sword_on_rack(x, z, y0, lean=0.0, rot=0.0):
    """rechtop staand zwaard (punt omlaag) in een rek"""
    box(0.016, 0.2, 0.006, "Steel", pos=(x, y0, z), rot=(lean, rot, 0))
    box(0.07, 0.014, 0.014, "SteelD", pos=(x, y0 + 0.2, z), rot=(lean, rot, 0))
    box(0.014, 0.05, 0.014, "Grip", pos=(x, y0 + 0.212, z), rot=(lean, rot, 0))
    blob(0.011, "Gold", (x, y0 + 0.268, z), sub=0, smooth=False)


def spear_on_rack(x, z, y0, lean=0.0):
    cyl(0.006, 0.006, 0.42, 5, "WoodL", pos=(x, y0, z), rot=(lean, 0, 0), smooth=False)
    cyl(0.0, 0.014, 0.06, 4, "Steel", pos=(x, y0 + 0.42, z + math.sin(lean) * 0.42), rot=(lean, 0, 0), smooth=False)


def axe_on_rack(x, z, y0):
    box(0.012, 0.26, 0.012, "Wood", pos=(x, y0, z))
    box(0.07, 0.05, 0.008, "Steel", pos=(x + 0.03, y0 + 0.2, z), bevel=0.002)
    box(0.04, 0.03, 0.008, "SteelD", pos=(x - 0.025, y0 + 0.21, z))


def weapon_rack(x, z, lvl, rot=0.0):
    """rek: twee staanders, een dwarsbalk en een voetplank met gaten; zwaarden en speren"""
    for dx in (-0.12, 0.12):
        beam((x + dx, 0.04, z), (x + dx, 0.3, z), 0.02, "Timber")
    beam((x - 0.13, 0.28, z), (x + 0.13, 0.28, z), 0.018, "Timber")
    box(0.28, 0.02, 0.06, "Wood", pos=(x, 0.06, z), bevel=0.003)
    sword_on_rack(x - 0.07, z + 0.012, 0.07, lean=-0.08)
    sword_on_rack(x - 0.02, z + 0.012, 0.07, lean=-0.06)
    spear_on_rack(x + 0.04, z + 0.01, 0.07, lean=-0.07)
    if lvl >= 2:
        axe_on_rack(x + 0.09, z + 0.012, 0.07)


def smithy(lvl):
    """vakwerk-smidse achter-links met rode golfpannen; open zijde naar de haard"""
    h = house_body(x=-0.16, z=-0.2, w=0.5, d=0.32, wall_top=0.38, ridge_y=0.66, roof="tile", wall="Plaster", timber=True)
    door(-0.28, h["front"], w=0.12, h=0.19)
    window(-0.06, 0.2, h["front"] + 0.002, "z", lit=True, shutters="Shutter", w=0.08, h=0.08)
    # uithangbord met gekruiste zwaarden
    beam((-0.42, 0.33, h["front"] + 0.0), (-0.42, 0.33, h["front"] + 0.12), 0.012, "Iron")
    box(0.012, 0.1, 0.1, "WoodL", pos=(-0.42, 0.23, h["front"] + 0.09), bevel=0.003)
    for s in (-1, 1):
        box(0.006, 0.09, 0.008, "Steel", pos=(-0.41, 0.235, h["front"] + 0.09), rot=(s * 0.7, 0, 0))
    # schild aan de gevel
    cyl(0.05, 0.05, 0.012, 10, "Shield", pos=(0.03, 0.27, h["front"] + 0.002), rot=(math.pi / 2, 0, 0), smooth=False)
    cyl(0.018, 0.018, 0.016, 8, "Gold", pos=(0.03, 0.27, h["front"] + 0.004), rot=(math.pi / 2, 0, 0), smooth=False)
    if lvl >= 3:
        # bogen en kruisboog aan de muur
        for k in range(2):
            cyl(0.07, 0.07, 0.008, 10, "Bow", pos=(-0.15 + k * 0.05, 0.27, h["front"] + 0.006), rot=(math.pi / 2, 0, 0), arc=(0.3, 2.5), cap=False, smooth=False)
        box(0.09, 0.012, 0.012, "Wood", pos=(0.12, 0.3, h["front"] + 0.006))
        box(0.012, 0.06, 0.01, "Steel", pos=(0.16, 0.27, h["front"] + 0.006))
    return h


def hearth(x, z, lvl):
    """open smidshaard onder een afdak: stenen haard met gloeiende kolen, kap en schoorsteen"""
    box(0.26, 0.16, 0.22, "Hearth", pos=(x, 0.04, z), bevel=0.008)
    box(0.22, 0.012, 0.18, "Coals", pos=(x, 0.2, z))
    for k in range(9):
        blob(rnd.uniform(0.012, 0.02), "Soot" if k % 3 else "Coals", (x + rnd.uniform(-0.08, 0.08), 0.215, z + rnd.uniform(-0.06, 0.06)), sub=0, smooth=False)
    # kap boven de haard en bakstenen schoorsteen
    prism([(-0.13, 0.0), (0.13, 0.0), (0.06, 0.16), (-0.06, 0.16)], 0.22, "HearthD", pos=(x, 0.4, z - 0.02), axis="z")
    top = 1.02 if lvl >= 3 else 0.92
    box(0.11, top - 0.56, 0.11, "Brick", pos=(x, 0.56, z - 0.02), bevel=0.004)
    box(0.13, 0.03, 0.13, "StoneD", pos=(x, top - 0.03, z - 0.02), bevel=0.003)
    box(0.08, 0.008, 0.08, "Soot", pos=(x, top, z - 0.02))
    # afdak op twee palen
    for dz in (0.14,):
        for dx in (-0.16, 0.16):
            beam((x + dx, 0.04, z + dz), (x + dx, 0.42, z + dz), 0.02, "Timber")
    beam((x - 0.17, 0.42, z + 0.14), (x + 0.17, 0.42, z + 0.14), 0.02, "Timber")
    return (x, top + 0.04, z - 0.02), (x, 0.205, z + 0.05)


def anvil(x, z):
    """aambeeld op een eiken stronk, met hoorn; het wapen erop is het anker 'hotblade'"""
    cyl(0.05, 0.058, 0.08, 9, "LogD", pos=(x, 0.04, z), smooth=False)
    cyl(0.044, 0.044, 0.006, 9, "LogEnd", pos=(x, 0.12, z), smooth=False)
    box(0.05, 0.035, 0.04, "SteelD", pos=(x, 0.126, z), bevel=0.004)
    box(0.1, 0.03, 0.05, "Iron", pos=(x, 0.16, z), bevel=0.005)
    cyl(0.0, 0.02, 0.055, 6, "Iron", pos=(x + 0.05, 0.175, z), rot=(0, 0, -math.pi / 2), smooth=False)     # hoorn
    # tang en hamer naast het aambeeld
    beam((x - 0.07, 0.04, z + 0.05), (x - 0.05, 0.15, z + 0.03), 0.006, "Iron")
    return (x - 0.005, 0.193, z)


def build(lvl):
    earth_base(0.9, 0.88, top=0.04, clumps=6, pebbles=6, flowers=1,
               keep_clear=[(-0.4, 0.45, -0.05, 0.5)])
    smithy(lvl)
    smoke, coals = hearth(0.28, -0.12, lvl)
    # blaasbalg naast de haard (beweegt in de game)
    box(0.1, 0.05, 0.08, "Wood", pos=(0.44, 0.04, -0.1), bevel=0.004)
    beam((0.4, 0.09, -0.1), (0.36, 0.14, -0.1), 0.01, "Iron")
    bel = (0.44, 0.09, -0.1)
    hot = anvil(0.06, 0.2)
    weapon_rack(-0.24, 0.22, lvl)
    # blusvat
    barrel(0.36, 0.22, y=0.04)
    cyl(0.044, 0.044, 0.004, 10, "Water", pos=(0.36, 0.165, 0.22), smooth=False)
    if lvl >= 2:
        # slijpsteen op een bok
        for dx in (-0.03, 0.03):
            beam((0.42 + dx, 0.04, 0.0), (0.42 + dx, 0.12, 0.0), 0.012, "Timber")
        cyl(0.05, 0.05, 0.02, 12, "Grind", pos=(0.42, 0.13, -0.01), rot=(0, 0, math.pi / 2), center=True, smooth=False)
        beam((-0.45, 0.06, -0.38), (-0.45, 0.3, -0.38), 0.012, "Timber")         # tangen aan de achtermuur
        for k in range(3):
            beam((-0.44, 0.27 - k * 0.002, -0.37 + k * 0.03), (-0.44, 0.12, -0.36 + k * 0.03), 0.005, "Iron")
    if lvl >= 3:
        # schildenrek
        for k in range(2):
            cyl(0.045, 0.045, 0.012, 10, "ShieldR" if k else "Shield", pos=(-0.42 + k * 0.08, 0.12, 0.38), rot=(math.pi / 2 - 0.2, 0, 0), smooth=False)
        beam((-0.46, 0.04, 0.4), (-0.3, 0.04, 0.4), 0.014, "Timber")
    for _ in range(4):
        pebble(rnd.uniform(-0.1, 0.3), rnd.uniform(0.3, 0.42), rnd.uniform(0.012, 0.02), 0.04)
    return {"smoke": [smoke], "anims": {"glow": coals, "bellows": bel, "hotblade": hot}, "pile": (0.22, 0.04, 0.4)}


build_levels("weaponsmith", build, args)
