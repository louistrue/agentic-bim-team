#!/usr/bin/env bash
# Run `ifc-lite ids` with a DOMParser polyfill so the IDS XML parser works
# under Node.js. ifc-lite 0.6.2 calls `new DOMParser()` and `doc.querySelector`
# unconditionally, which are browser-only — linkedom provides a compatible
# implementation. See scripts/ids-bootstrap.mjs.
#
# Usage: scripts/run-ids.sh <file.ifc> <rules.ids> [--json]

set -euo pipefail

if [ "$#" -lt 2 ]; then
  echo "Usage: $0 <file.ifc> <rules.ids> [--json]" >&2
  exit 2
fi

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export NODE_OPTIONS="--import ${REPO_ROOT}/scripts/ids-bootstrap.mjs ${NODE_OPTIONS:-}"
exec ifc-lite ids "$@"
