# Agentic BIM Team v2 — the loop closes in code, the agents judge

v1 (March 2026) let seven LLM agents write IFC, run checks and count their own errors. The archived run
(`workspace-archive/2026-03-19T11-11-16-839Z`) shows what that produces: no element kept its GlobalId between
rounds, ~95 % of GlobalIds were invalid, the IDS gate never ran (empty reports), no BCF topic was linked to an
element, quantities were written as property sets, and four prompts asserted "Geometry has been visually verified".
It also used a 3.17 m boundary distance where the Bauordnung says 5 m, and placed the building with no
georeference on top of the existing house.

v2 keeps the agents for what they are good at — designing, looking, judging — and moves everything that must be
true into deterministic code built on [ifc-lite](https://ifclite.com) (latest packages, Nov 2026).

| Step | Who | What |
|---|---|---|
| Site | `scripts/site.mjs` | geocode, parcel (EGRID), official ÖREB extract, swissALTI3D terrain + swissBUILDINGS3D neighbours via `ifc-lite site-context` |
| Requirements | `brief.json` → `scripts/requirements-to-ids.mjs` | the client's AIA lines R01–R09 become `requirements.ids`; `ifc-lite ids audit` must pass |
| Design | **architect agent** (Opus 5.5) | writes design *intent* `design_vN.json` with stable element keys; may self-check |
| IFC | `scripts/compile.mjs` (@ifc-lite/create) | GlobalId = f(key) → identity survives revisions; storeys stack by construction; Qto_* computed as IfcElementQuantity; EPSG:2056 via `ifc-lite georef set` |
| Checks | `scripts/check.mjs` | IDS (ifc-lite), georef check, BZO W3 (storeys, height, 5 m + length surcharge, floor level), rooms, daylight, stairs, escape, envelope |
| Look | **visual-QA agent** | reads real renders (`scripts/render.mjs`, `siteplan.py`) |
| Judge | **4 specialist agents** (Sonnet 5.5) | structure, MEP, energy/facade, fire; findings must name existing element keys or are rejected |
| Track | `scripts/issues.mjs` | one ledger + one BCF project across versions: topic GUID = f(finding id); new → Open, gone → Closed with comment; every topic has a viewpoint on real GlobalIds |
| Report | `scripts/report.mjs` | written from files only; lists what was checked, what was not, rejected agent claims, and a sign-off table for humans |

Run: `npx tsx orchestrator-v2.ts "Loorenstrasse 62, 8053 Zürich" brief.json` (needs Claude Code ≥ 2.1.280 at
`~/.local/bin/claude` or `CLAUDE_BIN`). Zoning values are copied from BZO 2016 Art. 13/14 with source; ÖREB
overlays (Quartierplan, Baulinie, Sicherheitszone) and everything in `brief.program.notChecked` stay human checks.
