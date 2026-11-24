// Live smoke test of the agent team in Node (same code as the browser). Key from ANTHROPIC_API_KEY.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import Anthropic from '@anthropic-ai/sdk';
import { Team } from '../src/agents/team.js';
const P = new URL('../public/data/', import.meta.url).pathname;
const brief = JSON.parse(readFileSync(P + 'brief.json')), site = JSON.parse(readFileSync(P + 'site.json')), idsXml = readFileSync(P + 'requirements.ids', 'utf8');
const startCode = process.env.FROM_LAUF2 ? readFileSync(P + 'reference_generator.js', 'utf8') : null;
const T0 = Date.now(); let DUMPN = 0;
const team = new Team({ client: new Anthropic(), brief, site, idsXml, startCode, cycles: Number(process.env.CYCLES ?? 1), wishes: process.env.WISHES ?? '',
  models: { architect: process.env.ARCH ?? 'claude-sonnet-5-5', reviewer: process.env.REV ?? 'claude-haiku-5-5', architectEffort: process.env.EFFORT },
  emit: (e) => {
    if (e.type === 'text') process.stdout.write(e.delta);
    else if (e.type === 'thinking' || e.type === 'net') { if (e.type === 'net') console.log(`[net ${e.state} ${((Date.now() - T0) / 1000).toFixed(0)}s]`); }
    else if (e.type === 'code') { if (!e.partial) { console.log(`\n[code ${e.code.length} chars]`); if (process.env.DUMP) writeFileSync(`${process.env.DUMP}/code_${++DUMPN}.js`, e.code); } }
    else if (e.type === 'selfcheck') console.log(`\n[selfcheck ${((Date.now() - T0) / 1000).toFixed(0)}s]`, JSON.stringify(e.result.ok ? { counts: e.result.counts, elements: e.result.elements, ms: e.result.ms } : e.result).slice(0, 600));
    else if (e.type === 'agent') console.log(`\n[agent] ${e.name} ${e.model} ${e.status}${e.error ? ' ' + e.error : ''}${e.review ? ' findings=' + e.review.findings.length + ' resolved=' + e.review.resolved.length : ''}`);
    else if (e.type === 'cost') console.log(`[cost] ${e.name} +$${e.add.toFixed(3)} = $${e.total.toFixed(3)} (in ${e.usage.input_tokens} out ${e.usage.output_tokens} cw ${e.usage.cache_creation_input_tokens} cr ${e.usage.cache_read_input_tokens})`);
    else if (e.type === 'issues') console.log('[issues]', JSON.stringify(e.V.issueStats), 'rejected', JSON.stringify(e.V.review.rejected));
    else if (e.type !== 'version' && e.type !== 'step') console.log(`[${e.type}]`, JSON.stringify(e).slice(0, 300));
  } });
await team.run();
mkdirSync(new URL('./out', import.meta.url), { recursive: true });
team.versions.forEach((V) => { writeFileSync(new URL(`./out/design_v${V.v}.ifc`, import.meta.url), V.comp.ifc); if (V.bcf) writeFileSync(new URL(`./out/v${V.v}.bcf`, import.meta.url), V.bcf); writeFileSync(new URL(`./out/gen_v${V.v}.js`, import.meta.url), V.code); });
console.log('\nTOTAL $', team.cost.toFixed(3));
