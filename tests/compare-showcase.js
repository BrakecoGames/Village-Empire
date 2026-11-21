// Contactvellen voor/na per gebouw uit de showcase: tests/screenshots/showcase/vel-*.png
// Gebruik: node tests/compare-showcase.js   (na `npm run showcase` met SHOTS_DIR=voor en =na)
const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const DIR = path.join(__dirname, 'screenshots', 'showcase');
const img = p => fs.existsSync(path.join(DIR, p)) ? 'data:image/png;base64,' + fs.readFileSync(path.join(DIR, p)).toString('base64') : '';
const NAMES = {
  hq: 'Dorpshuis', yard: 'Opslagerf', house: 'Cottage', woodcutter: 'Houthakker', forester: 'Boswachter', quarry: 'Steengroeve',
  sawmill: 'Zagerij', farm: 'Boerderij', windmill: 'Molen', bakery: 'Bakkerij', fisher: 'Visser', market: 'Markt',
  tower: 'Wachttoren', vineyard: 'Wijngaard', winery: 'Wijnmakerij', tavern: 'Herberg', warehouse: 'Pakhuis', monument: 'Kathedraal',
};
const SHEETS = [
  ['hq', 'yard', 'house', 'woodcutter', 'forester', 'quarry'],
  ['sawmill', 'farm', 'windmill', 'bakery', 'fisher', 'market'],
  ['tower', 'vineyard', 'winery', 'tavern', 'warehouse', 'monument'],
];
const crop = src => `<div style="width:290px;height:250px;overflow:hidden;border-radius:6px;background:#111">
  <img src="${src}" style="width:1000px;margin:-62px 0 0 -355px;display:block"></div>`;

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1250, height: 800 } });
  for (const [n, types] of SHEETS.entries()) {
    let rows = '';
    for (const t of types) {
      const lv = (t === 'hq' || t === 'yard') ? ['l1'] : ['l1', 'l3'];
      let cells = '';
      for (const l of lv) cells += `<div><div style="font-size:12px;opacity:.7;margin-bottom:3px">${l.toUpperCase()} voor → na</div>
        <div style="display:flex;gap:4px">${crop(img(`voor/desktop-${t}-${l}.png`))}${crop(img(`na/desktop-${t}-${l}.png`))}</div></div>`;
      rows += `<div style="display:flex;align-items:center;gap:14px;margin-bottom:10px">
        <div style="width:90px;font-weight:700">${NAMES[t]}</div>${cells}</div>`;
    }
    await page.setContent(`<html><body style="margin:0;padding:12px;background:#2b2420;color:#f3e5c8;font:600 15px system-ui">${rows}</body></html>`);
    await page.waitForLoadState('load');
    const out = path.join(DIR, `vel-${n + 1}.png`);
    await page.screenshot({ path: out, fullPage: true });
    console.log(path.basename(out));
  }
  await browser.close();
})();
