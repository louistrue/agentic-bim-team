try {
  console.log("bim.create methods:", Object.getOwnPropertyNames(bim.create));
  console.log("bim.create.project:", typeof bim.create.project);
  
  // Try namespace approach
  if (typeof bim.create.project === 'function') {
    const handle = bim.create.project({ Name: "Test" });
    console.log("Handle:", handle);
  }
} catch (e) {
  console.error("Error:", e.message, e.stack);
}
