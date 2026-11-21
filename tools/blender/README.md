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
