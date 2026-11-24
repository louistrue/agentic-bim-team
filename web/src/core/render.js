// Drawings from the design intent, on <canvas> (browser only). Port of scripts/plan.py and siteplan.py,
// plus a simple axonometric. These PNGs are what the Visual-QA agent actually looks at.
// Elements named in open ERROR findings are drawn red.

const UNITCOL = ['#e8efe4', '#e6edf2', '#f2ece1', '#efe6ee', '#e9eee8', '#f1efe4'];
const area = (poly) => Math.abs(poly.reduce((s, p, i) => { const q = poly[(i + 1) % poly.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0)) / 2;
const FONT = (s, b) => `${b ? '700 ' : ''}${s}px "Inter", "Helvetica Neue", Arial, sans-serif`;

// drawings are made at RES × their logical size so they stay sharp when zoomed in the viewer
const RES = 1.5;
function canvas(w, h, k = RES) { const c = document.createElement('canvas'); c.width = Math.round(w * k); c.height = Math.round(h * k); const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.scale(k, k); return [c, g]; }
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

/** Axonometric 3D view → canvas. A small software renderer with a depth buffer:
 * walls are solids with their real thickness, cut around every opening (parapet below, lintel above),
 * windows and doors are panes set into the reveal, slabs and roof are prisms of their polygon.
 * Faces are shaded by orientation; edges are drawn where one face meets another. */
export function drawAxon(D, checks, v, view = 'sw') {
  const bad = badKeys(checks);
  const S = Object.fromEntries(D.storeys.map((s) => [s.key, s]));
  const ss = [...D.storeys].sort((a, b) => a.elevation - b.elevation);
  const slabAbove = (st) => { const i = ss.findIndex((x) => x.key === st); const nx = ss[i + 1]; const c = (D.slabs ?? []).filter((s) => (nx && s.storey === nx.key && s.kind === 'floor') || (s.storey === st && s.kind === 'roof')); return c.length ? Math.max(...c.map((s) => s.thickness)) : 0; };
  const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const COL = { ext: hex('#e6e1d6'), core: hex('#c9c4b8'), inner: hex('#d8d4ca'), slab: hex('#a9b4b9'), roof: hex('#9aa6ac'), glass: hex('#5b7c8f'), door: hex('#a0703c'), bad: hex('#e0505f'), badGlass: hex('#d7263d') };
  const tris = []; let faceId = 0; // {p:[3 pts], c:[r,g,b], f:faceId}
  const quad = (a, b, c, d, col) => { const f = ++faceId; tris.push({ p: [a, b, c], c: col, f }, { p: [a, c, d], c: col, f }); };
  // oriented box: base corners (ccw seen from above) at z0..z1
  const prism = (base, z0, z1, col, caps = true) => {
    const n = base.length;
    for (let i = 0; i < n; i++) { const p = base[i], q = base[(i + 1) % n]; quad([p[0], p[1], z0], [q[0], q[1], z0], [q[0], q[1], z1], [p[0], p[1], z1], col); }
    if (caps) { const t = earcut(base); let f = ++faceId; for (const [i, j, k] of t) tris.push({ p: [[...base[i], z1], [...base[j], z1], [...base[k], z1]], c: col, f }); f = ++faceId; for (const [i, j, k] of t) tris.push({ p: [[...base[i], z0], [...base[j], z0], [...base[k], z0]], c: col, f }); }
  };
  // walls, cut around openings
  const ops = {}; for (const o of D.openings ?? []) (ops[o.wall] ??= []).push(o);
  for (const w of D.walls ?? []) {
    const st = S[w.storey]; if (!st) continue;
    const L = Math.hypot(w.end[0] - w.start[0], w.end[1] - w.start[1]); if (L < 0.01) continue;
    const ux = (w.end[0] - w.start[0]) / L, uy = (w.end[1] - w.start[1]) / L, nx = -uy, ny = ux, h = w.thickness / 2;
    const z0 = st.elevation, z1 = st.elevation + st.height - slabAbove(w.storey);
    const col = bad.has(w.key) ? COL.bad : w.type === 'external' ? COL.ext : w.type === 'core' ? COL.core : COL.inner;
    const seg = (t0, t1, a, b, c = col, th = h, off = 0) => { if (t1 - t0 < 0.005 || b - a < 0.005) return; const P = (t, s) => [w.start[0] + ux * t + nx * (s + off), w.start[1] + uy * t + ny * (s + off)]; prism([P(t0, -th), P(t1, -th), P(t1, th), P(t0, th)], a, b, c); };
    const cuts = (ops[w.key] ?? []).map((o) => ({ o, t0: Math.max(0, o.offset), t1: Math.min(L, o.offset + o.width) })).sort((p, q) => p.t0 - q.t0);
    let pos = 0;
    for (const { o, t0, t1 } of cuts) {
      seg(pos, t0, z0, z1);
      const s0 = z0 + (o.sill ?? 0), s1 = Math.min(z1, s0 + o.height);
      seg(t0, t1, z0, s0); seg(t0, t1, s1, z1); // parapet, lintel
      const pane = bad.has(o.key) ? COL.badGlass : o.kind === 'door' ? COL.door : COL.glass;
      seg(t0, t1, s0, s1, pane, 0.025, w.type === 'external' ? h * 0.35 : 0); // pane in the reveal, slightly towards the outside
      pos = Math.max(pos, t1);
    }
    seg(pos, L, z0, z1);
  }
  for (const sl of D.slabs ?? []) {
    const st = S[sl.storey]; if (!st || !sl.polygon || sl.polygon.length < 3) continue;
    const z1 = sl.kind === 'roof' ? st.elevation + st.height : st.elevation;
    let base = sl.polygon.map((p) => [p[0], p[1]]); if (area2(base) < 0) base = base.reverse();
    prism(base, z1 - sl.thickness, z1, bad.has(sl.key) ? COL.bad : sl.kind === 'roof' ? COL.roof : COL.slab);
  }
  if (!tris.length) { const [c] = canvas(400, 200); return c; }
  // camera: axonometric from the chosen side, 30° down
  const az = view === 'sw' ? (-135 * Math.PI) / 180 : (45 * Math.PI) / 180, el = (30 * Math.PI) / 180;
  const cx = Math.sin(az), cy = Math.cos(az), ce = Math.cos(el), se = Math.sin(el);
  const proj = (p) => { const d = p[0] * cx + p[1] * cy; return [p[0] * cy - p[1] * cx, -p[2] * ce + d * se, -d * ce - p[2] * se]; }; // x, y (screen), depth (larger = farther)
  const view3 = [cx * ce, cy * ce, se]; // direction from the model towards the viewer
  const light = norm3([cx * 0.55 - cy * 0.6, cy * 0.55 + cx * 0.6, 0.9]); // from the viewer's left shoulder, so both views read the same
  const P = tris.map((t) => t.p.map(proj));
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const q of P) for (const p of q) { minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0]); minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]); }
  const F = 1.6; // pixels per logical px (sharp when zoomed)
  const sc = Math.min(1300 / (maxX - minX), 760 / (maxY - minY)) * F, ox = 40 * F, oy = 96 * F;
  const W = Math.round((maxX - minX) * sc + 80 * F), H = Math.round((maxY - minY) * sc + 130 * F);
  const [cv, g] = canvas(W, H, 1);
  const img = g.getImageData(0, 0, W, H), px = img.data, zb = new Float32Array(W * H).fill(Infinity), fb = new Int32Array(W * H);
  tris.forEach((t, i) => {
    const [a, b, c] = t.p; let n = norm3(cross3(sub3(b, a), sub3(c, a)));
    if (dot3(n, view3) < 0) n = n.map((x) => -x); // two-sided: shade the side facing the viewer
    const k = 0.62 + 0.38 * Math.max(0, dot3(n, light)) + (n[2] > 0.9 ? 0.06 : 0);
    const col = t.c.map((x) => Math.min(255, Math.round(x * k)));
    const q = P[i].map((p) => [ox + (p[0] - minX) * sc, oy + (p[1] - minY) * sc, p[2]]);
    raster(q, W, H, (x, y, z) => { const j = y * W + x; if (z < zb[j] - 1e-6) { zb[j] = z; fb[j] = t.f; const o = j * 4; px[o] = col[0]; px[o + 1] = col[1]; px[o + 2] = col[2]; px[o + 3] = 255; } });
  });
  // edges: where neighbouring pixels belong to different faces and one is clearly in front
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const j = y * W + x; if (!fb[j]) continue;
    const r = j + 1, d = j + W;
    if (fb[r] !== fb[j] || fb[d] !== fb[j]) { const o = j * 4; px[o] = Math.round(px[o] * 0.45); px[o + 1] = Math.round(px[o + 1] * 0.45); px[o + 2] = Math.round(px[o + 2] * 0.45); }
  }
  g.putImageData(img, 0, 0); g.scale(F, F);
  text(g, `${D.name ?? ''} · Axonometrie ${view === 'sw' ? 'Südwest' : 'Nordost'} · ${typeof v === 'number' ? 'v' + v : v}`, 20, 30, FONT(24, true), '#232628', 'left');
  text(g, 'Wände, Decken, Dach und Öffnungen als Volumen' + (bad.size ? ' · rot = offener ERROR' : ''), 20, 62, FONT(16), '#52636b', 'left');
  return cv;
}
const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm3 = (a) => { const l = Math.hypot(...a) || 1; return a.map((x) => x / l); };
const area2 = (poly) => poly.reduce((s, p, i) => { const q = poly[(i + 1) % poly.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0);
// scanline-free triangle rasterizer (bounding box + edge functions), depth interpolated linearly (orthographic)
function raster([a, b, c], W, H, put) {
  const x0 = Math.max(0, Math.floor(Math.min(a[0], b[0], c[0]))), x1 = Math.min(W - 1, Math.ceil(Math.max(a[0], b[0], c[0])));
  const y0 = Math.max(0, Math.floor(Math.min(a[1], b[1], c[1]))), y1 = Math.min(H - 1, Math.ceil(Math.max(a[1], b[1], c[1])));
  const ar = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]); if (Math.abs(ar) < 1e-9) return;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const px = x + 0.5, py = y + 0.5;
    const w0 = ((b[0] - px) * (c[1] - py) - (b[1] - py) * (c[0] - px)) / ar, w1 = ((c[0] - px) * (a[1] - py) - (c[1] - py) * (a[0] - px)) / ar, w2 = 1 - w0 - w1;
    if (w0 < -1e-6 || w1 < -1e-6 || w2 < -1e-6) continue;
    put(x, y, w0 * a[2] + w1 * b[2] + w2 * c[2]);
  }
}
// ear clipping for simple polygons (ccw), returns index triples
function earcut(poly) {
  const idx = poly.map((_, i) => i), out = []; let guard = 0;
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const inside = (p, a, b, c) => cr(a, b, p) >= 0 && cr(b, c, p) >= 0 && cr(c, a, p) >= 0;
  while (idx.length > 3 && guard++ < 10000) {
    let cut = false;
    for (let k = 0; k < idx.length; k++) {
      const i = idx[(k + idx.length - 1) % idx.length], j = idx[k], l = idx[(k + 1) % idx.length];
      if (cr(poly[i], poly[j], poly[l]) <= 1e-12) continue;
      if (idx.some((m) => m !== i && m !== j && m !== l && inside(poly[m], poly[i], poly[j], poly[l]))) continue;
      out.push([i, j, l]); idx.splice(k, 1); cut = true; break;
    }
    if (!cut) break;
  }
  if (idx.length === 3) out.push([idx[0], idx[1], idx[2]]);
  return out;
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
  if (c.width > maxW) { const k = maxW / c.width; const [d, g] = canvas(Math.round(c.width * k), Math.round(c.height * k), 1); g.drawImage(c, 0, 0, d.width, d.height); src = d; }
  return src.toDataURL('image/png').split(',')[1];
}
