#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "=== BIM Agent Team — Starting Services ==="
echo ""

# Determine service paths (check both submodule and sibling-repo layouts)
if [ -d "$PROJECT_ROOT/services/ifc-site" ]; then
  IFC_SITE_DIR="$PROJECT_ROOT/services/ifc-site"
elif [ -d "$PROJECT_ROOT/../ifc-site" ]; then
  IFC_SITE_DIR="$PROJECT_ROOT/../ifc-site"
else
  echo "ERROR: ifc-site not found. Clone it as a sibling or into services/"
  echo "  git clone https://github.com/louistrue/ifc-site ../ifc-site"
  exit 1
fi

if [ -d "$PROJECT_ROOT/services/swiss-zoning-api" ]; then
  ZONING_DIR="$PROJECT_ROOT/services/swiss-zoning-api"
elif [ -d "$PROJECT_ROOT/../swiss-zoning-api" ]; then
  ZONING_DIR="$PROJECT_ROOT/../swiss-zoning-api"
else
  echo "ERROR: swiss-zoning-api not found. Clone it as a sibling or into services/"
  echo "  git clone https://github.com/louistrue/swiss-zoning-api ../swiss-zoning-api"
  exit 1
fi

echo "ifc-site:        $IFC_SITE_DIR"
echo "swiss-zoning-api: $ZONING_DIR"
echo ""

# Start ifc-site (Python/FastAPI on port 8000)
echo "Starting ifc-site on port 8000..."
cd "$IFC_SITE_DIR"
if [ ! -d "venv" ]; then
  echo "  Creating Python venv..."
  python3 -m venv venv
  source venv/bin/activate
  pip install -r requirements.txt
else
  source venv/bin/activate
fi
uvicorn src.rest_api:app --port 8000 &
IFC_SITE_PID=$!
echo "  ifc-site PID: $IFC_SITE_PID"

# Start swiss-zoning-api (Next.js on port 3000)
echo "Starting swiss-zoning-api on port 3000..."
cd "$ZONING_DIR"
if [ ! -d "node_modules" ]; then
  echo "  Installing dependencies..."
  pnpm install
fi
pnpm dev &
ZONING_PID=$!
echo "  swiss-zoning-api PID: $ZONING_PID"

echo ""
echo "=== Services started ==="
echo "  ifc-site:         http://localhost:8000 (PID $IFC_SITE_PID)"
echo "  swiss-zoning-api: http://localhost:3000 (PID $ZONING_PID)"
echo ""
echo "Press Ctrl+C to stop all services."
echo ""

# Trap SIGINT to kill both services
cleanup() {
  echo ""
  echo "Stopping services..."
  kill $IFC_SITE_PID 2>/dev/null
  kill $ZONING_PID 2>/dev/null
  wait
  echo "Done."
}
trap cleanup SIGINT SIGTERM

# Wait for either process to exit
wait
