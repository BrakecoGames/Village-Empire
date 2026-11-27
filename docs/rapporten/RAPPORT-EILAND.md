# Rapport: eilandwereld en Fog of War

Git-checkpoint vóór dit werk: tag `checkpoint-voor-eiland` (commit `6dc715c`, versie 1.11.0).

## Bestaande saves
Nieuwe werelden gebruiken wereldgenerator 3 (`VE.GEN = 3`); een save onthoudt zijn generator (`save.g`).
- Bestaande saves houden precies hun eigen terrein (getest: een save van generator 2 blijft generator 2, zonder eiland).
- De nieuwe mist en het nieuwe water gelden overal.

## 1. Eilandwereld
- **Vorm:** het speelveld is één groot eiland (63 % land), rondom omringd door zee. Nergens raakt het land de
  kaartrand. Rond het eiland ligt diepblauwe zee zonder buitenland.
- **Vulkaan:** precies in het midden.
- **Eerlijke kust:** de kustlijn komt uit ruis met drievoudige symmetrie rond het midden. Hij ziet er natuurlijk
  grillig uit, maar is voor de drie spelers gelijk:
  - afstand tot de vulkaan: 68–69 tegels;
  - land rondom elke start: binnen 5 % gelijk;
  - afstand tot de kust: binnen 6 tegels gelijk.
- **Zee:** `world.sea` = water dat met de rand verbonden is. Meren en rivieren zijn geen zee.

## 2. Kustlijn
- **Stranden:** zandstrand dat zacht afloopt naar de waterlijn.
- **Kliffen:** steile kustkliffen van grijze, gelaagde rots. Ze zijn onbegaanbaar, net als bergruggen die
  steil in zee eindigen.
- **Rotspilaren:** in zee voor de kliffen.
- **Baaien:** bij elke start een baai met een geul naar open zee, altijd met strand. Die is bedoeld voor latere
  havens, vissersboten, handelsschepen en zeetransport (`world.island.harbors`). Deze functies zijn nog niet gebouwd.
- **Canyon:** loopt met zijn wanden door tot in zee, dus de brug blijft de enige oversteek.
- **Water:** turquoise in het ondiepe, diepblauw in zee, met golfjes (rustiger in diep water). Langs de kust rollen
  schuimkoppen naar het land en ligt een smalle schuimrand op de waterlijn.

## 3. Vulkaan als herkenningspunt
- **Vorm:** een brede voet met een steile, geribde topkegel en een echte krater (rand ~12,3, bodem ~9,0). De mistlaag
  ligt op ~7,3–8,0, dus de top steekt ruim 4 boven de mist uit.
- **Aparte weergave:** de top boven de mist wordt apart getekend, zonder de afstandsnevel van de scène, in donker
  basalt met lavabanden en as op de rand. In de krater gloeit een zacht pulserende lavagloed, en er komt rook uit.
- **Zwavel:** de afzettingen liggen lager op de flank, ruim onder de mist (hooguit ~3,7 hoog).

## 4. Fog of War
- **Horizontale laag:** de mist ligt grotendeels op één hoogte, net boven het hoogste land met bomen. Hij volgt het
  landschap niet meer. Getest dat er niets van onontdekt land boven de mist uitsteekt behalve de vulkaantop:
  - canyon (55 punten), brug, rivieren (95 punten);
  - zwavel, ertsaders, rotsen, 11.643 bomen en bijzondere plekken.
- **Geleidelijk:** naar het ontdekte land loopt de mist af als een zachte wolkenbank over ~7 tegels, zonder muur.
  Bij het ontdekken zakt hij weg en lost hij op.
- **Minimap:** onontdekt land is ook daar helemaal mist; geen kustlijn, rivieren of canyon.
- **Snelheid:** mist bijwerken kost ~1,5 ms (afstandsveld in twee doorgangen).

## 5. Tests (Playwright, desktop + mobiel): `tests/eiland.spec.js`
- **Eiland:**
  - zee rondom, stranden, kliffen, rotspilaren, vulkaan in het midden;
  - eerlijke starts, baaien en havenplekken (bereikbaar te voet);
  - zwavel onder de mist, niets anders boven de mist;
  - opslaan en laden, oude saves.
  - De eilandtest is 12 keer herhaald: alle 12 geslaagd.
- **Mist:**
  - horizontaal;
  - alles verborgen behalve de vulkaantop;
  - zachte wolkenbank, mist verdwijnt bij ontdekken.
  - Foto's uit zes camerahoeken en zoomniveaus, plus kust/baai en klif.
- **Prestaties:** mist bijwerken, simulatie en aantal draw calls.
- **Bijgewerkt:**
  - bergen (generator 3);
  - rand (rond een eiland zee in plaats van buitenland);
  - wereld (meting van de kraterrand);
  - eekhoorn (telt echt gebouwen).

## 6. Uitslag
- **Volledige suite:** 175 geslaagd, 7 mislukt. De mislukkingen waren tests die nog van de oude wereld uitgingen,
  plus twee echte punten: geen echte krater, en de canyon was via het strand te omzeilen. Alles is aangepast of
  opgelost.
- **Daarna:** bergen, wereld, eekhoorn, eiland, zwavel en rand op desktop en mobiel, alle geslaagd.
- De volledige suite is daarna niet opnieuw gedraaid.
