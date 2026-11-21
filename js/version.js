/* Village Empire — © 2026 Brakeco Games. All rights reserved.
   Versie en releasedatum. Niet met de hand aanpassen: `npm run release` verhoogt de versie,
   zet de datum en werkt de ?v=-cachebusters in index.html bij. */
'use strict';
window.VE = window.VE || {};
window.VE.VERSION = '1.0.0';
window.VE.BUILD_DATE = '2026-11-21';
/* Korte tekst voor in het menu, bijv. "v1.0.0 · 21-11-2026" */
window.VE.versionLabel = function () {
  const d = window.VE.BUILD_DATE.split('-');
  return 'v' + window.VE.VERSION + ' · ' + d[2] + '-' + d[1] + '-' + d[0];
};
