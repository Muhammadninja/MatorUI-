# Mator iOS staging build

A separate app, **Mator Staging** (`com.fotih12.mator.staging`, scheme
`mator-staging`), that talks only to `https://api.staging.mator.uz` and installs
beside the App Store app on the same iPhone.

## How the app is kept apart from production

| Concern | Mechanism |
|---|---|
| API selection | Build time only: EAS profile `staging` → `EXPO_PUBLIC_APP_ENV=staging`, URL resolved in `app.config.js` (`config/environment-policy.cjs`). A local `.env` cannot change it: EAS profile env wins, and a release build fails unless the URL is exactly the staging one. The `production`/`internal` profiles refuse the staging environment. |
| Identity | `app.config.js` gives every staging-environment build its own name, bundle id, Android package and scheme, and turns OTA updates off. The production identity is untouched (resolved production config is byte-identical to `main`). |
| Local data | Different bundle id → separate sandbox (AsyncStorage) and keychain on iOS. In addition, `services/storage-environment.ts` records which API the install's data belongs to and wipes session, Garage, cart, favorites, checkout attempts and caches before any provider hydrates if it ever changes. Existing production installs are not wiped (first run only writes the marker). |
| Visible marker | `STAGING · api.staging.mator.uz` badge on every screen of a staging release build. |
| Payments | `services/payments-service.ts` refuses to start Payme/Click in a staging build without calling the server. The server must refuse too (below). |
| OTA | `updates.enabled=false` and channel `staging`; no production channel. |
| Submission | No `submit.staging` profile; `eas submit --profile production` is the only submit target and is never used for this build. |

## Staging access: why not Basic Auth in the app

Nginx `auth_basic` reads the `Authorization` header — the same header that
carries the app's `Bearer` JWT. A request can carry one or the other, never
both, so an app sending Basic credentials could not be signed in. Shipping the
shared `mator-tester` password in a TestFlight binary is also ruled out: it can
be extracted from any installed copy and cannot be revoked per person.

**Implemented in the app:** a per-tester access token, sent in its own header
`X-Mator-Staging-Access` next to the untouched `Authorization: Bearer …`:

- typed once by the tester on first launch (the "Mator Staging" screen), checked
  against `/health`, stored in the keychain with
  `WHEN_UNLOCKED_THIS_DEVICE_ONLY` (no backup, no other device), never logged,
  never bundled, never in `EXPO_PUBLIC_*`;
- attached by the shared API client, the chat stream, avatar upload and the
  Garage realtime socket — the only four paths that reach the API host;
- when the proxy refuses it (`401` + `WWW-Authenticate: Basic`), the app treats
  it as "staging access revoked", not as an expired session: no token refresh,
  no sign-out, and the token screen comes back;
- outside staging every function is inert; production requests are unchanged
  (covered by `tests/staging-access.test.ts`).

**Required on the server (not deployed — needs approval).** Until this is in
place, the app's token screen reports "refused" and nothing else works, which
is the safe failure. Browsers keep using Basic Auth.

```nginx
# http {} context, e.g. /etc/nginx/conf.d/mator-staging-access.conf
map $http_x_mator_staging_access $mator_staging_token_ok {
    default 0;
    include /etc/nginx/mator-staging-access.map;   # root:root 0600
}
```

```nginx
# /etc/nginx/mator-staging-access.map — one line per tester, revoke by deleting
# "<openssl rand -hex 32>" 1;   # name, issued YYYY-MM-DD
```

```nginx
# server { server_name api.staging.mator.uz; … }
location = /_mator_staging_gate {
    internal;
    if ($mator_staging_token_ok) { return 204; }
    return 401;
}

# In every proxied location (including the realtime/WebSocket one):
location / {
    satisfy any;                                   # Basic Auth OR a tester token
    auth_basic "Mator Staging";
    auth_basic_user_file /etc/nginx/.htpasswd-mator-staging;
    auth_request /_mator_staging_gate;
    proxy_set_header X-Mator-Staging-Access "";    # never forward the token
    # … existing proxy_pass / headers unchanged …
}
```

Then `nginx -t && systemctl reload nginx`. Check from a laptop (token from the
map, never pasted into chat or tickets):

```sh
curl -s -o /dev/null -w '%{http_code}\n' https://api.staging.mator.uz/health                       # 401
curl -s -o /dev/null -w '%{http_code}\n' -H "X-Mator-Staging-Access: $TOKEN" https://api.staging.mator.uz/health   # 200
```

Hand each tester their token over a private channel. Revoke by deleting the
line and reloading Nginx.

## Backend side effects to confirm before testing orders

The app blocks online payment; everything else must be enforced in
`/etc/…staging…env` on the server. Confirm each before running the order
scenarios (read-only check; values are not to be printed):

| Integration | Staging setting |
|---|---|
| Payme / Click | `PAYMENT_PROVIDERS=` (empty → no provider; the code default is `payme`). `PAYME_*` and `CLICK_*` unset or sandbox credentials only. |
| Payment return URL | Only if sandbox payments are ever tested: `PAYMENT_RETURN_URL_SCHEMES=mator-staging`. |
| SMS / OTP | No production Eskiz/Playmobile/Sayqal credentials. Note: with `NODE_ENV=production` the server refuses to boot on `SMS_PROVIDER=log`, and the release app never shows a development OTP. Testers need either a sandbox SMS account limited to their own numbers, or email OTP via a staging Resend key. **Decision needed.** |
| Telegram | `TELEGRAM_BOT_TOKEN` unset, or a staging bot. Polling disabled is not enough: dealer-group and escalation messages are *sent*, not polled (`TELEGRAM_DEALERS_GROUP_ID`, `TELEGRAM_SOURCING_ESCALATION_CHAT_ID`). |
| Push | `EXPO_ACCESS_TOKEN`/`APNS_KEY_P8`/`FCM_SERVICE_ACCOUNT_JSON` only reach devices registered in `mator_staging`. If that database was ever copied from production, delete its device tokens first. |
| Email | `RESEND_API_KEY` unset or a staging key; no customer addresses in `mator_staging`. |
| Alerts / webhooks | `ALERT_*_WEBHOOK_URL`, `ALERT_TELEGRAM_*` unset or staging channels; `ALERT_ENVIRONMENT_LABEL=staging`. |
| Vehicle images | `VEHICLE_IMAGES_ENABLED=false` (reported already). |
| Sourcing | `SOURCING_TICKETS_ENABLED` off, or escalation chat pointed at staging. |
| Dev auth | `AUTH_DEV_MODE=false`. |

## Build

One-time: register the iPhone (`eas device:create`) and let EAS create the
ad-hoc provisioning profile for the new bundle id (interactive Apple login):

```sh
eas build --platform ios --profile staging
```

Install from the EAS build page on the registered iPhone. This is an internal
(ad-hoc) build; TestFlight needs a separate App Store Connect app record for
`com.fotih12.mator.staging` and a `submit.staging` profile pointing at it —
not created, needs approval.

Local validation without a cloud build:

```sh
NODE_ENV=production EAS_BUILD_PROFILE=staging EXPO_PUBLIC_APP_ENV=staging \
EXPO_PUBLIC_API_BASE_URL=https://api.staging.mator.uz EXPO_PUBLIC_SENTRY_ENV=staging \
EXPO_PUBLIC_ALLOW_DEV_OTP=false AUTH_DEV_MODE=false \
npx expo export --platform ios --output-dir /tmp/mator-staging-export
```

## Physical iPhone checklist

Record pass/fail, device, iOS version, build number and time for each line.

**Install and isolation**
- [ ] Staging and App Store Mator both installed; names and icons distinguishable; staging shows the STAGING badge on every screen.
- [ ] First launch shows the "Mator Staging" token screen; a wrong token is refused; the right one continues.
- [ ] Signed in on the App Store app → staging app is signed out, with an empty cart, Garage and favorites (and vice versa).
- [ ] Revoke the tester token on the server → next request shows the token screen; the session is still there after re-entering a new token.

**Authentication**
- [ ] Registration (new number/email), login, logout.
- [ ] Token refresh: stay idle past access-token expiry, then act — no sign-out.
- [ ] Expired/revoked refresh token → routed to sign-in once, no loop.

**Garage**
- [ ] Add vehicle, select it, kill and relaunch → selection kept.
- [ ] Compatibility badges on catalog/product match the selected vehicle.

**Catalog**
- [ ] Explore, search, filters, sorting, product details, empty search result.

**Shopping**
- [ ] Favorite/unfavorite, persists after relaunch.
- [ ] Add/remove/change quantity in cart; cart survives relaunch.
- [ ] Checkout validation (missing address/phone).
- [ ] Payme/Click: refused with an error, no checkout page opens.
- [ ] Cash/pickup test order — **only after the backend table above is confirmed** — then it appears in order history.

**Localization**
- [ ] Russian, Uzbek, English: switch, relaunch, spot-check checkout and errors.

**Reliability**
- [ ] Cold start (force quit, relaunch).
- [ ] Airplane mode: offline state, then recovery.
- [ ] Slow network (Settings → Developer → Network Link Conditioner, "Very Bad Network"): timeouts surface, no duplicate orders.
- [ ] Backend unavailable (server stopped by operator): clear error, no sign-out.
- [ ] Repeated taps on add-to-cart, favorite and place-order: no duplicates.
