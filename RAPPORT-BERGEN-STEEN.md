# Rapport: lagere bergen, steentekort, steenmijn, wachttorens op bergen

Git-checkpoint vóór dit werk: tag `checkpoint-voor-bergen-steenmijn` (commit `5237dab`).

## Belangrijk: bestaande saves blijven zoals ze zijn
Het terrein wordt bij het laden opnieuw uit de seed gemaakt. Als de bergen ook in oude saves lager
werden, zouden gebouwen ineens zweven of in de berg staan. Daarom heeft de wereldgenerator nu een versie:
- `VE.GEN = 2` in `js/config.js`; de save onthoudt `g: 2`;
- een save zonder `g` (alles van vóór deze versie) krijgt het oude terrein (generator 1);
- getest: een oude save houdt exact zijn oude bergen. Een nieuwe save laadt met precies hetzelfde terrein en
  dezelfde gebouwen.

De nieuwe regels (bouwen op bergen, steenmijn, uitzicht van wachttorens) werken ook in oude saves. Op de oude,
steile bergen zijn alleen minder plekken vlak genoeg.

## 1. Lagere bergen met natuurlijke hellingen
- **Hoogte:** de bergen zijn lager. In nieuwe werelden is de hoogste berg ~6, in oude werelden was dat ~8,5–9.
  De bergruggen bij de startplekken zijn breder, dus de flanken zijn zachter. De vulkaan is wat lager,
  maar blijft het hoogste punt.
- **Plateaus:** de berghoogte ligt in plateaus (stappen van 0,8) met geleidelijke overgangen ertussen
  (`World.mountainH`). Je ziet duidelijk relief en terrassen, maar nergens een wand.
- **Meting (wereld 208):**
  - 87 % van de bergtegels is vlak genoeg om op te bouwen;
  - nergens meer dan 0,5 % steil, over 10 seeds gemeten (meestal 0,1 %). Rivierdalen en meeroevers in de
    bergen lopen geleidelijk af, zonder steile oevers;
  - 99,6 % van de begaanbare bergtegels is vanaf het dorpshuis bereikbaar;
  - de padzoeker vond 25 van 25 willekeurige plateautegels.
- **Padzoeker:** de steilte van een tegel telt mee in de kosten, zodat bewoners en soldaten liever de zachtste helling
  nemen. Alles behalve water en canyonwanden blijft begaanbaar. De steilte per tegel wordt één keer
  berekend en bewaard.
- **Bouwregels:**
  - alle gebouwen mogen nu op bergen, behalve akkers en wijngaarden ("Too rocky for fields");
  - de hellinglimiet is iets ruimer: 0,95 voor 1 tegel en 1,25 voor 2×2. Het gebouw egaliseert zijn ondergrond, zoals altijd;
  - mijnen blijven alleen op bergen.

## 2. Meer natuursteen
Alleen in nieuwe werelden:
- meer rotsblokken in de bergen (kans 0,2, was 0,14);
- bijna 3× zoveel losse keien in het open land;
- bij elke startplek 6 groepjes rotsblokken (was 3);
- **meting:** 96–114 rotsblokken binnen 22 tegels van elke startplek.

De echte oplossing voor de midgame en endgame is de steenmijn (hieronder).

## 3. Steenmijn (Stone Mine)
- **Waar te bouwen:** alleen op bergen. Hij gebruikt de bestaande mijnbouw: een mijnwerker die ondergronds hakt,
  het karretje, dragers en een lokale opslag van maximaal 6.
- **Grondstof:** het gesteente van de berg zelf (grondstof 5 in de mijnbouw). Er is geen ader nodig en hij raakt nooit op.
  Bij het plaatsen zie je "Good spot: solid rock for building stone (never runs out)". Het infopaneel toont
  "solid mountain rock: never runs out".
- **Vroeg genoeg:**
  - beschikbaar vanaf Village (rang 1), in het tabblad Wood & Stone;
  - kost 6 planken en 2 stammen, dus géén steen. Je kunt hem altijd bouwen, ook als alle steen op is;
  - opdracht in de Village Charter: "Build a Stone Mine in the mountains".
- **Rotsheuvel bij de start:** elke startplek heeft in nieuwe werelden een kleine rotsheuvel binnen de eerste
  grenzen (op dezelfde plek, gedraaid). Daar past een steenmijn al vóór je een wachttoren nodig hebt; die
  kost zelf steen. Getest: er zijn altijd plekken binnen de startgrenzen.
- **Lange sessie (test):** 25 minuten speeltijd, alle rotsblokken rond het dorp weg.
  - De mijn leverde 261 steen, gelijkmatig: 103, 156 en 209 na elke 5 minuten.
  - Hij raakte nooit op, en dragers brachten alles naar de opslag.
- **Blender-model** (`tools/blender/models/stonemine.py` → `public/models/stonemine.glb`, 3 levels):
  - een rotswand met uitgehakte, rechthoekige treden (zaagsneden en boorgaten zichtbaar);
  - een mijnschacht in een stutframe met afdakje en een bordje met een bouwsteen;
  - rails met een stootblok, een geparkeerd mijnkarretje vol rechthoekige blokken;
  - een pallet met bouwstenen in verband, een lier en een lantaarn;
  - level 2: een houten bok met katrol boven de groeve, een tweede lantaarn en een kist;
  - level 3: een tweede karretje, een steenhouwersbank met beitel en hamer, en een slee met een groot ruw blok.
  - Het rijdende karretje heeft in de game ook rechthoekige blokken als lading.

## 4. Wachttorens op bergen
- Wachttorens mogen op geschikte bergplekken staan. Bouwers en dragers komen er echt: getest met een
  bouwplaats op de hoogste bergplek binnen 30 tegels, die netjes gebouwd werd.
- **Hoger = verder:** een toren ontdekt tot 9 tegels extra, afhankelijk van zijn hoogte (`Game.towerView`).
  Op vlak land is dat 0. Bij het plaatsen zie je bijvoorbeeld "High ground: sees 9 tiles further".
  Getest: een hoge toren ontdekte een gebied met straal 17,3, een toren op vlak land 8,2.
- Het grondgebied (de grens) blijft even groot; alleen het ontdekken gaat verder.

## 5. Wereldgeneratie en eerlijkheid (drie spelers)
Alles rond de startplekken is symmetrisch (dezelfde vorm, gedraaid). De tests meten per startplek:

| | Start 1 | Start 2 | Start 3 |
|---|---|---|---|
| Rotsblokken (22 tegels) | 102 | 106 | 96 |
| Steenkool / ijzer / koper / goud | 902 / 398 / 195 / 99 | 961 / 479 / 266 / 128 | 901 / 427 / 217 / 135 |
| Bebouwbare bergtegels (20 tegels) | 136 | 181 | 211 |
| Plekken voor een mijn (20 tegels) | 184 | 234 | 238 |

De verschillen in bergplateaus komen van het randgebergte en de vulkaan, die niet bij elke startplek
even dichtbij liggen. Elke startplek heeft er ruim meer dan genoeg.

## 6. Tests (Playwright, desktop + mobiel)
Nieuw: `tests/bergen.spec.js`, drie tests.
- **Bergen:** hoogte en steilte, plateaus, bereikbaarheid (flood-fill en padzoeker), verdeling per
  start, opslaan en laden, en een oude save met het oude terrein.
- **Bouwen op de berg:** een huis en een wachttoren als bouwplaats op de berg; dragers en bouwers maken ze af.
  Ontdekkingsbereik van een hoge toren tegenover een toren op vlak land. Foto `berg-toren.png`.
- **Steenmijn:** rang, kosten, opdracht, plekken binnen de startgrenzen, alleen op de berg, raakt nooit op,
  lokale opslag ≤ 6, 25 minuten productie en het infopaneel. Foto `steenmijn.png`.

Bijgewerkt: `tests/wildlife.spec.js`. Huizen mogen nu op vlakke bergplekken; de test controleert nu dat akkers
niet op rots kunnen.

### Uitslag
- **Volledige suite (desktop + mobiel):** 167 geslaagd, 2 mislukt, 59 overgeslagen (tests voor maar één van de twee).
  - De bergtest op mobiel: bij één seed was 1,7 % van de bergtegels steil, op oevers waar een rivier of meer door een berg
    sneed. Opgelost met bredere, geleidelijke rivierdalen en meeroevers in de bergen.
  - De wereldtest verwachtte een kraterrand boven 6. De vulkaan is bewust lager; de grens is nu 4,5.
- **Na die aanpassingen:** wereld, bergen, wildlife en natuur opnieuw gedraaid, 29 geslaagd en 0 mislukt.
  De volledige suite is daarna niet opnieuw gedraaid.
