# Voortgang: lagere bergen, steen, steenmijn, wachttorens op bergen

Checkpoint: tag `checkpoint-voor-bergen-steenmijn` (commit `5237dab`, versie 1.10.0 + verwijderde opdracht).
Hervatten: lees dit bestand, ga verder bij de eerste open taak. Afgeronde taken niet opnieuw doen.

## Taken
- [x] Git-checkpoint
- [x] Onderzoek. Het terrein wordt bij het laden opnieuw uit de seed gemaakt. Daarom krijgt de generator een
      versie: `VE.GEN = 2` (config.js) en `save.g`; oude saves zonder `g` gebruiken generator 1.
- [x] Lagere bergen met terrassen: `World.mountainH` (world.js), gebruikt in `generateBig` en `generate` bij gen ≥ 2.
      Gebouwen mogen op bergen, behalve akkers. Hellinglimiet 0,95 (1 tegel) / 1,25 (2×2).
      De padzoeker telt de steilte per tegel mee (`World.slopeOf`, gecachet).
- [x] Meer natuursteen bij gen 2: meer rotsblokken in de bergen (0,2), verspreide keien (0,011) en 6 groepjes per start.
- [x] Steenmijn `stonemine` (config, rang 1 Village, kost 6 planken + 2 stammen, ore 5 = gesteente, raakt nooit op;
      mining.js `rockNear`), opdracht v11, infopaneel, procedurele reserve.
- [x] Blender-model `tools/blender/models/stonemine.py` → `public/models/stonemine.glb`, in glb-models.js.
- [x] Wachttorens: `Game.towerView` (+0 tot +9 tegels ontdekken, afhankelijk van de hoogte), melding bij plaatsen.
- [x] Wereldverdeling gecontroleerd (rotsblokken, erts, plateaus en mijnplekken per start ongeveer gelijk).
- [x] Playwright-tests `tests/bergen.spec.js`: 6/6 groen (desktop + mobiel)
- [x] Volledige suite (167 ok, 2 opgelost: steile oevers, vulkaantest), opnieuw getest: 29/29
- [x] Rapport RAPPORT-BERGEN-STEEN.md + lokale commit

## Testresultaten
Zie RAPPORT-BERGEN-STEEN.md. Alles af; wacht op "upload" van de gebruiker.
