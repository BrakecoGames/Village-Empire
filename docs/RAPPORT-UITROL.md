# Uitrol nieuwe stijl: alle gebouwen

*21-11-2026 · vervolg op [RAPPORT-TESTGEBIED.md](RAPPORT-TESTGEBIED.md) · stijl: [STIJLGIDS.md](STIJLGIDS.md)*

Alle 18 gebouwtypes komen nu uit Blender (GLB), elk met de natuurlijke fundering, gebakken AO en het materiaalpalet uit de stijlgids. Gameplay, plaatsen, selectie, upgrades en opslaan zijn ongewijzigd. Elk gebouw valt bij een laadfout los terug op zijn procedurele model.

## Gebouwen en herkenbaarheid
| Gebouw | Kenmerken | Driehoeken L1 / L2 / L3 |
|---|---|---|
| Dorpshuis (2×2) | stenen hal + vakwerkverdieping, ronde donjon met leien kegeldak en vlag, poortgebouw, put | 6.220 (1 level) |
| Opslagerf (2×2) | aangestampt erf, palen met punt, poort met naambord (stapels tekent de game zelf) | 1.946 (1 level) |
| Cottage | pannendak, vakwerk, bloembakken (L2 aanbouw, L3 dakkapel) | 2.570 / 3.054 / 3.388 |
| Houthakker | blokhut, spanendak met mos, hakblok met bijl | 2.620 / 3.052 / 3.312 |
| Boswachter | bemost spanendak, omheinde boomkwekerij | 2.456 / 2.696 / 2.908 |
| Steengroeve | stenen hut met leien, gestapelde blokken, kraan | 2.496 / 2.672 / 2.848 |
| Zagerij | werkplaats + open afdak met zaagbank (draaiend zaagblad) | 2.138 / 2.222 / 2.414 |
| Boerderij | rieten dak, rode schuur met witte deur, hooibalen | 2.680 / 2.856 / 2.980 |
| Molen | witte romp op stenen voet, omloop, rieten kap (draaiende wieken) | 1.544 / 1.656 / 1.832 |
| Bakkerij | roomwit huis, gemetselde koepeloven met gloed (2 rookpunten) | 2.130 / 2.226 / 2.338 |
| Visser | houten hut met blauw dak op palen, netten, bootjes | ~1.200 – 1.300 |
| Markt | geplaveid plein, kramen met gestreepte luifels, vlag | 2.054 / 2.306 / 2.426 |
| Wachttoren | steenbanden, hoekstenen, platform met balustrade, vlag | 2.024 / 2.072 / 2.228 |
| Wijngaard | paars pannendak, pergola met ranken en trossen | 2.210 / 2.390 / 2.478 |
| Wijnmakerij | stenen pand, overwelfde kelderpoort, vatenrek | 2.094 / 2.230 / 2.406 |
| Herberg | stenen begane grond + vakwerk, terras, uithangbord | 2.402 / 2.502 / 2.566 |
| Pakhuis | houten wanden, dubbele deur, hijsbalk met katrol | 2.700 / 2.836 / 3.044 |
| Kathedraal (2×2) | schip met steunberen, torenfront met roosvenster en spits | 4.772 / 4.864 / 5.100 |

## Techniek
- **Gedeelde bouwstenen** (`tools/blender/lib/ve_parts.py`): `house_body` (huis met vakwerk of steen), daken van pannen, spanen, leien of riet, kegeldaken, kramen, kratten, zakken, hooibalen, vlaggenmasten, natuurlijke fundering, AO-bake.
- **Markers:** rookpunten (`_smoke`, `_smoke2`) en animatie-ankers (`_anim_flag`, `_anim_sails`, `_anim_saw`). De geanimeerde delen blijven procedureel en staan op het anker van het nieuwe model.
- **AO:** driehoeken groter dan 0,004 m² krijgen geen AO (anders kleurt een hele muur donker). Kleine onderdelen wel.
- **Laden in twee fases:** de 7 gebouwen die je bij de start ziet (rang 0, dorpshuis, erf) laden vóór het spel begint. De overige 11 laden daarna op de achtergrond. Een gebouw dat al staat, wisselt automatisch naar het nieuwe model zodra het binnen is.

## Metingen (vaste seed, alle 18 gebouwen in beeld, overzicht)
| | Draw calls | Driehoeken/frame | Geometrieën |
|---|---|---|---|
| Voor | 61 | 976.318 | 148 |
| Na | 61 | 1.002.350 (+2,7%) | 148 |

Frametijden in de headless software-renderer: 357 → 377 ms; binnen de meetruis van die renderer (zie het testgebiedrapport).

**Downloadgrootte (gzip, zoals een webserver/CDN het verstuurt):** alle 18 GLB's samen **2,1 MB**, waarvan **0,8 MB** vóór het spelbegin (de 7 startgebouwen) en 1,3 MB op de achtergrond. Ongecomprimeerd is het 9,5 MB.

**Tests:** 55 geslaagd, 0 gefaald (23 bewust overgeslagen: de modeltest draait alleen op desktop, plus de bestaande desktop- en muis-specifieke tests).

## Bekende beperkingen en vervolg
1. **Downloadgrootte:** AO als 16-bit kleur en losse normalen maken de bestanden groter dan nodig. Een post-processing-stap (8-bit kleur, quantisatie) kan dit naar schatting 30–40% verkleinen.
2. **Vegetatie:** gras en bloemen zijn nog de oude stijl, en de ~1 miljoen driehoeken per frame komen vooral daarvandaan (geen frustum culling op de instanced meshes). Dat is de grootste prestatiewinst.
3. **Velden** (graan, druiven) en de dorpelingen zijn nog niet in de nieuwe stijl.

Opnieuw meten:
```
set SHOTS_DIR=na&& npm run showcase
node tests/compare-showcase.js
```
