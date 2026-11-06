#!/usr/bin/env bash
# Run the Maestro E2E suite against the offline mock server.
#
# Boots the standalone mock (.maestro/mock-server/standalone-server.mjs), waits
# for it to answer, runs `maestro test`, then tears the mock down — pass or fail.
#
# Prerequisite: an emulator with the dedicated test app installed (see README).
# The app's endpoint is fixed at build time; this script cannot change it.
# Favorites: bash scripts/e2e.sh .maestro/flows/flow-12-favorites-isolation.yaml
# Legacy iOS flows can still be passed explicitly or run with no arguments.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${MOCK_PORT:-8080}"
TARGET_DEFAULT=".maestro/"
# If no path/flag given, run the whole suite; otherwise pass everything through.
if [[ $# -eq 0 ]]; then set -- "$TARGET_DEFAULT"; fi

if ! command -v maestro >/dev/null 2>&1; then
  echo "✗ maestro CLI not found. Install it:" >&2
  echo "    curl -Ls \"https://get.maestro.mobile.dev\" | bash" >&2
  exit 127
fi

MOCK_PID=""
cleanup() {
  if [[ -n "$MOCK_PID" ]] && kill -0 "$MOCK_PID" 2>/dev/null; then
    kill "$MOCK_PID" 2>/dev/null || true
    wait "$MOCK_PID" 2>/dev/null || true
    echo "• mock server stopped"
  fi
}
trap cleanup EXIT INT TERM

echo "• starting mock server on :$PORT"
PORT="$PORT" node .maestro/mock-server/standalone-server.mjs >/tmp/mator-e2e-mock.log 2>&1 &
MOCK_PID=$!

# Wait (up to ~10s) for the mock to answer before driving the UI.
for i in $(seq 1 50); do
  if ! kill -0 "$MOCK_PID" 2>/dev/null; then
    echo "✗ mock server exited early — see /tmp/mator-e2e-mock.log" >&2
    cat /tmp/mator-e2e-mock.log >&2 || true
    exit 1
  fi
  if curl -sf -o /dev/null "http://localhost:$PORT/"; then
    echo "• mock server ready → http://localhost:$PORT"
    break
  fi
  if [[ "$i" -eq 50 ]]; then
    echo "✗ mock server did not become ready on :$PORT" >&2
    exit 1
  fi
  sleep 0.2
done

# Reset server-side test state as well as the flow's app storage on every run.
curl --fail --silent --request POST "http://127.0.0.1:$PORT/__e2e/reset" >/dev/null

echo "• running: maestro test $*"
maestro test "$@"
