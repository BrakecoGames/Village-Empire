# Rapport fase 1: fundament voor single player tegen AI en multiplayer

Checkpoint vóór dit werk: tag `checkpoint-voor-fase1` (commit `a790843`). Netwerkcode is er nog niet.

## Wat er nieuw is
| Bestand | Inhoud |
|---|---|
| `js/players.js` | `VE.Player`, met id, naam, kleur, team, soort (`human` / `ai` / `open`), `isAI`, AI-niveau, startplek, goud, rang, quests, statistieken, upgrades en nieuwkomers-timer. |
| `js/commands.js` | Het commando-systeem: `VE.COMMANDS`, `VE.applyCommand`, `VE.checkCommand`, `g.issue`, `g.runCommands` en `g.cmdLog`. |
| `js/snapshot.js` | De volledige status als JSON: `g.snapshot()`, terugzetten via `new Game().init(snap)` en `g.stateHash()`. |
| `tests/fundament.spec.js` | Tests voor determinisme, snapshot, spelers en commando's. |

## Spelers en eigenaars
- **Eigenaar:** elk gebouw (`b.owner`), elke dorpeling en elke soldaat (`s.owner`) heeft een speler-id.
- **Per speler:**
  - voorraad (`g.stock`, `g.avail`) en goud, rang, quests, statistieken en upgrades;
  - nieuwkomers, voedsel en tevredenheid, en vertrekken bij honger;
  - territorium (`world.owned` = eigenaar + 1), de kazerne en soldaten;
  - dragers, die alleen voor hun eigen speler werken.
- **Uitvoerende speler `g.cur`:** alles wat de simulatie doet, doet ze voor één speler tegelijk: per gebouw, per dorpeling,
  per dispatchronde en per commando. `g.gold`, `g.stock`, `g.hq` enz. gaan over die speler. Buiten een tick is dat
  `g.me`, de speler achter dit scherm.
  - `g.as(pid, fn)` voert iets uit als een andere speler.
  - `g.hqOf(pid)` en `g.popOf(pid)` geven het dorpshuis en de bevolking van een speler.
- **Oude saves:** werken nog. Alles daarin is van speler 0.

## Commando's (basis voor de AI en straks het netwerk)
Elke wijziging van de spelstatus is een klein JSON-object:
```js
{ type: 'build', playerId: 0, buildingType: 'farm', i: 40, j: 52, accept: ['log'] }
{ type: 'demolish', playerId: 0, buildingId: 17 }
{ type: 'trainUnit', playerId: 0, buildingId: 9, unitType: 'swordsman', count: 2 }
{ type: 'moveUnits', playerId: 0, unitIds: [31, 32], targetX: 50.5, targetZ: 61.2, mode: 'hold' }
{ type: 'setMarketTrade', playerId: 0, buildingId: 12, res: 'bread', sell: true, keep: 10, feed: true }
```
**Alle soorten:**
- **Bouwen:** `build`, `demolish`, `upgrade`, `cancelUpgrade`.
- **Gebouwen instellen:** `setRecipe`, `setAccept`, `setMarketTrade`.
- **Handel en voortgang:** `trade`, `buyUpgrade`, `claimQuest`, `promote`.
- **Leger:** `trainUnit`, `cancelTraining`, `moveUnits`, `holdUnits`, `dismissUnits`, `attack` (volgt in fase 2).
- **Spel:** `setSpeed`.

**Zo werkt het:**
- **`g.issue(cmd, cb)`:** zet het commando in de wachtrij.
  - In een lokaal spel en buiten een tick wordt het meteen uitgevoerd. Voor een replay is dat gelijk aan "aan het begin
    van de volgende tick".
  - Binnen een tick (straks de AI) of met `g.lockstep = true` gaat het in de wachtrij. `Game.tick()` voert de wachtrij uit
    vóór de simulatie.
- **`VE.applyCommand(g, cmd)`:** controleert eerst (eigenaar, speler bestaat en speelt mee, plek, goud en grondstoffen,
  rang) en voert dan uit, als die speler. Resultaat: `{ ok: true, ... }` of `{ ok: false, why: 'English reason' }`.
- **`VE.checkCommand`:** alleen controleren, zonder iets te veranderen. Handig voor knoppen in de UI.
- **`g.cmdLog`:** alles wat is uitgevoerd, met tick en uitslag. Dat is meteen een replay.
- **De interface:** `ui.js` en `army-ui.js` veranderen de spelstatus niet meer zelf. Bouwen, slopen, upgrades, recepten,
  opslagfilters, markt, handel, quests, rang, snelheid, training en bevelen gaan allemaal via `g.issue`. Getest: alleen
  kijken (panelen openen) verandert de status niet.

**Later, voor lockstep-multiplayer:**
- elke client stuurt zijn commando's met een tick-nummer naar de anderen of een relay;
- iedereen voert ze in dezelfde tick uit (`g.lockstep = true`, `issue` → wachtrij);
- `g.stateHash()` per paar seconden vergelijken = desync-controle.

## Vaste ticks, random en weergave
- **Vaste ticks:** de simulatie loopt op 20 ticks per seconde (`VE.TICK = 0,05 s`, accumulator in `main.js`), los van de
  framerate. Snelheid 2× en 3× betekent meer ticks per seconde.
- **Vloeiende weergave:** dorpelingen, soldaten en dieren worden tussen twee ticks in getekend (`VE.alpha`,
  `VE.ipos`, `VE.irot`).
- **Seeded random:** `g.rand()` (`VE.SimRng`, met de toestand in de snapshot) in plaats van `Math.random()`.
  - Dat geldt ook voor de dieren en voor eekhoorns, waar de snelheid nu deterministisch is.
  - Cosmetisch toeval (rook, vonken, geluid) gebruikt nog `Math.random`, en beïnvloedt de uitkomst niet.
- **Camera:** de simulatie hangt niet meer van de camera af. Dieren rekenden buiten beeld minder vaak, dat is weg.
  De renderer schrijft niet meer in de simulatie (eekhoorns klimmen en draaien niet meer in de weergave).
- **Timers:** de regeneratietimer van zwavel staat op het spel, niet meer op de module.

## JSON-status
- **Callbacks als data:** de acties van dorpelingen waren closures ("als je aankomt, doe dan X", ongeveer 45 plekken).
  Dat zijn nu vervolgen als data: `{ f: 'felled', a: [gebouw, boom] }` → `Game.k_felled(s, …)`.
  - Dat geldt voor houthakken, planten, steen, akkers (schoffelen, zaaien, maaien, binden), vissen, mijnen, zwavel,
    jacht, transport, bouwers, werkers, eten, rekruten en soldaten.
- **Volledig:** `g.snapshot()` is de hele simulatie, ook midden in een handeling:
  - spelers, gebouwen en dorpelingen met hun pad, taak en vervolg;
  - natuur, terrein, paden, territorium, ertsaders en zwavel;
  - dieren, vogelzwermen, landmerken, random, tick en de commandowachtrij.
  - Gedeelde objecten worden verwijzingen, configuratie wordt een naam, en weergave (3D) hoort er niet in.
- **Getest:**
  - JSON → terug → opnieuw JSON is identiek;
  - na het terugzetten rekenen beide spellen 1.200 ticks (met een bevel) door naar precies dezelfde toestand.

## Tijdens het testen gevonden en opgelost
- **Werkplaats:** een werkplaats verloor zijn lopende partij als de werker even wegliep. Dat gebeurde sinds werkers eten,
  en kostte bijvoorbeeld een stam bij de zagerij. Nu wacht de partij tot de werker terug is.
- **Houthakker:** als de tweede zaagsnede onbereikbaar was, bleef de lange stam liggen. Hij wordt nu opgeruimd en het hout
  telt mee.
- **Bestanden:** `sed -i` in iCloud liet `ui.js` verdwijnen (`ui 2.js`). Bestanden worden nu altijd ter plekke gewijzigd.

## Tests
- `tests/fundament.spec.js` (desktop en mobiel, 6/6):
  - **determinisme:** zelfde seed en commando's geven dezelfde toestand, bij 30, 60 en 144 fps;
  - **snapshot:** heen en terug, daarna identiek doorrekenen;
  - **spelers en commando's:** per speler, controles werken, en de interface verandert niets zonder commando.
- **Aangepast:**
  - `opslag.spec.js`: deze tests gaan niet over honger, dus de dorpelingen blijven daar verzadigd, en lopende
    maaltijden worden losgelaten;
  - `voedsel.spec.js`: meet de traagste dorpeling.
- **Volledige suite** (desktop en mobiel): 195 geslaagd, 6 mislukt.
  - Dieren (2): de test controleerde de oude camera-optimalisatie, die bewust is vervangen door elke tick. Test
    aangepast.
  - Zwavel (2): de mijnwerker eet nu ook. Test houdt hem verzadigd.
  - Dierenfoto en vogels (2): slaagden bij opnieuw draaien (willekeurige wereld).
  - Alle aangepaste tests slagen daarna.

## Bekende punten voor later
- **Grootte:** een snapshot van de grote wereld is ongeveer 10 MB JSON (vooral bomen en terreinarrays). Dat is te groot
  voor localStorage en voor het netwerk. Later comprimeren, of alleen wat afwijkt van de seed-wereld meesturen. De
  gewone save blijft daarom het oude, compacte formaat.
- **Per speler:** ontdekken (mist) en landmerken zijn nog per scherm (`g.me`). Voor online spelen moeten die per speler.
- **Cosmetisch:** `Math.random` in effecten is zo gebleven. Raakt het ooit de simulatie, dan zie je dat meteen in de
  determinismetest.
