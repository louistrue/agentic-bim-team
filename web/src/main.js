import Anthropic from '@anthropic-ai/sdk';
import JSZip from 'jszip';
import { Team, PRICES } from './agents/team.js';
import { runGenerator } from './core/sandbox.js';
import { compileDesign } from './core/compile.js';
import { checkDesign } from './core/check.js';
import { drawPlan, drawAxon, drawSite, toPngBase64 } from './core/render.js';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const el = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstChild; };
const BASE = import.meta.env.BASE_URL;
const hhmmss = () => new Date().toLocaleTimeString('de-CH', { hour12: false });
const modelName = (m) => ({ 'claude-opus-5-5': 'Opus 5.5', 'claude-sonnet-5-5': 'Sonnet 5.5', 'claude-haiku-5-5': 'Haiku 5.5' }[m] ?? m);

// A "Stand" is any compiled state: the reference design, every self-check run, every delivered version.
const S = { data: null, team: null, stands: [], cur: -1, tab: 'Axo SW', code: '', codeLive: false, filter: 'open', running: false, courseKey: null };

// ── data + reference design ────────────────────────────────────────────────
async function loadData() {
  const [brief, site, idsXml, code] = await Promise.all(['brief.json', 'site.json', 'requirements.ids', 'reference_generator.js'].map((f) => fetch(`${BASE}data/${f}`).then((r) => (f.endsWith('.json') ? r.json() : r.text()))));
  S.data = { brief, site, idsXml, code };
  const g = await runGenerator(code); const comp = compileDesign(g.design);
  const checks = await checkDesign({ v: 0, D: g.design, K: comp.keys, ifc: comp.ifc, site, brief, idsXml });
  addStand({ id: 'ref', label: 'Referenz', long: 'Referenzentwurf', design: g.design, comp, checks, code, final: true });
  S.code = code; renderCode();
}

function renderImages(D, checks, tag) {
  const list = [];
  const storeys = [...D.storeys].sort((a, b) => a.elevation - b.elevation);
  for (const st of storeys) list.push({ name: st.name ?? st.key, c: drawPlan(D, checks, st.key, tag) });
  list.push({ name: 'Axo SW', c: drawAxon(D, checks, tag, 'sw') });
  list.push({ name: 'Axo NO', c: drawAxon(D, checks, tag, 'ne') });
  list.push({ name: 'Situation', c: drawSite(D, checks, S.data.site, tag) });
  return list;
}

function addStand(st) {
  const prev = [...S.stands].reverse().find((x) => x.final && x.id !== st.id);
  if (prev && st.comp) { const a = new Set(Object.values(prev.comp.keys).map((x) => x.guid)); const b = Object.values(st.comp.keys).map((x) => x.guid); st.kept = { common: b.filter((g) => a.has(g)).length, total: b.length, vs: prev.label }; }
  const canv = renderImages(st.design, st.checks, st.label);
  st.images = canv.map((x) => ({ name: x.name, url: x.c.toDataURL('image/png') }));
  st.forModel = canv.map((x) => ({ name: `${x.name} (${st.label})`, base64: toPngBase64(x.c) }));
  S.stands.push(st); showStand(S.stands.length - 1);
  return st;
}

// ── sheet + title block ────────────────────────────────────────────────────
// S.tab is the NAME of the drawing ('EG', 'Axo SW', 'Situation', 'code'): it survives switching Stände,
// even when a Stand has a different number of storeys.
function showStand(i) {
  S.cur = i; const st = S.stands[i]; if (!st) return;
  if (S.tab !== 'code' && !st.images.some((im) => im.name === S.tab)) S.tab = st.images.some((im) => im.name === 'Axo SW') ? 'Axo SW' : st.images[0]?.name;
  $('#vers').innerHTML = `<span>Stände</span>` + S.stands.map((x, n) => `<button data-i="${n}" class="${n === i ? 'on' : ''}" title="${esc(x.long ?? x.label)}">${x.final ? `<b>${esc(x.label)}</b>` : esc(x.label)}</button>`).join('');
  $('#tabs').innerHTML = st.images.map((im) => `<button data-t="${esc(im.name)}" class="${im.name === S.tab ? 'on' : ''}">${esc(im.name)}</button>`).join('') + `<button data-t="code" class="${S.tab === 'code' ? 'on' : ''} ${S.codeLive ? 'live' : ''}">Generator-Code</button>`;
  const code = S.tab === 'code';
  $('#code').hidden = !code; $('#stage').hidden = code; $('#zoomctl').hidden = code; $('#draw').classList.toggle('code', code);
  if (!code) viewer.show(st.images.find((im) => im.name === S.tab)?.url ?? '', `${S.tab}`);
  else renderCode();
  const c = st.checks, ids = c.metrics.ids, f = c.metrics.facades ?? [];
  const minF = f.length ? f.reduce((a, b) => (b.actual - b.required < a.actual - a.required ? b : a)) : null;
  $('#tb-stand').textContent = st.long ?? st.label;
  $('#tb-el').textContent = `${st.comp.elements}`;
  $('#tb-ids').textContent = `${ids.filter((s) => s.status === 'pass').length} / ${ids.length} erfüllt`;
  $('#tb-chk').innerHTML = `<span class="cnt"><span class="${c.counts.ERROR ? 'e' : ''}">${c.counts.ERROR} ERROR</span> · <span class="${c.counts.WARNING ? 'w' : ''}">${c.counts.WARNING} WARN</span></span>`;
  $('#tb-guid').textContent = st.kept ? `${st.kept.common} von ${st.kept.total} gleich wie ${st.kept.vs}` : '–';
  $('#tb-fac').textContent = minF ? `${minF.facade} ${minF.actual} m (min. ${minF.required})` : '–';
  $('#tb-units').textContent = `${c.metrics.units} · ${Math.round(c.metrics.grossFloorArea)} m²`;
  $('#sabo-src').textContent = `Basis: ${st.long ?? st.label}`;
}
const renderCode = () => { const pre = $('#code'); const atEnd = pre.scrollHeight - pre.scrollTop - pre.clientHeight < 40; pre.textContent = S.code || '// noch kein Code'; if (atEnd || S.codeLive) pre.scrollTop = pre.scrollHeight; };
$('#vers').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) showStand(Number(b.dataset.i)); });
$('#tabs').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; S.tab = b.dataset.t; showStand(S.cur); });
document.addEventListener('click', (e) => { if (e.target.matches('.sabo-out img')) { const z = el(`<div class="zoom"><img src="${e.target.src}"></div>`); z.onclick = () => z.remove(); document.body.append(z); } });

// ── drawing viewer: wheel / pinch zoom, drag to pan, double-click to fit ──
// The zoom is kept while switching Stände on the same drawing, so versions can be compared at the same spot.
const viewer = (() => {
  const stage = $('#stage'), img = $('#img');
  const Z = { k: 1, x: 0, y: 0, fitK: 1, key: '', w: 0, h: 0 };
  const apply = () => { img.style.transform = `translate(${Z.x}px, ${Z.y}px) scale(${Z.k})`; stage.classList.toggle('zoomed', Z.k > Z.fitK * 1.02); $('#zoomlvl').textContent = `${Math.round((Z.k / Z.fitK) * 100)} %`; };
  const fit = () => { const cw = stage.clientWidth, ch = stage.clientHeight; if (!Z.w || !cw) return; Z.fitK = Math.min(cw / Z.w, ch / Z.h) * 0.96; Z.k = Z.fitK; Z.x = (cw - Z.w * Z.k) / 2; Z.y = (ch - Z.h * Z.k) / 2; apply(); };
  const zoomAt = (f, mx, my) => { const k2 = Math.min(Math.max(Z.k * f, Z.fitK * 0.6), Z.fitK * 14); Z.x = mx - (mx - Z.x) * (k2 / Z.k); Z.y = my - (my - Z.y) * (k2 / Z.k); Z.k = k2; apply(); };
  const local = (e) => { const r = stage.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  stage.addEventListener('wheel', (e) => { e.preventDefault(); const [mx, my] = local(e); zoomAt(Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0018)), mx, my); }, { passive: false });
  const ptr = new Map(); let pinch = null;
  stage.addEventListener('pointerdown', (e) => { stage.setPointerCapture(e.pointerId); ptr.set(e.pointerId, local(e)); if (ptr.size === 2) { const [a, b] = [...ptr.values()]; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]) }; } stage.classList.add('drag'); });
  stage.addEventListener('pointermove', (e) => {
    if (!ptr.has(e.pointerId)) return; const p = local(e), prev = ptr.get(e.pointerId); ptr.set(e.pointerId, p);
    if (ptr.size === 1) { Z.x += p[0] - prev[0]; Z.y += p[1] - prev[1]; apply(); }
    else if (ptr.size === 2 && pinch) { const [a, b] = [...ptr.values()]; const d = Math.hypot(a[0] - b[0], a[1] - b[1]); zoomAt(d / pinch.d, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2); pinch.d = d; }
  });
  const up = (e) => { ptr.delete(e.pointerId); if (ptr.size < 2) pinch = null; if (!ptr.size) stage.classList.remove('drag'); };
  stage.addEventListener('pointerup', up); stage.addEventListener('pointercancel', up);
  stage.addEventListener('dblclick', (e) => { const [mx, my] = local(e); if (Z.k > Z.fitK * 1.05) fit(); else zoomAt(2.5, mx, my); });
  $('#zoomctl').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; const cw = stage.clientWidth / 2, ch = stage.clientHeight / 2; if (b.dataset.z === 'in') zoomAt(1.4, cw, ch); else if (b.dataset.z === 'out') zoomAt(1 / 1.4, cw, ch); else fit(); });
  new ResizeObserver(() => { const keep = Z.k > Z.fitK * 1.02; if (!keep) fit(); }).observe(stage);
  return {
    show(url, key) {
      if (img.dataset.url === url) return; img.dataset.url = url;
      const keepView = key === Z.key && Z.k > Z.fitK * 1.02;
      const probe = new Image(); probe.onload = () => { const same = probe.naturalWidth === Z.w && probe.naturalHeight === Z.h; Z.w = probe.naturalWidth; Z.h = probe.naturalHeight; img.src = url; img.style.width = `${Z.w}px`; img.style.height = `${Z.h}px`; Z.key = key; if (keepView && same) apply(); else fit(); }; probe.src = url;
    },
  };
})();

// ── process line ───────────────────────────────────────────────────────────
function stage(name, state = 'active') {
  document.querySelectorAll('#process li').forEach((n) => {
    if (n.dataset.st === name) { n.classList.remove('done'); n.classList.toggle('active', state === 'active'); if (state === 'done') n.classList.add('done'); }
    else if (state === 'active' && n.classList.contains('active')) { n.classList.remove('active'); n.classList.add('done'); }
  });
}
const resetProcess = () => document.querySelectorAll('#process li').forEach((n) => n.classList.remove('active', 'done'));

// ── protocol ───────────────────────────────────────────────────────────────
function log(kind, title, detail = '', cls = '') {
  const mark = kind === 'a' ? '<b class="a">A</b>' : kind === 'c' ? '<b class="c">C</b>' : '<b>·</b>';
  const r = el(`<li class="row ${kind === 'sys' ? 'sys' : ''} ${cls}"><time>${hhmmss()}</time>${mark}<div><div class="t">${title}</div>${detail ? `<div class="d">${detail}</div>` : ''}</div></li>`);
  // follow new entries only while the reader is at the bottom; otherwise leave the scroll position alone
  const rows = $('#rows'); const stick = rows.scrollHeight - rows.scrollTop - rows.clientHeight < 60;
  rows.append(r);
  if (stick) rows.scrollTop = rows.scrollHeight; else $('#jump').hidden = false;
  return r;
}
const now = { who: '', t0: 0, txt: '' };
function nowSet(who, txt = '') { now.who = who; now.t0 = Date.now(); now.txt = txt; $('#now').hidden = false; $('#now').classList.add('busy'); paintNow(); }
function nowAdd(t) { now.txt = (now.txt + t).slice(-900); paintNow(); }
function nowEnd() { $('#now').classList.remove('busy'); $('#now').hidden = true; }
function paintNow() { $('#now-who').innerHTML = `<span>${esc(now.who)}</span><em>${Math.round((Date.now() - now.t0) / 1000)} s</em>`; $('#now-txt').textContent = now.txt; }
setInterval(() => { if (!$('#now').hidden) paintNow(); }, 1000);
const sevs = (c) => `<span class="cnt"><span class="${c.ERROR ? 'e' : ''}">${c.ERROR} ERROR</span> · <span class="${c.WARNING ? 'w' : ''}">${c.WARNING} WARNING</span></span>`;
const flist = (fs, K, max = 6) => `<ul>${fs.slice(0, max).map((f) => { const okEl = !K || (f.elements ?? []).some((k) => K[k]); return `<li class="${okEl ? '' : 'rej'}"><span class="sev ${f.severity}">${f.severity[0]}</span>${esc(f.title)} <span class="k">${esc((f.elements ?? []).slice(0, 2).join(', '))}${okEl ? '' : ' · abgelehnt: Bauteil existiert nicht'}${f.issueId ? ` · ↺ ${esc(f.issueId)}` : ''}</span></li>`; }).join('')}${fs.length > max ? `<li class="k">… ${fs.length - max} weitere</li>` : ''}</ul>`;

$('#rows').addEventListener('scroll', () => { const rows = $('#rows'); if (rows.scrollHeight - rows.scrollTop - rows.clientHeight < 60) $('#jump').hidden = true; });
$('#jump').addEventListener('click', () => { const rows = $('#rows'); rows.scrollTop = rows.scrollHeight; $('#jump').hidden = true; });

// ── team events ────────────────────────────────────────────────────────────
const reviewers = {};
function onEvent(e) {
  switch (e.type) {
    case 'phase':
      if (e.phase === 'design') { stage('design'); }
      if (e.phase === 'render') stage('render');
      if (e.phase === 'review') { stage('review'); nowSet(`5 Prüfende · v${e.v}`, 'Visual QA schaut die Pläne an, Tragwerk, Haustechnik, Energie/Fassade und Brandschutz lesen das Modell …\n'); }
      if (e.phase === 'issues') stage('issues');
      if (e.phase === 'converged') { stage('issues', 'done'); log('sys', `v${e.v}: kein ERROR mehr offen, das Team hört auf.`); }
      break;
    case 'agent':
      if (e.role === 'architect') {
        if (e.status === 'start') { nowSet(`Architektur · v${e.v} · ${modelName(e.model)}`, e.v > 1 ? 'liest die offenen Issues …\n' : 'liest Brief und Standort …\n'); log('a', `Architektur v${e.v} beginnt`, `${modelName(e.model)} · ${e.v > 1 ? 'bearbeitet die offenen Issues' : 'Entwurf nach Brief und Wunsch'}`); }
        if (e.status === 'done' && e.notes) log('a', `Architektur v${e.v}: Notizen`, esc(e.notes).slice(0, 1200));
        break;
      }
      if (e.status === 'start') reviewers[e.name] = true;
      else if (e.status === 'error') log('a', `${esc(e.name)}: keine gültige Antwort`, esc(e.error), 'bad');
      else { const r = e.review; const K = S.stands.at(-1)?.comp.keys; log('a', `${esc(e.name)}${e.role === 'visual' ? ` · ${r.verdict}` : ''} <span class="k">${modelName(e.model)}</span>`, `${esc(r.summary)}${flist(r.findings, K)}${r.resolved.length ? `<ul>${r.resolved.map((x) => `<li><span class="sev OK">✓</span>erledigt: <span class="k">${esc(x.issueId)}</span></li>`).join('')}</ul>` : ''}`); }
      break;
    case 'thinking': if (e.name.startsWith('Architektur')) nowAdd(e.delta); else nowAdd(e.delta.length > 0 && Math.random() < 0.2 ? '' : ''), nowAdd(e.delta); break;
    case 'text': nowAdd(e.delta); break;
    case 'code': {
      S.code = e.code; S.codeLive = !!e.partial;
      if (e.partial) { const n = e.code.split('\n').length; $('#now-who').dataset.lines = n; now.txt = `schreibt den Generator: ${n} Zeilen, ${(e.code.length / 1000).toFixed(1)} kB …\n\n` + e.code.split('\n').slice(-5).join('\n'); paintNow(); }
      else { log('a', 'Generator abgegeben', `${e.code.split('\n').length} Zeilen JavaScript · Entwurfsabsicht, kein IFC`); stage('compile'); }
      if (S.cur >= 0) { const tb = document.querySelector('#tabs [data-t="code"]'); if (tb) tb.classList.toggle('live', S.codeLive); }
      if (S.tab === 'code') renderCode();
      break;
    }
    case 'selfcheck': {
      const r = e.result; stage('check');
      if (r.ok) {
        const st = addStand({ id: `v${e.v}r${e.run}`, label: `v${e.v}.${e.run}`, long: `v${e.v}, Prüflauf ${e.run}`, design: r.design, comp: r.comp, checks: r.checks, code: r.code, final: false });
        log('c', `Compiler + Prüfungen · v${e.v} Lauf ${e.run}`, `IFC mit ${r.elements} Bauteilen in ${r.ms} ms, ohne KI. ${sevs(r.counts)}${st.kept ? `<br><span class="k">${st.kept.common} von ${st.kept.total} GlobalIds gleich wie ${esc(st.kept.vs)}</span>` : ''}${r.findings.length ? flist(r.findings) : ''}`);
        nowSet(`Architektur · v${e.v}`, r.counts.ERROR ? `liest ${r.counts.ERROR} ERROR und korrigiert …\n` : 'prüft das Ergebnis …\n');
      } else log('c', `${r.stage === 'generator' ? 'Generator' : r.stage === 'compiler' ? 'Compiler' : 'Prüfungen'} lehnt ab · Lauf ${e.run}`, esc(r.error ?? (r.problems ?? []).slice(0, 6).map((p) => `${p.key}: ${p.msg}`).join('\n')), 'bad');
      stage('check', 'done');
      break;
    }
    case 'version': {
      const V = e.V; const st = S.stands.findLast((x) => x.comp === V.comp);
      if (st) { st.final = true; st.label = `v${V.v}`; st.long = `Version ${V.v}`; st.V = V; showStand(S.stands.indexOf(st)); }
      log('c', `Version ${V.v} abgegeben`, `IDS ${V.checks.metrics.ids.filter((s) => s.status === 'pass').length}/${V.checks.metrics.ids.length} · Georeferenz ${esc(V.checks.georef.crs)} (LoGeoRef ${V.checks.georef.level}) · ${sevs(V.checks.counts)}`);
      break;
    }
    case 'issues': {
      const V = e.V; nowEnd(); stage('issues', 'done');
      S.bcf = V.bcf; $('#dl-bcf').disabled = false;
      log('c', `Issue-Register → BCF · v${V.v}`, `${V.issueStats.new} neu · ${V.issueStats.open} offen · ${V.issueStats.closed} erledigt${V.review.rejected.length ? ` · ${V.review.rejected.length} Agenten-Befunde abgelehnt` : ''}<br><span class="cnt"><span class="${V.openErrors ? 'e' : ''}">${V.openErrors} ERROR offen</span> · <span class="${V.openWarnings ? 'w' : ''}">${V.openWarnings} WARNING offen</span></span>`);
      renderRegister(); break;
    }
    case 'cost': $('#costbox').hidden = false; $('#cost').textContent = e.total.toFixed(2); break;
    case 'done': nowEnd(); log('sys', `Fertig nach ${e.seconds} s, Kosten ca. $${e.cost.toFixed(2)}. Unten: Issue-Register. Oben rechts: alles herunterladen.`); finish(); break;
    case 'error': nowEnd(); log('sys', `Abbruch: ${esc(explain(e))}`, '', 'bad'); showErr(explain(e)); finish(); break;
  }
}
function explain(e) {
  const s = e.status, m = e.error ?? '';
  if (s === 401) return 'Der API-Schlüssel wurde abgelehnt (401).';
  if (s === 403) return 'Dieser Schlüssel darf das Modell nicht verwenden (403).';
  if (s === 429) return 'Zu viele Anfragen gleichzeitig (429). In einer Minute nochmals starten oder Prüfende auf Haiku stellen.';
  if (/credit balance/i.test(m)) return 'Kein Guthaben auf dem API-Konto.';
  if (s === 529 || /overloaded/i.test(m)) return 'Die API ist gerade überlastet (529). In einer Minute nochmals versuchen.';
  return m;
}

// ── issue register ─────────────────────────────────────────────────────────
function renderRegister() {
  const L = S.team?.ledger ?? { issues: {} };
  const rows = [];
  for (const i of Object.values(L.issues).sort((a, b) => (a.status > b.status ? -1 : a.status < b.status ? 1 : a.severity > b.severity ? 1 : -1))) {
    const st = i.status === 'Open' ? 'open' : 'closed';
    if (S.filter !== 'all' && S.filter !== st) continue;
    rows.push(`<tr class="${st}"><td><span class="st-${st}">${st === 'open' ? 'OFFEN' : `ERLEDIGT v${i.closedIn}`}</span><span class="k">seit v${i.firstSeen}</span></td><td><span class="sev ${i.severity}">${i.severity}</span></td><td><span class="t">${esc(i.title)}</span><span class="k">${esc(i.id)}</span></td><td>${esc(i.origin)}<span class="k">${esc(i.discipline)}</span></td><td>${i.elements.slice(0, 3).map((k, n) => `<span class="k">${esc(k)} → ${esc(i.guids[n])}</span>`).join('')}</td><td><details><summary>${i.history.length} Einträge</summary>${i.history.map((h) => `<p><b>v${h.v} ${esc(h.event)}:</b> ${esc(h.text).slice(0, 500)}</p>`).join('')}</details></td></tr>`);
  }
  if (S.filter === 'rejected' || S.filter === 'all') for (const st of S.stands.filter((x) => x.V?.review)) for (const r of st.V.review.rejected) rows.push(`<tr class="closed"><td><span class="st-rej">ABGELEHNT</span><span class="k">${esc(st.label)}</span></td><td></td><td><span class="t">${esc(r.title ?? '–')}</span></td><td>${esc(r.source)}</td><td><span class="k">${esc(r.reason)}</span></td><td></td></tr>`);
  $('#reg').innerHTML = rows.join('') || `<tr><td colspan="6" class="mute">${S.team ? 'keine Einträge in dieser Ansicht' : 'Noch kein Lauf. Das Register füllt sich, sobald die Prüfenden urteilen.'}</td></tr>`;
}
$('#filters').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; S.filter = b.dataset.f; document.querySelectorAll('#filters button').forEach((x) => x.classList.toggle('on', x === b)); renderRegister(); });

// ── downloads: always the stand on the sheet ───────────────────────────────
const save = (blob, name) => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); };
const slug = (s) => s.replace(/[^\w.]+/g, '_');
$('#dl-ifc').addEventListener('click', () => { const st = S.stands[S.cur]; if (st) save(new Blob([st.comp.ifc], { type: 'application/x-step' }), `loorenstrasse62_${slug(st.label)}.ifc`); });
$('#dl-bcf').addEventListener('click', () => { if (S.bcf) save(new Blob([S.bcf], { type: 'application/octet-stream' }), 'loorenstrasse62_issues.bcf'); });
$('#dl-ids').addEventListener('click', () => save(new Blob([S.data.idsXml], { type: 'application/xml' }), 'loorenstrasse62_requirements.ids'));
$('#dl-zip').addEventListener('click', async () => {
  const z = new JSZip();
  for (const st of S.stands) { const d = `${slug(st.label)}/`; z.file(`${d}model.ifc`, st.comp.ifc); z.file(`${d}design.json`, JSON.stringify(st.design, null, 1)); z.file(`${d}generator.js`, st.code ?? ''); z.file(`${d}checks.json`, JSON.stringify(st.checks, null, 1)); if (st.V?.review) z.file(`${d}review.json`, JSON.stringify(st.V.review, null, 1)); if (st.V?.bcf) z.file(`${d}issues.bcf`, st.V.bcf); st.images.forEach((im) => z.file(`${d}plaene/${slug(im.name)}.png`, im.url.split(',')[1], { base64: true })); }
  if (S.bcf) z.file('issues.bcf', S.bcf);
  z.file('requirements.ids', S.data.idsXml); z.file('brief.json', JSON.stringify(S.data.brief, null, 1)); if (S.team) z.file('issues.json', JSON.stringify(S.team.ledger, null, 1)); z.file('report.md', report());
  save(await z.generateAsync({ type: 'blob' }), `agententeam_${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.zip`);
});
function report() {
  const T = S.team, L = Object.values(T?.ledger.issues ?? {}), finals = S.stands.filter((x) => x.final);
  const last = S.stands.at(-1);
  return [`# Agententeam – Bericht`, '', `Projekt: ${S.data.brief.project} · ${new Date().toLocaleString('de-CH')}`, `Wunsch: ${T?.wishes || '–'}`, T ? `Modelle: Architektur ${T.models.architect}, Prüfende ${T.models.reviewer} · Kosten ca. $${T.cost.toFixed(2)}` : 'Kein Agentenlauf, nur Referenzentwurf.', '',
    '## Stände', '', '| Stand | Bauteile | GlobalIds gleich | IDS | Prüfregeln E/W |', '|---|---|---|---|---|',
    ...S.stands.map((s) => `| ${s.long ?? s.label} | ${s.comp.elements} | ${s.kept ? `${s.kept.common}/${s.kept.total} wie ${s.kept.vs}` : '–'} | ${s.checks.metrics.ids.filter((x) => x.status === 'pass').length}/${s.checks.metrics.ids.length} | ${s.checks.counts.ERROR}/${s.checks.counts.WARNING} |`), '',
    '## Was der Code geprüft hat', '', ...last.checks.ran.map((r) => `- ${r}`), '',
    '## Was nicht geprüft wurde (Fachperson)', '', ...(S.data.site.humanChecks ?? []).map((h) => `- ${typeof h === 'string' ? h : h.text ?? JSON.stringify(h)}`), ...(S.data.brief.program.notChecked ?? []).map((h) => `- ${h}`), '',
    '## Offene Issues', '', ...L.filter((i) => i.status === 'Open').map((i) => `- **${i.severity}** ${i.id} – ${i.title} (${i.origin}; ${i.elements.join(', ')})`), '',
    '## Erledigte Issues', '', ...L.filter((i) => i.status === 'Closed').map((i) => `- ${i.id} – ${i.title} (erledigt in v${i.closedIn})`), '',
    '## Abgelehnte Agenten-Befunde', '', ...finals.flatMap((s) => (s.V?.review?.rejected ?? []).map((r) => `- ${s.label} ${r.source}: ${r.title ?? ''} – ${r.reason}`)), '',
    '## Notizen der Architektur', '', ...finals.filter((s) => s.V).map((s) => `### ${s.label}\n\n${s.V.notes || '–'}\n`),
    '## Freigabe', '', '| Rolle | Name | Datum | Visum |', '|---|---|---|---|', '| Architektur |  |  |  |', '| BIM-Koordination |  |  |  |', '| Bauherrschaft |  |  |  |'].join('\n');
}

// ── login: the course key ships encrypted; the course password decrypts it here ──
const b64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
async function decryptCourseKey(pw) {
  const enc = await fetch(`${BASE}data/course-key.json`).then((r) => (r.ok ? r.json() : null));
  if (!enc) throw new Error('Auf dieser Seite ist kein Kurs-Konto hinterlegt.');
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pw.trim().normalize('NFC').toLowerCase()), 'PBKDF2', false, ['deriveKey']);
  const aes = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt: b64(enc.salt), iterations: enc.iter, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
  try { return new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64(enc.iv) }, aes, b64(enc.ct))); }
  catch { throw new Error('Passwort stimmt nicht.'); }
}
function setLogin(k) {
  S.courseKey = k;
  $('#login').classList.toggle('on', !!k); $('#login-ok').hidden = !k; $('#login-err').hidden = true;
  $('#who').textContent = k ? 'Kurs-Konto' : 'nicht angemeldet'; $('#who').classList.toggle('on', !!k);
  try { if (k) sessionStorage.setItem('abt-course', k); else sessionStorage.removeItem('abt-course'); } catch {}
}
$('#login-form').addEventListener('submit', async (e) => {
  e.preventDefault(); const btn = e.target.querySelector('button'); btn.disabled = true; btn.textContent = 'prüft …';
  try { setLogin(await decryptCourseKey($('#pw').value)); $('#pw').value = ''; }
  catch (err) { $('#login-err').hidden = false; $('#login-err').textContent = err.message; }
  finally { btn.disabled = false; btn.textContent = 'Anmelden'; }
});
$('#logout').addEventListener('click', (e) => { e.preventDefault(); setLogin(null); });
try { const k = sessionStorage.getItem('abt-course'); if (k) setLogin(k); } catch {}
try { const k = sessionStorage.getItem('abt-key'); if (k) { $('#key').value = k; $('#remember').checked = true; $('#ownkey').open = true; } } catch {}

// ── brief + start ──────────────────────────────────────────────────────────
const showErr = (m) => { $('#err').hidden = !m; $('#err').textContent = m ?? ''; };
function estimate() {
  const arch = $('#m-arch').value, rev = $('#m-rev').value, n = Number($('#cycles').value), opus = arch.includes('opus');
  const pa = PRICES[arch], pr = PRICES[rev];
  const archV = ((opus ? 30 : 20) * pa[1] + 120 * pa[3] + 40 * pa[2]) / 1000, revV = (5 * (28 * pr[0] + 3 * pr[1])) / 1000;
  $('#estimate').textContent = `ca. $${(archV + revV).toFixed(2)}–${((archV + revV) * n * 1.5).toFixed(2)} · ${opus ? 8 : 3}–${n * (opus ? 20 : 7)} min · hört auf, sobald kein ERROR offen ist`;
}
['#m-arch', '#m-rev', '#cycles'].forEach((s) => $(s).addEventListener('change', estimate));
$('#chips').addEventListener('click', (e) => { const w = e.target.closest('li')?.dataset.w; if (w) { const t = $('#wishes'); t.value = t.value.trim() ? `${t.value.trim()}\n${w}` : w; } });

$('#start').addEventListener('click', async () => {
  showErr(null);
  if (!S.data) return showErr('Daten werden noch geladen …');
  const own = $('#key').value.trim(), key = own || S.courseKey;
  if (!key) { $('#pw').focus(); return showErr('Zuerst mit dem Kurs-Passwort anmelden.'); }
  if (!/^sk-ant-/.test(key)) return showErr('Ein eigener Schlüssel beginnt mit sk-ant-.');
  if (!own) {
    let n = 0; const day = new Date().toISOString().slice(0, 10);
    try { const r = JSON.parse(localStorage.getItem('abt-runs') ?? '{}'); n = r.day === day ? r.n : 0; } catch {}
    if (n >= 3) return showErr('Mit dem Kurs-Konto sind 3 Läufe pro Tag und Browser möglich.');
    try { localStorage.setItem('abt-runs', JSON.stringify({ day, n: n + 1 })); } catch {}
  }
  try { if (own && $('#remember').checked) sessionStorage.setItem('abt-key', own); else sessionStorage.removeItem('abt-key'); } catch {}
  // keep the reference, drop earlier runs
  S.stands = S.stands.filter((x) => x.id === 'ref'); S.bcf = null; $('#dl-bcf').disabled = true; showStand(0);
  $('#rows').innerHTML = ''; $('#costbox').hidden = true;
  const client = new Anthropic({ apiKey: key, dangerouslyAllowBrowser: true, maxRetries: 3 });
  const arch = $('#m-arch').value;
  S.team = new Team({ client, brief: S.data.brief, site: S.data.site, idsXml: S.data.idsXml, cycles: Number($('#cycles').value), wishes: $('#wishes').value, startCode: $('#mode').value === 'ref' ? S.data.code : null, startChecks: $('#mode').value === 'ref' ? S.stands[0].checks : null,
    models: { architect: arch, reviewer: $('#m-rev').value, architectEffort: arch.includes('opus') ? 'medium' : 'low' }, render: (D, checks, v) => S.stands.findLast((x) => x.design === D)?.forModel ?? renderImages(D, checks, `v${v}`).map((x) => ({ name: x.name, base64: toPngBase64(x.c) })), emit: onEvent });
  renderRegister();
  S.running = true; $('#start').disabled = true; $('#stop').hidden = false;
  resetProcess(); stage('brief');
  log('c', 'Brief → IDS', `${S.data.brief.requirements.length} AIA-Zeilen, davon ${S.data.brief.requirements.filter((r) => r.ifc).length} als IDS-Spezifikationen, der Rest als Prüfregel. Parzelle ${esc(S.data.site.parcel.number)}, ${S.data.site.parcel.registeredArea} m², Zone W3.`);
  if ($('#wishes').value.trim()) log('sys', `Wunsch: ${esc($('#wishes').value.trim())}`);
  stage('brief', 'done');
  if (innerWidth < 1100) $('#logpanel').scrollIntoView({ behavior: 'smooth' });
  await S.team.run();
});
$('#stop').addEventListener('click', () => S.team?.abort());
function finish() { S.running = false; S.codeLive = false; $('#start').disabled = false; $('#stop').hidden = true; document.querySelectorAll('#process li.active').forEach((n) => n.classList.replace('active', 'done')); showStand(S.cur); }

// ── Gegenprobe: falsify the stand on the sheet, run only code ──────────────
$('#sabo-run').addEventListener('click', async () => {
  const base = S.stands[S.cur]; if (!base) return;
  const sel = [...document.querySelectorAll('#sabo input:checked')].map((i) => i.value);
  const D = structuredClone(base.design); const did = [];
  if (sel.includes('move')) { const sh = (p) => { p[0] += 4; }; D.walls.forEach((w) => { sh(w.start); sh(w.end); }); [...D.slabs, ...D.spaces].forEach((s) => s.polygon.forEach(sh)); (D.stairs ?? []).forEach((t) => sh(t.position)); (D.columns ?? []).forEach((c) => sh(c.position)); D.slabs.forEach((s) => (s.openings ?? []).forEach((h) => { h.x += 4; })); did.push('Gebäude +4 m nach Osten'); }
  if (sel.includes('door')) { const d = D.openings.find((o) => o.reference === 'Wohnungstuer'); if (d) { d.fireRating = 'EI 15'; did.push(`${d.key}: EI 15`); } }
  if (sel.includes('win')) { const rooms = new Set(D.spaces.filter((s) => s.usage === 'Zimmer').map((s) => s.key)); const n = D.openings.length; D.openings = D.openings.filter((o) => !(o.kind === 'window' && rooms.has(o.space))); did.push(`${n - D.openings.length} Zimmerfenster entfernt`); }
  if (sel.includes('u')) { D.walls.filter((w) => w.type === 'external').forEach((w) => { w.uValue = 0.24; }); did.push('Aussenwände U = 0.24'); }
  if (sel.includes('storey')) { const top = [...D.storeys].sort((a, b) => a.elevation - b.elevation).at(-1); const nk = `${top.key}X`; D.storeys.push({ key: nk, name: 'Aufstockung', elevation: top.elevation + top.height, height: top.height }); D.slabs.filter((s) => s.storey === top.key && s.kind === 'roof').forEach((s) => { s.storey = nk; }); D.walls.filter((w) => w.storey === top.key && w.type === 'external').forEach((w) => D.walls.push({ ...structuredClone(w), key: `${w.key}-X`, storey: nk })); did.push('ein Vollgeschoss mehr'); }
  if (sel.includes('key')) { const map = {}; [D.storeys, D.walls, D.openings, D.slabs, D.spaces, D.stairs ?? [], D.columns ?? []].flat().forEach((x) => { map[x.key] = `${x.key}_neu`; x.key = map[x.key]; }); D.walls.forEach((w) => { w.storey = map[w.storey]; }); D.openings.forEach((o) => { o.wall = map[o.wall]; if (o.space) o.space = map[o.space]; }); [...D.slabs, ...D.spaces, ...(D.stairs ?? []), ...(D.columns ?? [])].forEach((x) => { x.storey = map[x.storey]; }); did.push('alle Keys umbenannt'); }
  const comp = compileDesign(D);
  if (!comp.ok) { $('#sabo-out').innerHTML = `<div><div class="verdict no">Compiler lehnt ab</div><ul>${comp.problems.slice(0, 8).map((p) => `<li><span class="k">${esc(p.key)}</span> ${esc(p.msg)}</li>`).join('')}</ul></div>`; return; }
  const t0 = performance.now();
  const c = await checkDesign({ v: 99, D, K: comp.keys, ifc: comp.ifc, site: S.data.site, brief: S.data.brief, idsXml: S.data.idsXml });
  const ms = Math.round(performance.now() - t0);
  const baseG = new Set(Object.values(base.comp.keys).map((x) => x.guid)); const kept = Object.values(comp.keys).filter((x) => baseG.has(x.guid)).length;
  const newF = c.findings.filter((f) => !base.checks.findings.some((b) => b.id === f.id || (sel.includes('key') && b.rule === f.rule)));
  const caught = sel.length === 0 ? null : newF.length > 0 || (sel.includes('key') && kept === 0);
  const st = [...D.storeys].sort((a, b) => a.elevation - b.elevation);
  const pic = sel.includes('move') ? drawSite(D, c, S.data.site, 'Gegenprobe') : drawPlan(D, c, (st[1] ?? st[0]).key, 'Gegenprobe');
  $('#sabo-out').innerHTML = `<div><div class="verdict ${caught === false ? 'no' : caught ? 'ok' : ''}">${caught === null ? 'Nichts gewählt' : caught ? 'Erkannt' : 'Nicht erkannt: hier fehlt eine Prüfung'}</div>
    <p class="k">${esc(did.join(' · ') || '–')} · geprüft in ${ms} ms, ohne KI</p>${sevs(c.counts)}
    <ul>${newF.slice(0, 12).map((f) => `<li><span class="sev ${f.severity}">${f.severity[0]}</span><b>${esc(f.rule)}</b> ${esc(f.title)} <span class="k">${esc(f.elements.slice(0, 2).join(', '))}</span></li>`).join('')}</ul>
    ${sel.includes('key') ? `<p><b>GlobalIds:</b> ${kept} von ${Object.keys(comp.keys).length} gleich wie ${esc(base.long ?? base.label)}. ${kept === 0 ? 'Für die Koordination sind das lauter neue Bauteile; jedes BCF-Topic verliert seinen Bezug.' : ''}</p>` : ''}</div>
    <img src="${pic.toDataURL()}" alt="verfälschter Stand">`;
});

estimate();
loadData().catch((e) => showErr(`Daten konnten nicht geladen werden: ${e.message}`));
