// The agent team, running in the browser with the student's own API key.
// Agents design and judge; code compiles, checks and keeps the books (same split as orchestrator-v2.ts).
// Every step is emitted as an event so the UI can show what happens and who decided it.
import { compileDesign } from '../core/compile.js';
import { checkDesign } from '../core/check.js';
import { updateIssues } from '../core/issues.js';
import { runGenerator } from '../core/sandbox.js';
import { partialToRunnable, editsToRunnable } from '../core/wip.js';
import { ARCHITECT, VISUAL_QA, SPECIALISTS, specialistPrompt, REVIEW_SCHEMA } from './prompts.js';

// $ per million tokens (input, output, cache write, cache read) – Claude API list prices, Nov 2026
export const PRICES = {
  'claude-opus-5-5': [4, 20, 5, 0.2],
  'claude-sonnet-5-5': [2, 10, 2.5, 0.1],
  'claude-haiku-5-5': [0.1, 0.5, 0.125, 0.01],
};
const costOf = (model, u) => { const p = PRICES[model] ?? PRICES['claude-sonnet-5-5']; return ((u.input_tokens ?? 0) * p[0] + (u.output_tokens ?? 0) * p[1] + (u.cache_creation_input_tokens ?? 0) * p[2] + (u.cache_read_input_tokens ?? 0) * p[3]) / 1e6; };
const FALLBACK = { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' };

const TOOLS = [
  { name: 'run_design', description: 'Run the design generator (a JS function body ending with `return design;`), compile it to IFC and run all deterministic checks. Returns compiler problems or the check findings.', eager_input_streaming: true,
    input_schema: { type: 'object', additionalProperties: false, required: ['code'], properties: { code: { type: 'string', description: 'JavaScript function body. No imports, no I/O. Must end with return design;' } } } },
  { name: 'edit_generator', description: 'Change the CURRENT generator (the one given to you, or your last successful run_design) with exact find/replace edits, then compile and check it like run_design. Use this for revisions instead of resending the whole generator. Each find must occur exactly once in the current generator.',
    input_schema: { type: 'object', additionalProperties: false, required: ['edits'], properties: { edits: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['find', 'replace'], properties: { find: { type: 'string', description: 'exact text from the current generator, unique' }, replace: { type: 'string' } } } } } } },
  { name: 'finish', description: 'End the turn after the last run_design. The last successful run_design becomes this version.',
    input_schema: { type: 'object', additionalProperties: false, required: ['notes'], properties: { notes: { type: 'string', description: 'German notes: per open issue id → change (element keys) or reason; design decisions; assumptions.' } } } },
];

export function openIssuesText(ledger, discipline) {
  const sel = Object.values(ledger.issues).filter((i) => i.status === 'Open' && (!discipline || i.discipline === discipline));
  if (!sel.length) return '(keine)';
  return sel.sort((a, b) => (a.severity > b.severity ? 1 : -1)).map((i) => `- [${i.severity}] ${i.id} · ${i.title}\n  Bauteile: ${i.elements.join(', ') || 'Modell'}\n  ${i.text}`).join('\n');
}

const summarizeChecks = (c) => ({ counts: c.counts, ids: c.metrics.ids.map((s) => `${s.id}:${s.status}${s.failed ? ` (${s.failed} failed)` : ''}`).join(' '), facades: c.metrics.facades, buildingHeight: c.metrics.buildingHeight, units: c.metrics.units, grossFloorArea: c.metrics.grossFloorArea,
  findings: c.findings.slice(0, 40).map((f) => ({ id: f.id, severity: f.severity, title: f.title, text: f.text.slice(0, 300), elements: f.elements.slice(0, 6) })), more: Math.max(0, c.findings.length - 40) });

export class Team {
  constructor({ client, brief, site, idsXml, models, cycles = 2, stopOn = 'ERROR', wishes = '', startCode = null, startChecks = null, render = null, emit = () => {} }) {
    Object.assign(this, { client, brief, site, idsXml, models, cycles, stopOn, wishes, startCode, startChecks, render, emit });
    this.versions = []; this.ledger = { issues: {} }; this.cost = 0; this.agents = []; this.aborted = false;
    this.controller = new AbortController();
  }
  // agents often shorten ids ("FIRE-x" instead of "FIRE-x:EG-A-WT"): map to the ledger id, or null
  canonicalId(given) {
    if (!given || typeof given !== 'string') return null;
    const g = given.trim(); if (this.ledger.issues[g]) return g;
    const head = g.split(':')[0];
    const hits = Object.keys(this.ledger.issues).filter((id) => id.split(':')[0] === head || (head.length >= 12 && id.startsWith(head)));
    return hits.length === 1 ? hits[0] : null;
  }
  abort() { this.aborted = true; this.controller.abort(); }
  track(name, model, usage) { const c = costOf(model, usage); this.cost += c; this.emit({ type: 'cost', total: this.cost, name, add: c, usage }); return c; }

  // one streamed request; text deltas and tool-input deltas go to the UI
  async call(name, params, { onText, onToolInput, onThinking } = {}) {
    let tries = 0;
    for (;;) {
      const stream = this.client.beta.messages.stream({ ...FALLBACK, ...params }, { signal: this.controller.signal });
      this.emit({ type: 'net', name, state: 'sent' });
      let first = true;
      stream.on('connect', () => this.emit({ type: 'net', name, state: 'connected' }));
      stream.on('streamEvent', () => { if (first) { first = false; this.emit({ type: 'net', name, state: 'streaming' }); } });
      if (onText) stream.on('text', onText);
      if (onThinking) stream.on('thinking', onThinking);
      if (onToolInput) stream.on('inputJson', (_d, snap) => onToolInput(snap));
      try {
        const msg = await stream.finalMessage();
        this.track(name, params.model, msg.usage);
        if (msg.stop_reason === 'refusal') throw new Error(`${name}: Anfrage vom Modell abgelehnt (refusal)`);
        return msg;
      } catch (e) {
        if (this.aborted) throw new Error('abgebrochen');
        if (e?.status || tries++ >= 1) throw e; // API errors: surface; JSON/connection hiccup: retry once
      }
    }
  }

  async evaluate(v, code) {
    const t0 = performance.now();
    const g = await runGenerator(code);
    if (!g.ok) return { ok: false, stage: 'generator', error: g.error };
    let comp; try { comp = compileDesign(g.design, { fileName: `loorenstrasse62_v${v}.ifc` }); } catch (e) { return { ok: false, stage: 'compiler', error: String(e.message ?? e) }; }
    if (!comp.ok) return { ok: false, stage: 'compiler', problems: comp.problems.slice(0, 30), more: Math.max(0, comp.problems.length - 30) };
    let checks; try { checks = await checkDesign({ v, D: g.design, K: comp.keys, ifc: comp.ifc, site: this.site, brief: this.brief, idsXml: this.idsXml }); } catch (e) { return { ok: false, stage: 'checks', error: String(e.message ?? e) }; }
    return { ok: true, design: g.design, code, comp, checks, ms: Math.round(performance.now() - t0) };
  }

  async architect(v) {
    const prev = this.versions.at(-1);
    const model = this.models.architect, name = `Architektur v${v}`;
    this.emit({ type: 'agent', name, role: 'architect', model, status: 'start', v });
    const ctx = `## Brief (AIA der Bauherrschaft)\n${JSON.stringify(this.brief)}\n\n## Standort (site.json)\n${JSON.stringify(this.site)}`;
    const wishes = this.wishes?.trim() ? `\n\n## Wunsch der Bauherrschaft (Hauptaufgabe dieser Version, im Modell umsetzen)\n${this.wishes.trim()}` : '';
    let task;
    if (v === 1 && !this.startCode) task = `Version N=1. Erste Version: entwirf das Gebäude.${wishes}`;
    else if (v === 1) task = `Version N=1. Ausgangslage: der Generator des Referenzentwurfs (unten), sein Prüfergebnis steht darunter (nicht nochmals laufen lassen). Passe ihn an den Brief und die Wünsche an; behalte Keys, wo Bauteile bleiben. Ändere ihn mit edit_generator (Suchen/Ersetzen); run_design nur für einen vollständig neuen Generator.${wishes}\n\n## Generator Referenzentwurf\n\`\`\`js\n${this.startCode}\n\`\`\`${this.startChecks ? `\n\n## Prüfergebnis Referenzentwurf\n${JSON.stringify(summarizeChecks(this.startChecks))}` : ''}`;
    else task = `Version N=${v}. Überarbeite deinen Generator von v${v - 1} (unten). Ändere ihn mit edit_generator (Suchen/Ersetzen); run_design nur für einen vollständig neuen Generator. Offene Punkte aus dem Issue-Ledger (alle mit Bauteil-Keys):\n${openIssuesText(this.ledger)}${wishes}\n\n## Generator v${v - 1}\n\`\`\`js\n${prev.code}\n\`\`\``;
    const messages = [{ role: 'user', content: [{ type: 'text', text: ctx }, { type: 'text', text: task }] }];
    let best = null, runs = 0, notes = '';
    let current = v === 1 ? this.startCode : prev.code; // the generator edit_generator works on
    let wipAt = 0, wipSrc = null;
    // fingerprint of the starting design: a wish must change the building, not only comments
    const geomKey = (D) => JSON.stringify([D.storeys, D.walls, D.openings, D.slabs, D.spaces, D.stairs, D.columns]);
    let startKey = null, refusedUnchanged = false;
    if (current && this.wishes?.trim()) { const g0 = await runGenerator(current); if (g0.ok) startKey = geomKey(g0.design); }
    for (let turn = 0; turn < 12; turn++) {
      let codeShown = '';
      const msg = await this.call(name, { model, max_tokens: 64000, system: ARCHITECT, tools: TOOLS, messages, cache_control: { type: 'ephemeral' }, thinking: { type: 'adaptive', display: 'summarized' }, output_config: { effort: this.models.architectEffort ?? 'medium' } }, {
        onThinking: (d) => this.emit({ type: 'thinking', name, delta: d }),
        onText: (t) => this.emit({ type: 'text', name, delta: t }),
        onToolInput: (snap) => {
          if (typeof snap?.code === 'string' && snap.code.length - codeShown.length > 40) { codeShown = snap.code; this.emit({ type: 'code', name, code: snap.code, partial: true }); }
          // live preview while the architect is still writing (display only, unchecked)
          const now = Date.now(); if (now - wipAt < 2500) return;
          let src = null;
          if (typeof snap?.code === 'string') src = partialToRunnable(snap.code);
          else if (Array.isArray(snap?.edits) && current) src = editsToRunnable(current, snap.edits);
          if (src && src !== wipSrc) { wipAt = now; wipSrc = src; this.emit({ type: 'wip', name, v, code: src }); }
        },
      });
      messages.push({ role: 'assistant', content: msg.content });
      if (msg.stop_reason === 'max_tokens') throw new Error(`${name}: Antwort abgeschnitten (max_tokens)`);
      const uses = msg.content.filter((b) => b.type === 'tool_use');
      if (!uses.length) { if (best) break; messages.push({ role: 'user', content: current ? 'Bitte ändere den Generator mit edit_generator (oder sende ihn vollständig mit run_design).' : 'Bitte rufe run_design mit dem vollständigen Generator auf.' }); continue; }
      const results = []; let done = false;
      for (const u of uses) {
        if (u.name === 'run_design' || u.name === 'edit_generator') {
          let code;
          if (u.name === 'edit_generator') {
            const edits = Array.isArray(u.input?.edits) ? u.input.edits : null;
            if (!current) { results.push({ type: 'tool_result', tool_use_id: u.id, is_error: true, content: 'Es gibt noch keinen Generator zum Ändern. Sende den vollständigen Generator mit run_design.' }); continue; }
            if (!edits?.length) { results.push({ type: 'tool_result', tool_use_id: u.id, is_error: true, content: 'INVALID_INPUT: edits fehlt oder ist leer.' }); continue; }
            code = current; let bad = null;
            for (const [i, e] of edits.entries()) {
              if (typeof e?.find !== 'string' || typeof e?.replace !== 'string' || !e.find) { bad = `Edit ${i + 1}: find und replace müssen Text sein.`; break; }
              const n = code.split(e.find).length - 1;
              if (n !== 1) { bad = `Edit ${i + 1}: find kommt ${n}-mal im aktuellen Generator vor (muss genau 1-mal sein): ${JSON.stringify(e.find.slice(0, 120))}`; break; }
              code = code.replace(e.find, () => e.replace);
            }
            if (bad) { results.push({ type: 'tool_result', tool_use_id: u.id, is_error: true, content: `${bad} Keine Änderung übernommen, kein Prüflauf gezählt.` }); continue; }
          } else {
            if (typeof u.input?.code !== 'string') { results.push({ type: 'tool_result', tool_use_id: u.id, is_error: true, content: 'INVALID_INPUT: code (string) fehlt' }); continue; }
            code = u.input.code;
            // placeholders / fragments are not a design: refuse without counting a run
            if (code.trim().length < 400 || !/return\s+[A-Za-z_$]/.test(code) || /return\s+null\b/.test(code)) {
              results.push({ type: 'tool_result', tool_use_id: u.id, is_error: true, content: `Abgelehnt, kein Prüflauf gezählt: run_design braucht den VOLLSTÄNDIGEN Generator (${code.trim().length} Zeichen erhalten, keine Platzhalter, am Ende return design;).${current ? ' Für Änderungen am bestehenden Generator nimm edit_generator.' : ''}` });
              continue;
            }
          }
          runs++;
          this.emit({ type: 'code', name, code, partial: false });
          this.emit({ type: 'step', who: 'code', name: 'Compiler + Prüfungen', text: `Lauf ${runs}: Generator ausführen → IFC kompilieren → prüfen` });
          const r = await this.evaluate(v, code);
          this.emit({ type: 'selfcheck', name, v, run: runs, result: r.ok ? { ok: true, counts: r.checks.counts, elements: r.comp.elements, ms: r.ms, findings: r.checks.findings, design: r.design, comp: r.comp, checks: r.checks, code: r.code } : r });
          if (r.ok) { best = r; current = code; }
          const body = r.ok ? { ok: true, elements: r.comp.elements, grossFloorArea: r.comp.grossFloorArea, ...summarizeChecks(r.checks), runsLeft: Math.max(0, 4 - runs) } : r;
          results.push({ type: 'tool_result', tool_use_id: u.id, content: JSON.stringify(body), is_error: !r.ok });
        } else if (u.name === 'finish') {
          if (!best) { results.push({ type: 'tool_result', tool_use_id: u.id, is_error: true, content: 'Noch kein erfolgreicher Prüflauf: zuerst edit_generator oder run_design aufrufen.' }); continue; }
          if (startKey && !refusedUnchanged && geomKey(best.design) === startKey) {
            refusedUnchanged = true;
            results.push({ type: 'tool_result', tool_use_id: u.id, is_error: true, content: 'Abgelehnt: Das Gebäude ist unverändert, der Wunsch der Bauherrschaft ist nicht umgesetzt. Setze ihn jetzt im Modell um (Wände, Öffnungen, Räume, Treppen mit edit_generator oder einem neuen vollständigen Generator). Nur wenn er nach Brief oder Bauordnung wirklich nicht machbar ist: finish erneut aufrufen und in den Notizen konkret begründen, welche Regel oder welches Mass es verhindert.' });
            continue;
          }
          notes = String(u.input?.notes ?? ''); done = true; results.push({ type: 'tool_result', tool_use_id: u.id, content: 'ok' });
        } else results.push({ type: 'tool_result', tool_use_id: u.id, is_error: true, content: `unknown tool ${u.name}` });
      }
      if (runs >= 4 && !done && best) results.push({ type: 'text', text: 'Maximal 4 run_design-Läufe erreicht. Rufe jetzt finish mit deinen Notizen auf.' });
      messages.push({ role: 'user', content: results });
      if (done) break;
      if (runs >= 6) break;
    }
    if (!best) throw new Error(`${name}: kein kompilierbares Design`);
    this.emit({ type: 'agent', name, role: 'architect', model, status: 'done', v, notes });
    return { ...best, notes };
  }

  async review(v, V) {
    const keys = Object.keys(V.comp.keys);
    const checksTxt = JSON.stringify(summarizeChecks(V.checks));
    const designTxt = JSON.stringify(V.design, (k, val) => (k === 'Layers' ? undefined : val));
    const jobs = [];
    // Visual QA looks at the real drawings
    jobs.push({ key: 'visual', disc: 'Visual QA', model: this.models.reviewer, system: VISUAL_QA,
      content: [...(V.images ?? []).flatMap((im) => [{ type: 'text', text: im.name }, { type: 'image', source: { type: 'base64', media_type: 'image/png', data: im.base64 } }]),
        { type: 'text', text: `Version N=${v}.\nDesign-Keys: ${keys.join(', ')}\n\nPrüfergebnisse (deterministisch):\n${checksTxt}\n\nOffene Visual-QA-Punkte:\n${openIssuesText(this.ledger, 'Visual QA')}` }] });
    for (const [k, s] of Object.entries(SPECIALISTS)) jobs.push({ key: k, disc: s.discipline, model: this.models.reviewer, system: specialistPrompt(s),
      content: [{ type: 'text', text: `## Brief\n${JSON.stringify(this.brief)}\n\n## Design v${v} (Absicht, Keys = IFC-Bauteile)\n${designTxt}\n\n## Prüfergebnisse (deterministisch)\n${checksTxt}\n\n## Notizen der Architektur\n${V.notes || '–'}` },
        { type: 'text', text: `Version N=${v}. Offene Punkte deiner Disziplin aus früheren Versionen:\n${openIssuesText(this.ledger, s.discipline)}` }] });
    const out = await Promise.all(jobs.map(async (j) => {
      const name = `${j.disc} v${v}`;
      this.emit({ type: 'agent', name, role: j.key, model: j.model, status: 'start', v });
      try {
        const msg = await this.call(name, { model: j.model, max_tokens: 16000, system: j.system, messages: [{ role: 'user', content: j.content }], thinking: { type: 'adaptive', display: 'summarized' }, output_config: { effort: 'medium', format: { type: 'json_schema', schema: REVIEW_SCHEMA } } }, { onThinking: (d) => this.emit({ type: 'thinking', name, delta: d }) });
        const txt = msg.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
        const r = JSON.parse(txt);
        this.emit({ type: 'agent', name, role: j.key, model: j.model, status: 'done', v, review: r });
        return [j, r];
      } catch (e) { this.emit({ type: 'agent', name, role: j.key, model: j.model, status: 'error', v, error: String(e.message ?? e) }); return [j, null]; }
    }));
    // merge: findings must name existing elements; re-raised issues keep their id
    const K = V.comp.keys, findings = [], rejected = [], resolved = [], summaries = {};
    for (const [j, r] of out) {
      if (!r) { rejected.push({ source: j.disc, reason: 'keine gültige Antwort' }); continue; }
      summaries[j.disc] = { summary: r.summary, verdict: r.verdict, notCheckable: r.notCheckable };
      for (const x of r.findings ?? []) {
        const els = (x.elements ?? []).filter((e) => K[e]);
        if (!els.length) { rejected.push({ source: j.disc, title: x.title, reason: `kein existierendes Bauteil (${(x.elements ?? []).join(', ') || 'keins angegeben'})` }); continue; }
        const slug = (x.title ?? '').toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').normalize('NFD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
        const known = this.canonicalId(x.issueId);
        findings.push({ id: known ?? `${j.key.toUpperCase()}-${slug}:${els[0]}`, rule: j.key.toUpperCase(), severity: x.severity ?? 'INFO', title: x.title, text: `${x.text}${x.basis ? `\nGrundlage: ${x.basis}` : ''}${x.verify ? `\nPrüfen: ${x.verify}` : ''}`, elements: els, discipline: j.disc, source: x.basis, who: j.disc });
      }
      for (const rr of r.resolved ?? []) { const id = this.canonicalId(rr.issueId); if (id) resolved.push({ ...rr, issueId: id, discipline: j.disc }); }
    }
    return { version: v, findings, rejected, resolved, summaries };
  }

  async run() {
    const t0 = Date.now();
    try {
      for (let v = 1; v <= this.cycles; v++) {
        if (this.aborted) break;
        this.emit({ type: 'phase', v, phase: 'design', text: `v${v} · Architektur entwirft` });
        const V = await this.architect(v);
        V.v = v;
        if (this.render) { this.emit({ type: 'phase', v, phase: 'render', text: `v${v} · Pläne zeichnen` }); V.images = this.render(V.design, V.checks, v); }
        const prev = this.versions.at(-1);
        if (prev) { const a = new Set(Object.values(prev.comp.keys).map((x) => x.guid)), b = new Set(Object.values(V.comp.keys).map((x) => x.guid)); V.identity = { common: [...b].filter((g) => a.has(g)).length, added: [...b].filter((g) => !a.has(g)).length, removed: [...a].filter((g) => !b.has(g)).length }; }
        this.versions.push(V);
        this.emit({ type: 'version', v, V });
        this.emit({ type: 'phase', v, phase: 'review', text: `v${v} · Visual QA + 4 Fachplaner prüfen (parallel)` });
        V.review = await this.review(v, V);
        this.emit({ type: 'phase', v, phase: 'issues', text: `v${v} · Issue-Ledger + BCF` });
        const res = await updateIssues({ v, D: V.design, K: V.comp.keys, checks: V.checks, review: V.review, ledger: structuredClone(this.ledger) });
        this.ledger = res.ledger; V.bcf = res.bcf; V.issueStats = { open: res.open, closed: res.closed, new: res.newInThisVersion, refused: res.refused };
        const open = Object.values(this.ledger.issues).filter((i) => i.status === 'Open');
        V.openErrors = open.filter((i) => i.severity === 'ERROR').length; V.openWarnings = open.filter((i) => i.severity === 'WARNING').length;
        this.emit({ type: 'issues', v, V, ledger: this.ledger });
        if (V.openErrors === 0 && (this.stopOn !== 'WARNING' || V.openWarnings === 0)) { this.emit({ type: 'phase', v, phase: 'converged', text: `v${v}: keine offenen ERROR – Team hört auf` }); break; }
      }
      this.emit({ type: 'done', seconds: Math.round((Date.now() - t0) / 1000), cost: this.cost });
    } catch (e) {
      this.emit({ type: 'error', error: String(e?.message ?? e), status: e?.status });
    }
  }
}
