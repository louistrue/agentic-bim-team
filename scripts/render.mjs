#!/usr/bin/env node
// Renders a design version for the Visual-QA agent and the report (no browser needed):
// workspace/renders/vN_axon_sw.png, vN_axon_ne.png, vN_plan_<storey>.png
// Elements named in open ERROR findings (checks_vN.json) are drawn red.
// Usage: node scripts/render.mjs N
import { readFileSync, mkdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { renderView, loadMeshes, meshesById } from '../lib/render.mjs';

const v = Number(process.argv[2]);
const ifc = `workspace/design_v${v}.ifc`;
mkdirSync('workspace/renders', { recursive: true });
const prefix = `workspace/renders/.v${v}`;
execFileSync('node', [new URL('./tessellate.mjs', import.meta.url).pathname, ifc, prefix], { stdio: 'ignore' });
loadMeshes(prefix);
const text = readFileSync(ifc, 'utf8');
const guidOf = Object.fromEntries([...text.matchAll(/^#(\d+)=\s*IFC[A-Z]+\('([^']{22})'/gm)].map((m) => [Number(m[1]), m[2]]));
const checks = existsSync(`workspace/checks_v${v}.json`) ? JSON.parse(readFileSync(`workspace/checks_v${v}.json`, 'utf8')) : { findings: [] };
const bad = new Set(checks.findings.filter((f) => f.severity === 'ERROR').flatMap((f) => f.guids));
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const COL = { IfcWall: '#d9d6cf', IfcSlab: '#a9b7bd', IfcWindow: '#5b7c8f', IfcDoor: '#a0703c', IfcStair: '#8a6f4e', IfcColumn: '#445b48', IfcFooting: '#6b6b6b', IfcSpace: '#e9efe6' };
const style = (id, t) => ({ rgb: bad.has(guidOf[id]) ? hex('#d7263d') : hex(COL[t] ?? '#cccccc') });
const D = JSON.parse(readFileSync(`workspace/design_v${v}.json`, 'utf8'));

const body = new Map();
for (const [id, ms] of meshesById) if (ms[0].type !== 'IfcSpace' && ms[0].type !== 'IfcOpeningElement') body.set(id, style(id, ms[0].type));
const out = [];
for (const [name, f] of [['axon_sw', [0.6, -0.5, -0.6]], ['axon_ne', [-0.6, -0.5, 0.6]]]) {
  renderView({ elems: body, f, up: [0, 1, 0], pxPerM: 22, out: `workspace/renders/v${v}_${name}.png` }); out.push(`workspace/renders/v${v}_${name}.png`);
}
// plans: elements whose lowest point lies within a storey band, slabs excluded, spaces shown
const minY = (id) => Math.min(...meshesById.get(id).flatMap((m) => { const a = []; for (let i = 1; i < m.pos.length; i += 3) a.push(m.pos[i]); return a; }));
const z0 = Math.min(...[...meshesById.keys()].map(minY).filter(Number.isFinite));
const storeys = [...D.storeys].sort((a, b) => a.elevation - b.elevation);
const base0 = Math.min(...[...meshesById.entries()].filter(([, m]) => m[0].type === 'IfcWall').map(([id]) => minY(id)));
for (const st of storeys) {
  const lo = base0 + st.elevation - storeys[0].elevation - 0.05, hi = lo + Math.min(1.2, st.height - 0.4);
  const e = new Map();
  for (const [id, ms] of meshesById) {
    const t = ms[0].type; if (t === 'IfcSlab' || t === 'IfcOpeningElement') continue;
    const y = minY(id); if (y >= lo && y <= hi) e.set(id, style(id, t));
  }
  if (!e.size) continue;
  renderView({ elems: e, f: [0, -1, 0.0001], up: [0, 0, -1], pxPerM: 26, out: `workspace/renders/v${v}_plan_${st.key}.png` }); out.push(`workspace/renders/v${v}_plan_${st.key}.png`);
}
try { const p = JSON.parse(execFileSync('uv', ['run', '--quiet', '--with', 'pillow', 'python', new URL('./plan.py', import.meta.url).pathname, String(v)], { encoding: 'utf8' })); out.push(...p.plans); } catch (e) { console.error('plan.py failed', e.message); }
console.log(JSON.stringify({ ok: true, renders: out, highlighted: bad.size }));
