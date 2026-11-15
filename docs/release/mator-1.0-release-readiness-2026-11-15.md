# Mator 1.0 release candidate readiness

**Candidate:** `rc/mator-1.0-candidate-2026-11-15`  
**Base:** `4b9baceb9240b6d2de03da369349e5ac1417899a` (`release/rc-1.0-2026-11-15`)  
**Status:** testable release candidate; TestFlight readiness still has external and production-validation blockers.

## Candidate commits

- `69955fa8865d2922dad6d2246aed67537f50dc9f` — maps the live Nexia 2 catalog identity (`nexia` with `nexia-2-*` trims) to N150, retaining the legacy identity and keeping Nexia 3 trim matching separate. This changes the image-registry fingerprint. The matching backend registry and `VEHICLE_IMAGE_REGISTRY_SHA256` must be synchronized before enabling image-pipeline responses.
- `6385694de80824a2d40dec584d2fb4f923b6ddb4` — strengthens the three order/navigation test files: same-attempt retry key reuse, fresh key after confirmed success, and no cancellation mutation for a missing tracked order. The older uncommitted test diffs were adapted to the RC’s durable order-attempt API; its route mock fix and broader idempotency coverage were already in the base.

## Included work verified in the base

- Approved no-letter Garage badge change `4c11063336454bfeed69a6e9fbf23d39117e885b` is already an ancestor of the candidate. `GarageBrandBadge` resolves by normalized backend make ID, falls back to a name match for older rows, and supplies a neutral car to `BrandLogo` when the logo is missing or fails. The active card and vehicle switch row pass backend `brandId`; the badge is decorative to accessibility, with the adjacent make name providing its label.
- Garage image lifecycle and generation work is present, including `be00b376e8fcec897324793361b4a54dfd36887f` (honest image states and foreground refresh), `0842493571c62bbc4bb7e7ab7770145b34838db3` (backend generation and two-option pick), and `5614403e237219ba5a5f7c3bf1ade95ecfbcdf7c` (pipeline contract 2 and registry handshake). `4b9baceb9240b6d2de03da369349e5ac1417899a` keeps a neutral placeholder while the pipeline is frozen.
- Tracker IDs stay distinct (`tracker` and `tracker-2`). The candidate does not expose the pending Tracker artwork as approved: generation/body approval and a distinct Tracker 2 image remain outstanding. Cobalt, Gentra, and Nexia 3 are the only owner-approved vehicle images recorded by the current reconciliation; other artwork remains pending.

## Validation performed

- `npm test`: **161 test files, 2,200 tests passed**. The shared install lacked the already-declared `sharp` package; it was supplied temporarily from `/tmp` for the run, then the temporary shared symlink was removed. No dependency manifest or lockfile changed.
- `npm run typecheck`: passed.
- Production-configured `npx expo export --platform ios`: passed. The export used `https://api.mator.uz`, `APP_ENV=production`, `ALLOW_DEV_OTP=false`, and `AUTH_DEV_MODE=false`.
- Expo iOS prebuild and CocoaPods installation: passed.
- Xcode 27.2 simulator-SDK build: passed with a command-only `IPHONEOS_DEPLOYMENT_TARGET=16.4` override and code signing disabled. Without the override, Xcode 27.2 rejects Pod targets at iOS 12.0 and 13.4. The generated Podfile has no Xcode 27 workaround. No durable Expo plugin was added. `eas.json` does not pin an image; confirm the production EAS worker is Xcode 26.4 before its build.
- The Simulator service could not be reached in this run, so I did not repeat visual device QA. The prior successful Garage simulator QA is owner-reported, not re-verified here.

## Remaining TestFlight blockers and decisions

1. **Signing and associated domain:** verify the App Store release provisioning profile carries `webcredentials:mator.uz` and the intended App ID prefix. The repo has `ios.appleTeamId` set to `DXP9AG6TPN`; the domain-bound AutoFill record requires prefix `G5876A655Y`. The release profile/capability must be checked and regenerated as needed.
2. **OTP AutoFill:** code changes are implemented, but real-SMS AutoFill has not been verified on-device; prior iPhone testing showed no suggestion. The AASA file at `mator.uz` and the domain-bound SMS template are documented as not deployed, and the template still needs aggregator approval. Keep the current plain SMS template until the domain, entitlement/profile, and approved template are live together. Manual OTP remains available.
3. **Vehicle images:** leave image generation frozen until the backend registry matches the new candidate fingerprint and its runtime pin. Keep only approved assets visible. Tracker/Tracker 2 image identity and owner approval are unresolved; broader catalog art is pending as recorded in `docs/vehicle-images/catalog-reconciliation.md`.
4. **Production order behavior:** frontend idempotency is covered by tests, but deployed-backend replay/concurrency behavior has not been verified. No real production order or payment was created. Obtain backend-owner evidence in a safe environment before release sign-off.
5. **Exact EAS build:** run and inspect the production EAS build with the confirmed Xcode 26.4 image, production signing, and correct entitlements. No EAS build, TestFlight upload, merge, push, or deployment was performed.

No credentials, environment-file contents, or diagnostic logs are included in this candidate.
