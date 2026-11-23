#!/usr/bin/env node
// brief.json requirements (the client's AIA lines) → workspace/requirements.ids (IDS 1.0).
// Each IDS specification carries the requirement id and text, so a check result always points back
// to the AIA line, the responsible role and the source. Requirements that IDS cannot express
// (e.g. R09 georeferencing) stay with the rule checker and are listed as such.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const brief = JSON.parse(readFileSync(process.argv[2] ?? 'brief.json', 'utf8'));
const out = process.argv[3] ?? 'workspace/requirements.ids';
const x = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const sv = (v) => `<ids:simpleValue>${x(v)}</ids:simpleValue>`;
const enumR = (vals, base = 'xs:string') => `<xs:restriction base="${base}">${vals.map((v) => `<xs:enumeration value="${x(v)}"/>`).join('')}</xs:restriction>`;
const boolV = (b) => sv(b ? 'true' : 'false');
function propFacet({ pset, property, datatype, value, enumVals, max, cardinality = 'required' }) {
  let val = '';
  if (value !== undefined) val = `<ids:value>${typeof value === 'boolean' ? boolV(value) : sv(value)}</ids:value>`;
  else if (enumVals) val = `<ids:value>${enumR(enumVals)}</ids:value>`;
  else if (max !== undefined) val = `<ids:value><xs:restriction base="xs:double"><xs:maxInclusive value="${max}"/></xs:restriction></ids:value>`;
  return `<ids:property${datatype ? ` dataType="${datatype.toUpperCase()}"` : ''}${cardinality ? ` cardinality="${cardinality}"` : ''}><ids:propertySet>${sv(pset)}</ids:propertySet><ids:baseName>${sv(property)}</ids:baseName>${val}</ids:property>`;
}
const specs = []; const notIds = [];
for (const r of brief.requirements) {
  if (!r.ifc) { notIds.push(r.id); continue; }
  const app = [`<ids:entity><ids:name>${sv(r.ifc.toUpperCase())}</ids:name></ids:entity>`];
  if (r.filter) app.push(propFacet({ pset: r.filter.pset, property: r.filter.property, value: r.filter.value, enumVals: r.filter.enum, cardinality: null }));
  const req = [];
  if (r.qto) req.push(propFacet({ pset: r.qto, property: r.quantity }));
  if (r.pset) req.push(propFacet({ pset: r.pset, property: r.property, datatype: r.datatype, enumVals: r.enum, max: r.max }));
  if (r.alsoRequire) req.push(propFacet({ pset: r.pset, property: r.alsoRequire.property, datatype: r.alsoRequire.datatype, value: r.alsoRequire.value }));
  if (r.alsoRequireProject) req.push(propFacet({ pset: 'BIM_Projekt', property: r.alsoRequireProject }));
  specs.push(`  <ids:specification name="${x(`${r.id} ${r.text}`)}" ifcVersion="IFC4" identifier="${r.id}" description="${x(r.source)}" instructions="${x(r.who)}">
    <ids:applicability minOccurs="1" maxOccurs="unbounded">${app.join('')}</ids:applicability>
    <ids:requirements>${req.join('')}</ids:requirements>
  </ids:specification>`);
}
const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ids:ids xmlns:ids="http://standards.buildingsmart.org/IDS" xmlns:xs="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://standards.buildingsmart.org/IDS http://standards.buildingsmart.org/IDS/1.0/ids.xsd">
  <ids:info>
    <ids:title>${x(brief.project)} – Informationsanforderungen (aus AIA)</ids:title>
    <ids:copyright>Lehrbeispiel BFH Minor BXMid03</ids:copyright>
    <ids:version>1.0</ids:version>
    <ids:description>Automatisch aus brief.json erzeugt. Nicht als IDS prüfbar: ${notIds.join(', ') || '–'} (Regelprüfung).</ids:description>
    <ids:date>2026-11-24</ids:date>
    <ids:purpose>Freigabe Vorprojekt</ids:purpose>
    <ids:milestone>SIA Phase 31 Vorprojekt</ids:milestone>
  </ids:info>
  <ids:specifications>
${specs.join('\n')}
  </ids:specifications>
</ids:ids>
`;
mkdirSync(out.split('/').slice(0, -1).join('/') || '.', { recursive: true });
writeFileSync(out, xml);
console.log(JSON.stringify({ ok: true, out, specifications: specs.length, notIds }));
