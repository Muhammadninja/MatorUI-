#!/usr/bin/env bash
# Trigger an EAS build for Android. Profile maps to eas.json.
# Usage:
#   ./scripts/eas-build-android.sh                  # development (apk)
#   ./scripts/eas-build-android.sh preview          # preview (apk)
#   ./scripts/eas-build-android.sh production       # production (aab)
#   ./scripts/eas-build-android.sh production --local
set -euo pipefail
cd "$(dirname "$0")/.."

profile="${1:-development}"
shift || true
npx eas build --platform android --profile "$profile" "$@"
