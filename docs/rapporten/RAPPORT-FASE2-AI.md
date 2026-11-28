# Rapport fase 2: single player tegen AI

Op basis van fase 1 (`RAPPORT-FASE1-FUNDAMENT.md`). Alle teksten in het spel zijn Engels.

## Menu en start
- **Hoofdmenu:**
  - **Continue** als er een opgeslagen spel is.
  - **Single Player** (`#btnNew`).
  - **Multiplayer**: uitgeschakelde knop met "Coming soon".
- **Single Player-instellingen:**
  - tegenstanders: None (vreedzaam dorp, zoals altijd), 1 of 2;
  - per tegenstander de moeilijkheid: Easy, Normal of Hard;
  - je startplek: Random, I, II of III.
- **Startplekken:** de drie eerlijke startplekken van het eiland (`world.starts`). Elke speler krijgt een dorpshuis, een
  startstapel, 10 dorpelingen en een gegarandeerd bosje en rotsblokken bij zijn plek.
- **Rang tegen de AI:** iedereen begint als **Market Town**, zodat kazerne en smid meteen te bouwen zijn. Daarbij krijgt
  iedereen 150 goud en 4 ijzerstaven extra. Een AI op Normal krijgt nog 60 goud extra, op Hard 150.
- **Kleuren:** jij blauw, de tegenstanders rood en groen. Te zien:
  - op een vaandel bij elk gebouw;
  - op hun soldaten (tabard) en dorpelingen (hoed);
  - op de grenspalen en op de minimap.
  Je eigen soldaten houden hun typekleur.
- **Meldingen:** je ziet alleen meldingen van je eigen dorp, plus waarschuwingen ("Enemy soldiers near your Village Hall!").

## Gevechten (`js/combat.js`)
- **Automatisch:** soldaten van verschillende teams vallen elkaar aan binnen hun waakafstand (6 tegels, boogschutters
  hun bereik + 2). Schade volgt `VE.soldierDamage`: aanval tegen verdediging, met het voordeel van het ene type op het
  andere.
- **Bevel `attack`:** soldaten kiezen en op een vijandelijk gebouw of een vijandelijke soldaat tikken (of rechtsklikken).
  Onderweg vechten ze met wie ze tegenkomen. Na een gevecht gaan soldaten die "hold" hadden terug naar hun plek.
- **Gebouwen** hebben levenspunten (dorpshuis 1.200, kazerne 520, toren 380, andere 200–300). Op 0 storten ze in, zonder
  materialen terug.
- **Wachttorens** schieten op vijandelijke soldaten binnen 6,5 tegels.
- **Winnen en verliezen:**
  - valt je **dorpshuis**, dan ben je verslagen: je dorpelingen vertrekken en je gebouwen vervallen langzaam;
  - valt de laatste tegenstander, dan heb je gewonnen;
  - het eindscherm toont **Victory** of **Defeat** met een overzicht en een knop **Back to menu**.

## AI (`js/ai/`)
| Bestand | Wat |
|---|---|
| `difficulty.js` | Alle knoppen per moeilijkheid (`VE.AI_LEVELS`). Hier stel je de AI bij. |
| `planner.js` | Economie: build order, prioriteiten en plekken zoeken. |
| `army.js` | Leger: trainen, verdedigen en aanvallen. |
| `ai.js` | De beslislus per AI-speler. |

**Alleen commando's:** de AI leest de spelstatus en verandert niets zelf. Alles gaat via `g.issue(...)`, net als bij de
mens. Getest: elk AI-gebouw staat in het commandolog. Zijn geheugen (`player.ai`) is JSON en gaat mee in saves en
snapshots.

**Een beslisronde** (om de `think` seconden):
1. **Opslag vol** (producenten op "Storage full" en geen plek in de Storehouses) → extra Storehouse.
2. **Voedsel:** bij tekort, honger, of minder dan 1 voedselgebouw per 9 dorpelingen → visser of jager, daarna graan → molen → bakkerij.
3. **Dragers:** minder dan 3 vrije dragers → eerst een huisje. Bouwmateriaal en opslag krijgen altijd voorrang, anders
   blijft alles op steen of planken wachten.
4. **Woningen:** als het vol is, er eten genoeg is en het maximum (160) nog niet bereikt is.
5. **Bouwmateriaal:** houthakker, zagerij, steengroeve of steenmijn bij tekort.
6. **Build order** (`VE.AI_BUILD`): voedsel → hout/steen → woningen → opslag → kolen- en ijzermijn → smelterij → smid →
   kazerne → markt → meer van alles.
   - Een mijn die binnen de grenzen geen plek heeft, krijgt een wachttoren richting de ader.
   - Uitgeputte mijnen breekt hij af.
7. **Beheer:**
   - **Smid:** maakt wat de wachtrij van de kazerne mist (uitrusting of het wapen). Hij wisselt nooit midden in een partij
     en hooguit eens per 20 seconden.
   - **Markt:** verkoopt het overschot; voedsel alleen boven de reserve.
   - **Opdrachten:** wat af is, int hij (goud).
8. **Leger:**
   - **Trainen** volgens de mix van zijn moeilijkheid.
   - **Verdedigen:** vijanden bij zijn dorpshuis → alle soldaten daarheen.
   - **Aanvallen:** zodra het leger groot genoeg is en het vroegste aanvalsmoment voorbij is, valt hij met alles het
     dichtstbijzijnde vijandelijke dorpshuis aan. Nieuwe soldaten sluiten aan. Na een verloren aanval wacht hij eerst
     (`regroup`).

**Moeilijkheid bijstellen** (`js/ai/difficulty.js`):
| | Easy | Normal | Hard |
|---|---|---|---|
| denkt elke | 6 s | 3 s | 1,5 s |
| slordig (stap overslaan) | 30 % | 8 % | 0 % |
| bouwplaatsen tegelijk | 1 | 2 | 3 |
| aanval vanaf | 25 min, 9 soldaten | 15 min, 6 soldaten | 10 min, 6 soldaten |
| productiebonus | — | — | +25 % |
| soldaten | zwaardvechters | + boogschutters | + speerdragers |

## Tests (`tests/ai.spec.js`, desktop en mobiel)
- **Menu:** Single Player met 2 tegenstanders (Hard en Easy) en startplek II.
  - Je krijgt die plek, elke speler heeft dorpshuis, 10 dorpelingen en rang Market Town.
  - Drie eigen kleuren en vaandels; Multiplayer is uitgeschakeld met "Coming soon".
- **Gevechten:**
  - groepen vechten tot één kant over is, en de toren raakt;
  - een aanval op je eigen gebouw wordt geweigerd;
  - een huis valt, daarna het dorpshuis, en dan Victory;
  - het AI-dorp vervalt, het eindscherm Defeat werkt en "Back to menu" ook.
- **Tegen 1 en 2 AI's op Easy, Normal en Hard** (14 spelminuten versneld). Per AI gecontroleerd:
  - genoeg gebouwen en soorten;
  - elk gebouw via een commando;
  - de bevolking groeit en er is voedsel, zonder massale honger;
  - Normal en Hard trainen soldaten;
  - weinig afgewezen commando's.
- **AI tegen AI** (3 AI's: Easy, Hard en Normal, versneld): ze bouwen, eten en vallen aan tot er een winnaar is.
  Voorbeeld met seed 777: Hard verslaat Easy op minuut 15, Normal wint op minuut 18. 1,7 ms per tick.
- **Determinisme met AI:** zelfde seed geeft hetzelfde potje. Een snapshot midden in het potje loopt daarna identiek verder.
- **Aanvallen via de interface:** soldaten gekozen en op het AI-dorpshuis getikt → commando `attack`, en alle soldaten
  gaan aanvallen.

## Volledige suite (desktop en mobiel)
211 geslaagd, 4 mislukt. Daarna opgelost en opnieuw getest:
- **Menu op een liggende telefoon:** het Single Player-paneel paste niet (knoppen onder het scherm). Op lage schermen
  verdwijnt nu de titel zolang het paneel open is, en het paneel kan scrollen.
- **AI-test met 2 AI's:** twee AI's op Hard vochten onderling en één werd binnen 14 minuten verslagen. Dat is goed gedrag;
  de test telt een verslagen AI nu niet meer mee.
- **Kazerne, rechtsklik-formatie:** slaagde bij opnieuw draaien.
- **Strandtest uit 1.13.0:** blijft wisselvallig per willekeurige wereld (420 strandtegels, grens 450). Al bekend van vóór
  dit werk.

## Bekende punten voor later
- **Strandtest:** de grens van de strandtest uit 1.13.0 is per willekeurige wereld te krap.
- **AI:**
  - De AI bouwt niet de hele economie: geen wijnbouw, koper of goud, en geen upgrades van gebouwen.
  - Hij kiest geen wapens tegen de samenstelling van jouw leger.
  - Uitbreiden kan in `planner.js` en `army.js`.
- **Gevechten:**
  - Soldaten zoeken de kortste weg, maar formeren niet slim (alles in één groep).
  - Gewonde soldaten genezen niet.
  - Er zijn geen belegeringswapens.
- **Opslaan:**
  - De gewone save (localStorage) bewaart spelers, AI-geheugen, eigenaars, levenspunten en de winnaar.
  - Een gevecht dat bezig is, begint na het laden opnieuw: soldaten staan dan op hun plek.
  - De volledige snapshot is te groot voor localStorage (zie fase 1).
- **Per speler:** mist en landmerken zijn nog per scherm (de mens). Voor online spelen moet dat per speler.
- **Dorpshuis:** een gebouw van een tegenstander aantikken laat alleen de eigenaar en de levenspunten zien.
