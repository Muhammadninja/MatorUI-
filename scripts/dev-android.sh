#!/usr/bin/env bash
# Build the Android app locally and launch it on an emulator/device.
# Requires Android SDK + JDK 17. Pass --device "<id>" or --variant release.
# Usage: ./scripts/dev-android.sh [--device <id>] [--variant debug|release]
set -euo pipefail
cd "$(dirname "$0")/.."
npx expo run:android "$@"
