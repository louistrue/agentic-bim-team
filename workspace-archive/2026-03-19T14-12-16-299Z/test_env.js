// Test what's available in ifc-lite run environment
console.log("typeof bim:", typeof bim);
console.log("typeof process:", typeof process);
console.log("typeof global:", typeof global);
console.log("typeof globalThis:", typeof globalThis);

// Check what's in bim
if (typeof bim !== 'undefined') {
  console.log("bim keys:", Object.keys(bim));
}
