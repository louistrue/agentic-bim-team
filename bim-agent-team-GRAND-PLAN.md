# Autonomous BIM Project Team — Grand Implementation Plan
**Status**: Ready for development  
**Target**: Zürich City (MVP) → Switzerland (production)  
**Stack**: Claude Agent SDK · ifc-lite CLI · ifc-site · swiss-zoning-api

---

## 1. What We're Building

A multi-agent system that autonomously develops a building design from a plot address and brief. It mirrors a real Swiss construction project team:

1. **Site Agent** — queries Swiss open geodata, generates a 3D IFC site context model with terrain, existing buildings, roads
2. **Zoning Agent** — fetches cantonal zone code, building parameters (height, floors, FAR, coverage), ÖREB restrictions
3. **Architect Agent** — generates a proposed building as a separate IFC file, georeferenced to match the site context
4. **Specialist Agents** (structural, MEP, facade/energy, fire protection) — each reads the design IFC and writes BCF issues
5. **Orchestrator** — coordinates the team, runs feedback loops until BCF errors converge to zero (max 3 cycles), produces a final report

**The output** is a federated IFC model (site_context.ifc + design_final.ifc) with a full BCF issue log, IDS validation report, and project summary. The model is viewable in ifc-lite's browser viewer during and after generation.

**Why this is feasible now**:
- All three Swiss-specific tooling repositories already exist (Louis's own repos)
- ifc-lite CLI was designed explicitly for LLM terminal usage, has a recommended CLAUDE.md entry, and covers the full tool surface agents need
- swiss-zoning-api already aggregates multi-source zoning data for Zürich with a single HTTP call
- Claude Agent SDK (formerly Claude Code SDK) provides the exact orchestrator+subagent pattern needed, with native Bash tool execution

---

## 2. Repository Map

### 2.1 `louistrue/ifc-lite` — The Agent's Primary Tool
**URL**: https://github.com/louistrue/ifc-lite  
**Docs**: https://louistrue.github.io/ifc-lite/  
**CLI docs**: https://louistrue.github.io/ifc-lite/guide/cli/  
**Role in agent system**: Every agent's primary interface to IFC files

**What it is**: Browser-native IFC platform (Rust/WASM parser, WebGPU renderer) with a full CLI package `@ifc-lite/cli` designed specifically for LLM terminal usage.

**Install**:
```bash
npm install -g @ifc-lite/cli
# or: npx @ifc-lite/cli <command>
```

**CLI commands agents use** (all real, documented):
```bash
# Inspect
ifc-lite info model.ifc --json                          # schema, entity counts, storeys
ifc-lite query model.ifc --type IfcWall --all --json    # all entities + props/quantities/materials
ifc-lite props model.ifc --id 42                         # single entity full detail
ifc-lite eval model.ifc "<SDK expr>" --json             # arbitrary JS against bim SDK — most flexible

# Create (30+ element types)
ifc-lite create wall --start 0,0,0 --end 5,0,0 --height 3 --thickness 0.2 \
  --pset '{"Name":"Pset_WallCommon","Properties":[{"Name":"IsExternal","NominalValue":true}]}' \
  --material '{"Name":"Concrete"}' --out wall.ifc
echo '{"Start":[0,0,0],"End":[5,0,0],"Height":3}' | ifc-lite create wall --from-json --out w.ifc

# Validate / check
ifc-lite validate model.ifc --json                       # structural validity (GlobalIds, required entities)
ifc-lite ids model.ifc spec.ids --json                   # IDS validation, exit 0=pass 1=fail
ifc-lite diff v1.ifc v2.ifc --by-entity --json           # GlobalId-level diff between versions

# Collaborate
ifc-lite bcf create --title "Issue title" --description "..." --out issue.bcf
ifc-lite bcf list issues.bcf

# Merge/convert
ifc-lite merge arch.ifc struct.ifc mep.ifc --out federated.ifc --schema IFC4
ifc-lite convert old.ifc --schema IFC4 --out modern.ifc

# Viewer
ifc-lite view model.ifc                                   # opens browser, interactive
ifc-lite view model.ifc --port 3456 --no-open             # fixed port, headless
ifc-lite view --port 3456 --send '{"action":"load","file":"design_v2.ifc"}'  # remote control

# Analyze overlay on running viewer
ifc-lite analyze model.ifc --viewer 3456 --type IfcWall --missing "Pset_WallCommon.FireRating" --color red

# bSDD lookup
ifc-lite bsdd psets IfcWall                              # standard property sets
ifc-lite bsdd class IfcSlab                              # class info

# Scripts (full bim SDK in scope)
ifc-lite run analysis.js model.ifc

# API discovery (LLMs should run this first)
ifc-lite schema --compact                                 # all SDK methods + descriptions
```

**Key insight for LLM agents**: `eval` and `run` give agents arbitrary SDK access without needing dedicated subcommands. `schema` lets agents self-discover the full API. `create --from-json` is the Architect's authoring primitive.

**Packages used by agents** (beyond CLI):
```
@ifc-lite/parser     — stable, Rust/WASM, 1259 MB/s parse
@ifc-lite/query      — beta, fluent query API
@ifc-lite/ids        — IDS validation
@ifc-lite/export     — glTF, Parquet, IFC export
```

---

### 2.2 `louistrue/swiss-zoning-api` — Zone Intelligence
**URL**: https://github.com/louistrue/swiss-zoning-api  
**Live**: https://v0-swiss-zoning-api.vercel.app  
**Role**: Single HTTP call that returns everything needed to constrain the Architect

**What it is**: Next.js 16 + TypeScript API aggregating federal (geo.admin.ch, ÖREB), cantonal (ZH WFS), and municipal (BZO) zoning data. No auth. No API key.

**Coverage**:
- **Zürich City**: FULLY FUNCTIONAL — ZH WFS (maps.zh.ch) + ÖREB WFS + BZO. High confidence.
- **Other cantons**: Federal fallback only, lower confidence. Flag for human review.

**MVP constraint**: Phase 0 and Phase 1 must use Zürich City addresses only.

**The call** (everything the Architect needs in one response):
```bash
curl "http://localhost:3000/api/zoning?address=Musterstrasse+12+8006+Z%C3%BCrich"
```

**Response structure**:
```json
{
  "success": true,
  "parcel": {
    "egrid": "CH139977917088",
    "number": "AA1234",
    "area": 620,
    "municipality": "Zürich",
    "canton": "ZH",
    "coordinates": {
      "lat": 47.38, "lng": 8.54,
      "swissEasting": 2683141, "swissNorthing": 1247825
    },
    "areaSources": [{ "value": 620, "source": "Zurich Map Viewer", "confidence": "high" }]
  },
  "zone": {
    "code": "W3",
    "name": "Wohnzone W3",
    "category": "residential",
    "description": "Residential zone, 3 full storeys"
  },
  "buildingParameters": {
    "maxHeight": 10.5,
    "maxFloors": 3,
    "maxFloorAreaRatio": 0.8,
    "maxBuildingCoverage": 0.4
  },
  "buildingPotential": {
    "maxGrossFloorArea": 496,
    "maxBuildingFootprint": 248,
    "estimatedUnits": 4,
    "developmentAssessment": "high"
  },
  "restrictions": [...],
  "allowedUses": ["Residential"],
  "prohibitedUses": ["Heavy Industry"],
  "orebExtractPdfUrl": "https://...",
  "dataSourcesUsed": {
    "zone": ["Zurich WFS"],
    "buildingParams": ["Zurich ÖREB WFS"]
  }
}
```

**Gap**: `setback_m` (Grenzabstand) is not directly returned. Use default rule in Architect prompt: *"ZH W-Zones: setback = max(3.0m, building_height / 3). Verify against BZO §272."*

**How to run locally**:
```bash
cd swiss-zoning-api
pnpm install
pnpm dev   # http://localhost:3000
```

---

### 2.3 `louistrue/ifc-site` — Context IFC Generator
**URL**: https://github.com/louistrue/ifc-site  
**Live**: https://ifc-site-five.vercel.app  
**Role**: Generates the immutable site context IFC from Swiss geodata APIs

**What it is**: Python/FastAPI service generating georeferenced IFC4 files from geo.admin.ch, swisstopo, and OSM APIs.

**What it generates from a single address**:
- `IfcGeographicElement (Surrounding_Terrain)` — circular terrain mesh, LN02 elevation, Delaunay triangulation
- `IfcGeographicElement (Site_Solid)` — cadastral parcel as closed solid with precise elevation
- `IfcBuilding` per existing building — LOD2 CityGML with walls, roofs, accurate heights
- Roads (swissTLM3D, classified: Autobahn → Fussweg)
- Railways (OSM: rail, tram, funicular)
- Vegetation (swissTLM3D forest polygons)
- Optional: SWISSIMAGE satellite texture → also exports `.glb` for web preview

**IFC property sets already included**:
```
Pset_LandRegistration: LandTitleID (EGRID), LandID (parcel number)
CPset_SwissCadastre: Canton, ParcelNumber, GeoportalURL
Pset_SiteCommon: TotalArea (m²), BuildableArea (m²)
Pset_BuildingCommon: YearOfConstruction, GrossPlannedArea
```

**How to run**:
```bash
cd ifc-site
pip install -r requirements.txt
uvicorn src.rest_api:app --port 8000

# Or CLI (blocking, for testing):
python src/cli.py \
  --address "Musterstrasse 12, 8006 Zürich" \
  --all \
  --include-satellite-overlay \
  --output workspace/site_context.ifc
```

**REST API (preferred for agent use)**:
```bash
# Start background job
curl -X POST http://localhost:8000/jobs \
  -H "Content-Type: application/json" \
  -d '{"egrid":"CH139977917088","radius":300,"include_buildings":true,"include_satellite_overlay":true}' \
  | jq -r .job_id

# Poll status
curl http://localhost:8000/jobs/{job_id}

# Download
curl -o workspace/site_context.ifc http://localhost:8000/jobs/{job_id}/download
```

**Generation time**: ~2–4 min for 300m radius. Always use async REST endpoint.

**Critical output**: The `IfcMapConversion` values (project origin in EPSG:2056). The Architect must use the exact same values. Extract them with:
```bash
ifc-lite eval workspace/site_context.ifc \
  "bim.query().byType('IfcCoordinateOperation').toArray()" --json
```

---

### 2.4 New Repo: `louistrue/bim-agent-team` — The Harness
**Create this**: The orchestration layer tying everything together.

**Tech**: TypeScript, Claude Agent SDK (`@anthropic-ai/claude-agent-sdk`)

**Structure** (full layout in Section 7 below)

---

## 3. Architecture

### 3.1 Data Flow

```
Human Input
  address: "Musterstrasse 12, 8006 Zürich"
  brief:   { program: "residential", units: 4, storeys: 3, standard: "Minergie" }
        │
        ▼
┌─────────────────────────────────────────────────┐
│              ORCHESTRATOR                        │
│         Claude Opus — Lead PM                   │
│  Reads project_state.json, sequences agents,    │
│  detects convergence, writes final report       │
└────────────────────┬────────────────────────────┘
                     │ spawns subagents via Task tool
         ┌───────────┼──────────────────┐
         │           │                  │
    ─────▼─────  ────▼─────        ─────▼──────
    SITE PREP    ARCHITECT         SPECIALISTS
    (once)       (iterating)       (per cycle, parallel)
    ─────────    ──────────        ────────────
    ifc-site     ifc-lite          ifc-lite
    REST API     CLI create        CLI eval/query
    +            run/merge         + bcf create
    swiss-       + ids validate
    zoning-api   
         │           │                  │
         ▼           ▼                  ▼
  site_context.ifc  design_vN.ifc   *_vN.bcf
  zoning_brief.json ids_report.json
  project_state.json
```

### 3.2 Execution Flow

```
Phase 0: Site Prep (runs once)
  └─ Site Agent:
       1. POST /jobs to ifc-site → poll → download site_context.ifc
       2. GET /api/zoning?address=... → zoning_brief.json
       3. ifc-lite eval site_context.ifc → extract EPSG:2056 project origin
       4. Write project_state.json (all data combined)

Phase 1: Initial Design
  └─ Architect Agent (cycle=0):
       1. Read project_state.json (zone constraints + georef origin)
       2. Generate design_v1_script.js
       3. ifc-lite create/run → design_v1.ifc
       4. ifc-lite validate design_v1.ifc
       5. ifc-lite ids design_v1.ifc specs/swiss_residential_min.ids
       6. Log: design_v1_log.md

Phase 2: Specialist Review (parallel)
  ├─ Structural Agent → structural_v1.bcf
  ├─ MEP Agent        → mep_v1.bcf
  ├─ Facade Agent     → facade_v1.bcf
  └─ Fire Agent       → fire_v1.bcf

Phase 3: Convergence Check
  └─ Orchestrator:
       1. ifc-lite bcf list *_v1.bcf | count ERROR severity
       2. If 0 errors → Final Report, DONE
       3. If errors AND cycle < 3 → goto Phase 1 with BCF context
       4. If cycle == 3 → Human escalation report

Final Output
  design_final.ifc + site_context.ifc (federated)
  issues_final_merged.bcf
  ids_report_final.json
  project_report.md
  ifc-lite view URL for human review
```

### 3.3 Federated Model Philosophy

**site_context.ifc** = immutable after generation. Never modified by any agent.  
**design_vN.ifc** = the proposed building only. Versioned. Created/replaced by Architect.  
**Both load together in ifc-lite viewer** — `ifc-lite view site_context.ifc design_v1.ifc`  
**CRITICAL**: Both files must share the same `IfcMapConversion` values for correct geo-alignment.

---

## 4. Agent Specifications

### 4.1 Orchestrator

**Model**: `claude-opus-4-6`  
**Spawns**: All other agents as subagents via `Task` tool  
**Tools**: `Bash`, `Read`, `Write`, `Task`

**State machine** (encoded in prompt):
```
IF site_prep == pending  → spawn site-prep agent
IF site_prep == done AND cycle == 0 → spawn architect
IF architect == done → spawn structural, mep, facade, fire IN PARALLEL
AFTER all specialists → count BCF errors
  errors == 0 → write final report, exit
  errors > 0 AND cycle < 3 → increment cycle, spawn architect
  cycle == 3 → write escalation report, exit
```

**Convergence logic in CLAUDE.md** so Orchestrator shares it:
```
ERROR severity BCF issues block completion.
WARNING severity issues are logged, don't block.
Max cycles: 3. Then escalate to human.
```

---

### 4.2 Site Prep Agent

**Model**: `claude-sonnet-4-6` (one-shot, no iteration)  
**Tools**: `Bash`, `Write`  
**Runs**: Once at project start

**Tool calls in order**:
```bash
# 1. Generate site context
curl -X POST http://localhost:8000/jobs \
  -d '{"egrid":"...","radius":300,"include_buildings":true,"include_satellite_overlay":true}'
# Poll until done, download site_context.ifc

# 2. Get zoning (swiss-zoning-api)
curl "http://localhost:3000/api/zoning?address=..."

# 3. Extract project origin from generated IFC
ifc-lite eval workspace/site_context.ifc \
  "bim.query().byType('IfcMapConversion').first()" --json

# 4. ifc-lite info for sanity check
ifc-lite info workspace/site_context.ifc --json
```

**Output**: `workspace/project_state.json` (see Section 5)

---

### 4.3 Architect Agent

**Model**: `claude-sonnet-4-6`  
**Tools**: `Bash`, `Read`, `Write`  
**Runs**: Once per cycle (cycle 0 = fresh, cycle N = BCF-informed revision)

**Authoring approach** — agents use `ifc-lite create` for individual elements, then `merge`:

```bash
# Agent generates and pipes JSON for each element:
echo '{"Start":[3,3,0],"End":[15,3,0],"Height":2.8,"Thickness":0.36}' \
  | ifc-lite create wall --from-json \
    --pset '{"Name":"Pset_WallCommon","Properties":[
      {"Name":"IsExternal","NominalValue":true},
      {"Name":"LoadBearing","NominalValue":true},
      {"Name":"FireRating","NominalValue":"EI30"}
    ]}' \
    --material '{"Name":"Mauerwerk_Aussenwand"}' \
    --storey "EG" --elevation 0 \
    --out /tmp/wall_eg_north.ifc

# For complex multi-element logic, use run:
ifc-lite run workspace/design_v1_script.js
# Script uses: bim.create.*() methods, bim.mutate.*() for psets

# Merge all elements
ifc-lite merge /tmp/wall_*.ifc /tmp/slab_*.ifc /tmp/space_*.ifc \
  --out workspace/design_v1.ifc --schema IFC4

# Validate
ifc-lite validate workspace/design_v1.ifc --json

# IDS gate (exit code determines pass/fail)
ifc-lite ids workspace/design_v1.ifc specs/swiss_residential_min.ids --json \
  > workspace/ids_report_v1.json
echo "IDS exit: $?"
```

**Georeferencing** (must match site_context.ifc exactly — values from project_state.json):
```javascript
// In design_v1_script.js, first thing:
const origin = JSON.parse(fs.readFileSync('workspace/project_state.json')).site.ifc_project_origin;
// Use origin.e, origin.n, origin.z in IfcMapConversion
// All element coordinates are local (meters from origin)
// Parcel centroid in local coords is also in project_state.json
```

**System prompt constraints** (populated from project_state.json at runtime):
```
Zone: {zone.code} — {zone.name}
Max height: {zone.max_height_m}m    Max floors: {zone.max_floors}
Max GFA: {zone.max_gfa_m2}m²        Max footprint: {zone.max_footprint_m2}m²
Parcel area: {site.area_m2}m²       Setback: {zone.setback_m}m
Project origin (EPSG:2056): E={ifc_origin.e} N={ifc_origin.n} Z={ifc_origin.z}
Parcel centroid (local coords): x={local_cx}m y={local_cy}m

CYCLE {N} BCF ISSUES TO RESOLVE:
{list of open ERROR topics from previous cycle with globalId, title, description}
```

**Architect creates IFC structure**:
```
IfcProject (matching schema as site_context.ifc)
└── IfcSite (reference only, same EGRID)
    └── IfcBuilding
        ├── Pset_BuildingCommon (GrossFloorArea, NumberOfStoreys)
        ├── Qto_BuildingBaseQuantities (GrossFloorArea)
        └── IfcBuildingStorey [EG, OG1, OG2, DG?]
            ├── IfcSpace [per room, SIA 416 areas]
            ├── IfcWall [external: IsExternal=T, LoadBearing, FireRating, material layerset]
            ├── IfcWall [internal: LoadBearing, Trennwand]
            ├── IfcSlab [floor, roof]
            ├── IfcDoor [entrance + internal]
            └── IfcWindow [all openings with orientation]
```

---

### 4.4 Structural Engineer Agent

**Model**: `claude-sonnet-4-6`  
**Tools**: `Bash`, `Write`  
**Reads**: `design_vN.ifc` and `site_context.ifc`

**Tool calls**:
```bash
# Get all load-bearing elements with storey context
ifc-lite query workspace/design_v1.ifc \
  --type IfcWall \
  --where "Pset_WallCommon.LoadBearing=true" \
  --props --quantities --json > /tmp/load_bearing_walls.json

# Get slabs with geometry for span estimation
ifc-lite query workspace/design_v1.ifc \
  --type IfcSlab --all --json > /tmp/slabs.json

# Spatial tree — verify containment
ifc-lite query workspace/design_v1.ifc --spatial --json > /tmp/spatial_tree.json

# Check load path using eval
ifc-lite eval workspace/design_v1.ifc "
  const walls = bim.query().byType('IfcWall').toArray();
  const loadBearing = walls.filter(w => {
    const pset = bim.properties(w.ref).find(p => p.name === 'Pset_WallCommon');
    return pset?.properties.find(p => p.name === 'LoadBearing')?.value === true;
  });
  return loadBearing.map(w => ({ id: w.ref.expressId, globalId: w.globalId, name: w.name, storey: w.storey }));
" --json
```

**Checks to perform** (SIA 260/261/262):
- Load path: every LoadBearing wall in OG should have a LoadBearing element within 0.25m below in EG
- Slab spans: longest unsupported span > 6m = WARNING, > 8m = ERROR
- Shear wall distribution: ratio N-S:E-W load-bearing walls > 3:1 = WARNING
- Foundation: flag if basement present (deeper excavation, soil investigation needed)

**BCF output per issue**:
```bash
ifc-lite bcf create \
  --title "Load path gap: wall AW-OG1-N01 unsupported at EG" \
  --description "LoadBearing IfcWall GlobalId=2YcZm... at OG1 has no bearing element within 250mm below. Add IfcWall or IfcColumn at EG level at position x=5.0, y=3.0 to transfer loads to foundation. Ref: SIA 261:2020 §4.3.2" \
  --out workspace/structural_v1.bcf
```

---

### 4.5 MEP Agent

**Model**: `claude-sonnet-4-6`  
**Tools**: `Bash`, `Write`

**Tool calls**:
```bash
ifc-lite query workspace/design_v1.ifc --type IfcSpace --props --quantities --json
ifc-lite eval workspace/design_v1.ifc "
  bim.storeys().map(s => ({
    storey: s.name,
    elevation: s.elevation,
    height: s.height,
    spaces: bim.contains(s.ref)
      .filter(e => e.type === 'IfcSpace')
      .map(e => ({ name: e.name, area: e.area }))
  }))
" --json
```

**Checks** (SIA 382.1, SIA 180):
- Ventilation shafts: IfcSpace with name matching "Schacht|shaft|Lüftung" per storey — WARNING if absent and residential > 2 storeys
- Sanitary stacking: WC/Bad spaces not stacked vertically (>1m shift) = WARNING (complex piping)
- Ceiling height: storey height - 0.30m duct zone < 2.40m = WARNING (SIA 416 habitable minimum)
- Electrical riser: flag if no shaft identified for > 2-storey building

---

### 4.6 Facade / Energy Agent

**Model**: `claude-sonnet-4-6`  
**Tools**: `Bash`, `Write`

**Tool calls** (uses both IFC files):
```bash
ifc-lite query workspace/design_v1.ifc \
  --type IfcWindow --where "Pset_WindowCommon.IsExternal=true" --props --json

ifc-lite query workspace/design_v1.ifc \
  --type IfcWall --where "Pset_WallCommon.IsExternal=true" \
  --props --quantities --json

# Neighbor heights from site context (shadow check)
ifc-lite query workspace/site_context.ifc \
  --type IfcBuilding --props --json

ifc-lite eval workspace/site_context.ifc \
  "bim.query().byType('IfcBuilding').toArray().map(b => ({ name: b.name, position: b.placement }))" --json
```

**Checks** (SIA 380/1, Minergie):
- Window-to-wall ratio: N facade WFR > 20% = WARNING (heat loss), S facade WFR < 15% = INFO (missed solar)
- Thermal bridge: balcony/slab cantilever > 200mm without thermal break = WARNING
- U-value: estimate from wall thickness (0.36m masonry → U≈0.19 W/m²K vs SIA 380/1 Umax=0.20) = INFO/WARNING/ERROR
- Shadow from neighbors: neighbor height / distance > tan(25°) at 12:00 Dec 21 = WARNING (winter sun blocked)
- **ifclca.com hook**: rough GWP estimate → feeds DPP property set on IfcBuilding

---

### 4.7 Fire Protection Agent

**Model**: `claude-sonnet-4-6`  
**Tools**: `Bash`, `Write`

**Tool calls** (heavily uses site_context.ifc for access routes):
```bash
ifc-lite query workspace/design_v1.ifc --type IfcStair,IfcStairFlight --props --json
ifc-lite query workspace/design_v1.ifc --type IfcSpace --props --json
ifc-lite query workspace/design_v1.ifc \
  --type IfcWall --where "Pset_WallCommon.FireRating=EI60" --count

# Road access from site context
ifc-lite eval workspace/site_context.ifc \
  "bim.query().byType('IfcTransportElement').toArray()" --json
```

**Checks** (VKF Brandschutzrichtlinien 16-15, SIA 81):
- Escape route: path from space centroid to staircase > 35m = ERROR (residential)
- Staircase width: IfcStairFlight width < 1.2m = ERROR (VKF §3.4.1)
- Compartmentation: party walls between residential units missing FireRating = ERROR
- Vehicle access: nearest road > 50m from building entrance = WARNING (fire truck access)
- Basement > 600m²: flag for fire authority consultation = INFO

---

## 5. Shared State: project_state.json

Written by Site Prep Agent. Read-only for all others. Orchestrator updates `cycle`, `phases`, `convergence`.

```json
{
  "project_id": "zh-musterstr-20250322-001",
  "created_at": "2025-03-22T10:00:00Z",
  "address": "Musterstrasse 12, 8006 Zürich",
  "brief": {
    "program": "residential",
    "target_units": 4,
    "target_storeys": 3,
    "energy_standard": "Minergie",
    "budget_class": "standard"
  },

  "site": {
    "egrid": "CH139977917088",
    "parcel_number": "AA1234",
    "area_m2": 620,
    "municipality": "Zürich",
    "canton": "ZH",
    "coordinates_wgs84": { "lat": 47.38, "lng": 8.54 },
    "coordinates_lv95": { "e": 2683141, "n": 1247825 },
    "ifc_project_origin": { "e": 2683100, "n": 1247800, "z": 412.5 },
    "parcel_centroid_local": { "x": 41.0, "y": 25.0 },
    "files": {
      "site_context_ifc": "workspace/site_context.ifc",
      "site_context_glb": "workspace/site_context.glb"
    }
  },

  "zoning": {
    "zone_code": "W3",
    "zone_name": "Wohnzone W3",
    "zone_category": "residential",
    "max_height_m": 10.5,
    "max_floors": 3,
    "far": 0.8,
    "coverage": 0.4,
    "max_gfa_m2": 496,
    "max_footprint_m2": 248,
    "setback_m": 3.0,
    "setback_note": "ZH W3 default: max(3.0m, H/3). Verify BZO §272.",
    "allowed_uses": ["Residential"],
    "prohibited_uses": ["Heavy Industry"],
    "oreb_pdf_url": "https://...",
    "data_confidence": "high",
    "data_sources": { "zone": ["Zurich WFS"], "buildingParams": ["Zurich ÖREB WFS"] }
  },

  "cycle": 0,
  "phases": {
    "site_prep": "done",
    "design": "pending",
    "specialists": "pending"
  },
  "files": {
    "design_current": null,
    "bcf_merged_current": null
  },
  "convergence": {
    "open_errors": null,
    "open_warnings": null,
    "history": []
  }
}
```

---

## 6. CLAUDE.md — Every Agent's Shared Rulebook

Place in root of `bim-agent-team/`. Loaded by all Claude Code sessions and SDK agents.

```markdown
# BIM Agent Team — Swiss Residential Construction

## IFC Analysis & Creation (ifc-lite CLI)

Use `ifc-lite` for ALL BIM operations. It's designed for LLM terminal use.

### Quick Reference
- `ifc-lite info <file> --json`                     — model summary
- `ifc-lite query <file> --type <T> --all --json`   — entities + all props
- `ifc-lite eval <file> "<JS expr>" --json`         — arbitrary SDK query (most flexible)
- `ifc-lite props <file> --id <N>`                  — single entity full detail
- `ifc-lite create <type> --from-json --out <f>`    — create element from piped JSON
- `ifc-lite run <script.js> <file>`                 — run JS with full bim SDK
- `ifc-lite merge <files...> --out <f> --schema IFC4`
- `ifc-lite validate <file> --json`
- `ifc-lite ids <file> <spec.ids> --json`           — exit 0=pass, 1=fail
- `ifc-lite diff <v1> <v2> --by-entity --json`
- `ifc-lite bcf create --title "..." --description "..." --out <f>`
- `ifc-lite view <f1> [<f2>] --port 3456`
- `ifc-lite bsdd psets <IfcType>`
- `ifc-lite schema --compact`                       — discover full API

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
```

---

## 7. Repository Structure: `bim-agent-team`

```
bim-agent-team/
├── CLAUDE.md                        ← shared agent rules (Section 6)
├── package.json                     ← deps: @anthropic-ai/claude-agent-sdk
├── tsconfig.json
│
├── orchestrator.ts                  ← Claude Agent SDK entry point
│
├── agent-prompts/                   ← system prompts, one per agent
│   ├── orchestrator.md
│   ├── site-prep.md
│   ├── architect.md
│   ├── structural.md
│   ├── mep.md
│   ├── facade.md
│   └── fire.md
│
├── specs/
│   └── swiss_residential_min.ids    ← IDS validation spec (from idsedit.com)
│
├── services/                        ← gitmodule references or startup scripts
│   ├── ifc-site/                    ← louistrue/ifc-site (Python, port 8000)
│   └── swiss-zoning-api/            ← louistrue/swiss-zoning-api (Next.js, port 3000)
│
├── scripts/
│   ├── start-services.sh            ← starts ifc-site + swiss-zoning-api
│   └── run-project.ts               ← CLI entrypoint: ts-node run-project.ts "address" brief.json
│
└── workspace/                       ← runtime, gitignored
    ├── project_state.json
    ├── site_context.ifc             ← ifc-site output (immutable)
    ├── site_context.glb
    ├── design_v1.ifc
    ├── design_v1_script.js
    ├── design_v1_log.md
    ├── ids_report_v1.json
    ├── structural_v1.bcf
    ├── mep_v1.bcf
    ├── facade_v1.bcf
    ├── fire_v1.bcf
    ├── design_v2.ifc                ← after cycle 1 revision
    ├── ...
    └── project_report_final.md
```

---

## 8. Orchestrator Code (TypeScript)

```typescript
// orchestrator.ts
import { query } from '@anthropic-ai/claude-agent-sdk';
import { readFileSync, writeFileSync } from 'fs';

const MAX_CYCLES = 3;

const AGENT_DEFINITIONS = {
  'site-prep': {
    description: 'Generates site_context.ifc via ifc-site REST API and fetches zoning data from swiss-zoning-api. Writes project_state.json.',
    model: 'claude-sonnet-4-6' as const,
  },
  'architect': {
    description: 'Creates the proposed building IFC using ifc-lite CLI create/run/merge. Respects zone constraints. On cycle>0, resolves open BCF ERROR issues.',
    model: 'claude-sonnet-4-6' as const,
  },
  'structural': {
    description: 'Reviews structural viability (load path, slab spans, SIA 260-262). Writes BCF issues to workspace/structural_vN.bcf.',
    model: 'claude-sonnet-4-6' as const,
  },
  'mep': {
    description: 'Reviews MEP feasibility (ventilation, sanitary stacks, riser shafts, SIA 382). Writes BCF to workspace/mep_vN.bcf.',
    model: 'claude-sonnet-4-6' as const,
  },
  'facade': {
    description: 'Reviews facade & energy performance (WFR, U-values, thermal bridges, SIA 380/1). Writes BCF to workspace/facade_vN.bcf.',
    model: 'claude-sonnet-4-6' as const,
  },
  'fire': {
    description: 'Reviews fire safety (escape routes, compartmentation, access, VKF). Writes BCF to workspace/fire_vN.bcf.',
    model: 'claude-sonnet-4-6' as const,
  },
};

const ORCHESTRATOR_SYSTEM = readFileSync('agent-prompts/orchestrator.md', 'utf8');

async function runOrchestrator(address: string, briefPath: string) {
  const brief = JSON.parse(readFileSync(briefPath, 'utf8'));
  
  const initialPrompt = `
New BIM project:
Address: ${address}
Brief: ${JSON.stringify(brief, null, 2)}

workspace/ directory is ready and empty.
Execute the project sequence:
1. Spawn site-prep agent
2. Spawn architect agent (cycle 0)
3. Spawn structural, mep, facade, fire agents IN PARALLEL
4. Count BCF ERROR issues, decide: done / iterate / escalate
5. Write project_report_final.md
`;

  for await (const message of query({
    prompt: initialPrompt,
    options: {
      model: 'claude-opus-4-6',
      systemPrompt: ORCHESTRATOR_SYSTEM,
      allowedTools: ['Bash', 'Read', 'Write', 'Task'],
      agents: AGENT_DEFINITIONS,
      maxTokens: 8192,
    }
  })) {
    if (message.type === 'assistant') {
      process.stdout.write(message.content + '\n');
    }
    if (message.type === 'result') {
      console.log('\n[ORCHESTRATOR COMPLETE]');
      console.log('Final output:', message.content.slice(0, 500));
    }
  }
}

// Entry point
const [,, address, briefPath] = process.argv;
runOrchestrator(address ?? 'Musterstrasse 12, 8006 Zürich', briefPath ?? 'brief.json')
  .catch(console.error);
```

---

## 9. Implementation Phases

### Phase 0 — Manual Proof of Concept (1–2 weeks)
**Goal**: Prove the full chain works end-to-end before writing any SDK harness code.

Run everything manually in sequence. No automation yet.

```bash
# SETUP
cd bim-agent-team
pnpm install
cd services/ifc-site && pip install -r requirements.txt
cd services/swiss-zoning-api && pnpm install

# Start services
cd services/ifc-site && uvicorn src.rest_api:app --port 8000 &
cd services/swiss-zoning-api && pnpm dev &

# ---- TEST PARCEL: choose a Zürich W3 residential address ----
ADDRESS="Letzigraben 89, 8047 Zürich"

# STEP 1: Site context
curl -X POST http://localhost:8000/jobs \
  -H "Content-Type: application/json" \
  -d "{\"egrid\":\"$(curl -s 'http://localhost:3000/api/geocode?q=Letzigraben+89+8047+Zuerich' | jq -r '.results[0].egrid')\",\"radius\":250,\"include_buildings\":true}" \
  | tee /tmp/job.json

JOB=$(cat /tmp/job.json | jq -r .job_id)
until curl -s "http://localhost:8000/jobs/$JOB" | jq -e '.status == "completed"' > /dev/null; do
  sleep 10; echo "waiting..."
done
curl -o workspace/site_context.ifc "http://localhost:8000/jobs/$JOB/download"

# STEP 2: Zoning data
curl "http://localhost:3000/api/zoning?address=Letzigraben+89+8047+Z%C3%BCrich" \
  | python -m json.tool > workspace/zoning_brief.json

# STEP 3: Extract project origin
ifc-lite eval workspace/site_context.ifc \
  "bim.query().byType('IfcMapConversion').first()" --json

# STEP 4: Check what's in the site model
ifc-lite info workspace/site_context.ifc --json

# STEP 5: Run Architect agent (Claude Code session)
# Open Claude Code in bim-agent-team/, point it at CLAUDE.md
# Prompt:
# "Read workspace/zoning_brief.json. Using ifc-lite create and merge commands,
#  generate a 3-storey 4-unit residential building that fits the zone constraints.
#  Use the project origin from the zoning data. Save to workspace/design_v1.ifc."

# STEP 6: Validate
ifc-lite validate workspace/design_v1.ifc --json
ifc-lite ids workspace/design_v1.ifc specs/swiss_residential_min.ids --json

# STEP 7: Structural review (Claude Code session)
# "Read workspace/design_v1.ifc using ifc-lite.
#  Check load path and slab spans per SIA 260.
#  Write any issues to workspace/structural_v1.bcf."

# STEP 8: View federated model
ifc-lite view workspace/site_context.ifc workspace/design_v1.ifc
```

**Phase 0 success criteria** (all must pass):
1. `zoning_brief.json` has `zone.code` and `buildingParameters.maxFloors` for the address
2. `site_context.ifc` opens in ifc-lite viewer showing terrain + context buildings
3. `design_v1.ifc` is valid IFC4 with IfcProject → IfcSite → IfcBuilding → storeys → walls/slabs
4. `ifc-lite validate design_v1.ifc` exits 0
5. Both files load simultaneously in viewer with building correctly on the parcel (no offset)
6. `structural_v1.bcf` contains ≥ 1 topic, and the GlobalId in the topic exists in design_v1.ifc
7. `ifc-lite ids design_v1.ifc specs/swiss_residential_min.ids` runs (even if it fails — just must run)

---

### Phase 1 — Claude Agent SDK Harness (2–3 weeks)
**Goal**: Wire Phase 0 into the SDK. Sequential execution, no parallelism yet.

- Implement `orchestrator.ts` with all 6 agent definitions
- Write all 7 system prompt markdown files
- Test full end-to-end: `ts-node scripts/run-project.ts "Letzigraben 89, 8047 Zürich" brief.json`
- Implement convergence check: count BCF errors after specialist cycle
- Single iteration loop working (cycle 0 → specialists → cycle 1 if needed)

---

### Phase 2 — Parallel Specialists + Iteration Loop (2 weeks)
**Goal**: Full production flow.

- Specialists run in parallel via `Promise.all` of `Task` tool spawns
- BCF merge after parallel run: `ifc-lite merge structural.bcf mep.bcf facade.bcf fire.bcf --out issues_merged.bcf`
- Full 3-cycle iteration loop with convergence detection
- `ifc-lite diff design_v1.ifc design_v2.ifc --by-entity --json` in architect log
- `ifc-lite view workspace/site_context.ifc workspace/design_vN.ifc --port 3456` at each milestone
- Final project report generation

---

### Phase 3 — Extensions (ongoing)
- **swiss-zoning-api**: Add canton Bern support (geodienste.ch WFS)
- **DPP integration**: Facade agent calls ifclca.com API → injects `Pset_DPP_Environmental` with GWP estimate
- **bSDD**: `ifc-lite bsdd psets IfcWall` → verify property sets in IDS spec match bSDD canonical names
- **2D drawings**: `ifc-lite` 2D drawing package → auto-generate floor plan + section after convergence
- **Analyze overlay**: `ifc-lite analyze ... --viewer 3456 --missing "Pset_WallCommon.FireRating" --color red` for visual QA
- **More cantons**: Extend swiss-zoning-api with ZH (done), BE, BS, GE following the canton pattern in README

---

## 10. Tool Inventory

What exists vs. what needs to be built.

| Tool | Command | Status |
|---|---|---|
| Query IFC entities | `ifc-lite query ... --all --json` | ✅ EXISTS |
| Arbitrary SDK query | `ifc-lite eval ... --json` | ✅ EXISTS |
| Create IFC element | `ifc-lite create <type> --from-json` | ✅ EXISTS |
| Merge IFC files | `ifc-lite merge ... --schema IFC4` | ✅ EXISTS |
| Validate IFC structure | `ifc-lite validate ... --json` | ✅ EXISTS |
| IDS validation | `ifc-lite ids <file> <spec.ids> --json` | ✅ EXISTS |
| BCF write | `ifc-lite bcf create ...` | ✅ EXISTS |
| BCF list/read | `ifc-lite bcf list <file>` | ✅ EXISTS |
| Diff IFC files | `ifc-lite diff v1 v2 --by-entity --json` | ✅ EXISTS |
| Browser viewer | `ifc-lite view ... --port N` | ✅ EXISTS |
| Visual analysis overlay | `ifc-lite analyze ... --viewer N` | ✅ EXISTS |
| Run JS scripts | `ifc-lite run script.js model.ifc` | ✅ EXISTS |
| API discovery | `ifc-lite schema --compact` | ✅ EXISTS |
| bSDD lookup | `ifc-lite bsdd psets IfcType` | ✅ EXISTS |
| Site context IFC | `ifc-site` REST API | ✅ EXISTS |
| Zoning data | `swiss-zoning-api` `/api/zoning` | ✅ EXISTS (ZH) |
| Agent SDK harness | `bim-agent-team/orchestrator.ts` | 🔨 BUILD |
| Agent system prompts | `agent-prompts/*.md` | 🔨 WRITE |
| IDS spec file | `specs/swiss_residential_min.ids` | 🔨 WRITE (via idsedit.com) |
| Project brief schema | `brief.json` + TypeScript types | 🔨 WRITE (small) |
| Service startup script | `scripts/start-services.sh` | 🔨 WRITE (small) |

**Nothing significant needs to be built from scratch except the agent harness and prompts.** The entire tool surface is covered by existing code.

---

## 11. Key Architectural Decisions & Rationale

**Why Claude Agent SDK over LangGraph / CrewAI?**
- Native `bash` tool built-in — every `ifc-lite` command runs directly, no integration layer
- Subagents get isolated context windows — specialists don't see each other's reasoning, only the shared filesystem
- Model-locked to Claude, which is a feature: tool-use accuracy and instruction following are optimized for this exact agentic loop
- TypeScript-native, matches the ifc-lite stack
- Anthropic's own multi-agent research system (Opus lead + Sonnet subagents) outperformed single-agent Opus by 90.2% — same pattern we're using

**Why federated IFC (two files) over merged?**
- site_context.ifc is immutable — agents can't accidentally corrupt it
- Versioned design files — `diff` between cycles is meaningful
- Specialists analyze `design_vN.ifc` while also querying `site_context.ifc` for neighbor geometry, road access, shadow calculation
- ifc-lite viewer already supports federated loading natively

**Why Zürich-first?**
- swiss-zoning-api is fully functional for Zürich: ZH WFS + BZO + ÖREB WFS. `data_confidence: "high"`.
- Other cantons return federal fallback only — less accurate, no BZO detail
- Zürich has the highest construction activity in Switzerland — commercially relevant MVP

**Why `ifc-lite create` + `merge` for authoring (not IfcOpenShell)?**
- The CLI is designed for LLM usage — `--from-json` flag lets agents pipe structured JSON
- 30+ element types cover everything a residential building needs
- No Python env management, no IfcOpenShell API surface to learn
- When the Architect generates complex geometry scripts, `ifc-lite run script.js` handles it with full bim SDK access
- IfcOpenShell remains a fallback if geometry complexity exceeds what create/run can do

**Why `eval` for specialist reads?**
- More flexible than any dedicated command — agents write exact queries for their domain checks
- Avoids needing dedicated "check load path" or "check escape routes" CLI flags
- LLM-generated JS is more readable and debuggable than CLI flag chains
- `schema --compact` gives agents the full API to work with at session start

---

## 12. Risk Register

| Risk | Severity | Mitigation |
|---|---|---|
| **Coordinate alignment** | 🔴 HIGH | Extract origin from site_context.ifc with `ifc-lite eval`. Inject exact values into architect prompt. **Test in Phase 0 before writing any SDK code.** |
| **ifc-lite create geometry limits** | 🟡 MEDIUM | `create` covers standard elements. For complex geometry, agent uses `ifc-lite run` with full bim SDK. IfcOpenShell is fallback. |
| **swiss-zoning-api Zürich-only** | 🟢 LOW | MVP scoped to Zürich. Other cantons roadmapped. `data_confidence` field triggers human review if low. |
| **LLM hallucinating IFC coordinates** | 🔴 HIGH | Architect agent uses `--from-json` with structured JSON (Start/End/Height/Width), not raw coordinate arrays. The CLI geometry engine computes actual vertices. |
| **BCF GlobalId validity** | 🟡 MEDIUM | **Phase 0 test item**: verify that `ifc-lite bcf create` topics with GlobalIds round-trip correctly when viewed in ifc-lite. Test before Phase 1. |
| **ifc-site generation time (2-4 min)** | 🟢 LOW | Always use async REST `/jobs` endpoint. Agent polls with 10s intervals. Acceptable for design workflow. |
| **Parallel specialist write conflicts** | 🟡 MEDIUM | Each specialist writes to its own BCF file (`structural_vN.bcf`, `mep_vN.bcf`, etc). Orchestrator merges after all complete. No concurrent writes to same file. |
| **Token cost** | 🟡 MEDIUM | Estimate: ~3-5M tokens per project (Opus orchestrator + 6 Sonnet subagents × 3 cycles). ~$15-25 at current pricing. Fine for demo; optimize later with smarter context trimming. |
| **Agent loops (infinite cycles)** | 🟡 MEDIUM | Hard `MAX_CYCLES = 3` in orchestrator. After 3 cycles, write escalation report and exit regardless of remaining errors. |

---

## 13. IDS Spec File Minimum

Create `specs/swiss_residential_min.ids` using idsedit.com. Minimum viable rules:

```
1. IfcSpace must have Qto_SpaceBaseQuantities.NetFloorArea (SIA 416)
2. IfcWall[IsExternal=TRUE] must have a material assignment
3. IfcWall must have Pset_WallCommon.LoadBearing (boolean)
4. IfcBuilding must have Qto_BuildingBaseQuantities.GrossFloorArea
5. IfcProject must reference EPSG:2056 in IfcCoordinateOperation (georef)
6. IfcBuildingStorey must have Name assigned
```

Grow this spec iteratively. Each specialist agent's "INFO" findings become new IDS rules in the next sprint.

---

## 14. Test Parcel Recommendations (Zürich)

Use these for Phase 0 testing. All confirmed W-zone residential in city of Zürich.

| Address | Expected Zone | Notes |
|---|---|---|
| Letzigraben 89, 8047 Zürich | W3 or W4 | Industrial/residential transition area |
| Quellenstrasse 25, 8005 Zürich | W4 or MK | Dense residential near Zürich West |
| Hegibachstrasse 45, 8032 Zürich | W2 or W3 | Typical single-family/terraced area |

Run `swiss-zoning-api` against each to confirm zone codes before using in Phase 0. Avoid K (Kernzone) and MK in early tests — mixed-use zones have more complex constraints.

---

## 15. What a Developer Needs on Day 1

```bash
# Clone all repos
git clone https://github.com/louistrue/bim-agent-team   # create this
git clone https://github.com/louistrue/ifc-lite          # reference for CLI docs
git clone https://github.com/louistrue/ifc-site
git clone https://github.com/louistrue/swiss-zoning-api

# Install ifc-lite CLI globally — this is the single most important install
npm install -g @ifc-lite/cli
ifc-lite --help                    # verify
ifc-lite schema --compact          # understand the API

# Set up services
cd ifc-site && python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn src.rest_api:app --port 8000 &

cd ../swiss-zoning-api && pnpm install && pnpm dev &

# Test the services work
curl "http://localhost:3000/api/zoning?address=Letzigraben+89+8047+Zuerich" | jq .zone
curl http://localhost:8000/health

# Test ifc-lite create (smoke test)
ifc-lite create wall --start 0,0,0 --end 5,0,0 --height 3 --thickness 0.2 --out /tmp/test.ifc
ifc-lite info /tmp/test.ifc
ifc-lite validate /tmp/test.ifc --json

# Now run Phase 0 manually (Section 9 above)
```

**Environment requirements**:
- Node.js 20+ with pnpm
- Python 3.11+ with venv
- Chrome 113+ for ifc-lite viewer (WebGPU)
- Anthropic API key (`ANTHROPIC_API_KEY` env var) for SDK
- ~500MB disk for a full project run (site IFC + GLB + textures + design iterations)

**Read these first**:
1. ifc-lite CLI docs: https://louistrue.github.io/ifc-lite/guide/cli/  — especially `eval`, `create`, and "Using with LLM Terminals"
2. Claude Agent SDK docs: https://docs.claude.com (search "agent sdk")
3. swiss-zoning-api README — understand data sources and confidence levels
4. ifc-site README — understand output format, FastAPI endpoints
