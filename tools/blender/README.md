# Blender-workflow (Village Empire)

Modellen worden **in code** gemaakt: één Python-script per model, uitgevoerd door Blender
via de commandline (geen GUI). Het resultaat is een `.glb` in `public/models/`, dat
automatisch gecontroleerd wordt.

```
tools/blender/
  lib/ve_blender.py      gedeelde helpers: scène, materialen, flat shading, oorsprong, export
  models/<naam>.py       één script per model  ->  public/models/<naam>.glb
  build.mjs              zoekt Blender, bouwt modellen, controleert de GLB
  verify-glb.mjs         GLB-controle (header, meshes, driehoeken, grootte) zonder dependencies
  preview.html           bekijk een model in Three.js r128 (zelfde versie als de game)
public/models/           gegenereerde .glb-bestanden
tests/models.spec.js     Playwright: elk model moet laden in Three.js r128
```

## Commando's

```
npm run models                    # alle modellen bouwen
npm run models -- test_cube       # één model bouwen
npm run models:verify -- public/models/test_cube.glb
npx playwright test tests/models.spec.js --project=desktop
```

Preview, met de testserver (`npm run serve`):
`http://127.0.0.1:4173/tools/blender/preview.html?model=test_cube`

Blender wordt automatisch gevonden in `C:\Program Files\Blender Foundation\Blender *` (nieuwste versie)
of op het PATH. Wil je een andere versie gebruiken, zet dan `BLENDER_EXE`.

## Gedeelde bouwstenen en AO (`lib/ve_parts.py`)

Modelscripts doen `from ve_parts import *`, roepen `setup(seed, extra_palette)` aan, bouwen per level
met de onderdelen (`box`, `cyl`, `beam`, `gable_roof(kind="tile"|"shingle")`, `window`, `door`,
`earth_base`, `grass_clump`, `chimney`, …) en eindigen met `build_levels("<type>", build, args)`.
Dat voegt per level samen, bakt **ambient occlusion** (Cycles, met grondvlak) in de vertex-kleur
`COLOR_0` en exporteert. De game verrekent de AO bij het laden (`AO_STRENGTH` / `AO_SKIP` in
`js/glb-models.js`); grote vlakken (stuc, aarde) krijgen geen AO. Uitzetten: omgevingsvariabele
`VE_NO_AO=1`. Stijlregels: [docs/STIJLGIDS.md](../../docs/STIJLGIDS.md).

## Nieuw model toevoegen

1. Kopieer `models/test_cube.py` naar `models/<naam>.py`.
2. Bouw de vorm op met `bpy.ops.mesh.primitive_*`, bmesh of modifiers. Gebruik `ve.material(...)`
   met `ve.hex_color(0xRRGGBB)`, zodat kleuren overeenkomen met de hex-waarden in de game.
3. Sluit af met `ve.origin_bottom_center(obj)` en `ve.export_glb(args.out, args.budget)`.
4. Draai `npm run models -- <naam>` en controleer het model in de preview of met de Playwright-test.

## Richtlijnen voor CrazyGames / HTML5

| | Richtwaarde |
|---|---|
| Schaal | 1 Blender-eenheid = 1 tegel; oorsprong onderaan in het midden |
| Driehoeken | ≤ 300 voor props, ≤ 1500 voor gebouwen, harde grens 3000 (`--budget`) |
| Bestandsgrootte | < 50 KB per model; `verify-glb` waarschuwt boven 200 KB |
| Materialen | ≤ 4 per model, alleen kleur (geen textures, geen UV's) |
| Meshes | Voeg delen met `ve.join()` samen; Three.js gebruikt één draw call per materiaal |
| Compressie | Geen Draco: de game gebruikt r128 zonder DRACOLoader |
| Licht/camera | Worden niet geëxporteerd; de game regelt dat zelf |

Voor veel exemplaren (bomen, stenen) gebruik je in de game een `InstancedMesh` op basis van de geometrie uit de GLB.

## Integratie in de game (actief voor: Cottage / `house`)

`js/glb-models.js` laadt de GLB's tijdens het opstarten (parallel aan de SDK) en zet elke
variant om naar **hetzelfde formaat als de procedurele modellen**: één niet-geïndexeerde
geometrie met `position`/`normal`/`color`, getekend met het gedeelde `game.mats.building`.
Het resultaat komt in `VE.modelCache['<type>_<level>']`, dus `VE.buildModel` en alles
daarachter (plaatsen, ghost, bouwsteiger, selectie, upgrades, opslaan) werkt ongewijzigd.

- **Eén GLB per gebouwtype**, met één node per upgrade-level (`house_l1`, `house_l2`, `house_l3`)
  en optioneel een lege marker `<node>_smoke` voor de rook uit de schoorsteen.
- **Kleuren:** materiaalkleuren worden vertex-kleuren (lineair → sRGB, zodat ze kloppen met de
  hex-kleuren in de game). De naam `Naam@0.07` geeft de kleurvariatie per driehoek.
- **Prestaties:** alle exemplaren van een level delen één geometrie (1 draw call per gebouw).
- **Fallback:** ontbreekt de GLTFLoader, faalt de download of mist een node, dan blijft het
  procedurele model in gebruik (`VE.modelSource.house === 'procedural'`). Laadt de GLB pas na
  de time-out (10 s), dan worden bestaande gebouwen alsnog omgezet.
- **Enkelzijdig:** de game tekent alleen voorkanten. `ve.material` exporteert daarom met
  `doubleSided: false`, zodat de preview hetzelfde toont als de game.

Nog een gebouw omzetten: script `models/<type>.py` met nodes `<type>_l1..l3`, `npm run models`,
en in `glb-models.js` een regel aan `SOURCES` toevoegen.

### Valkuilen (geleerd bij het huisje)
- Gebruik voor halve buizen/bogen `half_tube(center, axis, bulge, ...)` met richtingsvectoren,
  niet Euler-hoeken: met hoeken wijst de bolling al snel de verkeerde kant op.
- Open vormen: zet normalen expliciet naar buiten; `recalc_face_normals` raadt daar soms fout.
- Zet na het samenvoegen de oorsprong op (0,0,0), anders krijgt de node een eigen verschuiving.

## Natuur (`models/nature.py` → `public/models/nature.glb`)

37 nodes in één GLB: 12 boomsoorten (eik, oude eik, beuk, berk, jonge boom, den, spar, appel,
peer, bloesem + 2 easter eggs), 6 struiken, 5 grassoorten, 5 bloemgroepjes en 9 details/eggs.
De game (`js/nature-glb.js`) maakt van elke node één InstancedMesh. Materiaalnamen sturen de
wind: `Leaf*`, `Needle*`, `Blossom*`, `Fruit*`, `Grass*`, `Fl*`, `Petal*`, `Berry*` bewegen,
`Twig*` een beetje, stam/steen/hout niet. Grassoorten zijn licht van kleur: de game tint ze per
exemplaar. Bouwen: `npm run models -- nature`. Uitschakelen om te vergelijken: `index.html?oldnature`.

## Wilde dieren (`models/animals.py` → `public/models/animals.glb`)

Zeven soorten (konijn, ree, hert, wild zwijn, vos, eekhoorn, zangvogel), opgebouwd zoals de bewoners:
- **Rig per soort:** lege nodes `rig_<soort>_<node>` (root, body, head, tail, legFL/FR/BL/BR; herten en
  reeën ook `neck`; de vogel `wingL`/`wingR`).
- **Delen:** `<soort>__<node>__<deel>`. Een deel op `legF` of `legB` wordt in de game aan beide kanten
  gebruikt (linker- en rechterpoot). Het gewei (`deer__head__antlers`) krijgen alleen bokken.
- **Clips:** NLA-tracks `<soort>_<clip>`, met idle, walk, run, eat, alert en rest. Daarnaast heeft de vos
  `pounce`, de vogel `fly` en `walk` (hupjes), zit het konijn bij `alert` rechtop en heeft de
  eekhoorn bij `eat` een nootje.

Valkuil: de draaipunten in `quad_nodes` zijn plekken t.o.v. het midden van het lijf (`hb`). Een draaipunt
op grondhoogte laat de kop bij het grazen los van het lijf zwaaien.
In de game (`js/wildlife.js`) is elk deel één InstancedMesh voor alle dieren van die soort. Bouwen:
`npm run models -- animals`. Zonder GLB (`index.html?noanimals`) tekent een procedurele reserve.

## Jacht en mijnbouw

- `models/hunter.py`: jagershut, 3 levels, rook en `pile`-marker.
- `models/smelter.py`: smelterij, 3 levels. De gloed (`anim_glow`) en de blaasbalg (`anim_bellows`)
  bewegen in de game.
- `models/mine.py`: één mijnschacht, `mine_l1..l3`, gedeeld door alle vier de mijnen. De materialen `Vein`
  en `Vein2` krijgen per mijntype de kleur van het erts (`TYPES.<mijn>.tint` in `js/glb-models.js`). Het
  karretje (`anim_cart`) rijdt over de rails en de katrol (`anim_wheel`) draait.
- `models/ores.py`: ertsaders `ore_<coal|iron|copper|gold>_<0|1>`, geladen door `js/mining.js`.
