// Runs the architect agent's generator code (a plain JS function body that returns the design object).
// Browser: a throwaway Web Worker with network APIs removed and a hard timeout.
// Node (tests): new Function. The code only ever produces data; the compiler and checks validate it.
const WORKER_SRC = `
self.fetch = undefined; self.XMLHttpRequest = undefined; self.WebSocket = undefined; self.importScripts = undefined; self.EventSource = undefined;
self.onmessage = (e) => {
  const logs = []; const log = (...a) => logs.push(a.map(String).join(' '));
  try {
    const fn = new Function('console', '"use strict";\\n' + e.data);
    const design = fn({ log, warn: log, error: log });
    if (!design || typeof design !== 'object' || Array.isArray(design)) throw new Error('Der Code muss das Design-Objekt mit "return design;" zurückgeben (bekommen: ' + (design === null ? 'null' : Array.isArray(design) ? 'Array' : typeof design) + ').');
    self.postMessage({ ok: true, design: JSON.parse(JSON.stringify(design)), logs });
  } catch (err) { self.postMessage({ ok: false, error: String((err && err.message) || err).split('\\n')[0].slice(0, 300), logs }); }
};`;

export function runGenerator(code, { timeoutMs = 8000 } = {}) {
  if (typeof Worker === 'undefined') {
    try { const logs = []; const d = new Function('console', `"use strict";\n${code}`)({ log: (...a) => logs.push(a.join(' ')) }); if (!d || typeof d !== 'object' || Array.isArray(d)) throw new Error('Der Code muss das Design-Objekt mit "return design;" zurückgeben.'); return Promise.resolve({ ok: true, design: JSON.parse(JSON.stringify(d)), logs }); }
    catch (e) { return Promise.resolve({ ok: false, error: String((e && e.message) || e).split('\n')[0].slice(0, 300), logs: [] }); }
  }
  return new Promise((resolve) => {
    const url = URL.createObjectURL(new Blob([WORKER_SRC], { type: 'text/javascript' }));
    const w = new Worker(url);
    const done = (r) => { clearTimeout(t); w.terminate(); URL.revokeObjectURL(url); resolve(r); };
    const t = setTimeout(() => done({ ok: false, error: `Zeitlimit ${timeoutMs / 1000} s überschritten (Endlosschleife?)`, logs: [] }), timeoutMs);
    w.onmessage = (e) => done(e.data);
    w.onerror = (e) => { e.preventDefault(); done({ ok: false, error: e.message, logs: [] }); };
    w.postMessage(code);
  });
}
