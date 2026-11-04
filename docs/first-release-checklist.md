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
| App checks capabilities before sending | Yes | Not released | **Yes** | Closed against the old backend, seen on the simulator. Production now confirms version 2 |
| Selected vehicle header wording | Yes | Not released | **Yes** | Seen on the simulator |

## Live now

Backend `f935624c` is deployed with `SOURCING_TICKETS_ENABLED` off: `GET /v1/sourcing/capabilities` returns contract version 2 and `ticket_submission_enabled: false`. Nobody can submit a sourcing request until the switch is turned on for the live test.

## Not done, by decision or still open

- [ ] Push admin console `main`, which deploys it through Vercel

- [ ] Clear the saved chat on sign-out. A guest on the same phone can still see the previous account's conversation
- [ ] Choose the escalation chat and set `TELEGRAM_SOURCING_ESCALATION_CHAT_ID`
- [ ] Native read of the Uzbek wording
- [ ] Customer view of their requests. None today, and they hear through notifications only
- [ ] Offer notification text is still Russian only
- [ ] Retention for sourcing requests
