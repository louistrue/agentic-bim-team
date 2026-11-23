#!/usr/bin/env node
// Final report, written from files only (no LLM): workspace/report.md
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
const J = (p) => JSON.parse(readFileSync(p, 'utf8'));
const run = J('workspace/run.json'), site = J('workspace/site.json'), brief = J('brief.json');
const ledger = existsSync('workspace/issues.json') ? Object.values(J('workspace/issues.json').issues) : [];
const vs = run.versions.filter((v) => v.checks);
const last = vs.at(-1); const N = last.v;
const checks = J(`workspace/checks_v${N}.json`), review = existsSync(`workspace/review_v${N}.json`) ? J(`workspace/review_v${N}.json`) : { summaries: {}, rejected: [] };
const open = ledger.filter((i) => i.status === 'Open'), closed = ledger.filter((i) => i.status === 'Closed');
const openErr = open.filter((i) => i.severity === 'ERROR');
const m = checks.metrics;
const L = [];
L.push(`# ${brief.project} – Bericht Agententeam v2`, '');
L.push(`**Status:** ${openErr.length ? `ESKALIERT – ${openErr.length} ERROR offen` : 'BEREIT FÜR MENSCHLICHE FREIGABE (keine ERROR offen)'}  `);
L.push(`**Modell:** \`workspace/design_v${N}.ifc\` · **Befunde:** \`workspace/issues.bcf\` (${ledger.length} Topics, ${open.length} offen, ${closed.length} erledigt)  `);
L.push(`**Parzelle:** ${site.parcel.number} (${site.parcel.egrid}), ${site.parcel.registeredArea} m², W3 · Ersatz für EGID ${brief.site.replaceEgid}  `);
L.push(`**Lauf:** ${run.started} – ${run.finished ?? '…'} · Agentenkosten $${run.costUsd.toFixed(2)}`, '');
L.push('## Verlauf', '', '| Version | IDS (Spezifikationen bestanden) | Befunde Prüfregeln | Befunde Agenten | Abgelehnte Agentenbefunde | offen ERROR / WARNING | erledigt | gleiche GlobalIds wie Vorversion |', '|---|---|---|---|---|---|---|---|');
for (const v of vs) {
  const c = J(`workspace/checks_v${v.v}.json`); const ids = c.metrics.ids; const pass = ids.filter((s) => s.status === 'pass').length;
  L.push(`| v${v.v} | ${pass}/${ids.length} | ${c.findings.length} (${c.counts.ERROR} ERROR) | ${v.review?.findings ?? '–'} | ${v.review?.rejected?.length ?? 0} | ${v.openErrors} / ${v.openWarnings} | ${v.issues?.closed ?? 0} | ${v.identity ? `${v.identity.common} gleich · +${v.identity.added} · −${v.identity.removed}` : '–'} |`);
}
L.push('', '## Kennzahlen (letzte Version)', '');
L.push(`- Geschossfläche ${m.grossFloorArea} m², Wohnungen ${m.units}, Vollgeschosse ${m.fullStoreys}, Gebäudehöhe ca. ${m.buildingHeight} m (max. ${brief.zoning.maxBuildingHeight_m} m), EG ${m.floorAboveTerrain} m über Terrain`);
L.push(`- Ausnützung dieses Baus: ${m.floorAreaRatioThisBuilding} (AZ W3 max. ${brief.zoning.maxFloorAreaRatio} für die ganze Parzelle inkl. Bestand – **Mensch prüft**)`);
L.push(`- Grenzabstände: ${m.facades.map((f) => `${f.facade} ${f.actual} m (verlangt ${f.required} m)`).join(' · ')}`);
L.push(`- Fensteranteil: ${Object.entries(m.windowWallRatio).map(([k, x]) => `${k} ${Math.round(x.ratio * 100)} %`).join(' · ')}`, '');
L.push('## Was automatisch geprüft wurde', '', ...checks.ran.map((r) => `- ${r}`), `- Visual QA anhand von Renders, 4 Fachagenten (Tragwerk, Haustechnik, Energie/Fassade, Brandschutz)`, `- Jeder Agentenbefund muss ein existierendes Bauteil nennen; sonst wird er abgelehnt`, '');
L.push('## Offene Punkte', '', '| Schwere | ID | Titel | Bauteile | Herkunft | seit |', '|---|---|---|---|---|---|');
for (const i of open.sort((a, b) => a.severity.localeCompare(b.severity))) L.push(`| ${i.severity} | ${i.id.split(':')[0]} | ${i.title} | ${i.elements.join(', ') || 'Modell'} | ${i.origin} | v${i.firstSeen} |`);
L.push('', '## Erledigt', '', '| ID | Titel | Bauteile | gefunden | erledigt in |', '|---|---|---|---|---|');
for (const i of closed) L.push(`| ${i.id.split(':')[0]} | ${i.title} | ${i.elements.join(', ') || 'Modell'} | v${i.firstSeen} | v${i.closedIn} |`);
const rej = vs.flatMap((v) => (v.review?.rejected ?? []).map((r) => ({ ...r, v: v.v })));
if (rej.length) { L.push('', '## Abgelehnte Agentenbefunde', ''); rej.forEach((r) => L.push(`- v${r.v} · ${r.source}: ${r.title ?? ''} – ${r.reason}`)); }
L.push('', '## Nicht automatisch prüfbar – braucht Menschen', '');
brief.program.notChecked.forEach((x) => L.push(`- ${x}`)); site.humanChecks.forEach((x) => L.push(`- ${x}`));
for (const [d, s] of Object.entries(review.summaries ?? {})) (s.notCheckable ?? []).forEach((x) => L.push(`- ${d}: ${x}`));
L.push('', '## Einschätzungen der Fachagenten (letzte Version)', '');
for (const [d, s] of Object.entries(review.summaries ?? {})) L.push(`- **${d}**${s.verdict ? ` (${s.verdict})` : ''}: ${s.summary ?? '–'}`);
L.push('', '## Freigabe', '', 'Die Agenten schlagen vor; Menschen geben frei.', '', '| Rolle | Name | Datum | Entscheid / Unterschrift |', '|---|---|---|---|');
for (const r of ['Architektur (Projektverfasser)', 'Brandschutzfachperson', 'Tragwerksplanung', 'Energieplanung', 'Bauherrschaft']) L.push(`| ${r} | | | |`);
L.push('', '## Dateien', '', `- Modelle: ${vs.map((v) => `design_v${v.v}.ifc`).join(', ')} (EPSG:2056, stabile GlobalIds aus Design-Keys)`, '- Anforderungen: requirements.ids (aus brief.json erzeugt)', '- Befunde: issues.bcf (ein Projekt über alle Versionen), issues.json (Ledger)', '- Prüfresultate: checks_vN.json, review_vN.json, visual_qa_vN.json', '- Bilder: renders/', '- Standort: site.json, site_context.glb (swissALTI3D, Parzelle, swissBUILDINGS3D © swisstopo / amtliche Vermessung)');
writeFileSync('workspace/report.md', L.join('\n') + '\n');
console.log(`workspace/report.md · ${openErr.length ? 'ESKALIERT' : 'BEREIT FÜR FREIGABE'} · ${open.length} offen · ${closed.length} erledigt`);
