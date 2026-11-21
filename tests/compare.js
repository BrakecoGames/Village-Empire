// Maakt voor/na-vergelijkingsbeelden van het testgebied: tests/screenshots/stage/vergelijking-*.png
// Gebruik: node tests/compare.js   (na `npm run stage` met SHOTS_DIR=voor en SHOTS_DIR=na)
const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const DIR = path.join(__dirname, 'screenshots', 'stage');
// als data-URI: een pagina via setContent mag geen file://-afbeeldingen laden
const url = p => 'data:image/png;base64,' + fs.readFileSync(path.join(DIR, p)).toString('base64');
const SETS = [
  ['desktop-1-testgebied-dichtbij', 'Testgebied dichtbij (desktop)'],
  ['desktop-2-testgebied-voorkant', 'Voorkant (desktop)'],
  ['desktop-3-testgebied-midden', 'Speelafstand (desktop)'],
  ['mobile-1-testgebied-dichtbij', 'Testgebied dichtbij (mobiel 390×844)'],
];

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 600 } });
  for (const [name, title] of SETS) {
    if (!fs.existsSync(path.join(DIR, 'voor', name + '.png')) || !fs.existsSync(path.join(DIR, 'na', name + '.png'))) continue;
    const mobile = name.startsWith('mobile');
    await page.setViewportSize(mobile ? { width: 900, height: 1000 } : { width: 1600, height: 520 });
    await page.setContent(`<html><body style="margin:0;background:#2b2420;font:600 18px system-ui;color:#f3e5c8">
      <div style="padding:10px 14px">${title}</div>
      <div style="display:flex;gap:10px;padding:0 10px 10px">
        <figure style="margin:0;flex:1"><figcaption style="padding:4px 0">Voor</figcaption><img src="${url('voor/' + name + '.png')}" style="width:100%;display:block;border-radius:6px"></figure>
        <figure style="margin:0;flex:1"><figcaption style="padding:4px 0">Na</figcaption><img src="${url('na/' + name + '.png')}" style="width:100%;display:block;border-radius:6px"></figure>
      </div></body></html>`);
    await page.waitForLoadState('load');
    await page.screenshot({ path: path.join(DIR, `vergelijking-${name}.png`), fullPage: true });
    console.log('vergelijking-' + name + '.png');
  }
  await browser.close();
})();
