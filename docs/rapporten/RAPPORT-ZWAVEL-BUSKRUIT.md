# Rapport: zwavelwinning en buskruitproductie

Git-checkpoint vóór dit werk: tag `checkpoint-voor-zwavel-buskruit` (commit `c318976`).

## 1. Zwavel (Sulfur)
- **Nieuwe grondstof** `sulfur`: prijs 7, zichtbaar vanaf Market Town. Hij komt alleen rond de vulkaan voor.
- **Afzettingen:** zes zwavelvelden op de buitenhelling van de vulkaan (niet in de krater), met elk 5–7 plekken (36 in totaal).
- **Zichtbaar in de wereld** (Blender `tools/blender/models/sulfur.py` → `public/models/sulfur.glb`, drie varianten):
  - een gele kristalkorst met puntige kristallen rond een zwartgeblakerde opening, tussen brokken basalt met okergele vlekken;
  - variant 2 heeft een kristalschoorsteentje, variant 3 een spleet met een gele rand;
  - de grootte volgt de voorraad. Een lege plek is alleen nog een kale opening, die weer aangroeit;
  - uit de rijke velden komt damp.
- **Herstel:** de zwavel komt langzaam terug, één eenheid per plek per 45 seconden tot het maximum. De
  vulkaan blijft zo de hele game de zwavelbron.
- **Overzicht:** de mijnbouw-informatielaag (Survey) toont zwavel in geel, net als de andere ertsen.

## 2. Zwavelmijn (Sulfur Mine)
- **Waar te bouwen:** alleen op de vulkaanhelling, naast een zwavelafzetting. Elders geeft het spel "Sulfur Mines can only be
  built on the slope of the volcano". Rang Market Town; kost 6 planken en 4 steen; tabblad Mining.
- **Zichtbaar werk:** de mijnwerker loopt naar een afzetting, hakt de kristallen los (er stuift geel stof op) en draagt
  ze zichtbaar terug. Lokale opslag maximaal 6; daarna wacht hij op dragers.
- **Blender** (`sulfurmine.py`, 3 levels):
  - een lage hut van basalt met een houten afdak tegen hitte en dampen, en een bord met een geel kristal;
  - een sorteertafel vol kristallen, manden en een zak zwavel;
  - een karretje op een kort spoor en een rokende fumarole met een gele korst;
  - level 2: een katrolbok met emmer en een gereedschapsrek met houwelen;
  - level 3: een ton water (tegen brand), een kruiwagen met zwavel en een droogrek.

## 3. Buskruitwerkplaats (Gunpowder Workshop)
- **Recept** (abstract): 1 zwavel + 1 steenkool + 1 hout geeft 2 buskruit, in 9 seconden.
  - Inkoopwaarde 7 + 4 + 1 = 12 tegen een opbrengst van 2 × 12 = 24. Dat loont, maar de grondstoffen zijn een flinke reis waard.
- **Gebouw:** rang Town, tabblad Military. Kost 6 planken, 8 steen en 2 ijzerstaven.
- **Blender** (`powdermill.py`, 3 levels):
  - een werkplaats van natuursteen met een vakwerkverdieping en een leien dak, zonder schoorsteen
    (vuur en kruit gaan niet samen);
  - een open afdak met een stampmolen: een nokkenas, een handwiel, een eiken trog en drie zware stampers die in het spel
    op en neer gaan terwijl er gewerkt wordt (los Blender-onderdeel `powdermill_part_stamp`);
  - een waarschuwingsbord (rood ruitje met een witte vlam), een ton water met emmer, zeven en een rek met verzegelde vaatjes;
  - level 2: een tweede rek en een weegschaal;
  - level 3: een stenen kruitkelder met een ijzeren deur en een bliksemafleider.
- De aangeleverde zwavel, steenkool en het hout liggen zichtbaar op hun eigen plek. Het buskruit ligt als vaatjes bij de deur.

## 4. Voorbereid voor de toekomst
- Buskruit (`gunpowder`) is een gewone grondstof: opslaan, vervoeren en verkopen werken al.
- `VE.FUTURE_USES.gunpowder = ['cannon', 'mortar', 'artillery', 'siege']` geeft aan waarvoor het later dient. In het spel staat
  bij buskruit "Kept for the cannons and artillery of the future".
- Kanonnen en artillerie zijn nog niet gebouwd.

## 5. Logistiek
- Zwavel en buskruit lopen mee in het bestaande systeem:
  - dragers halen ze op en brengen ze naar de werkplaats of naar een Storehouse dat ze aanneemt;
  - lokale opslag maximaal 6;
  - opslaan en laden werkt, inclusief de vinkjes van de opslag.
- **Zichtbare voorraden** (Blender `items.py`): zwavel is een gele kristalbrok op een hoop, buskruit een vaatje
  met ijzeren banden, zwart deksel, rood zegel en een lont, netjes gestapeld. Dragers dragen dezelfde modellen.

## 6. Strategie: de vulkaan
- **Verdeling:** elke speler heeft een klein eigen veld aan zijn kant van de vulkaan (57–60 tegels van zijn
  start). Tussen elke twee spelers ligt een **rijk, betwist veld** (7 plekken, 40 per plek), voor beide
  spelers even ver (64–65 tegels).
- **Waarom het strategisch is:**
  - zwavel bestaat nergens anders;
  - wie de vulkaan beheerst, beheerst straks het buskruit en dus de kanonnen;
  - een wachttoren op de vulkaanhelling kijkt bovendien ver over het land (tot 9 tegels extra).
- **Om er te komen:** de vulkaan ligt ver van de startplekken, dus je moet je grondgebied er met wachttorens heen uitbreiden.

## 7. Bestaande saves en prestaties
- **Oude saves:**
  - saves met een vulkaan (grote wereld) krijgen bij het laden dezelfde zwavelvelden; de bestaande ertsaders blijven gelijk;
  - een kleine (oude) wereld van 64 × 64 heeft geen vulkaan en dus geen zwavel, en geeft geen fouten.
- **Prestaties:**
  - de afzettingen zijn 3 InstancedMeshes met een paar tientallen exemplaren;
  - ze worden twee keer per seconde bijgewerkt, alleen als er iets veranderde;
  - de damp komt alleen uit ontdekte rijke velden.

## 8. Tests (Playwright, desktop + mobiel): `tests/zwavel.spec.js`
- **Volledige keten** (15 minuten speeltijd):
  - de zwavelmijn naast een eigen veld leverde 78 zwavel; de werkplaats maakte 60 buskruit, allemaal in de opslag;
  - de mijnwerker liep, groef en droeg zichtbaar, en de mijn had nooit meer dan 6 liggen;
  - zwavel en buskruit liggen als stapels in de opslag;
  - na 3 minuten was een lege plek weer aangegroeid;
  - opslaan en laden behoudt de lege plek, de hoeveelheden en de opslagvinkjes;
  - een oude save krijgt zwavel en houdt zijn aders.
- **Eerlijkheid:** eigen velden 57–60 tegels, betwiste velden 64–65 tegels van elke speler.
- **Interface:** rangen, bouwknoppen, uitleg en recept. Een kleine wereld zonder vulkaan heeft geen zwavel en geeft geen fouten.
- **Foto's:** `zwavel-vulkaan.png` en `buskruitwerkplaats.png`.

### Uitslag
- **Volledige suite (desktop + mobiel):** 175 geslaagd, 1 mislukt, 62 overgeslagen (tests voor maar één van de twee).
  - Mislukt: de natuurtest "bloemen langs het pad". Die faalde 1 op de 4 keer, afhankelijk van de wereld.
  - Oorzaak: de test legde zijn proefpad soms op de nieuwe rotsheuvel bij de start, en op rots groeien bewust
    geen bloemen.
  - Oplossing: de test kiest nu een pad op gras. Daarna 4 keer achter elkaar geslaagd.
  - De volledige suite is daarna niet opnieuw gedraaid.
