# iOS SMS code AutoFill

Status: **implemented in code, not verified on a device with a real SMS.**

## What the app does

Both code fields — the sign-in sheet
(`components/screens-components/auth/passwordless-auth-screen.tsx`) and the
phone-change sheet (`components/screens-components/account/phone-change-sheet.tsx`,
both of its fields) — are a single native `TextInput` each, not one box per digit.

| Prop | iOS | Android |
|---|---|---|
| `textContentType` | `oneTimeCode` | — |
| `autoComplete` | — (React Native ignores it on iOS unless it is a web value it maps; `sms-otp` is not one) | `sms-otp` |
| `importantForAutofill` | — | `yes` |
| `keyboardType` | `number-pad` | `number-pad` |
| `maxLength` | none: it would cut a pasted `483 917` before cleanup | none |

Every keystroke, paste and AutoFill insertion goes through `normalizeOtpInput`
(`utils/otp-input.ts`):

- a whole code in one event, with or without spaces or dashes, fills the field;
- a pasted SMS body yields the code, not the digits of a phone number;
- a suggestion inserted next to a half-typed code replaces it, since iOS inserts
  at the cursor;
- backspace and corrections behave like any text field.

AutoFill never submits. On sign-in, the button is also the legal consent, so that
tap stays the user's. Resend clears the entered code and verifies against the
new request. The app never logs a code. The demo/E2E `devCode` exists only in
mock transports and is ignored in release builds (`tests/auth-release.test.ts`).

None of this needs a native module or an SMS permission. iOS reads the message,
and the app only receives the text it inserts. It works the same in an EAS build
as in Expo Go, apart from domain-bound codes, which need the entitlement below and
so only work in an EAS build.

## What was seen on the owner's iPhone (2026-11-04)

- Builds `60f55a1` and `ebedbe00` (`693cf66`) already had `oneTimeCode`
  (commit `7bfd779`). On two sign-ins on an iPhone 15 Pro, iOS still offered
  no code, although AutoFill works in other apps on that phone.
- On the one sign-in whose SMS language was recorded, the SMS came in **Uzbek**.
- Likely cause, **not verified**: without the domain line, iOS finds the code by
  recognising wording like "code" in languages it supports. The Uzbek text
  ("tasdiqlash kodingiz …") and the Latin-transliterated Russian text are
  probably not recognised. The English text is.
- The `@mator.uz #123456` last line is a fixed format that does not depend on
  wording, so it should also fix this. Confirm on a device.

## Domain-bound codes (`@mator.uz #123456`)

From Apple's *Enabling AutoFill for domain-bound SMS codes* (iOS 14+):

- the **last line** of the SMS must be `@<domain> #<code>`;
- AutoFill offers such a code **only** in an app whose associated domains include
  that domain.

So the three pieces have to go live in this order. Changing the SMS first would
**remove** the AutoFill suggestion from every installed build that lacks the
entitlement.

1. **Domain** — `https://mator.uz/.well-known/apple-app-site-association`.
   - Checked 2026-11-13: it returned 404 on `mator.uz`, `www.mator.uz` and
     `api.mator.uz`, and Apple's CDN had no copy
     (`app-site-association.cdn-apple.com/a/v1/mator.uz` also returned 404).
   - `mator.uz` is served by the mator-admin Next.js site on Vercel. Branch
     `claude/ios-sms-domain-association` adds the file:
     `{"webcredentials":{"apps":["DXP9AG6TPN.com.fotih12.mator"]}}`.
   - It is served as `application/json`, with no redirect and no `applinks`, so
     mator.uz links keep opening in the browser.
   - **Not deployed.**
2. **App** — `app.json` → `ios.associatedDomains: ["webcredentials:mator.uz"]`.
   - The App ID needs the Associated Domains capability, and the provisioning
     profile has to be regenerated. EAS does both when it can sign in to Apple:
     run the next iOS build interactively, or with an App Store Connect API key.
   - A non-interactive build with only the stored profile fails with a
     profile/entitlement mismatch.
   - The build then has to ship to users. Until most installs have it, the old
     template is the safer one.
3. **SMS template** — the backend's `Backend/src/sms/otp-message.i18n.ts`.
   - The bodies are the exact texts approved by the aggregator (Eskiz), so the
     new ones must be approved there first.
   - Each stays a single GSM-7 part (≤ 160 characters, no Cyrillic):

   ```
   en (115 characters)
   Mator app: verification code for login {code}. Do not share it with anyone. Valid for 5 minutes.

   @mator.uz #{code}

   ru (123 characters)
   Prilojeniye Mator: kod podtverzhdeniya dlya vhoda {code}. Nikomu ne peredavayte. Srok deystviya 5 minut.

   @mator.uz #{code}

   uz (111 characters)
   Mator ilovasi: tasdiqlash kodingiz {code}. Hech kimga bermang. Amal qilish muddati 5 daqiqa.

   @mator.uz #{code}
   ```

   - Prepared on backend branch `claude/sms-domain-bound-otp` (`7aa0ae28`), not
     deployed. It is a production backend change, and it needs the
     aggregator's approval.

Before step 3, verify step 1 from outside:

```
curl -sI https://mator.uz/.well-known/apple-app-site-association     # 200, application/json, no redirect
curl -s  https://app-site-association.cdn-apple.com/a/v1/mator.uz     # Apple's cached copy (can lag up to a day)
```

The staging app (`com.fotih12.mator.staging`) is deliberately not in the file.
Staging sends no SMS; testers read codes from the staging OTP inbox, which this
work does not change.

## SMS delivery

The backend already abstracts SMS behind `SmsProvider`
(`Backend/src/sms/sms-provider.interface.ts`):

- providers `eskiz`, `playmobile`, `sayqal` and `log`;
- per-operator price accounting (`sms-operator.resolver.ts`, `sms-cost.collector.ts`);
- Eskiz delivery callbacks;
- a delivery-failure alert;
- a boot check that refuses `log` in production.

OTP abuse protection is in `OtpService`:

- 60-second resend cooldown;
- 5 attempts per code;
- 10 requests per phone per hour;
- 5-minute expiry;
- the global throttler.

| Provider | Fit | Notes |
|---|---|---|
| **Eskiz** (eskiz.uz) | Integrated, templates approved | Local aggregator for all Uzbek operators. Every SMS body is pre-moderated, so a template change needs approval. Sender name registered per operator. |
| **Play Mobile** (playmobile.uz / smsxabar.uz) | Integrated (adapter exists) | Local broker for all operators. Contract with a registered legal entity. Batch API. |
| **Sayqal** | Integrated (adapter exists) | Local aggregator. Needs a service id. |
| International (Twilio, Plivo, D7, …) | Not recommended as primary | Third-party listings show about $0.11–$0.46 per SMS to +998, usually without a registered local sender. Delivery depends on the operators' international routing. Possible as a fallback only. |

I found no published per-message prices for Eskiz, Play Mobile or Sayqal; ask
each for a quote. The backend's per-operator price table holds the rates actually
billed. Recommendation: keep Eskiz as the primary provider, and, once a
contract exists, configure Play Mobile as the failover (its adapter is already
written).

Nothing here turns on paid sending or adds credentials.

## Real-iPhone test

Needs an iPhone with a SIM that can receive SMS from the production sender, and
a build from the `production` (or `internal`) EAS profile. Expo Go and the
simulator cannot receive SMS.

**Plain code** (works with the current template):

1. Sign out, open sign-in, enter your number, tap Next.
2. When the SMS arrives, the QuickType bar shows "From Messages 123456". Tap it.
   All digits appear at once; the button turns active; nothing submits by itself.
3. Tap Agree & continue; you are signed in.

**Domain-bound code** (after all three steps above): the same flow, and the code
is still offered. Then check the negative case: in a build without the
entitlement, the domain-bound code is *not* offered. That shows the binding is
real.

**Manual entry and edge cases:**

- Typing six digits, backspace and correction work.
- Pasting `483 917`, or the whole SMS text, fills `483917`.
- Resend (allowed after 60 s): the field clears and the newest code is accepted.
  Also record whether the earlier code is still accepted; that is the
  backend's choice, and this work did not check it.
- Waiting 5 minutes, then entering a code: "expired" message, and you can resend.
- A wrong code shows an error. Five wrong codes lock that request.
- Light and dark mode; RU, UZ and EN (the SMS arrives in the selected language).
- Phone-change sheet: both fields (new number, current number) accept AutoFill.

Record the iOS version, the device, and whether the suggestion appeared. Do not
mark AutoFill as working until it has been seen on a device.
