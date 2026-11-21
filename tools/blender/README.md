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

## Integratie in de game (nog niet actief)

De game bouwt zijn modellen nu procedureel in `js/models.js`. Om GLB's te gebruiken:

```html
<!-- in index.html, na three.min.js (r128) -->
<script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js"></script>
```

```js
// eenmalig laden en cachen; daarna per gebouw clonen
const loader = new THREE.GLTFLoader();
const cache = {};
VE.loadModel = name => cache[name] || (cache[name] = new Promise((ok, fail) =>
  loader.load('public/models/' + name + '.glb', g => ok(g.scene), undefined, fail)));
// gebruik:  VE.loadModel('test_cube').then(src => { const m = src.clone(); m.traverse(o => { if (o.isMesh) o.castShadow = o.receiveShadow = true; }); group.add(m); });
```

Let op: zet `renderer.outputEncoding = THREE.sRGBEncoding` niet zomaar aan in de game, want dat
verandert alle bestaande kleuren. Zonder die instelling zien GLB-kleuren er iets donkerder uit dan
de hex-waarde. Kies dit bewust wanneer je overstapt.
