// Contactvel van alle volle voorraadstapels: tests/screenshots/piles/vel.png
const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const DIR = path.join(__dirname, 'screenshots', 'piles');
const T = ['woodcutter', 'quarry', 'sawmill', 'farm', 'windmill', 'bakery', 'fisher', 'vineyard', 'winery'];
const img = t => 'data:image/png;base64,' + fs.readFileSync(path.join(DIR, `${t}-vol.png`)).toString('base64');
(async () => {
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1230, height: 800 } });
  const cells = T.map(t => `<div><div style="padding:3px 0">${t}</div><div style="width:400px;height:300px;overflow:hidden;border-radius:6px">
    <img src="${img(t)}" style="width:1100px;margin:-120px 0 0 -350px"></div></div>`).join('');
  await p.setContent(`<body style="margin:0;padding:10px;background:#2b2420;color:#f3e5c8;font:600 14px system-ui;display:flex;flex-wrap:wrap;gap:10px">${cells}</body>`);
  await p.screenshot({ path: path.join(DIR, 'vel.png'), fullPage: true });
  await b.close();
})();
