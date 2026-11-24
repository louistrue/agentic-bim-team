#!/usr/bin/env bash
# Build the static site and publish it to the gh-pages branch (GitHub Pages, no server).
# Usage: bash web/deploy-pages.sh   → https://louistrue.github.io/agentic-bim-team/
set -euo pipefail
cd "$(dirname "$0")"
node test/pipeline.test.mjs >/dev/null || { echo "pipeline tests fail – not deploying"; exit 1; }
BASE=/agentic-bim-team/ npx vite build
OUT=$(mktemp -d)
cp -r dist/. "$OUT/"
touch "$OUT/.nojekyll"
REMOTE=$(git remote get-url origin)
cd "$OUT"
git init -q -b gh-pages
git add -A
git -c user.name="agentic-bim-team" -c user.email="noreply@users.noreply.github.com" commit -q -m "Deploy live site $(date -u +%Y-%m-%dT%H:%MZ)"
git push -q -f "$REMOTE" gh-pages
echo "pushed gh-pages from $OUT"
