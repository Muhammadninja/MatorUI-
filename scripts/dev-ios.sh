#!/usr/bin/env bash
# Build the iOS app locally and launch it on a simulator/device.
# Requires Xcode + CocoaPods. Pass --device "iPhone 15 Pro" to pick a sim.
# Usage: ./scripts/dev-ios.sh [--device "<name>"] [--configuration Debug|Release]
set -euo pipefail
cd "$(dirname "$0")/.."
npx expo run:ios "$@"
