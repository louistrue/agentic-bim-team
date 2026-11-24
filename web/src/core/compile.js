// Deterministic design compiler (browser + Node): design intent JSON → IFC4 text, EPSG:2056 georeferenced.
// Port of scripts/compile.mjs. The LLM decides WHAT is built; this decides HOW it is written:
// GlobalId = f(design key), storeys stack by construction, quantities computed, nothing silently fixed.
import { IfcCreator } from '@ifc-lite/create';
import { stableGuid } from './guid.js';

export function compileDesign(D, { fileName = 'design.ifc' } = {}) {
  if (!D || typeof D !== 'object') return { ok: false, problems: [{ key: '?', msg: 'design is not an object' }] };
  for (const k of ['storeys', 'walls']) if (!Array.isArray(D[k]) || !D[k].length) return { ok: false, problems: [{ key: '?', msg: `design.${k} missing or empty. The generator returned an object with keys [${Object.keys(D).join(', ')}]${D[k] !== undefined ? ` and ${k} = ${JSON.stringify(D[k]).slice(0, 120)}` : ''}. Return the design object itself (not wrapped), with non-empty storeys and walls arrays.` }] };
  // ── validation ──────────────────────────────────────────────────────────────
  const problems = [];
  const P = (key, msg) => problems.push({ key, msg });
  const keys = new Set();
  const all = [...(D.storeys ?? []), ...(D.walls ?? []), ...(D.openings ?? []), ...(D.slabs ?? []), ...(D.columns ?? []), ...(D.stairs ?? []), ...(D.spaces ?? []), ...(D.footings ?? [])];
  for (const e of all) {
    if (!e.key || !/^[A-Za-z0-9._-]+$/.test(e.key)) P(e.key ?? '?', 'key missing or not [A-Za-z0-9._-]');
    else if (keys.has(e.key)) P(e.key, 'duplicate key'); else keys.add(e.key);
  }
  const storeys = [...(D.storeys ?? [])].sort((a, b) => a.elevation - b.elevation);
  const S = Object.fromEntries(storeys.map((s, i) => [s.key, { ...s, index: i }]));
  for (let i = 1; i < storeys.length; i++) {
    const gap = storeys[i].elevation - (storeys[i - 1].elevation + storeys[i - 1].height);
    if (Math.abs(gap) > 0.001) P(storeys[i].key, `storey elevation ${storeys[i].elevation} ≠ ${storeys[i - 1].key}.elevation + height (${(storeys[i - 1].elevation + storeys[i - 1].height).toFixed(3)}); storeys must stack without gaps`);
  }
  const W = Object.fromEntries((D.walls ?? []).map((w) => [w.key, w]));
  const len = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
  for (const w of D.walls ?? []) {
    if (!S[w.storey]) P(w.key, `unknown storey ${w.storey}`);
    if (!(w.thickness > 0.05 && w.thickness < 1)) P(w.key, `thickness ${w.thickness} m implausible`);
    if (len(w.start, w.end) < 0.3) P(w.key, 'wall shorter than 0.3 m');
  }
  for (const o of D.openings ?? []) {
    const w = W[o.wall];
    if (!w) { P(o.key, `host wall ${o.wall} not found`); continue; }
    const L = len(w.start, w.end);
    if (o.offset < 0.1 || o.offset + o.width > L - 0.1) P(o.key, `opening [${o.offset}, ${o.offset + o.width}] m does not fit in wall ${o.wall} (length ${L.toFixed(2)} m, 0.1 m edge distance)`);
    const st = S[w.storey];
    if (st && (o.sill ?? 0) + o.height > st.height - 0.35) P(o.key, `opening top ${((o.sill ?? 0) + o.height).toFixed(2)} m too close to storey height ${st.height} m`);
  }
  for (const x of [...(D.slabs ?? []), ...(D.spaces ?? []), ...(D.stairs ?? []), ...(D.columns ?? [])]) if (!S[x.storey]) P(x.key, `unknown storey ${x.storey}`);
  for (const o of D.openings ?? []) for (const p of D.openings ?? []) {
    if (o.key < p.key && o.wall === p.wall && o.offset < p.offset + p.width && p.offset < o.offset + o.width) P(o.key, `overlaps opening ${p.key} in wall ${o.wall}`);
  }
  if (problems.length) return { ok: false, problems };

  // ── geometry helpers ────────────────────────────────────────────────────────
  const area = (poly) => Math.abs(poly.reduce((s, p, i) => { const q = poly[(i + 1) % poly.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0)) / 2;
  const perim = (poly) => poly.reduce((s, p, i) => s + len(p, poly[(i + 1) % poly.length]), 0);
  const r3 = (x) => Math.round(x * 1000) / 1000;
  // thickness of the slab directly above a storey (floor slab of the next storey, or the roof of this one)
  const slabAbove = (st) => {
    const next = storeys[S[st].index + 1];
    const cand = (D.slabs ?? []).filter((s) => (next && s.storey === next.key && s.kind === 'floor') || (s.storey === st && s.kind === 'roof'));
    return cand.length ? Math.max(...cand.map((s) => s.thickness)) : 0;
  };

  // ── stable GlobalIds: every GUID is derived from the key currently being written ──
  let cur = '__project', n = 0;
  const at = (key) => { cur = key; n = 0; };
  const c = new IfcCreator({
    Name: D.name ?? 'Projekt', Schema: 'IFC4', Author: 'agentic-bim-team', Organization: 'BFH Minor BXMid03 · Demo',
    FileName: fileName, Timestamp: Date.parse('2026-11-24T08:00:00Z'),
    GuidSource: () => stableGuid(`${cur}#${n++}`),
  });
  const ids = {}; // key → expressId
  const psets = (id, key, list) => list.filter(Boolean).forEach((ps, i) => { at(`${key}/pset/${ps.Name}`); c.addIfcPropertySet(id, { Name: ps.Name, Properties: ps.Properties.filter((p) => p.NominalValue !== undefined && p.NominalValue !== null) }); });
  const qto = (id, key, name, q) => { at(`${key}/qto`); c.addIfcElementQuantity(id, { Name: name, Quantities: q.map(([Name, Value, k]) => ({ Name, Value: r3(Value), Kind: { L: 'IfcQuantityLength', A: 'IfcQuantityArea', V: 'IfcQuantityVolume', C: 'IfcQuantityCount' }[k] })) }); };
  const project = (id, key, props) => psets(id, key, [{ Name: 'BIM_Projekt', Properties: Object.entries(props).map(([Name, NominalValue]) => ({ Name, NominalValue })) }]);
  const material = (id, key, m) => { if (!m) return; at(`${key}/mat`); c.addIfcMaterial(id, typeof m === 'string' ? { Name: m } : m); };

  // storeys
  for (const s of storeys) { at(s.key); ids[s.key] = c.addIfcBuildingStorey({ Name: s.name ?? s.key, Elevation: s.elevation }); }

  // walls: base at storey floor, top under the slab above
  const openingsByWall = {};
  for (const o of D.openings ?? []) (openingsByWall[o.wall] ??= []).push(o);
  for (const w of D.walls ?? []) {
    const st = S[w.storey]; const h = r3(st.height - slabAbove(w.storey));
    at(w.key);
    const id = c.addIfcWall(ids[w.storey], { Name: w.name ?? w.key, Tag: w.key, ObjectType: w.type, Start: [w.start[0], w.start[1], 0], End: [w.end[0], w.end[1], 0], Thickness: w.thickness, Height: h,
      PredefinedType: w.type === 'partition' ? 'PARTITIONING' : w.loadBearing ? 'SOLIDWALL' : 'NOTDEFINED' });
    ids[w.key] = id;
    const L = len(w.start, w.end); const holes = (openingsByWall[w.key] ?? []).reduce((s, o) => s + o.width * o.height, 0);
    psets(id, w.key, [{ Name: 'Pset_WallCommon', Properties: [
      { Name: 'Reference', NominalValue: w.reference ?? w.type }, { Name: 'IsExternal', NominalValue: w.type === 'external' },
      { Name: 'LoadBearing', NominalValue: !!w.loadBearing }, { Name: 'FireRating', NominalValue: w.fireRating },
      w.uValue != null ? { Name: 'ThermalTransmittance', NominalValue: w.uValue, Type: 'IfcThermalTransmittanceMeasure' } : null,
      w.acousticRating ? { Name: 'AcousticRating', NominalValue: w.acousticRating } : null].filter(Boolean) }]);
    qto(id, w.key, 'Qto_WallBaseQuantities', [['Length', L, 'L'], ['Height', h, 'L'], ['Width', w.thickness, 'L'], ['GrossSideArea', L * h, 'A'], ['NetSideArea', L * h - holes, 'A'], ['GrossVolume', L * h * w.thickness, 'V'], ['NetVolume', (L * h - holes) * w.thickness, 'V']]);
    material(id, w.key, w.material);
    project(id, w.key, { DesignKey: w.key, Kategorie: w.type, ...(w.unitA ? { Wohnung_A: w.unitA } : {}), ...(w.unitB ? { Wohnung_B: w.unitB } : {}) });
  }

  // openings (hosted windows / doors)
  for (const o of D.openings ?? []) {
    const w = W[o.wall]; at(o.key);
    const common = { Name: o.name ?? o.key, Tag: o.key, Position: [o.offset + o.width / 2, 0, o.sill ?? 0], Width: o.width, Height: o.height };
    const id = o.kind === 'door' ? c.addIfcWallDoor(ids[o.wall], { ...common, OperationType: o.operation ?? 'SINGLE_SWING_LEFT' }) : c.addIfcWallWindow(ids[o.wall], common);
    ids[o.key] = id;
    const ext = w.type === 'external';
    psets(id, o.key, [{ Name: o.kind === 'door' ? 'Pset_DoorCommon' : 'Pset_WindowCommon', Properties: [
      { Name: 'Reference', NominalValue: o.reference ?? o.kind }, { Name: 'IsExternal', NominalValue: ext },
      { Name: 'FireRating', NominalValue: o.fireRating },
      o.uValue != null ? { Name: 'ThermalTransmittance', NominalValue: o.uValue, Type: 'IfcThermalTransmittanceMeasure' } : null,
      o.gValue != null && o.kind !== 'door' ? { Name: 'SolarHeatGainTransmittance', NominalValue: o.gValue, Type: 'IfcNormalisedRatioMeasure' } : null,
      o.kind === 'door' && o.selfClosing != null ? { Name: 'SelfClosing', NominalValue: !!o.selfClosing } : null].filter(Boolean) }]);
    qto(id, o.key, o.kind === 'door' ? 'Qto_DoorBaseQuantities' : 'Qto_WindowBaseQuantities', [['Width', o.width, 'L'], ['Height', o.height, 'L'], ['Area', o.width * o.height, 'A']]);
    project(id, o.key, { DesignKey: o.key, HostWall: o.wall, ...(o.space ? { Raum: o.space } : {}) });
  }

  // slabs: floor slab of storey s spans [elev-t, elev]; roof of storey s spans [elev+height-t, elev+height]
  for (const s of D.slabs ?? []) {
    const st = S[s.storey]; const z = s.kind === 'roof' ? st.height - s.thickness : -s.thickness;
    at(s.key);
    const id = c.addIfcSlab(ids[s.storey], { Name: s.name ?? s.key, Tag: s.key, Position: [0, 0, z], Thickness: s.thickness, Profile: s.polygon,
      Openings: (s.openings ?? []).map((h, i) => ({ Name: `${s.key}-O${i + 1}`, Width: h.w, Height: h.d, Position: [h.x + h.w / 2, h.y + h.d / 2, 0] })),
      PredefinedType: s.kind === 'roof' ? 'ROOF' : s.kind === 'base' ? 'BASESLAB' : 'FLOOR' });
    ids[s.key] = id;
    const A = area(s.polygon) - (s.openings ?? []).reduce((a, h) => a + h.w * h.d, 0);
    psets(id, s.key, [{ Name: 'Pset_SlabCommon', Properties: [
      { Name: 'Reference', NominalValue: s.kind }, { Name: 'IsExternal', NominalValue: s.kind === 'roof' || s.kind === 'base' },
      { Name: 'LoadBearing', NominalValue: true }, { Name: 'FireRating', NominalValue: s.fireRating },
      s.uValue != null ? { Name: 'ThermalTransmittance', NominalValue: s.uValue, Type: 'IfcThermalTransmittanceMeasure' } : null].filter(Boolean) }]);
    qto(id, s.key, 'Qto_SlabBaseQuantities', [['Width', s.thickness, 'L'], ['Perimeter', perim(s.polygon), 'L'], ['GrossArea', area(s.polygon), 'A'], ['NetArea', A, 'A'], ['GrossVolume', area(s.polygon) * s.thickness, 'V'], ['NetVolume', A * s.thickness, 'V']]);
    material(id, s.key, s.material);
    project(id, s.key, { DesignKey: s.key, Kategorie: s.kind });
  }

  for (const col of D.columns ?? []) {
    const h = r3(S[col.storey].height - slabAbove(col.storey)); at(col.key);
    const id = c.addIfcColumn(ids[col.storey], { Name: col.name ?? col.key, Tag: col.key, Position: [col.position[0] - col.width / 2, col.position[1] - col.depth / 2, 0], Width: col.width, Depth: col.depth, Height: h });
    ids[col.key] = id;
    psets(id, col.key, [{ Name: 'Pset_ColumnCommon', Properties: [{ Name: 'LoadBearing', NominalValue: true }, { Name: 'FireRating', NominalValue: col.fireRating }, { Name: 'IsExternal', NominalValue: false }] }]);
    qto(id, col.key, 'Qto_ColumnBaseQuantities', [['Length', h, 'L'], ['CrossSectionArea', col.width * col.depth, 'A'], ['GrossVolume', col.width * col.depth * h, 'V']]);
    material(id, col.key, col.material);
    project(id, col.key, { DesignKey: col.key });
  }

  for (const t of D.stairs ?? []) {
    at(t.key);
    const id = c.addIfcStair(ids[t.storey], { Name: t.name ?? t.key, Tag: t.key, Position: [t.position[0], t.position[1], 0], Direction: (t.directionDeg ?? 0) * Math.PI / 180, NumberOfRisers: t.risers, RiserHeight: t.riserHeight, TreadLength: t.tread, Width: t.width });
    ids[t.key] = id;
    psets(id, t.key, [{ Name: 'Pset_StairCommon', Properties: [{ Name: 'NumberOfRiser', NominalValue: t.risers, Type: 'IfcCountMeasure' }, { Name: 'RiserHeight', NominalValue: t.riserHeight, Type: 'IfcPositiveLengthMeasure' }, { Name: 'TreadLength', NominalValue: t.tread, Type: 'IfcPositiveLengthMeasure' }, { Name: 'FireExit', NominalValue: true }, { Name: 'FireRating', NominalValue: t.fireRating }] }]);
    project(id, t.key, { DesignKey: t.key, Laufbreite: t.width });
  }

  for (const sp of D.spaces ?? []) {
    const h = r3(S[sp.storey].height - slabAbove(sp.storey)); at(sp.key);
    const id = c.addIfcSpace(ids[sp.storey], { Name: sp.name ?? sp.key, LongName: sp.longName ?? sp.usage, Tag: sp.key, Position: [0, 0, 0], Profile: sp.polygon, Height: h });
    ids[sp.key] = id;
    const A = area(sp.polygon);
    psets(id, sp.key, [{ Name: 'Pset_SpaceCommon', Properties: [{ Name: 'Reference', NominalValue: sp.usage }, { Name: 'IsExternal', NominalValue: false }] }]);
    qto(id, sp.key, 'Qto_SpaceBaseQuantities', [['NetFloorArea', A, 'A'], ['GrossFloorArea', A, 'A'], ['Height', h, 'L'], ['NetVolume', A * h, 'V'], ['NetPerimeter', perim(sp.polygon), 'L']]);
    project(id, sp.key, { DesignKey: sp.key, Wohnung: sp.unit ?? '-', Nutzung: sp.usage, SIA416: sp.sia416 ?? (sp.usage === 'Treppenhaus' ? 'VF' : sp.usage === 'Technik' ? 'FF' : 'HNF') });
  }

  for (const f of D.footings ?? []) {
    at(f.key);
    const id = c.addIfcFooting(ids[f.storey], { Name: f.name ?? f.key, Tag: f.key, Position: [f.position[0], f.position[1], 0], Width: f.width, Depth: f.depth, Height: f.height, PredefinedType: f.type ?? 'STRIP_FOOTING' });
    ids[f.key] = id;
    project(id, f.key, { DesignKey: f.key });
  }

  // building-level quantities and project facts
  at('__building');
  const gfa = (D.spaces ?? []).length ? storeys.reduce((s, st) => s + Math.max(0, ...((D.slabs ?? []).filter((x) => x.storey === st.key && (x.kind === 'floor' || x.kind === 'base')).map((x) => area(x.polygon)))), 0) : 0;
  if (c.buildingId) {
    qto(c.buildingId, '__building', 'Qto_BuildingBaseQuantities', [['GrossFloorArea', gfa, 'A'], ['Height', storeys.at(-1).elevation + storeys.at(-1).height - storeys[0].elevation, 'L']]);
    psets(c.buildingId, '__building', [{ Name: 'Pset_BuildingCommon', Properties: [{ Name: 'NumberOfStoreys', NominalValue: storeys.length, Type: 'IfcInteger' }, { Name: 'Reference', NominalValue: D.reference ?? 'Ersatzneubau' }] }]);
  }

  at('__rels');
  let { content } = c.toIfc();
  // georeference (EPSG:2056 / LN02): IfcProjectedCRS + IfcMapConversion on the 3D model context.
  // (IfcCreator.terrain().setGeoreferencing is IFC4X3-only; IFC4 has both entities, so write them here.)
  const g = D.placement;
  if (g) {
    const ctx = content.match(/^#(\d+)=\s*IFCGEOMETRICREPRESENTATIONCONTEXT\([^,]*,'Model',3/m)?.[1];
    const unit = content.match(/^#(\d+)=\s*IFCSIUNIT\(\*,\.LENGTHUNIT\.,\$,\.METRE\.\)/m)?.[1];
    const max = Math.max(...[...content.matchAll(/^#(\d+)=/gm)].map((m) => Number(m[1])));
    const r = ((g.rotationDeg ?? 0) * Math.PI) / 180, f = (x) => (Number.isInteger(x) ? `${x}.` : String(x));
    if (ctx && unit) content = content.replace(/^ENDSEC;\s*\nEND-ISO-10303-21;/m, `#${max + 1}=IFCPROJECTEDCRS('EPSG:2056','CH1903+ / LV95','CH1903+','LN02',$,$,#${unit});\n#${max + 2}=IFCMAPCONVERSION(#${ctx},#${max + 1},${f(g.eastings)},${f(g.northings)},${f(g.height)},${f(Math.round(Math.cos(r) * 1e9) / 1e9)},${f(Math.round(Math.sin(r) * 1e9) / 1e9)},1.);\nENDSEC;\nEND-ISO-10303-21;`);
  }
  const guidOf = Object.fromEntries([...content.matchAll(/^#(\d+)=\s*(IFC[A-Z]+)\('([^']{22})'/gm)].map((m) => [Number(m[1]), { type: m[2], guid: m[3] }]));
  const keyIndex = Object.fromEntries(Object.entries(ids).map(([k, id]) => [k, { guid: guidOf[id]?.guid, type: guidOf[id]?.type }]));
  return { ok: true, ifc: content, keys: keyIndex, elements: Object.keys(ids).length, grossFloorArea: r3(gfa) };
}
