# Nieuwe bewoners (Blender): rapport

*Basis: tag `checkpoint-voor-personages` (commit `15a5cdc`). Beelden: `tests/screenshots/characters/fase-c/`.*

## Aanpak
- **Eén gedeeld skelet** van 10 rig-nodes (heup, romp, hoofd, armen, benen, gereedschap, vracht) en **losse delen**: lichaamsbouw, gezicht, kapsel, baard, hoed per beroep en easter eggs. Alles komt uit één Blender-script ([settler.py](../tools/blender/models/settler.py)) en één GLB (`public/models/settler.glb`, 455 KB).
- **Rendering** ([settler-glb.js](../js/settler-glb.js)): elk deel is één `InstancedMesh` voor *alle* bewoners. De animatie wordt per bewoner op de CPU uit de Blender-clips gesampled en in de instance-matrices gezet. Het aantal draw calls hangt dus af van het aantal **soorten** delen in beeld, niet van het aantal bewoners.
- **Gameplay ongewijzigd:** de renderer leest alleen de bestaande status (`act/ap`, `moving/wp`, `carry`, `mode`, `role`, `tool`). De ritmes van de werkclips volgen de periodes uit de simulatie, zodat klap en geluid samenvallen.
- **Fallback:** laadt `settler.glb` niet, dan blijven de oude bewoners in beeld. Komt het model later binnen, dan wordt er live gewisseld.

## Inhoud
| | |
|---|---|
| Driehoeken per bewoner | ~1.430 (gewone drager: lichaam, gezicht, haar, hoed, snor, armen, benen) |
| Varianten | 2 lichaamsbouwen, 3 gezichten (vrolijk, slaperig, grijns met sproeten), 5 kapsels (incl. kaal), 4 baardopties, 6 huidtinten, 7 haarkleuren, 5 broeken, 3 laarzen, lengte/breedte per bewoner |
| Beroepen | 14, elk met eigen kleur en hoed: drager, bouwer, houthakker, boswachter, steenhouwer, boer, molenaar, bakker, visser, wijnboer, koopman, waard, zager, wachter |
| Animaties | 14: idle (ademen, rondkijken), hoed rechtzetten, zwaaien, juichen, lopen, dragen (lopend/stil), hakken, mijnwerken, timmeren, oogsten, spitten, zaaien, vissen. Zachte overgang tussen clips (0,18 s) |
| Easter eggs | 27, bij ~13% van de bewoners, vast per bewoner en passend bij het beroep |

**Easter eggs:**
- **Uit de opdracht (10):** verschillende sokken, reuzensnor (houthakker), wortel achter het oor (boer), eendje op de hoed, potlood achter het oor (bouwer/zager), scheve helm (steenhouwer), teddybeertje aan de riem, extreem hoge koksmuts (bakker), verstopt Brakeco-logo, monocle.
- **Eigen (17):** zoemend bijtje rond het hoofd, slakje op de hoed, vogelnestje met eitjes, kikker op de schouder, ooglapje, pleister op de neus, bloemetje in de hoedband, lepel in de hoed, ganzenveer achter het oor, vergeten slaapmuts, gevlochten baard met strikje, lantaarntje aan de riem, gelukshoefijzer, appeltje voor onderweg, stuk kaas, prei uit de rugzak, roze lap op de knie.

## Prestaties
Headless software-rendering (SwiftShader), dus vooral onderling vergelijkbaar. Gemengd: ¼ stil, ¼ lopend, ¼ dragend, ¼ aan het werk, allemaal in beeld.

| Bewoners | Draw calls (hele scène) | Driehoeken (hele scène) | CPU bewoners per frame | Frametijd* |
|---|---|---|---|---|
| **Desktop** 25 | 52 | 0,94 mln | 0,26 ms | 359 ms |
| 50 | 55 | 0,97 mln | 0,38 ms | 365 ms |
| 100 | 61 | 1,04 mln | 0,53 ms | 403 ms |
| **Mobiel** 25 | 53 | 0,87 mln | 0,33 ms | 236 ms |
| 50 | 56 | 0,90 mln | 0,48 ms | 244 ms |
| 100 | 62 | 0,97 mln | 0,81 ms | 271 ms |
| *Oud, desktop* 100 | 41 | 1,36 mln | 0,17 ms | 491 ms |

\* De frametijd is software-rendering zonder GPU; op een echte GPU ligt die vele malen lager.

- **Draw calls:** van 25 naar 100 bewoners stijgt het aantal maar met 9. Elk soort deel blijft één draw call.
- **Driehoeken:** minder dan de oude bewoners (−23% bij 100), omdat ronde oude onderdelen zwaar waren.
- **CPU:** de animatie kost **0,5–0,8 ms per frame voor 100 bewoners**. Er is ruim budget voor 60 fps (16,7 ms per frame).
- **Dynamische kwaliteit:** blijft de framerate lang laag, dan worden verre bewoners om het frame bijgewerkt en werpen kleine delen geen schaduw meer. Verder dan 24 eenheden van de camera worden baarden en eggs weggelaten.

## Bekende beperkingen en vervolg
- Easter eggs zijn statisch op 1 na (het bijtje). Meer bewegende details kan later.
- Het gezicht van dichtbij kan nog expressiever (knipperen, mondbewegingen).
- Het vergelijkingsmeten kan met `set OLD_SETTLERS=1&& npm run characters`.
