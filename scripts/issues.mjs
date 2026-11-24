#!/usr/bin/env node
// Issue ledger across versions → one BCF project (workspace/issues.bcf).
// A finding keeps its id (rule:element) across versions, so its BCF topic keeps its GUID:
//   new in vN → topic created (Open) · still there → comment "noch offen in vN" · gone → Closed with comment.
// Topics without at least one existing element are refused (never written as a topic).
// Usage: node scripts/issues.mjs N
import { readFileSync, writeFileSync, existsSync, copyFileSync } from 'node:fs';
import { createBCFProject, createBCFTopic, createBCFComment, addCommentToTopic, addTopicToProject, createViewpoint, addViewpointToTopic, updateTopicStatus, writeBCF, readBCF } from '@ifc-lite/bcf';
import { stableUuid, stableGuid } from '../lib/guid.mjs';

const v = Number(process.argv[2]);
const D = JSON.parse(readFileSync(`workspace/design_v${v}.json`, 'utf8'));
const K = JSON.parse(readFileSync(`workspace/design_v${v}.keys.json`, 'utf8'));
const checks = JSON.parse(readFileSync(`workspace/checks_v${v}.json`, 'utf8'));
const review = existsSync(`workspace/review_v${v}.json`) ? JSON.parse(readFileSync(`workspace/review_v${v}.json`, 'utf8')) : { findings: [] };
const ledger = existsSync('workspace/issues.json') ? JSON.parse(readFileSync('workspace/issues.json', 'utf8')) : { issues: {} };
const now = new Date().toISOString();
const S = Object.fromEntries(D.storeys.map((s) => [s.key, s]));

// element centre in IFC coordinates (local), from the design intent
const centre = (key) => {
  const w = (D.walls ?? []).find((x) => x.key === key); if (w) return [(w.start[0] + w.end[0]) / 2, (w.start[1] + w.end[1]) / 2, S[w.storey].elevation + 1.4];
  const o = (D.openings ?? []).find((x) => x.key === key); if (o) { const h = D.walls.find((x) => x.key === o.wall); const L = Math.hypot(h.end[0] - h.start[0], h.end[1] - h.start[1]); const t = (o.offset + o.width / 2) / L; return [h.start[0] + (h.end[0] - h.start[0]) * t, h.start[1] + (h.end[1] - h.start[1]) * t, S[h.storey].elevation + (o.sill ?? 0) + o.height / 2]; }
  const p = [...(D.spaces ?? []), ...(D.slabs ?? [])].find((x) => x.key === key); if (p) return [p.polygon.reduce((s, q) => s + q[0], 0) / p.polygon.length, p.polygon.reduce((s, q) => s + q[1], 0) / p.polygon.length, S[p.storey].elevation + 1];
  const t = [...(D.stairs ?? []), ...(D.columns ?? [])].find((x) => x.key === key); if (t) return [t.position[0], t.position[1], S[t.storey].elevation + 1];
  if (S[key]) return [0, 0, S[key].elevation + 1];
  return [0, 0, 3];
};
const toViewer = ([x, y, z]) => ({ x, y: z, z: -y }); // IFC Z-up → viewer Y-up

const current = [...checks.findings.map((f) => ({ ...f, origin: 'Prüfregel' })), ...review.findings.map((f) => ({ ...f, origin: `Fach-Agent ${f.discipline}` }))];
const seen = new Set();
const refused = [];
for (const f of current) {
  const known = (f.elements ?? []).filter((k) => K[k]);
  if ((f.elements ?? []).length && !known.length) { refused.push({ id: f.id, reason: `Bauteile ${f.elements.join(', ')} existieren in v${v} nicht` }); continue; }
  seen.add(f.id);
  const L = (ledger.issues[f.id] ??= { id: f.id, topicGuid: stableUuid(`topic:${f.id}`), firstSeen: v, history: [] });
  L.title = f.title; L.severity = f.severity; L.discipline = f.discipline; L.origin = f.origin; L.elements = known; L.guids = known.map((k) => K[k].guid);
  L.text = f.text; L.source = f.source; L.who = f.who; L.lastSeen = v; L.status = 'Open';
  if (!L.history.some((h) => h.v === v)) L.history.push({ v, event: L.firstSeen === v ? 'neu' : 'noch offen', text: f.text });
}
const resolvedBy = Object.fromEntries((review.resolved ?? []).map((r) => [r.issueId, r]));
for (const L of Object.values(ledger.issues)) {
  if (L.status !== 'Open' || seen.has(L.id) || L.lastSeen >= v) continue;
  const stillThere = L.elements.filter((k) => K[k]);
  if (L.origin === 'Prüfregel') { L.status = 'Closed'; L.closedIn = v; L.history.push({ v, event: 'erledigt', text: `Gleiche Prüfregel in v${v} ohne Befund (Bauteile ${stillThere.join(', ') || '–'}, gleiche GlobalIds).` }); }
  else if (resolvedBy[L.id]) { L.status = 'Closed'; L.closedIn = v; L.history.push({ v, event: 'erledigt', text: `${resolvedBy[L.id].discipline}: ${resolvedBy[L.id].reason}` }); }
  else { L.lastSeen = v; L.history.push({ v, event: 'nicht neu beurteilt', text: 'Der Fach-Agent hat den Punkt weder bestätigt noch als erledigt gemeldet – bleibt offen.' }); }
}
writeFileSync('workspace/issues.json', JSON.stringify(ledger, null, 1));

// write the BCF project from the ledger (rebuilt each time; topic GUIDs are stable)
const ifcProjectGuid = stableGuid('__project#0'); // compile.mjs: the IfcProject is the first GUID written (key '__project')
const ifcFileName = (ver) => `design_v${ver}.ifc`;
// deterministic timestamps: version v is dated 2026-11-24T08:00Z + (v-1) h, history entry i adds i s → repeated exports are identical
const when = (ver, i = 0) => new Date(Date.parse('2026-11-24T08:00:00Z') + (ver - 1) * 3600e3 + i * 1000).toISOString();
const ifcFile = (ver) => ({ ifcProject: ifcProjectGuid, filename: ifcFileName(ver), date: when(ver), isExternal: true });
const project = createBCFProject({ name: `${D.name} – Koordination`, version: '2.1' });
project.projectId = stableUuid('bcf-project'); // same BCF project across exports
// camera up vector orthogonal to the view direction (14, 18, -11): Z-up projected, normalised
const UP = (() => { const d = [14, 18, -11], n = Math.hypot(...d), u = d.map((x) => x / n), k = u[2]; const v = [-k * u[0], -k * u[1], 1 - k * u[2]], m = Math.hypot(...v); return v.map((x) => x / m); })();
const typeOf = { ERROR: 'Error', WARNING: 'Warning', INFO: 'Info' };
const colour = { ERROR: 'FFD7263D', WARNING: 'FFE8A33D', INFO: 'FF5B7C8F' };
for (const L of Object.values(ledger.issues)) {
  const t = createBCFTopic({ title: `[${L.id.split(':')[0]}] ${L.title}`, description: `${L.text}\n\nQuelle: ${L.source ?? '–'}\nZuständig: ${L.who ?? '–'}\nHerkunft: ${L.origin}\nBauteile: ${L.elements.join(', ') || 'Modell'}`, author: L.origin.startsWith('Fach') ? `${String(L.discipline ?? 'fach').toLowerCase().replace(/[^a-z0-9äöü._-]+/g, '-')}@agententeam` : 'pruefung@agententeam', topicType: typeOf[L.severity] ?? 'Info', topicStatus: 'Open', priority: L.severity === 'ERROR' ? 'High' : 'Normal', labels: [L.discipline, L.origin, `seit v${L.firstSeen}`].filter(Boolean) });
  t.guid = L.topicGuid;
  t.creationDate = when(L.firstSeen); t.header = [ifcFile(L.lastSeen)]; // the IFC version the viewpoint GUIDs belong to
  if (L.guids.length) {
    const c = L.elements.map(centre).reduce((s, p, i, a) => s.map((x, j) => x + p[j] / a.length), [0, 0, 0]);
    const vp = createViewpoint({ camera: { position: toViewer([c[0] - 14, c[1] - 18, c[2] + 11]), target: toViewer(c), up: toViewer(UP), fov: Math.PI / 3, aspectRatio: 16 / 9 }, selectedGuids: L.guids, coloredGuids: [{ color: colour[L.severity] ?? colour.INFO, guids: L.guids }] });
    vp.guid = stableUuid(`viewpoint:${L.id}:v${L.lastSeen}`);
    addViewpointToTopic(t, vp);
  }
  L.history.forEach((h, i) => { const cm = createBCFComment({ author: 'orchestrator@agententeam', comment: `v${h.v} · ${h.event}: ${h.text}` }); cm.guid = stableUuid(`comment:${L.id}:${i}:v${h.v}`); cm.date = when(h.v, i + 1); addCommentToTopic(t, cm); });
  if (L.history.length) t.modifiedDate = when(L.history.at(-1).v, L.history.length); // addCommentToTopic stamps the wall clock
  if (L.status === 'Closed') { updateTopicStatus(t, 'Closed', 'orchestrator@agententeam'); t.modifiedDate = when(L.closedIn, L.history.length + 1); }
  addTopicToProject(project, t);
}
const blob = await writeBCF(project);
writeFileSync('workspace/issues.bcf', Buffer.from(await blob.arrayBuffer()));
copyFileSync('workspace/issues.bcf', `workspace/issues_after_v${v}.bcf`);
// round-trip check: what we wrote is readable and has the topics we think it has
const back = await readBCF(readFileSync('workspace/issues.bcf'));
const all = Object.values(ledger.issues);
console.log(JSON.stringify({ ok: true, topics: back.topics.size, open: all.filter((x) => x.status === 'Open').length, closed: all.filter((x) => x.status === 'Closed').length, newInThisVersion: all.filter((x) => x.firstSeen === v).length, refused }));
