// Tesselliert ein IFC mit @ifc-lite/geometry → <prefix>.meshes.bin/.json (Weltkoordinaten, Y oben)
import { GeometryProcessor } from '@ifc-lite/geometry';
import fs from 'fs';
const [ifc, prefix] = process.argv.slice(2);
const buf = new Uint8Array(fs.readFileSync(ifc));
const p = new GeometryProcessor({ tessellationQuality: 'medium' }); await p.init();
const out = fs.openSync(`${prefix}.meshes.bin`, 'w'); const index = []; let off = 0;
for await (const ev of p.processStreaming(buf)) {
  if (ev.type !== 'batch') continue;
  for (const m of ev.meshes) {
    const P = m.positions, o = m.origin || [0, 0, 0]; const w = new Float32Array(P.length);
    for (let i = 0; i < P.length; i += 3) { w[i] = P[i] + o[0]; w[i + 1] = P[i + 1] + o[1]; w[i + 2] = P[i + 2] + o[2]; }
    const pb = Buffer.from(w.buffer), ib = Buffer.from(new Uint32Array(m.indices).buffer);
    fs.writeSync(out, pb); fs.writeSync(out, ib); index.push([m.expressId, m.ifcType, off, P.length, m.indices.length]); off += pb.length + ib.length;
  }
}
fs.closeSync(out); fs.writeFileSync(`${prefix}.meshes.json`, JSON.stringify(index));
console.log(prefix, index.length, 'meshes');
process.exit(0);
