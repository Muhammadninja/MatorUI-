#!/usr/bin/env bash
# Submit the latest iOS production build to App Store Connect / TestFlight.
# Usage:
#   ./scripts/eas-submit-ios.sh                      # latest production build
#   ./scripts/eas-submit-ios.sh --id <buildId>       # specific build
#   ./scripts/eas-submit-ios.sh --path <path-to-ipa> # local artifact
set -euo pipefail
cd "$(dirname "$0")/.."
npx eas submit --platform ios --profile production "$@"
