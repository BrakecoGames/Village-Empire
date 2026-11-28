# Rapport: zwaarden naar de kazerne en voedsel als basisbehoefte

Git-checkpoint vóór dit werk: tag `checkpoint-voor-voedsel-zwaarden` (commit `815a215`, versie 1.13.0).

## 1. Zwaarden kwamen niet aan bij de kazerne
**Oorzaak:** zwaarden hadden geen bestemming zolang er geen soldaten in de wachtrij stonden.
- De kazerne vroeg alleen wapens voor rekruten in de wachtrij (`barracksWant`, `js/military.js`).
- Storehouses nemen standaard alleen hout, planken en steen aan (`VE.DEFAULT_ACCEPT`).

Gevolg: de zwaarden bleven bij de wapensmid liggen. Na 6 stuks was zijn eigen opslag vol en stopte hij ("Storage full"),
ook voor trainingsuitrusting. Zonder uitrusting begon de training nooit, ook niet met zwaarden in de wachtrij.

Item, transport, naam (`sword`), drager en pad waren in orde.

**Oplossing (`barracksWant`):** de kazerne houdt ook zonder wachtrij een vaste voorraad aan:
- maximaal 6 per wapensoort en samen maximaal 12, zoveel als er in de twee rekken past;
- 6 trainingsuitrusting.

Dragers brengen wat de smid maakt direct naar de kazerne (`moveOutputs` → `findConsumer`). Zonder wachtrij haalt de
kazerne niets uit de Storehouses. Rekruten gebruiken de zwaarden uit het rek.

## 2. Wat voedsel eerst deed
Dorpelingen aten niet. Voedsel (`VE.FOOD`: brood, vis, vlees) deed alleen dit:
- **Nieuwkomers:** elke nieuwkomer kostte 1 stuk (`sim.js`, `update`) en kwam daardoor sneller.
- **Markt:** brood, vis, wijn en meel werden verkocht, zonder reserve voor het dorp.
- **Herberg:** brood + wijn → goud.

## 3. Nieuw: honger en tevredenheid (`js/food.js`)
- **Verzadiging** (`s.food`, 1 = vol) daalt van vol naar leeg in 10 minuten.
- **Eten:** onder 45 % loopt een dorpeling naar het dichtstbijzijnde brood, de vis of het vlees, pakt één stuk en eet het daar op
  (1,6 s). Het stuk gaat echt van de voorraad af.
  - Bron: Storehouse, startstapel, dorpshuis of de stapel van bakker, visser of jager.
  - Werkers eten tussen twee klussen; bouwers en dragers als ze vrij zijn.
  - Ze kiezen liefst een soort die ze de laatste 3 keer niet aten.
- **Voedingswaarde:** brood +0,5, vis +0,45, vlees +0,6.
- **Werktempo:**
  - onder 25 % gaat het omlaag tot de helft, en lopen tot 75 %;
  - tevredenheid geeft −8 % tot +8 %.
- **Stoppen:** na 90 s helemaal leeg stopt een dorpeling met werken ("Too hungry to work").
- **Vertrekken:** na 240 s helemaal leeg vertrekt hij. Dat gebeurt hooguit één per 20 s, en er blijven er altijd minstens 8.
- **Tevredenheid** (`s.mood`) beweegt langzaam naar een doel:

  | Verzadiging | Doel |
  |---|---|
  | verzadigd | 70 % |
  | 25–45 % | 50 % |
  | onder 25 % | 30 % |
  | leeg | 10 % |

  Afwisseling bovenop het doel: +8 % voor 2 soorten, +15 % voor 3 soorten.
- **Nieuwkomers:** een tevreden dorp trekt ze tot 25 % sneller aan, een ontevreden dorp tot 40 % trager.
- **Markt en herberg:** verkopen voedsel alleen boven de reserve van 1,5 stuk per dorpeling. Op de markt is dit uit te
  zetten met "Feed the village first"; die instelling wordt opgeslagen.
- **Soldaten:** krijgen een rantsoen en hebben geen honger.
- **Opslaan:** honger, tevredenheid en recente maaltijden worden bewaard. In oude saves begint iedereen verzadigd.

**Interface:**
- **HUD:** naast de bevolking staan de voedselvoorraad en de gemiddelde tevredenheid. Bij weinig voedsel kleurt dit oranje,
  bij tekort of honger rood en knipperend. Dan komt er één melding.
- **Paneel "Food & Happiness"** (aantikken):
  - voorraad per soort;
  - verbruik per minuut, hoe lang het nog duurt en de reserve;
  - gemiddelde verzadiging en tevredenheid;
  - aantal hongerigen, wie niet meer werkt en wie vertrokken is.

## 4. Balans
- **Startvoorraad:** 16 brood en 8 vis (was 8 en 4).
- **Verbruik:** 10 dorpelingen eten ~1,9 stuk per minuut. Met de startvoorraad duurt het dus ~12 minuten voordat het op is.
- **Getest:** in een nieuw dorp zonder voedselproductie is er na 10 min nog eten en is na 15 min nog niemand hongerig.
- **Productie:** één visser (~4–6 vis/min) voedt ~20–25 dorpelingen.

## 5. Tests (`tests/voedsel.spec.js`, desktop + mobiel: 10/10)
- **Zwaarden:** zonder wachtrij komen ze in het rek (max. 6), de Storehouse wordt niet leeggehaald, de smid blijft werken en
  2 zwaardvechters worden uitgerust.
- **Eten:**
  - iedereen eet één keer, en de voorraad daalt precies zoveel;
  - ze lopen er echt heen;
  - ze eten afwisselend brood en vis.
- **Honger:**
  - werk wordt trager en stopt;
  - tevredenheid daalt;
  - uitgehongerden vertrekken (nooit onder 8);
  - afwisseling maakt tevredener.
- **Markt:** onder de reserve wordt niets verkocht, daarboven alleen het overschot; uitgezet wordt alles verkocht.
- **Balans, HUD, paneel en opslaan:** inclusief laden van een oude save.

`tests/opslag.spec.js`: de boekhouding telt opgegeten voedsel nu mee, en de verwachte startvoorraad is 16 brood en 8 vis.

**Volledige suite:** 185 geslaagd, 10 mislukt.
- Opslagtests (6): door deze wijziging, aangepast en daarna 10/10.
- Wildlife en zwavel (2): slaagden bij opnieuw draaien, toevallige wereld.
- Strandtest uit 1.13.0 (2): blijft wisselvallig, 201–1138 strandtegels per willekeurige wereld bij een grens van 450.
  Staat los van dit werk.
