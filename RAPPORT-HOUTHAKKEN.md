# Rapport: bomen en houthakken

Git-checkpoint vóór de wijzigingen: tag `checkpoint-voor-houthakken`. De wapensmederij staat daaronder
als lokale commit, nog niet gepusht.

## 1. Naadloze boommodellen (`tools/blender/models/nature.py`)

**Oorzaak van de gaten**
- Een kromme stam bestond uit losse buizen per stuk. Bij elke knik stonden de ringen loodrecht op hun eigen
  stuk, waardoor er wigvormige kieren ontstonden.
- Takken begonnen precies op het stamoppervlak, zonder aansluiting.

**Oplossing**
- **`chain`**: de stam is nu één doorlopende buis. Bij elke knik staat de ring schuin, in de gemiddelde
  richting van beide stukken, met een iets bredere straal (verstek). De buis is glad gearceerd en bovenaan
  dicht.
- **`limb`**: elke tak begint een stukje in de stam of tak waar hij uit groeit. Houten takken boven de
  grond krijgen een kleine kraag op het aanhechtpunt. Wortels zitten daardoor ook dieper in de stam.

**Geldt voor alle soorten:** eik, oude eik, beuk, berk, den, spar, appel, peer en bloesem, plus de
easter-egg-varianten. Alle bomen blijven binnen hun driehoeksbudget; `nature.glb` is in totaal 16.806
driehoeken.

## 2. Houthakcyclus (`js/sim.js`, `js/world.js`)

1. **Boom zoeken:** de dichtstbijzijnde volgroeide, vrije boom. Een boom die een andere houthakker al heeft
   gekozen, wordt overgeslagen.
2. **Omhakken:** bijlslagen met geluid en houtsnippers.
3. **Omvallen** (`fellTree`):
   - **Richting:** weg van de houthakker. De game probeert 16 richtingen en mijdt gebouwen, deuren, water,
     andere bomen, rotsen en de rand van de kaart.
   - **Beweging:** eerst langzaam, daarna steeds sneller, als zwaartekracht. De boom draait om zijn voet en
     schiet niet weg.
   - **Landen:** de boom stopt op de hoek waarop de kroon de grond raakt. Het terrein langs de valrichting
     wordt meegerekend, dus hij zakt nooit door de grond. Daarna volgt een kleine stuit, met kraken, een
     doffe klap, stof en vallende bladeren.
   - **Liggen:** de boom blijft liggen en verdwijnt niet plotseling.
4. **In stukken hakken:**
   - De houthakker loopt naar de kroon en hakt die eraf, met bladeren. Er blijft één lange stam liggen.
   - Daarna hakt hij de stam in het midden door. Er liggen nu **2 losse boomstammen**, geschaald naar de
     dikte van de echte stam.
5. **Vervoeren:** de houthakker bukt, pakt een stam op, draagt hem zichtbaar naar zijn hut en legt hem op
   de stapel. Pas dan telt de stam in de lokale voorraad (max. 6). Daarna haalt hij de tweede stam.
6. Pas als alles weg is, zoekt hij een nieuwe boom. Hij begint alleen als er plek is voor beide stammen.

**Wat dit betekent voor de economie**
- Eén boom levert nu 2 stammen, maar de cyclus duurt langer door het lopen. De productie per houthakker
  blijft ongeveer gelijk, en een bos gaat twee keer zo lang mee.

**Niets raakt kwijt**
- **Slopen tijdens de cyclus:** de liggende boom en de stammen worden opgeruimd en het hout gaat naar de
  opslag.
- **Opslaan tijdens de cyclus:** hout in het bos en hout in de hand van werkers gaat mee in de save. Na het
  laden ligt het op de stapel bij de hut.
- **Werker wisselt:** de volgende werker gaat verder waar de vorige stopte.

**Prestaties**
- Alle losse stammen samen zijn één InstancedMesh: één draw call, maximaal 64 stammen.
- Houtsnippers gebruiken het bestaande deeltjessysteem, ook één draw call.

## 3. Details
- **Geluid:** nieuwe geluiden `creak` (kraken bij het vallen) en `thud` (de klap bij het neerkomen), naast
  de bestaande `chop`.
- **Houtsnippers:** bij elke bijlslag, ook bij het in stukken hakken.
- **Status van de hut:** *Felling a tree*, *Timber!*, *Cutting the tree into logs* en
  *Carrying logs home*.

## Tests (`tests/houthakken.spec.js`)
1. **Volledige cyclus**
   - De fasen volgen in deze volgorde: omhakken → omvallen → ligt → in stukken → dragen → op de stapel.
   - Het omvallen gaat vloeiend: minstens 15 frames, zonder sprongen.
   - Het landen gebeurt tussen 0,85 en 1,5 rad, zonder door de grond te gaan.
   - De boom verdwijnt niet tijdens het vallen en er liggen 2 losse stammen.
   - De stam is zichtbaar gedragen en telt pas bij de hut.
2. **Drie houthakkers tegelijk, 5 minuten**
   - Nooit twee houthakkers aan dezelfde boom.
   - Lokale voorraad maximaal 6.
   - Sluitende boekhouding: opgeleverd + in de hand + in het bos = 2 × omgehakte bomen.
   - Opslaan midden in de cyclus, en slopen tijdens de cyclus: niets kwijt.
3. **Screenshots:** omhakken, omvallen, liggen, in stukken hakken, stam dragen, en de boomsoorten.

Screenshots staan in `tests/screenshots/desktop/hout-*.png` en `stam-*.png`.

## Beperkingen
- **Geen stronk:** na het omhakken blijft er geen boomstronk achter. De plek is direct vrij voor de
  boswachter.
- **Kroon eraf:** de kroon verdwijnt in één keer, met bladeren. Hij wordt niet in kleinere takken gehakt.
