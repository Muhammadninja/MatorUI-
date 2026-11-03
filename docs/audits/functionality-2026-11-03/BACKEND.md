# Backend employee handoff

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
