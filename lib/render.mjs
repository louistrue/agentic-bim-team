// Orthographic software renderer: z-buffer + flat shading + outline detection.
// Meshes in meshes.bin are world coords (renderer frame, Y-up; IFC +Y = -Z = Projektnord).
import fs from 'fs';
import zlib from 'zlib';

export const meshesById = new Map();
export function loadMeshes(prefix) {
meshesById.clear();
const idx = JSON.parse(fs.readFileSync(`${prefix}.meshes.json`));
const bin = fs.readFileSync(`${prefix}.meshes.bin`);
for (const [id, type, off, np, ni] of idx) {
  const pos = new Float32Array(bin.buffer, bin.byteOffset + off, np);
  const ind = new Uint32Array(bin.buffer.slice(bin.byteOffset + off + np * 4, bin.byteOffset + off + np * 4 + ni * 4));
  if (!meshesById.has(id)) meshesById.set(id, []);
  meshesById.get(id).push({ pos, ind, type });
}
}

const norm = (v) => { const l = Math.hypot(...v); return v.map((x) => x / l); };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/**
 * elems: Map<expressId, {rgb:[r,g,b] 0..255, ghost?:bool}>
 * f: view direction (into scene), up: world up hint
 * pxPerM: output pixels per metre (before SSAA), margin in px
 */
export function renderView({ elems, f, up = [0, 1, 0], pxPerM = 12, margin = 20, ss = 2, out, fitIds, edgeMode = 'full', ghostBehind = false }) {
  f = norm(f); const r = norm(cross(f, up)); const u = cross(r, f);
  const L = norm([-0.4, 0.8, 0.45]);
  // bounds over visible (or fitIds) elements
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  const fit = fitIds || [...elems.keys()];
  for (const id of fit) for (const m of meshesById.get(id) || []) {
    const p = m.pos;
    for (let i = 0; i < p.length; i += 3) {
      const sx = p[i] * r[0] + p[i + 1] * r[1] + p[i + 2] * r[2];
      const sy = p[i] * u[0] + p[i + 1] * u[1] + p[i + 2] * u[2];
      if (sx < x0) x0 = sx; if (sx > x1) x1 = sx; if (sy < y0) y0 = sy; if (sy > y1) y1 = sy;
    }
  }
  const s = pxPerM * ss, M = margin * ss;
  const W = Math.ceil((x1 - x0) * s + 2 * M), H = Math.ceil((y1 - y0) * s + 2 * M);
  const depth = new Float32Array(W * H).fill(Infinity);
  const idb = new Int32Array(W * H).fill(-1);
  const shade = new Float32Array(W * H);
  const keys = [...elems.keys()]; const slot = new Map(keys.map((k, i) => [k, i]));
  for (const id of keys) {
    const k = slot.get(id); const zoff = ghostBehind && elems.get(id).ghost ? 1e5 : 0;
    for (const m of meshesById.get(id) || []) {
      const p = m.pos, ind = m.ind; const n = p.length / 3;
      const X = new Float32Array(n), Y = new Float32Array(n), Z = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        const a = p[3 * i], b = p[3 * i + 1], c = p[3 * i + 2];
        X[i] = (a * r[0] + b * r[1] + c * r[2] - x0) * s + M;
        Y[i] = (y1 - (a * u[0] + b * u[1] + c * u[2])) * s + M;
        Z[i] = a * f[0] + b * f[1] + c * f[2];
      }
      for (let t = 0; t < ind.length; t += 3) {
        const i0 = ind[t], i1 = ind[t + 1], i2 = ind[t + 2];
        // face normal (world) for shading
        const ax = p[3 * i1] - p[3 * i0], ay = p[3 * i1 + 1] - p[3 * i0 + 1], az = p[3 * i1 + 2] - p[3 * i0 + 2];
        const bx = p[3 * i2] - p[3 * i0], by = p[3 * i2 + 1] - p[3 * i0 + 1], bz = p[3 * i2 + 2] - p[3 * i0 + 2];
        let nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx; const nl = Math.hypot(nx, ny, nz) || 1;
        nx /= nl; ny /= nl; nz /= nl;
        const sh = 0.62 + 0.38 * Math.abs(nx * L[0] + ny * L[1] + nz * L[2]);
        const xa = X[i0], ya = Y[i0], xb = X[i1], yb = Y[i1], xc = X[i2], yc = Y[i2];
        const area = (xb - xa) * (yc - ya) - (yb - ya) * (xc - xa);
        if (Math.abs(area) < 1e-9) continue;
        const minx = Math.max(0, Math.floor(Math.min(xa, xb, xc))), maxx = Math.min(W - 1, Math.ceil(Math.max(xa, xb, xc)));
        const miny = Math.max(0, Math.floor(Math.min(ya, yb, yc))), maxy = Math.min(H - 1, Math.ceil(Math.max(ya, yb, yc)));
        const za = Z[i0], zb = Z[i1], zc = Z[i2];
        for (let py = miny; py <= maxy; py++) {
          const cy = py + 0.5;
          for (let px = minx; px <= maxx; px++) {
            const cx = px + 0.5;
            const w0 = ((xb - cx) * (yc - cy) - (yb - cy) * (xc - cx)) / area;
            const w1 = ((xc - cx) * (ya - cy) - (yc - cy) * (xa - cx)) / area;
            const w2 = 1 - w0 - w1;
            if (w0 < 0 || w1 < 0 || w2 < 0) continue;
            const z = w0 * za + w1 * zb + w2 * zc + zoff; const o = py * W + px;
            if (z < depth[o]) { depth[o] = z; idb[o] = k; shade[o] = sh; }
          }
        }
      }
    }
  }
  // compose at SS resolution
  const col = keys.map((k) => elems.get(k));
  const rgb = new Float32Array(W * H * 3).fill(255);
  for (let o = 0; o < W * H; o++) {
    const k = idb[o]; if (k < 0) continue;
    const e = col[k]; const sh = shade[o];
    rgb[3 * o] = e.rgb[0] * sh; rgb[3 * o + 1] = e.rgb[1] * sh; rgb[3 * o + 2] = e.rgb[2] * sh;
  }
  // outlines: id change, depth jump, or shading crease
  const line = ss; // line half-width ~1 output px
  const edge = new Uint8Array(W * H); // 0 none, 1 dark, 2 light (ghost)
  for (let y = 0; y < H - 1; y++) for (let x = 0; x < W - 1; x++) {
    const o = y * W + x;
    for (const q of [o + 1, o + W]) {
      const a = idb[o], b = idb[q]; if (a < 0 && b < 0) continue;
      let isEdge = a !== b;
      if (edgeMode === 'plan') {
        if (!isEdge) continue;
        const ghost = (a < 0 || col[a].ghost) && (b < 0 || col[b].ghost);
        if (edge[o] !== 1) edge[o] = ghost ? 2 : 3;
        continue;
      }
      if (!isEdge) {
        const dz = Math.abs(depth[o] - depth[q]);
        isEdge = dz > 0.25 || Math.abs(shade[o] - shade[q]) > 0.04;
      }
      if (isEdge) {
        const ghost = (a < 0 || col[a].ghost) && (b < 0 || col[b].ghost);
        const kind = ghost ? 2 : 1;
        for (const t of [o, q]) if (edge[t] !== 1) edge[t] = kind;
      }
    }
  }
  // density filter: very dense line work (lamellae, grilles) becomes a darkened fill instead of black
  const integ = new Int32Array((W + 1) * (H + 1));
  for (let y = 0; y < H; y++) { let row = 0; for (let x = 0; x < W; x++) { row += edge[y * W + x] ? 1 : 0; integ[(y + 1) * (W + 1) + x + 1] = integ[y * (W + 1) + x + 1] + row; } }
  const R = 2 * ss; const dense = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const o = y * W + x; if (!edge[o]) continue;
    const xa = Math.max(0, x - R), xb = Math.min(W, x + R + 1), ya = Math.max(0, y - R), yb = Math.min(H, y + R + 1);
    const cnt = integ[yb * (W + 1) + xb] - integ[ya * (W + 1) + xb] - integ[yb * (W + 1) + xa] + integ[ya * (W + 1) + xa];
    if (cnt > 0.5 * (xb - xa) * (yb - ya)) dense[o] = 1;
  }
  for (let o = 0; o < W * H; o++) {
    if (!edge[o]) continue;
    if (dense[o] && idb[o] >= 0) { for (let c = 0; c < 3; c++) rgb[3 * o + c] *= 0.8; continue; }
    const c = edge[o] === 1 ? 40 : edge[o] === 3 ? 90 : 175;
    rgb[3 * o] = c; rgb[3 * o + 1] = c; rgb[3 * o + 2] = c;
  }
  // downsample
  const w = Math.floor(W / ss), h = Math.floor(H / ss);
  const outb = Buffer.alloc(h * (w * 3 + 1));
  for (let y = 0; y < h; y++) {
    outb[y * (w * 3 + 1)] = 0;
    for (let x = 0; x < w; x++) for (let c = 0; c < 3; c++) {
      let acc = 0; for (let dy = 0; dy < ss; dy++) for (let dx = 0; dx < ss; dx++) acc += rgb[3 * ((y * ss + dy) * W + x * ss + dx) + c];
      outb[y * (w * 3 + 1) + 1 + x * 3 + c] = Math.max(0, Math.min(255, Math.round(acc / (ss * ss))));
    }
  }
  fs.writeFileSync(out, png(w, h, outb));
  // count which elements are actually visible (for QA)
  const seen = new Set(); for (let o = 0; o < W * H; o++) if (idb[o] >= 0) seen.add(keys[idb[o]]);
  // north (IFC +Y = renderer -Z) direction on screen, degrees clockwise from up
  const north = Math.atan2(-r[2], -u[2]) * 180 / Math.PI;
  return { w, h, pxPerM, visible: seen, f, r, u, north };
}

function png(w, h, raw) {
  const crcT = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
  const crc = (b) => { let c = -1; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
  const chunk = (t, d) => { const len = Buffer.alloc(4); len.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 6 })), chunk('IEND', Buffer.alloc(0))]);
}
