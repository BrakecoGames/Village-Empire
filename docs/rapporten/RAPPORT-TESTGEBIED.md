# Testgebied nieuwe visuele stijl: rapport

*21-11-2026 · basis: commit `1029e3c` · stijlgids: [STIJLGIDS.md](STIJLGIDS.md)*

## Fase 1: grootste visuele zwakke punten (vóór)
1. **Paden:** platte perzikkleurige polygonen met harde randen en "botvormige" uiteinden, zonder overgang naar het gras. Daarbij z-fighting (gekartelde lichte vlekken) tussen vulvlak, pad en slijtspoor.
2. **Woodcutter:** een kaal bruin blok met een glad dak; sterk kwaliteitsverschil met de Blender-Cottage.
3. **Funderingen:** lichtgrijze "betonplaten" onder gebouwen, die kunstmatig ogen.
4. **Geen contactschaduw of AO:** gebouwen lijken neergezet in plaats van verankerd.
5. **Ondergrond:** egaal limegroen; graspollen zijn dunne pieken, bloemen lijken lolly's (nog niet aangepakt, buiten het testgebied).
6. **Prestaties:** elk frame tekent ~960.000 driehoeken, ongeacht de camerastand. Gras- en boom-instances hebben `frustumCulled = false` (bestaand, niet aangepast).

## Fase 3: wat er veranderd is
| Onderdeel | Wijziging | Bereik |
|---|---|---|
| **Woodcutter** | Nieuw Blender-model: blokhut van ronde stammen met uitstekende hoeken, houten spanendak met mos, hakblok met bijl, houtstapel, luiken, stenen schoorsteen. L2: afdak met kloofhout. L3: zaagbok, ton, uithangbord. | alleen Woodcutter |
| **Cottage** | Grijze sokkel vervangen door een natuurlijke fundering (aangestampte aarde met graspollen, keien, bloemetjes); gebakken AO. | alleen Cottage |
| **Ambient occlusion** | In Blender (Cycles) gebakken in vertex-kleuren, met grondvlak. In de game verrekend bij het laden: **0 extra draw calls of shaderkosten**. Grote vlakken (stuc, aarde) zijn uitgezonderd. | GLB-gebouwen |
| **Paden** | Zachte randen die exact overlopen in de terreinkleur, terreinnormalen (geen lichtnaad), smallere uiteinden, gedempte aardetint, z-fighting opgelost. | alle paden |
| **Bouwstenen** | `tools/blender/lib/ve_parts.py`: gedeelde onderdelen (dak, ramen, deur, fundering, gras, AO, export) voor alle volgende gebouwen. | tooling |

Gameplay, plaatsen, selectie, upgrades, opslaan en de fallback zijn ongewijzigd. Bij een GLB-fout valt elk gebouw los terug op zijn procedurele model.

## Fase 4: metingen (vaste seed, testgebied op speelafstand)
| | Draw calls | Driehoeken/frame | Geometrieën | Shaderprogramma's | Frametijd* |
|---|---|---|---|---|---|
| Desktop voor | 41 | 961.468 | 130 | 22 | 452 ms |
| Desktop na | 41 | 962.588 (+0,1%) | 129 | 21 | 400 ms |
| Mobiel voor | 40 | 884.210 | 130 | 22 | 293 ms |
| Mobiel na | 40 | 885.330 (+0,1%) | 129 | 21 | 276 ms |

\* Headless software-rendering (SwiftShader); alleen relatief bruikbaar. Het verschil valt binnen de meetruis. Op een echte GPU liggen deze tijden vele malen lager.

| Model | Driehoeken L1 / L2 / L3 | GLB (gzip, 3 levels) |
|---|---|---|
| Cottage | 2.570 / 3.054 / 3.388 (was 2.290 / 2.774 / 3.108; +280 voor gras, keien en bloemen langs de fundering) | 151 KB |
| Woodcutter | 2.620 / 3.052 / 3.312 | 138 KB |

Tests: **39 geslaagd, 0 gefaald** (7 bewust overgeslagen: desktop- of muis-specifiek). Nieuw: Woodcutter laden/levels/rook en fallback.

## Opnieuw meten
```
set SHOTS_DIR=na&& npm run stage
node tests/compare.js
```
De beelden komen in `tests/screenshots/stage/` (voor/, na/, vergelijking-*.png).

## Aanbevolen volgende stappen
1. Dezelfde stijl toepassen op Forester, Quarry en Sawmill (hergebruik `ve_parts`).
2. Het dorpshuis (HQ) en de opslagplaats: grootste resterende grijze sokkels.
3. Gras en bloemen globaal vernieuwen (warmere pollen, echte bloemkopjes) en frustum culling voor vegetatie per gebied: grootste prestatiewinst.
4. GLB's verkleinen (AO als 8-bit kleur): circa −30% bestandsgrootte.
