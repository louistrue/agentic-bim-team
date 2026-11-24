// Node test: browser pipeline reproduces last night's CLI results on v1–v3 (GUIDs, IDS, checks).
import { readFileSync } from 'node:fs';
import { compileDesign } from '../src/core/compile.js';
import { checkDesign } from '../src/core/check.js';
import { requirementsToIds } from '../src/core/ids.js';
import { updateIssues } from '../src/core/issues.js';
import { readBCF } from '@ifc-lite/bcf';
const W = new URL('../../workspace/', import.meta.url).pathname;
const site = JSON.parse(readFileSync(W + 'site.json')), brief = JSON.parse(readFileSync(W + '../brief.json')), idsXml = readFileSync(W + 'requirements.ids', 'utf8');
let fail = 0; const ok = (c, m) => { console.log(`${c ? 'ok  ' : 'FAIL'} ${m}`); if (!c) fail++; };
for (const v of [1, 2, 3]) {
  const D = JSON.parse(readFileSync(`${W}design_v${v}.json`));
  const r = compileDesign(D);
  ok(r.ok, `v${v} compiles (${r.elements} elements)`);
  const K0 = JSON.parse(readFileSync(`${W}design_v${v}.keys.json`));
  ok(Object.keys(K0).every((k) => r.keys[k]?.guid === K0[k].guid), `v${v} GlobalIds identical to CLI run`);
  const c = await checkDesign({ v, D, K: r.keys, ifc: r.ifc, site, brief, idsXml });
  const c0 = JSON.parse(readFileSync(`${W}checks_v${v}.json`));
  ok(JSON.stringify(c.findings.map((f) => f.id).sort()) === JSON.stringify(c0.findings.map((f) => f.id).sort()), `v${v} same findings as CLI (${c.findings.length})`);
  ok(JSON.stringify(c.metrics.ids) === JSON.stringify(c0.metrics.ids), `v${v} IDS summary identical: ${c.metrics.ids.map((s) => s.id + ':' + s.status).join(' ')}`);
  ok(c.georef.level === 50 && c.georef.crs === 'EPSG:2056', `v${v} georef ${c.georef.crs} LoGeoRef ${c.georef.level}`);
}
// sabotage must be caught
{
  const D = JSON.parse(readFileSync(`${W}design_v3.json`));
  D.openings.find((o) => o.reference === 'Wohnungstuer').fireRating = 'EI 15';
  D.walls.filter((w) => w.type === 'external').forEach((w) => { w.uValue = 0.24; });
  const r = compileDesign(D); const c = await checkDesign({ v: 9, D, K: r.keys, ifc: r.ifc, site, brief, idsXml });
  ok(c.findings.some((f) => f.rule === 'R06'), 'sabotage door EI 15 → R06');
  ok(c.findings.some((f) => f.rule === 'R02'), 'sabotage wall U 0.24 → R02');
}
{
  const r = compileDesign({ storeys: [{ key: 'EG', elevation: 0, height: 3 }], walls: [{ key: 'W1', storey: 'EG', start: [0, 0], end: [5, 0], thickness: 0.3 }], openings: [{ key: 'F1', kind: 'window', wall: 'W1', offset: 4.5, width: 2, height: 1 }] });
  ok(!r.ok && r.problems[0].key === 'F1', 'compiler refuses opening outside wall');
}
{
  const x = requirementsToIds(brief);
  ok(x.xml === idsXml, `IDS from brief identical to CLI (${x.specifications} specs, not IDS: ${x.notIds})`);
  let ledger = { issues: {} };
  for (const v of [1, 2, 3]) {
    const D = JSON.parse(readFileSync(`${W}design_v${v}.json`)); const r = compileDesign(D);
    const checks = JSON.parse(readFileSync(`${W}checks_v${v}.json`)); const review = JSON.parse(readFileSync(`${W}review_v${v}.json`));
    const res = await updateIssues({ v, D, K: r.keys, checks, review, ledger }); ledger = res.ledger;
    const back = await readBCF(res.bcf);
    ok(back.topics.size === Object.keys(ledger.issues).length, `v${v} BCF round-trip ${back.topics.size} topics, ${res.open} open, ${res.closed} closed`);
  }
  const L0 = JSON.parse(readFileSync(`${W}issues.json`));
  ok(Object.keys(L0.issues).sort().join() === Object.keys(ledger.issues).sort().join(), 'ledger has the same issue ids as the CLI run');
}
{ // regression: two facade walls starting at the same corner must not turn the far corner into "outside"
  const w = (key, a, b) => ({ key, storey: 'EG', start: a, end: b, thickness: 0.4, type: 'external', loadBearing: true, fireRating: 'REI 60', uValue: 0.15 });
  const D = { name: 'G2', placement: { eastings: 2687233, northings: 1246459, height: 600 }, storeys: [{ key: 'EG', elevation: 0, height: 3 }],
    walls: [w('S', [0, 0], [10, 0]), w('W', [0, 0], [0, 10]), w('N', [0, 10], [10, 10]), w('E', [10, 0], [10, 10])],
    slabs: [{ key: 'BP', storey: 'EG', kind: 'base', thickness: 0.3, polygon: [[-0.2, -0.2], [10.2, -0.2], [10.2, 10.2], [-0.2, 10.2]] }],
    spaces: [{ key: 'R-NE', storey: 'EG', usage: 'Reduit', unit: '-', polygon: [[6, 6], [9.8, 6], [9.8, 9.8], [6, 9.8]] }] };
  const r = compileDesign(D); const c = await checkDesign({ v: 7, D, K: r.keys, ifc: r.ifc, site, brief, idsXml });
  ok(!c.findings.some((f) => f.rule === 'G2'), 'G2: room in the far corner is inside (outline from all corners)');
  const r2 = compileDesign({ ...D, storeys: [] }); ok(!r2.ok && /returned an object with keys/.test(r2.problems[0].msg), 'compiler explains a missing storeys array');
}
process.exit(fail ? 1 : 0);
