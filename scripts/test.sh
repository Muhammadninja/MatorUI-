#!/usr/bin/env bash
# Run vitest suite once. Pass --watch for watch mode, or any vitest flag.
# Usage:
#   ./scripts/test.sh
#   ./scripts/test.sh --watch
#   ./scripts/test.sh path/to/file.test.ts
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ "${1:-}" == "--watch" ]]; then
  shift
  npx vitest "$@"
else
  npx vitest run "$@"
fi
