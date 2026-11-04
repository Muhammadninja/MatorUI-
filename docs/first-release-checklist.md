# First release checklist

Updated 2026-11-03. Covers the sourcing assistant. Other release work is in `docs/RELEASE_STRATEGY.md`.

**Statuses:** Implemented = code committed on a branch, with unit tests. Deployed = live on production. Verified = confirmed against the real API. Blocked = waiting on the named item.

| Item | Implemented | Deployed | Verified | Note |
|---|---|---|---|---|
| Guests can't create tickets or notify staff | Yes | No | Blocked | Needs deploy |
| Failing token is 401, not a guest | Yes | No | Blocked | Needs deploy |
| Draft kept through OTP sign-in | Yes | No | Blocked | Needs a real reply to trigger |
| Request IDs per account, concurrent retries, reuse rejected | Yes | No | Blocked | Fake database only so far |
| Selected vehicle validated and used for matching | Yes | No | Blocked | Needs deploy |
| Unknown compatibility stays unknown | Yes | No | Blocked | Needs deploy |
| One request with separate part items, statuses and offers | Yes | No | Blocked | Needs deploy |
| Clarification when parts can't be accounted for | Yes | No | Blocked | Needs deploy |
| Tappable catalogue matches and confirmed ticket IDs | Yes | No | Blocked | Needs deploy |
| Response-time promises removed | Yes | No | Blocked | Live installed apps still show the old text |
| Staff notification retries | Yes | No | Blocked | Needs live test and Telegram |
| Duplicate protection | Yes | No | Blocked | Needs live test |
| Configurable escalation | Yes | No | Blocked | Escalation chat ID not chosen |
| Customer status updates | Yes | No | Blocked | Needs live test |
| No-offer outcomes | Yes | No | Blocked | Needs live test |
| Offer expiry | Yes | No | Blocked | Needs live test |
| In-app delivery independent of push | Yes | No | Blocked | Needs live test |
| Dealer card without raw message, contact or full VIN | Yes | No | Blocked | Needs live test |
| Verified contact for staff in the admin console | Yes | No | Blocked | Admin branch not deployed |
| Migration | Yes | No | Blocked | Never run on a database. Needs a backup and deploy |
| Rollback steps | Yes | Not applicable | Blocked | Written, not rehearsed |
| App stays closed until capabilities are confirmed | Yes | Not released | **Yes** | Simulator against production: nothing sent, message shown |
| Selected vehicle header wording | Yes | Not released | **Yes** | Seen on the simulator |

## Not done, by decision or still open

- [ ] Clear the saved chat on sign-out. A guest on the same phone can still see the previous account's conversation
- [ ] Choose the escalation chat and set `TELEGRAM_SOURCING_ESCALATION_CHAT_ID`
- [ ] Confirm what production currently runs. The backend branch is based on `origin/main`, so deploying it also ships anything on `main` that isn't live yet
- [ ] Native read of the Uzbek wording
- [ ] Customer view of their requests. None today, and they hear through notifications only
- [ ] Offer notification text is still Russian only
- [ ] Retention for sourcing requests
