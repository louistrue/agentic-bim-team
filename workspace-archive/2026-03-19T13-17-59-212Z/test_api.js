const h = bim.create.project({ Name: "Test" });
console.log("Handle type:", h.constructor.name);
console.log("Available methods:", Object.getOwnPropertyNames(Object.getPrototypeOf(h)).filter(m => !m.startsWith('_')));
