// Nieuwe versie klaarzetten: verhoogt het versienummer, zet de datum van vandaag en werkt alle
// ?v=-cachebusters bij, zodat spelers na een upload meteen de nieuwe bestanden krijgen.
//
//   npm run release            1.0.0 → 1.0.1   (kleine aanpassing)
//   npm run release -- minor   1.0.1 → 1.1.0   (nieuwe functies)
//   npm run release -- major   1.1.0 → 2.0.0
//   npm run release -- 1.4.2   precies deze versie
//
// Daarna committen en pushen; GitHub Pages publiceert binnen een paar minuten.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const vFile = path.join(root, 'js', 'version.js');
const html = path.join(root, 'index.html');

const src = fs.readFileSync(vFile, 'utf8');
const cur = (src.match(/VE\.VERSION = '(\d+)\.(\d+)\.(\d+)'/) || []).slice(1).map(Number);
if (cur.length !== 3) throw new Error('Versie niet gevonden in js/version.js');

const arg = process.argv[2] || 'patch';
let next;
if (/^\d+\.\d+\.\d+$/.test(arg)) next = arg;
else if (arg === 'major') next = `${cur[0] + 1}.0.0`;
else if (arg === 'minor') next = `${cur[0]}.${cur[1] + 1}.0`;
else if (arg === 'patch') next = `${cur[0]}.${cur[1]}.${cur[2] + 1}`;
else throw new Error('Gebruik: npm run release [-- patch|minor|major|x.y.z]');

const d = new Date();
const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

fs.writeFileSync(vFile, src
  .replace(/VE\.VERSION = '[^']*'/, `VE.VERSION = '${next}'`)
  .replace(/VE\.BUILD_DATE = '[^']*'/, `VE.BUILD_DATE = '${date}'`));

// alleen eigen bestanden (geen CDN-links) krijgen de nieuwe ?v=
const page = fs.readFileSync(html, 'utf8');
let n = 0;
const out = page.replace(/((?:src|href)="(?!https?:)[^"?]+\.(?:js|css))(\?v=[^"]*)?"/g, (m, url) => { n++; return `${url}?v=${next}"`; });
fs.writeFileSync(html, out);

console.log(`Versie ${cur.join('.')} → ${next} (${date}); ${n} bestanden in index.html krijgen ?v=${next}`);
console.log('GLB-modellen volgen automatisch (glb-models.js gebruikt VE.VERSION).');
