const h = bim.create.project({ Name: "Test" });
const eg = h.addIfcBuildingStorey({ Name: "EG", Elevation: 0 });
const { content } = h.toIfc();

// Try using bim.export
console.log("bim.export methods:", Object.getOwnPropertyNames(bim.export));
