#!/usr/bin/env bash
# Full TypeScript type-check, no emit.
# Usage: ./scripts/typecheck.sh
set -euo pipefail
cd "$(dirname "$0")/.."
npx tsc --noEmit "$@"
