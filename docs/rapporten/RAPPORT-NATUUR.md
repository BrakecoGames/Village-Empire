# Rapport: vegetatie en natuur

## Wat er is gemaakt (Blender 5.3, `tools/blender/models/nature.py`)

| Groep | Soorten |
|---|---|
| Loofbomen | eik, oude eik (kromme stam, wortels, knoest, mos), beuk, berk, jonge boom |
| Naaldbomen | grove den (gelaagde pluimen), fijnspar (hangende lagen) |
| Fruitbomen | appel (appels in de kroon en in het gras), peer, bloesemboom (met gevallen blaadjes) |
| Gras | kort, middelhoog, hoog wild gras, bloeiend gras, onkruidrozet |
| Bloemen | madeliefjes, klaprozen, gele bloemetjes, paarse (lavendel), gemengde veldbloemen |
| Struiken | klein rond, groot, bloeiend, bessen, lage heg |
| Details | steentjes, mossige rots, boomstronk, gevallen tak, paddenstoelen, wortels, bladeren |
| Easter eggs | paddenstoel met gezichtje, stronk met deurtje, struik met oogjes, eik met vogelhuisje, beuk met Brakeco-embleem |

Variatie per soort: 5 kleurvarianten (soms een warme nazomertint) en per boom eigen verhoudingen
(breedte 0,90–1,12 en hoogte 0,88–1,15). Dat is vast per tegel, dus deterministisch.

## Hoe het in de game werkt

- **Gameplay ongewijzigd.** De drie boomtypes (loof, naald, berk) blijven het type voor de save, de houthakker en de bosbouwer. De soort is puur visueel en volgt uit de tegel en de seed. Jonge bomen (minder dan 50% gegroeid) hebben een eigen model en worden vanzelf volwassen.
- **Decoratie is nooit een obstakel.** Ze staat niet in de gameplay-rasters. Bouwen, een pad, een akker of een nieuwe boom ruimt de decoratie op die tegel op. Er staan geen struiken of rotsen door stammen.
- **Langs gelopen paden en rond gebouwen** groeien vanzelf bloemetjes en plantjes, die meeschuiven met het dorp.
- **Wereldgeneratie blijft gelijk.** Nieuwe dorpen met dezelfde seed krijgen exact dezelfde bomen en rotsen als vóór deze wijziging (getest met drie seeds). De vegetatie heeft een eigen random-reeks en wordt niet opgeslagen.
- **Natuurlijke groepen.** Elke bloemsoort heeft een eigen ruisveld, zodat losse velden ontstaan: een klaprozenveld, een lavendelweide. Hoog gras groeit in plukken, struiken langs bosranden, en bladeren, paddenstoelen en takken op de bosbodem.
- **Wind.** Eén gedeelde shader zonder AnimationMixers of physics. Trage windstoten trekken als golven over het land, en elke plant heeft een eigen fase. Bladeren trillen licht en stammen staan stil.
- **Fallback.** Laadt `nature.glb` niet (of met `?oldnature`), dan verschijnen de oude bomen en het oude gras.

## Prestaties (desktop-test, SwiftShader, zelfde camera)

| | Oud | Nieuw |
|---|---|---|
| Driehoeken, standaard zoom | 1.002.000 | 402.000 |
| Driehoeken, uitgezoomd | 1.002.000 | 692.000 |
| Draw calls | 51 | 73 |
| Frame rate | gelijk | gelijk |

Het geheim is per-instance-culling (`VE.Instancer`). Three.js cullt een InstancedMesh alleen als
geheel; nu gaan alleen de zichtbare bomen en planten naar de GPU. Dat kost ongeveer 1 ms CPU, en
alleen als de camera beweegt.

Mobiel: ongeveer de helft van de decoratie en geen schaduwen voor struiken en details.

Bestandsgrootte: `nature.glb` is 0,94 MB (inclusief gebakken ambient occlusion).

## Tests

Het testbestand is `tests/natuur.spec.js`. Het controleert:
- de soorten en de decoratie;
- de easter eggs;
- dat bouwen de decoratie opruimt;
- de bloemen langs paden;
- een jonge boom die volwassen wordt;
- het omhakken van een boom;
- opslaan en laden;
- de deterministische wereldgeneratie;
- de fallback;
- de prestaties.

Screenshots: `tests/screenshots/<desktop|mobile>/natuur-*.png`.

## Bewust niet gedaan

- De gameplay-rotsblokken (steenhouwer) zijn ongewijzigd gebleven.
- Er zijn geen schaduwen die meebewegen met de wind; de schaduw staat stil.
