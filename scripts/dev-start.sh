#!/usr/bin/env bash
# Start the Metro dev server (Expo).
# Usage: ./scripts/dev-start.sh [--clear] [--tunnel] [--lan] [--localhost]
set -euo pipefail
cd "$(dirname "$0")/.."
npx expo start "$@"
