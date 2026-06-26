#!/usr/bin/env bash
# Trigger an EAS build for iOS. Profile maps to eas.json.
# Usage:
#   ./scripts/eas-build-ios.sh                          # development
#   ./scripts/eas-build-ios.sh development-simulator
#   ./scripts/eas-build-ios.sh preview
#   ./scripts/eas-build-ios.sh production
#   ./scripts/eas-build-ios.sh production --local       # build on this machine
#   ./scripts/eas-build-ios.sh production --no-wait     # don't block
set -euo pipefail
cd "$(dirname "$0")/.."

profile="${1:-development}"
shift || true
npx eas build --platform ios --profile "$profile" "$@"
