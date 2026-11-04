# Backend employee handoff

> Актуальный единый список оставшихся пунктов: [REMAINING.md](REMAINING.md). Исправление финансовой разбивки после исходного smoke: [ORDER-PRICING.md](ORDER-PRICING.md). Старые списки и failed-наблюдения ниже сохранены как история, не как текущий статус исправления.

No backend code was changed or deployed. These are real public read-only requests, without credentials or account data, to the currently deployed API. Evidence: [public-api.json](public-api.json). Deployment SHA is unknown and should be attached by its owner.

Run each request once:

```sh
curl --silent --show-error --max-time 20 https://api.mator.uz/v1/search \
  -H 'Content-Type: application/json' \
  --data '{"query":"фильтр","sortBy":"price_asc","limit":5,"locale":"ru"}'

curl --silent --show-error --max-time 20 https://api.mator.uz/v1/search \
  -H 'Content-Type: application/json' \
  --data '{"query":"фильтр","sortBy":"price_desc","limit":5,"locale":"ru"}'
```

Both returned HTTP 200, total 19, five results and `nextPageToken: null`. Both returned exactly the same product order and prices: 30,000 / 32,000 / 31,000 / 60,000 / 60,000 UZS.

Expected: `price_asc` monotonic ascending; `price_desc` descending, deterministic tie breaking; usable opaque next token while additional results exist. Fix server-side over the full result set, not by sorting just the first page in the frontend. Recheck filters/OEM/fitment with existing catalog data after deployment; those were not freshly rechecked here.

Additional contract questions (not live tested, no write request supplied or executed): Does order creation enforce an idempotency key/unique checkout attempt across retries and devices? Which favorites endpoints/version are deployed, and are they authenticated and owner-scoped? Frontend click suppression alone cannot guarantee order idempotency after an accepted request loses its response. Do not test this by creating real production orders/payments.

## Earlier findings to reproduce after employee deployment

History comparison found existing sanitized backend handoffs in `codex/frontend-release-readiness` at `273bcf4`. These are **historical findings**, not newly executed integration checks in this follow-up. No new API requests were made while Claude held the simulator reservation.

OEM comparison, public read-only requests:

```sh
curl --silent --show-error --max-time 20 \
  'https://api.mator.uz/v1/catalog/parts?q=SOLITE5741AVG&page=1&page_size=20'
curl --silent --show-error --max-time 20 https://api.mator.uz/v1/search \
  -H 'Content-Type: application/json' \
  --data '{"query":"SOLITE5741AVG","limit":20,"locale":"ru"}'
```

Historical actual: catalog total 1 (`part_stock_6096`), search total 0. Expected: an existing OEM lookup product is discoverable through search. Attach deployed backend SHA plus sanitized current counts/IDs when rechecking.

Favorites read-only request template (employee supplies its own authorized token privately; never paste it into an artifact):

```http
GET /v1/me/favorites?limit=50
Host: api.mator.uz
Authorization: Bearer <employee-provided credential, not recorded>
```

Historical actual: authenticated request returned 404. Employee should verify deployed route availability and owner-scoped contract before the existing frontend sync feature is integrated. Do not create favorites or use the old local fixture harness as production proof.

Claude's premature feedback, notification empty-on-error, rapid favorite message, guest deep links, missing tracking ID and VIN exit findings are frontend bugs; no unsupported backend defect is claimed for those. Notification/vehicle mutation endpoints were not called to manufacture failures or alter real account state.
