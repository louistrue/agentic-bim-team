// Test bim.files
console.log("bim.files:", typeof bim.files);
if (typeof bim.files === 'object') {
  console.log("bim.files keys:", Object.keys(bim.files));
}

// Test if we can access filesystem through global
console.log("global.require:", typeof global.require);
console.log("process.versions:", process.versions);
