# Vehicle image catalog reconciliation

This local reconciliation is backed by the field-level [canonical registry](../../services/vehicle-image-catalog.json), which maps every discovered asset to source files, model and generation mapping, compatible years, market, approval, and provenance. No production database, Cloudinary account, or deployed pipeline registry was queried or changed.

## Approval boundary

The latest owner instruction explicitly retains approval for Cobalt, Gentra, and Nexia 3. All other images remain pending, including the 17 previously hidden images and all Spark artwork. Older draft matrix labels that conflict with these three owner approvals are superseded only for these three assets. Image QA, filenames, and hidden status do not constitute approval.

| Image / asset | Current mapping | Approval | Source |
|---|---|---|---|
| Cobalt Gen 2 | Chevrolet Cobalt, UZ, 2013–2024 | Approved; owner-approved mapping retained | `assets/cars-2d/chevrolet-cobalt-white.png`; `assets/vehicles/chevrolet/cobalt-gen2/white.webp` |
| Gentra | Chevrolet Gentra (and verified 2020+ Lacetti alias), UZ, 2013–2022 / 2020+ | Approved; owner-approved mapping retained | `assets/cars-2d/White Chevrolet Gentra Sedan Cutout-1.png`; `assets/vehicles/chevrolet/gentra/white.webp` |
| Nexia 3 / R3 | Chevrolet Nexia 3, UZ, 2016–2022; distinct from Nexia 2 | Approved; owner-approved mapping retained | `assets/cars-2d/White Chevrolet Nexia 3 Isolated Cutout.png`; `assets/cars-2d/White Chevrolet Nexia 3 Sedan Cutout.png`; `assets/vehicles/chevrolet/nexia-r3/white.webp` |
| Spark M300 proposal | Chevrolet Spark; generation, market, years, and facelift unresolved | Pending; placeholder only | `assets/cars-2d/White Chevrolet Spark Front Three-Quarter View-1.png`; `assets/cars-2d/White Chevrolet Spark Hatchback Cutout.png`; `assets/cars-2d/White Chevrolet Spark Hatchback Cutout (1).png`; `assets/vehicles/chevrolet/spark-m300/white.webp` |
| Other processed and supplied Chevrolet artwork | Malibu, Nexia N150/N100, Lacetti J200, Tracker generations, Captiva, Onix, Damas, Labo, Matiz, Orlando, Epica, Equinox, Tahoe, Trailblazer, and Traverse entries | Pending; identity/market/generation and owner approval remain incomplete | Source paths, provenance, and any known year mapping are recorded per entry in the JSON registry |
| Unmapped decorative/source artwork | Compact Sedan, translucent crossover, Corvette C8, and one Tracker source without a verified distinct generation | Pending; not Garage catalog eligible | Recorded as unmapped entries in the JSON registry |

## Spark decision

- `assets/vehicles/chevrolet/spark-m300/white.webp` and `assets/cars-2d/White Chevrolet Spark Hatchback Cutout (1).png` are reconciled as pending candidates. Neither is referenced by the approved frontend manifest.
- The incorrect US-market AI candidate is excluded from the local catalog and display manifest. Its live pipeline registry approval state was not queried; do not reuse it without a read-only registry inspection.
- Spark without verified generation and market remains on the placeholder and cannot create a generation job. No new Spark was generated.

## Inventory limits and matching

- Inventory totals: 27 owner-supplied image files under `assets/cars-2d` (plus an ignored `.DS_Store`), 21 processed Chevrolet WebPs, and 25 reconciliation records (3 approved, 22 pending). Multiple source images may map to one processed record. All 17 hidden assets remain pending.
- The frontend manifest imports only the three retained owner-approved images. Pending files do not enter Garage display.
- The production pipeline registry and Cloudinary account were not queried. Production UUIDs, public IDs, and approval decisions remain unverified.
- A local pipeline registry snapshot is available at `.local/nx/pipeline/data/metadata.json`; it contains 7 requests, 7 queued job records, and 1 approved candidate/publication. Its approved record is Chevrolet Cobalt 2020, but its canonical identity has no market or generation; the remaining records are Nexia 2, Nexia 3, generic Nexia, and Gentra identities without market/generation facts and are pending. The snapshot is not copied into this catalog or changed. It is local runtime data, not evidence about production.
- Pipeline-generated publication keys are identity/version based rather than source filenames; candidate IDs are opaque IDs. A filename search therefore cannot establish whether a generic Cloudinary asset is owner-approved. Local Cloudinary/account state was not queried.
- Reuse requires compatible model, year range, explicitly configured market, and verified generation/facelift where applicable. Missing or ambiguous identity yields review/placeholder; model year alone never selects between generations.
- Backend `Vehicle` stores VIN and registration region, but the Garage image planner does not decode VIN or persist vehicle-market identity. The new `VEHICLE_IMAGE_MARKET_REGION` is an explicit single-catalog market assertion, not per-vehicle VIN proof. It is safe only if the Garage model catalog is confirmed to be Uzbekistan-market-only. Imported or mixed-market records need an authoritative per-vehicle market source before catalog reuse or generation can be enabled.
