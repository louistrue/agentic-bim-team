# BIM Agent Team — Swiss Residential Construction

## IFC Analysis & Creation (ifc-lite CLI)

Use `ifc-lite` for ALL BIM operations. It's designed for LLM terminal use.

### Quick Reference
- `ifc-lite info <file> --json`                     — model summary
- `ifc-lite query <file> --type <T> --all --json`   — entities + all props
- `ifc-lite eval <file> "<JS expr>" --json`          — arbitrary SDK query (most flexible)
- `ifc-lite props <file> --id <N>`                   — single entity full detail
- `ifc-lite create <type> --from-json --out <f>`     — create element from piped JSON
- `ifc-lite run <script.js> <file>`                  — run JS with full bim SDK
- `ifc-lite merge <files...> --out <f> --schema IFC4`
- `ifc-lite validate <file> --json`
- `ifc-lite ids <file> <spec.ids> --json`            — exit 0=pass, 1=fail
- `ifc-lite diff <v1> <v2> --by-entity --json`
- `ifc-lite bcf create --title "..." --description "..." --out <f>`
- `ifc-lite view <f1> [<f2>] --port 3456`
- `ifc-lite bsdd psets <IfcType>`
- `ifc-lite schema --compact`                        — discover full API

**Always use `--json` for machine-readable output. Run `ifc-lite schema --compact` at session start.**

### IFC create element types
wall, slab, roof, gable-roof, column, circular-column, beam, i-shape-beam,
door, window, stair, ramp, railing, footing, pile, space, curtain-wall,
furnishing, plate, member, proxy (30+ total)

### Supported --from-json fields per type (examples)
- wall:   Start, End, Height, Thickness
- slab:   Width, Depth, Thickness, Position
- space:  Width, Depth, Height, LongName, Position
- stair:  NumberOfRisers, RiserHeight, TreadLength, Width

## File Conventions
- workspace/site_context.ifc  — IMMUTABLE. Never modify.
- workspace/design_vN.ifc     — Architect only creates/replaces this
- workspace/project_state.json — Read for context, Orchestrator writes cycle/phase updates
- workspace/*_vN.bcf          — Specialists write, Architect reads open ERRORs

## Swiss Norms
- SIA 416 areas: NGF (net), GGF (gross), NNF (ancillary), VF (circulation) — set on every IfcSpace
- SIA 380/1: external wall Umax = 0.20 W/m²K; window Umax = 1.0 W/m²K (MuKEn 2014)
- SIA 382.1: residential ventilation; SIA 180: thermal comfort
- SIA 260–265: structural; SIA 261: wind/snow loads
- VKF Brandschutz: escape route < 35m; staircase width ≥ 1.2m (residential)
- Coordinate system: EPSG:2056 (Swiss LV95). Vertical: LN02.

## Common Zürich Zone Codes
W2/W3/W4: Wohnzone (residential), digit = max full storeys
MK:  Mischzone Kerngebiet (mixed use, commercial + residential)
GI/II: Gewerbezone (industrial/commercial)
L:   Landwirtschaftszone — no new construction
ZH default setback: max(3.0m, H/3) for W-zones

## BCF Severity Conventions
ERROR   — must fix before project proceeds (zone violation, fire safety, structural failure risk)
WARNING — should fix, logged in final report
INFO    — advisory only, architect to consider

## Georeferencing Rule (CRITICAL)
The Architect MUST use the IDENTICAL IfcMapConversion values from project_state.json.
These come from site_context.ifc. Any deviation causes the building to appear misplaced in the viewer.
Values: project_state.json → site.ifc_project_origin → { e, n, z }
