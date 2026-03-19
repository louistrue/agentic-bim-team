# BIM Project Report — Final

**Project ID:** zh-loorenstrasse-20260319-001
**Date:** 2026-03-19
**Status:** ESCALATED TO HUMAN REVIEW (max cycles reached with 4 remaining errors)

---

## 1. Project Summary

| Field | Value |
|---|---|
| **Address** | Loorenstrasse 62, 8053 Zurich |
| **EGRID** | CH999979659148 |
| **Parcel** | WI3988 (11,156 m2) |
| **Municipality** | Zurich, Canton ZH |
| **Coordinates (LV95)** | E 2,687,232.75 / N 1,246,458.125 |
| **Zone** | W3 — Wohnzone W3 (Residential) |
| **Program** | Residential, 4 units |
| **Energy Standard** | Minergie |
| **Budget Class** | Standard |

## 2. Zoning Constraints (W3)

| Parameter | Limit | Design v3 | Status |
|---|---|---|---|
| Max height | 9.5 m | 8.4 m | COMPLIANT |
| Max floors | 3 | 3 (+foundation) | COMPLIANT |
| FAR | 0.90 | 0.065 (720/11,156) | COMPLIANT |
| Coverage | 0.40 | 0.022 (240/11,156) | COMPLIANT |
| Max GFA | 10,040 m2 | 720 m2 | COMPLIANT |
| Max footprint | 4,462 m2 | 240 m2 | COMPLIANT |
| Setback | 3.17 m | >3.17 m | COMPLIANT |

## 3. Design Description (Final: design_v3.ifc)

### Building Overview
- **Footprint:** 20 m x 12 m = 240 m2
- **Storeys:** 3 residential (EG, OG1, OG2) + foundation level
- **Total height:** 8.4 m (storey height 2.8 m)
- **Total GFA:** 720 m2
- **Residential units:** 4 apartments

### Structural System
- **Walls:** 20 total (12 external load-bearing masonry, 3 internal load-bearing masonry with EI60, 5 gypsum partitions)
- **Columns:** 18 interior C30/37 concrete columns at 5 m x 6 m grid (6 per floor)
- **Slabs:** 7 concrete slabs (C30/37, 250 mm thick)
- **Foundations:** 4 strip footings (C30/37, 800 mm x 600 mm deep)
- **Stairs:** 2 staircases connecting all floors

### Spaces
- **14 total spaces** including living rooms, bedrooms, kitchens, a Technikraum (40 m2), and 3 ventilation shafts (1.0 m2 each)
- **Net floor area:** ~417 m2

### Thermal Envelope (Minergie)
- **External walls:** Mauerwerk_Aussenwand, U = 0.15 W/(m2K) — meets Minergie
- **Windows:** Dreifachverglasung (triple glazing), U = 0.7 W/(m2K), g = 0.55 — meets Minergie
- **Roof:** C30/37 concrete — U-value NOT YET SPECIFIED (requires human action)

### MEP Provisions
- **Ventilation shafts:** 3x Luftungsschacht (1.0 m2 each, all storeys) for Minergie MVHR
- **Technikraum:** 40 m2 on EG for central plant

## 4. Convergence History

| Cycle | Design | Errors | Warnings | Infos | Key Changes |
|---|---|---|---|---|---|
| 0 | design_v1.ifc | **7** | 7 | 4 | Initial design — missing thermal properties, fire ratings, ventilation shaft |
| 1 | design_v2.ifc | **9** | 5 | 3 | +Ventilation shaft, +fire ratings; but +structural errors (no columns/foundations, duplicate storeys) |
| 2 | design_v3.ifc | **4** | 7 | 5 | +Foundations, +18 columns, +storey data, +U-values, +window thermal; persistent quantity issues |

### Error Trajectory: 7 -> 9 -> 4

**Total issues resolved across 3 cycles:** 13 unique errors closed
**Remaining after max cycles:** 4 errors requiring human intervention

## 5. Remaining Errors (Escalated to Human)

### ERROR 1: Columns don't extend to foundation level
- **Discipline:** Structural
- **Severity:** Critical
- **Detail:** 18 columns on EG/OG1/OG2 are not spatially connected to the foundation storey. Load path is incomplete.
- **Fix:** Extend 6 EG columns to Foundation level (-0.6 m) or add column stubs on foundation storey.
- **Norm:** SIA 262 S5.2.1

### ERROR 2: Ceiling height below minimum after MEP deduction
- **Discipline:** MEP
- **Severity:** Major
- **Detail:** 2.8 m structural height - 0.3 m MEP zone = 2.5 m usable. SIA 416 minimum is 2.4 m (compliant), but specialist flagged potential issues with MEP routing.
- **Fix:** Verify MEP routing clearance; consider increasing to 3.0 m if major ductwork is needed.
- **Norm:** SIA 416:2003

### ERROR 3: Missing element quantities (Qto_WallBaseQuantities / Qto_WindowBaseQuantities)
- **Discipline:** Facade/Energy
- **Severity:** Critical (blocks Minergie verification)
- **Detail:** Despite 3 cycles of fixes, base quantity sets are not being read by the validation tool. Likely an ifc-lite CLI limitation in how quantities are attached.
- **Fix:** Manually verify quantities in an IFC viewer; re-export with native BIM tool if needed.
- **Norm:** SIA 380/1:2016

### ERROR 4: Roof slab missing U-value
- **Discipline:** Facade/Energy
- **Severity:** Major
- **Detail:** External roof slab lacks ThermalTransmittance property. Required U <= 0.15 W/(m2K) for Minergie.
- **Fix:** Add Pset_SlabCommon.ThermalTransmittance = 0.15 to roof slab element.
- **Norm:** SIA 380/1, Minergie

## 6. Remaining Warnings (7)

| # | Discipline | Warning |
|---|---|---|
| 1 | Structural | Foundation elements modeled as IfcSlab instead of IfcFooting |
| 2 | Structural | Columns missing fire rating (R60 recommended) |
| 3 | MEP | Missing wet room spaces (bathrooms, kitchens) |
| 4 | MEP | Missing electrical riser shaft |
| 5 | Facade | Window-to-wall ratio cannot be verified (depends on quantities) |
| 6 | Fire | Staircase width specifications not readable |
| 7 | Fire | Internal partition wall fire rating ambiguity (unit separation unclear) |

## 7. IDS Validation Summary

IDS (Information Delivery Specification) validation was attempted at each cycle but encountered technical limitations with the ifc-lite DOMParser. Manual IDS validation is recommended using a dedicated IFC checker tool.

## 8. Site Context

**Note:** The ifc-site service failed to generate `site_context.ifc` (internal server error). Georeferencing and neighbour context are NOT available. Solar access analysis and fire truck access verification require this file.

## 9. File Manifest

### Design Files
| File | Size | Description |
|---|---|---|
| `design_v1.ifc` | 110 KB | Cycle 0 — initial design (2,164 entities) |
| `design_v2.ifc` | 111 KB | Cycle 1 — +fire ratings, +ventilation shaft (2,171 entities) |
| `design_v3.ifc` | 184 KB | Cycle 2 — +columns, +foundations, +thermal properties (3,567 entities) |
| `design_v3_fixed.ifc` | 188 KB | Post-processed storey consolidation |

### BCF Review Files
| File | Size | Cycle | Discipline |
|---|---|---|---|
| `structural_v1.bcf` | 5.3 KB | 0 | Structural (0E, 2W, 3I) |
| `structural_v2.bcf` | 10.9 KB | 1 | Structural (4E, 1W, 1I) |
| `structural_v3.bcf` | 2.6 KB | 2 | Structural (1E, 2W, 0I) |
| `mep_v1.bcf` | 5.8 KB | 0 | MEP (2E, 2W, 0I) |
| `mep_v2.bcf` | 7.9 KB | 1 | MEP (2E, 3W, 1I) |
| `mep_v3.bcf` | 5.8 KB | 2 | MEP (1E, 2W, 1I) |
| `facade_v1.bcf` | 10.9 KB | 0 | Facade (3E, 3W, 1I) |
| `facade_v2.bcf` | 6.8 KB | 1 | Facade (3E, 1W, 1I) |
| `facade_v3.bcf` | 8.5 KB | 2 | Facade (2E, 1W, 2I) |
| `fire_v1.bcf` | 2.3 KB | 0 | Fire (1E, 0W, 0I) |
| `fire_v2.bcf` | 3.0 KB | 1 | Fire (0E, 0W, 0I) |
| `fire_v3.bcf` | 6.0 KB | 2 | Fire (0E, 2W, 2I) |

### Project Data
| File | Description |
|---|---|
| `project_state.json` | Full project state with convergence history |
| `zoning_raw.json` | Raw zoning API response |
| `design_v1_log.md` | Cycle 0 design documentation |
| `design_v2_log.md` | Cycle 1 design documentation |
| `design_v3_log.md` | Cycle 2 design documentation |
| `fix_storeys.py` | Post-processing script for storey consolidation |

## 10. Viewer Command

```bash
ifc-lite view workspace/design_v3.ifc --port 3456
```

> **Note:** `site_context.ifc` was not generated. Federated viewing with site context is unavailable until the ifc-site service is restored. When available:
> ```bash
> ifc-lite view workspace/site_context.ifc workspace/design_v3.ifc --port 3456
> ```

## 11. Recommendations for Human Review

1. **Priority 1 — Resolve 4 remaining errors** (see Section 5). Errors 1 and 3 are the most impactful.
2. **Priority 2 — Complete space programming.** Add bathrooms, WCs, and kitchens to each unit. Verify sanitary stacking alignment.
3. **Priority 3 — Add electrical riser.** Dedicated 0.6 m x 0.4 m shaft through all storeys near the stairwell core.
4. **Priority 4 — Restore ifc-site service** to generate site_context.ifc for georeferencing, solar access, and fire truck access verification.
5. **Priority 5 — Run IDS validation** with a certified IFC checker (e.g., Solibri, BIMcollab) against the Swiss residential delivery specification.

---

*Report generated autonomously by the BIM Agent Team (Claude Code). 3 design cycles completed. Escalated to human review per convergence protocol.*
