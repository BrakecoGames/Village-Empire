# Rapport: Kazerne (Barracks) en soldaten

Git-checkpoint vóór de wijzigingen: tag `checkpoint-voor-kazerne`. De vorige, nog niet geüploade wijzigingen
(upgrades, vlinders) zijn daarbij lokaal gecommit.

## De keten

wapensmederij → dragers → kazerne → rekruut → soldaat → besturing

1. **Wapensmederij**
   - Maakt zwaarden, speren, strijdbijlen, dolken, bogen en kruisbogen.
   - Nieuw is **Training Gear**: 2 planken leveren 2 stuks op. Dat zijn houten oefenzwaarden, gewatteerde
     schildjes en stompe pijlen.
2. **Wachtrij**
   - De speler kiest in de kazerne welke soldaten en hoeveel: +1 of +5 per type, maximaal 30.
   - Het trainingsgoud gaat er direct af. Wie een plek afbreekt (✕), krijgt het goud terug.
3. **Transport**
   - Dragers halen per wachtende rekruut één wapen en de trainingsuitrusting. Ze halen die uit de
     wapensmederij of uit een Storehouse.
   - Wapens die net gesmeed zijn, gaan rechtstreeks naar de kazerne.
4. **Rekruut**
   - Een vrije dorpeling loopt naar de kazerne, maar alleen als zijn spullen er al liggen of onderweg zijn.
   - Er moet ook een passende oefenplek vrij zijn.
   - Er blijven altijd minstens 3 vrije dorpelingen over om te dragen.
   - Op de oefenplek wacht hij tot het wapen en de uitrusting er echt liggen. Pas dan haalt hij ze uit het
     rek en begint hij te trainen.
5. **Training**: elk type oefent op zijn eigen manier, met het echte wapen in de hand.

   | Type | Waar | Oefening |
   |---|---|---|
   | Zwaardvechter | oefenpop | slaat schuin op de pop, schild naar voren |
   | Bijlvechter | oefenpop | slaat met twee handen hoog boven het hoofd neer |
   | Dolkvechter | oefenpop | steekt snel met twee dolken |
   | Speervechter | oefenpaal | doet een uitval met de speer |
   | Boogschutter | schietschijf | pakt een pijl uit de koker, trekt de boog uit en schiet |
   | Kruisboogschutter | schietschijf | richt, schiet, laat zakken, spant opnieuw en richt weer |

   - Bij een rake klap veert de pop terug en vliegt er stro af.
   - Pijlen en bouten vliegen echt naar de schijf en blijven er een paar seconden in steken.
   - Elk soort klap of schot heeft een eigen geluid.
6. **Soldaat**
   - Na de trainingstijd is de dorpeling een soldaat: dezelfde bewoner, dus de bevolking blijft gelijk.
   - Hij krijgt zijn uitrusting en verzamelt vóór de kazerne.

## Kazernemodel (`tools/blender/models/barracks.py`, 2 × 2 tegels)

**Wat erop staat**
- Een slaapzaal achterop:
  - level 1: vakwerk met rode pannen;
  - level 2: een stenen voet en donkerrode pannen;
  - level 3: stenen muren, een leien dak en een hoektoren met kantelen en vaandel.
- Een omheind zandterrein met een poort en een wapenschild.
- Oefenpoppen, ronde schietschijven van stro met gekleurde ringen en een oefenpaal.
- Twee wapenrekken en een pallet voor de trainingsuitrusting.
- Strobalen, een ton met houten oefenzwaarden, een bank, een drinkbak en een vaandel.

**Oefenplekken per level**

| Level | Plekken | Wat erbij komt |
|---|---|---|
| 1 | 3 | een pop, een schijf en de paal |
| 2 | 4 | een tweede pop |
| 3 | 5 | een tweede schietbaan |

**Blender-workflow uitgebreid** (`ve_parts.build_levels`)
- Markers `rack0`/`rack1`: de wapenrekken.
- Markers `st<i>_<soort>`: de oefenplek, met de kijkrichting.
- Markers `tg<i>`: de pop of schijf bij die oefenplek.
- `parts={...}`: losse onderdelen, zoals `barracks_part_dummy`. De game laat die oefenpop knikken.

**Zichtbare voorraad**
- Wapens staan rechtop in de rekken, 6 per rek.
- De uitrusting ligt op de pallet.
- De test controleert dat het aantal zichtbare stuks gelijk is aan de echte voorraad in de kazerne.

**Reserve**: lukt het laden van de GLB niet, dan gebruikt de game een eenvoudig procedureel model in
`models.js` met dezelfde plekken.

**Grootte**
- 21.910 driehoeken over 3 levels, ongeveer 7.300 per level.
- Het bestand is 1,46 MB.
- Het laadt op de achtergrond, na de start van het spel.

## Soldaten in Blender (`tools/blender/models/settler.py`)

**Rig**: een tweede handpunt `toolL`, voor de boog en de tweede dolk.

**Uitrusting per type**

| Type | Lijfkleur | Hoofd | Uitrusting |
|---|---|---|---|
| Zwaardvechter | blauw | spitse helm met neusstuk en maliënnek | maliënkolder, wapenrok in de dorpskleuren, rond schild |
| Boogschutter | groen | groene kap met slip en veer | pijlkoker, armbeschermers |
| Speervechter | steenrood | stalen kap met rode pluim | maliën, wapenrok, ruitschild |
| Dolkvechter | paars | donkere kap met sjaal | gekruiste riemen met schedes |
| Bijlvechter | oker | helm met bontrand en wangstukken | bontmantel |
| Kruisboogschutter | petrol | ijzeren hoed met brede rand | wapenrok, boutenkoker |

**Animaties**: `guard` (wachthouding), `march` (in de pas), `slash`, `cleave`, `stab`, `thrust`, `shoot` en
`xbow`.

**Wapens**
- In de hand komen de echte wapenmodellen uit `items.glb`.
- `items.glb` heeft nu ook een model voor de trainingsuitrusting.

**Prestaties**
- Alles blijft instanced: één InstancedMesh per onderdeel en per wapen, voor alle bewoners samen.
- `settler.glb` groeide van 484 naar 766 KB, vooral door de extra animaties.

## Eigenschappen en balans (`VE.SOLDIERS` in `js/config.js`)

| Type | HP | Aanval | Slagen/s | Bereik | Verdediging | Snelheid | Sterk tegen |
|---|---|---|---|---|---|---|---|
| Swordsman | 120 | 13 | 1,0 | 0,6 | 8 | 1,0 | speer |
| Archer | 75 | 10 | 0,9 | 6 | 2 | 1,08 | dolk |
| Spearman | 115 | 11 | 0,95 | 1,2 | 6 | 0,96 | bijl |
| Dagger Fighter | 75 | 7 | 2,2 | 0,45 | 3 | 1,3 | kruisboog |
| Axeman | 135 | 21 | 0,62 | 0,7 | 4 | 0,9 | zwaard |
| Crossbowman | 85 | 22 | 0,4 | 7 | 5 | 0,86 | boog (bouten doorboren 60 % van het pantser) |

- **Twee kringlopen zonder winnaar**: bijl > zwaard > speer > bijl, en dolk > kruisboog > boog > dolk.
- **Schade**: `VE.soldierDamage(a, d)` = aanval (× 1,5 tegen het type waar a sterk tegen is) min de helft
  van de verdediging. Dit is de basis voor toekomstige gevechten.
- **Kosten per soldaat**: 1 wapen, 1 à 2 uitrusting en 6 tot 12 goud. De trainingstijd is 22 tot 34
  seconden; een hoger level van de kazerne traint sneller.

## Besturing (`js/army-ui.js`)

**Selecteren**

| Wat | Hoe |
|---|---|
| Eén soldaat | tik of klik op de soldaat (de hele figuur telt) |
| Soldaat erbij of eraf | shift- of ctrl-klik |
| Alle soldaten van dat type in beeld | dubbeltik |
| Alle soldaten | ⚔️-knop rechtsboven, met het aantal in een badge |
| Een groep | kader trekken: shift-slepen, of de knop **Drag to select** (werkt ook op touch) |

**Bevelen**

| Bevel | Hoe | Wat ze doen |
|---|---|---|
| **Move** | tik op de grond (of rechtsklik) | lopen in formatie via de bestaande A*-paden en wachten daar; melee voorop, schutters achteraan |
| **Patrol** | kies Patrol en tik een plek aan | lopen heen en weer tussen hun eigen plek en die plek, met korte pauzes |
| **Hold** | knop Hold | blijven staan waar ze zijn |
| **Dismiss** | knop Dismiss | worden weer gewone dorpelingen; het wapen gaat terug naar de opslag |

**Wat je ziet**
- Een blauwe ring onder elke geselecteerde soldaat.
- Een gele doelmarkering op de plek van het bevel.
- Gele lijnen langs de patrouilleroutes.

**Paneel**
- Eigenschappen, gezondheid, tekst over het type en de samenstelling van de groep.
- Op mobiel is het paneel compact, zodat de kaart vrij blijft om te tikken.

## Interface van de kazerne

- **Soldaten**: het aantal per type.
- **Wapens**: wat er in het dorp beschikbaar is, en wat er al in de kazerne ligt (+n).
- **Zes kaartjes**: wapen, uitrusting, goud, trainingstijd, alle eigenschappen, en de knoppen +1 en +5.
- **Wachtrij**: per plek de status:
  - wacht op een vrijwilliger;
  - dragers brengen de wapens;
  - needs bows (dat goed is nergens in het dorp);
  - loopt naar de kazerne;
  - wacht op het wapen;
  - of een voortgangsbalk tijdens het trainen.

  Met ✕ breek je een plek af.
- **Klikken gaan niet verloren**: zolang een knop wordt ingedrukt, wordt het paneel niet ververst.
- **How to play** heeft een uitleg over de kazerne.

## Opslaan

- Savegame-versie 4.
- Soldaten gaan mee in de save: type, positie, kijkrichting, gezondheid, bevel, wachtplek, de
  patrouillepunten en het looppunt van een soldaat die onderweg is.
- De wachtrij van elke kazerne gaat mee.
- Rekruten die midden in de training zitten, krijgen in de save hun wapen en uitrusting terug in de
  kazerne. Na het laden trainen ze opnieuw. Er raakt niets kwijt en de bevolking blijft gelijk.
- Oude saves werken; Storehouses nemen de nieuwe Training Gear automatisch aan.
- Sloop van de kazerne: goud van de wachtrij terug, alle spullen terug naar de opslag, rekruten weer vrij.

## Tests (`tests/kazerne.spec.js`, desktop en mobiel)

1. **Volledige keten**
   - Er liggen geen wapens in voorraad.
   - De wapensmederij maakt eerst uitrusting en daarna zwaarden.
   - Dragers brengen ze vanuit de smederij.
   - De rekruut oefent met het echte zwaard ('slash').
   - Het rek toont steeds precies de voorraad.
   - Er komen 2 zwaardvechters bij met de juiste eigenschappen; de bevolking blijft gelijk.
   - Een soldaat aantikken, dubbeltikken, op de grond tikken (lopen), patrouilleren en Hold werken via de
     echte interface.
2. **Alle zes typen**
   - Elk type krijgt zijn eigen oefening en oefenplek; er vliegen echt pijlen.
   - Nooit meer rekruten dan oefenplekken.
   - De balans klopt: elk type is sterk tegen een ander type en zwak tegen een ander.
   - Elk type heeft de juiste helm, het juiste schild en het juiste wapen in de hand; de dolkvechter heeft
     er twee.
3. **Interface**
   - Kaartjes, +1 en +5, goud, voortgangsbalk en de status 'needs bows'.
   - Afbreken geeft het goud terug.
   - Rek en pallet tonen precies de voorraad.
   - De ⚔️-knop werkt, en bij ontslaan komen de bogen terug in de opslag.
4. **Kader en formatie** (desktop)
   - Shift-slepen, rechtsklik-bevel en een formatie met minimaal 0,3 tegel tussen soldaten.
   - De knop 'Drag to select' werkt ook.
5. **Opslaan en laden**
   - Opslaan midden in een training en tijdens een patrouille, daarna laden.
   - Alle aantallen kloppen en de training gaat verder.
   - Sloop geeft alles terug.

**Screenshots** in `tests/screenshots/<desktop|mobile>/`: `kazerne-training.png`, `kazerne-paneel.png`,
`leger-paneel.png` en `soldaten-bevel.png`.

## Beperkingen en volgende stappen

- **Gevechten bestaan nog niet.** Gezondheid, aanval, bereik en `VE.soldierDamage` zijn klaar als basis voor
  gevechten, verdediging en territoriumuitbreiding.
- **Geen botsingen tussen soldaten**: ze lopen door elkaar heen. Wel krijgt elk een eigen plek in de formatie.
- **Lange afstanden**: zeer verre bevelen kunnen de grens van de padzoeker (5000 stappen) raken. Dan meldt
  de game "cannot get there".
- **Deur ingesloten door rotsen**: ook bij andere gebouwen kan een deur door rotsen worden ingesloten. De
  test kiest daarom altijd een bereikbare plek.
