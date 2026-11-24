// Work-in-progress preview: turn code that is still being streamed by the architect into a runnable
// generator, so plans can update continuously ("entsteht · ungeprüft") before a check round exists.
// Nothing here is checked or compiled to IFC; it is display only.

const TAIL = `
;return (typeof design !== 'undefined' && design && design.walls) ? design : {
  name: typeof name !== 'undefined' ? name : 'Entwurf',
  storeys: typeof storeys !== 'undefined' ? storeys : [], walls: typeof walls !== 'undefined' ? walls : [],
  openings: typeof openings !== 'undefined' ? openings : [], slabs: typeof slabs !== 'undefined' ? slabs : [],
  spaces: typeof spaces !== 'undefined' ? spaces : [], stairs: typeof stairs !== 'undefined' ? stairs : [],
  columns: typeof columns !== 'undefined' ? columns : [] };`;

const parses = (src) => { try { new Function('console', `"use strict";\n${src}`); return true; } catch { return false; } };

/** Partial generator source → runnable source (cut back to the last line that still parses), or null */
export function partialToRunnable(code, maxBacktrack = 250) {
  if (typeof code !== 'string' || code.length < 40) return null;
  const lines = code.split('\n');
  const stop = Math.max(1, lines.length - maxBacktrack);
  for (let cut = lines.length; cut >= stop; cut--) {
    const head = lines.slice(0, cut).join('\n').replace(/\breturn\s+design\s*;?\s*$/, '');
    const cand = head + TAIL;
    if (parses(cand)) return cand;
  }
  return null;
}

/** Streamed edits (the last one may be incomplete) applied to the base generator → runnable source, or null */
export function editsToRunnable(base, edits) {
  if (typeof base !== 'string' || !Array.isArray(edits) || !edits.length) return null;
  let code = base, applied = 0;
  for (const e of edits.slice(0, -1).concat(edits.length ? [edits.at(-1)] : [])) {
    if (typeof e?.find !== 'string' || typeof e?.replace !== 'string' || !e.find) continue;
    if (code.split(e.find).length - 1 !== 1) continue;
    const next = code.replace(e.find, () => e.replace);
    if (!parses(next)) continue; // the streamed last edit may still be half-written
    code = next; applied++;
  }
  return applied ? code : null;
}

/** A design is worth drawing if it has storeys and at least a few walls on a known storey */
export function drawable(D) {
  if (!D || !Array.isArray(D.storeys) || !D.storeys.length || !Array.isArray(D.walls)) return false;
  const keys = new Set(D.storeys.map((s) => s.key));
  return D.walls.filter((w) => keys.has(w.storey) && Array.isArray(w.start) && Array.isArray(w.end)).length >= 4;
}
