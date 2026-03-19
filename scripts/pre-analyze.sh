#!/bin/bash
set -e

DESIGN=$1
OUT=workspace/analysis
mkdir -p "$OUT"

if [ -z "$DESIGN" ]; then
  echo "Usage: pre-analyze.sh <design.ifc>"
  exit 1
fi

echo "Pre-analyzing $DESIGN..."
ifc-lite query "$DESIGN" --type IfcWall --all --props --quantities --json > "$OUT/walls.json" 2>/dev/null || \
  ifc-lite query "$DESIGN" --type IfcWall --all --props --json > "$OUT/walls.json"
ifc-lite query "$DESIGN" --type IfcSlab --all --props --quantities --json > "$OUT/slabs.json" 2>/dev/null || \
  ifc-lite query "$DESIGN" --type IfcSlab --all --props --json > "$OUT/slabs.json"
ifc-lite query "$DESIGN" --type IfcWindow --all --props --quantities --json > "$OUT/windows.json" 2>/dev/null || \
  ifc-lite query "$DESIGN" --type IfcWindow --all --props --json > "$OUT/windows.json"
ifc-lite query "$DESIGN" --type IfcDoor --all --props --json > "$OUT/doors.json"
ifc-lite query "$DESIGN" --type IfcSpace --all --props --json > "$OUT/spaces.json"
ifc-lite query "$DESIGN" --type IfcStair,IfcStairFlight --all --props --json > "$OUT/stairs.json"
ifc-lite query "$DESIGN" --type IfcColumn --all --props --json > "$OUT/columns.json"
ifc-lite query "$DESIGN" --type IfcFooting --all --json 2>/dev/null > "$OUT/footings.json" || echo "[]" > "$OUT/footings.json"
ifc-lite query "$DESIGN" --spatial --json > "$OUT/spatial.json"
ifc-lite info "$DESIGN" --json > "$OUT/model_info.json"
echo "Pre-analysis complete: $(ls "$OUT"/*.json | wc -l) files in $OUT/"
