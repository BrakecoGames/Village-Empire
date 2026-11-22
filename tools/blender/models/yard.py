"""Village Empire — startvoorraad (2×2 tegels, 1 level), vroeger de Stockyard.

Geen erf, geen hek en geen pallets: de goederen die de bewoners meebrachten liggen gewoon opgestapeld in het
gras naast het dorpshuis. Het model bevat alleen een paar graspollen; de stapels zelf tekent de game
(VE.StockpileRender) op 16 losse plekken, markers yard_l1_slot0..15 (gelijk aan VE.STORE_SLOTS.yard in
js/models.js; de middelste plekken worden het eerst gevuld). Is de voorraad op, dan verdwijnt alles.
Bouwen: npm run models -- yard"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "lib"))
import ve_blender as ve  # noqa: E402
from ve_parts import *  # noqa: E402,F401,F403
from ve_parts import rnd  # noqa: E402

args = ve.parse_args()
ve.reset_scene()
setup(seed=6202)
SLOTS = [(x, 0.012, z) for x, z in [[-0.24, -0.2], [0.2, -0.14], [-0.18, 0.22], [0.24, 0.28], [-0.62, -0.58], [-0.2, -0.66], [0.22, -0.6], [0.64, -0.52], [-0.66, -0.16], [0.6, -0.1], [-0.6, 0.26], [0.66, 0.32], [-0.56, 0.66], [-0.14, 0.62], [0.28, 0.68], [0.68, 0.72]]]


def build(lvl):
    # een paar graspollen tussen de stapels, zodat het geheel in het gras ligt
    for x, z in ((-0.85, 0.1), (0.82, -0.3), (0.05, 0.86), (-0.4, -0.88), (0.42, 0.02), (-0.42, 0.44)):
        grass_clump(x, z, rnd.uniform(0.8, 1.1), 0.0)
    return {"slots": SLOTS}


build_levels("yard", build, args, levels=(1,), ao=False)
