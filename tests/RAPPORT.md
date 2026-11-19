# Village Empire: testrapport en verbeterpunten

*Datum: 19-11-2026 · Basis: git-checkpoint `0b5b113` ("Checkpoint: werkende versie voor testopzet")*

## Hoe de game start

- Een statische webgame: `index.html` + `style.css` + `js/*.js` (geen build-stap).
- Three.js r128 en Google Fonts komen van een CDN, dus de tests hebben **internet** nodig.
- De CrazyGames SDK wordt geladen vanaf `sdk.crazygames.com`, met een fallback na 2,5 s.
- Voortgang staat in `localStorage` onder `village_empire_save_v1` (instellingen onder `village_empire_settings`).
- `village-empire.zip` staat in de map maar wordt niet gebruikt door de game.

## Tests draaien

```
npm test                 # alle tests: desktop 1920×1080 + mobiel 390×844
npm run test:desktop
npm run test:mobile
npm run report           # HTML-rapport openen
set STRICT=1 && npm test # ook bekende fouten laten falen
```

Playwright start zelf een lokale server op `http://127.0.0.1:4173`. Screenshots komen in `tests/screenshots/<desktop|mobile>/`, samen met `layout-audit-*.json`.

**Isolatie van opslag:** elke test krijgt een nieuw, leeg browserprofiel op een eigen origin (127.0.0.1:4173). De CrazyGames SDK wordt in de tests geblokkeerd, zodat er nooit naar cloudopslag geschreven wordt. Echte saves worden dus niet gelezen of overschreven. De test controleert ook dat er bij de start géén bestaande save is.

| Test | Wat wordt gecontroleerd |
|---|---|
| start zonder JavaScript-fouten | Laden, menu zichtbaar, nieuw dorp starten, canvas op volle grootte, geen JS- of console-fouten |
| bouwmenu + plaatsen | Alle 4 tabbladen tonen kaarten, een vergrendelde kaart geeft een melding, Woodcutter selecteren, een echte klik/tik op een geldige tegel plaatst het gebouw (mobiel: tik + tik), de tool reset, opslaan en herladen geeft "Continue" |
| visuele audit HUD | Elementen buiten beeld of overlappend, kleine tikdoelen, afgekapte tekst, positie van de modal (faalt niet, alleen vastleggen) |

## Gevonden fouten

### VE-001: render-crash bij elk frame (ernstig): ✅ OPGELOST
**Fix:** `js/fx.js` geeft `head`, tools en items een witte `instanceColor` met volledige capaciteit. Wit × vertexkleur = ongewijzigd uiterlijk. Let op: `setColorAt` was hier niet bruikbaar, omdat r128 de buffer dimensioneert op de huidige `count` (0). Dat gaf zwarte planken.
**Resultaat:** geen JS-fouten meer (ook in `STRICT`-modus). Kolonisten, gedragen goederen, het meer links op de kaart, rook en vlinders zijn nu zichtbaar. Punt 7 hieronder (wazige vlek) was het meer dat niet gerenderd werd.

<details><summary>Oorspronkelijke analyse</summary>

`TypeError: Cannot read properties of null (reading 'isInterleavedBufferAttribute')` uit `renderer.render` (main.js:144), vanaf het eerste frame, elk frame opnieuw.

- **Oorzaak:** in `js/fx.js:12-21` delen `torso`, `head`, `hat`, `legL`, `legR`, de tools en de items **één** `MeshPhongMaterial`. Torso, hat en benen krijgen `setColorAt` (en dus `instanceColor`), maar `head` en de tools/items niet. Three.js r128 compileert de shader met instance-kleur en crasht daarna op de `InstancedMesh` zonder `instanceColor`.
- **Gevolg:** de rest van de renderlijst wordt dat frame overgeslagen. In de screenshots zijn de 10 kolonisten **nergens zichtbaar**, ook niet bij de bouwplaats.
- **Mogelijke fix (nog niet doorgevoerd, het is een graphics-wijziging):** geef `head`/tools/items ook `setColorAt` (bijvoorbeeld wit), of geef ze een eigen materiaal.

</details>

### VE-002: klikken in de bouwbalk kunnen verloren gaan (middel): ✅ OPGELOST
**Fix:** `refreshHud` bouwt `#cards` alleen nog opnieuw op als de rang of de categorie verandert. Bij voorraadwijzigingen werkt de nieuwe `updateBuildBar()` (ui.js) de rode "tekort"-markering en de geselecteerde kaart bij op de bestaande knoppen. Het uiterlijk is ongewijzigd.
**Regressietest:** "VE-002: klik in bouwbalk…" drukt een kaart in, wijzigt de voorraad en laat dan los. Zonder de fix faalt de test, met de fix slaagt hij (desktop en mobiel).

Oorspronkelijke analyse:
`refreshHud` (ui.js:591-592) vervangt `#tabs` en `#cards` via `innerHTML` zodra de voorraad verandert. Kolonisten leveren continu, dus een klik kan vallen tussen pointerdown en pointerup op een element dat ondertussen vervangen is. De klik komt dan niet aan. Op mobiel (langzamere tik) gebeurde dit in de tests reproduceerbaar. De tests proberen nu opnieuw; voor spelers voelt dit als een knop die niet reageert.
**Suggestie:** alleen kosten en klassen bijwerken in plaats van de HTML opnieuw op te bouwen.

### VE-003: upgrade-knoppen zien er actief uit terwijl ze vergrendeld zijn (laag): ✅ OPGELOST
**Fix:** uitgeschakelde groene knoppen (`.btn.good:disabled` in style.css) zijn nu grijs in plaats van half-transparant groen. Bij vergrendeling door de rang tonen ze 🔒 en een tooltip "Unlocks at rank Village". Bij te weinig goud is de tooltip "Needs N gold". Een betaalbare, ontgrendelde upgrade blijft groen.
**Regressietest:** "VE-003: vergrendelde upgrade-knoppen…" (screenshot `08-upgrades-vergrendeld.png`).

Oorspronkelijke analyse:
In het venster "Village Upgrades" staat "Become a Village to unlock…", maar de prijsknoppen zijn groen en zien er klikbaar uit, ook als je het goud niet hebt (60 tegen 40).

## Visuele verbeterpunten

**Mobiel (390×844)**
1. De grondstoffenbalk is afgekapt: `#resBar` scrollt 386 px in 322 px, dus wijn en latere grondstoffen vallen weg zonder dat je ziet dat er meer is.
2. De categorietabs lopen buiten beeld: "Wine" is afgekapt tot "W" en "Realm" is onzichtbaar. Er is geen scroll-hint.
3. Toolknoppen (Select/Road/Remove/Speed) zijn alleen iconen, zonder label, en 43×37 px (onder de 44 px-richtlijn).
4. Het "Village Charter"-paneel raakt de grondstoffenbalk net.
5. Het upgrade-venster bedekt de zijknoppen half, waardoor die er afgesneden uitzien.
6b. Meldingen (toasts) verschijnen achter het Village Charter-paneel en zijn daardoor slecht leesbaar (zichtbaar in `08-upgrades-vergrendeld.png`, mobiel).
6. De bouwkaarten lopen rechts uit beeld (Sawmill niet zichtbaar). Dat is te scrollen, maar zonder hint.

**Desktop (1920×1080)**
7. ~~Een grote, wazige geel-bruine vlek linksboven~~: opgelost door VE-001 (het was een niet-gerenderd meer).
8. Het Village Charter-paneel is erg hoog en bedekt een flink deel van de wereld. Standaard inklappen zou helpen.
9. De bouwbalk heeft veel lege ruimte rechts van de 5 kaarten.
10. Het Cinzel Decorative-lettertype maakt van "WOODCUTTER" iets als "W∞DCUTTER" (ligatuur "oo") in het infopaneel.
11. Tabs zijn 28 px hoog: prima met een muis, maar klein op tablets.

**Algemeen**
12. ~~Er zijn geen kolonisten zichtbaar~~: opgelost door VE-001.

## Graphics-verfijning (ronde 1)

Vergelijking: `tests/screenshots/visual/vergelijking-voor-na.png`. Opnieuw maken: `npm run shots`. Dat gebruikt een vaste wereld (seed) en vaste camerastanden. Zet `SHOTS_DIR` voor een eigen submap.

| Onderdeel | Wijziging | Bestand |
|---|---|---|
| Gras | Minder neon/limoen. Rustiger, natuurlijker groen dat niet meer "uitbrandt" in de zon | world.js `recolor` |
| Licht | Iets zachter zonlicht en hemellicht, plus een koel invullicht van de andere kant (geeft vorm, kost geen schaduwberekening) | main.js `boot` |
| Water | Kleur naar diepte: turquoise in de ondiepte, diepblauw verder weg. Minder schittering, zodat het meer niet meer wit/ijzig oogt | world.js `buildWater` |
| Gebied buiten de grenzen | Minder modderig olijf, de grens blijft goed zichtbaar | world.js `recolor` |
| Diepte | Zachte vignet en warme lichtval bovenin (CSS-laag die klikken doorlaat) | style.css `#game::after` |
| Bouwhulp | Groen/rood plaatsingsvoorbeeld en ringen houden hun exacte kleur | ui.js `makeHelpers` |

- **Prestaties:** frametijd in de software-renderer gelijk of iets beter (desktop 270 → 240 ms, mobiel 162 → 155 ms; alleen relatief bruikbaar).
- **Geprobeerd en verworpen:** filmische tone mapping (ACES) maakte het beeld grauw en vlak en vocht tegen de handgekozen kleuren van de game.

## Beperkingen van de automatische tests
- **Internet nodig** voor Three.js en de fonts (CDN). Offline faalt het laden. Oplossing voor later: three.min.js en de fonts lokaal meeleveren.
- WebGL draait headless via SwiftShader (software). Dat is betrouwbaar maar trager, en kleuren en schaduwen kunnen iets afwijken van een echte GPU. De screenshots zijn dus bedoeld voor beoordeling, niet als pixel-exacte referentie.
- Geluid wordt niet getest.
- De projectmap staat in iCloud Drive. `node_modules` (circa 15 MB) wordt dus mee gesynchroniseerd. Overweeg de map uit te sluiten van iCloud.
