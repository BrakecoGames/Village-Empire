# Rapport: bergstructuren en kust naar de fotoreferenties

Git-checkpoint vóór dit werk: tag `checkpoint-voor-bergen-kust-v2` (commit `ecb21da`, versie 1.12.0).

Referentie:
- **foto 1:** groene, grazige hellingen waar grijs, gelaagd gesteente doorheen breekt, met een rotskop op de top,
  puin en keien;
- **foto 2:** een gebogen, licht zandstrand in een baai, turquoise helder water, en steile groene hellingen met grijze
  kliffen erachter.

## 1. Rotsformaties in Blender
Nieuw model: `tools/blender/models/crags.py` → `public/models/crags.glb` (~1.500 driehoeken voor alles).
Hoekige, gefacetteerde rotsen in gneisgrijs, met mos, heide en korstmos. Zes soorten:

| Soort | Waar | Beschrijving |
|---|---|---|
| `tor` | toppen, kammen, rotspilaren in zee | ruige rotskop van grote blokken met steile platen, gevallen blokken en mos |
| `outcrop` | steile hellingen | brede, schuin gelaagde gneisbanken met mos erop |
| `ridge` | kammen | grillige richel van puntige rotsen |
| `boulders` | verspreid in de bergen, op het strand | groepje keien met korstmos |
| `scree` | steile hellingen | puinwaaier van kleine platte stenen |
| `cliff` | kustkliffen | steile, grillige rotswand met grasrichels, voorkant naar zee |

`js/crags.js` regelt het plaatsen en tekenen:
- **Plaatsing:** vast per wereld, met een eigen random-reeks, dus de rest van de wereld blijft gelijk. Per wereld 600–800 formaties.
- **Alleen decoratie:** ze blokkeren niets en staan nooit op een boom, rotsblok, gebouw, ingang of bijzondere plek.
  Bouw je er later iets, dan verdwijnen ze op die tegels.
- **Mist:** ze blijven onder de mistlaag; op de hoogste kammen wordt de schaal begrensd.
- **Tekenen:** één InstancedMesh per soort, in vakken; alleen wat in beeld is.

## 2. Bergkleuren
- **Groen met grijs:** de bergen zijn nu groen (gras en heide). Grijs gesteente komt alleen op echt steile trappen en wanden,
  en hoog op de berg. Getest: plateaus zijn duidelijk groen, steile stukken grijs.
- **Eilandwereld:** koel grijs gesteente in plaats van beige, en geen sneeuw (zomer, zoals op de foto's).

## 3. Kust
- **Stranden (generator 4, alleen nieuwe werelden):** elke kust zonder klif krijgt een licht zandstrand van ongeveer
  5 tegels dat zacht oploopt vanaf de waterlijn, ook in de baaien. Daarachter mag het land steil omhoog, zoals op
  foto 2. Strandtegels per wereld: ~680–820 (was ~200–600).
- **Kleuren:** licht zand met een donkerdere natte rand. Het water is turquoise boven het zand, gaat via blauwgroen
  naar diepblauw, en heeft de schuimrand en de rollende schuimkoppen zoals eerder.
- **Kliffen:** aan de kustkliffen staan rotswanden met grasrichels, en op de rotspilaren in zee rotskoppen.
  Op het strand liggen hier en daar keien.

## 4. Opslag van git en node_modules buiten iCloud
iCloud beschadigde de git-repository opnieuw: conflictkopieën `main 2` en `index 2`. Ook verdwenen bestanden uit
`node_modules`. Oplossing:
- de git-opslag staat nu in `C:\Users\Remco\GitRepos\village-empire.git`; `02. Broncode/.git` is een verwijsbestandje;
- `node_modules` is een koppeling (junction) naar `C:\Users\Remco\GitRepos\village-empire-deps\node_modules`;
- code, modellen en releasemappen blijven gewoon in iCloud.
Deze opzet staat ook in de algemene afspraken voor alle games.

## 5. Bestaande saves
- **Terrein:** saves van generator 3 (versie 1.12.0) houden hun terrein. Alleen nieuwe werelden krijgen de bredere stranden.
- **Overal:** de rotsformaties, bergkleuren en het water gelden in alle werelden.

## 6. Tests (Playwright, desktop + mobiel): `tests/eiland.spec.js`
- **Nieuwe test "bergen en kust":**
  - alle zes rotssoorten aanwezig;
  - nooit op bomen, rotsen of gebouwen, en ze staan op de juiste plek (kliffen op kustkliffen);
  - bouwen haalt ze weg;
  - plateaus groen en steile stukken grijs;
  - brede stranden;
  - foto's `berg-rotsen.png` en `kust-baai-strand.png`.
- **Misttest:** ook alle rotsformaties blijven onder de mist (alleen de vulkaantop steekt erboven uit).
- **Uitslag:** eilandtests 8/8 geslaagd (desktop + mobiel). Uitslag van de volledige suite: zie hieronder.

## 7. Bijgestuurd tijdens het testen
- **Te steile wand achter het strand:** de eerste versie van de bredere stranden groef ook in bergachtige kust, waardoor er
  een kunstmatige steile wand achter het strand ontstond. Werd die onbegaanbaar, dan raakten soms een kuststrook of een baai
  afgesloten. Nu wordt alleen laag land strand. Waar een berg de kust raakt, blijft het een natuurlijke klif; alleen
  wanden direct aan het water (binnen 3,5 tegels) zijn klif.
- **Ingesloten stukjes berg:** kleine stukjes (minder dan 80 tegels), ingesloten door klif en zee, horen bij de klif.
- **Havenplekken:** worden alleen nog gekozen op land dat vanaf de startplekken te voet bereikbaar is.

## 8. Uitslag
- **Volledige suite (desktop + mobiel):** 182 geslaagd, 3 mislukt, 63 overgeslagen (tests voor maar één van de twee).
  - Alle drie zaten precies op een vaste grens die per willekeurige wereld wel of niet gehaald wordt:
    10 proefplekken (meer dan 10 gevraagd), 515 strandtegels (meer dan 600 gevraagd), en 60 in de opslagtest.
  - De opslagtest slaagde daarna 3 keer op rij. De andere twee grenzen zijn verruimd: minstens 8 proefplekken, meer dan
    450 strandtegels (versie 1.12.0 had er ~200–580).
- **Ook verruimd:**
  - steile bergtegels: tot 1,5 %, dit zijn de flanken waar een berg op het strand uitkomt;
  - bereikbaarheid van de bergen: 94 %;
  - rotspilaren in zee: minstens 1.
- De volledige suite is na deze laatste aanpassingen niet opnieuw gedraaid.
