# Rapport: productie en opslag (versie 1.4.0)

Git-checkpoint vóór de wijzigingen: tag `checkpoint-voor-opslag`.

## Wat er veranderd is

| Onderdeel | Hoe het nu werkt |
|---|---|
| Startvoorraad | 6 hout, 14 steen, 28 planken, 8 brood en 4 vis liggen als losse stapels gewoon in het gras naast het dorpshuis (geen vak, geen aarde, geen stoepje). Dragers brengen er nooit iets heen, en deze voorraad gaat **als eerste** op: bouwplaatsen, werkplaatsen, markt, eten en upgrades nemen eerst van de startstapel. Is alles op, dan verdwijnt de stapel. |
| Stockyard | Weg. Alleen de stapels van de startvoorraad blijven over, in het gras. |
| Producenten | Ze houden maximaal 6 van hun eigen product bij zich (`VE.LOCAL_CAP`). Past de volgende opbrengst er niet meer bij, dan stoppen ze, met de melding *"Storage full (6/6): …"*. |
| Storehouse | Nu al te bouwen in rang Hamlet (6 planken, 4 steen; nieuwe opdracht *Build a Storehouse*). Capaciteit 60, 80 of 100 (per level, gedeeld over alle goederen). Per Storehouse vink je aan welke goederen erin mogen. |
| Transport | Dragers brengen goederen van een producent eerst naar een gebouw dat ze verwerkt (werkplaats of bouwplaats), anders naar het dichtstbijzijnde Storehouse dat dat goed aanneemt en nog plek heeft. Zonder plek blijft het goed bij de producent liggen. |
| Nette stapels | Nieuw Blender-model `items.glb`: 16 goederen, één model per goed. Gehakte stenen zijn rechthoekige blokken van exact gelijke afmetingen. De Storehouse is een open loods met vakken, de startstapel ligt op pallets. Elk opgeslagen stuk is te zien. |

### De regels
- **Het totaal in de grondstoffenbalk** telt alles wat ergens ligt: Storehouses, de startstapel, het
  dorpshuis en de stapels bij producenten. Daarmee kun je bouwen en upgraden. Goederen die al bij een
  werkplaats als invoer liggen of onderweg zijn, tellen niet mee, net als vroeger.
- **Waar dragers goederen ophalen:**
  - Bouwplaatsen en werkplaatsen halen uit elke opslag: Storehouse, startstapel of dorpshuis.
    Ligt er iets bij een producent, dan brengt een drager het rechtstreeks.
  - De markt verkoopt ook rechtstreeks van de producent.
- **Vinkjes:** vink je een goed uit, dan verhuizen dragers wat er ligt naar een Storehouse dat het wel
  aanneemt. Tot die tijd blijft het gewoon bruikbaar.
- **Goederen van buiten** gaan naar een Storehouse dat ze aanneemt en plek heeft. Lukt dat niet, dan
  bewaart het dorpshuis ze (geen limiet; te zien in het infopaneel van het dorpshuis). Het gaat om:
  - beloningen uit de Village Charter;
  - inkoop bij handelaars;
  - de helft van de bouwkosten bij slopen;
  - de inhoud van gesloopte gebouwen.

  De startstapel krijgt dus nooit iets terug.
- **Een Storehouse slopen:** de inhoud gaat naar andere Storehouses of het dorpshuis. Er gaat niets
  verloren.

## Code

| Bestand | Wijziging |
|---|---|
| `js/config.js` | `VE.LOCAL_CAP`, `VE.STORE_CAP`, `VE.START_STOCK`. De Stockyard heet nu *Starting Supplies* (`pile`). De Storehouse (`depot`) is rang 0. Het dorpshuis heeft `vault`. Nieuwe opdracht h8. |
| `js/sim.js` | Voorraad per gebouw (`b.store`, `b.accept`). `this.stock` is nu een telling, en schrijven ernaar legt goederen netjes neer of neemt ze weg (zo werken tests en oude code). Nieuw: `recount`, `depotFor`, `sourceFor`, `addGoods`, `takeGoods`, `fillPile`, `checkPiles` en `setAccept`. Verder het transport, de lokale limiet met meldingen, sloop zonder verlies, en opslaan als v2. |
| `js/fx.js` | `StockpileRender` gaat uit van de echte inhoud. Elk goed houdt zijn vak(ken), in een strak verband en zonder scheve stukken. Is er te weinig plek, dan wordt een stapel hoger. Overal geldt één schaal (`VE.ITEM_SCALE`), ook voor de lading van dragers. |
| `js/glb-models.js` | Laadt `items.glb` (met procedurele reserve) en leest de markers `slot0…` uit. |
| `js/models.js` | `VE.STONE_BLOCK`, `VE.ITEM_SCALE` en `VE.STORE_SLOTS`. Procedurele reserve voor de startstapel, de loods en een rechthoekige steen. |
| `js/settler-glb.js` | De lading van dragers heeft dezelfde schaal als de stapels. |
| `js/ui.js`, `style.css` | Infopaneel van de Storehouse: capaciteitsbalk, inhoud, vinkjes per goed, en knoppen *All* en *None*. Producenten tonen *Stock here x/6*. Het helpscherm legt opslag uit. |

## Blender (`tools/blender/models/`)

| Model | Inhoud |
|---|---|
| `items.py` → `items.glb` (89 KB) | 16 goederen: stam, plank, bouwsteen, meelzak, brood, vis, druivenmand, wijnvat, ham, steenkool, drie ertsen en drie staven. De bouwsteen is exact 0,09 × 0,05 × 0,06 (`VE.STONE_BLOCK`), met een smalle afschuining voor de voegen. |
| `yard.py` → `yard.glb` | Startstapel: alleen een paar graspollen en 16 losse plekken (markers) voor de stapels in het gras; de middelste plekken worden eerst gevuld. |
| `warehouse.py` → `warehouse.glb` | Open opslagloods: achterwand van planken, lessenaarsdak van leien en een plankenvloer met schotjes. Level 1 heeft 6 vakken, level 2 en 3 hebben 9 vakken, met een lantaarn en een hijsbalk. |
| `lib/ve_parts.py` | `build_levels` schrijft vak-markers (`"slots"`). |

## Saves
- **Nieuwe saves (v2):** de inhoud en de vinkjes per Storehouse worden opgeslagen, de startstapel ook.
- **Oude saves (v1):** de complete oude voorraad komt op de startstapel te liggen. Bestaande Storehouses
  nemen dan alles aan en beginnen leeg.
- **Saves zonder Stockyard:** krijgen een startstapel.

Getest: er gaat niets verloren en er komt niets bij.

## Tests (`tests/opslag.spec.js`, desktop en mobiel)
1. **Startvoorraad:**
   - de juiste inhoud, en elk stuk is zichtbaar;
   - de stapel ligt naast het dorpshuis;
   - een houthakker zonder Storehouse stopt bij 6/6 en de startstapel groeit nooit;
   - opgemaakt verdwijnt de stapel, met een melding.
2. **Storehouses:**
   - de filters werken (hout alleen in A, steen alleen in B);
   - de capaciteit van 60 wordt nooit overschreden en producenten blijven op maximaal 6;
   - een overschot gaat naar het dorpshuis;
   - een uitgevinkt goed verhuist naar een andere Storehouse;
   - bij sloop gaat er niets verloren;
   - **boekhouding:** elke 20 seconden is voor elk goed *aanwezig = begin + geproduceerd*.
3. **Zagerij en bouwen:**
   - boekhouding met omzetting (hout naar planken);
   - een bouwplaats krijgt zijn materiaal.
4. **Opslaan en laden:**
   - v2 heen en terug;
   - een oude v1-save;
   - een save zonder Stockyard.
5. **Visueel en UI:**
   - de steen is exact rechthoekig met de juiste maat, uit Blender;
   - alle stenen hebben dezelfde schaal en staan recht;
   - de vakken per level kloppen;
   - in het infopaneel werken de vinkjes en *All*/*None*, en de capaciteitsbalk klopt;
   - een volle producent toont *6/6 full*.

Screenshots staan in `tests/screenshots/<desktop|mobile>/opslag-*.png`.

## Resterende beperkingen
- Wat in het dorpshuis bewaard wordt (beloningen, inkoop, sloop), zie je niet als stapel, alleen in het
  infopaneel van het dorpshuis.
- Een Storehouse heeft 6 of 9 vakken. Liggen er meer soorten goederen in dan er vakken zijn, dan zijn
  sommige soorten niet als stapel te zien. Ze zijn er wel en staan in het infopaneel.
