#!/usr/bin/env python3
"""Site plan for version N: parcel, kept neighbours (swissBUILDINGS3D extents), replaced building,
new footprint, and the boundary-distance check per facade. Usage: python3 scripts/siteplan.py N"""
import json, sys
from PIL import Image, ImageDraw, ImageFont

v = int(sys.argv[1])
site = json.load(open('workspace/site.json'))
D = json.load(open(f'workspace/design_v{v}.json'))
checks = json.load(open(f'workspace/checks_v{v}.json'))
F = lambda s, b=False: ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans%s.ttf' % ('-Bold' if b else ''), s)
W, H, s = 1400, 1100, 9.0
cx, cy = -10, 0
T = lambda p: (W / 2 + (p[0] - cx) * s, H / 2 - (p[1] - cy) * s)
im = Image.new('RGB', (W, H), 'white'); d = ImageDraw.Draw(im)
d.polygon([T(p) for p in site['parcel']['polygonLocal']], fill='#f3f6f1', outline='#445b48', width=3)
for b in site['existingBuildings']:
    x0, y0, x1, y1 = b['bboxLocal']
    if max(abs(x0), abs(x1)) > 70 or max(abs(y0), abs(y1)) > 70: continue
    a, c = T([x0, y1]), T([x1, y0])
    if b['toBeReplaced']:
        d.rectangle([a, c], outline='#c8641e', width=3)
        for k in range(int(a[0]), int(c[0]), 14): d.line([(k, a[1]), (min(k + 30, c[0]), c[1])], fill='#f0c8a8')
        d.text((a[0] + 4, a[1] + 4), f"Bestand EGID {b['egid']}\n(Rückbau)", font=F(15), fill='#c8641e')
    else:
        d.rectangle([a, c], fill='#d5d5d2', outline='#8a8a86', width=2)
        d.text((a[0] + 4, a[1] + 4), f"EGID {b['egid']}\n{b['height']} m", font=F(13), fill='#444')
g = D['storeys'][0]['key']
for w in D['walls']:
    if w['storey'] != g: continue
    col = '#232628' if w['type'] in ('external', 'core') else '#888'
    d.line([T(w['start']), T(w['end'])], fill=col, width=max(2, int(w['thickness'] * s)))
bad = {k for f in checks['findings'] if f['rule'] in ('Z3', 'Z0', 'Z6') for k in f['elements']}
for w in D['walls']:
    if w['key'] in bad: d.line([T(w['start']), T(w['end'])], fill='#d7263d', width=max(3, int(w['thickness'] * s)))
y = 20
d.text((20, y), f"Lageplan v{v} · Parzelle {site['parcel']['number']} ({site['parcel']['egrid']}), {site['parcel']['registeredArea']} m² · W3", font=F(22, True), fill='#232628'); y += 36
for fc in checks['metrics']['facades']:
    ok = fc['actual'] + 0.01 >= fc['required']
    d.text((20, y), f"Fassade {fc['facade']}: Länge {fc['length']} m · Abstand {fc['actual']} m · verlangt {fc['required']} m  {'OK' if ok else 'ZU KLEIN'}", font=F(17), fill='#445b48' if ok else '#d7263d'); y += 26
d.text((20, H - 50), 'Quellen: amtliche Vermessung (Parzelle), swissBUILDINGS3D © swisstopo (Hüllrechtecke, Näherung), BZO 2016 Art. 13/14', font=F(14), fill='#52636b')
# north arrow and scale
d.polygon([(W - 60, 40), (W - 72, 80), (W - 48, 80)], fill='#232628'); d.text((W - 66, 84), 'N', font=F(18, True), fill='#232628')
d.line([(W - 220, H - 60), (W - 220 + 20 * s, H - 60)], fill='#232628', width=4); d.text((W - 220, H - 54), '20 m', font=F(15), fill='#232628')
im.save(f'workspace/renders/v{v}_site.png'); print(json.dumps({'ok': True, 'out': f'workspace/renders/v{v}_site.png'}))
