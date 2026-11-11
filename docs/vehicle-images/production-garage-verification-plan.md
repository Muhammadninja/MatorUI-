# Read-only production Garage verification plan

**Goal:** confirm that real production Garage records resolve to the right vehicle image and logo before release, without writing anything to production.

**Branch:** `feature/chevrolet-vehicle-images`. **Status:** plan only, not yet run.

## Safety rules
- No writes. During the check, do not add, edit, delete or reorder vehicles, set a primary vehicle, place orders, or change account data. Choosing the active car only writes to the phone's local storage, never to the server, so it is allowed.
- Sign-in is done by the account owner on the device. The SMS code is never shared in chat, typed by an agent, or requested by an agent.
- No access tokens, VINs, plates or phone numbers are copied out of the app or recorded.
- Use a non-release dev client pointed at `https://api.mator.uz`; no EAS build, no store or OTA update.

## Setup
1. Start a separate Metro for this branch with the production configuration: `EXPO_PUBLIC_APP_ENV=production`, `EXPO_PUBLIC_API_BASE_URL=https://api.mator.uz`, `EXPO_PUBLIC_ALLOW_DEV_OTP=false`, on a free port. Do not reuse Codex's 8082 server.
2. Agree who owns the simulator or device for the session.
3. The owner signs in with their real phone number.

## What to record
Record each Garage vehicle as one table row. Ids come from the app's debug log of `GET /v1/garage/vehicles`, read in the Metro terminal.
- If that log does not show the ids, add a temporary, **uncommitted**, `__DEV__`-only log of `make.id`, `model.id`, `trim.id`, `year` and `color_hex` (nothing else), and revert it afterwards.

| Vehicle (as shown) | make.id | model.id | trim.id | year | color_hex | Expected image | Card shows | Logo | Pass |
|---|---|---|---|---|---|---|---|---|---|

**Expected image comes from the manifest:**
- Cobalt, Gentra, Nexia 3 (`nexia` + `nexia-3-*`, or `nexia-3`) and Spark show their images.
- Every other model shows the silhouette.
- A saved colour other than white shows "Изображение в белом цвете" ("Image shown in white").

## Checks
1. **Id scheme:** the production ids are plain (`chevrolet`, `cobalt`). If any record uses a third format, stop and report it. Do not extend the normaliser without approval.
2. **Correct picture:** every row shows its expected image or the silhouette, and never another model's image.
3. **Logos:** the Chevrolet logo appears for every Chevrolet record in the Garage list and the top card. Any other make shows its own logo or the neutral car icon.
4. **Selection:** make each vehicle active in turn, both themes, then do one app restart with the last vehicle still selected.
5. **Edge cases**, only if they already exist on the account (do not create them): a vehicle with no trim, and a vehicle without a make or model id.
6. **Network:** the screen works with the device offline after one online load (bundled images; logos cached).

## Output
- The filled table and simulator screenshots in light and dark, with ids and personal data cropped out.
- Any mismatch is filed against the manifest, or against the catalog owner if a record's ids are wrong.
