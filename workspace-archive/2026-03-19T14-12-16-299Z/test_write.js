// Test if we can write output
const b = bim.create.project({ Name: "Test" });
const result = b.toIfc();

// Try different output methods
console.log("=== result type:", typeof result);
console.log("=== result keys:", Object.keys(result));

// Print the IFC content to stdout
if (result.content) {
  console.log(result.content);
}
