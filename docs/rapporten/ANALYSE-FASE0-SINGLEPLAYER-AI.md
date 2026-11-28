# Fase 0: analyse voor single player tegen AI en (later) multiplayer

Stand: versie 1.13.0 + lokale commit `d5daa04` (voedsel en zwaarden, nog niet online).

## 1. Waar de simulatie zit
| Bestand | Inhoud |
|---|---|
| `js/sim.js` (1.630 r.) | `Game`: init/nieuw dorp, gebouwen (plaatsen, bouwen, upgraden, slopen), dorpelingen (werkers, dragers, bouwers), opslag en voorraad, dispatch (wie draagt wat), productie, nieuwkomers, quests/rangen, handel, opslaan/laden, `update(dt)` |
| `js/military.js` | kazerne, wachtrij, rekruten, soldaten, bevelen (verplaatsen/patrouille), opslaan soldaten |
| `js/food.js` | honger, eten, tevredenheid (nieuw) |
| `js/mining.js`, `js/sulfur.js` | ertsaders, mijnen, zwavel |
| `js/wildlife.js`, `js/squirrel.js` | wilde dieren en jacht (eigen seeded rng) |
| `js/world.js`, `js/worldgen.js`, `js/paths.js`, `js/vegetation.js` | terrein, territorium, mist, paden, bomen/rotsen |
| `js/config.js` | alle definities: goederen, gebouwen, recepten, soldaten, rangen/quests |

De **game loop** staat in `js/main.js` (`frame`):
- per beeldje `g.update(dt)`, met dt = de echte frametijd (max. 0,05 s);
- bij 2× of 3× snelheid gaat dat 2 of 3 keer per frame;
- daarna rendering (`fx`, `piles`, `sr`, `wr`, `ui`, camera).

**Gevechten bestaan nog niet.**
- Soldaten zijn er wel: trainen, selecteren, verplaatsen, patrouilleren, met hp/atk/range/rate in `VE.SOLDIERS`.
- Er is nog niets dat schade doet of gebouwen aanvalt (zie de kop van `military.js`).
- Voor fase 2 moeten gevechten dus nieuw gebouwd worden. Zie keuze A hieronder.

## 2. Waar UI, input en rendering de simulatie direct aanpassen
**UI → simulatie** (`js/ui.js`, `js/army-ui.js`): roept overal direct `Game`-methodes aan of schrijft velden:
- **bouwen:** `g.gold -= …` en `g.placeBuilding(...)` vanuit de UI; de Storehouse-filter wordt daarna door de UI gezet (ui.js ~294);
- **gebouwen:** `upgrade`, `cancelUpgrade`, `demolish`, `setRecipe`, `setAccept`;
- **markt:** `sell[r] = …`, `keep = …`, `feed = …` als directe veldschrijvingen;
- **overig:** `trade`, `buyUpgrade`, `claim`, `promote`, snelheid `g.speed = …`;
- **leger:** `queueTraining`, `cancelTraining`, `orderSoldiers`.

Daarna roept de UI zelf `VE.save()` aan.

**Simulatie ↔ weergave zitten in dezelfde objecten:**
- `Game` maakt en beheert THREE-meshes zelf: `this.root`, `placeBuilding` → `makeMesh`, steigers, animaties van molens en rook.
- `World` en `Nature` doen dat ook.
- `sim.update` zet ook puur visuele dingen, zoals `s.y` (hoogte), rook-timers, wieken en vlaggen.

**Rendering → simulatie:**
- De renderers (`fx`, `piles`, `settler-glb`, `wildlife`-render) lezen vooral, maar enkele schrijven tijdelijke velden.
- Gebeurtenissen gaan via `VE.bus` (dust, toast, sfx, float). Dat is eenrichtingsverkeer van sim naar weergave, en dat is goed.

## 3. Eén speler?
Ja, op een paar voorbereidingen na:
- **Wat er al is:** `g.players` (max. 3, met kleur en startplek), `owner: 0` op gebouwen en dorpelingen, en 3 eerlijke startplekken per wereld (`w.starts`, getest).
- **Globaal, en dus straks per speler:**
  - voorraad: `g.stock` telt alle opslag van alle gebouwen bij elkaar;
  - `gold`, `rank`, `claimed` (quests), `stats`, `upg` (upgrades), `speed`;
  - territorium `world.owned` (één kaart: wel of niet van jou), mist `world.explored`;
  - `g.hq` (het eerste dorpshuis), nieuwkomers (`arriveT`), voedsel en tevredenheid;
  - dispatch: elke drager mag elk gebouw bedienen.
- **Opslaan:** alleen het aantal dorpelingen, niet elke dorpeling apart. Bij het laden worden ze opnieuw gemaakt.

## 4. Toeval, tijd en framerate
- **Framerate:** de simulatie loopt met variabele dt uit de frametijd. Twee machines komen dus niet op dezelfde uitkomst uit.
  Voor lockstep-multiplayer is dat fataal. Ook gewoon spelen is nu licht framerate-afhankelijk.
- **`Math.random()` in de simulatie (±30 plekken):**
  - `sim.js`: looppaden, startrichting, wachttijden, boomplanten, visvangst (85 %), jachtsucces;
  - `food.js`: voedselkeuze, verzadiging;
  - `military.js`: patrouillewachttijd;
  - `sim.js:104`: de seed van een nieuwe wereld.
- **Al deterministisch:** de wereldgenerator, de dieren (`VE.rng(seed)`) en de ertsaders.
- **Puur cosmetisch, mag `Math.random` blijven:** rook, vonken, geluid, pijlspreiding, landmerk-effecten.
- **`Date.now()` en `performance.now()`:** alleen voor het opslagmoment en UI-animaties (dubbeltik, pulserende ring).
  Dat beïnvloedt de uitkomst niet.
- **Belangrijk voor serialiseren:** acties lopen via closures. Een dorpeling heeft een callback (`s.cb`, `s.onAct`) voor
  "als je aankomt, doe dan X", in ongeveer 40 plekken. Die kun je niet naar JSON schrijven. Daarom bewaart de save nu
  alleen de rusttoestand, en wat dragers op het moment van opslaan vasthouden, gaat terug naar de bron.

## 5. Plan voor de ombouw

### Fase 1: fundament (geen netwerk)
1. **Spelers** (`js/players.js`): `Player { id, name, color, team, isAI, ai: { level }, gold, rank, claimed, stats, upg }`.
   - `ownerId` op elk gebouw, elke dorpeling en elke soldaat.
   - Voorraad, voedsel, tevredenheid, nieuwkomers, territorium en dispatch per speler. Een drager werkt alleen voor zijn
     eigen speler.
   - `g.hq` wordt `g.hqOf(pid)`. Voor de mens blijven `g.gold` en `g.stock` bestaan als korte weg naar speler 0, zodat UI
     en tests niet allemaal tegelijk om moeten.
2. **Commando's** (`js/commands.js`):
   - `g.issue(cmd)` zet het commando in een wachtrij.
   - Aan het begin van de volgende tick voert `applyCommand(g, cmd)` het uit: eerst valideren (eigenaar, plek,
     grondstoffen, rang), dan uitvoeren. Het geeft `{ ok, why }` terug.
   - Soorten: `build`, `demolish`, `upgrade`, `cancelUpgrade`, `setRecipe`, `setAccept`, `setMarketTrade`
     (sell/keep/feed), `trade`, `buyUpgrade`, `claimQuest`, `promote`, `trainUnit`, `cancelTraining`, `moveUnits`
     (hold/patrol), `attack`, `setSpeed`.
   - UI, army-ui en AI gebruiken alleen nog `issue`. De UI leest de status alleen.
   - Een log van alle commando's per tick is meteen een replay. Later stuurt de netwerklaag precies die commando's door.
3. **Vaste ticks:**
   - De simulatie loopt op 20 ticks/s (dt = 0,05), los van de framerate, met een accumulator in `main.js`.
   - Snelheid 2× en 3× = meer ticks per seconde.
   - De weergave interpoleert de posities van dorpelingen, dieren en soldaten tussen twee ticks, zodat het vloeiend
     blijft op 60/120 Hz.
4. **Seeded random:**
   - `g.rand()`: één seeded generator voor de simulatie, opgeslagen in de save.
   - Alle `Math.random()` in de simulatie gaan erheen.
   - Cosmetische effecten krijgen een aparte `VE.fxRand`, zodat ze de simulatie nooit beïnvloeden.
5. **JSON-status:**
   - Ik maak de callbacks stap voor stap "data-taken". Voorbeelden: `s.goal = { kind: 'deliver', b: id }`,
     `{ kind: 'eat', … }`, `{ kind: 'gather', … }`, met één functie die bij aankomst op `kind` kiest.
   - Doel: de hele simulatiestatus wordt een `snapshot()` → JSON → `restore()`, en daarna loopt hij identiek door.
     Dat test ik.
   - Meshes, materialen en animaties komen op aparte weergave-objecten (een `view`-veld dat niet geserialiseerd wordt).
6. **Test:**
   - alle bestaande tests (bouwen, productie, transport, voedsel, kazerne, opslaan);
   - nieuw: determinisme (zelfde seed + commando's → zelfde status, ook bij 30 fps tegen 144 fps);
   - nieuw: snapshot→restore→doorspelen is identiek;
   - nieuw: UI verandert niets zonder commando.

### Fase 2: AI en single player
- **Menu:** "Single Player" (1–2 tegenstanders, Easy/Normal/Hard per tegenstander, startpositie of willekeurig) en
  "Multiplayer" (uitgeschakeld, "Coming soon").
- **Starts:** de bestaande 3 eerlijke startplekken op het eiland. Elke speler krijgt een dorpshuis, een startstapel,
  10 dorpelingen en eigen goud.
- **Kleuren:** kleur op daken, vlaggen, de tabard van soldaten, de rand van het territorium en de minimap.
- **AI** (`js/ai/`: `ai.js` met de beslislus, `buildorder.js`, `priorities.js`, `army.js`, `difficulty.js`):
  - de AI ziet de status alleen lezend en doet alles via `issue()`;
  - build order plus prioriteiten om de paar seconden;
  - leger: verdedigen en aanvallen.
- **Moeilijkheid:** alle knoppen in één tabel (`difficulty.js`): reactietijd, fouten, aanvalsdrempel en een
  productiebonus voor Hard.
- **Winnen:** zie keuze B.
- **Eindscherm:** Victory of Defeat, plus een knop terug naar het menu.
- **Test:** 1 en 2 AI's op elke moeilijkheid, plus versneld AI tegen AI (headless, bijv. 40 spelminuten). Ik controleer
  dat de AI blijft bouwen, voedsel op peil houdt, traint en aanvalt.

## 6. Keuzes die bij jou liggen (mijn aanbeveling eerst)
- **A. Gevechten.** Die moeten nieuw gebouwd worden. Aanbeveling:
  - soldaten vallen vijandelijke soldaten in bereik automatisch aan en gebruiken de bestaande hp/atk/def/range en het
    steen-papier-schaar-voordeel (`strong`);
  - met het `attack`-bevel vallen ze ook gebouwen aan, en een gebouw op 0 hp stort in;
  - dorpelingen vechten niet;
  - wachttorens schieten op vijanden binnen hun bereik.
- **B. Winregel.** Aanbeveling: verslagen als je **dorpshuis** valt. Het dorpshuis krijgt veel hp en kan alleen door
  soldaten worden aangevallen. Na een val gaan de overige gebouwen van die speler langzaam in verval, zodat het spel
  niet blijft hangen.
- **C. Multiplayer-model voor later.** Aanbeveling: **deterministische lockstep**. Alleen commando's gaan over het
  netwerk, met kleine pakketjes, en elke speler rekent dezelfde simulatie. Fase 1 bereidt dat volledig voor met vaste
  ticks, seeded random en een commandolog.
  - Het alternatief is server-autoritair: een server rekent en stuurt de status. Dat is zwaarder en vraagt een server.
- **D. Ranghoogte en quests.** Aanbeveling: per speler, en de AI doorloopt ze ook (dat ontgrendelt zijn gebouwen).
- **E. Saves.**
  - Bestaande saves blijven werken en worden "single player zonder tegenstanders".
  - Een potje tegen de AI wordt ook automatisch opgeslagen.

## 7. Grootte en risico
- **Omvang:** dit is een grote ombouw.
  - Fase 1 raakt bijna elke regel in `sim.js`, `military.js` en `food.js`, en alle UI-acties.
  - Het meeste werk zit in de callbacks naar data-taken en het scheiden van meshes en status.
- **Aanpak:**
  - werken in stappen, met na elke stap de volledige testsuite;
  - voor elke stap een git-checkpoint;
  - pas uploaden als jij dat zegt.
- **Niet gedaan:** de vorige versie (voedsel en zwaarden, `d5daa04`) staat nog alleen lokaal. Uploaden heb ik niet gedaan
  omdat je daar nog niet op antwoordde.
