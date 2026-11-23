#!/usr/bin/env python3
"""Floor plans per storey from the design intent: rooms with name and area, walls by thickness,
windows, doors with swing, stairs with treads, apartment colours. Elements in open ERROR findings in red.
Usage: python3 scripts/plan.py N  →  workspace/renders/vN_grundriss_<storey>.png"""
import json, math, sys, os
from PIL import Image, ImageDraw, ImageFont

v = int(sys.argv[1])
D = json.load(open(f'workspace/design_v{v}.json'))
C = json.load(open(f'workspace/checks_v{v}.json')) if os.path.exists(f'workspace/checks_v{v}.json') else {'findings': []}
bad = {k for f in C['findings'] if f['severity'] == 'ERROR' for k in f['elements']}
F = lambda s, b=False: ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans%s.ttf' % ('-Bold' if b else ''), s)
pts = [p for w in D['walls'] for p in (w['start'], w['end'])]
x0, x1 = min(p[0] for p in pts) - 2, max(p[0] for p in pts) + 2
y0, y1 = min(p[1] for p in pts) - 2, max(p[1] for p in pts) + 2
s = 1500 / max(x1 - x0, (y1 - y0) * 1.5)
W, H = int((x1 - x0) * s) + 40, int((y1 - y0) * s) + 130
T = lambda p: (20 + (p[0] - x0) * s, 110 + (y1 - p[1]) * s)
UNITCOL = ['#e8efe4', '#e6edf2', '#f2ece1', '#efe6ee', '#e9eee8', '#f1efe4']
area = lambda poly: abs(sum(p[0] * q[1] - q[0] * p[1] for p, q in zip(poly, poly[1:] + poly[:1]))) / 2
os.makedirs('workspace/renders', exist_ok=True)
out = []
for st in sorted(D['storeys'], key=lambda s_: s_['elevation']):
    k = st['key']
    im = Image.new('RGB', (W, H), 'white'); d = ImageDraw.Draw(im)
    units = sorted({sp.get('unit') for sp in D.get('spaces', []) if sp['storey'] == k and sp.get('unit') not in (None, '-')})
    for sp in D.get('spaces', []):
        if sp['storey'] != k: continue
        col = '#d7263d' if sp['key'] in bad else ('#f4f4f2' if sp.get('unit') in (None, '-') else UNITCOL[units.index(sp['unit']) % len(UNITCOL)])
        d.polygon([T(p) for p in sp['polygon']], fill=col if sp['key'] not in bad else '#f6c9cf')
    for t in D.get('stairs', []):
        if t['storey'] != k: continue
        a = math.radians(t.get('directionDeg', 0)); ux, uy = math.cos(a), math.sin(a); nx, ny = -uy, ux
        L = t['risers'] * t['tread'] if False else (t['risers'] - 1) * t['tread']
        p = t['position']; w = t['width']
        corners = [(p[0], p[1]), (p[0] + ux * L, p[1] + uy * L), (p[0] + ux * L + nx * w, p[1] + uy * L + ny * w), (p[0] + nx * w, p[1] + ny * w)]
        d.polygon([T(c) for c in corners], fill='#ffffff', outline='#232628')
        for i in range(1, t['risers'] - 1):
            q = (p[0] + ux * i * t['tread'], p[1] + uy * i * t['tread']); d.line([T(q), T((q[0] + nx * w, q[1] + ny * w))], fill='#8a8a86', width=1)
        m0 = (p[0] + nx * w / 2, p[1] + ny * w / 2); m1 = (m0[0] + ux * L, m0[1] + uy * L); d.line([T(m0), T(m1)], fill='#232628', width=2)
        e = T(m1); d.ellipse([e[0] - 5, e[1] - 5, e[0] + 5, e[1] + 5], fill='#232628')
    ops = {}
    for o in D.get('openings', []): ops.setdefault(o['wall'], []).append(o)
    for w in D['walls']:
        if w['storey'] != k: continue
        a, b = w['start'], w['end']; L = math.dist(a, b); ux, uy = (b[0] - a[0]) / L, (b[1] - a[1]) / L; nx, ny = -uy, ux; h = w['thickness'] / 2
        cuts = sorted((o['offset'], o['offset'] + o['width'], o) for o in ops.get(w['key'], []))
        segs, pos = [], 0
        for c0, c1, o in cuts: segs.append((pos, c0)); pos = c1
        segs.append((pos, L))
        col = '#d7263d' if w['key'] in bad else ('#232628' if w['type'] in ('external', 'core') else '#55595c')
        for s0, s1 in segs:
            if s1 - s0 < 0.01: continue
            q = [(a[0] + ux * s0 + nx * h, a[1] + uy * s0 + ny * h), (a[0] + ux * s1 + nx * h, a[1] + uy * s1 + ny * h), (a[0] + ux * s1 - nx * h, a[1] + uy * s1 - ny * h), (a[0] + ux * s0 - nx * h, a[1] + uy * s0 - ny * h)]
            d.polygon([T(p) for p in q], fill=col if w['type'] in ('external', 'core', 'party') else '#9a9d9f')
        for c0, c1, o in cuts:
            oc = '#d7263d' if o['key'] in bad else None
            if o['kind'] == 'window':
                for f in (-h, 0, h):
                    d.line([T((a[0] + ux * c0 + nx * f, a[1] + uy * c0 + ny * f)), T((a[0] + ux * c1 + nx * f, a[1] + uy * c1 + ny * f))], fill=oc or '#5b7c8f', width=2)
            else:
                hinge = (a[0] + ux * c0, a[1] + uy * c0); r = c1 - c0
                tip = (hinge[0] + nx * r, hinge[1] + ny * r)
                d.line([T(hinge), T(tip)], fill=oc or '#a0703c', width=3)
                cx_, cy_ = T(hinge); R = r * s; ang0 = math.degrees(math.atan2(-ny, nx)); ang1 = math.degrees(math.atan2(-uy, ux))
                d.arc([cx_ - R, cy_ - R, cx_ + R, cy_ + R], min(ang0, ang1), max(ang0, ang1) if abs(ang0 - ang1) <= 180 else min(ang0, ang1) + 90, fill=oc or '#a0703c', width=1)
    for sp in D.get('spaces', []):
        if sp['storey'] != k: continue
        c = (sum(p[0] for p in sp['polygon']) / len(sp['polygon']), sum(p[1] for p in sp['polygon']) / len(sp['polygon']))
        x, y = T(c); A = area(sp['polygon'])
        lab = sp.get('longName') or sp.get('usage', ''); fs = 15 if A > 6 else 11
        d.text((x, y - 9), lab, font=F(fs, True), fill='#232628', anchor='mm'); d.text((x, y + 9), f'{A:.1f} m²', font=F(fs - 2), fill='#52636b', anchor='mm')
    d.text((20, 18), f"{D.get('name', '')} · Grundriss {st.get('name', k)} · v{v}", font=F(28, True), fill='#232628')
    leg = ' · '.join(f"{u}: {sum(area(sp['polygon']) for sp in D['spaces'] if sp.get('unit') == u):.0f} m² NF" for u in units)
    d.text((20, 60), leg + ('   ·   rot = offener ERROR' if bad else ''), font=F(18), fill='#52636b')
    d.polygon([(W - 50, 20), (W - 62, 60), (W - 38, 60)], fill='#232628'); d.text((W - 56, 64), 'N', font=F(16, True), fill='#232628')
    d.line([(20, H - 24), (20 + 5 * s, H - 24)], fill='#232628', width=4); d.text((24 + 5 * s, H - 16), '5 m', font=F(14), fill='#232628', anchor='lb')
    p = f'workspace/renders/v{v}_grundriss_{k}.png'; im.save(p); out.append(p)
print(json.dumps({'ok': True, 'plans': out}))
