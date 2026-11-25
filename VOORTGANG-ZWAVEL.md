# Voortgang: zwavel en buskruit

Checkpoint: tag `checkpoint-voor-zwavel-buskruit` (commit `c318976`).
Hervatten: lees dit bestand en ga verder bij de eerste open taak. Afgeronde taken niet opnieuw doen.

## Taken
- [x] Git-checkpoint
- [x] Grondstoffen `sulfur` en `gunpowder` (config, iconen in util.js, stapels in fx.js, reserve in models.js,
      Blender in items.py). `VE.FUTURE_USES.gunpowder` voor later (kanonnen, mortieren, artillerie, beleg).
- [x] Zwavel = ertssoort 6 (`VE.ORES[6]`).
  - `Mining.generateSulfur`: zes velden op de vulkaanhelling. Drie zijn eigen velden (één per speler), drie zijn
    rijk en betwist (tussen twee spelers).
  - `Mining.regen`: +1 per afzetting per 45 s. Lege plekken blijven in de save.
  - Oude saves met een vulkaan krijgen ook zwavel.
- [x] Zichtbare afzettingen: `js/sulfur.js` (InstancedMesh, grootte naar voorraad, damp uit rijke velden),
      Blender `sulfur.py` → `sulfur.glb`.
- [x] Zwavelmijn `sulfurmine`:
  - rang 2, alleen op de vulkaanhelling;
  - de mijnwerker loopt, graaft en draagt zichtbaar (`Game.thinkSurfaceMine`), lokale opslag 6;
  - Blender `sulfurmine.py`.
- [x] Buskruitwerkplaats `powdermill`:
  - rang 3, recept zwavel + steenkool + hout → 2 buskruit in 9 s;
  - stampmolen met animatie 'stamp';
  - Blender `powdermill.py`.
- [x] Playwright `tests/zwavel.spec.js`: 4/4 groen (desktop + mobiel)
- [x] Volledige suite: 175 ok, 1 instabiele natuurtest opgelost (pad op gras)
- [x] Rapport RAPPORT-ZWAVEL-BUSKRUIT.md + lokale commit

## Testresultaten
De volledige keten (desktop) in 15 minuten: 78 zwavel en 60 buskruit, alles in de opslag. De mijn had nooit
meer dan 6, de zwavel kwam terug, en opslaan, laden en oude saves werken.
