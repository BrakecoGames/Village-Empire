# Rapport: wapensmederij (Weaponsmith)

Git-checkpoint vóór de wijzigingen: tag `checkpoint-voor-wapensmederij`.

## In het spel

| Onderdeel | Wat |
|---|---|
| Gebouw | **Weaponsmith** ⚔️ in het tabblad *Mining*, vanaf rang Market Town. Kost 6 planken, 6 steen en 1 ijzerstaaf. |
| Smid | Nieuw beroep *blacksmith* met kap en schort. Tijdens het smeden staat hij zichtbaar voor het aambeeld en hamert hij op het gloeiende wapen. Bij elke slag vliegen er vonken. |
| Gebouwdelen die bewegen | Gloeiende kolen in de haard, een blaasbalg die op en neer gaat, en rook uit de schoorsteen: dik en donker tijdens het smeden, anders een dun pluimpje. |
| Lokale opslag | Maximaal 6 wapens bij de smid. Is die vol, dan stopt het smeden met de melding *"Storage full (6/6): …"*. |
| Storehouse | Elk wapentype heeft een eigen vinkje. Oude Storehouses nemen wapens standaard aan. |
| Economie | Alle wapens zijn te verkopen op de markt en bij handelaars. |
| Village Charter | m12 *Build a Weaponsmith* (Market Town). t11 *Forge 6 swords*, t12 *Make 8 bows* en t13 *Store 20 weapons for your future army* (Town). |

### Recepten (`VE.WEAPON_RECIPES` in `js/config.js`)
"Hout" is in de game **planken**, dus bewerkt hout uit de zagerij.

| Wapen | Grondstoffen | Tijd | Prijs |
|---|---|---|---|
| Zwaard | 3 ijzerstaven + 1 plank | 16 s | 44 |
| Speer | 1 ijzerstaaf + 2 planken | 10 s | 18 |
| Strijdbijl | 2 ijzerstaven + 2 planken | 14 s | 34 |
| Dolk | 1 ijzerstaaf | 8 s | 15 |
| Boog | 3 planken | 10 s | 14 |
| Kruisboog | 2 planken + 1 ijzerstaaf | 14 s | 32 |

**Hoe de keten loopt**
- Je kiest het wapen in het infopaneel. Er zijn zes knoppen onder *Forge:*, elk met de benodigde grondstoffen.
- Dragers brengen ijzerstaven en planken uit de opslag, of rechtstreeks van de smelterij en de zagerij.
- Wissel je van wapen, dan brengen dragers de grondstoffen die niet meer nodig zijn terug. Er gaat niets
  verloren.
- De wapens zelf gaan naar een Storehouse die dat wapentype aanneemt.

**Waar de wapens voor zijn**
- Voorlopig worden ze opgeslagen voor toekomstige soldaten en verdediging, en kun je ze verhandelen.
- De opdracht t13 telt alle wapens die je hebt.

## Blender (`tools/blender/models/`)

| Model | Inhoud |
|---|---|
| `weaponsmith.py` → `weaponsmith.glb` | Drie levels. **Basis:** <ul><li>vakwerk-smidse met rode golfpannen, een uithangbord met gekruiste zwaarden en een schild aan de gevel;</li><li>open smidshaard met kap en bakstenen schoorsteen;</li><li>blaasbalg;</li><li>aambeeld op een eiken stronk, met een tang;</li><li>wapenrek met zwaarden, een speer en (level 2) een strijdbijl;</li><li>blusvat.</li></ul> **Level 2:** slijpsteen en een rek met tangen. **Level 3:** hogere schoorsteen, bogen en een kruisboog aan de muur, en een schildenrek. **Markers:** `glow`, `bellows`, `hotblade`, `smoke` en `pile`. |
| `items.py` → `items.glb` | Zes nieuwe wapens, plat liggend en herkenbaar: <ul><li>zwaard met pareerstang, gevest en knop;</li><li>speer met stalen punt;</li><li>dubbelbladige strijdbijl;</li><li>dolk;</li><li>gebogen boog met pees;</li><li>kruisboog met stalen boog, pees en pijl.</li></ul> |

De procedurele reserve in `js/models.js` (`B.weaponsmith` en de wapens in `VE.itemGeo`) wordt gebruikt
als een GLB niet laadt.

## Code
- **`js/config.js`**
  - nieuwe goederen (`VE.WEAPONS`) en `VE.WEAPON_RECIPES`;
  - het gebouw `weaponsmith` (`forge: true`) en het beroep `blacksmith`;
  - de nieuwe opdrachten in de Village Charter.
- **`js/sim.js`**
  - de smid staat aan het aambeeld (`hotblade`) of, bij de smelterij, bij de ovenmond;
  - de status toont *Forging …*;
  - opdrachttype `weapons`;
  - saves gaan naar v3: Storehouses uit oudere saves nemen de wapens aan.
- **`js/mining.js`**: animatie `hotblade`, een gloeiend wapen dat bij elke hamerslag vonken geeft.
- **`js/fx.js`**: nette stapellagen per wapen.
- **`js/util.js`**: SVG-iconen.
- **`js/ui.js`**: wapen kiezen (*Forge:*) en een algemene melding bij het wisselen van recept.

## Tests (`tests/wapens.spec.js`)
1. **De keten**
   - Dragers brengen ijzer en planken.
   - Elk zwaard kost precies 3 ijzer en 1 plank.
   - De smid is zichtbaar aan het werk en het wapen gloeit.
   - De zwaarden komen in de Storehouse.
   - Bij wisselen naar bogen, die de Storehouse niet aanneemt, stopt de smid bij 6/6 met een melding.
   - Na het aanvinken van bogen brengen dragers ze weg.
2. **De recepten en de rest van het spel**
   - Alle zes recepten verbruiken precies de juiste grondstoffen; ook wat dragers erbij brengen, telt mee.
   - De wapens gaan naar de opslag en de Village Charter telt ze.
   - De markt verkoopt ze.
   - Opslaan en laden (v3) werkt, ook voor een oude save (v2).
3. **Interface en 3D**
   - Het infopaneel heeft zes knoppen om te kiezen.
   - De Storehouse heeft een vinkje per wapentype.
   - Elk wapen ligt zichtbaar op een stapel, met het model uit Blender.

Screenshots staan in `tests/screenshots/<desktop|mobile>/wapens-*.png`.

## Beperkingen
- Wapens hebben nog geen gebruik buiten opslag en handel. Soldaten en verdediging zijn voor later.
- Een Storehouse heeft 6 of 9 vakken. Bewaar je veel verschillende soorten goederen in één Storehouse,
  dan zijn niet alle soorten als stapel te zien. Ze zijn er wel en staan in het infopaneel.
