# Vehicle image pipeline: Phase 2.5 validation

This preparation is isolated to the vehicle-image module and a local runner. It does not call OpenAI, approve candidates, publish assets, or change Garage or the commerce backend.

## Provider configuration checked

Recommended initial provider/model: OpenAI Image API, `gpt-image-2.6-sunburst`. OpenAI currently lists that model ID, image generation and edit endpoints, and support for text and image inputs. The adapter uses `/v1/images/generations` without references and `/v1/images/edits` with reference files. The multipart `image[]` field is the documented format for multiple references. See [model capabilities](https://developers.openai.com/api/docs/models/gpt-image-2.6-sunburst), [edit API reference](https://developers.openai.com/api/reference/resources/images/methods/edit), and [image generation guide](https://developers.openai.com/api/docs/guides/image-generation).

The previous `1216x608` request is not among the documented standard sizes, and the API reference does not confirm arbitrary dimensions for this model. The adapter now requests the documented `1536x1024` size. It requests high quality, transparent background, WebP, and 90% output compression, then crops the transparent subject bounds and centers it on a transparent `1200x600` canvas. See the [image request schema](https://developers.openai.com/api/reference/resources/images/methods/generate) and [output options](https://developers.openai.com/api/docs/guides/image-generation#customize-image-output).

Transparent background is supported by GPT Image models that support transparent output, with PNG/WebP required. Reference images are sent only when supplied as local files. No unsupported generation, facelift, body style, trim, or color facts are inferred. Captiva color is explicitly supplied by this test; the GV80 facelift label is based on Genesis describing its refreshed model as introduced in 2024. The generation prompt remains a request, not a guarantee of model identity.

## Test cases and reference provenance

`scripts/vehicle-image-real-validation.mjs` contains:

| Vehicle identity              | Reference provenance                                                                                                                                                                    | Local reference filename                           |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| Chevrolet Captiva 2020, white | [2020 Chevrolet Arabia Captiva brochure](https://www.chevroletarabia.com/content/dam/chevrolet/middle-east/egypt/english/index/download-a-brochure/2020-brochures/Captiva_brochure.pdf) | `chevrolet-captiva-2020.png` (or `.jpg` / `.webp`) |
| BYD Han 2024                  | [BYD Han brochure](https://www.byd.com/material/byd-site/eu/pdfs/han/HAN-0224-BPS-EN-V5-web.pdf)                                                                                        | `byd-han-2024.png` (or `.jpg` / `.webp`)           |
| Genesis GV80 2025             | [Genesis GV80 newsroom gallery](https://newsroom.genesis.com/genesis-gv80/)                                                                                                             | `genesis-gv80-2025.png` (or `.jpg` / `.webp`)      |

These OEM sources establish provenance, but PDF/gallery URLs are not sent directly to the API. Export or download a suitable individual OEM vehicle image from each source into a private local directory. Until those files are supplied, the corresponding case runs without a reference image; the runner records `referenceCount` and source URL. Captiva's brochure image may show a different paint color, so it should only be used as shape/identity guidance while the prompt explicitly requests white. Respect source usage terms when staging images.

## Safe local workflow

Dry-run only: this verifies request/job deduplication and writes no API requests.

```sh
VEHICLE_IMAGE_VALIDATION_DIR=/private/tmp/mator-vehicle-image-validation \
VEHICLE_IMAGE_REFERENCE_DIR=/private/tmp/mator-vehicle-image-references \
node scripts/vehicle-image-real-validation.mjs --dry-run
```

The runner does not load `.env` automatically. It accepts `OPENAI_API_KEY` from its process environment or, when needed, reads only that variable from the file named by `VEHICLE_IMAGE_ENV_FILE`. The referenced file must be a regular file with owner-only permissions (for example, mode `0600`). Its contents are never printed. The isolated repo ignores `.env` and `.env.*` while keeping `.env.example` trackable. Expo only exposes `EXPO_PUBLIC_*` values to client code; the key is read only in this Node runner/provider path.

Use `node scripts/vehicle-image-real-validation.mjs --check-config` for a boolean-only configuration check. For exactly the BYD test case, after authorization and when the runtime key is available, use:

```sh
node scripts/vehicle-image-real-validation.mjs --case=byd-han-2024 --confirm-paid-generation
```

That command performs one attempt because the runner uses `maxAttempts: 1`. It creates a fresh local data directory (or uses `VEHICLE_IMAGE_VALIDATION_DIR`) and does not approve or publish the candidate. Store the key in a shell secret manager or inject it into the process environment; never put it in a checked-in file or command text.

Results stay in the configured local data directory with restrictive file modes: `metadata.json`, private source/output files under `private/`, `validation-manifest.json`, and `preview.html`. Open the local `preview.html` to inspect candidates against the checkerboard transparency background. The page includes the technical quality checks and measured metadata. Candidates remain pending and private; the runner has no approve or publish action. Visual vehicle identity must be manually reviewed.

## Measurement and cost

The adapter records elapsed provider request time, OpenAI `x-request-id`, raw token usage when returned, and an estimated USD total. For this model, the currently published rates are $5 per million text input tokens, $8 per million image input tokens, and $30 per million image output tokens ([OpenAI pricing](https://developers.openai.com/api/docs/pricing)). The estimate is:

```text
(text_input_tokens × 5 + image_input_tokens × 8 + image_output_tokens × 30) / 1,000,000
```

The OpenAI image guide's calculator estimates output tokens from exact model, size, and quality; reference-image inputs add image-token charges. The run manifest records usage-based measured estimates per case. It also records processing latency separately. If the API omits usage, cost remains unavailable rather than guessed. No generation has been run, so there is no measured latency, token usage, or incurred cost to report yet.

## Activation blockers

- Explicit authorization for the three paid API generations is still required. No call was made during Phase 2.5 preparation.
- An OpenAI API key with image-model access is required at runtime. OpenAI notes organization verification may be required for GPT Image models.
- Reference images must be staged from the cited OEM sources to exercise the edit endpoint. None are bundled or fetched by this preparation.
- Generation can satisfy output-format checks without depicting the correct trim/model year. The private preview requires human identity review; no visual identity verification is claimed.

## Environment variables

| Variable                       | Required            | Purpose                                                                              |
| ------------------------------ | ------------------- | ------------------------------------------------------------------------------------ |
| `OPENAI_API_KEY`               | For real generation | API credential; read only by the provider adapter                                    |
| `VEHICLE_IMAGE_ENV_FILE`       | No                  | Optional owner-only local env file from which the runner reads only `OPENAI_API_KEY` |
| `VEHICLE_IMAGE_MODEL`          | No                  | Defaults to `gpt-image-2.6-sunburst`                                                 |
| `VEHICLE_IMAGE_PROVIDER`       | No                  | Defaults to `openai`                                                                 |
| `VEHICLE_IMAGE_VALIDATION_DIR` | No                  | Defaults to `/private/tmp/mator-vehicle-image-validation`                            |
| `VEHICLE_IMAGE_REFERENCE_DIR`  | No                  | Optional directory containing the named per-vehicle reference files                  |
