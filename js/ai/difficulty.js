/* Village Empire — © 2026 Brakeco Games. All rights reserved.
   AI: moeilijkheidsgraden. Alle knoppen op één plek; pas hier aan om de AI makkelijker of moeilijker te maken.

   think       seconden tussen twee beslissingen (reactiesnelheid)
   sloppy      kans dat hij een stap uit de build order overslaat of iets minder handigs bouwt (0 = foutloos)
   sites       zoveel bouwplaatsen tegelijk
   army        zoveel soldaten voordat hij aanvalt
   attackAfter vroegste aanval (spelseconden)
   regroup     na een mislukte aanval: zoveel seconden wachten
   defendR     vijanden binnen deze afstand van zijn dorpshuis = aanval op hem → verdedigen
   bonus       productiebonus (verzamelen en werkplaatsen), 1 = gelijk aan de speler
   gold        extra startgoud
   mix         welke soldaten hij traint (in volgorde, herhaald) */
'use strict';
(function (VE) {
  VE.AI_LEVELS = {
    easy: { name: 'Easy', think: 6, sloppy: 0.3, sites: 1, army: 9, attackAfter: 1500, regroup: 300, defendR: 13, bonus: 1.0, gold: 0,
      mix: ['swordsman'] },
    normal: { name: 'Normal', think: 3, sloppy: 0.08, sites: 2, army: 6, attackAfter: 900, regroup: 180, defendR: 16, bonus: 1.0, gold: 60,
      mix: ['swordsman', 'swordsman', 'archer'] },
    hard: { name: 'Hard', think: 1.5, sloppy: 0, sites: 3, army: 6, attackAfter: 600, regroup: 120, defendR: 18, bonus: 1.25, gold: 150,
      mix: ['swordsman', 'archer', 'swordsman', 'spearman'] }
  };
  VE.AI_LEVEL_ORDER = ['easy', 'normal', 'hard'];
})(window.VE);
