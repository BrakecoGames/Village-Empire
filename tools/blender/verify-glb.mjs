// Controleert een .glb-bestand zonder extra afhankelijkheden.
// Gebruik: node tools/blender/verify-glb.mjs public/models/test_cube.glb [--max-kb 200]
import fs from 'node:fs';

export function verifyGlb(file, { maxKb = 200 } = {}) {
  const buf = fs.readFileSync(file);
  const errors = [], warnings = [];
  if (buf.length < 20) throw new Error('bestand te klein voor GLB');
  const magic = buf.toString('ascii', 0, 4), version = buf.readUInt32LE(4), length = buf.readUInt32LE(8);
  if (magic !== 'glTF') errors.push(`magic is "${magic}", verwacht "glTF"`);
  if (version !== 2) errors.push(`glTF-versie ${version}, verwacht 2`);
  if (length !== buf.length) errors.push(`header-lengte ${length} ≠ bestandsgrootte ${buf.length}`);

  const jsonLen = buf.readUInt32LE(12), jsonType = buf.toString('ascii', 16, 20);
  if (jsonType !== 'JSON') errors.push('eerste chunk is geen JSON');
  const gltf = JSON.parse(buf.toString('utf8', 20, 20 + jsonLen).trim());
  let binLen = 0;
  const binStart = 20 + jsonLen;
  if (binStart + 8 <= buf.length) {
    binLen = buf.readUInt32LE(binStart);
    if (buf.toString('ascii', binStart + 4, binStart + 8) !== 'BIN\0') errors.push('tweede chunk is geen BIN');
  }

  const meshes = gltf.meshes || [];
  if (!meshes.length) errors.push('geen meshes');
  let tris = 0, verts = 0;
  for (const m of meshes) for (const p of m.primitives) {
    const pos = gltf.accessors[p.attributes.POSITION];
    if (!pos) { errors.push(`mesh ${m.name} zonder POSITION`); continue; }
    verts += pos.count;
    tris += (p.indices != null ? gltf.accessors[p.indices].count : pos.count) / 3;
    if (!p.attributes.NORMAL) warnings.push(`mesh ${m.name} zonder normalen`);
  }
  for (const b of gltf.buffers || []) if (b.uri) warnings.push('externe buffer-URI (verwacht ingebed in GLB)');
  const req = gltf.extensionsRequired || [];
  if (req.length) warnings.push('vereiste extensies: ' + req.join(', ') + ' (controleer of Three.js r128 ze ondersteunt)');
  const kb = buf.length / 1024;
  if (kb > maxKb) warnings.push(`bestand ${kb.toFixed(1)} KB > ${maxKb} KB`);

  return {
    file, ok: errors.length === 0, errors, warnings,
    bytes: buf.length, binBytes: binLen, generator: gltf.asset && gltf.asset.generator,
    meshes: meshes.map(m => m.name), materials: (gltf.materials || []).map(m => m.name),
    nodes: (gltf.nodes || []).length, triangles: tris, vertices: verts,
  };
}

if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}` || process.argv[1]?.endsWith('verify-glb.mjs')) {
  const files = process.argv.slice(2).filter(a => !a.startsWith('--'));
  const mi = process.argv.indexOf('--max-kb');
  const maxKb = mi > 0 ? Number(process.argv[mi + 1]) : 200;
  let fail = false;
  for (const f of files) {
    const r = verifyGlb(f, { maxKb });
    console.log(JSON.stringify(r, null, 2));
    if (!r.ok) fail = true;
  }
  process.exit(fail ? 1 : 0);
}
