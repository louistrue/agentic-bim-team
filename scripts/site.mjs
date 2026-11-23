#!/usr/bin/env node
// Deterministic site preparation (replaces the ifc-site / swiss-zoning-api services):
// address → geocode → parcel (EGRID) → ÖREB extract → existing buildings + terrain (ifc-lite site-context)
// → workspace/site.json + workspace/site_context.glb.
// Zoning numbers come from brief.json (BZO 2016 Art. 13, copied with source); the ÖREB extract decides
// which zone applies. Everything that cannot be checked automatically is listed under humanChecks.
//
// Usage: node scripts/site.mjs "Loorenstrasse 62, 8053 Zürich" brief.json
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createSwissGeodata } from '@ifc-lite/geodata-ch';

const [address, briefPath = 'brief.json'] = process.argv.slice(2);
const brief = JSON.parse(readFileSync(briefPath, 'utf8'));
mkdirSync('workspace', { recursive: true });
const geo = createSwissGeodata();
const bin = new URL('../node_modules/.bin/ifc-lite', import.meta.url).pathname;

const { candidates } = await geo.geocode(address);
if (!candidates.length) throw new Error(`address not found: ${address}`);
const hit = candidates[0];
const [parcel] = await geo.parcelsAtPoint(hit.x, hit.y);
if (!parcel) throw new Error('no parcel at address');

// ÖREB extract (official public-law restrictions)
let oereb = { status: 'unavailable', restrictions: [] };
try {
  const ex = await geo.oerebExtract(parcel.egrid);
  const res = await fetch(ex.urls.json);
  const j = await res.json();
  const E = j.GetExtractByIdResponse.Extract;
  const de = (x) => Array.isArray(x) ? (x.find((t) => t.Language === 'de') ?? x[0])?.Text : x;
  oereb = {
    status: 'ok', url: ex.urls.pdf, created: E.CreationDate, registeredArea: E.RealEstate.LandRegistryArea,
    restrictions: (E.RealEstate.RestrictionOnLandownership ?? []).map((r) => ({
      theme: de(r.Theme?.Text), legend: de(r.LegendText), typeCode: r.TypeCode, areaShare: r.AreaShare, lengthShare: r.LengthShare,
      documents: (r.LegalProvisions ?? []).slice(0, 2).map((d) => ({ title: de(d.Title), url: de(d.TextAtWeb) })),
    })),
  };
} catch (e) { oereb.error = String(e.message ?? e); }

// site context GLB (terrain, parcel, neighbouring buildings) and building extents from it
const glb = 'workspace/site_context.glb';
const sc = JSON.parse(execFileSync(bin, ['site-context', '--centre', `${hit.x},${hit.y}`, '--radius', '120', '--layers', 'terrain,parcel,buildings', '--out', glb, '--json'], { encoding: 'utf8', maxBuffer: 64e6 }));
const buildings = JSON.parse(execFileSync('python3', [new URL('./glb-buildings.py', import.meta.url).pathname, glb], { encoding: 'utf8', maxBuffer: 64e6 }));

// project origin: centre of the building to be replaced (or the address point), at the brief's ±0.00
const replaced = buildings.find((b) => b.egid && String(b.egid) === String(brief.site?.replaceEgid));
const ox = replaced ? Math.round((replaced.bbox[0] + replaced.bbox[2]) / 2) : Math.round(hit.x);
const oy = replaced ? Math.round((replaced.bbox[1] + replaced.bbox[3]) / 2) : Math.round(hit.y);
const groundAtReplaced = replaced?.terrain ?? null;
const oz = brief.site?.floorLevel ?? (groundAtReplaced != null ? Math.round(groundAtReplaced * 10) / 10 : 600);
const L = ([x, y]) => [Math.round((x - ox) * 100) / 100, Math.round((y - oy) * 100) / 100];
const ring = parcel.geometry.type === 'Polygon' ? parcel.geometry.coordinates[0] : parcel.geometry.coordinates[0][0];

const site = {
  address: hit.label, geocode: { e: hit.x, n: hit.y, source: 'geo.admin.ch SearchServer' },
  parcel: { egrid: parcel.egrid, number: parcel.number, municipality: 'Zürich', computedArea: Math.round(parcel.computedArea), registeredArea: oereb.registeredArea ?? null, polygonLocal: ring.map(L) },
  origin: { eastings: ox, northings: oy, height: oz, crs: 'EPSG:2056', verticalDatum: 'LN02', note: replaced ? `Mitte des Hüllrechtecks des Bestandesbaus EGID ${replaced.egid}` : 'Adresspunkt' },
  zoning: { ...brief.zoning, oereb },
  existingBuildings: buildings.filter((b) => b.type === 'IfcBuilding').map((b) => ({ egid: b.egid, name: b.name, height: b.height, terrain: b.terrain,
    bboxLocal: [...L([b.bbox[0], b.bbox[1]]), ...L([b.bbox[2], b.bbox[3]])], toBeReplaced: !!replaced && b.egid === replaced.egid })),
  siteContext: { file: glb, layers: sc.layers.map((l) => ({ kind: l.kind, features: l.features, attribution: l.attribution })), origin: sc.origin },
  humanChecks: [
    'Zonenwerte BZO 2016 Art. 13 gegen gültige Fassung und Quartierplan prüfen (Planer)',
    ...oereb.restrictions.filter((r) => !/Grundnutzung/.test(r.theme ?? '')).map((r) => `ÖREB: ${r.theme} – ${r.legend}`),
    'Hüllrechtecke der Nachbarbauten (swissBUILDINGS3D) sind Näherungen, keine Grundrisse',
  ],
};
writeFileSync('workspace/site.json', JSON.stringify(site, null, 1));
console.log(JSON.stringify({ ok: true, parcel: parcel.egrid, area: site.parcel.computedArea, zone: oereb.restrictions.find((r) => /Grundnutzung/.test(r.theme ?? ''))?.legend, neighbours: site.existingBuildings.length, origin: site.origin }));
