#!/usr/bin/env bash
# Build iOS + Android for the same profile in one go.
# Usage: ./scripts/eas-build-all.sh [profile]   (default: development)
set -euo pipefail
cd "$(dirname "$0")/.."

profile="${1:-development}"
shift || true
npx eas build --platform all --profile "$profile" "$@"
