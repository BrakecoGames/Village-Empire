# Village Empire: visuele stijlgids

Referentie: de Blender-Cottage (`tools/blender/models/house.py`). Deze gids geldt voor alle nieuwe en vernieuwde modellen.

## Sfeer
Een knus, zonnig middeleeuws dorp op het platteland: warm licht, ambachtelijke materialen, veel kleine levendige details. Speels en "speelgoedachtig", nooit grimmig. Gebouwen moeten in één oogopslag herkenbaar zijn aan hun silhouet en kleur.

## Vormtaal
- Low-poly met **zachte randen**: grote delen krijgen een kleine afronding (bevel 0,004 tot 0,02); kleine delen blijven hoekig.
- **Ambacht zichtbaar maken:** losse dakpannen of shingles, balken, planken, keien. Geen glad vlak waar in het echt losse onderdelen zitten.
- **Lichte onregelmatigheid:** kleine rotatie, schaal en kleurvariatie per onderdeel (seeded random), zodat niets machinaal oogt.
- **Silhouet per functie:** de Cottage heeft een steil rood pannendak en vakwerk, de Woodcutter een blokhut met houten shingles en houtstapels.

## Kleur (sRGB-hex; materiaalnaam `Naam@jitter`)
| Rol | Kleuren |
|---|---|
| Pannendak | `#C2492E` `#AD3E28` `#D0603C`, nok `#8E3322` |
| Houten dak (shingles) | `#7A5A3E` `#6B4E36` `#8A6A48`, mos `#6F8F3A` |
| Stucwerk | `#F3E5C8` `#EAD2A6` |
| Balken/hout | donker `#6A4226`, midden `#8A5A34`, licht `#C89A5E` |
| Natuursteen | `#B5AE9F` `#9E978A` `#CFC8B8`, donker `#8E877A` |
| Aarde/erf | `#8A6A45` `#7A5C3C` `#A8865A` |
| Accenten | luiken blauw `#3F7FAF` of groen `#4E8A4A`, bloemen `#E84A5F` `#FFD166` `#F78FB3` |
| Licht | raamgloed `#FFD27A` |

Geen pure zwarten of verzadigde neonkleuren. Schaduwkanten krijgen hun diepte van de belichting en de gebakken AO, niet van donkere materiaalkleuren.

## Gronding: gebouwen staan ín de wereld
- **Geen grijze sokkel.** Funderingen zijn een lage rand natuursteen op aangestampte aarde. De zijkanten in aardekleur, zodat een helling eruitziet als een aardwal.
- Langs de rand komen **graspollen, kleine keien en bloemetjes**: de overgang van gebouw naar gras.
- **Gebakken ambient occlusion** (Cycles, in vertex-kleuren) met een grondvlak, zodat muurvoeten, hoeken en onder overstekken zacht donkerder worden. Dit kost in de game niets extra.

## Paden
Aangestampte aarde in gedempte zandtinten, met een **zachte rand** die overloopt in de grond eronder. Geen harde polygoonranden.

## Budget (per gebouw-level, CrazyGames/mobiel)
| | Doel | Maximum |
|---|---|---|
| Driehoeken | 2.000 – 2.800 | ~3.200 |
| Draw calls in game | 1 (gedeeld materiaal) | 1 |
| Materialen in Blender | vrij (worden vertex-kleuren) | — |
| GLB (gzip), alle levels samen | < 120 KB | 200 KB |

Herbruikbare bouwstenen staan in `tools/blender/lib/ve_blender.py` en in de modelscripts: `half_tube`, `tile`, `beam`, `box`, `cyl`, `blob`, `window`, `door`, `flower_box`, `stone_plinth`, `grass_clump`.
