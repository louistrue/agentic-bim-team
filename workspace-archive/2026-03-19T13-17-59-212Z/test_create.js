const handle = create.project({ Name: "Test" });
const eg = create.addIfcBuildingStorey(handle, { Name: "EG", Elevation: 0 });
const { content } = create.toIfc(handle);
console.log(content.substring(0, 100));
