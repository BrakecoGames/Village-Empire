# Rapport: natuurlijke wereld en besturing (versie 1.3.0)

Vijf verbeteringen. Elk staat in de game en is getest met Playwright.

## 1. Camera: links slepen verplaatst, rechts slepen draait
- **Links slepen** schuift de kaart mee: het punt op de grond dat je vastpakt, blijft onder de muis.
  Dat geldt op elk zoomniveau, de hoek blijft hetzelfde en de camera kan niet buiten de wereld.
  Vroeger was dit een benadering, waardoor het beeld wegdreef.
- **Rechts slepen** draait rond het midden van het beeld, zonder contextmenu. De middelste knop draait
  en kantelt nog steeds; Q/E en het muiswiel werken zoals altijd.
- **Klikken** selecteert en bouwt. Pas na een kleine beweging telt iets als slepen (6 px met de muis,
  10 px bij aanraken). Slepen selecteert dus niets en bouwt niets, ook niet in bouwmodus.
- **UI-panelen:** slepen boven de bouwbalk of andere panelen verschuift de camera niet.
- **Aanraken:** één vinger verschuift op dezelfde manier, twee vingers zoomen en draaien zoals voorheen.
- Code: `CameraCtl.groundAt` en `dragTo` in `js/ui.js`.

## 2. Natuurlijk ontstane wandelpaden (`js/paths.js`)
- **Slijtage op de echte looproute:** elke tegel heeft 4×4 cellen, en alleen afgelegde afstand telt.
  Stilstaan telt niet, een piepklein correctiestapje vrijwel niet, rondslenteren voor een kwart.
- **Vijf stadia**, met drempels die je kunt instellen in `VE.PATHS`:

  | Stadium | Ziet eruit als |
  |---|---|
  | 0 | ongerept gras |
  | 1 | platgelopen gras: iets geler, het gras wordt lager |
  | 2 | plukjes aarde in een grillig patroon |
  | 3 | duidelijk voetpad, het gras is daar weg |
  | 4 | veelgebruikt pad: uitgesleten midden met steentjes en zandkorrels |

- **Snelheid** (gemeten in een druk dorp met 40 bewoners):

  | Na | Wat er te zien is |
  |---|---|
  | 30 s | niets |
  | ~1 min | eerste platgelopen gras |
  | 2 à 4 min | eerste voetpaden |
  | ~7 min | een handvol veelgebruikte paden |

  Vroeger lagen er na 7 minuten 41 volle paden.
- **Herstel:** heel langzaam. Na 5 minuten zonder verkeer is een pad nog zichtbaar, na ongeveer
  45 minuten is het weer gras. Ook het gras zelf groeit terug.
- **Weergave:** de paden zitten in de terreinshader (een masker met ruis). Dat geeft zachte, onregelmatige
  randen, organische bochten langs de werkelijke routes, een breedte die met het gebruik meegroeit, en
  geen hoekige vlakken. De oude padgeometrie (de "ruitjes") is weg, en dat scheelt draw calls en driehoeken.
- **Gameplay** blijft per tegel: pathfinding, loopsnelheid op paden, bloemen langs paden en de opdracht
  "wear in 8 path tiles". Stadium 3 is een spoor, stadium 4 een pad. Er zijn geen handmatig gebouwde
  wegen in de game. De stoepjes voor deuren zijn wel vast: ze slijten en herstellen niet.
- **Opslaan:** compact, als stukken base36 (een paar honderd tekens). Oude saves met paden per tegel
  worden bij het laden omgezet: een pad blijft een pad.

## 3. Erts en steenkool ondergronds (`js/mining.js`)
- **Niets meer te zien:** de zichtbare ertsaders zijn verdwenen (`ores.glb` en `ores.py` zijn
  verwijderd). De voorraden liggen ondergronds, met per stuk een soort, een begin- en resterende
  hoeveelheid en een rijkdom. Ze zijn deterministisch uit de seed gegenereerd.
- **Oude saves:** de voorraden gaan in hetzelfde formaat mee als de vroegere aders. Er gaat niets verloren.
- **Mijn:** staat op een bergtegel boven of naast de voorraad (bereik 2,6 tegels). Alleen het
  aanwezige erts kan gewonnen worden. De mijnwerker werkt ondergronds, het karretje rijdt en de katrol
  draait. Is het erts op, dan stopt de productie: je krijgt een melding en het infopaneel toont de status.
- **Informatielaag:**
  - een subtiele gestreepte kleurvlek in het terrein, alleen boven ontdekt land;
  - de kleur geeft de ertssoort aan, de dekking de rijkdom, en lichtgrijs betekent "niets gevonden";
  - hij verschijnt vanzelf als je een mijn plaatst of selecteert (het gekozen erts krijgt dan nadruk);
  - in het tabblad Mining zet de knop 🔍 **Survey** hem aan en uit.
- **Uitleg bij het plaatsen:** bijvoorbeeld *"Good spot: rich coal deposit below (about 95)"*, of
  waarom het niet kan, bijvoorbeeld *"No iron below this spot, but coal: try a Coal Mine"*.

## 4. Schoorsteenrook (`Smoke` in `js/fx.js`)
- **Rendering:** zachte wolkjes die naar de camera gericht staan, met een procedurele shader van een
  paar zachte bolletjes per wolkje. Elk wolkje ziet er dus anders uit.
- **Beweging:** de rook stijgt eerst rustig op en wordt dan meegenomen door een langzaam draaiende wind,
  met wat turbulentie. De wolkjes groeien, draaien een beetje en vervagen vloeiend.
- **Soorten:**

  | Soort | Waar |
  |---|---|
  | `home` | woonhuizen en opslag: dun en licht |
  | `work` | werkplaatsen: alleen bij echt werk, meer als ze produceren |
  | `heavy` | smelterij tijdens het smelten: dik en donker |
  | `smoulder` | smelterij in rust: een dun pluimpje |

- **Prestaties:** alle rook samen is één InstancedMesh, dus één draw call.
- De rook komt uit de echte schoorsteenmarkers van de Blender-modellen, per upgrade-level.

## 5. Vogels en vlinders
- **Vogels** (`js/wildlife.js`, modellen in `animals.glb`):
  - **Soorten:** roodborst, pimpelmees en merel. Ze hebben gevederde vleugels en de clips pikken,
    hupjes, fladderen, zweven en rondkijken.
  - **Vlucht:** geleidelijke bochten met overhellen, afwisselend fladderen en zweven, en kleine
    hoogteverschillen. Vliegen ze uit een rustige plek op, dan stijgen ze eerst vooral steil op.
  - **Veilige hoogte:** vogels vliegen altijd boven grond, boomkruinen en daken langs. De berg tellen ze
    ook mee, met een blik vooruit. Getest: nooit door een boom, dak of berg.
  - **Landen:** op de grond of in een boomkruin. Pimpelmezen landen het liefst in bomen. Wordt hun boom
    omgehakt, dan vliegen ze op.
  - **Gedrag:** kleine groepjes vliegen samen naar dezelfde plek, ze hebben rustmomenten, en ze vliegen op
    als er een bewoner aankomt.
  - De oude rondjesvliegers, die door de bergen vlogen, zijn verwijderd.
- **Vlinders** (`Butterflies` in `js/fx.js`, model in `animals.glb`):
  - **Uiterlijk:** zeven kleuren en verschillende formaten.
  - **Gedrag:**
    - onregelmatig en zacht fladderen, met op-en-neer deinen;
    - landen op bloemen, waar de vleugels langzaam open en dicht gaan;
    - meer vlinders rond bloemenvelden, en ze mijden drukke gebouwen;
    - ze vliegen op als er iemand langsloopt.
  - **Prestaties:** 40 vlinders op desktop en 18 op mobiel, in drie draw calls. Vlinders ver weg krijgen
    minder vaak een update.

## Metingen

Desktop 1920×1080 en mobiel, druk dorp met 40 bewoners na 7 minuten, dezelfde camera. De frametijd komt
uit SwiftShader (software-rendering) en is alleen bruikbaar om voor en na te vergelijken.

| | Desktop voor | Desktop na | Mobiel voor | Mobiel na |
|---|---|---|---|---|
| Draw calls | 170 | 149 | 134 | 120 |
| Driehoeken | 728k | 637k | 326k | 268k |
| Frametijd (mediaan) | 432 ms | 404 ms | 161 ms | 153 ms |

Screenshots staan in `tests/screenshots/<desktop|mobile>/`:
- `voor-*` en `na-*`: dorp, paden, rook, vogels en vlinders, berg;
- `na-vogels-vlinders-closeup`.

## Tests

Nieuw is `tests/verbeteringen.spec.js`. Het controleert:
- de camera (slepen, draaien, klikken, bouwen, UI-panelen, wereldgrenzen, aanraken);
- de wandelpaden (beweging, stadia, herstel, gras, opslaan);
- de rook (één mesh, soort per gebouw);
- vogels en vlinders (veilige vlieghoogte, landen, bloemen, drukte);
- de opname met screenshots en metingen.

Bijgewerkt zijn `tests/paden.spec.js` (nieuw opslagformaat, geen padgeometrie meer) en
`tests/wildlife.spec.js` (ondergrondse ertsen en de informatielaag).

## Resterende beperkingen
- De informatielaag toont alleen wat onder ontdekt land ligt. Wat nog onder de wolken ligt, verschijnt
  pas als je het gebied hebt verkend.
- De stockyard toont nog steeds geen stapels van de nieuwe goederen. Dat stond al in het vorige rapport.
