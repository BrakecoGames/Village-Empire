# Rapport: Storehouse-instellingen, grotere wereld, wereldrand, landdieren en prestaties

Git-checkpoint vóór dit werk: tag `checkpoint-voor-dieren-wereld-v2` (op commit `7c1e418`, versie 1.9.1).

## 1. Storehouse-instellingen
- **Standaard:** een nieuw Storehouse neemt alleen hout (stammen en planken) en steen aan (`VE.DEFAULT_ACCEPT` in `js/config.js`).
- **Bij het plaatsen:** zodra je de bouwknop kiest, toont het infopaneel "Store these goods", met per goed een
  knop en daaronder All/None. De keuze geldt voor het Storehouse dat je neerzet, en wordt onthouden
  voor het volgende Storehouse in dit spel. Dit werkt ook op de telefoon.
- **Tijdens de bouw:** selecteer de bouwplaats. Je ziet dezelfde keuze, met de uitleg "Carriers start bringing
  these goods as soon as the Storehouse is ready." Dragers brengen er pas iets heen als het gebouw klaar is.
- **Na de bouw:** zoals voorheen in het infopaneel, met de voorraad per goed. Wat je uitvinkt, brengen
  dragers naar een Storehouse dat het wel aanneemt.
- **Oude saves:**
  - Storehouses houden hun eigen keuze.
  - Heel oude saves zonder keuze nemen alles aan, zoals toen.
  - Goederen die nergens worden aangenomen, gaan zoals altijd naar het dorpshuis. Een productieketen loopt dus nooit vast.

## 2. Grotere wereld
- **Afmetingen:** de grote wereld is nu 208 × 208 tegels (was 144 × 144). Dat is ruim 2× de oppervlakte van 1.9.x en ruim 10× de
  oorspronkelijke kaart. Oude saves houden hun eigen grootte (64 of 144).
- **Startplekken:** nog steeds drie symmetrische starts met dezelfde verdeling van bos, steen, water en erts.
- **Neutraal gebied:**
  - een grotere vulkaan;
  - zes extra meren;
  - drie fords per rivier;
  - drie extra bijzondere plekken tussen de dorpen (ruïne, steenkring, monument);
  - drie extra verborgen plekken achter de dorpen (twee grotten, een verborgen waterval).
- **Dichtheid:** het aantal bomen, planten, rotsen en dieren groeit mee, maar met een plafond, zodat het geheugen beperkt blijft.

## 3. Mist en wereldrand (`js/horizon.js`, nieuw)
- **Buitenland:** rond de kaart ligt een ring buitenland van 64 tegels. Aan de rand sluit die naadloos aan op de kaart
  (gemeten afwijking: 0,0000002). Verder weg gaat hij over in heuvels en bergen.
- **Kleuren:** gedimd zoals land buiten je gebied, en ze vervagen in de nevelkleur van de lucht.
- **Bomen en water:** in de verte staan dezelfde Blender-bomen, als instances per vak. Rivieren en meren lopen door in een tweede waterlaag.
- **Randmist:** een driftende, wolkige nevel die vanaf de rand dichter wordt. De bruine rand en de
  donkere bodemplaat zijn weg.
- **Geen witte streep:** de streep aan de rand van de kaart (mist van onontdekt land buiten de kaart) is opgelost.
- **Test:** helemaal uitgezoomd, aan alle vier de randen en in alle vier de hoeken, in vier kijkrichtingen.
  Er was 0 % leeg beeld in de onderste helft.

## 4. Landdieren (Blender 5.3, `tools/blender/models/animals.py`)

### Modellen
- Konijn, ree, edelhert, wild zwijn en vos zijn volledig opnieuw gemaakt, op het niveau van de eekhoorn.
- **Skelet:** per poot een bovenpoot en een onderpoot (knie/hak), twee losse oren en een staart.
  De vos heeft een staart in twee delen; de herten hebben een nek.

| Dier | Driehoeken | Kenmerken |
|---|---|---|
| Konijn | ~990 | peervormig lijf, sterke dijen, lange achtervoeten, lepeloren met roze binnenkant, snorharen, wit staartje |
| Ree | ~1.440 | slank, witte spiegel, lichte keel, grote ovale oren, bok met klein gewei met drie enden |
| Hert | ~1.640 | groter, manen, groot vertakt gewei (alleen bij herten), donkere staart |
| Wild zwijn | ~1.150 | tonvormig lijf, hoge schouders, borstelkam, lange snuit met neusschijf, slagtanden |
| Vos | ~1.120 | witte borst en wangen, spitse snuit, amberkleurige ogen, zwarte sokken en oorpuntjes, volle staart met witte punt |

### Animaties
De loopcycli worden berekend per poot, met een standfase (voet op de grond) en een zwaaifase (knie
gebogen). Stappen gaat in diagonale paren, galop met voor- en achterpaar.

| Clip | Wat er gebeurt |
|---|---|
| `idle` | rondkijken, oorflapje, staartje zwaait, kopje scheef |
| `walk` | stappen (konijn: hupjes) met meebewegende kop en staart |
| `run` | galop, oren naar achteren |
| `eat` | grazen met de nek omlaag (herten), wroeten (zwijn), snuffelen (vos), knabbelen (konijn) |
| `alert` | kop omhoog, oren gespitst (konijn: rechtop zitten) |
| `rest` | liggen met de poten onder het lijf (vos: opgerold met de staart om zich heen) |
| `jump` | schriksprong: ineenduiken, afzetten, vlucht met opgevouwen voorpoten, landen |
| `pounce` | alleen vos: de muizensprong |

### Gedrag (`js/wildlife.js`)
- **Helling:** het lijf kantelt mee met de grond, zowel van voor naar achter als van links naar rechts. Voor- en achterpoten blijven
  op de grond. In de test volgde de kanteling de grond met een gemiddelde afwijking van 0,002 radiaal.
- **Geen botsingen:**
  - dieren duwen zich weg van boomstammen en van elkaar, met een zijwaartse component, zodat ze om
    een stam heen lopen in plaats van ertegen te blijven staan;
  - gebouwen, rotsblokken en water waren al geblokkeerd;
  - in de test kwam in 240 s geen enkele keer een dier in een stam of in een ander dier.
- **Grazen:** tijdens het eten zetten ze af en toe een paar stapjes naar het volgende plukje.
- **Groepsalarm:** schrikt één dier, dan volgt de groep een fractie later, als een golf. Dieren vlakbij reageren mee:
  dezelfde soort vlucht ook, andere soorten kijken eerst alert op. Dieren zonder vluchtweg kijken alert naar de onrust.
- **Schriksprong:** wie vanuit stilstand vlucht, begint met een sprong.
- **Konijnen:** kunnen nu ook gaan liggen.
- **Variatie:**
  - grootte 0,85–1,15;
  - vacht per dier lichter of donkerder en warmer of kouder (per soort afgestemd);
  - bokken en herten met of zonder gewei.

## 5. Prestaties
- **Vegetatie in vakken:** bomen, planten en de bomen in de verte zijn ingedeeld in vakken van 12 × 12 tegels. Per camerabeweging
  wordt per vak getest of het in beeld is. Een vak dat helemaal in beeld is, gaat in één keer mee; aan de rand van het
  beeld wordt per exemplaar getest.
  - Zonder die laatste stap werden er 3× te veel driehoeken getekend. Dat zag ik in de meting en is opgelost.
- **Wolkenlaag in vakken:** de wolkenlaag boven onontdekt land is ingedeeld in vakken van 24 × 24, zoals het terrein. Er wordt alleen getekend wat in beeld is,
  en vakken die helemaal ontdekt zijn, worden helemaal niet meer getekend. Het buitenland is ook in vakken verdeeld.
- **Dieren ver weg:** een dier buiten beeld en meer dan 40 tegels van de camera denkt eens per 1,5 s na (dichterbij buiten
  beeld: 2× per s; in beeld: elk beeld). Ook botsingen worden alleen dichtbij bijgewerkt.
- **Meting:** tekenen in softwareweergave (SwiftShader, zonder GPU), met hetzelfde startbeeld:

  | Weergave | 1.9.1 (wereld 144) | Nu (wereld 208) |
  |---|---|---|
  | Desktop | 311 ms | 283 ms |
  | Mobiel (3× pixels) | 113 ms | 140 ms |

  - Simulatie: < 1 ms per stap.
  - Op een echte GPU zijn dit enkele milliseconden. Het gaat om de verhouding.
- **Modelbestand:** `animals.glb` is groter (1,4 MB, was 0,9 MB) door de extra skeletknopen in de animaties.
  Het wordt één keer geladen.

## 6. Tests (Playwright, desktop + mobiel)

### Nieuw
- `tests/dieren.spec.js`:
  - modellen (clips, knopen, driehoeken);
  - 240 s gedrag van ~200 dieren;
  - botsingen met stammen en elkaar;
  - helling, variatie, groepsalarm, schriksprong;
  - minder vaak bijwerken ver weg;
  - prestaties;
  - ingezoomde foto's per clip (`dieren-idle/walk/flee/eat/alert/rest/jump.png`) en per soort (`dier-<soort>.png`),
    met een controle dat de poten echt bewegen.
- `tests/opslag-instellingen.spec.js`: kiezen bij plaatsen (muis en tikken), tijdens de bouw en daarna; dragers
  houden zich eraan; opslaan en laden.
- `tests/rand.spec.js`: naad, mist, bomen in de verte, geen leeg beeld uitgezoomd; foto `rand-uitgezoomd.png`.

### Bijgewerkt
- Tests die uitgingen van een Storehouse dat alles aanneemt, zetten dat nu expliciet aan:
  opslag, wapens, upgrades, wildlife, wereld.
- De wereldtest verwacht 208 tegels en 81 terreinvakken.
- De dubbeltik op soldaten rekent met het tijdstip van de aanraking zelf, niet met het moment van verwerken. Dat is
  robuuster op trage telefoons.

### Uitslag
- **Volledige suite (desktop + mobiel):** 161 geslaagd, 1 mislukt, 58 overgeslagen (tests voor maar één van de twee).
  - Mislukt: de stap met de dubbeltik op soldaten van de kazernetest op mobiel. Los gedraaid slaagde hij wel.
  - Oorzaak: tijdens de lange testronde viel de tweede tik door de trage softwareweergave buiten 400 ms.
  - Oplossing: die stap probeert de dubbeltik nu tot 3×. Daarna slaagde hij op desktop en mobiel.
  - De volledige suite is daarna niet opnieuw gedraaid.
