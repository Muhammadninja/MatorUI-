# Sourcing assistant: contract

The agreed behaviour between the app and backend, 2026-11-03. Backend deployed with tickets switched off. Admin console not pushed, app not released. **Not yet tested live.** Status is in `docs/first-release-checklist.md`. Backend release steps are in the backend repo, `Backend/docs/sourcing-first-release.md`.

## Release hold

**The sourcing flow stays off for customers until this is done:**

- [x] Backend deployed
- [ ] Authentication enforcement and request-ID deduplication verified on production
- [ ] Live test passed (see the end of this document)
- [ ] `SOURCING_TICKETS_ENABLED=true` set on production

Two safeguards hold this in place:

- **The app fails closed.** It sends nothing to the chat until `GET /v1/sourcing/capabilities` confirms `contract_version` 2 or above. Confirmed on the simulator against the old backend, and production now returns version 2.
- **The backend switch is off.** With `SOURCING_TICKETS_ENABLED` off, chat and catalogue matches work, and nobody can create a ticket.

## Product rules

- Guests can chat and browse. Creating a ticket requires the existing phone OTP sign-in, and the app keeps the customer's message through sign-in.
- The only confirmation is "Request received. We'll notify you when an offer is available", and only from a server ticket ID.
- No response-time promises, in fixed text or AI instructions.

## Capabilities

`GET /v1/sourcing/capabilities`, public.

```json
{
  "contract_version": 2,
  "auth_enforced": true,
  "idempotency": true,
  "vehicle_context": true,
  "multi_part": true,
  "ticket_submission_enabled": false
}
```

The app needs `contract_version` to be 2 or above before sending. `ticket_submission_enabled` is informational for the app, since the backend enforces it.

## Request

`POST /api/ai-chat/message`

```
Authorization: Bearer <token>        only when signed in
Idempotency-Key: user-1793...-a1b2c3:veh_123
X-Selected-Vehicle-Id: veh_123       only when a garage vehicle is selected

{ "message": "...", "history": [...] }
```

- `Idempotency-Key` is 8 to 128 letters, digits, `:`, `_` or `-`. Anything else is 400 `INVALID_IDEMPOTENCY_KEY`. The app builds it from the message and the car, so the same message on a different car is a different request.
- A failing token is 401, never treated as a guest, so the app can refresh it.
- A vehicle ID that isn't the caller's own is ignored.

## Errors

| Status | Code | Meaning |
|---|---|---|
| 409 | `IDEMPOTENCY_KEY_REUSED` | Same key, different message or car |
| 409 | `REQUEST_IN_PROGRESS` | The first attempt is still running after a 30-second wait. Retry |
| 503 | | Model or database failure. No ticket, and the key is free to retry |

## Response

```json
{
  "intent": "PARTS_RESULT",
  "reply_text": "Какой амортизатор нужен: передний или задний?",
  "extracted_data": { "part_name": "салонный фильтр" },
  "selected_vehicle": { "id": "veh_123", "label": "Chevrolet Cobalt 2026" },
  "all_parts_accounted": true,
  "parts": [
    { "part_name": "салонный фильтр", "status": "FOUND_IN_STOCK", "items": [
      { "id": "...", "title": "...", "price": "...", "category": "...", "categoryId": "...", "fit": "UNKNOWN" }
    ] },
    { "part_name": "масляный фильтр", "status": "TICKET_CREATED", "ticket_id": "..." },
    { "part_name": "амортизатор", "status": "NEEDS_CLARIFICATION" }
  ]
}
```

| Field | Values |
|---|---|
| `status` | `FOUND_IN_STOCK`, `TICKET_CREATED`, `AUTH_REQUIRED`, `NEEDS_CLARIFICATION`, `UNAVAILABLE` |
| `fit` | `FITS`, `UNKNOWN`, or null with no vehicle. Confirmed misfits aren't returned |
| `intent` | Single part: `FOUND_IN_STOCK`, `CREATE_SOURCING_TICKET`, `SOURCING_AUTH_REQUIRED`, `SOURCING_UNAVAILABLE` or `GENERAL_QUESTION`. Several parts: `PARTS_RESULT` |

Single-part replies also keep top-level `items` and `ticket_id`, and `reply_text` is always readable, so installed apps keep working.

`all_parts_accounted` is true only when `parts` covers everything asked for. A model reply without it counts as false.

## How the app reads a reply

| Reply | App shows |
|---|---|
| `TICKET_CREATED` with an ID, signed in | "Request received..." with the parts. Server text isn't shown |
| `TICKET_CREATED` without an ID | Failure, with tap to retry |
| `AUTH_REQUIRED`, or a ticket for a guest | Sign-in prompt. The message is kept and sent once after sign-in |
| `UNAVAILABLE` | "We can't take requests for parts right now" |
| `FOUND_IN_STOCK` | Server text, plus product links with a fit label when a car was checked |
| `NEEDS_CLARIFICATION` | The question in `reply_text` |
| Part outcome without `all_parts_accounted: true` | The outcome, plus "We understood only: X. If you need other parts too, tell us which ones." |
| Timeout, 409 or 503 | Failure, with tap to retry using the same key |
| Capabilities not confirmed | "Chat is temporarily unavailable. Your message wasn't sent." |

## Timeout and retry

The app waits 45 seconds. The backend's model timeout (18 seconds with one retry) and retry wait (30 seconds) stay under that, so the server normally answers first. A longer timeout isn't duplicate protection. The request ID is.

| Case | Behaviour | Status |
|---|---|---|
| App gives up, server finishes, customer retries | The retry returns the original ticket | Implemented |
| Network error, app resends automatically | Same key, same result | Implemented |
| Two sends at the same moment | The unique constraint picks one, and the other waits for its result | Implemented; tested against a fake database only |
| First attempt crashes | After a 60-second lease another attempt takes over, and the dead one can't commit | Implemented; same limit |
| **Customer leaves without retrying** | The ticket exists with no confirmation on screen. An offer still arrives as a notification | **Open.** Accepted for now |
| **Customer taps stop** | The server isn't told, so a ticket can still appear | **Open.** Accepted for now |

## Background behaviour

All configurable; see `.env.example`.

| Behaviour | Default |
|---|---|
| Staff notification retries, with backoff up to an hour | 8 attempts, then marked failed and escalated |
| Escalation when a ticket isn't picked up | 30 minutes, to an internal chat and the admin console |
| No-offer outcome, and the customer is told | 48 hours |
| Offer expiry | 72 hours. An expired offer can't be bought |
| Duplicate check: same account, part and car | 60 minutes |

These response times are internal targets and aren't shown to customers.

## Privacy

- **Dealer group:** part, make, model, year, and VIN without its serial number. No raw message or contact details.
- **Admin ticket list:** customer name and verified phone, for the existing admin roles. An unverified phone is left out.
- **AI model:** the customer's message and the car's name. The garage VIN isn't sent.

## Live test

**Blocked. No live requests or dealer notifications until all of this is in place:**

- [x] Backend deployed with the switch off
- [ ] Date and time agreed between the owner and backend owner
- [ ] Dealers group told in advance that a test is coming
- [ ] A named staff member is ready to return an offer
- [ ] Test account agreed, with a clearly labelled test part that isn't stocked

**Then, one run with the switch on:**

1. Guest: request the test part. Expect the sign-in prompt, no ticket and no group message.
2. Sign in. Expect the held message to send once, then "Request received...".
3. Confirm the ticket in the admin console with the right account, vehicle and contact, and one Telegram card with no raw message or full VIN.
4. Resend the same message. Expect no second card.
5. Staff member files an offer. Expect the notification, inbox row and offer screen.
6. Decline the offer and close the ticket. Expect the customer's status notice.
