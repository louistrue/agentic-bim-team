// Drawings from the design intent, on <canvas> (browser only). Port of scripts/plan.py and siteplan.py,
// plus a simple axonometric. These PNGs are what the Visual-QA agent actually looks at.
// Elements named in open ERROR findings are drawn red.

const UNITCOL = ['#e8efe4', '#e6edf2', '#f2ece1', '#efe6ee', '#e9eee8', '#f1efe4'];
const area = (poly) => Math.abs(poly.reduce((s, p, i) => { const q = poly[(i + 1) % poly.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0)) / 2;
const FONT = (s, b) => `${b ? '700 ' : ''}${s}px "Inter", "Helvetica Neue", Arial, sans-serif`;

function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); return [c, g]; }
const poly = (g, pts, fill, stroke, lw = 1) => { g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath(); if (fill) { g.fillStyle = fill; g.fill(); } if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw; g.stroke(); } };
const line = (g, a, b, col, w = 1) => { g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.strokeStyle = col; g.lineWidth = w; g.stroke(); };
const text = (g, s, x, y, font, col, align = 'center') => { g.font = font; g.fillStyle = col; g.textAlign = align; g.textBaseline = 'middle'; g.fillText(s, x, y); };

export function badKeys(checks) { return new Set((checks?.findings ?? []).filter((f) => f.severity === 'ERROR').flatMap((f) => f.elements)); }

/** Floor plan of one storey → canvas */
export function drawPlan(D, checks, storeyKey, v) {
  const bad = badKeys(checks);
  const pts = D.walls.flatMap((w) => [w.start, w.end]);
  const x0 = Math.min(...pts.map((p) => p[0])) - 2, x1 = Math.max(...pts.map((p) => p[0])) + 2;
  const y0 = Math.min(...pts.map((p) => p[1])) - 2, y1 = Math.max(...pts.map((p) => p[1])) + 2;
  const s = 1400 / Math.max(x1 - x0, (y1 - y0) * 1.5);
  const W = Math.round((x1 - x0) * s) + 40, H = Math.round((y1 - y0) * s) + 130;
  const T = (p) => [20 + (p[0] - x0) * s, 110 + (y1 - p[1]) * s];
  const [c, g] = canvas(W, H);
  const st = D.storeys.find((x) => x.key === storeyKey);
  const spaces = (D.spaces ?? []).filter((sp) => sp.storey === storeyKey);
  const units = [...new Set(spaces.map((sp) => sp.unit).filter((u) => u && u !== '-'))].sort();
  for (const sp of spaces) poly(g, sp.polygon.map(T), bad.has(sp.key) ? '#f6c9cf' : (!sp.unit || sp.unit === '-') ? '#f4f4f2' : UNITCOL[units.indexOf(sp.unit) % UNITCOL.length]);
  for (const t of (D.stairs ?? []).filter((t) => t.storey === storeyKey)) {
    const a = ((t.directionDeg ?? 0) * Math.PI) / 180, ux = Math.cos(a), uy = Math.sin(a), nx = -uy, ny = ux;
    const L = (t.risers - 1) * t.tread, p = t.position, w = t.width;
    poly(g, [[p[0], p[1]], [p[0] + ux * L, p[1] + uy * L], [p[0] + ux * L + nx * w, p[1] + uy * L + ny * w], [p[0] + nx * w, p[1] + ny * w]].map(T), '#fff', bad.has(t.key) ? '#d7263d' : '#232628', 1.5);
    for (let i = 1; i < t.risers - 1; i++) { const q = [p[0] + ux * i * t.tread, p[1] + uy * i * t.tread]; line(g, T(q), T([q[0] + nx * w, q[1] + ny * w]), '#8a8a86'); }
    const m0 = [p[0] + (nx * w) / 2, p[1] + (ny * w) / 2], m1 = [m0[0] + ux * L, m0[1] + uy * L]; line(g, T(m0), T(m1), '#232628', 2);
    const e = T(m1); g.beginPath(); g.arc(e[0], e[1], 5, 0, 2 * Math.PI); g.fillStyle = '#232628'; g.fill();
  }
  const ops = {}; for (const o of D.openings ?? []) (ops[o.wall] ??= []).push(o);
  for (const w of D.walls.filter((w) => w.storey === storeyKey)) {
    const a = w.start, b = w.end, L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 0.01) continue;
    const ux = (b[0] - a[0]) / L, uy = (b[1] - a[1]) / L, nx = -uy, ny = ux, h = w.thickness / 2;
    const cuts = (ops[w.key] ?? []).map((o) => [o.offset, o.offset + o.width, o]).sort((p, q) => p[0] - q[0]);
    const segs = []; let pos = 0; for (const [c0, c1] of cuts) { segs.push([pos, c0]); pos = c1; } segs.push([pos, L]);
    const col = bad.has(w.key) ? '#d7263d' : ['external', 'core', 'party'].includes(w.type) ? '#232628' : '#9a9d9f';
    const P = (t, f) => [a[0] + ux * t + nx * f, a[1] + uy * t + ny * f];
    for (const [s0, s1] of segs) if (s1 - s0 > 0.01) poly(g, [P(s0, h), P(s1, h), P(s1, -h), P(s0, -h)].map(T), col);
    for (const [c0, c1, o] of cuts) {
      const oc = bad.has(o.key) ? '#d7263d' : null;
      if (o.kind === 'window') for (const f of [-h, 0, h]) line(g, T(P(c0, f)), T(P(c1, f)), oc ?? '#5b7c8f', 2);
      else {
        const hinge = T(P(c0, 0)), tip = T([P(c0, 0)[0] + nx * (c1 - c0), P(c0, 0)[1] + ny * (c1 - c0)]), end = T(P(c1, 0));
        line(g, hinge, tip, oc ?? '#a0703c', 3);
        const r = (c1 - c0) * s, a0 = Math.atan2(tip[1] - hinge[1], tip[0] - hinge[0]), a1 = Math.atan2(end[1] - hinge[1], end[0] - hinge[0]);
        let d = a1 - a0; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
        g.beginPath(); g.arc(hinge[0], hinge[1], r, a0, a1, d < 0); g.strokeStyle = oc ?? '#a0703c'; g.lineWidth = 1; g.stroke();
      }
    }
  }
  for (const sp of spaces) {
    const c0 = sp.polygon.reduce((q, p) => [q[0] + p[0] / sp.polygon.length, q[1] + p[1] / sp.polygon.length], [0, 0]);
    const [x, y] = T(c0), A = area(sp.polygon), fs = A > 6 ? 15 : 11;
    text(g, sp.longName || sp.usage || '', x, y - 9, FONT(fs, true), '#232628'); text(g, `${A.toFixed(1)} m²`, x, y + 9, FONT(fs - 2), '#52636b');
  }
  text(g, `${D.name ?? ''} · Grundriss ${st?.name ?? storeyKey} · ${typeof v === "number" ? "v" + v : v}`, 20, 30, FONT(26, true), '#232628', 'left');
  const leg = units.map((u) => `${u}: ${Math.round(spaces.filter((sp) => sp.unit === u).reduce((q, sp) => q + area(sp.polygon), 0))} m² NF`).join(' · ');
  text(g, leg + (bad.size ? '   ·   rot = offener ERROR' : ''), 20, 70, FONT(17), '#52636b', 'left');
  poly(g, [[W - 50, 20], [W - 62, 60], [W - 38, 60]], '#232628'); text(g, 'N', W - 50, 74, FONT(15, true), '#232628');
  line(g, [20, H - 24], [20 + 5 * s, H - 24], '#232628', 4); text(g, '5 m', 28 + 5 * s, H - 24, FONT(14), '#232628', 'left');
  return c;
}

/** Simple axonometric of walls, slabs and windows (painter's algorithm) → canvas */
export function drawAxon(D, checks, v, view = 'sw') {
  const bad = badKeys(checks);
  const S = Object.fromEntries(D.storeys.map((s) => [s.key, s]));
  const az = view === 'sw' ? (-135 * Math.PI) / 180 : (45 * Math.PI) / 180, el = (30 * Math.PI) / 180;
  // camera looking from direction az (from north, clockwise) downwards el
  const cx = Math.sin(az), cy = Math.cos(az);
  const proj = (p) => { const x = p[0], y = p[1], z = p[2]; const u = x * cy - y * cx; const d = x * cx + y * cy; return [u, -z * Math.cos(el) + d * Math.sin(el), -d * Math.cos(el) - z * Math.sin(el)]; };
  const faces = [];
  const push = (pts, fill, stroke) => { const q = pts.map(proj); faces.push({ q, depth: q.reduce((s, p) => s + p[2], 0) / q.length, fill, stroke }); };
  const slabsAbove = (st) => { const ss = [...D.storeys].sort((a, b) => a.elevation - b.elevation); const i = ss.findIndex((x) => x.key === st); const nx = ss[i + 1]; const c = (D.slabs ?? []).filter((s) => (nx && s.storey === nx.key && s.kind === 'floor') || (s.storey === st && s.kind === 'roof')); return c.length ? Math.max(...c.map((s) => s.thickness)) : 0; };
  for (const sl of D.slabs ?? []) {
    const st = S[sl.storey]; if (!st) continue; const z1 = sl.kind === 'roof' ? st.elevation + st.height : st.elevation, z0 = z1 - sl.thickness;
    const col = bad.has(sl.key) ? '#e98a96' : sl.kind === 'roof' ? '#8f9ea5' : '#a9b7bd';
    push(sl.polygon.map((p) => [p[0], p[1], z1]), col, '#55606a');
    sl.polygon.forEach((p, i) => { const q = sl.polygon[(i + 1) % sl.polygon.length]; push([[p[0], p[1], z0], [q[0], q[1], z0], [q[0], q[1], z1], [p[0], p[1], z1]], '#7d8b91', '#55606a'); });
  }
  for (const w of D.walls ?? []) {
    const st = S[w.storey]; if (!st || w.type !== 'external' && w.type !== 'core') continue;
    const z0 = st.elevation, z1 = st.elevation + st.height - slabsAbove(w.storey);
    const L = Math.hypot(w.end[0] - w.start[0], w.end[1] - w.start[1]); if (L < 0.01) continue;
    const ux = (w.end[0] - w.start[0]) / L, uy = (w.end[1] - w.start[1]) / L, h = w.thickness / 2;
    for (const f of [h, -h]) {
      const a = [w.start[0] - uy * f, w.start[1] + ux * f], b = [w.end[0] - uy * f, w.end[1] + ux * f];
      push([[a[0], a[1], z0], [b[0], b[1], z0], [b[0], b[1], z1], [a[0], a[1], z1]], bad.has(w.key) ? '#e98a96' : w.type === 'core' ? '#c9c5bb' : '#e4e0d8', '#8a8780');
      for (const o of (D.openings ?? []).filter((o) => o.wall === w.key)) {
        const t0 = o.offset, t1 = o.offset + o.width, s0 = z0 + (o.sill ?? 0), s1 = s0 + o.height, off = f * 1.02;
        const p0 = [w.start[0] + ux * t0 - uy * off, w.start[1] + uy * t0 + ux * off], p1 = [w.start[0] + ux * t1 - uy * off, w.start[1] + uy * t1 + ux * off];
        faces.push({ ...(() => { const q = [[p0[0], p0[1], s0], [p1[0], p1[1], s0], [p1[0], p1[1], s1], [p0[0], p0[1], s1]].map(proj); return { q, depth: q.reduce((s, p) => s + p[2], 0) / 4 - 0.01 }; })(), fill: bad.has(o.key) ? '#d7263d' : o.kind === 'door' ? '#a0703c' : '#5b7c8f', stroke: null });
      }
    }
  }
  faces.sort((a, b) => b.depth - a.depth);
  const all = faces.flatMap((f) => f.q); const minX = Math.min(...all.map((p) => p[0])), maxX = Math.max(...all.map((p) => p[0])), minY = Math.min(...all.map((p) => p[1])), maxY = Math.max(...all.map((p) => p[1]));
  const s = Math.min(1300 / (maxX - minX), 800 / (maxY - minY)); const W = Math.round((maxX - minX) * s) + 80, H = Math.round((maxY - minY) * s) + 120;
  const [c, g] = canvas(W, H);
  for (const f of faces) poly(g, f.q.map((p) => [40 + (p[0] - minX) * s, 90 + (p[1] - minY) * s]), f.fill, f.stroke, 0.6);
  text(g, `${D.name ?? ''} · Axonometrie ${view === 'sw' ? 'Südwest' : 'Nordost'} · ${typeof v === "number" ? "v" + v : v}`, 20, 30, FONT(24, true), '#232628', 'left');
  text(g, 'Aussen- und Kernwände, Decken, Öffnungen' + (bad.size ? ' · rot = offener ERROR' : ''), 20, 62, FONT(16), '#52636b', 'left');
  return c;
}

/** Site plan: parcel, neighbours, footprint, facade distances → canvas */
export function drawSite(D, checks, site, v) {
  const parcel = site.parcel.polygonLocal;
  // frame: the building ± 32 m (the parcel is large; the boundary in front of each facade is what matters)
  const fp = D.walls.flatMap((w) => [w.start, w.end]);
  const bx0 = Math.min(...fp.map((p) => p[0])), bx1 = Math.max(...fp.map((p) => p[0])), by0 = Math.min(...fp.map((p) => p[1])), by1 = Math.max(...fp.map((p) => p[1]));
  const half = Math.max(bx1 - bx0, by1 - by0) / 2 + 32, mx = (bx0 + bx1) / 2, my = (by0 + by1) / 2;
  const x0 = mx - half, x1 = mx + half, y0 = my - half, y1 = my + half;
  const s = 1000 / Math.max(x1 - x0, y1 - y0), W = Math.round((x1 - x0) * s) + 40, H = Math.round((y1 - y0) * s) + 150;
  const T = (p) => [20 + (p[0] - x0) * s, 120 + (y1 - p[1]) * s];
  const [c, g] = canvas(W, H);
  g.save(); g.beginPath(); g.rect(20, 120, W - 40, H - 150); g.clip();
  for (const b of site.existingBuildings ?? []) { const [a0, b0, a1, b1] = b.bboxLocal; poly(g, [[a0, b0], [a1, b0], [a1, b1], [a0, b1]].map(T), b.toBeReplaced ? null : '#d9d6cf', b.toBeReplaced ? '#b05a5a' : '#8a8780', b.toBeReplaced ? 2 : 1); if (b.toBeReplaced) { g.setLineDash([]); } }
  poly(g, parcel.map(T), 'rgba(91,124,143,0.06)', '#5b7c8f', 2.5);
  const ground = [...D.storeys].sort((a, b) => a.elevation - b.elevation)[0];
  const bad = badKeys(checks);
  for (const sl of (D.slabs ?? []).filter((x) => x.storey === ground.key && (x.kind === 'base' || x.kind === 'floor'))) poly(g, sl.polygon.map(T), '#232628');
  for (const w of D.walls.filter((w) => w.storey === ground.key && w.type === 'external')) line(g, T(w.start), T(w.end), bad.has(w.key) ? '#d7263d' : '#232628', Math.max(2, w.thickness * s));
  g.restore();
  text(g, `${D.name ?? ''} · Situation · ${typeof v === "number" ? "v" + v : v}`, 20, 30, FONT(24, true), '#232628', 'left');
  const fac = checks?.metrics?.facades ?? [];
  text(g, `Parzelle ${site.parcel.egrid ?? ''} (blau) · Bestand grau, abzubrechender Bau rot umrandet`, 20, 62, FONT(16), '#52636b', 'left');
  text(g, fac.map((f) => `${f.facade}: ${f.actual} m (verlangt ${f.required})`).join(' · '), 20, 90, FONT(16), '#52636b', 'left');
  poly(g, [[W - 50, 20], [W - 62, 60], [W - 38, 60]], '#232628'); text(g, 'N', W - 50, 74, FONT(15, true), '#232628');
  line(g, [20, H - 20], [20 + 10 * s, H - 20], '#232628', 4); text(g, '10 m', 28 + 10 * s, H - 20, FONT(14), '#232628', 'left');
  return c;
}

/** canvas → base64 PNG (without data: prefix), downscaled for the model */
export function toPngBase64(c, maxW = 1400) {
  let src = c;
  if (c.width > maxW) { const k = maxW / c.width; const [d, g] = canvas(Math.round(c.width * k), Math.round(c.height * k)); g.drawImage(c, 0, 0, d.width, d.height); src = d; }
  return src.toDataURL('image/png').split(',')[1];
}
