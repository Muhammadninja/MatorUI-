#!/usr/bin/env bash
# Regenerate native ios/ and android/ folders from app.json + plugins.
# Use after changing app.json, icons, splash, plugins, or bumping Expo SDK.
# Usage:
#   ./scripts/prebuild.sh            # both platforms, --clean
#   ./scripts/prebuild.sh ios        # iOS only, --clean
#   ./scripts/prebuild.sh android    # Android only, --clean
#   ./scripts/prebuild.sh ios --no-clean
set -euo pipefail
cd "$(dirname "$0")/.."

platform="${1:-all}"
shift || true
clean_flag="--clean"
for arg in "$@"; do
  if [[ "$arg" == "--no-clean" ]]; then
    clean_flag=""
  fi
done

case "$platform" in
  ios|android)
    npx expo prebuild --platform "$platform" $clean_flag
    ;;
  all|"")
    npx expo prebuild $clean_flag
    ;;
  *)
    echo "Unknown platform: $platform (expected ios|android|all)" >&2
    exit 1
    ;;
esac
