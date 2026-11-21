// Bouwt Blender-modellen: tools/blender/models/<naam>.py  ->  public/models/<naam>.glb
// en controleert elk resultaat.
//
//   npm run models                 # alle modellen
//   npm run models -- test_cube    # één of meer modellen op naam
//
// Blender wordt automatisch gezocht. Overschrijven kan met de omgevingsvariabele BLENDER_EXE.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync, execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { verifyGlb } from './verify-glb.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..');
const modelsDir = path.join(here, 'models');
const outDir = path.join(root, 'public', 'models');

export function findBlender() {
  const cands = [];
  if (process.env.BLENDER_EXE) cands.push(process.env.BLENDER_EXE);
  if (process.platform === 'win32') {
    for (const base of [process.env.ProgramFiles, process.env['ProgramFiles(x86)']].filter(Boolean)) {
      const bf = path.join(base, 'Blender Foundation');
      if (fs.existsSync(bf)) {
        // nieuwste versie eerst
        const dirs = fs.readdirSync(bf).filter(d => /^Blender/i.test(d))
          .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
        for (const d of dirs) cands.push(path.join(bf, d, 'blender.exe'));
      }
    }
    try { cands.push(...execSync('where blender', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).split(/\r?\n/).filter(Boolean)); } catch {}
  } else {
    cands.push('/Applications/Blender.app/Contents/MacOS/Blender', '/usr/bin/blender', '/snap/bin/blender');
  }
  const hit = cands.find(c => c && fs.existsSync(c));
  if (!hit) throw new Error('blender.exe niet gevonden. Zet BLENDER_EXE naar het volledige pad.');
  return hit;
}

function build(name, blender) {
  const script = path.join(modelsDir, name + '.py');
  if (!fs.existsSync(script)) throw new Error('script niet gevonden: ' + script);
  const out = path.join(outDir, name + '.glb');
  const t0 = Date.now();
  const r = spawnSync(blender, ['--background', '--factory-startup', '--python-exit-code', '1', '--python', script, '--', '--out', out],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const log = (r.stdout || '') + (r.stderr || '');
  const okLine = log.split(/\r?\n/).find(l => l.startsWith('VE-BLENDER-OK'));
  if (r.status !== 0 || !okLine) {
    console.error(log.split(/\r?\n/).filter(l => /error|traceback|VE-BLENDER|File "/i.test(l)).join('\n') || log);
    throw new Error(`${name}: Blender faalde (exitcode ${r.status})`);
  }
  const v = verifyGlb(out);
  const status = v.ok ? 'OK' : 'FOUT';
  console.log(`${status}  ${name}.glb  ${(v.bytes / 1024).toFixed(1)} KB  ${v.triangles} tris  ${v.meshes.length} mesh(es)  ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  for (const w of v.warnings) console.log('   waarschuwing: ' + w);
  for (const e of v.errors) console.log('   fout: ' + e);
  return v.ok;
}

const names = process.argv.slice(2);
const all = fs.readdirSync(modelsDir).filter(f => f.endsWith('.py')).map(f => f.slice(0, -3));
const todo = names.length ? names : all;
const blender = findBlender();
console.log('Blender: ' + blender);
let ok = true;
for (const n of todo) {
  try { ok = build(n, blender) && ok; } catch (e) { console.error('FOUT  ' + e.message); ok = false; }
}
process.exit(ok ? 0 : 1);
