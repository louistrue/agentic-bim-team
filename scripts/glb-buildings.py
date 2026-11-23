import json,struct,sys
b=open(sys.argv[1],'rb').read()
l=struct.unpack('<I',b[12:16])[0]; j=json.loads(b[20:20+l]); binoff=20+l+8
def acc(i):
    a=j['accessors'][i]; bv=j['bufferViews'][a['bufferView']]; o=binoff+bv.get('byteOffset',0)+a.get('byteOffset',0)
    n=a['count']*{'VEC3':3,'SCALAR':1}[a['type']]; fmt={5126:'f',5125:'I',5123:'H'}[a['componentType']]
    return struct.unpack_from('<%d%s'%(n,fmt),b,o)
def pts(ni,origin):
    n=j['nodes'][ni]; out=[]
    e=(n.get('extras') or {}).get('ifcLiteSiteContext') or {}
    og=e.get('origin',origin)
    if 'mesh' in n:
        for pr in j['meshes'][n['mesh']]['primitives']:
            p=acc(pr['attributes']['POSITION'])
            out+=[(og[0]+p[i],og[1]-p[i+2],og[2]+p[i+1]) for i in range(0,len(p),3)]
    for c in n.get('children',[]): out+=pts(c,og)
    return out
out=[]
for ni,n in enumerate(j['nodes']):
    e=(n.get('extras') or {}).get('ifcLiteSiteContext')
    if not e or e.get('ifcType') not in ('IfcBuilding','IfcSite'): continue
    P=pts(ni,e.get('origin'))
    rec={'name':n.get('name'),'type':e['ifcType'],'egid':(e.get('attributes') or {}).get('IfcLite_SiteContextBuilding',{}).get('EGID'),'height':(e.get('attributes') or {}).get('IfcLite_SiteContextBuilding',{}).get('TotalHeight'),'terrain':(e.get('attributes') or {}).get('IfcLite_SiteContextBuilding',{}).get('TerrainPoint')}
    if P:
        xs=[p[0] for p in P]; ys=[p[1] for p in P]; rec['bbox']=[round(min(xs),1),round(min(ys),1),round(max(xs),1),round(max(ys),1)]
    out.append(rec)
print(json.dumps(out,ensure_ascii=False))
