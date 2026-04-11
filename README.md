# Agentic BIM Team

A team of AI agents that designs residential buildings for Swiss construction projects. Give it an address in Switzerland, and it will fetch the zoning rules, generate a 3D site model, design a building that fits all constraints, and then have specialist agents review it — structural, MEP, facade, fire safety. If they find problems, the architect agent fixes them automatically.

The whole thing runs as a loop: design, review, fix, repeat — until the building passes all checks or hits the max number of cycles.

## What it does

1. **Site preparation** — Fetches zoning data (allowed height, floors, FAR, setbacks) and generates a georeferenced 3D site context with terrain and existing buildings
2. **Architecture** — Designs a residential building as IFC, respecting all zone constraints
3. **Visual QA** — Checks the 3D geometry for obvious issues (floating elements, wrong storey heights)
4. **Specialist review** — Four agents review in parallel:
   - Structural (SIA 260-265)
   - MEP / ventilation (SIA 382.1)
   - Facade & energy (SIA 380/1, Minergie)
   - Fire safety (VKF)
5. **Convergence** — If there are errors, the architect gets the feedback and revises. Repeat until clean or max 3 cycles.

At the end you get an IFC model, BCF issue files, and a summary report. The 3D viewer opens in your browser so you can inspect everything.

## How it works

The orchestrator spawns agents using the [Claude Agent SDK](https://github.com/anthropics/claude-code). Each agent has a system prompt (in `agent-prompts/`) that tells it what to do, which Swiss norms to follow, and how to use the tools. All BIM operations go through [ifc-lite](https://ifclite.com) — creating IFC geometry, querying models, writing BCF reports.

The agents don't share memory between each other. They communicate through files: the architect writes an IFC, the specialists read it and write BCF files with their findings, and the orchestrator feeds those findings back to the architect for the next cycle.

## Prerequisites

- [ifc-lite CLI](https://ifclite.com) — `npm install -g @ifc-lite/cli`
- [ifc-site](https://github.com/louistrue/ifc-site) — generates 3D site context from Swiss geodata (clone as sibling repo)
- [swiss-zoning-api](https://github.com/louistrue/swiss-zoning-api) — fetches zoning constraints for any Swiss address (clone as sibling repo)

## Setup

```bash
# Clone everything
git clone https://github.com/louistrue/agentic-bim-team
git clone https://github.com/louistrue/ifc-site
git clone https://github.com/louistrue/swiss-zoning-api

cd agentic-bim-team
npm install
```

## Running

Start the two background services first:

```bash
npm run start:services
```

Then run the pipeline:

```bash
npm start "Loorenstrasse 62, 8053 Zürich"
```

You can use any Swiss address. The viewer opens automatically at http://localhost:3456 — first showing the site context, then updating when the design is ready.

The console shows everything that happens: agent thinking, tool calls, results. Full verbose output so you can follow along.

## Project structure

```
orchestrator.ts          — Main pipeline, spawns agents, checks convergence
agent-prompts/           — System prompts for each agent
  site-prep.md
  architect.md
  visual-qa.md
  structural.md
  mep.md
  facade.md
  fire.md
brief.json               — Project brief (units, storeys, energy standard)
scripts/
  run-project.ts         — CLI entry point
  start-services.sh      — Starts ifc-site + swiss-zoning-api
  pre-analyze.sh         — Extracts model data for specialists
workspace/               — Output directory (created at runtime)
```

## Output

After a run, `workspace/` contains:
- `design_vN.ifc` — The building model
- `site_context.ifc` — Georeferenced site with terrain
- `structural_vN.bcf`, `mep_vN.bcf`, etc. — Issue reports per discipline
- `project_state.json` — All constraints and convergence history
- `project_report_final.md` — Summary

## Swiss norms

The agents follow Swiss construction standards:
- SIA 260-265 for structural design
- SIA 380/1 and MuKEn 2014 for energy (wall U-value ≤ 0.20, window ≤ 1.0 W/m²K)
- SIA 382.1 for ventilation
- VKF for fire safety (escape routes, staircase widths)
- SIA 416 for area calculations
- Coordinates in EPSG:2056 (Swiss LV95)

## License

MIT
