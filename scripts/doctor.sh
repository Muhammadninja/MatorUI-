#!/usr/bin/env bash
# Run Expo's environment + project health check.
# Usage: ./scripts/doctor.sh
set -euo pipefail
cd "$(dirname "$0")/.."
npx expo-doctor "$@"
