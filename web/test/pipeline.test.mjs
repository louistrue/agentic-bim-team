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
{ // regression (audit 2026-11-24): IFC4 rules, pset names, label length, BCF stability
  const D = JSON.parse(readFileSync(`${W}design_v3.json`)); const r = compileDesign(D);
  const rels = [...r.ifc.matchAll(/^#\d+=\s*IFCRELCONTAINEDINSPATIALSTRUCTURE\([^(]*\(([^)]*)\)/gm)].flatMap((m) => m[1].split(',').map((x) => Number(x.slice(1))));
  const spaceIds = new Set([...r.ifc.matchAll(/^#(\d+)=\s*IFCSPACE\(/gm)].map((m) => Number(m[1])));
  ok(spaceIds.size === D.spaces.length && !rels.some((id) => spaceIds.has(id)), 'IfcSpace not in IfcRelContainedInSpatialStructure (WR31)');
  const agg = [...r.ifc.matchAll(/^#\d+=\s*IFCRELAGGREGATES\('[^']+',[^,]*,\$,\$,#(\d+),\(([^)]*)\)/gm)].flatMap((m) => m[2].split(',').map((x) => Number(x.slice(1))));
  ok([...spaceIds].every((id) => agg.filter((a) => a === id).length === 1), 'every IfcSpace aggregated exactly once into a storey (WR41)');
  const guids = [...r.ifc.matchAll(/^#\d+=\s*IFC[A-Z]+\('([0-9A-Za-z_$]{22})'/gm)].map((m) => m[1]);
  ok(new Set(guids).size === guids.length && guids.every((g) => /^[0-3]/.test(g)), `all ${guids.length} GlobalIds unique and valid`);
  const wc = [...r.ifc.matchAll(/^#\d+=\s*IFCPROPERTYSET\('[^']+',[^,]*,'(Pset_[A-Za-z]+)',\$,\(([^)]*)\)/gm)];
  const propName = Object.fromEntries([...r.ifc.matchAll(/^#(\d+)=\s*IFCPROPERTYSINGLEVALUE\('([^']+)'/gm)].map((m) => [m[1], m[2]]));
  const inPset = (ps, prop) => wc.some((m) => m[1] === ps && m[2].split(',').some((x) => propName[x.slice(1)] === prop));
  ok(!inPset('Pset_WindowCommon', 'SolarHeatGainTransmittance') && inPset('Pset_DoorWindowGlazingType', 'SolarHeatGainTransmittance'), 'g-value in Pset_DoorWindowGlazingType, not Pset_WindowCommon');
  const long = 'Ä'.repeat(300) + "'";
  const E = { name: long, storeys: [{ key: 'EG', name: long, elevation: 0, height: 3 }], walls: [{ key: 'W1', name: long, storey: 'EG', start: [0, 0], end: [5, 0], thickness: 0.3, type: 'external', reference: long }],
    openings: [{ key: 'F1', name: long, kind: 'window', wall: 'W1', offset: 0.1, width: 1, height: 1, sill: 1 }], spaces: [{ key: 'R1', name: long, usage: long, storey: 'EG', polygon: [[0, 0], [5, 0], [5, 4]] }] };
  const e = compileDesign(E);
  const strs = [...e.ifc.split('DATA;')[1].matchAll(/'((?:[^']|'')*)'/g)].map((m) => m[1].replace(/''/g, "'").replace(/\\X2\\([0-9A-F]+)\\X0\\/g, (_, h) => String.fromCharCode(...h.match(/.{4}/g).map((x) => parseInt(x, 16)))));
  ok(e.ok && strs.every((x) => x.length <= 255) && strs.some((x) => x === 'Ä'.repeat(255)), 'IfcLabel values ≤ 255 characters (long names truncated, umlauts kept)');
  const sp = compileDesign({ ...E, storeys: [...E.storeys, { key: 'OG', elevation: 3, height: 3 }], spaces: [...E.spaces, { key: 'R2', usage: 'x', storey: 'OG', polygon: [[0, 0], [5, 0], [5, 4]] }] });
  ok(sp.ok && !/IFCRELCONTAINEDINSPATIALSTRUCTURE\('[^']+',[^,]*,\$,\$,\(\)/.test(sp.ifc) && /IFCRELAGGREGATES\([^)]*#\d+,\(#\d+\)\);\s*\n(#\d+=IFCRELAGGREGATES|ENDSEC)/.test(sp.ifc), 'storey with only spaces: no empty containment, space aggregated');
  const run = async () => (await updateIssues({ v: 1, D, K: r.keys, checks: { findings: [] }, review: { findings: [{ id: 'X:EG-A-WO', rule: 'X', title: long, text: long, severity: 'ERROR', discipline: 'Visual QA', elements: ['EG-A-WO'] }] } })).bcf;
  const [b1, b2] = [await readBCF(await run()), await readBCF(await run())];
  ok(b1.projectId && b1.projectId === b2.projectId, `BCF ProjectId stable across exports (${b1.projectId})`);
  const t = [...b1.topics.values()][0], cam = t.viewpoints[0].perspectiveCamera;
  const d = cam.cameraDirection, u = cam.cameraUpVector;
  ok(Math.abs(d.x * u.x + d.y * u.y + d.z * u.z) < 1e-9 && u.z > 0.8 && d.z < 0, 'BCF camera up vector orthogonal, Z-up, looking down');
  ok(t.title.includes("'") && !/ /.test(t.creationAuthor ?? t.author ?? ''), 'BCF title keeps quotes, author has no spaces');
}
process.exit(fail ? 1 : 0);
