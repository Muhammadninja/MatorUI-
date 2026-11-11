# Chevrolet vehicle image library: asset matrix (draft for owner approval)

**Status:** draft from 2026-11-10. Nothing is implemented yet. Implementation starts only after the owner approves this matrix.

**Source:** the live `GET https://api.mator.uz/v1/reference/models?makeId=chevrolet` (25 models) and `/v1/reference/trims?modelId=…`. These were read-only GETs on 2026-11-10. The bundled `services/uz-vehicle-catalog.ts` is only an offline fallback; it lists 10 Chevrolet models.

## 1. What the data can resolve

- The backend has **no generation field**. Generation appears only as a prefix of some trim ids.
- A saved vehicle carries `modelId`, an optional `trimId`, `year` and `color_hex`.
- **Resolution order:**
  1. **Trim-id prefix:** an exact, listed prefix such as `malibu-2-` maps to `malibu-gen2`.
  2. **Single-body model:** a model whose every record is one physical body maps directly by `modelId`.
  3. **Year:** used only for models whose year boundaries are marked *verified* below. **None are verified yet.**
  4. **Neutral placeholder:** everything else.
- A Cobalt image is never a fallback for any other model.

## 2. Requirements matrix (deduplicated by physical body)

**Column key:**
- *Body key* is the proposed asset identity.
- *Records → body* lists every backend record the body serves. Each is mapped explicitly, never by name matching.
- *Prio* uses the criteria in §4.

| # | Body key | Backend records → body | Body type | Status | Prio |
|---|---|---|---|---|---|
| 1 | `cobalt-?` | `cobalt` with trims `cobalt-p1-*` … `cobalt-p4-*` | sedan | **Ambiguous.** See §3-A. There are one or more bodies until P1–P4 differences are verified. The current asset's generation is unconfirmed. | P0 |
| 2 | `malibu-gen1` | `malibu` + `malibu-1-*` | sedan | Separate body | P0 |
| 3 | `malibu-gen2` | `malibu` + `malibu-2-*` | sedan | Separate body | P0 |
| 4 | `nexia-n150` | `nexia` + `nexia-2-*`; `nexia-2` | sedan | **Shared body, proposed.** Two records; owner approval needed. | P0 |
| 5 | `nexia-r3` | `nexia` + `nexia-3-*`; `nexia-3` | sedan | **Shared body, proposed.** Two records; owner approval needed. | P0 |
| 6 | `lacetti-j200` | `lacetti` (`lacetti-sx`) | sedan | Separate asset (owner rule 3) | P0 |
| 7 | `gentra` | `gentra` (`gentra-base`, `gentra-elegant`) | sedan | Separate asset (owner rule 3) | P0 |
| 8 | `spark-?` | `spark` (`spark-m400-ls`) | hatchback | **Ambiguous.** The local catalog says M400 (2015+); this needs verification. | P0 |
| 9 | `tracker-gen3` | `tracker` (`tracker-3-premier`) | SUV | Separate body | P0 |
| 10 | `captiva-?` | `captiva` (`captiva-5-premier`) | SUV | **Ambiguous:** which Captiva body "Captiva 5" is | P0 |
| 11 | `onix-gen2` | `onix` (`onix-1-premier`) | sedan | Separate body. Name to verify, since the trim says "1". | P0 |
| 12 | `damas` | `damas` (`damas-2-base`) | microvan | Separate body | P0 |
| 13 | `tracker-gen2` | `tracker-2` (no trims) | SUV | Separate body. **Same display name as #9.** | P1 |
| 14 | `nexia-n100` | `nexia-1` (no trims) | sedan | Separate body | P1 |
| 15 | `labo` | `labo` (no trims) | micro pickup | Separate. It shares the Damas cab, but the 3/4 view shows the bed, so it can't reuse #12. | P1 |
| 16 | `matiz-?` | `chevrolet-matiz` (no trims) | hatchback | **Ambiguous** generation | P1 |
| 17 | `orlando` | `orlando` (no trims) | MPV | Generation to confirm | P2 |
| 18 | `cruze-?` | `cruze` (no trims) | sedan | **Ambiguous** generation | P2 |
| 19 | `epica` | `epica` (no trims) | sedan | Generation to confirm | P2 |
| 20 | `tacuma` | `tacuma` (no trims) | MPV | Generation to confirm | P2 |
| 21 | `equinox-?` | `equinox` (no trims) | SUV | **Ambiguous** (multiple generations) | P2 |
| 22 | `traverse-?` | `traverse` (no trims) | SUV | **Ambiguous** | P2 |
| 23 | `tahoe-?` | `tahoe` (no trims) | SUV | **Ambiguous** | P2 |
| 24 | `trailblazer-?` | `trailblazer` (no trims) | SUV | **Ambiguous:** the name covers a body-on-frame SUV and the 2020+ crossover, two very different bodies | P2 |
| — | *(none)* | `genrta-lacetti` "Genrta" | — | **Neutral placeholder** (owner decision 1) | — |
| — | *(none)* | `nexia` with no trim | — | **Neutral placeholder.** It could be N150 or R3, and no year boundary is verified. | — |
| — | *(none)* | `cobalt`, `malibu` with no trim | — | **Neutral placeholder**, unless the year boundaries become verified | — |

**Physical bodies:** 24 (#1–#24), or more if Cobalt P1–P4 turn out to differ.

## 3. Ambiguities and catalog inconsistencies

**A. Cobalt "Position 1–4".**
- The catalog treats P1–P4 as year-bounded generations (2013–15, 2016–18, 2019–21, 2022+).
- In Uzbek usage, "позиция" commonly means an **equipment level**, not a model generation.
- If so, the year ranges and the `cobalt-pN-*` trim ids describe trim packages, and P1–P4 may share one exterior, or differ only in wheels or trim.
- **This is not verified.** Per owner rule 2, the asset is not reused across positions until dated reference photos of each position confirm the exterior.

**B. Other unverified identifiers.**
- The trim id `spark-m400-ls` (M400 versus another platform) needs checking.
- So do `captiva-5-premier` and `onix-1-premier`. The latter's name suggests a first generation, while the local catalog places it at 2020+.

**C. Catalog problems.** None of these are fixed here (backend and catalog owners).
- `genrta-lacetti` is misspelled ("Genrta") and has no trims.
- `tracker` and `tracker-2` share the display name "Tracker".
- `nexia` overlaps with `nexia-1`, `nexia-2` and `nexia-3`.
- The local catalog labels Gentra `internalCode: 'T250'`.
- 10 models exist only on the backend: orlando, chevrolet-matiz, equinox, traverse, tahoe, trailblazer, epica, labo, nexia-1, tacuma and cruze.
- None of the local year ranges have a cited source.

## 4. Priority criteria (no usage statistics used)

- **P0:** the record has curated backend trims **and** an entry in the local UZ catalog's Chevrolet line-up. These are the models the Add-Vehicle flow was built around.
  - `tracker-2` is the exception: the app's VIN catalog has evidence for it, but it has no trims, so it is P1.
- **P1:** a separately listed variant or sibling of a P0 line (tracker-2, nexia-1, labo, matiz).
- **P2:** backend-only models with no trims and no local catalog entry.

Real Garage counts per `modelId` can reorder this. They would come from a read-only query the owner or backend runs, not from estimates.

## 5. Naming convention

```
assets/vehicles/{make}/{bodyKey}/{paint}.webp              # bundled
https://<cdn>/vehicles/v{N}/{make}/{bodyKey}/{paint}@{w}.webp   # remote
```

- **`bodyKey`:** `{model}-{generation}`, lowercase kebab, for example `nexia-r3` or `malibu-gen2`. It is stable and independent of backend ids.
- **`paint`:** a key from the paint palette (`white`, `silver`, `gray`, `black`, `red`, `blue`, `green`, `beige` today). Later it can be a real factory paint name, such as `summit-white`.
- **Masters** are stored outside the app as `{make}_{bodyKey}_{paint}_master.png` (2400×1200), together with the source/licence record and the paint mask.
- **Manifest:** one JSON or TS file maps backend `modelId` and trim-prefix entries to a `bodyKey`, and lists the available paints for each body. This is the only place mapping lives; business logic never reads it directly.

## 6. Colour storage and retrieval

- **No schema change is needed.**
  - The garage DTO already persists `color_hex`; it is required on create (`services/garage-api.ts`).
  - The picker offers 8 real paints (`utils/vehicle-color.ts`).
  - `nearestSwatch()` already maps any stored hex to one of them.
- **Retrieval:**
  1. Map `color_hex` to the nearest paint key.
  2. Use that body/paint asset if it exists **and** the stored hex is within a closeness threshold.
  3. Otherwise use the body's white asset.
- **"Optional" colour:**
  - Today create always sends a hex, so the app cannot tell "chose white" from "didn't choose".
  - A real "not specified" state would need `color_hex` to become nullable, which is a **schema/API change that needs owner approval**.
  - It is not required for the first release.

## 7. Asset pipeline (consistent 2:1, realistic paint)

**Recommended route: licensed 3D models rendered with one fixed rig.** This is the only route that gives identical camera, lighting and scale across bodies, plus exact per-material control for paint.

1. **Camera:** front 3/4 facing like the Cobalt (front at left), about 30° yaw, about 5° elevation, a fixed focal length, and an orthographic-like scale for consistency.
2. **Lighting:** one HDRI and one studio rig for every car. Transparent film, no floor and no shadow catcher.
3. **Paint:** change **only** the body-paint material per colour (base colour, metallic and clearcoat). Glass, chrome, lights, tyres, rubber and badges stay untouched. No image-wide filter is used.
4. **Masks:** export the material-ID and paint mask with each master, so future colours can be re-rendered or composited.

**Fallback route: licensed photographs.**
- Each photo is manually cut out, panel-masked for paint and retouched, with luminance-preserving recolouring applied inside the paint mask only.
- It needs more manual work per colour and per body, and is less consistent.

**Normalisation for both routes:**
1. Trim to the alpha bounding box.
2. Place on a 2:1 canvas with the car's width at a fixed share of the canvas and the tyre line on a fixed baseline. This keeps visual scale consistent between a Spark and a Tahoe for the hero layout.

**Exports:**
- 2400×1200 master PNG.
- Mobile WebP with alpha at 1200×600, targeting about 150 KB or less.

**Automated QA script, run before an asset enters the manifest:**
- Aspect ratio is 2:1.
- Alpha is present and there are no opaque background pixels at the edges.
- The bounding box and baseline are within tolerance.
- File size is within budget.

**Human sign-off:** per body, against dated reference photos, for generation accuracy. AI-generated images are not accepted without this.

**Delivery:**
- **Bundled:** P0 white only, to keep the app bundle small.
- **CDN:** P1 and P2, plus all non-white paints. Loaded on demand through `expo-image`'s disk cache, with a fixed 2:1 box so the layout doesn't shift.

## 8. Asset counts

| Scope | Bodies | White only | × 8 paints |
|---|---|---|---|
| **Initial release:** P0, white | 12 (plus extra Cobalt bodies if P1–P4 differ) | **12–15** | — |
| Expansion 1: P0 colours | 12–15 | — | 96–120 |
| Expansion 2: P1 | 4 | 4 | 32 |
| Expansion 3: P2 | 8 | 8 | 64 |
| **Full library** | 24–27 | 24–27 | 192–216 |

## 9. Update 2026-11-10: owner decisions and preparation

**Implemented (frontend only, no images):**
- `services/vehicle-images/manifest.ts`: all 25 models, 23 bodies, every body unverified, and no assets.
- `resolver.ts`: strict id matching, trim-prefix generations, years only for verified and sourced ranges, a verified-share rule, and placeholder reasons.
- `paint.ts`: maps `color_hex` to one of the 8 paints within a distance of 32; anything else falls back to white.
- 24 tests cover the above.
- No UI is wired yet, and the Explore hero is unchanged.

**Cobalt "Position 1–4":**
- No public source found defines "позиция". Treating it as an equipment level is still a hypothesis.
- Exterior evidence:
  - The Cobalt Midnight MCM, produced from 2025-10-31, has darkened headlights and wheels at launch ([UzDaily](https://www.uzdaily.ru/en/chevrolet-cobalt-midnight-priced-73-million-soums-higher-than-current-model/), [Buzb](https://buzb.uz/en/news/uzauto-motors-to-launch-production-of-the-updated-chevrolet-cobalt-midnight)).
  - A front restyle (new grille and bumper) was reported for late 2025 to early 2026 ([Spot.uz](https://www.spot.uz/ru/2025/09/08/cobalt-restyling/), [Kun.uz](https://kun.uz/en/news/2024/05/14/updated-version-of-cobalt-expected-to-go-on-sale-from-2025)).
- So `cobalt-p4` (2022+) cannot be assumed to be one exterior.
- Cobalt stays on the placeholder until a dated reference photo of each position's exterior is matched.

**Priority source:** `docs/LAUNCH_CATALOG_MUST_HAVE.md`.
- Tier 1: Cobalt, Gentra, Nexia (Nexia 3), Spark, Damas.
- Tier 2: Tracker, Malibu, Onix, Lacetti.

**Storage:** the existing Cloudinary account already serves product photos (`res.cloudinary.com/drwrlu02c/.../mator/products/…`), and `utils/image-url.ts` already requests `f_auto,q_auto,c_limit,w_<bucket>` derivatives.
- Proposed folder: `mator/vehicles/chevrolet/{bodyKey}/{paint}`, with versioned public ids.
- `f_auto` delivers WebP or AVIF with alpha.
- No new infrastructure is needed.

**AI-assisted pipeline with verification:**
1. Reference pack per body: at least 3 dated real photos (front 3/4, front, side), plus the generation identifiers to check (grille, headlights, bumper, mirrors, wheels, door count, badges).
2. White base: AI-assisted render or retouch from the references, at the fixed camera, light, scale and orientation, with a transparent background. Then a visual sign-off against the checklist; no image is approved without it.
3. Paint mask: segment the painted panels, then correct them by hand. Glass, lights, chrome, grille, tyres, rubber and badges are excluded.
4. Paint variants: mask-constrained edits only. Dark paints (black, gray, blue) are regenerated inside the mask with matching reflections, not hue-shifted.
5. Automated QA:
   - Exact 2:1 ratio, alpha present, and transparent edge margin.
   - The car's bounding-box width and tyre baseline are within tolerance.
   - **The pixels outside the paint mask are identical to the white base.** This proves only the paint changed.
6. Export: 2400×1200 PNG master plus mask, kept outside the app; upload to Cloudinary. White images for Tier 1 may be bundled; colour variants are fetched on demand.

## 10. Exact asset requirements: first five priority models (2026-11-10)

**Framing reference:** `assets/cars-2d/chevrolet-cobalt-white.png`, measured:
- 1774×887 RGBA (2:1).
- Car bounding box: 81.5% of the width (10.1% left margin, 8.3% right).
- Height is 98.5%, with 1.5% top margin (antenna) and **tyres on the bottom edge**.
- 0.67% of pixels are semi-transparent (anti-aliased edges only).
- It is the reference for framing only. It does not stand for any Cobalt generation.

**Every body:**
- 2400×1200 RGBA PNG master, sRGB.
- The front of the car faces image-left, matching the Cobalt.
- Front 3/4 view, at the same yaw and elevation as the reference.
- Fixed light rig, matching the reference.
- **Scale:** fit the car into a box 81.5% wide and 98% tall, tyres on the bottom edge, centred horizontally. Tall bodies such as the Damas are limited by height.
- Transparent background, with no floor, shadow, text or watermark. The app draws its own ground shadow.
- White base (`white.png`), plus a paint mask: an 8-bit PNG, with white for painted body panels only.
- 8 paints: white, silver, gray, black, red, blue, green, beige.
- **App delivery:** 1200×600 WebP with alpha, about 150 KB or less each.
- **Reference pack:** at least 3 dated real photos (front 3/4, front, side), plus the licence or source record and the identity checklist.

| # | Model (backend records) | Body key(s) | Identity checks before approval | Open question | Masters (white + 7 paints) | Masks |
|---|---|---|---|---|---|---|
| 1 | Cobalt (`cobalt`, trims `cobalt-p1…p4-*`) | `cobalt-pre2025` and, if confirmed, `cobalt-restyle` | Grille and bumper shape, headlight style (Midnight: darkened), wheel design, badges | Do positions describe trims or generations? Which positions or years get the restyled front? Is Midnight a separate image or a trim? | 8 per body, so **8–16** (24 if Midnight is separate) | 1–3 |
| 2 | Gentra (`gentra`, trims `gentra-base/elegant`) | `gentra` | Gentra-specific grille, bumper and lights; not the Lacetti's | None | **8** | 1 |
| 3 | Nexia 3 (`nexia` + `nexia-3-*`) | `nexia-r3` | Ravon/Chevrolet R3 sedan front, sedan boot, 4 doors | Can `nexia-3` (the separate model id) share this body? | **8** | 1 |
| 4 | Spark (`spark`, trim `spark-m400-ls`) | `spark-{gen}` | The generation sold in Uzbekistan (the trim says M400): front, lights, 5-door hatch | Which generation is sold? | **8** | 1 |
| 5 | Damas (`damas`, trim `damas-2-base`) | `damas` (+ `damas-2025`?) | Microvan front, sliding door, roof line, plus whatever the 2025 update changed | Did the 2025 update change the outside? | **8–16** | 1–2 |
| | **Total** | **5–8 bodies** | | | **40–64 masters** | **5–8** |

Each master also needs a 1200×600 WebP for the app (40–64 files).
