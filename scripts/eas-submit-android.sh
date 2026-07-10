#!/usr/bin/env bash
# Submit the latest Android production build to Google Play.
# Usage:
#   ./scripts/eas-submit-android.sh                  # latest production build
#   ./scripts/eas-submit-android.sh --id <buildId>
#   ./scripts/eas-submit-android.sh --path <path-to-aab>
set -euo pipefail
cd "$(dirname "$0")/.."
npx eas submit --platform android --profile production "$@"
