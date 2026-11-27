# Rapport: eekhoorns en de grote wereld

Git-checkpoints: tag `checkpoint-voor-eekhoorns-wereld` (vóór de eekhoorns) en `checkpoint-voor-grote-wereld`
(na de eekhoorns, vóór de grote wereld).

## 1. Eekhoorns

### Model (Blender: `tools/blender/models/animals.py`, functie `squirrel`)
- Volledig nieuw model: 840 driehoeken (binnen de gevraagde 500–1.200).
- **Vorm:**
  - een slank, langgerekt lijf met een lichte buik en borst;
  - een nek die kop en lijf laat overvloeien;
  - witte wangen, oortjes met pluimen en grote ogen met een lichtpuntje;
  - kleine voorpootjes met handjes;
  - sterke dijen met lange achtervoeten.
- **Staart:** een grote, volle staart in een S-boog. Hij bestaat uit drie delen (`tail1`–`tail3`) van
  doorlopende, zacht afgeronde buizen, met een donkerdere rugzijde en een licht puntje. Elk deel heeft
  een eigen skeletknoop, zodat de staart vloeiend golft.
- **Kleur:** roodbruine vacht met weinig kleurruis per vlakje.
- **Twaalf animaties:**

  | Animatie | Wat hij doet |
  |---|---|
  | `idle` | rondkijken, staart trilt |
  | `walk` | huppen |
  | `run` | galop |
  | `forage` | snuffelen en graven met de voorpootjes |
  | `sit` | rechtop met een nootje |
  | `alert` | rondkijken |
  | `rest` | rusten |
  | `climb` | kop omhoog, pootjes wijd om de stam, staart sleept omlaag |
  | `descend` | kop omlaag, achtervoeten naar achteren gedraaid |
  | `jump` | gestrekt, staart als roer |
  | `perch` | op een tak, staart als vraagteken over de rug |
  | `eat` | eten |

### Klimmen langs de echte stam
- **Klimdata uit Blender:** `nature.py` schrijft per boomsoort `public/models/nature-climb.json` weg,
  met de echte stamlijn (punten + straal) en de beloopbare takken (dik genoeg, niet te steil). Dat
  komt rechtstreeks uit dezelfde `chain`/`limb`-aanroepen die de boom bouwen.
- **Omrekenen per boom:** `js/squirrel.js` rekent die data per boom om naar de wereld: positie,
  draaiing en schaal van dat exemplaar.
- **Positie op de stam:** de eekhoorn staat op `as(h) + normaal · straal(h)`.
  - de buik is naar de stam gericht;
  - bij klimmen is de kop omhoog, bij afdalen omlaag;
  - hij volgt de kromming van iedere soort (kromme eik, scheve den, rechte beuk).
- **Knikken in kromme stammen:** een kleine correctie duwt hem naar buiten, want in de binnenbocht ligt
  het volgende stamstuk dichterbij.
- **Takken:** hij loopt over de bovenkant van een tak. Het beloopbare deel begint pas waar hij vrij is
  van de stam.

### Gedrag
- **Op de grond:**
  - huppen en rennen;
  - snuffelen en graven naar voedsel;
  - rechtop zitten met een nootje;
  - rondkijken en rusten;
  - naar een boom rennen.
- **In de boom:**
  - spiraalsgewijs klimmen of afdalen;
  - even stil tegen de stam hangen;
  - takken op en af lopen;
  - op een tak zitten.
- **Springen:** naar een tak van dezelfde of een naburige boom, in een ballistische boog. De sprong gaat
  nooit door een stam.
- **Variatie:** willekeurige rustmomenten en wisselingen.
- **Schrikken:**
  - op de grond: naar de dichtstbijzijnde boom en omhoog;
  - in de boom: hoger klimmen.
- **Boom omgehakt:** hij springt eraf en rent weg.

### Botsingen
- **Stammen:** op de grond worden ze ontweken, in de boom volgt hij het oppervlak.
- **Gebouwen, water en rotsen:** dezelfde controle als bij andere dieren. Wordt er een gebouw neergezet
  waar hij zit, dan zoekt hij de dichtste vrije plek.
- **Grond:** hij komt nooit onder het maaiveld.

### Getest (`tests/eekhoorn.spec.js`)
- 300 s gesimuleerd met alle eekhoorns in volle update.
- **Botsingen:** 0 keer merkbaar in een stam. De diepste meting is 6 mm, binnen de veelhoekige stam zelf.
- **Elders:** 0 keer onder de grond en 0 keer in een gebouw.
- **Kijkrichting:** kop altijd omhoog bij klimmen en omlaag bij afdalen.
- **Gedrag:** alle toestanden en clips komen voor, met tientallen sprongen.
- **Prestaties:** ongeveer 0,1 ms per simulatiestap.

## 2. Grote wereld

### Grootte en architectuur
- **Grootte:** nieuwe werelden zijn 144 × 144 tegels, 5× het oude oppervlak.
- **Oude saves** (zonder `n`) blijven 64 × 64 en werken ongewijzigd.
- **Dynamische grootte:** `VE.setWorldSize(n)` zet de grootte vóór het maken van een wereld. Alle modules
  houden hun `N` bij via `VE.sizeHooks`.
- **`?small`** in de URL geeft een kleine wereld, bijvoorbeeld voor oude tests.
- **Meeschalend:**
  - de vegetatie, het aantal bomen, de grenspalen en het aantal dieren;
  - het aantal bewoners dat getekend kan worden (520);
  - het zoekbereik van de padzoeker en het zoekrooster van de dieren.

### Drie spelers (voorbereiding multiplayer)
- **Spelers:** `game.players` heeft drie spelers, elk met een eigen startplek en kleur. Speler 0 ben jij;
  de andere twee zijn 'open'.
- **Eigenaar:** gebouwen en bewoners hebben een `owner`.
- **Save:** de spelers gaan mee.
- **Nog niet gebouwd:** AI en online spelen.
- **Eerlijke startplekken:**
  - drie plekken op een cirkel rond het midden, 120° uit elkaar, elk 82 tegels van de andere;
  - elke plek krijgt in zijn eigen gedraaide assenstelsel dezelfde omgeving: weide, bergrug met erts
    erachter, meer opzij, bos, bomen en rotsblokken volgens hetzelfde patroon;
  - ertsaders worden per startplek verdeeld;
  - getest: bomen, rotsen en bouwgrond verschillen minder dan 25–35 %, meestal minder dan 10 %.

### Landschap (`js/worldgen.js`)
- **Vulkaan** in het midden, ongeveer 8,7 hoog:
  - een krater, ruwe hellingen met geulen en kaal donker gesteente;
  - een rookpluim en vijf stoomgaten.
- **Spleet:** een donkere geul loopt van de vulkaan naar de kop van de canyon. `world.lavaPath` bevat de
  tegels, klaar voor een toekomstige lavastroom.
- **Canyon** tussen speler 2 en 3:
  - een hoog plateau met bijna loodrechte, gelaagde zandstenen wanden met richels, en een rivier op de bodem;
  - de wanden zijn onbegaanbaar (klif, tegeltype 4).
- **Brug:** één middeleeuwse stenen boogbrug (Blender) is de oversteek. Bewoners en soldaten lopen echt
  over het dek, op randhoogte. Over de brug is het 17 stappen, eromheen 61.
- **Rivieren:** twee, met voorden en brede dalen, tussen speler 1 en 2 en tussen 1 en 3.
- **Meren:** zes.
- **Bergen:** bergruggen achter elke start en randgebergte in de hoeken.
- **Verder:** heuvels en dalen (ruis), grote bossen en open graslanden.
- **Nieuwe tegelsoorten:**
  - 4 (klif): niet begaanbaar, niet bebouwbaar;
  - 5 (brug): begaanbaar, niet bebouwbaar, met een eigen loophoogte.

### Bijzondere plekken (Blender: `tools/blender/models/landmarks.py`, game: `js/landmarks.js`)
- **Plekken:**
  - de brug;
  - twee canyonwatervallen;
  - een verborgen waterval aan de voet van een bergrug;
  - twee ruïnes;
  - twee grotten;
  - een oude stenen kring;
  - een vergeten monument;
  - stoomgaten.
- **Easter eggs:**
  - het zwaard in de steen;
  - een reuzenbadeend op een meer;
  - een kabouterdorpje van paddenstoelhuisjes.
- **Ontdekken:** de mist boven de plek trekt weg. Je krijgt een melding en een beloning: 20–40 goud, 60
  bij een easter egg.
- **Save en minimap:** ontdekte plekken staan in de save (`disc`) en op de minimap.
- **Water:** vallend water stroomt in banden (shader), met spetters onderaan.

### Prestaties
- **Terrein:** wordt in 36 vakken (chunks) getekend met frustum culling.
- **Instancing:** bomen, gras en dieren blijven één InstancedMesh per soort. Alleen wat in beeld is,
  gaat naar de GPU (bestaande Instancer en natureSync).
- **Getest met drie volle dorpen:** 104 gebouwen, 520 bewoners waarvan 90 soldaten, 220 dieren en ruim
  6.000 bomen.

  | Meting | Gemiddeld | Langste frame |
  |---|---|---|
  | Simulatie per frame | 0,5–0,6 ms | 7–12 ms |
  | Renderer-voorbereiding van bewoners, stapels en dieren | ongeveer 2,5 ms | |

### Integratie
- **Minimap** (`js/minimap.js`):
  - terrein, water, bergen, vulkaan, canyon, brug, bos, gebouwen, territorium, mist, ontdekte plekken,
    soldaten en het camerabeeld;
  - tikken of slepen verplaatst de camera;
  - op mobiel klein, in te klappen met 🗺️.
- **Camera:** de grenzen volgen de wereldgrootte. In de grote wereld kun je verder uitzoomen.
- **Savegame:** veld `n` (grootte), `players` en `disc`.
- **Wereldgeneratie:** ongeveer 0,3 s.

### Getest (`tests/wereld.spec.js`, desktop en mobiel)
- 144 × 144, en 99,99 % van al het land is bereikbaar.
- Alle drie de startplekken en alle bijzondere plekken zijn bereikbaar.
- De brug is de korte weg over de canyon.
- Balans tussen de starts: afstand, bomen, rotsen, bouwgrond, water, en kolen en ijzer bij elke start.
- Vulkaan met krater, lavapad, kliffen, rivieren en meren.
- Ontdekken met melding en goud.
- Minimap: tikken verplaatst de camera.
- Opslaan en laden: zelfde wereld, ontdekte plekken blijven ontdekt. Een oude save laadt als 64 × 64.
- Prestaties met drie volle dorpen.

## Beperkingen
- **Water:** alle water ligt op zeeniveau. De watervallen zijn modellen langs een wand, er is geen
  verhoogd water.
- **Spelers:** de andere twee spelers zijn voorbereid, maar er is nog geen AI en geen online spel.
- **Bewoners:** alle bewoners horen bij speler 0.
- **Takken in de kroon:** een eekhoorn op een tak hoog in de kroon verdwijnt deels tussen het blad, net
  als in het echt.
