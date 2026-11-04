# Sourcing assistant: backend contract

Proposal for the backend owner, 2026-11-03. Nothing here has been changed in the backend, and it needs your agreement before it's final. Findings are in `docs/audits/sourcing-assistant-verification-2026-11-03.md`.

## Release hold

**The new sourcing flow must not be released until both of these are deployed and verified on the production backend:**

- [ ] Authentication enforcement: no ticket and no staff message without a verified user (backend item 2)
- [ ] Request-ID deduplication: the same `Idempotency-Key` can't create a second ticket (backend item 3)

The app code is committed on `design/teal-explore-home` only. Committed doesn't mean released.

## Proposed, not live

**Everything new in this document is a proposal until the backend consumes it.** Today's backend ignores `Idempotency-Key` and `X-Selected-Vehicle-Id`, and doesn't send `SOURCING_AUTH_REQUIRED`, `parts` or `all_parts_accounted`. The app sending a header provides no protection by itself, and tests of that code only show the header is sent.

## Product decisions

- Guests can chat and browse the catalogue.
- A sourcing request requires the existing phone OTP sign-in. There's no separate phone field. The app keeps the customer's message through sign-in.
- The only confirmation is "Request received. We'll notify you when an offer is available", and only after the ticket is confirmed.
- No response-time promises anywhere, in fixed text or AI instructions.

## Who does what

| Work | Owner | Status |
|---|---|---|
| Vehicle context, tappable matches, sign-in gate, confirmation rules, parts clarification, stable request ID | App | Committed, not released, not yet exercised against a live reply |
| Everything under "Backend work" | Backend owner | Not started |
| Live test | Owner, backend owner, staff member | Not run. See "Live test" |

## Request

`POST /api/ai-chat/message`. The body is unchanged, because the endpoint rejects unknown fields.

```
Authorization: Bearer <token>        only when signed in
Idempotency-Key: user-1793...-a1b2c3 stable across every retry of one message
X-Selected-Vehicle-Id: <vehicle id>  only when a garage vehicle is selected

{ "message": "...\n\n[Selected vehicle: Chevrolet Cobalt 2026]", "history": [...], "vin": "..." }
```

Both headers are proposed. They're headers so today's backend ignores them and nothing breaks, which also means they do nothing yet. The `[Selected vehicle: ...]` hint is in Latin script on purpose, because `detectLanguage` reads the whole message and Cyrillic would answer an Uzbek customer in Russian. The app will drop the hint once the backend reads the header.

## Response

The current fields stay, and single-part replies keep their current shape so installed apps still work.

**New intent, `SOURCING_AUTH_REQUIRED`:** a part isn't in stock and the caller isn't signed in. No ticket is created and no staff are notified.

```json
{
  "intent": "SOURCING_AUTH_REQUIRED",
  "reply_text": "Войдите в приложение, чтобы отправить заявку на эту запчасть.",
  "extracted_data": { "part_name": "радиатор" }
}
```

`reply_text` matters for installed apps, which show it as written.

**New field, `parts`:** used when a message asks for more than one part. Every requested part appears, with one outcome each.

```json
{
  "intent": "PARTS_RESULT",
  "reply_text": "Какой амортизатор нужен: передний или задний?",
  "parts": [
    { "part_name": "салонный фильтр", "status": "FOUND_IN_STOCK", "items": [{ "id": "...", "title": "...", "price": "..." }] },
    { "part_name": "масляный фильтр", "status": "TICKET_CREATED", "ticket_id": "..." },
    { "part_name": "амортизатор", "status": "NEEDS_CLARIFICATION" }
  ]
}
```

Status is `FOUND_IN_STOCK`, `TICKET_CREATED`, `AUTH_REQUIRED` or `NEEDS_CLARIFICATION`. The app already handles all of these, and it asks a guest to sign in for any `TICKET_CREATED`.

**New field, `all_parts_accounted`:** required on every reply with a part outcome, including single-part replies. `true` means the reply covers everything the customer asked for. Send `false` when it can't be sure.

The app treats a missing field as `false`. Showing the one part that was understood doesn't tell a customer another was dropped, so anything other than `true` gets an explicit question. This means that on today's backend, which doesn't send the field, every part reply asks.

## How the app reads a reply

| Reply | App shows |
|---|---|
| Ticket with `ticket_id`, signed in | "Request received..." with the requested parts. Server text isn't shown |
| Ticket without `ticket_id` | Failure, with tap to retry |
| `SOURCING_AUTH_REQUIRED`, or a ticket for a guest | Sign-in prompt. Message is kept and sent once after sign-in |
| Catalogue match | Server text, plus tappable product links under the part name |
| Part outcome without `all_parts_accounted: true` | The outcome above, plus "We understood only: X. If you need other parts too, tell us which ones." |
| `NEEDS_CLARIFICATION` with empty `reply_text` | "Do you need other parts too? Tell us which ones." |
| Anything else | Server text |
| Timeout or error | Failure, with tap to retry using the same `Idempotency-Key` |

## Timeout and retry: unresolved

**A longer timeout isn't duplicate protection.** The app waits 45 seconds instead of 15, which only makes false failures rarer. These cases stay open until item 3 ships, and some need a decision after it:

| Case | Today | Open question |
|---|---|---|
| App gives up, server finishes | Ticket exists, staff are notified, the customer sees a failure | With the key, a retry returns the original ticket. Without a retry, the customer never sees a confirmation |
| Customer retries after a timeout | The key is ignored. Only the 10-minute exact-name check applies, so reworded output creates a second ticket | Fixed by item 3 |
| Customer leaves without retrying | Ticket exists with no confirmation on screen | Should the app look up a request by key when it reopens? That would need a new read endpoint |
| Network error | The API client resends a POST up to twice, assuming it never arrived. If it did arrive, this can duplicate | Fixed by item 3 |
| Customer taps stop | The request isn't cancelled on the server, so a ticket can still appear | Needs agreement on what stop should mean here |
| Request still running when the retry arrives | Both can pass the check, because nothing enforces uniqueness | Item 3's unique constraint should make the second wait or return the first result. Agree which |
| Server takes over 45 seconds | The app fails while the server continues | Agree a server time limit below the app's, so one side doesn't outlast the other |

## Backend work

### 1. Remove the response-time promises

This can ship alone and should go first.

- `src/common/i18n.util.ts:22-26`: replace all three texts. Suggested wording:
  - **ru:** Заявка принята. Мы сообщим, когда появится предложение.
  - **uz_lat:** Soʻrov qabul qilindi. Taklif paydo boʻlganda xabar beramiz.
  - **uz_cyr:** Сўров қабул қилинди. Таклиф пайдо бўлганда хабар берамиз.
- `src/ai-chat/ai-chat.service.ts:228`: delete the instruction to say the department will respond within 15 minutes. Add that the model must never promise a response time or say a request was submitted, because the model's own text reaches customers with no ticket behind it.
- `src/common/i18n.util.spec.ts:37-38`: these tests require "15 минут", so they need updating.
- `src/telegram/telegram-notifier.service.ts`: the comment mentions the 15-minute promise.

Uzbek wording should get a native read.

### 2. Require sign-in for tickets

- No verified user means no ticket and no staff message. Return `SOURCING_AUTH_REQUIRED`.
- Treat an invalid or expired token the same way. `OptionalJwtAuthGuard` lets it through as anonymous, and the app may still believe it's signed in.
- Catalogue matching and general chat stay open to guests.

### 3. Stable request ID

- Store `(user_id, idempotency_key)` with a unique constraint, written together with the ticket.
- The same pair returns the original ticket, without creating another or notifying staff again.
- Record it only when a ticket is created, so regenerating an ordinary reply still gets a new answer.
- A guest's held request reuses its key after sign-in. Guest replies create no record, so this works.
- Agree how long keys are kept. At least 24 hours is suggested.

### 4. Duplicate check by account and vehicle

`findRecentDuplicate` needs these changes:

| Today | Needed |
|---|---|
| Vehicle not compared, so a second car's request is lost | Compare vehicle |
| Guest searches match any customer's ticket | Remove once guests can't create tickets; never match across accounts |
| Exact `part_name`, so rewording creates a duplicate | Normalize the name, using the existing synonym groups |
| Only `PENDING` | Include `IN_PROGRESS` |

This catches customers asking again. The request ID in item 3 catches retries.

### 5. Vehicle-aware matching

- Read `X-Selected-Vehicle-Id` and confirm the vehicle belongs to the caller. Ignore it otherwise.
- Store the vehicle on the ticket, and show it on the staff card.
- Filter or rank matches by real compatibility. Don't describe unconfirmed parts as suitable: "подходящие" is in `FOUND_IN_STOCK` today.
- If the customer names a different car in the message, that wins.

### 6. Several parts

- Extract a list of parts, not one `part_name`.
- Give each part its own match or ticket, and never drop one.
- Set `all_parts_accounted` truthfully. If the message can't be fully resolved, send `false` or ask.
- Ask only when the answer changes which part it is, such as front or rear. The other parts can still go ahead.
- Decide with the owner how staff should see them: one ticket per part is simplest for offers.

### 7. Staff notification retries

`sendSourcingTicketToDealers` only logs a failure, so a ticket can sit unseen.

- Record delivery state on the ticket, and retry through the existing queue with backoff.
- Show delivery state in the admin console.
- Alert someone when a ticket fails delivery or isn't picked up. The threshold is an internal target, never shown to customers.
- Treat a missing `TELEGRAM_DEALERS_GROUP_ID` as a startup warning in production, since sends are silently dropped today.

### 8. Customer offer delivery

- Make `SOURCING_OFFER` delivery retryable. A failed `notifyCustomer` is lost today, though the offer exists.
- Set `EXPIRED` on offers. The status exists, but nothing sets it.
- Tell the customer when a request ends with no offer. "We'll notify you" otherwise has no ending.
- Show authorized staff the customer's name and phone on a ticket. Tickets have only a `userId` today, and the console shows no contact.

### 9. Tests and visibility

- Add tests for `AiChatService`, which has none, covering the acceptance table below.
- Add a version or commit to `/health`, so the deployed code can be identified.

## Acceptance

| Case | Expected |
|---|---|
| Guest, part in stock | Matches returned. No ticket |
| Guest, part not in stock | `SOURCING_AUTH_REQUIRED`. No ticket, no staff message |
| Expired token, part not in stock | Same as guest |
| Signed in, part not in stock | Ticket, `ticket_id`, one staff message |
| Same `Idempotency-Key` twice, including at the same moment | One ticket, one staff message, same `ticket_id` |
| Same part, different car | Two tickets |
| Same part and car, reworded | One ticket |
| Two customers, same part | Two tickets |
| Two parts, one in stock | One match, one ticket, `all_parts_accounted: true` |
| Message can't be fully resolved | `all_parts_accounted: false`, or a `NEEDS_CLARIFICATION` part with a question |
| App times out, then retries with the same key | One ticket, and the retry returns it |
| Telegram down | Ticket saved, delivery marked failed, retried |
| Model or database failure | 503. No confirmation |
| Any reply, any language | No response-time promise |

## Release order

| Step | Why |
|---|---|
| 1. Backend removes promises | Safe alone, and fixes installed apps too |
| 2. Backend ships items 2 and 3 | Required by the release hold |
| 3. Verify both on production | Using the live test below, once coordinated |
| 4. App release | Only after step 3 |
| 5. Backend ships items 4 to 9 | Additive. `parts` already works in the new app |
| 6. Remove the app's vehicle hint | Once the backend reads the header |

| Combination | Result |
|---|---|
| New app, today's backend, signed in | Blocked by the release hold. Retries have only today's 10-minute check |
| New app, today's backend, any part reply | Adds the "other parts" question every time, because the field isn't sent |
| **New app, today's backend, guest** | **Blocked by the release hold.** App asks for sign-in, but the backend already made an anonymous ticket and messaged staff. Signing in then creates a second ticket |
| Installed app, new backend, guest | Shows `reply_text` with no sign-in button, so it needs to explain itself |
| Installed app, new backend, signed in | Works, with the new wording |

## Live test

**Blocked. No live requests or dealer notifications until all of this is in place:**

- [ ] Backend items 1 to 3 are deployed, and the deployed commit is confirmed
- [ ] Date and time agreed between the owner and backend owner
- [ ] Dealers group told in advance that a test is coming
- [ ] A named staff member is ready to return an offer
- [ ] Test account agreed, with a clearly labelled test part that isn't stocked

**Then, one run:**

1. Guest: request the test part. Expect the sign-in prompt, no ticket and no group message.
2. Sign in. Expect the held message to send once and "Request received...".
3. Confirm the ticket in the admin console, with the right account and vehicle, and one Telegram card.
4. Tap retry or resend with the same message. Expect no second card.
5. Staff member files an offer. Expect the notification, inbox row and offer screen.
6. Decline the offer and close the ticket.

## Open questions for the owner and backend owner

1. One ticket per part, or one ticket listing several parts?
2. How long should requests stay open before the customer hears there's no offer?
3. Who gets alerted when a ticket isn't picked up, and after how long internally?
4. Should the customer's raw message and VIN go to the dealers group? This was flagged in the verification report.
5. The timeout and retry questions above.
