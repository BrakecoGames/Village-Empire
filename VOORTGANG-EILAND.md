# Voortgang: eilandwereld en Fog of War

Checkpoint: tag `checkpoint-voor-eiland` (commit `6dc715c`, versie 1.11.0).
Hervatten: lees dit bestand en ga verder bij de eerste open taak. Afgeronde taken niet opnieuw doen.

## Taken
- [x] Git-checkpoint
- [x] Generator 3 (`VE.GEN = 3`, config.js). Oude saves houden hun eigen generator (`save.g`).
- [x] Eiland in worldgen.js:
  - kustwaarde `c` uit ruis met drievoudige symmetrie (eerlijk voor drie spelers);
  - een baai bij elke start (`world.island.harbors`, voor latere havens);
  - stranden, kustkliffen (type 4, volc 5, grijze gelaagde rots) en rotspilaren in zee (type 2, volc 5);
  - `world.sea` = water dat met de kaartrand verbonden is;
  - de vulkaan is hoger (10,2).
- [x] horizon.js: rond een eiland geen buitenland, alleen zee (zelfde diepblauw).
- [x] Water (world.js `buildWater`): schuimrand en rollende schuimkoppen langs de kust (`aShore`), rustigere golven
      in diep water.
- [x] Horizontale mist (`fogTop`, afstandsveld `fogD`, wolkenbank over 7 tegels); vulkaan generator 3 = brede voet
      + steile topkegel (top ~13 tegen mist ~7); `buildPeak` tekent de top zonder scèneneveltje; minimap verbergt onontdekt land.
- [x] Baaien met een geul naar open zee; cirkelvormige kaartrand-zee (symmetrisch); kliffen betrouwbaarder.
- [x] Playwright-tests (12× eiland, 4× mist herhaald, mobiel groen) `tests/eiland.spec.js`: eiland, zee rondom, kust, eerlijkheid, mist verbergt alles behalve
      de vulkaan, camerahoeken en zoomniveaus, prestaties
- [x] Volledige suite en oude tests bijgewerkt
- [x] Rapport RAPPORT-EILAND.md + lokale commit

## Testresultaten
(nog niets)
