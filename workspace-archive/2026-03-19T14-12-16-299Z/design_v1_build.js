// ═══ Design v1 Build Script ═══
// Cycle 0 - Initial residential building design
// Zone W3: max 9.5m height, 3 floors, FAR 0.9, coverage 0.4
// Building: 20m × 12m, 3 storeys (EG, OG1, OG2), 2 units per floor

const b = bim.create.project({
  Name: "Residential Building Loorenstrasse 62",
  Description: "Multi-family housing, Minergie standard, 6 units"
});

// ═══ 1. Define storeys with exact elevations ═══
const storeys = [
  { name: "EG", elevation: 0 },
  { name: "OG1", elevation: 2.8 },
  { name: "OG2", elevation: 5.6 }
];

const storeyRefs = {};
for (const s of storeys) {
  storeyRefs[s.name] = b.addIfcBuildingStorey({
    Name: s.name,
    Elevation: s.elevation
  });
}

// Building footprint: 20m × 12m centered at parcel centroid (32.75, -41.88)
// Local origin: (-10, -6) relative to centroid → (22.75, -47.88) absolute
const buildingX = 22.75;  // 32.75 - 10
const buildingY = -47.88;  // -41.88 - 6

// ═══ 2. Create elements per storey ═══
for (let i = 0; i < storeys.length; i++) {
  const s = storeys[i];
  const ref = storeyRefs[s.name];
  const z = s.elevation;

  // External walls - all 4 sides (360mm thick, Minergie compliant)
  // South wall
  const w_south = b.addIfcWall(ref, {
    Start: [buildingX, buildingY, z],
    End: [buildingX + 20, buildingY, z],
    Height: 2.8,
    Thickness: 0.36
  });
  b.addIfcPropertySet(w_south, {
    Name: "Pset_WallCommon",
    Properties: [
      { Name: "IsExternal", NominalValue: true },
      { Name: "LoadBearing", NominalValue: true },
      { Name: "FireRating", NominalValue: "REI60" },
      { Name: "ThermalTransmittance", NominalValue: 0.15 }
    ]
  });
  b.addIfcMaterial(w_south, { Name: "Mauerwerk_360mm_EPS_Minergie" });

  // North wall
  const w_north = b.addIfcWall(ref, {
    Start: [buildingX, buildingY + 12, z],
    End: [buildingX + 20, buildingY + 12, z],
    Height: 2.8,
    Thickness: 0.36
  });
  b.addIfcPropertySet(w_north, {
    Name: "Pset_WallCommon",
    Properties: [
      { Name: "IsExternal", NominalValue: true },
      { Name: "LoadBearing", NominalValue: true },
      { Name: "FireRating", NominalValue: "REI60" },
      { Name: "ThermalTransmittance", NominalValue: 0.15 }
    ]
  });
  b.addIfcMaterial(w_north, { Name: "Mauerwerk_360mm_EPS_Minergie" });

  // East wall
  const w_east = b.addIfcWall(ref, {
    Start: [buildingX + 20, buildingY, z],
    End: [buildingX + 20, buildingY + 12, z],
    Height: 2.8,
    Thickness: 0.36
  });
  b.addIfcPropertySet(w_east, {
    Name: "Pset_WallCommon",
    Properties: [
      { Name: "IsExternal", NominalValue: true },
      { Name: "LoadBearing", NominalValue: true },
      { Name: "FireRating", NominalValue: "REI60" },
      { Name: "ThermalTransmittance", NominalValue: 0.15 }
    ]
  });
  b.addIfcMaterial(w_east, { Name: "Mauerwerk_360mm_EPS_Minergie" });

  // West wall
  const w_west = b.addIfcWall(ref, {
    Start: [buildingX, buildingY, z],
    End: [buildingX, buildingY + 12, z],
    Height: 2.8,
    Thickness: 0.36
  });
  b.addIfcPropertySet(w_west, {
    Name: "Pset_WallCommon",
    Properties: [
      { Name: "IsExternal", NominalValue: true },
      { Name: "LoadBearing", NominalValue: true },
      { Name: "FireRating", NominalValue: "REI60" },
      { Name: "ThermalTransmittance", NominalValue: 0.15 }
    ]
  });
  b.addIfcMaterial(w_west, { Name: "Mauerwerk_360mm_EPS_Minergie" });

  // Party wall between units (EI60 for fire separation)
  const pw = b.addIfcWall(ref, {
    Start: [buildingX + 10, buildingY, z],
    End: [buildingX + 10, buildingY + 12, z],
    Height: 2.8,
    Thickness: 0.20
  });
  b.addIfcPropertySet(pw, {
    Name: "Pset_WallCommon",
    Properties: [
      { Name: "IsExternal", NominalValue: false },
      { Name: "LoadBearing", NominalValue: true },
      { Name: "FireRating", NominalValue: "EI60" }
    ]
  });
  b.addIfcMaterial(pw, { Name: "Mauerwerk_200mm_Brandschutz" });

  // Floor slab (250mm reinforced concrete)
  const slab = b.addIfcSlab(ref, {
    Width: 20,
    Depth: 12,
    Thickness: 0.25,
    Position: [buildingX, buildingY, z]
  });
  b.addIfcPropertySet(slab, {
    Name: "Pset_SlabCommon",
    Properties: [
      { Name: "IsExternal", NominalValue: false },
      { Name: "LoadBearing", NominalValue: true }
    ]
  });
  b.addIfcMaterial(slab, { Name: "Stahlbeton_C30_37" });

  // Spaces - Unit 1 (west side)
  b.addIfcSpace(ref, {
    Width: 9, Depth: 5.5, Height: 2.5,
    LongName: `Wohnung_${s.name}_1_Wohnzimmer`,
    Position: [buildingX + 0.5, buildingY + 0.5, z]
  });

  b.addIfcSpace(ref, {
    Width: 4, Depth: 3, Height: 2.5,
    LongName: `Wohnung_${s.name}_1_Schlafzimmer`,
    Position: [buildingX + 0.5, buildingY + 6, z]
  });

  b.addIfcSpace(ref, {
    Width: 4, Depth: 2.5, Height: 2.5,
    LongName: `Wohnung_${s.name}_1_Kueche`,
    Position: [buildingX + 0.5, buildingY + 9, z]
  });

  b.addIfcSpace(ref, {
    Width: 2, Depth: 2, Height: 2.5,
    LongName: `Wohnung_${s.name}_1_Bad`,
    Position: [buildingX + 5, buildingY + 9, z]
  });

  // Spaces - Unit 2 (east side)
  b.addIfcSpace(ref, {
    Width: 9, Depth: 5.5, Height: 2.5,
    LongName: `Wohnung_${s.name}_2_Wohnzimmer`,
    Position: [buildingX + 10.5, buildingY + 0.5, z]
  });

  b.addIfcSpace(ref, {
    Width: 4, Depth: 3, Height: 2.5,
    LongName: `Wohnung_${s.name}_2_Schlafzimmer`,
    Position: [buildingX + 10.5, buildingY + 6, z]
  });

  b.addIfcSpace(ref, {
    Width: 4, Depth: 2.5, Height: 2.5,
    LongName: `Wohnung_${s.name}_2_Kueche`,
    Position: [buildingX + 10.5, buildingY + 9, z]
  });

  b.addIfcSpace(ref, {
    Width: 2, Depth: 2, Height: 2.5,
    LongName: `Wohnung_${s.name}_2_Bad`,
    Position: [buildingX + 15, buildingY + 9, z]
  });

  // Ventilation shaft (MVHR requirement - continuous through all storeys)
  b.addIfcSpace(ref, {
    Width: 1.0, Depth: 0.8, Height: 2.8,
    LongName: `Lueftungsschacht_${s.name}`,
    Position: [buildingX + 7, buildingY + 4.5, z]
  });

  // Windows - South facade (living rooms)
  const win_s1 = b.addIfcWindow(ref, {
    Width: 2.4, Height: 1.5,
    Position: [buildingX + 4, buildingY, z + 0.9]
  });
  b.addIfcPropertySet(win_s1, {
    Name: "Pset_WindowCommon",
    Properties: [
      { Name: "IsExternal", NominalValue: true },
      { Name: "ThermalTransmittance", NominalValue: 0.7 }
    ]
  });

  const win_s2 = b.addIfcWindow(ref, {
    Width: 2.4, Height: 1.5,
    Position: [buildingX + 14, buildingY, z + 0.9]
  });
  b.addIfcPropertySet(win_s2, {
    Name: "Pset_WindowCommon",
    Properties: [
      { Name: "IsExternal", NominalValue: true },
      { Name: "ThermalTransmittance", NominalValue: 0.7 }
    ]
  });

  // Windows - North facade (kitchens)
  const win_n1 = b.addIfcWindow(ref, {
    Width: 1.5, Height: 1.2,
    Position: [buildingX + 2, buildingY + 12, z + 1.0]
  });
  b.addIfcPropertySet(win_n1, {
    Name: "Pset_WindowCommon",
    Properties: [
      { Name: "IsExternal", NominalValue: true },
      { Name: "ThermalTransmittance", NominalValue: 0.7 }
    ]
  });

  const win_n2 = b.addIfcWindow(ref, {
    Width: 1.5, Height: 1.2,
    Position: [buildingX + 12, buildingY + 12, z + 1.0]
  });
  b.addIfcPropertySet(win_n2, {
    Name: "Pset_WindowCommon",
    Properties: [
      { Name: "IsExternal", NominalValue: true },
      { Name: "ThermalTransmittance", NominalValue: 0.7 }
    ]
  });

  // Apartment entrance doors
  b.addIfcDoor(ref, {
    Width: 0.9, Height: 2.1,
    Position: [buildingX + 5, buildingY + 5, z]
  });

  b.addIfcDoor(ref, {
    Width: 0.9, Height: 2.1,
    Position: [buildingX + 15, buildingY + 5, z]
  });

  // Interior doors (bedrooms, bathrooms)
  b.addIfcDoor(ref, {
    Width: 0.8, Height: 2.1,
    Position: [buildingX + 4.5, buildingY + 6, z]
  });

  b.addIfcDoor(ref, {
    Width: 0.8, Height: 2.1,
    Position: [buildingX + 14.5, buildingY + 6, z]
  });

  // Staircase (1.25m width for fire safety - connects to next storey)
  if (i < storeys.length - 1) {
    b.addIfcStair(ref, {
      NumberOfRisers: 18,
      RiserHeight: 0.156,
      TreadLength: 0.28,
      Width: 1.25,
      Position: [buildingX + 8.5, buildingY + 1, z]
    });

    // Staircase enclosure walls (EI30 for fire protection)
    const stair_wall_1 = b.addIfcWall(ref, {
      Start: [buildingX + 8, buildingY + 1, z],
      End: [buildingX + 8, buildingY + 4, z],
      Height: 2.8,
      Thickness: 0.15
    });
    b.addIfcPropertySet(stair_wall_1, {
      Name: "Pset_WallCommon",
      Properties: [
        { Name: "IsExternal", NominalValue: false },
        { Name: "LoadBearing", NominalValue: false },
        { Name: "FireRating", NominalValue: "EI30" }
      ]
    });

    const stair_wall_2 = b.addIfcWall(ref, {
      Start: [buildingX + 10, buildingY + 1, z],
      End: [buildingX + 10, buildingY + 4, z],
      Height: 2.8,
      Thickness: 0.15
    });
    b.addIfcPropertySet(stair_wall_2, {
      Name: "Pset_WallCommon",
      Properties: [
        { Name: "IsExternal", NominalValue: false },
        { Name: "LoadBearing", NominalValue: false },
        { Name: "FireRating", NominalValue: "EI30" }
      ]
    });
  }
}

// ═══ 3. Roof slab (external, Minergie insulated) ═══
const roof = b.addIfcSlab(storeyRefs["OG2"], {
  Width: 20,
  Depth: 12,
  Thickness: 0.30,
  Position: [buildingX, buildingY, 8.4]
});
b.addIfcPropertySet(roof, {
  Name: "Pset_SlabCommon",
  Properties: [
    { Name: "IsExternal", NominalValue: true },
    { Name: "LoadBearing", NominalValue: true },
    { Name: "ThermalTransmittance", NominalValue: 0.18 }
  ]
});
b.addIfcMaterial(roof, { Name: "Flachdach_300mm_Daemmung_Minergie" });

// ═══ 4. Ground floor elements ═══
// Technikraum on EG (MEP equipment room)
b.addIfcSpace(storeyRefs["EG"], {
  Width: 3, Depth: 2.5, Height: 2.5,
  LongName: "Technikraum",
  Position: [buildingX + 8, buildingY + 9, 0]
});

// Foundation slab (below EG)
const foundation = b.addIfcSlab(storeyRefs["EG"], {
  Width: 20,
  Depth: 12,
  Thickness: 0.40,
  Position: [buildingX, buildingY, -0.50]
});
b.addIfcPropertySet(foundation, {
  Name: "Pset_SlabCommon",
  Properties: [
    { Name: "IsExternal", NominalValue: false },
    { Name: "LoadBearing", NominalValue: true }
  ]
});
b.addIfcMaterial(foundation, { Name: "Stahlbeton_C30_37_Fundament" });

// ═══ 5. Structural columns (6m grid spacing) ═══
const columnPositions = [
  [buildingX + 5, buildingY + 3],
  [buildingX + 5, buildingY + 9],
  [buildingX + 15, buildingY + 3],
  [buildingX + 15, buildingY + 9]
];

for (const [cx, cy] of columnPositions) {
  for (const s of storeys) {
    const col = b.addIfcColumn(storeyRefs[s.name], {
      Width: 0.3,
      Depth: 0.3,
      Height: 2.8,
      Position: [cx, cy, s.elevation]
    });
    b.addIfcMaterial(col, { Name: "Stahlbeton_C30_37" });
  }
}

// ═══ 6. Output IFC file ═══
const result = b.toIfc();
// Print IFC content to stdout (redirect to file when running)
console.log(result.content);
