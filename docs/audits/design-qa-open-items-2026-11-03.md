# Teal redesign: open items for external QA

Branch `design/teal-explore-home`, uncommitted, base `fe1f0b4`. Screenshots: `teal-redesign-2026-11-03/`
(real production API; name, phone and avatar redacted on Profile).

## Known issues

| # | Area | Issue | Owner |
|---|---|---|---|
| 1 | Notifications | `VEHICLE_STATUS_UPDATED` fires on every vehicle `PATCH`, including `{is_primary: true}` from "Сделать активным", so switching cars creates noise. Read from the local backend copy `.local/integration/backend`; not confirmed against the deployed version. | Backend |
| 2 | Notifications | Two unread events for Cobalt and Malibu appeared around 02:52 on 2026-11-03. The client only sends a vehicle `PATCH` from explicit user actions; the design session sent only deep links to that device. Another process was also driving the simulator. Origin not identified. | Investigate |
| 3 | Notifications | Backend titles and bodies are hardcoded per type (Uzbek for vehicles). Vehicle and order-status rows are localized on the client; other types still show server text. | Backend |
| 4 | Notifications | For a vehicle no longer in the garage, the name is parsed from the Uzbek body text. A structured `vehicle_name` in `data` would be more robust. | Backend |
| 5 | Notifications | Backend deeplink `/(tabs)/(garage)/vehicle/<id>` matches no app route; the client opens `/vehicle-detail` instead. | Backend |
| 6 | Notifications | The event doesn't record what changed, so rows can't say it. | Backend |
| 7 | Notifications | A failed feed request shows the empty state instead of an error (existing behaviour). | Frontend |
| 8 | Notifications | Unread rows with no destination can only be cleared with "Прочитать всё". | Decision |
| 9 | Catalog data | OEM values with suffixes, e.g. `25192803OEM`, `25195150UMPT`. | Data |
| 10 | Catalog data | Part titles stay Russian in the Uzbek UI: no `title_uz`. | Backend |
| 11 | Catalog data | Oil filter `part_stock_3664` appears in the Cobalt list, but its detail says "Нет данных о совместимости". | Backend |
| 12 | Home | "Двигатель" sits in the first six tiles with 0 parts. | Decision |
| 13 | Home | Transmission tile shows a piston; the clutch artwork is now unused. | Decision |
| 14 | Home | Header delivery location and vehicle-specific recommendations from the handoff are not built; both need new data flows. | Decision |
| 15 | Accessibility | "Сменить" (#007F86 on #E5F4F3) is about 4.2:1, under 4.5:1. Colours as specified; underlined semibold text. | Decision |
| 16 | Search | Rows no longer show article numbers, rating or tags, following the requested card contents. | Decision |
| 17 | Text | Two-line ellipsis on product titles is a deliberate exception to the earlier no-truncation rule. | Decision |
| 18 | Item detail | The similar-parts rail still uses the old card style; no gallery thumbnails. | Frontend |
| 19 | Shared | Resolved: toast colours now come from theme tokens. | Done |
| 20 | Tests | `hooks/use-legal.test.tsx` fails intermittently, including before this work. | Frontend |

Per-screen status and newer findings: `design-finish-checklist-2026-11-03.md`.

## Not verified

- **Builds:** Android; a real iOS release binary (badge absence confirmed in a production export only; the floating gear not checked in a release build; search timing by its `__DEV__` gate in code).
- **Widths:** 360 (narrowest run was 375).
- **Signed-in account:** Uzbek; large text.
- **Data edge cases:** long vehicle and profile names, nicknames in vehicle notifications, missing images, unavailable stock, large prices in search (none hit on a live screen).
- **Actions, not tapped on the real account:** add to cart (success, failure, pending), quantity control, remove, favorite toggle, "Сделать активным", vehicle settings, mark read, "Прочитать всё", tapping notifications, offer add and decline.
- **States:** request errors, in-progress loading, keyboard behaviour, VoiceOver, Reduce Motion.
- **Currency:** Checkout, order confirmation and order history were not opened after the formatter change.
- **Mockup:** the Garage mockup image never arrived; built from the written spec.
