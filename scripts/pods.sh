#!/usr/bin/env bash
# Install/refresh iOS CocoaPods. Run after prebuild, dep changes, or pod errors.
# Usage:
#   ./scripts/pods.sh          # install
#   ./scripts/pods.sh update   # pod update
#   ./scripts/pods.sh repo     # pod repo update
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ ! -d ios ]]; then
  echo "ios/ folder missing. Run ./scripts/prebuild.sh ios first." >&2
  exit 1
fi

cmd="${1:-install}"
pushd ios >/dev/null

if command -v bundle >/dev/null 2>&1 && [[ -f Gemfile ]]; then
  pod_runner="bundle exec pod"
else
  pod_runner="pod"
fi

case "$cmd" in
  install) $pod_runner install ;;
  update)  $pod_runner update ;;
  repo)    $pod_runner repo update ;;
  *) echo "Unknown command: $cmd (expected install|update|repo)" >&2; exit 1 ;;
esac

popd >/dev/null
