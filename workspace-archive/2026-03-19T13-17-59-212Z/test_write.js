const h = bim.create.project({ Name: "Test" });
const eg = h.addIfcBuildingStorey({ Name: "EG", Elevation: 0 });
const { content, stats } = h.toIfc();
// Write to stdout
console.log("STATS:" + JSON.stringify(stats));
console.log("IFC_CONTENT_START");
console.log(content);
