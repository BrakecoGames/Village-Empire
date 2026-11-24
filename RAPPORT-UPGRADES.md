# Rapport: vlinders, upgrades en zichtbare voorraad

Git-checkpoint vóór de wijzigingen: tag `checkpoint-voor-upgrades-vlinders`.

## 1. Vlinders (`js/fx.js`, `Butterflies`)

**Oorzaak van het rondjes vliegen**
- De koers bestond uit een vaste sinusgolf plus een trek naar een doel. Vlak bij het doel liepen die twee
  tegen elkaar in, waardoor de vlinder om zijn doel bleef cirkelen.

**Nieuwe vlucht**
- **Bochten:** een draaisnelheid die elke 0,25–1,35 s een nieuw willekeurig doel krijgt en daar vloeiend
  naartoe gaat. Dat geeft zigzaggen, korte rechte stukken en af en toe een scherpe zwenk.
- **Snelheid:** telkens een nieuw doel tussen 50 % en 150 % van de eigen snelheid, vloeiend benaderd.
- **Hoogte:** telkens een nieuwe doelhoogte, meestal laag boven de bloemen en soms hoger. Bij elke
  vleugelslag maakt het lijfje een klein sprongetje.
- **Zweven:** af en toe houdt de vlinder de vleugels half open en zakt hij langzaam.
- **Houding:** de vlinder helt over in de bocht, met de neus omhoog bij klimmen en omlaag bij dalen.
- **Landen:**
  - Na 5–14 s kiest hij een bloem in de buurt, bij voorkeur vóór zich.
  - Hij fladdert erheen en vliegt rechter naarmate hij dichterbij komt.
  - Dan daalt hij, gaat zitten, beweegt rustig zijn vleugels en vliegt na 2–7 s omhoog weer verder.
  - Komt er iemand langs, dan vliegt hij meteen op.
- **Waar ze vliegen:**
  - Een zachte trek terug naar de thuisbloemen als een vlinder te ver afdwaalt.
  - Weg van drukke gebouwen en van de rand van de kaart.
  - Af en toe kiest een vlinder een nieuwe thuisplek, zodat ze langzaam langs de bloemenvelden zwerven.
- **Prestaties:** zelfde opzet als voorheen, met drie InstancedMeshes. Vlinders ver van de camera worden
  minder vaak bijgewerkt.

## 2. Upgrades als bouwplaats (`js/sim.js`, `js/ui.js`, `js/models.js`)

**Zo verloopt een upgrade nu, net als nieuwbouw**
1. **Upgrade starten:** het goud gaat direct uit de schatkist. Het gebouw krijgt een bouwplaats `b.up`,
   met de nodige materialen, wat geleverd is, wat onderweg is en de voortgang.
2. **Materialen brengen:** dragers halen de planken, stenen en ijzerstaven één voor één uit de opslag.
   Wat geleverd is, ligt zichtbaar op stapels vóór het gebouw.
3. **Bouwen:** pas als er materiaal ligt, komt een bouwer met een hamer. Hij staat voor het gebouw, hamert
   met geluid en stofjes, en verbruikt de materialen één voor één. De stapels worden kleiner.
4. **Voortgang:**
   - In de game staat er een steiger rondom het bestaande gebouw, met palen, regels, loopplanken, schoren
     en een ladder. De steiger groeit mee met de voortgang.
   - In het infopaneel staat *Upgrading to level N*, met een voortgangsbalk, de materialen
     (geleverd/nodig) en een waarschuwing als iets in de opslag ontbreekt.
5. **Klaar:** pas na het laatste stuk krijgt het gebouw zijn nieuwe level, met stof, geluid en een melding.
   De steiger verdwijnt.

**Tijdens de upgrade**
- Het gebouw blijft gewoon werken.
- Er kan maar één upgrade tegelijk lopen.
- **Cancel upgrade:** de geleverde materialen en het goud gaan terug. Dragers die nog onderweg zijn,
  brengen hun lading naar een Storehouse.

**Niets raakt kwijt**
- **Slopen tijdens een upgrade:** alles wat geleverd is en het goud gaan terug.
- **Opslaan tijdens een upgrade:** de bouwplaats gaat mee in de save (veld `up` per gebouw; savegame-versie
  3 blijft gelijk). Na het laden gaat de upgrade gewoon verder. Oude saves werken ongewijzigd.

**Village Charter**
- De opdracht *Upgrade N buildings* telt pas bij voltooiing.

**Help**
- In *How to play* staat een uitleg over upgrades.

## 3. Wapensmederij: zichtbare voorraad (`tools/blender/models/weaponsmith.py`)

- **Wapenrek:**
  - Het oude wapenrek met vaste nepwapens is vervangen door een leeg rek met zes gleuven, met schotjes,
    staanders en een bovenregel met pinnen.
  - De gesmede wapens (max. 6) staan er echt in, rechtop en licht achterover. Zwaarden en dolken staan met
    de punt omlaag; speren, bijlen, bogen en kruisbogen met de kop omhoog.
  - Elk wapen houdt zijn gleuf zolang het er staat.
- **Planken en ijzerstaven:**
  - Twee lage legplanken naast de smidse: planken links (`in0`) en ijzerstaven rechts (`in1`).
  - Elk aangeleverd stuk ligt er zichtbaar.
  - Begint de smid een wapen, dan gaan de grondstoffen er direct af. Een zwaard haalt bijvoorbeeld 3
    ijzerstaven en 1 plank van de stapels.
- **Overige onderdelen:**
  - De schilden (level 3) staan nu tegen de voorgevel.
  - Wat na het wisselen van wapen terug moet naar de opslag, ligt op de plek `pile`.
- **Blender-workflow:** `build_levels` maakt nu ook de markers `in0`, `in1` … en `rack`. `glb-models.js`
  leest die in. `weaponsmith.glb` is opnieuw gebouwd: 10.724 driehoeken.

## 4. Consistentie bij alle productiegebouwen (`js/fx.js`, `VE.IN_SPOT`)

- **Aangeleverde grondstoffen** zijn nu bij elke werkplaats zichtbaar, op een vaste plek per goed die niet
  overlapt met het model:

  | Gebouw | Grondstoffen |
  |---|---|
  | Zagerij | stammen |
  | Molen | graan |
  | Bakkerij | meel |
  | Wijnmakerij | druiven |
  | Smelterij | kolen en erts |
  | Taverne | brood en wijn |
  | Wapensmederij | planken en ijzer |

  Een Blender-marker `inN` gaat voor de plek in de code.
- **Meer soorten uitvoer** (bijvoorbeeld na het wisselen van recept) lagen vroeger over elkaar op één plek.
  Nu krijgt elk goed zijn eigen stapel ernaast.
- **Gecontroleerd:**
  - De invoer- en uitvoervoorraad van 14 productiegebouwen. Het aantal zichtbare stuks is precies gelijk
    aan de echte voorraad.
  - Na het leegmaken is er niets meer zichtbaar.
- **Prestaties:** alles blijft in dezelfde InstancedMesh per goed: geen extra draw calls. De stapels worden
  alleen opnieuw opgebouwd als er een aantal verandert.

## Tests (`tests/upgrades.spec.js`, desktop en mobiel)

1. **Upgrade-cyclus**
   - Het level blijft gelijk tot het einde.
   - Het goud gaat direct af; de materialen niet.
   - Precies zoveel dragerleveringen als er materialen nodig zijn.
   - De bouwer hamert zichtbaar.
   - De geleverde materialen liggen zichtbaar.
   - De steiger groeit en verdwijnt.
   - Het gebouw blijft werken.
   - Er is exact de juiste hoeveelheid verbruikt.
2. **Opslaan, afbreken en slopen**
   - Opslaan midden in een upgrade, laden en afmaken.
   - *Cancel upgrade* geeft alles terug.
   - Slopen geeft het geleverde terug.
3. **Wapensmederij**
   - Planken en ijzer zichtbaar (5 en 6) en ze nemen af bij het smeden.
   - Zes wapens rechtop in het rek.
4. **Alle werkplaatsen:** zichtbaar = voorraad, voor 14 gebouwen.
5. **Vlinders (90 s gesimuleerd)**
   - Geen cirkelen: nooit meer dan 1,5 rondje in 8 s.
   - De snelheid en de hoogte wisselen.
   - 39 van de 40 vlinders landen op een bloem.
   - Ze blijven bij de bloemen.
6. **Screenshots** in `tests/screenshots/<desktop|mobile>/`: `upgrade-bouwplaats.png`,
   `voorraad-wapensmederij.png`, `voorraad-smelter.png`, `voorraad-sawmill.png` en `voorraad-bakery.png`.

## Beperkingen

- **Steiger:** één model per gebouwgrootte, niet per gebouw. Bij hoge gebouwen zoals de molen en de
  kathedraal is hij lager dan het gebouw.
- **Eén bouwer per bouwplaats,** net als bij nieuwbouw.
