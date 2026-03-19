const h = bim.create.project({ Name: "Test" });
console.log("Creating storey...");
const eg = h.addIfcBuildingStorey({ Name: "EG", Elevation: 0 });
console.log("Storey ID:", eg);
const { content, stats } = h.toIfc();
console.log("Stats:", JSON.stringify(stats));
