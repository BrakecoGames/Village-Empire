// Releasearchief: zet een gepushte update van de game in een eigen map in de gamemap (naast de broncode),
// zoals bij Refinery Rush:  "<Game> versie <datum> v<versie>/"  met daarin
//   - <game>-v<versie>.zip   precies de bestanden die online staan (CrazyGames-upload: index.html, style.css, js/, public/)
//   - versie.txt             versie, datum, commit, beschrijving en de link naar de online game
//
// Gebruik (in de map met de broncode):
//   npm run archive                 de huidige versie (HEAD; na `npm run release` + commit + push)
//   npm run archive -- --all        alle eerdere releases opnieuw opbouwen uit de git-geschiedenis (bestaande mappen blijven)
//   npm run archive -- <commit>     één bepaalde release
// De archiefmappen staan buiten git (in de bovenliggende gamemap) en gaan dus niet mee naar GitHub.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const GAME = 'Village Empire', SLUG = 'village-empire', LINK = 'https://brakecogames.github.io/Village-Empire/';
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.resolve(repo, '..');                     // de gamemap zelf (bijv. "08. Village Empire")
const git = (...a) => execFileSync('git', a, { cwd: repo, encoding: 'utf8', maxBuffer: 1 << 28 }).trim();
// wat er online staat: alles behalve ontwikkelbestanden
const DEPLOY = p => !/^(tests|tools|docs|node_modules|playwright-report|test-results|\.claude)\//.test(p) &&
  !/^(package(-lock)?\.json|playwright\.config\.js|\.gitignore|RAPPORT-.*|VOORTGANG-.*|STIJLGIDS.*|.*\.zip)$/.test(p);

function archive(sha) {
  const files = git('ls-tree', '-r', '--name-only', sha).split('\n').filter(Boolean).filter(DEPLOY);
  const vfile = git('show', sha + ':js/version.js');
  const version = (vfile.match(/VERSION\s*=\s*'([0-9.]+)'/) || [])[1];
  if (!version) { console.log('overgeslagen (geen versie): ' + sha); return; }
  const date = git('log', '-1', '--format=%ad', '--date=short', sha);
  const msg = git('log', '-1', '--format=%s%n%n%b', sha);
  const dir = path.join(out, `${GAME} versie ${date} v${version}`);
  const zip = path.join(dir, `${SLUG}-v${version}.zip`);
  if (fs.existsSync(zip)) { console.log('bestaat al: ' + path.basename(dir)); return; }
  fs.mkdirSync(dir, { recursive: true });
  execFileSync('git', ['archive', '--format=zip', '-o', zip, sha, '--', ...files], { cwd: repo, maxBuffer: 1 << 28 });
  fs.writeFileSync(path.join(dir, 'versie.txt'),
    `${GAME} — versie ${version}\nDatum: ${date}\nCommit: ${git('rev-parse', sha)}\nOnline: ${LINK}\n\n` +
    `Upload voor CrazyGames: ${path.basename(zip)} (de bestanden zoals ze online staan).\n\n${msg.trim()}\n`);
  console.log(`klaar: ${path.basename(dir)}  (${(fs.statSync(zip).size / 1048576).toFixed(1)} MB)`);
}

const arg = process.argv[2];
if (arg === '--all') {
  // elke commit die js/version.js veranderde = een release (oudste eerst)
  for (const sha of git('log', '--reverse', '--format=%H', '--', 'js/version.js').split('\n').filter(Boolean)) archive(sha);
} else archive(arg || 'HEAD');
