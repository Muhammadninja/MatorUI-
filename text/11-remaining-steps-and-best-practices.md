# Remaining steps + best practices

A consolidated punch list of everything still open before the app is
shippable, with the best-practices we agreed on while shaping the
search-row redesign. Use this to scope the next few sessions.

---

## Section A — Search-row UI polish (minor, "verify don't fix yet")

These are the last items from the original UI audit. None blocks API
integration, but each is worth a 30-second look in the running app
before declaring the surface done.

### A1. `RatingRow` vs `DeliveryRow` font-size hierarchy
- `RatingRow` text is 11px. `DeliveryRow` text is 10px.
- Likely intentional — rating is more emotionally weighty than
  delivery copy. **Verify in the app.** If it reads off, raise both to
  11 or drop both to 10.
- **Best practice:** size differences ≤ 1px between adjacent rows are
  invisible to most users — pick the same size or differ by ≥ 2.

### A2. `LikeButton` tap target ≥ 44pt
- Apple HIG and Material both require a 44pt minimum touch target.
- The heart icon's visible art is smaller than that; verify the
  pressable's hitSlop or padding pushes the tappable area to ≥ 44pt
  in both dimensions.
- **Best practice:** if visible art < 44pt, use `hitSlop={{ top, left,
  right, bottom }}` to inflate the press region without changing
  layout.

### A3. `HighlightedTitle` multi-line behavior
- Title can theoretically wrap to 3 lines (no explicit cap).
- Check what happens with a real long title + an active query
  substring near a wrap boundary — the highlight span shouldn't be
  cut awkwardly.
- **Best practice:** cap title at 2 or 3 lines with
  `numberOfLines={3}` and let RN ellipsize. Three-line titles + a
  ribbon + 4 lines of body content stretches a card uncomfortably tall.

### A4. Pull-to-refresh in `SearchResults`
- Not wired today. `AppList` likely supports it; verify and add an
  `onRefresh` that retriggers the current search.
- **Best practice:** pull-to-refresh on result lists is muscle memory
  for iOS users. Worth the 5 minutes.

### A5. `ResultsEmpty` pill styles vs. ribbon language
- The empty-state CTA pills use `borderRadius: 36` and dark
  `tokens.text` fill — visually fine, but a different vocabulary
  than the monochrome ribbon. Consider routing through the same
  button primitive used elsewhere.
- **Best practice:** one app, one button shape. If three primitives
  produce three pill styles, pick one and refactor the others to it.

---

## Section B — Unfinished user-facing flows

These have **dead-end CTAs** in production code — toast placeholders
or `MOCK_*` constants substituting for real screens / data. They
should be finished or explicitly hidden before public release.

### B1. Checkout (`components/screens/checkout-screen.tsx`)

What's missing:
- Apple Pay / Google Pay / Shop Pay buttons → toast placeholders.
- Address picker → toast placeholder; **no picker screen exists**.
- Payment-method picker → toast placeholder; existing
  `payment-methods-screen` could become it.
- `MOCK_ADDRESS` / `MOCK_CARD` literal constants in the screen file.

Best practices for finishing this:
- **Hide what you can't finish.** If Apple Pay won't ship in v1, don't
  render the button. A button that toasts "placeholder" is worse than
  no button — it reads as broken.
- **Picker screens are sheets, not new routes.** Use
  `app-bottom-sheet` for the address / payment-method pickers so the
  user keeps checkout context.
- **MOCK_* in screen files is a smell.** Move to a service
  (`services/checkout-service.ts`) so the checkout UI consumes an
  interface; mock and HTTP transports are swappable.
- **The selected address/card belongs in a context**, not local state.
  Otherwise the picker can't write back.

### B2. Track Order (`components/screens/track-order-screen.tsx`)

What's missing:
- Single `MOCK_ORDER` constant — every visit shows the same order.
- "Call courier" → toast placeholder.
- "Chat with courier" → "Chat coming soon" toast.

Best practices:
- **Take an `orderId` route param**, fetch the order from a service.
  Currently the screen ignores the route id and renders the constant.
- **`tel:` and `sms:` schemes work today** — "Call courier" can be
  `Linking.openURL('tel:' + phone)` and stop being a placeholder. No
  backend needed.
- **For "chat coming soon" — hide the button**. A button that toasts
  "coming soon" is worse than no button (see B1).

### B3. Auth — social providers (`components/screens/auth-screen.tsx`)

What's missing:
- Apple sign-in → toast placeholder.
- Google sign-in → toast placeholder.

Best practices:
- **Apple sign-in is required by Apple App Store review** if you ship
  Google/Facebook/etc. social sign-in. Don't ship one without the
  other.
- Use `expo-apple-authentication` and `@react-native-google-signin/google-signin`.
  Both expose a `signIn()` → token; pass the token to your auth
  backend for exchange.
- **Don't ship a toast-placeholder social button.** Hide the row
  entirely if neither is wired.

### B4. Payment Methods CRUD
- Explicit `// TODO: wire "Edit Card" and "Set as Default" to API
  calls` in `payment-methods-screen.tsx:135`.
- Add-card form collects fields but doesn't persist.

Best practices:
- **Never store card PANs on your own backend** — use a tokenization
  vendor (Stripe Elements, Adyen, etc.). The fields you collect in
  the screen should be passed to the SDK, not your server.
- The screen-level TODOs should disappear when the
  `payment-methods-service` lands; right now they read as "we know
  this is broken."

### B5. Cart awaiting-orders counter
- `MOCK_AWAITING_ORDERS = 2` literal at the top of `cart-screen.tsx`.
- Drives the "you have 2 incoming orders" banner.

Best practices:
- Pull from the orders service (`services/order-history-service.ts`
  presumably exists or should). One subscription, derive the count.

---

## Section C — Service-layer swaps (mock → HTTP)

These services are mock-backed but already follow a swappable
transport pattern. Each one is a "uncomment the HTTP class, swap the
singleton, wire env config" pass — same shape as the search service.

| Service | Current state | What lights up |
|---|---|---|
| `search-service.ts` | `MockSearchTransport` + HTTP stub in comments. Wire-shape complete (typed accent kinds, paging, facets, didYouMean). | Search list, typeahead, did-you-mean. |
| `catalog-service.ts` | In-process mock with the 6 items including the test fixtures. | Item detail, related items, search source data. |
| `ai-chat-service.ts` | `sendAiChatMessageMock` / `getAiChatHistoryMock`. | AI chat tab. |
| `top-featured-service.ts` | Mock-backed. | Featured row on the explore tab. |
| `garage-service.ts` + `garage-api.ts` | Both files already exist — swap is half-prepared. | Garage tab (vehicles list, add-vehicle, vehicle detail). |
| `cart-api.ts` | API-shape file exists alongside cart screens. | Cart tab content. |

### Best practices for the swap

1. **One transport interface per service.** Every consumer imports the
   transport singleton; swapping mock → HTTP is a single-line change
   inside the service file. The pattern is already in
   `search-service.ts`:
   ```ts
   export const searchTransport: SearchTransport = new MockSearchTransport();
   // becomes:
   export const searchTransport: SearchTransport =
     new HttpSearchTransport(API_BASE_URL, getAuthToken);
   ```
2. **Validate at the network boundary.** Use Zod / Valibot to parse
   the response into the typed shape. Today the search service trusts
   `res.json() as Promise<SearchResponse>` — that's a runtime lie.
3. **Catch unknown enum values, don't crash.** For
   `accentTagKind`-style typed enums, use `.catch(undefined)` or
   equivalent so a backend that adds `'editors_pick'` before the client
   does doesn't black-hole the response.
4. **Strip test fixtures behind `__DEV__`.** `mator-prime` and
   `mator-elite` should not show up in production. Wrap them in
   `if (__DEV__)` or move to a `mocks/` folder that the production
   bundle excludes.
5. **Echo the `requestId` on every analytics event.** The request id
   is already plumbed through `SearchResponse`; the click-tracking
   for ribbon impressions, product taps, and add-to-cart should
   carry it. Forms a closed loop with backend logs.
6. **Don't introduce a global "isMock" flag.** Swap inside the
   service file. A global flag spreads concerns across the codebase
   and tends to leak into the wrong layers.

---

## Section D — Cross-cutting items worth doing once

These aren't tied to a specific flow but pay back across many.

### D1. Add a basic test harness
- No tests today. The first ones should be the pure functions:
  `resolvePriceSignal`, `findCheapestId`, `parsePrice`. They're tiny,
  pure, and the highest-leverage protection against regressions during
  the API swap.
- **Best practice:** ship the swap *with* the test. Don't promise to
  "add tests later" — they never come.

### D2. Schema validation at every HTTP boundary
- Define a Zod schema per response type next to its TypeScript type.
- Use it in every HTTP transport. Failing schema = error state, not a
  crash.

### D3. Error UI parity
- `ResultsError` is the pattern. Make sure every screen that loads
  from a service has an equivalent error state, not just a blank
  screen.
- **Best practice:** every state machine has 4 cells:
  `idle | loading | success | error`. If a screen's render doesn't
  branch on all four, it's missing one.

### D4. Hidden = not implemented; greyed-out = implemented but
disabled. Never the same.
- A toast saying "placeholder" should be considered shipping a bug.
- A button hidden when a feature flag is off is fine.
- A button greyed out with an explanation ("Add an address to continue")
  is fine.

### D5. Production vs. dev fixtures
- Establish a convention: `__DEV__` guards or a `mocks/` directory.
- The catalog has `mator-prime` and `mator-elite` for ribbon testing
  — those don't belong in a production response.

---

## Recommended order

Once the search-row UI polish (A1–A5, mostly verify-only) is done,
tackle in this order:

1. **B3 social-auth hiding** — 5 minutes, removes the worst-feeling
   placeholders. Either wire the SDKs or hide the buttons until v2.
2. **B5 cart counter from real source** — small, removes a literal
   from a screen file.
3. **B2 track-order** — switch to route-param `orderId`, wire
   `tel:` / hide chat button.
4. **B4 payment methods CRUD** — needs vendor decision (Stripe etc.)
   before touching, so put it after track-order.
5. **B1 checkout pickers** — biggest job. Build the bottom-sheet
   pickers, move MOCKs to a checkout service, wire the order
   placement to a real endpoint.
6. **C — service-layer swaps** — search first (it's the most-shaped),
   then cart, then garage, then catalog/item-detail, then AI chat
   and top-featured.
7. **D1, D2** — tests and schema validation should ideally accompany
   each swap, not come after.

---

## Tracking

When each of the above lands, write a short follow-up doc in
`text/` with the next sequential number (12, 13, …) covering:
- what changed, in which files;
- what was deliberately left alone, and why;
- the verification steps you ran;
- the next obvious step.

That's the convention you've been using on docs 01–10 and it's been
clarifying.
