# Mator 1.0: signed-in QA checklist (main `b26a5b1`)

**Who runs it:** the owner, with their own phone number on production (`api.mator.uz`). No test SMS route exists in production, and staging access is frozen.

**Safety rules:**
- Payments stop at the Payme handoff page; nothing is paid.
- Cash/terminal orders are cancelled right away from Track order. Write down each order number so it can be cleaned up.

**Builds:**
- Android: the internal APK from EAS build `147b3492`.
- iOS: the simulator (dev client, `b26a5b1` via Metro :8095).

Record PASS/FAIL per step. Add a screenshot only on FAIL.

| # | Area | Steps | Expected |
|---|---|---|---|
| 1 | Sign-in + OTP | Profile → Log in → own number → Next → enter SMS code | Lands signed in; Profile shows name/phone; no guest ID |
| 2 | OTP errors | Wrong code once, then correct code; Resend after the 60 s cooldown | Wrong code shows an error and keeps the field; resend works; no crash |
| 3 | Garage add | Garage → By model and year → Chevrolet Cobalt 2020 → Save | Card shows the approved Cobalt image |
| 4 | Garage placeholder | Add Chevrolet Spark (or any VW) | Neutral placeholder with "No image yet" (RU «Изображения пока нет», UZ «Hozircha rasm yoʻq»); never "Image in preparation" |
| 5 | Garage persistence | Make Cobalt active → kill the app → reopen | Same vehicles, same active one; Home card shows Cobalt |
| 6 | Search + detail | Search "WOLVER" → open the antifreeze | Price, gallery, "fits your car" badge for the active vehicle |
| 7 | Favorites | Heart a part → Profile → Favorites → kill/reopen | Still listed; device-only, because server sync is off (`FAVORITES_SYNC_CONTRACT_VERIFIED=false`) |
| 8 | Cart | Add 2 parts, change quantity, remove one | Totals and service fee update; the cart survives a restart |
| 9 | Checkout (cash) | Checkout → address → cash → Place order once; double-tap Place order | Exactly ONE order is created; confirmation shows the order number |
| 10 | Order history + status | Profile → Orders → open the new order | Listed with "Awaiting payment / Processing"; Track order shows the timeline |
| 11 | Cancel | Track order → Cancel (cash order) | Status becomes Cancelled; history updates |
| 12 | Payment handoff | New order with Payme → Pay | Payme page or app opens with the right amount → back out WITHOUT paying → the order stays unpaid, with a retry option |
| 13 | Logout/login | Profile → Settings → Log out → log in again | Garage, cart and orders come back from the server; favorites stay on the device |
| 14 | Language | Switch to RU and UZ on Garage, Checkout and Orders | No missing keys, no clipped text |

**Afterwards:** cancel any unpaid test orders.
