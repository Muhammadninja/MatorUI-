#!/usr/bin/env bash
# Run the Maestro E2E suite against the offline mock server.
#
# Boots the standalone mock (.maestro/mock-server/standalone-server.mjs), waits
# for it to answer, runs `maestro test`, then tears the mock down — pass or fail.
#
# Prerequisite: an emulator with the dedicated test app installed (see README).
# The app's endpoint is fixed at build time; this script cannot change it.
# Favorites: bash scripts/e2e.sh .maestro/flows/flow-12-favorites-isolation.yaml
# Cart/checkout: bash scripts/e2e.sh .maestro/flows/flow-13-cart-checkout.yaml
# Legacy iOS flows can still be passed explicitly or run with no arguments.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${MOCK_PORT:-8080}"
MOCK_LOG="${MOCK_LOG:-/tmp/mator-e2e-mock.log}"
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
PORT="$PORT" node .maestro/mock-server/standalone-server.mjs >"$MOCK_LOG" 2>&1 &
MOCK_PID=$!

# Wait (up to ~10s) for the mock to answer before driving the UI.
for i in $(seq 1 50); do
  if ! kill -0 "$MOCK_PID" 2>/dev/null; then
    echo "✗ mock server exited early — see $MOCK_LOG" >&2
    cat "$MOCK_LOG" >&2 || true
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

# Start each flow with an empty device log so a failure excerpt is its own.
if command -v adb >/dev/null 2>&1; then adb logcat -c || true; fi
echo "• running: maestro test $*"
set +e
MAESTRO_CLI_NO_ANALYTICS=1 maestro test "$@"
MAESTRO_RESULT=$?
set -e
# Maestro now nests command captures inside each flow's artifact bundle. Keep
# the upload allowlist narrow: only each flow's final named capture, never raw auth UI.
FINAL_NAME=""
case "$*" in
  *flow-12-favorites-isolation.yaml*) FINAL_NAME=favorites-a-after-restart.png ;;
  *flow-13-cart-checkout.yaml*) FINAL_NAME=cart-checkout-confirmation.png ;;
esac
if [[ "$MAESTRO_RESULT" -eq 0 && -n "$FINAL_NAME" ]]; then
  FINAL_SHOT=$(find artifacts -type f -name "$FINAL_NAME" -print -quit)
  if [[ -z "$FINAL_SHOT" ]]; then
    echo "✗ final screenshot $FINAL_NAME missing" >&2
    MAESTRO_RESULT=1
  elif [[ "$FINAL_SHOT" != "artifacts/$FINAL_NAME" ]]; then
    cp "$FINAL_SHOT" "artifacts/$FINAL_NAME"
  fi
fi
if [[ "$MAESTRO_RESULT" -ne 0 ]] && command -v adb >/dev/null 2>&1; then
  MOCK_LOG="$MOCK_LOG" node scripts/e2e-ui-diagnostic.mjs
fi
exit "$MAESTRO_RESULT"
