# Selective integration and short native smoke — 2026-11-03

> Актуальный единый список оставшихся пунктов: [REMAINING.md](REMAINING.md). Исправление финансовой разбивки после исходного smoke: [ORDER-PRICING.md](ORDER-PRICING.md). Старые списки и failed-наблюдения ниже сохранены как история, не как текущий статус исправления.

Branch: `integration/approved-design-functionality-2026-11-03`.
Permanent checkout: `/Users/muhammadfotihabdullaev/Desktop/matorui/.local/worktrees/design-functionality-integration`.
Approved design base: `44b7d28f4c842f204262e244b24d48576d947527`, containing `f04772e` and `4f5d05c`.
Runtime source checked: `63f82d8` (subsequent recording commit adds tests/documentation only, with no application-source difference).

## Integration record

| Source commit | Integration commit | Selection |
|---|---|---|
| `250daf6` | `895d4fa` | Core functional fixes; no earlier duplicate auth/search/checkout/logging implementation applied |
| `8d4ff71` | `80ce6dd` | Historical audit evidence kept with its original provenance |
| `4842c7c` | `f9416ee` | Follow-up fixes; track-order binary conflict manually resolved on the approved design file |
| `249c2e3` | `63f82d8` | Per-account notification confirmation lock and handoff |

Omitted duplicate implementations: `eea9b09`, `a549566`, `34ccd8f`, `2e83baa`. Historical favorites sync/archive branches and runtime fixture-extraction branch were not merged. Auth compatibility with historical metadata was retained in the single candidate implementation. The documentation-only pause commit `a21065a` was not applied because the owner explicitly resumed integration.

The track-order merge reapplied only its error selection, removal of raw error text and useless retry, keeping Claude's AppPrice usage, wrapping, sizes and sentinel correction. Other shared screen/localization hunks auto-merged and were reviewed against `44b7d28`; design tokens, fonts, gutters and toast presentation remain. No themes/shared visual primitive change was introduced by integration.

**`services/orders-api.ts` is byte-for-byte unchanged from `44b7d28`** (`git diff --exit-code 44b7d28 -- services/orders-api.ts`, exit 0). Its reviewed diff changes date display via the active locale only: no API path/body, timestamp mutation, sort/order, status, quantity or total changes. Nine new mapper tests cover RU/UZ/EN, old fallback, invalid/missing dates and unchanged timestamps/non-date fields. Warm cached orders may retain their prior date language until refetch after a language switch; not changed or claimed verified here.

Original design branch remains at `44b7d28`; its unrelated dirty auth/user/API/docs/compatibility work is untouched. OTP autofill and the untracked `utils/otp-input*` files were not copied, imported or committed in this branch. Existing original design tests do not constitute OTP-autofill verification.

## Executed checks — not a full audit

| Check | Result |
|---|---|
| `npm run typecheck` | passed, exit 0 |
| Targeted session/cache/search/Garage/cart/checkout/route/notification/design-toast/catalog/i18n regressions | 160 tests / 17 files passed |
| Date localization, HTTP retry and logging regressions | 42 tests / 3 separate files passed (includes 9 date tests) |
| Total targeted unit/component regressions | **202 tests / 20 files passed**; controlled transports, separate from real integration |
| `npm run export:production:ios -- --output-dir /private/tmp/mator-combined-ios-export` | passed; Hermes `entry-3918e9a8fb309edc25d2d448358d8418.hbc`, 9.1 MB; JS export, not native release rebuild |
| `git diff --check` | passed |
| `services/orders-api.ts` versus approved design | no diff |

The existing Vite config warning remains. Full suite was not repeated. Unit test doubles were not used in real integration.

## Current simulator and real API evidence

Same existing iPhone 16 Pro / iOS 18.3, runtime 1.0.0 development client, Russian UI. Used only accessibility-tree observations; no screenshot package saved. The client initially reported connection to the old Metro at 8082. It was moved through its existing launcher to **`http://127.0.0.1:8084`**, served from the integration worktree via `npm run start:production -- start --localhost --port 8084`. Startup explicitly selected `https://api.mator.uz`, all real HTTP domains, dotenv disabled; visible app badge confirmed `PRODUCTION · api.mator.uz`.

Initial integration-only Metro entry resolution failed because Vitest had created a cache-only node_modules directory. Preserved that cache in `/private/tmp/mator-integration-unit-cache-20261103`, linked the existing installed project dependencies, and restarted only our port-8084 process. No dependency install/config change. Metro then reported `iOS Bundled 5081ms ... expo-router/entry.js (4572 modules)`, and the combined app rendered. Original port-8082 server was left untouched.

Backend deployed SHA/version was not exposed/established; employee confirmation remains required. Native checks below use existing data and actual app requests, not old screenshots or test responses. Saved observations omit names, phone/address values, account/order identifiers, VINs and credentials.

## Passed / failed / blocked checklist

| Flow | Status | Current observation / limit |
|---|---|---|
| Session | **passed, limited** | Existing authenticated session restored after switching/reloading the JS bundle and survived background/foreground. Authenticated existing order and checkout data loaded. No sign-out, expired-token injection, second account or SMS; cold OS/process migration remains unchecked. |
| Garage | **passed, read-only** | Existing selected Cobalt and secondary Malibu rendered; selected vehicle remained unchanged after navigation. No set-active/save/delete performed. Confirmation/failure fix remains unit-tested, not live exercised. |
| Search | **passed, limited** | Real query “фильтр” returned 19 matches. Applying the oil-filter category changed it to 6 matches and displayed those rows. No stale-result symptom observed during this short pass; adversarial races remain unit coverage. |
| Search sort/pagination/price-rating/OEM | **blocked / unchecked this pass** | Price/rating filters explicitly unavailable in UI. No exhaustive sort/pagination/OEM probe repeated; historical live defects and reproduction requests remain in BACKEND.md pending employee deployment confirmation. Do not infer those features pass from the category check. |
| Product detail | **passed, read-only** | Opened an existing filtered product; gallery counter, OEM, 60,000 UZS price, delivery/payment copy and “compatibility data unavailable” for current vehicle rendered. No add/cart/favorite/share action performed. |
| Favorites display | **passed, limited** | Existing empty favorites view rendered and returned to Garage. No toggles. |
| Favorites backend support/sync | **blocked / unchecked** | Historical API 404/owner contract needs employee confirmation. No sync engine integrated; account isolation/durable server sync not established by this smoke. |
| Cart | **passed, read-only** | Existing 2 lines (quantity 1 each): 369,000 + 545,000 = 914,000 subtotal; 25,000 delivery + 5,000 service = 944,000 UZS total. Unchanged when returning from checkout. No quantities/removals/promo/additions changed. |
| Checkout before submission | **passed, limited** | Existing address loaded (PII not retained). Real quote displayed pickup/free delivery; 914,000 + 5,000 = 919,000 UZS. Left via Back. No place-order/payment action. Cart defaults to courier while checkout's first quote is pickup; default-choice policy remains unconfirmed, not a demonstrated arithmetic error. |
| Notifications feed | **passed, read-only** | Existing localized vehicle/order feed loaded. No unread mark-all control in this data state; no row was opened/marked read. No manufactured request failure. Awaited confirmation and error recovery remain unit-only checks. |
| VIN navigation via Garage | **passed, navigation only** | “Add by VIN” opened the blank existing VIN form with disabled Save; Back returned to Garage. No VIN entered, decoded, or saved. |
| Standalone VIN Finder / entry placement | **blocked / unchecked** | No confirmed in-app entry point. Attempted browser deep-link entry had no accessible content, so stopped that path and returned to Mator. Its new Back/Home fallback is unit-tested only; placement not claimed confirmed. |
| Existing order tracking | **passed, limited** | Existing delivered order rendered price, total, full timeline and Russian placed-date; no blank body. Kept approved AppPrice/wrapping. |
| Tracking fee disclosure | **failed — known frontend presentation gap** | Existing order showed 100,000 in item lines and 130,000 total without delivery/service-fee rows. This does not prove server math wrong. Raw frontend contract already has fee fields; mapping/presentation review remains, not automatically a backend defect. |
| Guest gates / sign-out / A→B / mutation failures | **blocked / unchecked live** | Would require altering the preserved session/data or an unavailable safe scenario. Unit tests pass; no live coverage invented. |
| Orders, payments, SMS | **not executed** | Expressly excluded; submit buttons were not pressed. |

No cart quantities/lines, favorite membership, garage vehicles/primary or notification read states were deliberately changed. Normal app session restoration/read requests were used. No additional simulator, local backend/database, integration fixture or mock response.

## Remaining dependencies

- Backend employee: confirm running SHA, search sort/cursor/OEM deployment and filter support, favorites route/owner contract, and order idempotency across ambiguous retry/remount/device. Reproducible public read requests and historical-versus-current evidence are in [BACKEND.md](BACKEND.md). No backend code modified.
- Frontend/design: standalone VIN entry placement unchecked; tracking fee disclosure gap; courier-versus-pickup default policy; warm-cache date language switch. Other design-review findings remain in `docs/audits/codex-functional-issues-2026-11-03.md`; this short integration smoke is not a repeat audit or a claim those are resolved.
- Real session migration/account switching, safe mutation/error paths, guest flow, native release binary/Android remain unverified.

**Not frontend release-ready.** The combined branch preserves the approved design and passed the stated checks; these limited results do not close the failed/blocked items.
