# First release checklist

Updated 2026-11-04. Covers the sourcing assistant. Other release work is in `docs/RELEASE_STRATEGY.md`.

**Statuses:** Implemented = code committed locally, with unit tests. Deployed = live on production. Verified = confirmed against the real API. Blocked = waiting on the named item.

| Item | Implemented | Deployed | Verified | Note |
|---|---|---|---|---|
| Guests can't create tickets or notify staff | Yes | Yes | Blocked | Needs live test, with the switch on |
| Failing token is 401, not a guest | Yes | Yes | **Yes** | Production returns 401 for an invalid token |
| Draft kept through OTP sign-in | Yes | Yes | Blocked | Needs a real reply to trigger |
| Request IDs per account, concurrent retries, reuse rejected | Yes | Yes | Blocked | Fake database only so far |
| Selected vehicle validated and used for matching | Yes | Yes | Blocked | Needs live test, with the switch on |
| Unknown compatibility stays unknown | Yes | Yes | Blocked | Needs live test, with the switch on |
| One request with separate part items, statuses and offers | Yes | Yes | Blocked | Needs live test, with the switch on |
| Clarification when parts can't be accounted for | Yes | Yes | Blocked | Needs live test, with the switch on |
| Tappable catalogue matches and confirmed ticket IDs | Yes | Yes | Blocked | Needs live test, with the switch on |
| Response-time promises removed | Yes | Yes | Blocked | Needs a live chat reply. The old ticket path is off while the switch is off |
| Staff notification retries | Yes | Yes | Blocked | Needs live test and Telegram |
| Duplicate protection | Yes | Yes | Blocked | Needs live test |
| Configurable escalation | Yes | Yes | Blocked | Escalation chat ID not chosen |
| Customer status updates | Yes | Yes | Blocked | Needs live test |
| No-offer outcomes | Yes | Yes | Blocked | Needs live test |
| Offer expiry | Yes | Yes | Blocked | Needs live test |
| In-app delivery independent of push | Yes | Yes | Blocked | Needs live test |
| Dealer card without raw message, contact or full VIN | Yes | Yes | Blocked | Needs live test |
| Verified contact for staff in the admin console | Yes | Backend yes, admin console no | Blocked | Admin `main` is not pushed yet |
| Migration | Yes | Yes | Reported | Owner confirmed the deploy is healthy |
| Rollback steps | Yes | Not applicable | Blocked | Written, not rehearsed |
| Saved chat separate per account, cleared from screen on sign-out or switch | Yes | Not released | Blocked | Tests cover A → sign-out → guest → B → A with cold launches. Needs two real accounts on a device |
| Reply from the old session discarded | Yes | Not released | Blocked | Tests only |
| Guest message kept through OTP sign-in | Yes | Not released | Blocked | Tests only. Needs the live test |
| App checks capabilities before sending | Yes | Not released | **Yes** | Closed against the old backend, seen on the simulator. Production now confirms version 2 |
| Selected vehicle header wording | Yes | Not released | **Yes** | Seen on the simulator |

## Live now

Backend `f935624c` is deployed with `SOURCING_TICKETS_ENABLED` off: `GET /v1/sourcing/capabilities` returns contract version 2 and `ticket_submission_enabled: false`. Nobody can submit a sourcing request until the switch is turned on for the live test.

## App build candidate

Branch `design/teal-explore-home`, including Codex's functional fixes. Not published.

| Check | Result |
|---|---|
| Typecheck and tests | Clean, 1,185 passed |
| Production iOS and Android bundles (`expo export` with the production profile) | Build. iOS points at `api.mator.uz`, contains the new code, and has no dev server address |
| Running app against production | Home, chat, order history and notifications load. No chat message sent |
| Native build (`eas build`) | Not run |

To build, once approved, with the working tree clean because EAS includes uncommitted files:

```bash
eas build --platform all --profile production
```

Don't run `eas submit` or `eas update` until the release is approved.

## Upgrade change: old saved chats are deleted

The first launch of this version permanently deletes the AI chat history saved by earlier builds. That history had no owner, so it could have been shown to the wrong account (`ai-chat:v1`, removed in `services/chat-storage.ts`). New chats are saved per account.

| Where a copy might exist | Result |
|---|---|
| Backend | None. The chat endpoint is stateless. `ai_messages` belongs to the AI advisor, which the app doesn't call |
| Sourcing tickets | Only the customer message that created a ticket (`raw_message`), not the conversation |
| Device backups (iCloud, Finder, Android backup) | May hold a copy from before the upgrade. Restoring one replaces the whole app state, and the next launch deletes the old key again, so this isn't a practical recovery path |
| Simulators on this machine | None left, checked 2026-11-03 |

**Impact:** customers lose their earlier assistant conversations, with no way to restore them in the app. Orders, garage, favourites and existing tickets aren't touched. Release notes should say so.

## Fractional prices

Amounts from the API are UZS with up to two decimals, and 10 of the 159 live catalog prices have a fraction (for example `65730.24`). Payme charges the exact amount in tiyin, and the Click link sends it unrounded.

The app now shows the exact amount everywhere through `formatSomAmount`: `95 730.24 сум`, and whole amounts without decimals. Totals and payment amounts are unchanged.

- [ ] **Owner decision:** backend comments say prices are whole som, but the data disagrees. If whole som is intended, round the catalog prices on the backend. The app will then show whole amounts with no change
- [ ] **Backend:** Click's prepare check compares rounded amounts (`click.service.ts:55`), while Payme compares exact tiyin

## Open before release, from the functional audit

The full list with owners is in `docs/audits/functionality-2026-11-03/REMAINING.md`. R2 and R8 to R12 there were written before the sourcing work, so check them against this document.

- [ ] Account switching on the real API with two accounts
- [ ] Error paths on live data: failed changes and their rollbacks
- [ ] Order idempotency on the backend. The app blocks duplicates, but that isn't a guarantee across restarts or devices
- [ ] Favourites sync with the backend, which isn't confirmed
- [ ] VIN finder has no entry point in the app

## Not done, by decision or still open

- [ ] Push admin console `main`, which deploys it through Vercel

- [ ] Choose the escalation chat and set `TELEGRAM_SOURCING_ESCALATION_CHAT_ID`
- [ ] Native read of the Uzbek wording
- [ ] Customer view of their requests. None today, and they hear through notifications only
- [ ] Offer notification text is still Russian only
- [ ] Retention for sourcing requests
