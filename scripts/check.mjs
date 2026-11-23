#!/usr/bin/env node
// Deterministic checks for one design version. No LLM involved.
// Inputs: workspace/design_vN.json (intent), workspace/design_vN.ifc (+ .keys.json), workspace/site.json,
//         workspace/requirements.ids, brief.json
// Output: workspace/checks_vN.json  { findings[], metrics, ran[] }
// Every finding has a stable id (rule:elementKey) so the orchestrator can tell resolved from new,
// and every finding names real elements (design key + IFC GlobalId).
//
// Usage: node scripts/check.mjs N
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const v = Number(process.argv[2]);
const base = `workspace/design_v${v}`;
const D = JSON.parse(readFileSync(`${base}.json`, 'utf8'));
const K = JSON.parse(readFileSync(`${base}.keys.json`, 'utf8'));
const site = JSON.parse(readFileSync('workspace/site.json', 'utf8'));
const brief = JSON.parse(readFileSync('brief.json', 'utf8'));
const Z = brief.zoning, PR = brief.program;
const bin = new URL('../node_modules/.bin/ifc-lite', import.meta.url).pathname;
const findings = [], ran = [];
const guidToKey = Object.fromEntries(Object.entries(K).map(([k, x]) => [x.guid, k]));
const add = (rule, severity, title, text, keys = [], extra = {}) => {
  const elements = [...new Set(keys)];
  findings.push({ id: `${rule}:${elements[0] ?? "MODEL"}`, rule, severity, title, text, elements, guids: elements.map((k) => K[k]?.guid).filter(Boolean), discipline: extra.discipline ?? 'Prüfung', source: extra.source, who: extra.who, evidence: extra.evidence });
};
const r2 = (x) => Math.round(x * 100) / 100;
const len = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
const area = (poly) => Math.abs(poly.reduce((s, p, i) => { const q = poly[(i + 1) % poly.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0)) / 2;
const segDist = (p, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1]; const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1))); return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy); };
const segSeg = (a, b, c, d) => Math.min(segDist(a, c, d), segDist(b, c, d), segDist(c, a, b), segDist(d, a, b));
const inPoly = (p, poly) => { let ins = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if ((yi > p[1]) !== (yj > p[1]) && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) ins = !ins; } return ins; };
const storeys = [...D.storeys].sort((a, b) => a.elevation - b.elevation);
const S = Object.fromEntries(storeys.map((s, i) => [s.key, { ...s, i }]));
const slabsOf = (st, kind) => (D.slabs ?? []).filter((s) => s.storey === st && s.kind === kind);
const slabAbove = (st) => { const nx = storeys[S[st].i + 1]; const c = (D.slabs ?? []).filter((s) => (nx && s.storey === nx.key && s.kind === 'floor') || (s.storey === st && s.kind === 'roof')); return c.length ? Math.max(...c.map((s) => s.thickness)) : 0; };

// ── 1. IDS (from the client's AIA) ───────────────────────────────────────────
ran.push('IDS workspace/requirements.ids (ifc-lite ids)');
let ids;
try { ids = JSON.parse(execFileSync(bin, ['ids', `${base}.ifc`, 'workspace/requirements.ids', '--json'], { encoding: 'utf8', maxBuffer: 64e6, stdio: ['ignore', 'pipe', 'ignore'] })); }
catch (e) { ids = JSON.parse(e.stdout); } // exit 1 = some specification failed
const idsSummary = [];
for (const s of ids.report.specificationResults) {
  const sid = s.specification.identifier ?? s.specification.name.split(' ')[0];
  const req = brief.requirements.find((r) => r.id === sid) ?? {};
  const res = s.entityResults ?? [];
  idsSummary.push({ id: sid, status: s.status, applicable: res.length, failed: res.filter((e) => !e.passed).length });
  if (s.status === 'fail' && res.length === 0) add(sid, 'ERROR', `${sid}: keine passenden Bauteile im Modell`, `${req.text} – im Modell gibt es kein Bauteil, auf das die Anforderung zutrifft.`, [], { discipline: 'IDS', source: req.source, who: req.who });
  for (const e of res.filter((e) => !e.passed)) {
    const key = guidToKey[e.globalId] ?? e.entityName;
    const why = e.requirementResults.filter((r) => r.status !== 'pass').map((r) => r.failureReason ?? r.checkedDescription).join('; ');
    add(sid, 'ERROR', `${sid}: ${req.text}`, `${key}: ${why}`, [key], { discipline: 'IDS', source: req.source, who: req.who, evidence: why });
  }
}

// ── 2. Georeferencing (R09) ──────────────────────────────────────────────────
ran.push('Georeferenz (ifc-lite georef check)');
let geo;
try { geo = JSON.parse(execFileSync(bin, ['georef', 'check', `${base}.ifc`, '--json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })); } catch (e) { geo = JSON.parse(e.stdout || '{}'); }
const crsName = JSON.stringify(geo).match(/EPSG:\d+/)?.[0];
if (crsName !== 'EPSG:2056') add('R09', 'ERROR', 'R09: Modell nicht in EPSG:2056 georeferenziert', `Gefunden: ${crsName ?? 'keine Georeferenz'}`, [], { discipline: 'IDS', source: 'Projekt-AIA' });
for (const f of geo.findings ?? []) if (f.severity === 'error') add('R09', 'ERROR', `R09: Georeferenz – ${f.code}`, f.message ?? f.code, [], { discipline: 'IDS' });

// ── 3. Footprint and zoning (BZO 2016 Art. 13/14) ────────────────────────────
ran.push('Zonenordnung W3 (Geschosse, Höhe, Grenzabstand inkl. Mehrlängenzuschlag, Ausnützung)');
const ground = storeys[0];
const extWalls = (D.walls ?? []).filter((w) => w.storey === ground.key && w.type === 'external');
const all2d = extWalls.flatMap((w) => [w.start, w.end]);
const cx = all2d.reduce((s, p) => s + p[0], 0) / (all2d.length || 1), cy = all2d.reduce((s, p) => s + p[1], 0) / (all2d.length || 1);
// outer face of each external wall: shift the axis by half the thickness away from the footprint centre
const facades = extWalls.map((w) => {
  const dx = w.end[0] - w.start[0], dy = w.end[1] - w.start[1], L = Math.hypot(dx, dy); let nx = -dy / L, ny = dx / L;
  const mx = (w.start[0] + w.end[0]) / 2, my = (w.start[1] + w.end[1]) / 2; if ((mx - cx) * nx + (my - cy) * ny < 0) { nx = -nx; ny = -ny; }
  const o = w.thickness / 2; return { key: w.key, a: [w.start[0] + nx * o, w.start[1] + ny * o], b: [w.end[0] + nx * o, w.end[1] + ny * o], n: [nx, ny], L };
});
// merge collinear facade segments into facade lines (for the length surcharge)
const lines = [];
for (const f of facades) {
  const ln = lines.find((l) => Math.abs(l.n[0] * f.n[0] + l.n[1] * f.n[1] - 1) < 1e-3 && Math.abs((f.a[0] - l.a[0]) * l.n[0] + (f.a[1] - l.a[1]) * l.n[1]) < 0.05);
  if (ln) { ln.keys.push(f.key); ln.segs.push(f); } else lines.push({ n: f.n, a: f.a, keys: [f.key], segs: [f] });
}
const parcel = site.parcel.polygonLocal;
const corners = facades.flatMap((f) => [f.a, f.b]);
const outside = corners.filter((p) => !inPoly(p, parcel));
if (outside.length) add('Z0', 'ERROR', 'Gebäude ragt über die Parzellengrenze', `${outside.length} Fassadenecken liegen ausserhalb der Parzelle ${site.parcel.egrid}.`, extWalls.map((w) => w.key), { discipline: 'Zonenordnung', source: Z.source });
const boundaryPts = [];
for (let i = 0; i < parcel.length - 1; i++) { const a = parcel[i], b = parcel[i + 1], n = Math.max(1, Math.ceil(len(a, b) / 0.25)); for (let k = 0; k < n; k++) boundaryPts.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]); }
{ let dmin = Infinity, near = null; for (const f of facades) for (let i = 0; i < parcel.length - 1; i++) { const d = segSeg(f.a, f.b, parcel[i], parcel[i + 1]); if (d < dmin) { dmin = d; near = f.key; } }
  if (dmin < Z.minBoundaryDistance_m - 0.01) add('Z3a', 'ERROR', 'Grundgrenzabstand 5 m unterschritten', `Kürzester Abstand Fassade–Parzellengrenze ${r2(dmin)} m, verlangt ${Z.minBoundaryDistance_m} m.`, [near], { discipline: 'Zonenordnung', source: Z.source }); }
for (const l of lines) {
  // facade length along the line
  const t = l.segs.flatMap((s) => [s.a, s.b]).map((p) => p[0] * -l.n[1] + p[1] * l.n[0]);
  const Lf = Math.max(...t) - Math.min(...t);
  const req = Math.min(Z.minBoundaryDistance_m + Math.max(0, Lf - Z.lengthSurcharge.facadeOver_m) * Z.lengthSurcharge.factor, Z.lengthSurcharge.maxDistance_m);
  // distance to the boundary IN FRONT of this facade (45° sector on each side) – BZO measures the
  // surcharge for the facade facing the boundary; the plain shortest distance is checked separately (Z3a)
  let dmin = Infinity;
  for (const s of l.segs) {
    const tx = s.b[0] - s.a[0], ty = s.b[1] - s.a[1], L = Math.hypot(tx, ty), ux = tx / L, uy = ty / L;
    for (const p of boundaryPts) {
      const qx = p[0] - s.a[0], qy = p[1] - s.a[1], dn = qx * l.n[0] + qy * l.n[1]; if (dn <= 0) continue;
      const sp = qx * ux + qy * uy; if (sp < -dn || sp > L + dn) continue;
      dmin = Math.min(dmin, segDist(p, s.a, s.b));
    }
  }
  const dir = Math.abs(l.n[0]) > Math.abs(l.n[1]) ? (l.n[0] > 0 ? 'Ost' : 'West') : (l.n[1] > 0 ? 'Nord' : 'Süd');
  l.result = { facade: dir, length: r2(Lf), required: r2(req), actual: r2(dmin) };
  if (dmin < req - 0.01) add('Z3', 'ERROR', `Grenzabstand Fassade ${dir} zu klein`, `Fassade ${dir}, Länge ${r2(Lf)} m: Abstand zur Parzellengrenze ${r2(dmin)} m, verlangt ${r2(req)} m (5 m + Mehrlängenzuschlag ⅓ über 12 m, max. 10 m; gemessen zur Grenze vor der Fassade, 45°-Sektor – Näherung, Planer prüft).`, l.keys, { discipline: 'Zonenordnung', source: `${Z.source}; ${Z.lengthSurcharge.source}`, evidence: l.result });
}
const fullStoreys = storeys.filter((s) => !s.kind || s.kind === 'full').length;
if (fullStoreys > Z.maxFullStoreys) add('Z1', 'ERROR', 'Zu viele Vollgeschosse', `${fullStoreys} Vollgeschosse, zulässig ${Z.maxFullStoreys} (W3).`, storeys.map((s) => s.key), { discipline: 'Zonenordnung', source: Z.source });
const replaced = site.existingBuildings.find((b) => b.toBeReplaced);
const terrain = replaced?.terrain ?? site.origin.height;
const floorAbove = site.origin.height + ground.elevation - terrain;
if (floorAbove > Z.maxFloorAboveGround_m) add('Z5', 'ERROR', 'Erdgeschoss zu hoch über gewachsenem Boden', `OK fertiger Boden EG ${r2(site.origin.height + ground.elevation)} m ü.M., Terrain ${r2(terrain)} m ü.M. → ${r2(floorAbove)} m (max. ${Z.maxFloorAboveGround_m} m).`, [ground.key], { discipline: 'Zonenordnung', source: Z.source });
const top = storeys.at(-1); const roofTop = top.elevation + top.height;
const height = roofTop + site.origin.height - terrain;
if (height > Z.maxBuildingHeight_m + 0.01) add('Z2', 'ERROR', 'Gebäudehöhe überschritten', `Oberkante Dach ${r2(roofTop)} m über ±0.00, Terrain ${r2(terrain)} m ü.M. → Gebäudehöhe ca. ${r2(height)} m, zulässig ${Z.maxBuildingHeight_m} m. Vereinfachung: Dachoberkante statt Schnittlinie Fassade/Dach.`, slabsOf(top.key, 'roof').map((s) => s.key), { discipline: 'Zonenordnung', source: Z.source });
const gfa = storeys.reduce((s, st) => s + Math.max(0, ...[...slabsOf(st.key, 'floor'), ...slabsOf(st.key, 'base')].map((x) => area(x.polygon))), 0);
const azShare = gfa / (site.parcel.registeredArea ?? site.parcel.computedArea);
// neighbours that stay
for (const b of site.existingBuildings.filter((b) => !b.toBeReplaced)) {
  const [x0, y0, x1, y1] = b.bboxLocal; const box = [[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]];
  if (Math.max(x0, x1) < -80 || Math.min(x0, x1) > 80 || Math.max(y0, y1) < -80 || Math.min(y0, y1) > 80) continue;
  let dmin = Infinity, near = null;
  for (const f of facades) for (let i = 0; i < 4; i++) { const d = segSeg(f.a, f.b, box[i], box[i + 1]); if (d < dmin) { dmin = d; near = f.key; } }
  if (dmin < Z.neighbourDistance_m) add('Z6', 'WARNING', `Abstand zu Bestandesbau EGID ${b.egid} gering`, `${r2(dmin)} m zum Hüllrechteck von EGID ${b.egid} (Projektannahme ${Z.neighbourDistance_m} m, Holzfassade). ${Z.neighbourDistanceNote}.`, [near], { discipline: 'Brandschutz', source: 'Projektannahme', evidence: { egid: b.egid, distance: r2(dmin) } });
}

// ── 4. Program, rooms, daylight ──────────────────────────────────────────────
ran.push('Raumprogramm (Wohnungen, Raumgrössen, lichte Höhe, Belichtung)');
const spaces = D.spaces ?? [];
const units = [...new Set(spaces.map((s) => s.unit).filter((u) => u && u !== '-'))];
if (units.length !== PR.units) add('P4', 'WARNING', `Anzahl Wohnungen ${units.length} statt ${PR.units}`, `Gefundene Wohnungen: ${units.join(', ') || 'keine'}.`, [], { discipline: 'Architektur', source: 'Raumprogramm Bauherrschaft' });
const living = new Set(['Wohnen', 'Zimmer', 'Wohnen/Essen', 'Wohnen/Kochen', 'Essen', 'Kochen/Essen']);
for (const sp of spaces) {
  const A = area(sp.polygon);
  if (sp.usage === 'Zimmer' && A < PR.minRoomArea_m2) add('P1', 'WARNING', `Zimmer ${sp.key} kleiner als ${PR.minRoomArea_m2} m²`, `${r2(A)} m².`, [sp.key], { discipline: 'Architektur', source: 'Raumprogramm' });
  if (living.has(sp.usage)) {
    const win = (D.openings ?? []).filter((o) => o.kind === 'window' && o.space === sp.key).reduce((s, o) => s + o.width * o.height, 0);
    if (win / A < PR.minWindowFloorRatio) add('P2', 'ERROR', `Belichtung ${sp.key} ungenügend`, `Fensterfläche ${r2(win)} m² für ${r2(A)} m² Bodenfläche = ${r2(100 * win / A)} %, verlangt ${100 * PR.minWindowFloorRatio} %. (Fenster werden über das Feld "space" dem Raum zugeordnet.)`, [sp.key, ...(D.openings ?? []).filter((o) => o.space === sp.key).map((o) => o.key)], { discipline: 'Architektur', source: 'Projektanforderung (Belichtung ≥ 1/10 der Bodenfläche)' });
  }
  const clear = S[sp.storey].height - slabAbove(sp.storey);
  if (clear < PR.minClearHeight_m) add('P3', 'ERROR', `Lichte Höhe ${sp.key} zu gering`, `${r2(clear)} m < ${PR.minClearHeight_m} m.`, [sp.key], { discipline: 'Architektur', source: 'Projektanforderung' });
  const c = sp.polygon.reduce((s, p) => [s[0] + p[0] / sp.polygon.length, s[1] + p[1] / sp.polygon.length], [0, 0]);
  if (sp.storey === ground.key && corners.length && !inPoly(c, [...facades.map((f) => f.a)].sort((p, q) => Math.atan2(p[1] - cy, p[0] - cx) - Math.atan2(q[1] - cy, q[0] - cx)))) add('G2', 'ERROR', `Raum ${sp.key} liegt ausserhalb der Gebäudehülle`, 'Raumschwerpunkt ausserhalb des Fussabdrucks.', [sp.key], { discipline: 'Geometrie' });
}

// ── 5. Fire safety (escape, stairs, compartments) ────────────────────────────
ran.push('Brandschutz (Treppe, Fluchtweg, Wohnungstüren)');
const stairs = D.stairs ?? [];
for (const st of storeys.slice(0, -1)) if (!stairs.some((t) => t.storey === st.key)) add('F3', 'ERROR', `Keine Treppe ab ${st.key}`, 'Jedes Geschoss ausser dem obersten braucht einen Treppenlauf zum nächsten Geschoss.', [st.key], { discipline: 'Brandschutz' });
for (const t of stairs) {
  if (t.width < 1.2) add('F2', 'ERROR', `Treppe ${t.key} zu schmal`, `Laufbreite ${t.width} m < 1.20 m.`, [t.key], { discipline: 'Brandschutz', source: 'VKF 16-15 Flucht- und Rettungswege (Projektannahme 1.20 m)' });
  const rise = t.risers * t.riserHeight, h = S[t.storey].height;
  if (Math.abs(rise - h) > 0.02) add('F4', 'ERROR', `Treppe ${t.key} erreicht das nächste Geschoss nicht`, `${t.risers} × ${t.riserHeight} m = ${r2(rise)} m, Geschosshöhe ${h} m.`, [t.key], { discipline: 'Brandschutz' });
  const blondel = 2 * t.riserHeight + t.tread;
  if (blondel < 0.59 || blondel > 0.65) add('F5', 'WARNING', `Treppe ${t.key}: Schrittmass ${r2(blondel)} m`, 'Schrittmassregel 2h + a = 0.59–0.65 m.', [t.key], { discipline: 'Architektur' });
}
for (const u of units) {
  const us = spaces.filter((s) => s.unit === u);
  const doors = (D.openings ?? []).filter((o) => o.kind === 'door' && o.reference === 'Wohnungstuer' && o.unit === u);
  if (!doors.length) { add('F1', 'ERROR', `Wohnung ${u} ohne Wohnungstür zum Treppenhaus`, 'Keine Tür mit reference "Wohnungstuer" und unit = Wohnung.', us.map((s) => s.key), { discipline: 'Brandschutz' }); continue; }
  const d = doors[0]; const w = (D.walls ?? []).find((w) => w.key === d.wall);
  const L = len(w.start, w.end), t = (d.offset + d.width / 2) / L; const dp = [w.start[0] + (w.end[0] - w.start[0]) * t, w.start[1] + (w.end[1] - w.start[1]) * t];
  const far = Math.max(...us.flatMap((s) => s.polygon.map((p) => Math.abs(p[0] - dp[0]) + Math.abs(p[1] - dp[1]))));
  if (far > 35) add('F6', 'WARNING', `Fluchtweg Wohnung ${u} lang`, `Weitester Punkt ca. ${r2(far)} m (Manhattan-Distanz) bis zur Wohnungstür, Projektannahme 35 m.`, [d.key], { discipline: 'Brandschutz' });
}

// ── 6. Envelope ──────────────────────────────────────────────────────────────
ran.push('Gebäudehülle (Dach, Bodenplatte, Fensteranteil)');
for (const s of D.slabs ?? []) {
  if (s.kind === 'roof' && !(s.uValue <= 0.17)) add('E1', 'ERROR', `Dach ${s.key}: U-Wert fehlt oder > 0.17`, `U = ${s.uValue ?? 'fehlt'} W/m²K.`, [s.key], { discipline: 'Energie', source: 'SIA 380/1 (Projektwert)' });
  if (s.kind === 'base' && !(s.uValue <= 0.25)) add('E2', 'WARNING', `Bodenplatte ${s.key}: U-Wert fehlt oder > 0.25`, `U = ${s.uValue ?? 'fehlt'} W/m²K.`, [s.key], { discipline: 'Energie', source: 'SIA 380/1 (Projektwert gegen Erdreich)' });
}
const wwr = {};
for (const w of (D.walls ?? []).filter((w) => w.type === 'external')) {
  const dx = w.end[0] - w.start[0], dy = w.end[1] - w.start[1], L = Math.hypot(dx, dy); let nx = -dy / L, ny = dx / L;
  if (((w.start[0] + w.end[0]) / 2 - cx) * nx + ((w.start[1] + w.end[1]) / 2 - cy) * ny < 0) { nx = -nx; ny = -ny; }
  const dir = Math.abs(nx) > Math.abs(ny) ? (nx > 0 ? 'Ost' : 'West') : (ny > 0 ? 'Nord' : 'Süd');
  const o = (wwr[dir] ??= { wallArea: 0, openingArea: 0 });
  o.wallArea += L * S[w.storey].height;
  o.openingArea += (D.openings ?? []).filter((x) => x.wall === w.key).reduce((s, x) => s + x.width * x.height, 0);
}
for (const o of Object.values(wwr)) { o.ratio = r2(o.openingArea / o.wallArea); o.wallArea = r2(o.wallArea); o.openingArea = r2(o.openingArea); }

const metrics = { version: v, grossFloorArea: r2(gfa), floorAreaRatioThisBuilding: r2(azShare), parcelArea: site.parcel.registeredArea, units: units.length, fullStoreys, buildingHeight: r2(height), floorAboveTerrain: r2(floorAbove), facades: lines.map((l) => l.result), windowWallRatio: wwr, ids: idsSummary, elements: Object.keys(K).length };
const counts = { ERROR: 0, WARNING: 0, INFO: 0 }; findings.forEach((f) => counts[f.severity]++);
writeFileSync(`workspace/checks_v${v}.json`, JSON.stringify({ version: v, ran, counts, metrics, findings }, null, 1));
console.log(JSON.stringify({ ok: true, counts, ids: idsSummary.map((s) => `${s.id}:${s.status}`).join(' ') }));
