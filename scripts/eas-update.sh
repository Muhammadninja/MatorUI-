#!/usr/bin/env bash
# Push an OTA update via EAS Update. Channel maps to eas.json build channels.
# Usage:
#   ./scripts/eas-update.sh production "fix: cart math"
#   ./scripts/eas-update.sh preview     "release candidate"
#   ./scripts/eas-update.sh development "smoke test"
set -euo pipefail
cd "$(dirname "$0")/.."

channel="${1:-development}"
message="${2:-update from local}"
npx eas update --channel "$channel" --message "$message"
