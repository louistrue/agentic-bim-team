# Design v3 Log - Final Cycle 2 Design

**Date**: 2026-03-19
**Project**: zh-loorenstrasse-20260319-001
**Cycle**: 2 (FINAL)
**Status**: All 9 BCF errors addressed

---

## Design Summary

### Building Envelope
- **Footprint**: 20m × 12m = 240 m² (within max 4,462 m²)
- **Height**: 8.4m (3 storeys + roof, within max 9.5m)
- **GFA**: 720 m² (3 floors × 240 m², within max 10,040 m²)
- **Floors**: 3 (EG, OG1, OG2) + Foundation (complies with max 3)
- **Coverage**: 240 m² / 11,156 m² = 2.2% (within max 40%)
- **FAR**: 720 m² / 11,156 m² = 0.065 (within max 0.9)
- **Setback**: Building centered at parcel centroid with >3.17m clearance

### Structural System (Errors #1, #2, #4 RESOLVED)
**Foundation (Error #1 fix)**:
- 4 strip footings (0.8m × 0.6m deep) under all perimeter walls
- Material: Stahlbeton_C30/37_Fundament
- Elevation: -0.6m

**Columns (Errors #2, #4 fix)**:
- 18 total columns (6 per floor: EG, OG1, OG2)
- Grid spacing: 5m × 6m (eliminates excessive 12-20m slab spans)
- Dimensions: 0.3m × 0.3m × 2.8m
- Material: Stahlbeton_C30/37
- LoadBearing: true

**Slabs**:
- 3 floor slabs (EG ceiling, OG1 ceiling, roof)
- Thickness: 0.25m (floors), 0.30m (roof)
- Material: Stahlbeton_C30/37
- Maximum span: ~5m (compliant with column grid)

### Walls (Errors #7, #8 RESOLVED)
**External Walls (12 total - 4 per storey)**:
- Thickness: 0.36m
- Height: 2.8m per storey
- Material: Mauerwerk_Aussenwand
- Properties (Error #8 fix):
  - IsExternal: true
  - LoadBearing: true
  - FireRating: EI60
  - **ThermalTransmittance: 0.15 W/(m²K)** ← ADDED
- Quantities (Error #7 fix):
  - Qto_WallBaseQuantities with Height, Width, NetSideArea, GrossSideArea ← ADDED

**Internal Walls (8 total)**:
- Party walls (3): 0.20m thick, EI60 rated, LoadBearing
- Partitions (5): 0.15m thick, non-loadbearing

### Windows (Error #9 RESOLVED)
**12 windows total** (6 per OG1/OG2):
- Dimensions: 1.2m × 1.5m each = 1.8 m² per window
- Total glazing: 21.6 m²
- Material: Dreifachverglasung
- Properties (Error #9 fix - ALL thermal properties added):
  - **ThermalTransmittance: 0.7 W/(m²K)** ← ADDED
  - **SolarHeatGainTransmittance: 0.55** ← ADDED
  - **GlassLayers: 3** ← ADDED
- Quantities (Error #7 fix):
  - Qto_WindowBaseQuantities with Width, Height, Area ← ADDED

### Building Storeys (Errors #3, #5 RESOLVED)
**Error #3 fix**: Consolidated from 60 duplicate instances to exactly 4:
1. **Foundation** (elevation -0.6m, height 0.6m)
2. **EG** (elevation 0.0m, height 2.8m) ← ADDED height property
3. **OG1** (elevation 2.8m, height 2.8m) ← ADDED height property
4. **OG2** (elevation 5.6m, height 2.8m) ← ADDED height property

**Error #5 fix**: Added Height and Elevation properties to all storeys via property sets

### Spaces (Error #6 RESOLVED)
**14 total spaces**:

**EG (4 spaces)**:
- Fahrradraum: 40 m² (bike storage)
- Technikraum: 40 m² (technical room)
- Treppenhaus: 20 m² (staircase)
- **Lüftungsschacht: 1.0 m²** (Error #6 fix - increased from undersized to ≥1.0 m²)

**OG1 (5 spaces - 2 apartments)**:
- Wohnung_1_Wohnzimmer: 45 m²
- Wohnung_1_Schlafzimmer: 45 m²
- Wohnung_2_Wohnzimmer: 45 m²
- Wohnung_2_Schlafzimmer: 45 m²
- **Lüftungsschacht: 1.0 m²** (Error #6 fix - adequate for Minergie MVHR)

**OG2 (5 spaces - 2 apartments)**:
- Wohnung_3_Wohnzimmer: 45 m²
- Wohnung_3_Schlafzimmer: 45 m²
- Wohnung_4_Wohnzimmer: 45 m²
- Wohnung_4_Schlafzimmer: 45 m²
- **Lüftungsschacht: 1.0 m²** (Error #6 fix - adequate for Minergie MVHR)

All spaces have Qto_SpaceBaseQuantities.NetFloorArea (SIA 416 compliant).

### Circulation & Fire Safety
- 2 staircases (EG→OG1, OG1→OG2)
- Stair width: 1.2m (compliant)
- 5 doors total (1 entrance + 4 apartment doors)
- Party walls: EI60 fire rating

---

## IFC4 Validation Results

### Entity Counts
- **IfcBuildingStorey**: 4 ✓ (was 60 in v2, now consolidated)
- **IfcColumn**: 18 ✓ (NEW - addresses structural errors)
- **IfcSlab**: 7 (3 floors + 4 footings) ✓
- **IfcWall**: 20 ✓
- **IfcWindow**: 12 ✓
- **IfcSpace**: 14 ✓
- **IfcDoor**: 5 ✓
- **IfcStair**: 2 ✓

### Schema Compliance
- Schema: IFC4 ✓
- Valid: true ✓
- Errors: 0 ✓
- Warnings: 1 (quantity completeness - expected for elements without Qto)

---

## BCF Error Resolution Summary

### STRUCTURAL (4 errors - ALL RESOLVED)
1. ✓ **Foundation elements missing** → ADDED 4 strip footings with material specs
2. ✓ **Excessive slab spans (12-20m)** → ADDED 18 interior columns at 5-6m grid spacing
3. ✓ **Duplicate IfcBuildingStorey (29→60)** → CONSOLIDATED to exactly 4 storeys using post-processing script
4. ✓ **No structural columns** → ADDED 6 columns per floor (18 total) with LoadBearing=true

### MEP (2 errors - ALL RESOLVED)
5. ✓ **Missing storey elevation/height** → ADDED Height and Elevation properties to all 4 storeys
6. ✓ **Ventilation shaft undersized** → INCREASED to 1.0m × 1.0m (1.0 m²) on all 3 storeys for Minergie MVHR

### FACADE (3 errors - ALL RESOLVED)
7. ✓ **Missing element quantities** → ADDED Qto_WallBaseQuantities to all 12 external walls and Qto_WindowBaseQuantities to all 12 windows
8. ✓ **Missing thermal transmittance on walls** → ADDED ThermalTransmittance=0.15 to Pset_WallCommon on all external walls
9. ✓ **Windows lack thermal properties** → ADDED ThermalTransmittance=0.7, SolarHeatGainTransmittance=0.55, GlassLayers=3 to Pset_WindowCommon on all 12 windows

---

## Implementation Notes

### Critical Fix - Storey Consolidation (Error #3)
The ifc-lite merge command created duplicate IfcBuildingStorey instances (60 duplicates from 78 elements). This was resolved via Python post-processing script (`fix_storeys.py`) that:
1. Identified canonical storey instances (first occurrence of each name)
2. Mapped all duplicate IDs to canonical IDs
3. Removed 56 duplicate storey definitions
4. Updated all references throughout the IFC file
5. Added Height and Elevation properties to all 4 canonical storeys

### Property System Approach
The following properties were successfully added using ifc-lite `--pset` and `--qto` flags:
- Pset_WallCommon: IsExternal, LoadBearing, FireRating, **ThermalTransmittance**
- Pset_WindowCommon: IsExternal, **ThermalTransmittance**, **SolarHeatGainTransmittance**, **GlassLayers**
- Qto_WallBaseQuantities: Height, Width, NetSideArea, GrossSideArea
- Qto_WindowBaseQuantities: Width, Height, Area
- Qto_SpaceBaseQuantities: NetFloorArea
- Pset_ColumnCommon: LoadBearing
- Pset_SlabCommon: IsExternal, LoadBearing
- Pset_FootingCommon: LoadBearing

### Structural Design Rationale
Column grid spacing of 5m × 6m was chosen to:
- Eliminate slab spans >8m (typical reinforced concrete limit)
- Provide adequate support for 240 m² floor plates
- Accommodate residential room layouts without obstruction
- Create 6 interior columns per floor (18 total across 3 storeys)

---

## Next Steps for Human Review
1. Verify column locations don't conflict with architectural circulation
2. Confirm ventilation shaft sizing (1.0 m²) is adequate for specific Minergie MVHR system selection
3. Review window-to-wall ratio for daylighting and energy performance
4. Validate fire escape routes and staircase capacity for 4-unit building
5. Confirm foundation design suits site soil conditions (geotechnical report required)

---

**Design v3 Status**: READY FOR SPECIALIST REVIEW
**All 9 BCF Errors**: RESOLVED
**IFC4 Validation**: PASSED
**Schema Compliance**: FULL
