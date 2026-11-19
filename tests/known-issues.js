// Bekende, gedocumenteerde fouten die (nog) bewust niet zijn opgelost.
// Een fout die hier staat laat de test niet falen, maar wordt wel als waarschuwing
// gerapporteerd. Verwijder een regel zodra de fout is opgelost.
// Strikte modus (alles laten falen):  set STRICT=1 && npx playwright test
module.exports = [
  {
    id: 'VE-001',
    title: 'Render-crash: settler-hoofden delen materiaal met torso\'s die wel instanceColor hebben (js/fx.js:13-21)',
    match: /reading 'isInterleavedBufferAttribute'/,
  },
];
