# Design v1 Log — Cycle 0 Initial Design

**Date**: 2026-03-19
**Project**: zh-loorenstrasse-20260319-001
**Address**: Loorenstrasse 62, 8053 Zürich
**Zone**: W3 (Wohnzone W3)

---

## Design Overview

### Building Program
- **Type**: Multi-family residential building
- **Units**: 6 apartments (2 per floor)
- **Storeys**: 3 (EG, OG1, OG2)
- **Energy Standard**: Minergie
- **Total Height**: 8.4m (including 0.3m roof slab)

### Building Dimensions
- **Footprint**: 20m × 12m = 240 m²
- **Gross Floor Area**: 240 m² × 3 storeys = 720 m²
- **Storey Height**: 2.8m (usable 2.5m)
- **Location**: Centered at parcel centroid (32.75, -41.88) in local coordinates

### Apartment Layout (per floor)
Each floor contains 2 mirror units:
- **Unit 1 (West)**: Living room (49.5 m²), bedroom (12 m²), kitchen (10 m²), bathroom (4 m²)
- **Unit 2 (East)**: Living room (49.5 m²), bedroom (12 m²), kitchen (10 m²), bathroom (4 m²)
- **Shared**: Staircase (1.25m wide), ventilation shaft (0.8 m²)

---

## Zoning Compliance Check

| Parameter | Limit (W3) | Design | Status |
|-----------|-----------|--------|--------|
| Max Height | 9.5m | 8.4m (8.1m to roof base) | ✅ OK (88%) |
| Max Floors | 3 | 3 | ✅ OK |
| Max GFA | 10,040.4 m² | 720 m² | ✅ OK (7%) |
| Max Footprint | 4,462.4 m² | 240 m² | ✅ OK (5%) |
| Setback | 3.17m | 3.17m minimum | ✅ OK |

**Notes**:
- Building positioned at parcel centroid with full setback compliance
- Very conservative use of allowable FAR (0.065 vs. 0.9 max) and coverage (0.02 vs. 0.4 max)
- Significant potential for expansion in future cycles if needed

---

## Structural Design (SIA 260-265)

### Load-Bearing Elements
- **External Walls**: 360mm masonry with EPS insulation, REI60 fire rating
  - 12 external walls (3 per storey × 4 sides)
- **Party Walls**: 200mm masonry, EI60 fire separation between units
  - 3 party walls (1 per storey)
- **Floor Slabs**: 250mm reinforced concrete C30/37
  - 3 floor slabs (EG, OG1, OG2)
- **Roof Slab**: 300mm insulated flat roof, external thermal envelope
  - 1 roof slab at 8.4m elevation
- **Foundation**: 400mm concrete slab at -0.5m
  - 1 foundation slab

### Structural Grid
- **Columns**: 12 total (4 locations × 3 storeys)
  - Grid spacing: 5m × 6m (within 6m limit)
  - Dimensions: 300mm × 300mm reinforced concrete

---

## MEP Design (SIA 382.1)

### Ventilation System
- **MVHR Shaft**: 1.0m × 0.8m continuous vertical shaft on each storey
  - 3 ventilation shafts total (one per storey)
  - Located centrally in building core
- **Technical Room**: 3m × 2.5m mechanical/electrical room on EG
  - Houses MVHR unit, distribution, controls
- **Storey Height**: 2.8m provides 0.3m zone for horizontal duct distribution

### Space Count
- **Residential Spaces**: 24 (8 per storey: 2 living rooms, 2 bedrooms, 2 kitchens, 2 bathrooms)
- **Service Spaces**: 3 ventilation shafts + 1 technical room
- **Total Spaces**: 28

---

## Facade Design (SIA 380/1, Minergie)

### Thermal Performance
- **External Walls**: U-value = 0.15 W/m²K (Minergie compliant)
  - Material: Mauerwerk_360mm_EPS_Minergie
- **Windows**: U-value = 0.7 W/m²K (triple-glazed)
  - 12 windows total (4 per storey: 2 south-facing living rooms, 2 north-facing kitchens)
- **Roof**: U-value = 0.18 W/m²K
  - Material: Flachdach_300mm_Daemmung_Minergie

### Openings
- **Windows**:
  - South facade: 2 × 2.4m wide × 1.5m high (living rooms)
  - North facade: 2 × 1.5m wide × 1.2m high (kitchens)
- **Doors**:
  - Apartment entrances: 0.9m × 2.1m (6 total)
  - Interior doors: 0.8m × 2.1m (6 total)

---

## Fire Safety (VKF)

### Fire Separation
- **Party Walls**: EI60 fire rating between residential units
- **External Walls**: REI60 fire rating
- **Staircase Enclosure**: EI30 fire-rated walls

### Egress
- **Staircase Width**: 1.25m (exceeds 1.2m minimum)
  - 2 stairs total (EG→OG1, OG1→OG2)
- **Riser Height**: 156mm (18 risers per flight)
- **Tread Depth**: 280mm

---

## Element Summary

| Element Type | Count | Notes |
|-------------|-------|-------|
| IfcWall | 19 | 12 external + 3 party walls + 4 stair enclosures |
| IfcSlab | 5 | 3 floors + 1 roof + 1 foundation |
| IfcSpace | 28 | 24 rooms + 3 shafts + 1 technical room |
| IfcWindow | 12 | All with thermal properties |
| IfcDoor | 12 | 6 entrance + 6 interior |
| IfcStair | 2 | Connecting 3 storeys |
| IfcColumn | 12 | Structural grid 4 locations × 3 storeys |
| **Total Entities** | **1,656** | Full IFC4 model |

---

## Property Set Coverage

### Applied Property Sets
- **Pset_WallCommon**: IsExternal, LoadBearing, FireRating, ThermalTransmittance
- **Pset_SlabCommon**: IsExternal, LoadBearing, ThermalTransmittance (roof only)
- **Pset_WindowCommon**: IsExternal, ThermalTransmittance

### Materials Assigned
- Mauerwerk_360mm_EPS_Minergie (external walls)
- Mauerwerk_200mm_Brandschutz (party walls)
- Stahlbeton_C30_37 (slabs, columns)
- Stahlbeton_C30_37_Fundament (foundation)
- Flachdach_300mm_Daemmung_Minergie (roof)

---

## Validation Results

### Structural Validation
✅ **PASSED** — IFC4 schema valid, 0 errors

### Warnings
⚠️ Quantity sets missing (90/90 elements) — not critical for initial design

### IDS Validation
⚠️ **SKIPPED** — Tool error (DOMParser issue)
- Will be validated by specialists in next cycle

---

## Known Issues / Next Steps

### For Specialist Review
1. **Structural Engineer**: Verify column grid, slab spans, load-bearing wall layout
2. **MEP Engineer**: Confirm MVHR shaft sizing, technical room equipment fit
3. **Facade Engineer**: Review window-to-wall ratio, thermal bridge details
4. **Fire Safety**: Verify escape routes, fire compartmentation strategy

### Potential Improvements
- Add quantity sets (Qto_WallBaseQuantities, etc.) for quantity take-off
- Add building-level property sets (Pset_BuildingCommon with GrossFloorArea, NumberOfStoreys)
- Consider adding IfcSpace to staircase for circulation area calculation
- Add georeferencing (IfcMapConversion) matching site_context.ifc

---

## Georeferencing

**Note**: Project origin from project_state.json:
- Easting: 2687200.0
- Northing: 1246500.0
- Height: 567.0
- EPSG: 2056 (CH1903+ / LV95)

Building local coordinates:
- Origin: (22.75, -47.88, 0)
- Extent: 20m × 12m × 8.4m

**Action Required**: Add IfcMapConversion to align with site_context.ifc in next revision.

---

**Status**: ✅ Ready for specialist review
**File**: workspace/design_v1.ifc
**Next**: Await BCF feedback from structural, MEP, facade, and fire specialists
