// Create new IFC project
const h = bim.create.project({ Name: "Residential Building Loorenstrasse 62" });

// CONSTRAINTS from project_state.json
// Zone: W3 (Wohnzone)
// Max height: 9.5m
// Max floors: 3
// FAR: 0.9 → max GFA: 10040.4 m²
// Coverage: 0.4 → max footprint: 4462.4 m²
// Setback: 3.17m
// Parcel area: 11156 m²
// Target: 4 units, 3 storeys, Minergie

// DESIGN DECISIONS
// - 3 storeys (EG, OG1, OG2) with 2.8m storey height → total 8.4m < 9.5m ✓
// - 4 units total: 2 units per floor on EG & OG1, shared facilities on OG2
// - Footprint: 22m × 14m = 308 m² < 4462.4 m² ✓
// - GFA: 308 × 3 = 924 m² < 10040.4 m² ✓
// - Building centered at origin with setback clearance
// - Party walls between units for fire separation
// - Central staircase and elevator shaft
// - Ventilation shaft per storey for MVHR
// - Minergie-compliant envelope: U-values ≤ 0.15 (walls), ≤ 0.7 (windows), ≤ 0.18 (roof)

// Define storeys ONCE with exact elevations
const storeys = [
  { name: "EG", elevation: 0.0 },
  { name: "OG1", elevation: 2.8 },
  { name: "OG2", elevation: 5.6 }
];

const storeyIds = {};
for (const s of storeys) {
  storeyIds[s.name] = h.addIfcBuildingStorey({
    Name: s.name,
    Elevation: s.elevation
  });
}

// Create elements per storey
for (const s of storeys) {
  const storeyId = storeyIds[s.name];
  const z = s.elevation;

  // EXTERNAL WALLS (all 4 sides) - Minergie-compliant
  const w_south = h.addIfcWall(storeyId, {
    Start: [-11, -7, z], End: [11, -7, z], Height: 2.8, Thickness: 0.36
  });
  h.addIfcPropertySet(w_south, { Name: "Pset_WallCommon", Properties: [
    { Name: "IsExternal", NominalValue: true },
    { Name: "LoadBearing", NominalValue: true },
    { Name: "FireRating", NominalValue: "REI60" },
    { Name: "ThermalTransmittance", NominalValue: 0.15 }
  ]});
  h.addIfcMaterial(w_south, { Name: "Mauerwerk_360mm_EPS_Minergie" });

  const w_north = h.addIfcWall(storeyId, {
    Start: [-11, 7, z], End: [11, 7, z], Height: 2.8, Thickness: 0.36
  });
  h.addIfcPropertySet(w_north, { Name: "Pset_WallCommon", Properties: [
    { Name: "IsExternal", NominalValue: true },
    { Name: "LoadBearing", NominalValue: true },
    { Name: "FireRating", NominalValue: "REI60" },
    { Name: "ThermalTransmittance", NominalValue: 0.15 }
  ]});
  h.addIfcMaterial(w_north, { Name: "Mauerwerk_360mm_EPS_Minergie" });

  const w_west = h.addIfcWall(storeyId, {
    Start: [-11, -7, z], End: [-11, 7, z], Height: 2.8, Thickness: 0.36
  });
  h.addIfcPropertySet(w_west, { Name: "Pset_WallCommon", Properties: [
    { Name: "IsExternal", NominalValue: true },
    { Name: "LoadBearing", NominalValue: true },
    { Name: "FireRating", NominalValue: "REI60" },
    { Name: "ThermalTransmittance", NominalValue: 0.15 }
  ]});
  h.addIfcMaterial(w_west, { Name: "Mauerwerk_360mm_EPS_Minergie" });

  const w_east = h.addIfcWall(storeyId, {
    Start: [11, -7, z], End: [11, 7, z], Height: 2.8, Thickness: 0.36
  });
  h.addIfcPropertySet(w_east, { Name: "Pset_WallCommon", Properties: [
    { Name: "IsExternal", NominalValue: true },
    { Name: "LoadBearing", NominalValue: true },
    { Name: "FireRating", NominalValue: "REI60" },
    { Name: "ThermalTransmittance", NominalValue: 0.15 }
  ]});
  h.addIfcMaterial(w_east, { Name: "Mauerwerk_360mm_EPS_Minergie" });

  // INTERNAL PARTY WALL (north-south, separating units)
  const pw_ns = h.addIfcWall(storeyId, {
    Start: [0, -7, z], End: [0, 7, z], Height: 2.8, Thickness: 0.20
  });
  h.addIfcPropertySet(pw_ns, { Name: "Pset_WallCommon", Properties: [
    { Name: "IsExternal", NominalValue: false },
    { Name: "LoadBearing", NominalValue: true },
    { Name: "FireRating", NominalValue: "EI60" }
  ]});
  h.addIfcMaterial(pw_ns, { Name: "Kalksandstein_200mm_Trennwand" });

  // CENTRAL CORE WALLS (staircase + elevator + ventilation)
  const core_west = h.addIfcWall(storeyId, {
    Start: [-2.5, -2, z], End: [-2.5, 2, z], Height: 2.8, Thickness: 0.20
  });
  h.addIfcPropertySet(core_west, { Name: "Pset_WallCommon", Properties: [
    { Name: "IsExternal", NominalValue: false },
    { Name: "LoadBearing", NominalValue: true },
    { Name: "FireRating", NominalValue: "EI30" }
  ]});
  h.addIfcMaterial(core_west, { Name: "Stahlbeton_C30_37" });

  const core_east = h.addIfcWall(storeyId, {
    Start: [2.5, -2, z], End: [2.5, 2, z], Height: 2.8, Thickness: 0.20
  });
  h.addIfcPropertySet(core_east, { Name: "Pset_WallCommon", Properties: [
    { Name: "IsExternal", NominalValue: false },
    { Name: "LoadBearing", NominalValue: true },
    { Name: "FireRating", NominalValue: "EI30" }
  ]});
  h.addIfcMaterial(core_east, { Name: "Stahlbeton_C30_37" });

  // FLOOR SLAB
  const slab = h.addIfcSlab(storeyId, {
    Width: 22, Depth: 14, Thickness: 0.25, Position: [-11, -7, z]
  });
  h.addIfcPropertySet(slab, { Name: "Pset_SlabCommon", Properties: [
    { Name: "IsExternal", NominalValue: false },
    { Name: "LoadBearing", NominalValue: true }
  ]});
  h.addIfcMaterial(slab, { Name: "Stahlbeton_C30_37" });

  // SPACES - Unit 1 (West side) on EG and OG1
  if (s.name === "EG" || s.name === "OG1") {
    h.addIfcSpace(storeyId, {
      Width: 8.5, Depth: 6, Height: 2.5,
      LongName: `Wohnung_${s.name}_West_Wohnzimmer`,
      Position: [-11, -7, z]
    });
    h.addIfcSpace(storeyId, {
      Width: 4.5, Depth: 3.5, Height: 2.5,
      LongName: `Wohnung_${s.name}_West_Schlafzimmer`,
      Position: [-11, 1, z]
    });
    h.addIfcSpace(storeyId, {
      Width: 3, Depth: 2.5, Height: 2.5,
      LongName: `Wohnung_${s.name}_West_Kueche`,
      Position: [-6, -7, z]
    });
    h.addIfcSpace(storeyId, {
      Width: 2.5, Depth: 2, Height: 2.5,
      LongName: `Wohnung_${s.name}_West_Bad`,
      Position: [-3, -7, z]
    });
  }

  // SPACES - Unit 2 (East side) on EG and OG1
  if (s.name === "EG" || s.name === "OG1") {
    h.addIfcSpace(storeyId, {
      Width: 8.5, Depth: 6, Height: 2.5,
      LongName: `Wohnung_${s.name}_Ost_Wohnzimmer`,
      Position: [2.5, -7, z]
    });
    h.addIfcSpace(storeyId, {
      Width: 4.5, Depth: 3.5, Height: 2.5,
      LongName: `Wohnung_${s.name}_Ost_Schlafzimmer`,
      Position: [6.5, 1, z]
    });
    h.addIfcSpace(storeyId, {
      Width: 3, Depth: 2.5, Height: 2.5,
      LongName: `Wohnung_${s.name}_Ost_Kueche`,
      Position: [3, -7, z]
    });
    h.addIfcSpace(storeyId, {
      Width: 2.5, Depth: 2, Height: 2.5,
      LongName: `Wohnung_${s.name}_Ost_Bad`,
      Position: [0.5, -7, z]
    });
  }

  // SPACES - Common areas on OG2
  if (s.name === "OG2") {
    h.addIfcSpace(storeyId, {
      Width: 10, Depth: 6, Height: 2.5,
      LongName: "Gemeinschaftsraum",
      Position: [-11, -7, z]
    });
    h.addIfcSpace(storeyId, {
      Width: 8.5, Depth: 6, Height: 2.5,
      LongName: "Waschkueche",
      Position: [2.5, -7, z]
    });
  }

  // VENTILATION SHAFT (required per storey for MVHR)
  h.addIfcSpace(storeyId, {
    Width: 1.0, Depth: 0.8, Height: 2.8,
    LongName: "Lueftungsschacht",
    Position: [-1.5, 0, z]
  });

  // STAIRCASE (width ≥ 1.2m for fire safety)
  if (s.name !== "OG2") {
    h.addIfcStair(storeyId, {
      NumberOfRisers: 18,
      RiserHeight: 0.156,
      TreadLength: 0.28,
      Width: 1.3,
      Position: [0, -1, z]
    });
  }

  // WINDOWS - South facade (living rooms)
  for (let i = 0; i < 4; i++) {
    const x_pos = -9 + i * 5;
    if (Math.abs(x_pos) > 2) { // Skip central core area
      const win = h.addIfcWindow(storeyId, {
        Width: 1.8, Height: 1.5, Position: [x_pos, -7, z + 0.9]
      });
      h.addIfcPropertySet(win, { Name: "Pset_WindowCommon", Properties: [
        { Name: "IsExternal", NominalValue: true },
        { Name: "ThermalTransmittance", NominalValue: 0.7 }
      ]});
      h.addIfcMaterial(win, { Name: "Fenster_3fach_Minergie" });
    }
  }

  // WINDOWS - North facade
  for (let i = 0; i < 3; i++) {
    const x_pos = -7.5 + i * 7.5;
    if (Math.abs(x_pos) > 2) {
      const win = h.addIfcWindow(storeyId, {
        Width: 1.2, Height: 1.2, Position: [x_pos, 7, z + 1.1]
      });
      h.addIfcPropertySet(win, { Name: "Pset_WindowCommon", Properties: [
        { Name: "IsExternal", NominalValue: true },
        { Name: "ThermalTransmittance", NominalValue: 0.7 }
      ]});
      h.addIfcMaterial(win, { Name: "Fenster_3fach_Minergie" });
    }
  }

  // DOORS - Entrance doors
  if (s.name === "EG") {
    h.addIfcDoor(storeyId, {
      Width: 1.1, Height: 2.1,
      Position: [-8, -7, z],
      LongName: "Entrance_West"
    });
    h.addIfcDoor(storeyId, {
      Width: 1.1, Height: 2.1,
      Position: [8, -7, z],
      LongName: "Entrance_East"
    });
  }

  // DOORS - Unit internal doors
  if (s.name === "EG" || s.name === "OG1") {
    // West unit doors
    h.addIfcDoor(storeyId, { Width: 0.9, Height: 2.1, Position: [-5, 1, z] });
    h.addIfcDoor(storeyId, { Width: 0.8, Height: 2.1, Position: [-3, -5, z] });
    // East unit doors
    h.addIfcDoor(storeyId, { Width: 0.9, Height: 2.1, Position: [6.5, 1, z] });
    h.addIfcDoor(storeyId, { Width: 0.8, Height: 2.1, Position: [3, -5, z] });
  }
}

// TECHNIKRAUM on EG (required for MEP)
h.addIfcSpace(storeyIds["EG"], {
  Width: 3.5, Depth: 2.5, Height: 2.5,
  LongName: "Technikraum",
  Position: [-1.5, 4.5, 0]
});

// ROOF SLAB (external, Minergie-compliant)
const roof = h.addIfcSlab(storeyIds["OG2"], {
  Width: 22, Depth: 14, Thickness: 0.30, Position: [-11, -7, 8.4]
});
h.addIfcPropertySet(roof, { Name: "Pset_SlabCommon", Properties: [
  { Name: "IsExternal", NominalValue: true },
  { Name: "LoadBearing", NominalValue: true },
  { Name: "ThermalTransmittance", NominalValue: 0.18 }
]});
h.addIfcMaterial(roof, { Name: "Flachdach_300mm_Daemmung_Minergie" });

// FOUNDATION SLAB
const foundation = h.addIfcSlab(storeyIds["EG"], {
  Width: 22.5, Depth: 14.5, Thickness: 0.40, Position: [-11.25, -7.25, -0.40]
});
h.addIfcPropertySet(foundation, { Name: "Pset_SlabCommon", Properties: [
  { Name: "IsExternal", NominalValue: false },
  { Name: "LoadBearing", NominalValue: true }
]});
h.addIfcMaterial(foundation, { Name: "Stahlbeton_C30_37_Fundament" });

// INTERIOR COLUMNS (structural grid at 6m spacing)
const columnPositions = [
  [-6, -3, 0], [-6, 3, 0],
  [6, -3, 0], [6, 3, 0]
];
for (const pos of columnPositions) {
  for (const s of storeys) {
    const col = h.addIfcColumn(storeyIds[s.name], {
      Width: 0.3, Depth: 0.3, Height: 2.8, Position: [pos[0], pos[1], s.elevation]
    });
    h.addIfcPropertySet(col, { Name: "Pset_ColumnCommon", Properties: [
      { Name: "LoadBearing", NominalValue: true }
    ]});
    h.addIfcMaterial(col, { Name: "Stahlbeton_C30_37" });
  }
}

// Generate IFC content
const { content, stats } = h.toIfc();

// Output stats to stderr and content to stdout
console.error("STATS:", JSON.stringify(stats));
console.log(content);
