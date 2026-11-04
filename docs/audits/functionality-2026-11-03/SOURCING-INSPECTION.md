# Sourcing assistant — read-only business-flow inspection

Inspected frontend commit `1b71b21` on `integration/approved-design-functionality-2026-11-03`. No application/backend code changed, no chat POST, sourcing request, staff notification, offer acceptance/rejection, order, payment, SMS or simulator action performed. Existing device-local data and read-only production API requests only. [Scrubbed evidence](sourcing-readonly-evidence.json). [Single remaining-work list](REMAINING.md).

The expected flow being checked is: understand the requested part(s) and vehicle → match real catalog/fitment → clarify ambiguity → persist an identifiable sourcing request when needed → deliver it to staff → provide a reachable customer channel → deliver an offer. A chat sentence alone does not verify those later boundaries.

## Where the exact “15 minutes” message comes from

The available backend source snapshot defines the exact Russian sentence at `src/common/i18n.util.ts:22` under `CANONICAL_RESPONSES.CREATE_SOURCING_TICKET.ru`:

> Спасибо за обращение! Этой позиции сейчас нет в нашем каталоге. Наш отдел закупок уже проверяет цены и свяжется с вами в течение 15 минут.

The exact Uzbek-Latin equivalent is at lines 23–24. These are **fixed canonical business-response strings**, not the frontend's network-error fallback. The existing local chat contains one exact RU and one exact UZ match; six total messages, zero saved ticket/request receipts. No personal message bodies were saved in this report.

In the reviewed backend flow (`src/ai-chat/ai-chat.service.ts:125–174`):

1. Claude extracts a singular `part_name`, vehicle fields and initial intent.
2. RAG match → `FOUND_IN_STOCK` with different fixed copy and catalog items.
3. No match → lookup a recent duplicate. If found, return the **same** 15-minute text with the existing `ticket_id`.
4. Otherwise await `createTicket`, broadcast an admin event, start Telegram delivery without awaiting it, and return the fixed 15-minute text plus new `ticket_id`.
5. Classification/RAG/database failure throws 503 in the reviewed code. The client marks the user message failed; it does not manufacture this canned success text for HTTP failure.

Thus the **intended normal source branch is an acknowledgement of a persisted new or reused ticket**, not a generic “AI is thinking” fallback. It is **not a receipt that staff saw it**, and does not prove the 15-minute promise. Repeats can acknowledge an old ticket with exactly the same wording.

There are two important limits:

- `GENERAL_QUESTION` / no valid part returns the model's free-form `reply_text` before persistence. The model prompt itself asks for similar 15-minute wording for part requests (`ai-chat.service.ts:228`), and downgrading an invalid ticket intent does not clear its reply. Wording alone cannot rule out an unsupported AI promise. The original response's **intent + ticket_id + persisted record** are needed.
- Frontend `SourcingChatResponse` does not model `ticket_id`; the adapter consumes `reply_text` and discards `intent`/`extracted_data` as durable business state (`services/chat-api.ts:440–445,514–546`). Saved chat therefore cannot prove which backend branch produced the historical message.

**Deployment provenance:** `.local/integration/backend` is an available source snapshot, not its own Git checkout. A `git rev-parse` there resolves to the parent frontend repo; `44b7d28` is **not** a verified backend SHA. Selected source-file SHA-256 fingerprints are saved in the evidence JSON. Deployed backend/source equivalence remains unverified; protected OpenAPI returned 401. Conclusions about backend implementation below explicitly refer to that snapshot.

## Current real-data observations

| Read-only check | Result | What it proves / does not prove |
|---|---|---|
| Existing device-local `ai-chat:v1` | 6 messages; 1 exact RU canonical match, 1 exact UZ match; no ticket receipt fields | Verifies previously displayed/saved text only. Not server ticket persistence or staff delivery. |
| GET `/v1/catalog/parts?q=фильтр&page=1&page_size=100` | HTTP 200, total 19, returned 19 | Catalog filter products exist now. Does not reproduce the previous LLM extraction, historical stock, exact requested parts or RAG result. |
| GET `/docs-json` | HTTP 401 | Schema/deployed version inaccessible in this inspection. Not evidence of missing routes. |
| GET `/v1/notifications?limit=100` with current persisted app credential | HTTP 401 | Inbox and offer records **not inspected**; counts are unknown, not zero. No credential refresh/mutation attempted. |
| GET `/v1/chatbot/conversations` | HTTP 404 | That history surface is not available at the queried path. The actual sourcing adapter deliberately uses local history and never calls this route. No assertion that sourcing tickets are absent. |
| Existing offer detail | Not requested | No authorized inbox/offer ID available; no fabricated ID used. |
| Admin ticket records / Telegram receipts | Not accessed | No staff session/log access supplied. No staff notification or bot call attempted. |

## Step checklist

`verified` means the specifically named layer was observed; `failed` means the reviewed implementation does not satisfy the stated business requirement; `unverified` means runtime proof is unavailable/prohibited. A source-level failure is not falsely attributed to an unidentified production build.

| Step | Status | Evidence and coverage |
|---|---|---|
| Select the live chat path | **verified — frontend source** | HTTP configuration selects `SourcingChatTransport`, POST `/api/ai-chat/message`; `/v1/chatbot` SSE/mock flows are not the current sourcing implementation (`services/chat-api.ts:437,561–563`). No POST executed here. |
| Identify the exact 15-minute wording | **verified — snapshot + existing local data** | Fixed canonical text and exact saved matches, as above. The original live response intent/receipt is **unverified**. |
| Correctly match catalog parts for the vehicle | **failed — reviewed matching contract** | Public catalog exists, but RAG snapshot matches any expanded title/part-brand token, keeps score > 0, limits 60 candidates/8 results, and does not apply supplied car `brand`/`model` or year/VIN/fitment (`rag-search.service.ts:87–122`). No-match does not prove the exact part is absent from the full catalog. End-to-end production matching was not replayed. |
| Clarify and track multiple requested parts | **failed — schema/workflow** | Extraction has one `part_name`; no per-part list/status/quantity/completion contract. Text history allows conversational clarification, but there is no enforced “resolve every requested part” step. Prompt says proceed as soon as one part is identifiable and permits at most one part-only question; it explicitly does not request model/year/VIN. Cannot prove a multi-part request was fully understood without an original structured trace. |
| Carry active vehicle context | **failed — frontend source** | Header shows “fits your [model]” at `ai-chatbot.tsx:599–605`, but send payload at 277–287 omits `vehicleContext`. Transport's selected-car suffix at `chat-api.ts:480–484` is therefore unused by this screen. Earlier text history can name another car. Backend RAG also lacks enforced vehicle filtering. |
| Persist the sourcing request represented by the shown message | **unverified — live record** | Snapshot awaits DB create or reuses a ticket before `CREATE_SOURCING_TICKET` + `ticket_id`; no accessible existing admin record/original response to correlate. Frontend discards ticket ID and has no customer ticket-status/readback surface. |
| Persist conversation safely across accounts/restarts | **failed — frontend source** | Existing local history is real, but one device-global `ai-chat:v1` key, mount-only hydration and no owner reset mean another account's chat can display and be resent. No server history in this adapter. Failed-message state is not saved; composer can send before hydration completes (`chat-storage.ts:15,31–59`, `ai-chatbot.tsx:158–179`). |
| Deliver request to staff | **unverified — live delivery** | Source broadcasts WebSocket to connected admins and fire-and-forgets Telegram. Missing config drops sends; send failures are logged/swallowed (`telegram-notifier.service.ts:96–113`); no durable staff-delivery receipt/outbox found in this path. A saved ticket is not acknowledgement from a staff member. |
| Guarantee “already checking / within 15 minutes” | **failed — reviewed guarantee** | No operational deadline, assigned owner, acknowledgement/escalation or delivery confirmation in ticket schema/path. The dealer offer-form's 15-minute session TTL, client 15-second request timeout, and 15/min throttle are **not** a customer SLA. Actual human response timing unverified. |
| Reach the customer through a confirmed channel | **failed — anonymous path; authenticated delivery unverified** | Valid JWT associates AppUser ID; guest/invalid/expired JWT can proceed anonymously (`OptionalJwtAuthGuard`). Ticket/DTO/Telegram card has no verified customer contact field or callback choice. Guest tickets have `userId=null` and `notifyCustomer` immediately returns. Telegram manager-contact button is dealer→manager, not a customer contact channel. Signed-in offer notifications exist in source, but no live receipt was obtained. |
| Deliver an existing offer to the customer | **unverified — live offer** | Source persists offer, emits owned `SOURCING_OFFER` inbox + queued push, and supports owned GET `/v1/sourcing/offers/:id`; client has offer detail/notification UI. Inbox request was 401, so no actual delivery/ownership or push receipt verified. Notification failure is swallowed after offer save; no customer offer-list recovery was found. Frontend 409 interpretations disagree (detail→expired, feed→accepted), and display ignores currency in one path. No offer action executed. |
| Handle request failure | **verified — source only** | HTTP/503 path fails the user message; synchronous send lock and abort cleanup exist. No canned 15-minute fallback generated by client failure. A request may already be committed when the client times out/stops; failed marker is lost on restart. Live failure injection not performed. |
| Handle repeated send/retry/regenerate without duplicated or lost work | **failed — end-to-end replay design** | UI same-tick lock and no automatic HTTP write replay help. Manual Retry/Regenerate still sends a new POST, with no stable request key. Backend dedupe is exact part string + known user + **PENDING only**, within 10 min; ignores car/year/preference, is find-then-create (race), and anonymous lookup omits owner filter entirely. It can reuse another customer's ticket or suppress a different vehicle request, while concurrent/status-changed repeats can duplicate. Live repeat test prohibited here. |

## Failure and repeated-send details

The JSON POST completes **before** the client displays the reply through artificial 30ms/token streaming (`chat-api.ts:531–536`). Stop during that phase discards a response although server work is already complete. A client timeout is 15 **seconds** (`api-client.ts:131`), not the promised 15 minutes. Cancellation cannot roll back a committed ticket.

Retry snapshots history that already contains the retried user turn; regeneration queues assistant removal but snapshots the old ref. The new `message` can repeat that user turn and carry the old assistant answer as history (`ai-chatbot.tsx:238–248,277–287,381–395`). Semantic 10-minute dedupe is not durable request idempotency. Duplicate reuse skips both staff fan-outs, so a failed initial dispatch is not repaired by the repeat in the reviewed path.

## Backend employee handoff — existing records only in this phase

Do not create a ticket, send a chat message (even a “safe” greeting), replay Telegram, generate an offer, mark notifications read, or call accept/reject to prove this initial inspection. No undocumented `dry_run` flag should be assumed safe: it could be ignored and create a live request.

**Read-only routes to use with the appropriate existing authorized session:**

```http
GET /v1/admin/sourcing-tickets?page=1&limit=100
Host: api.mator.uz
Authorization: Bearer <staff token supplied privately, never saved>
```

The source requires admin JWT + operator/manager/admin role; an app-user token is not a substitute. Correlate only the owner's already-existing messages/tickets privately by original response ID, time/message hash and owner. Share a scrubbed record, not raw customer text/IDs/phone/VIN or other customers' records.

```http
GET /v1/notifications?limit=100
Host: api.mator.uz
Authorization: Bearer <existing authorized customer session, never saved>

GET /v1/sourcing/offers/{existing_owned_offer_id}
Host: api.mator.uz
Authorization: Bearer <same authorized customer session>
```

These are exact read routes, not calls executed successfully in this inspection. Current customer credential returned 401; no offer ID was guessed. `/docs-json` also requires access; provide authorized schema/version out of band rather than weakening protection.

**Requested evidence and missing-functionality decisions:**

1. **Deployment/receipt:** supply actual running backend SHA and compare snapshot fingerprints. For the two existing canonical replies, provide original `intent`, `ticket_id`, whether new/reused, saved `createdAt/status`, and confirmed ownership. App needs a typed durable receipt/status, not text-only acceptance.
2. **Matching/parts:** provide existing extraction/RAG trace: each requested part, candidate IDs/scores and actual fitment filter. Agree a multi-part/clarification contract and avoid declaring catalog absence after a broad/capped/partial match. Expose a guaranteed read-only preview only if safely implemented; none was invented/called here.
3. **Vehicle:** backend must accept/use structured vehicle context and validate fitment; Codex must actually send the active context and retain product IDs for usable catalog results. Do not advertise “fits” solely from a header.
4. **Staff/SLA:** show existing ticket admin availability and Telegram `message_id`/sent/error state without re-sending. Confirm actual staff ownership and response timing. Missing configuration/outage must be visible; add reliable delivery/retry/acknowledgement or weaken the promise to “request saved” with honest status. A 15-minute dealer form TTL is not SLA enforcement.
5. **Contact/auth:** identify the supported customer channel and reachability/consent. Do not silently downgrade a rejected bearer to an unreachable guest while promising contact. Guest capture/polling/claim flow is missing; manager URL does not solve customer contact.
6. **Persistence/replay:** request-scoped idempotency/atomic dedupe, owner/vehicle/part scope, receipt recovery after timeout and durable dispatch retry. Confirm existing duplicate behavior without sending a new request. Isolate local conversation by owner and preserve failed/pending state in frontend; do not blindly resend stale history.
7. **Offer delivery:** correlate an existing saved offer→inbox row→push job/provider receipt. Handle inbox failure without an unreachable saved offer; clarify 409 codes/states. Codex must preserve offer vehicle/currency and interpret errors by code, not assume every 409 means accepted/expired.

Owners and closure conditions are recorded once in [REMAINING.md](REMAINING.md), R2 and R7–R12. Backend code was not modified. The existing `services/chat-flow.test.ts` exercises `MockChatTransport`, not this sourcing path; it was not rerun or presented as real integration evidence. No full audit, unit fixture server, backend server/database or extra simulator was started.
