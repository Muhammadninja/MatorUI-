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

## 11. Reference verification: first five (2026-11-10, awaiting owner approval)

**Evidence levels:**
- **Confirmed:** two or more independent sources agree.
- **Likely:** one good source, or consistent indirect evidence. A dated photo check is still needed.
- **Unverified.**

**Source quality:** sources found only in web search, with no direct manufacturer document, are marked as such. The manufacturer site (uzautomotors.com) gives model and trim pages, not generation histories.

### Cobalt: one current exterior; the "positions" are trim levels
- **"Позиция" means an equipment level, not a generation.** *Confirmed.*
  - Avtostrada describes position 2 as LT (manual/auto) and position 4 as LTZ AT / GX-Style with 15" alloys.
  - Car.uz price lists sell "2-я позиция" and "4-я позиция" side by side.
  - So the catalog's year ranges for `cobalt-p1…p4` (2013–15, 2016–18, 2019–21, 2022+) are **wrong**. Positions are sold at the same time.
  - This is a catalog/fitment issue for the catalog owner; it is not fixed here.
  - Sources: [Avtostrada: Cobalt positions](https://www.autostrada.uz/cobalt-variant/), [Car.uz: Cobalt](https://www.car.uz/uz_cyr/page/vendor/chevrolet/cobalt).
- **Exterior differences between trims: wheels.** Steel wheels on lower trims or "Optima"; alloys on higher trims and "Style". *Confirmed* by [UzAvtosanoat: Cobalt in a new trim](https://uzavtosanoat.uz/ru/news_show/chevrolet_cobalt_v_novoy_komplektacii_uzhe_v_prodazhe) and [UzAvtosanoat: Cobalt, Lacetti, Damas trims](https://uzavtosanoat.uz/index.php/ru/news_show/avtomobili_chevrolet_cobalt_lacetti_i_damas_v_novyx_komplektaciyax_v_prodaze1696509158).
- **Midnight:** darkened headlights and wheels. A trim, not a body.
  - Its start date conflicts between sources: October 2024 per MarkLines, versus a 3 Nov 2025 dealer date for the "Midnight MCM".
  - Sources: [MarkLines](https://www.marklines.com/en/news/317064), [UzDaily](https://www.uzdaily.uz/en/uzauto-motors-launches-mass-production-of-updated-chevrolet-cobalt-versions/).
- **Front restyle:** announced as "in progress" in October 2025. No production date was found. *There is no restyled body to produce yet.*
  - Sources: [Trend.az](https://www.trend.az/business/4103275.html), [Spot.uz](https://www.spot.uz/ru/2025/09/08/cobalt-restyling/).
- **Unchanged exterior since 2013:** *Likely.* There is no evidence of an earlier Uzbek facelift, but it needs a dated 2013 versus 2025 photo check.
- **Proposed body:** `cobalt-gen2`. All `cobalt-p*` trims, and `cobalt` with no trim, map to it until a restyle ships.

### Gentra: its own body; sold as "Chevrolet Lacetti" since 2020
- **Name history:** Daewoo Gentra (2013), then Ravon Gentra (Oct 2015), then **Chevrolet Lacetti** (2020 brand merge). *Confirmed* by [Wikipedia: Daewoo Gentra](https://en.wikipedia.org/wiki/Daewoo_Gentra), [Wikipedia (ru): Ravon Gentra](https://ru.wikipedia.org/wiki/Ravon_Gentra) and [Wikipedia: UzAuto Motors](https://en.wikipedia.org/wiki/UzAuto_Motors).
- **Exterior differs from the 2004–2013 Lacetti sedan:**
  - Headlights, hood and front fenders come from the Lacetti hatchback.
  - The grille and bumper are unique.
  - *Confirmed* by [Wikipedia (ru): Ravon Gentra](https://ru.wikipedia.org/wiki/Ravon_Gentra) and [Autoua](https://daewoo.autoua.net/en/gentra-uz/).
- **Catalog risk:** the backend `lacetti` record can therefore mean the 2004–2013 sedan **or** a 2020+ "Lacetti", which is a Gentra body.
  - **Proposal:** set `lacetti` to the placeholder until year boundaries are verified.
- **Badge:** Daewoo, Ravon or Chevrolet, depending on the year. **Decision needed.**
- **Proposed body:** `gentra`.

### Nexia 3: same body as the Ravon Nexia R3 (Aveo T250 sedan)
- **Identity:** Ravon Nexia R3 = Chevrolet Aveo T250 sedan built in Uzbekistan. It was renamed Chevrolet Nexia in 2020 and discontinued in 2023. *Confirmed* by [Wikipedia: Chevrolet Aveo](https://en.wikipedia.org/wiki/Chevrolet_Aveo), [Wikipedia (de): Ravon Nexia R3](https://de.wikipedia.org/wiki/Ravon_Nexia_R3), [Autoreview](https://autoreview.ru/articles/primeryaem-na-sebya/r3) and [Avtostrada: Nexia 3](https://www.autostrada.uz/nexia-r3-obzor/).
- **Badge:** Ravon (2015/16–2020) or Chevrolet (2020–2023). **Decision needed.**
- **Proposed body:** `nexia-r3`.
- **Proposed share:** `sharedBy: ['nexia-3']`. Both backend records are named "Nexia 3" and the body is the same car.

### Spark: the M300 (Ravon R2), not the M400
- **Identity:** the Uzbek Spark is the M300, sold as Ravon R2 and then as the Chevrolet Spark from 2020. *Confirmed* by [Wikipedia: UzAuto Motors](https://en.wikipedia.org/wiki/UzAuto_Motors), [Wikipedia: Chevrolet Spark](https://en.wikipedia.org/wiki/Chevrolet_Spark) and [WardsAuto: Spark production](https://wardsauto.com/general-motors/gm-uzbekistan-launches-spark-production).
  - The backend trim id `spark-m400-ls` is therefore **mislabelled**. This is a catalog issue; it is not fixed here.
- **Unverified:** which M300 front the Uzbek car uses, the original or a facelift. A dated photo check is needed.
- **Proposed body:** `spark-m300`.

### Damas: the classic Damas is the backend `damas`; the new Damas Move/Max is not in the catalog
- **Classic Damas:** produced in passenger (DLX) and cargo **VAN** versions, which differ along the side ([uzautomotors.com: Chevrolet Damas](https://uzautomotors.com/cars/chevrolet_damas)).
  - The backend only has `damas-2-base`, so the versions **cannot be told apart**.
  - Proposal: produce the passenger version only.
- **Late 2025:** a **new-generation Damas, "Move" (passenger) and "Max" (cargo)**, launched alongside the classic one. It is a larger new body (4425 mm long).
  - It is *not* in the backend catalog. **Out of scope** until the catalog adds it. Do not map it to `damas`.
  - Sources: [Spot.uz: new Damas](https://www.spot.uz/ru/2025/12/31/new-damas/), [UzDaily: Damas Max and Move](https://www.uzdaily.uz/en/uzauto-motors-introduces-new-commercial-models-chevrolet-damas-max-and-move/), [Kun.uz: Damas and Labo production](https://kun.uz/en/news/2025/05/15/new-budget-minivan-introduction-wont-affect-damas-and-labo-production-uzauto-motors).
- **Exterior facelift of the classic Damas:** announced, with no details or date. *There is no new body to produce yet.*
- **Proposed body:** `damas-classic`.

### Exact filenames (5 bodies × 8 paints)

```
masters/chevrolet/{bodyKey}/chevrolet_{bodyKey}_{paint}_master.png   2400×1200 RGBA
masters/chevrolet/{bodyKey}/chevrolet_{bodyKey}_paint-mask.png       2400×1200 8-bit
masters/chevrolet/{bodyKey}/references/                              ≥3 dated photos + SOURCES.md
assets/vehicles/chevrolet/{bodyKey}/{paint}.webp                     1200×600 (app/CDN)

bodyKey ∈ cobalt-gen2, gentra, nexia-r3, spark-m300, damas-classic
paint   ∈ white, silver, gray, black, red, blue, green, beige
```

**Totals:** 40 masters, 5 masks, 40 WebP files and 5 reference packs. Masters stay outside the app; only WebP files ship or upload.

## 12. Gentra and Nexia 3: production kit (2026-11-10)

**Status:** no vehicle image has been produced. This environment has no image-generation model or service; Pillow and `cwebp` can only process and check images. The tool and checklists below are ready for the first supplied white base.

**Tool:** `scripts/vehicle-images/vehicle_image.py`.
- `fit`: crop, scale and place a supplied cutout into the house framing.
- `webp`: export the 1200×600 app file.
- `qa`: check a master against the framing spec, and check that paint variants change nothing outside the mask.
- It never alters the vehicle itself.
- **Dry run on the Cobalt reference:**
  - The 2400×1200 master passes every check (width 81.1%, height 98.0%, tyres on the bottom edge, centred, 0.67% semi-transparent edge pixels).
  - The master is 2.08 MB and the app WebP 88 KB.
  - The source is only 1774 px wide, so the tool warns about a ×1.35 upscale. A future Cobalt master needs a larger source.
  - A negative test (an off-centre car with a floor strip) is correctly rejected.

**Reference sources** (Wikimedia Commons, CC BY-SA 4.0, attribution required). These are candidates: the owner should confirm each one shows a production Uzbek-market car before it joins the reference pack.
- **Nexia 3 / R3:**
  - [Category:Ravon R3](https://commons.wikimedia.org/wiki/Category:Ravon_R3)
  - [Ravon Nexia R3.jpg](https://commons.wikimedia.org/wiki/File:Ravon_Nexia_R3.jpg) (2016 Moscow show)
  - [Ravon Nexia R3 2018.jpg](https://commons.wikimedia.org/wiki/File:Ravon_Nexia_R3_2018.jpg)
- **Gentra:**
  - [Category:Ravon Gentra](https://commons.wikimedia.org/wiki/Category:Ravon_Gentra)
  - [Ravon Gentra.jpg](https://commons.wikimedia.org/wiki/File:Ravon_Gentra.jpg) (2017)
  - [Category:Daewoo Gentra](https://commons.wikimedia.org/wiki/Category:Daewoo_Gentra)
- Each body also needs ≥1 manufacturer image, such as an uzautomotors.com model page, as an identity reference only. It is never traced or shipped.

**Identity checklist:** each item is compared side by side with the reference pack. Each is ticked, or the image is rejected.

| Check | Gentra (`gentra`) | Nexia 3 (`nexia-r3`) |
|---|---|---|
| Body | 4-door sedan, Lacetti sedan rear and roofline | 4-door Aveo T250 sedan with a separate boot |
| Front lights, hood, fenders | **Lacetti-hatchback-style** headlights, hood and front fenders, not the 2004–13 Lacetti sedan's | T250 sedan headlights and hood; no Nexia N150 or Aveo hatchback parts |
| Grille and bumper | Gentra-specific grille and bumper | T250 sedan grille and bumper, as in the reference pack |
| Badge | Chevrolet bowtie (owner decision); no Daewoo or Ravon badge | Chevrolet bowtie (owner decision); no Ravon badge |
| Fog lamps, mirrors, handles | As on the reference trim; every visible item matches one real trim | Same |
| Wheels | One real factory design from the reference trim (**owner to pick**) | Same |
| Orientation and camera | Front facing image-left; yaw, elevation and lens match the Cobalt reference | Same |
| Light | Matches the Cobalt reference: soft key light from front-left, no coloured reflections | Same |
| Background | Fully transparent; no floor, shadow, text or watermark | Same |
| Paint | Solid white | Same |
| Plate | None (blank or removed) | Same |

**Paint mask (per body):** an 8-bit, 2400×1200 PNG.
- **255** on painted panels only: body panels, bumper painted areas, mirror caps if body-coloured.
- **0** everywhere else: glass, lamps, grille, chrome, badge, black trim, tyres, wheels and background.
- `qa --mask` rejects any mask that marks transparent pixels.
- Pillow can make a draft mask from a supplied image, but chrome and lamp highlights look like white paint, so every mask needs manual correction before approval.

## 13. Candidate image inventory and integration (2026-11-10)

**Source:** 24 files in `~/Downloads`; 21 of them are also copied, untracked, into the main checkout's `assets/cars-2d/`. Every file was opened and inspected.

**Common defects:**
- All 23 new files are **RGB with no alpha**: the backdrop (white, light grey, or a baked checkerboard) is part of the pixels.
- They are 1774×887 or 1536×1024, too small for an honest 2400×1200 master.
- Duplicates: the two Equinox files are identical, and so are the two Malibu "Cutaway" files.

**Background removal:** the pipeline's `cutout` (a border flood-fill through neutral near-white pixels) was tried on six candidates. The visual check rejected every result:
- The Nexia 3 fill broke into the hood and roof.
- Gentra lost part of the rear roof edge.
- Tracker kept a streak on the hood.
- Tracker, Nexia 2 and Nexia 1 kept a baked floor or contact shadow under the car.

A white car on a white or checkerboard backdrop needs real matting, or a re-export with true transparency.

| Candidate file | Shows | Maps to | Status |
|---|---|---|---|
| (existing) chevrolet-cobalt-white.png | Cobalt, pre-restyle, alloys | `cobalt` → `cobalt-gen2` | **Integrated, pending owner approval.** Real alpha; QA pass; 1200×600 WebP 88 KB. |
| Gentra Sedan Cutout-1 | Gentra (hatchback-style lights, own grille) | `gentra` | Identity plausible. **Blocked:** baked checkerboard; cutout leaks. |
| Nexia 3 Sedan Cutout | Aveo T250 sedan | `nexia`+`nexia-3-*`, `nexia-3` | Identity plausible. **Blocked:** checkerboard; cutout broke into the hood. |
| Spark Front Three-Quarter View-1 | Spark M300 (facelift front) | `spark` → `spark-m300` | M300 (not M400). Original-vs-facelift front unverified. **Blocked:** checkerboard. |
| Compact Sedan Studio Shot | Nexia N150 (Nexia 2) | `nexia`+`nexia-2-*` | Identity plausible. **Blocked:** baked floor and shadow. `nexia-2` record share still unverified. |
| Nexia Studio Sedan | Nexia N100 (Nexia 1), Chevrolet badge | `nexia-1` | Identity plausible. **Blocked:** baked floor and shadow. |
| Tracker Studio Showcase | Tracker, 2020+ | `tracker` | Identity matches `tracker-3-premier`. **Blocked:** baked shadow; cutout streak. |
| Tracker SUV Studio Shot | Tracker, 2020+ (factory "TRACKER" script) | `tracker` | Duplicate body; not needed. |
| Damas Microvan Product Shot | Classic passenger Damas | `damas` → `damas-classic` | **Rejected:** "DAMAS" plate text, decals and stripes, more head-on camera. |
| Labo Mini Pickup Studio Shot | Labo | `labo` | **Rejected:** "LABO" plate and side text. |
| Malibu Studio Showcase | Malibu, 8th generation | `malibu`+`malibu-1-*` | **Rejected:** "MALIBU" plate text. |
| Malibu Cutaway (= Cutaway-2) | Malibu, 9th generation, 2019+ facelift | `malibu`+`malibu-2-*` | Which front the Uzbek Malibu 2 has is unverified. Checkerboard. |
| Onix Studio Showcase | Onix sedan, 2nd generation | `onix` | **Rejected:** "ONIX" plate text. |
| Captiva SUV Render | Captiva C140 facelift | `captiva` | **Rejected:** "CAPTIVA" plate text. Body for "Captiva 5" unverified. |
| Epica Studio Cutout | Epica | `epica` | **Rejected:** "EPICA" plate text. Checkerboard. |
| Silver Lacetti Studio Render | Lacetti J200 sedan, **silver** | `lacetti` | **Rejected:** not white. The record stays on the placeholder (owner decision). |
| Matiz Studio Cutout | Matiz | `chevrolet-matiz` | Generation unverified. Checkerboard. |
| Orlando MPV Studio Render-2 | Orlando, 1st generation | `orlando` | Generation not researched. Checkerboard. |
| Equinox SUV Cutout (= -1) | Equinox, 3rd-generation facelift | `equinox` | Generation unverified. Strong checkerboard; garbled side lettering. |
| Tahoe Front Three-Quarter View | Tahoe, 5th generation | `tahoe` | Generation unverified. |
| Trailblazer Studio Render | Trailblazer, body-on-frame SUV | `trailblazer` | Generation unverified (two different vehicles share the name). |
| Traverse SUV Render | Traverse, 2nd generation | `traverse` | Generation unverified. Garbled side lettering. |
| *(none)* | Tracker 2, `genrta-lacetti` | `tracker-2` | **Missing.** Cruze and Tacuma are out of scope. |

**Manifest changes:**
- `cobalt-gen2` gets a white asset; every `cobalt` record maps to it.
- Body keys renamed to `spark-m300` and `damas-classic`.
- `nexia-r3` declares `sharedBy: ['nexia-3']`.
- `lacetti` goes to the placeholder.

**To unblock the others:**
1. Re-export each image with a real alpha channel (transparent PNG, ideally ≥2400 px wide), with no plate text, decals, floor or shadow.
2. Verify the generations still marked unverified.

## 14. Background removal with Vision subject lift (2026-11-10)

**Tool:** Apple Vision `VNGenerateForegroundInstanceMaskRequest` (macOS 15.6, built in, no download). This is an ML subject mask, not colour thresholding.
- The script is kept in the session scratchpad as `lift.swift`.
- It ran on **copies**. The originals' SHA-256 hashes were verified unchanged afterwards.

**Edge refinement:** the alpha edge band only (≈5 px around the outline) is smoothed and choked about 1 px, and the white backdrop is unmixed from partly transparent edge pixels. Solid body pixels are never changed, and no new opacity is added.

| Car | Holes / missing panels | Windows, lamps, chrome, wheels | Checkerboard | Edge at app size | Result |
|---|---|---|---|---|---|
| Gentra | none (0 enclosed transparent px) | intact | none | clean; faint fringe | **Preview, pending owner approval.** 1200×600 WebP, 59 KB, QA pass. |
| Nexia 3 | none | intact | none | **bumpy outline** along the hood front and roof (mask contour itself) | Rejected for now: needs a manual edge retouch or a true-alpha re-export |
| Spark | 68 px enclosed | intact | none | **roof rails turned into white blobs**; wavy front corner | Rejected for now: same fix |

Automated QA passing is not approval; every result was inspected on white, charcoal and teal, and at in-app size.

**Manual edge refinement (same day):** a band-limited cleanup within 12 px of the Vision outline, seeded from the transparent outside. It only removes neutral near-white backdrop pixels; the interior stays untouched. The Spark also had targeted boxes for the roof-rail gaps.
- **Nexia 3: rejected.** The bumper-corner halo is fixed, but the roof's white top surface blends into the backdrop. The cleanup thinned it and left a detached sliver above the roof line.
- **Spark: rejected.** The rail gaps opened, but the enclosed roof paint under both rails got speckled holes (5,923 interior pixels changed).
- **Conclusion:** where white paint meets a near-white backdrop with no visible edge, the outline can't be recovered from these files. Nexia 3 and Spark need a re-export with real transparency, or retouching by hand in an image editor.
