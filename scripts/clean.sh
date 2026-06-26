#!/usr/bin/env bash
# Nuke caches when builds get weird. Pass flags to widen the blast radius.
# Usage:
#   ./scripts/clean.sh             # metro + watchman + tmp
#   ./scripts/clean.sh --pods      # also wipe ios/Pods + Podfile.lock
#   ./scripts/clean.sh --gradle    # also clean android build dirs
#   ./scripts/clean.sh --node      # also wipe node_modules
#   ./scripts/clean.sh --all       # all of the above
set -euo pipefail
cd "$(dirname "$0")/.."

do_pods=0; do_gradle=0; do_node=0
for arg in "$@"; do
  case "$arg" in
    --pods)   do_pods=1 ;;
    --gradle) do_gradle=1 ;;
    --node)   do_node=1 ;;
    --all)    do_pods=1; do_gradle=1; do_node=1 ;;
    *) echo "Unknown flag: $arg" >&2; exit 1 ;;
  esac
done

echo "→ Clearing Metro/Expo caches"
rm -rf "$TMPDIR"/metro-* "$TMPDIR"/haste-map-* 2>/dev/null || true
rm -rf .expo .expo-shared 2>/dev/null || true

if command -v watchman >/dev/null 2>&1; then
  echo "→ watchman watch-del-all"
  watchman watch-del-all >/dev/null 2>&1 || true
fi

if [[ $do_pods -eq 1 && -d ios ]]; then
  echo "→ Removing ios/Pods + Podfile.lock + build/"
  rm -rf ios/Pods ios/Podfile.lock ios/build
fi

if [[ $do_gradle -eq 1 && -d android ]]; then
  echo "→ Cleaning android build dirs"
  rm -rf android/build android/app/build android/.gradle
fi

if [[ $do_node -eq 1 ]]; then
  echo "→ Removing node_modules + lock-aware reinstall"
  rm -rf node_modules
  npm install
fi

echo "✓ Clean complete"
