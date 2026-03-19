try {
  console.log("Global create:", typeof create);
  console.log("bim.create:", typeof bim.create);
  
  // Try the instruction format
  const b = bim.create({ Name: "Test Project" });
  console.log("Created handle:", b);
} catch (e) {
  console.error("Error:", e.message);
}
