import json,sys
W,Dp=24.0,13.0; X0,Y0=-16.0,-7.0   # footprint axis rectangle
H=2.95; st=[{"key":k,"name":k,"elevation":round(i*H,3),"height":H} for i,k in enumerate(["EG","OG1","OG2"])]
d={"name":"Test","placement":{"eastings":2687233,"northings":1246459,"height":600,"rotationDeg":0},"storeys":st,"walls":[],"openings":[],"slabs":[],"spaces":[],"stairs":[]}
mat={"Name":"AW Holzrahmen 400","Layers":[{"Name":"Gipsfaserplatte","Thickness":0.015},{"Name":"Holzrahmen / Mineralwolle","Thickness":0.28},{"Name":"Holzfaserplatte","Thickness":0.06},{"Name":"Hinterlueftung / Holzschalung","Thickness":0.045}]}
poly=[[X0-0.2,Y0-0.2],[X0+W+0.2,Y0-0.2],[X0+W+0.2,Y0+Dp+0.2],[X0-0.2,Y0+Dp+0.2]]
cxa,cxb=X0+W/2-3,X0+W/2+3   # core walls x
for s in st:
    k=s["key"]
    for n,a,b in [("S",[X0,Y0],[X0+W,Y0]),("O",[X0+W,Y0],[X0+W,Y0+Dp]),("N",[X0+W,Y0+Dp],[X0,Y0+Dp]),("W",[X0,Y0+Dp],[X0,Y0])]:
        d["walls"].append({"key":f"{k}-AW-{n}","storey":k,"start":a,"end":b,"thickness":0.4,"type":"external","loadBearing":True,"fireRating":"REI 60","uValue":0.15,"material":mat})
    for n,x in [("W",cxa),("O",cxb)]:
        d["walls"].append({"key":f"{k}-TH-{n}","storey":k,"start":[x,Y0],"end":[x,Y0+Dp],"thickness":0.25,"type":"core","loadBearing":True,"fireRating":"REI 90","material":"Stahlbeton"})
    for u,(x0,x1),wall,side in [("A",(X0,cxa),f"{k}-TH-W","W"),("B",(cxb,X0+W),f"{k}-TH-O","O")]:
        unit=f"{k}-{u}"
        sp=f"{k}-{u}-WO"; d["spaces"].append({"key":sp,"storey":k,"usage":"Wohnen/Essen","unit":unit,"polygon":[[x0+0.2,Y0+0.2],[x1-0.15,Y0+0.2],[x1-0.15,Y0+7],[x0+0.2,Y0+7]]})
        d["spaces"].append({"key":f"{k}-{u}-Z1","storey":k,"usage":"Zimmer","unit":unit,"polygon":[[x0+0.2,Y0+7.1],[x1-0.15,Y0+7.1],[x1-0.15,Y0+Dp-0.2],[x0+0.2,Y0+Dp-0.2]]})
        d["openings"].append({"key":f"{k}-{u}-WT","kind":"door","wall":wall,"offset":5.0,"sill":0,"width":1.0,"height":2.1,"reference":"Wohnungstuer","unit":unit,"fireRating":"EI 30","selfClosing":True})
        sw=f"{k}-AW-S"; off=(x0-X0)+1.5
        d["openings"].append({"key":f"{k}-{u}-F1","kind":"window","wall":sw,"offset":off,"sill":0.5,"width":2.4,"height":1.9,"uValue":0.8,"gValue":0.5,"space":sp})
        d["openings"].append({"key":f"{k}-{u}-F2","kind":"window","wall":sw,"offset":off+3,"sill":0.5,"width":2.4,"height":1.9,"uValue":0.8,"gValue":0.5,"space":sp})
    kind="base" if k=="EG" else "floor"
    hole=[] if k=="EG" else [{"x":cxa+0.4-0.2,"y":Y0+1,"w":2.6,"d":5.5}]
    d["slabs"].append({"key":f"{k}-DE","storey":k,"kind":kind,"thickness":0.3 if k=="EG" else 0.32,"polygon":poly,"fireRating":"REI 60","uValue":0.2 if k=="EG" else None,"openings":hole})
    if k!="OG2": d["stairs"].append({"key":f"{k}-TR","storey":k,"position":[cxa+0.6,Y0+1.2],"directionDeg":90,"risers":17,"riserHeight":round(H/17,4),"tread":0.27,"width":1.2})
    d["spaces"].append({"key":f"{k}-TH","storey":k,"usage":"Treppenhaus","unit":"-","polygon":[[cxa+0.15,Y0+0.2],[cxb-0.15,Y0+0.2],[cxb-0.15,Y0+Dp-0.2],[cxa+0.15,Y0+Dp-0.2]]})
d["slabs"].append({"key":"OG2-DA","storey":"OG2","kind":"roof","thickness":0.4,"polygon":poly,"uValue":0.12,"fireRating":"REI 30"})
for s in d["slabs"]:
    if s.get("uValue") is None: s.pop("uValue",None)
json.dump(d,open(sys.argv[1],'w'),indent=1)
