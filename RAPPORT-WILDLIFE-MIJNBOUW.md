# Rapport: wilde dieren, jacht, mijnbouw en metaal

> **Bijgewerkt in 1.3.0:** ertsen liggen nu ondergronds (geen zichtbare aders meer, wel een informatielaag),
> vogels hebben drie soorten en een echte vlucht. Zie [RAPPORT-NATUUR-BESTURING.md](RAPPORT-NATUUR-BESTURING.md).

## Nieuw in het spel

| Onderdeel | Wat |
|---|---|
| Wilde dieren | konijn, ree, hert (bokken met gewei), wild zwijn, vos, eekhoorn en zangvogel, allemaal geanimeerd |
| Jagershut | gebouw voor voedsel, vanaf rang Village. De jager sluipt naar het wild, gooit een net en brengt vlees thuis |
| Ertsaders | steenkool, ijzer, koper en goud, alleen op de berg |
| Mijnen | kolenmijn, ijzermijn en kopermijn (Market Town), goudmijn (Town). Alleen op een bergtegel naast de juiste ader |
| Smelterij | Market Town. Maakt ijzer-, koper- of goudstaven (jij kiest), met een gloeiende oven, vonken en rook |
| Nieuwe goederen | vlees, steenkool, ijzer-, koper- en gouderts, ijzer-, koper- en goudstaven |
| Village Charter | 9 nieuwe opdrachten, verspreid over Village, Market Town en Town |

### Productieketens
- Bos → wild → jagershut → vlees → nieuwe bewoners. Vlees telt als voedsel, net als brood en vis.
- Berg → kolenmijn → steenkool → smelterij.
- Berg → ijzer-, koper- of goudmijn → erts → smelterij → staven.
- Waar de staven voor nodig zijn: goudmijn (2 ijzer), level 3 van elk gebouw (2 ijzer) en de kathedraal
  (12 ijzer + 6 goud). Staven zijn daarnaast goede handelswaar.

### Recepten (`VE.RECIPES` in `js/config.js`)
| Staaf | Erts | Steenkool | Tijd |
|---|---|---|---|
| IJzer | 2 ijzererts | 1 | 10 s |
| Koper | 2 kopererts | 1 | 10 s |
| Goud | 3 gouderts | 2 | 14 s (vanaf rang Town) |

Wissel je van metaal, dan brengen dragers de grondstoffen die niet meer nodig zijn terug naar de opslag.
Er verdwijnt niets en er komt ook niets uit het niets.

## Hoe het werkt

### Dieren (`js/wildlife.js`)
- **Leefgebied:**
  - konijnen in weides vlak bij beschutting;
  - reeën en vossen aan bosranden;
  - herten en zwijnen in het bos;
  - eekhoorns bij bomen;
  - vogels op open grond.
- **Gedrag:** rondkijken, grazen, liggen, wandelen en vluchten.
  - Herten en zwijnen leven in groepjes en vluchten samen.
  - Een konijn gaat soms rechtop zitten of springt opeens weg.
  - Een hert draait nieuwsgierig zijn kop naar je toe.
  - Een vos doet een muizensprongetje.
  - Een eekhoorn vlucht de boom in.
  - Vogels vliegen op als er iemand aankomt.
- **Obstakels:** dieren lopen nooit door water, bergen, gebouwen of rotsblokken. Dat wordt over het hele
  stuk gecontroleerd. Ze mijden de drukte rond gebouwen en bewoners.
- **Populatie:** dieren planten zich langzaam voort, tot een maximum per soort. Jongen zijn kleiner en
  groeien op. Is een soort bijna weg, dan trekt er af en toe een dier vanuit de wildernis het dal in.
- **Duurzame jacht:** jagers laten altijd een minimum per soort staan. Hoeveel een hut opbrengt, hangt
  af van het wild in de buurt.
- **Prestaties:** dieren buiten beeld krijgen maar twee keer per seconde een update. Ze worden alleen
  getekend als ze in beeld zijn.
- **Opslaan:** dieren gaan mee in de save. Een oude save krijgt bij het laden vanzelf dieren.

### Jacht
1. De jager zoekt wild binnen bereik (8 tegels, +1 per level).
2. Hij sluipt via de bestaande pathfinding naar een plek naast het dier.
3. Het dier kan hem opmerken en vluchten, of het net ontwijken.
4. Lukt de vangst, dan verdwijnt het dier in een wolkje en neemt de jager vlees mee naar huis.
   - Konijn: 1 vlees, makkelijk te vangen.
   - Ree: 2 vlees.
   - Hert: 3 vlees, schuw.
   - Zwijn: 3 vlees, lastig te vangen.
5. Dragers brengen het vlees naar de opslag.

Vossen, eekhoorns en vogels worden niet bejaagd. De jacht is kindvriendelijk: alleen een net, geen bloed.

### Ertsaders en mijnen (`js/mining.js`)
- **Waar:** aders liggen alleen op bergtegels, in groepjes en nooit onder een rotsblok.
  - Steenkool komt het meest voor, daarna ijzer.
  - Koper is zeldzamer.
  - Goud is zeldzaam en ligt dieper in de bergen.
- **Deterministisch:** de aders hebben een eigen random-reeks uit de seed. De bestaande bomen en rotsen
  van een wereld veranderen daardoor niet. Daarna gaan de aders (met hun voorraad) mee in de save.
- **Garantie tegen vastlopen:** de eerste steenkool- en ijzerader liggen aan de bergrand die het dichtst
  bij het dorp ligt, en ernaast is altijd plek voor een mijn. Getest over 40 seeds: de dichtste berg ligt
  10 tot 20 tegels van het dorpshuis, bereikbaar met één of twee wachttorens.
- **Bouwregel voor mijnen** (in `Game.canPlace`):
  - alleen op een bergtegel;
  - niet op een pad, op de ader zelf, een bezette tegel of water;
  - niet te steil;
  - de juiste ader binnen 2,6 tegels;
  - een route van de ingang naar de opslag.
- **Tijdens het plaatsen:**
  - het spookgebouw is groen of rood;
  - onder de werkbalk staat de reden, bijvoorbeeld *"No iron here, but coal: try a Coal Mine"*;
  - de aders van het juiste erts lichten op.
- **Mijnwerk:** de mijnwerker (helm met lampje) hakt erts uit de ader naast de mijn en brengt het naar de
  mijn. De ader wordt kleiner naarmate hij leger raakt. Het karretje rijdt over de rails en de katrol
  draait zolang er gewerkt wordt.

### Interface
- **Grondstoffenbalk:** nieuwe goederen verschijnen pas vanaf de rang waarin je ze kunt gebruiken, of
  zodra je ze hebt. Elk goed heeft een tooltip met uitleg.
- **Bouwbalk:** een nieuw tabblad *Mining*. De jagershut staat onder *Food*.
- **Infopanelen:**
  - smelterij: metaal kiezen en een voortgangsbalk;
  - mijn: hoeveel erts er nog in de ader zit;
  - jagershut: welk wild er in de buurt is.
- **Menu:** een productieoverzicht met per goed de voorraad, het totaal dat je hebt gemaakt en welke
  gebouwen het maken.
- **Handel en markt:** tonen alleen goederen die je al kent.
- **Help:** het hoofdstuk *How to play* legt jacht, mijnen en smelterij uit.

## Blender 5.3 (`tools/blender/models/`)

| Model | Bestand | Grootte | Inhoud |
|---|---|---|---|
| `animals.py` | `animals.glb` | 0,66 MB | 7 soorten, 38 delen, 41 animaties |
| `hunter.py` | `hunter.glb` | 0,73 MB | 3 levels: blokhut, bemost dak, veranda, gewei, droogrek met hammen, vacht op een raam, rokerijtje |
| `mine.py` | `mine.glb` | 0,49 MB | 3 levels: rotsheuvel, schacht, stutten, afdakje, rails, platform, lantaarns, katrolbok. Eén model, kleur per erts |
| `smelter.py` | `smelter.glb` | 0,59 MB | 3 levels: ronde stenen oven, schoorsteen, werkplaats, blaasbalg, gietvormen, staven, kolenbak, aambeeld |
| `ores.py` | `ores.glb` | 0,23 MB | 4 ertssoorten × 2 varianten |
| `settler.py` | `settler.glb` | 0,46 MB | nieuwe clip `hunt`: aansluipen en het net werpen |

Elk model heeft een fallback. Laadt een bestand niet, dan gebruikt de game eenvoudige procedurele modellen
met hetzelfde gedrag (getest).

## Tests

Het testbestand is `tests/wildlife.spec.js`. Het controleert:
- dat de aders op de berg liggen en bereikbaar zijn, met een mijnplek ernaast;
- alle bouwregels en meldingen;
- het determinisme;
- de volledige keten. Mijnen leveren precies wat er uit de aders verdwijnt, en staven kosten erts en
  steenkool;
- het wisselen van recept;
- de jacht;
- dat dieren nooit door obstakels lopen, het dorp mijden en nooit worden uitgeroeid;
- dat het wild herstelt als de jagers weg zijn;
- opslaan en laden, ook van oude saves;
- de UI;
- de Village Charter;
- de prestaties;
- de fallback.

Screenshots staan in `tests/screenshots/<desktop|mobile>/` onder `dieren-parade-*`, `dier-*` en `metaal-*`.

## Bewust (nog) niet gedaan
- De stockyard toont alleen stapels van de oorspronkelijke negen goederen. Er is geen ruimte voor
  zeventien stapels. Nieuwe goederen zie je wel bij de mijnen, de smelterij en de jagershut, en in de
  handen van dragers.
- Dieren hebben geen eigen geluiden.
