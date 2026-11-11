# Mator Maestro tests

These tests use a disposable loopback mock, separately from production verification.
The Android workflow builds a bundled, debug-signed APK named **Mator E2E** with
application ID `com.mator.e2e`, scheme `mator-e2e`, OTA updates disabled, and
`http://127.0.0.1:8080` compiled into its config. No Metro or production credentials
are needed. `adb reverse` connects the emulator to the host mock.

The normal production release guard is unchanged. The test configuration requires
both `MATOR_E2E=1` and `EAS_BUILD_PROFILE=e2e`; either marker alone fails. It rejects
remote APIs, filtered HTTP domains and development OTP autofill. Never submit this
dedicated APK to a store. Production/internal profiles cannot select this mode.
Dotenv loading is disabled in CI, so developer environment files cannot override it.

## Favorites isolation

The Android job runs `flows/flow-12-favorites-isolation.yaml`:

1. Clear only the dedicated app's storage and start a fresh mock process.
2. Sign in as synthetic A and save X (Brembo pads).
3. Sign out; verify the guest list is empty and the next phone field is empty.
4. Sign in as synthetic B; verify X is absent and save Y (Bosch rotor).
5. Sign out and return to A; verify X is present and Y is absent.
6. Stop and relaunch the process, preserving storage; verify A's list again.

The mock accepts only synthetic accounts `+998900000001` and `+998900000002` and
OTP `123456`, tied to a valid, unexpired, single-use challenge. These fixtures work
only in the mock process, bound to `127.0.0.1`. `/v1/me` and refresh preserve each
account's deterministic ID. No SMS is sent. There is no production OTP bypass.

Favorites sync remains gated off because the production backend contract is
unverified. This scenario tests real UI, auth transport, per-account local storage,
guest isolation and cold restart; it does not establish backend favorites ownership
or production readiness.

With the dedicated APK installed and an Android emulator running:

```bash
adb reverse tcp:8080 tcp:8080
bash scripts/e2e.sh .maestro/flows/flow-12-favorites-isolation.yaml --format junit --output maestro-report.xml --test-output-dir artifacts
```

The runner starts and stops its own mock, checks readiness, and resets test state.
The flow clears app data at the beginning but deliberately preserves it for the
cold restart. Each subsequent run starts clean.

CI dispatch (on a branch containing this workflow):

```bash
gh workflow run e2e-android.yml --ref codex/favorites-e2e
gh run list --workflow e2e-android.yml --branch codex/favorites-e2e
gh run watch <run-id> --exit-status
```

For release-candidate provenance, force a new APK from the exact RC commit:

```bash
gh workflow run e2e-android.yml --ref design/teal-explore-home -f rebuild_apk=true
```

This skips APK cache restore/save, requires the APK source SHA to equal the test
SHA, and uploads `build-provenance.txt` with both SHAs and the APK SHA-256. Normal
runs retain the content-keyed APK cache. This builds only the disposable E2E app;
it does not submit a release or publish an OTA update.

The earlier flows 01–11 are retained for the existing iOS/dev-client setup
(`com.fotih12.mator`, `mator://`). They are not part of this dedicated Android run.
Their historical assertions need separate maintenance before claiming that older
suite is current. The shared sign-in helper now types the mock account and OTP.

CI uploads the scrubbed JUnit result, mock route log, and final product-list screenshot,
excluding Maestro's raw debug
screenshots/hierarchies that can contain account fields. All accounts used here are
synthetic. Do not reuse production accounts or tokens in these flows.

The workflow caches only the dedicated APK, keyed by all app/native inputs and the
build recipe. Maestro flows and the mock run outside that binary. CI records the
actual frontend source SHA from the cache alongside the current mock/flow SHA.
The cache is saved before UI tests, allowing flow fixes to reuse the same app.
The final screenshot contains only the synthetic product list after A's restart.
