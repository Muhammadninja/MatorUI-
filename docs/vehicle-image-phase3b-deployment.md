# Vehicle Image Pipeline — Phase 3B deployment preparation

Status: prepared locally; not deployed. This service is separate from the commerce backend and writes only to its own data directory and Cloudinary namespace.

## Hosting recommendation

Run `mator-vehicle-images` as one Node.js PM2 fork on the Ubuntu VPS already used by Mator. Bind it to `127.0.0.1:8047` and expose its API through the existing HTTPS reverse proxy after a separate deployment review. Use one process only: the pipeline's persistent JSON registry, write queue and generation deduplication are single-process. Do not use PM2 cluster mode or run multiple replicas.

Use the existing Cloudinary account for approved image delivery. It is already used by the Mator backend, supports signed server-side uploads, and provides HTTPS CDN URLs. Candidate files and request/job/version metadata stay private on a dedicated persistent volume. Upload only after admin approval. Store the Cloudinary URL and storage key against each immutable version; rollback changes the active version pointer and leaves previous URLs intact.

This avoids a new VM, database, queue, and object-storage service for the first low-volume deployment. The JSON registry is intentionally a one-writer store; it is not a multi-replica database. If the service later needs multiple instances, replace the registry with a dedicated pipeline database and a transactional uniqueness/locking mechanism before scaling.

## Storage and lifecycle

- Registry and private candidate/reference files: `/var/lib/mator-vehicle-images`, mode `0700`; metadata and asset files are created owner-only. Back up the complete directory with encryption and test restore before launch.
- Public approved objects: Cloudinary `mator/vehicle-images/<identity-hash>/v<version>-<candidate-id>`. The candidate ID scopes an upload retry to the same approved candidate; a retry can replace only that candidate's deterministic key. Different candidates and versions have different keys. The stored CDN URL is the resolver output. Upload signatures follow [Cloudinary's authentication signature specification](https://cloudinary.com/documentation/authentication_signatures).
- Requests, job attempts, approval decisions, candidate metadata and version history remain in `metadata.json`. The active version pointer provides rollback. Do not delete prior Cloudinary objects during rollback.
- Paid provider generation is OFF unless `VEHICLE_IMAGE_GENERATION_ENABLED=true` is explicitly set. The default is OFF; when OFF, the provider is not constructed, canonical verified requests resolve as `needs_review` (not `preparing`), and any legacy queued canonical jobs are cancelled at startup. Keep this setting false in production until a separate cost approval and operational review.
- `VEHICLE_IMAGE_MAX_PROVIDER_CALLS_PER_DAY` limits persisted provider call attempts per UTC day (default 25 in code; the deployment example sets 10). Retries count. This is a call-count ceiling, not a precise currency budget; configure provider-side spend limits as well. The ledger is in the pipeline metadata and must be included in backups.
- Publication is separately OFF unless `VEHICLE_IMAGE_PUBLICATION_ENABLED=true` is explicitly set. With it OFF, the Cloudinary adapter is not constructed, candidate approval is rejected, candidates remain private, and no `/published` asset is created; no Cloudinary credentials are required. Existing stored approved URLs continue to resolve. Enable publication only with separately scoped credentials and owner-approved quota.
- On restart, a job found in `running` is marked `failed` with `interrupted-provider-outcome-unknown`; it is not automatically retried because the provider may have completed a billable request before the process stopped. An administrator can inspect and explicitly regenerate.
- Health checks: `GET /health/live` and `GET /health/ready`. Readiness becomes true after the registry has loaded and persisted. PM2 restarts the process; monitor HTTP readiness and free disk space externally.
- The app process and its secret file must be readable only by a dedicated service account. The process binds loopback; terminate TLS at the existing reverse proxy. Admin endpoints and the legacy free-form `POST /requests` require the admin bearer token. Backend automation uses only the canonical `/internal/v1/vehicle-images/requests` and `/resolve` endpoints with the separate server-to-server bearer token. Enforce proxy-level rate limits before exposing either endpoint. The mobile app must never receive either token. Do not put `VEHICLE_IMAGE_ADMIN_TOKEN`, `VEHICLE_IMAGE_REQUEST_TOKEN`, OpenAI credentials, or Cloudinary API secret in Expo variables, app config, logs, or client uploads.

## BYD Han Published v1 migration

The local Phase 3A registry contains the approved BYD Han 2024 v1 asset. `scripts/vehicle-image-export-approved.mjs` locates it by its legacy text identity and copies only that approved WebP plus a metadata/checksum manifest into a private export directory. It refuses a missing/unapproved candidate, wrong dimensions/format, or an image without an alpha channel. It does not upload anything or alter the source registry.

Example, run on the machine that has the Phase 3A data directory:

```sh
umask 077
node scripts/vehicle-image-export-approved.mjs \
  --source-dir=/private/tmp/mator-vehicle-image-validation \
  --output-dir=/secure/path/byd-han-v1-export
```

Review the manifest SHA-256 and image. During the eventual deployment, import the image as a private candidate in a clean pipeline registry, then use the authenticated admin approval path. The cloud storage adapter publishes it as cloud v1 only when approved; verify the stored checksum and public URL before routing clients. Retain the local source and encrypted export until cloud v1 is verified. Never copy the whole local `metadata.json` into a cloud runtime: it includes private candidate/job state and may contain provider diagnostics.

The exporter checks WebP format, 1200×600 dimensions and alpha-channel presence. Alpha-channel presence alone does not prove transparent pixels; the recorded Phase 3A validation also inspected the alpha range. Recheck actual alpha values and visually review the exported file before migration.

## Mobile image delivery boundary

The current frontend reads the backend Garage `vehicle_image` field, displays only an approved HTTPS URL, and falls back to the existing approved bundled manifest or a placeholder. The Backend target commit includes this field and vehicle-image delivery/synchronization. Once the pipeline publishes an approved image and the backend syncs it to the Garage vehicle, refreshed Garage responses can display it without asking the user to add the vehicle again. Verify this end-to-end against the actually deployed app and backend versions before release; a locally compatible contract does not prove the production pair is deployed.

## Deployment contents and operations

- `services/vehicle-image-server.mjs`: standalone HTTP entry point, async worker, storage adapter and OpenAI adapter.
- `services/vehicle-image-cloudinary-store.mjs`: signed Cloudinary upload adapter; only called on admin approval.
- `services/vehicle-image-env.mjs`: owner-only environment-file loader, allowlisted server keys.
- `deploy/vehicle-images/ecosystem.config.cjs`: PM2 single-fork process definition.
- `deploy/vehicle-images/nginx-location.conf.example`: reverse-proxy location snippet for the existing HTTPS virtual host; it does not create a listener or server block.
- `deploy/vehicle-images/vehicle-images.env.example`: names only; install a populated file outside the repository as `/etc/mator/vehicle-images.env`, owned by the service account, mode `0600`. Generate distinct random admin and request tokens.
- `services/package.json` and lockfile: isolated runtime dependency manifest (`sharp` only). Install production runtime dependencies with `npm ci --prefix services --omit=dev`.

Example operational checks (after deployment only):

```sh
curl --fail http://127.0.0.1:8047/health/live
curl --fail http://127.0.0.1:8047/health/ready
pm2 status mator-vehicle-images
```

Do not expose port 8047 directly. Configure the existing reverse proxy and firewall, add a process/disk/health monitor, and verify encrypted backup restore. Admin authorization is bearer-token based; distribute a long random token through a secret manager or owner-only environment file and rotate it on suspected exposure.

## Estimated monthly costs

| Component | Estimate | Basis |
| --- | ---: | --- |
| Additional VPS | $0 | Reuse current VPS, assuming CPU, RAM, disk, and outbound bandwidth headroom. The current host/provider and its bill were not identified in the repo, so this is incremental cost, not the total VPS bill. |
| Cloudinary | $0 incremental while included quota remains; Free is $0 with 25 credits/month. | Storage, transformations, and image bandwidth all consume credits. Current account plan/usage must be checked before activation. |
| Cloudinary Plus, if quota/features require it | $99/month monthly, or $89/month billed annually | Published plan lists 225 credits/month. Do not upgrade without owner approval. |
| OpenAI generation | Variable; excluded | Per-image cost depends on actual selected model, quality, references, and provider pricing. No API calls or paid generation were made for this preparation. |
| Backups | Unknown / possibly $0 incremental | Store an encrypted copy in the existing backup destination if available. No new backup service is recommended until the VPS backup policy is confirmed. |

Cloudinary currently defines one credit as 1,000 transformations, 1 GB managed storage, or 1 GB image bandwidth; actual monthly use combines these resources. Estimate storage using the actual normalized file sizes and retained versions before activation. [Cloudinary pricing](https://cloudinary.com/pricing), [Cloudinary credit and billing definitions](https://cloudinary.com/documentation/billing_and_plans).

## Prerequisites and activation gates

1. Confirm VPS capacity, Node.js 20+, PM2 availability, persistent disk ownership, reverse proxy hostname/routing, firewall, backup destination, and a tested restore. The existing Mator deployment docs identify Ubuntu/PM2/Postgres but do not name the VPS vendor or its plan.
2. Confirm Cloudinary account owner, plan/quota, usage, upload API entitlement, delivery policy, and an isolated namespace. Provision a dedicated credential/account for the pipeline if the account supports suitable scopes; otherwise use a separate Cloudinary product environment/account. Do not copy the commerce backend's API secret.
3. Supply OpenAI key and a currently enabled model ID through the server-only secret file. Confirm spend limits and authorize paid work separately. No key is included in this repository.
4. Generate distinct random 32+ character admin and server-to-server request tokens; install all secrets outside Git with mode `0600`. Verify `.env` remains ignored and scan the deployment artifact for credentials.
5. Export and visually/checksum validate the existing BYD Han v1 asset. Provision a fresh service data directory, import it as a private candidate, then approve it through admin authorization. No local database or production data migration is required.
6. Confirm the deployed app/API pair matches the existing Garage `vehicle_image` contract so approved HTTPS URLs appear after backend synchronization without re-adding the vehicle.
7. Before public DNS/routing, review admin rate limits, request body limits, audit log retention, CORS policy, backup encryption, monitoring/alert ownership, rollback rehearsal, and a restore drill.

## Owner approval operation

The current owner workflow is a bearer-authenticated admin REST API (there is no web approval console). An owner/operator can list pending requests with `GET /admin/requests`, inspect a private candidate through `GET /admin/candidates/<candidate-id>/preview`, and decide using `POST /admin/candidates/<candidate-id>/approve` or `/reject`. Use a private API client and the owner-only admin token; never put the token in the mobile app or a shared URL. Approval stays blocked with HTTP 503 until publication is explicitly enabled and the Cloudinary adapter is configured. A candidate is not public before approval; rejection never registers it as an approved Garage image. Owner decisions are timestamped in the private registry, while the current single shared admin token does not provide per-person attribution; preserve access logs and tightly control token custody.

No deployment, Cloudinary upload, API generation, production modification, or database migration was performed.

## Encrypted registry backup and restore

Before first activation, provision an approved off-host backup destination and an encryption key held outside the VPS. Do not store the encryption key beside the archive or in the pipeline environment file. Stop here if either prerequisite is unavailable. The archive must include the full `/var/lib/mator-vehicle-images` tree, including `metadata.json` and private candidate files; preserve owner/mode on restore and do not edit registry JSON by hand.

Create an encrypted archive without writing a plaintext staging archive (GPG prompts for the passphrase):

```sh
tar -C /var/lib -czf - mator-vehicle-images \
  | gpg --symmetric --cipher-algo AES256 --output /approved/off-host/path/vehicle-images-YYYYMMDD.tar.gz.gpg
```

Verify the ciphertext can be decrypted and the archive is readable before activation:

```sh
gpg --decrypt /approved/off-host/path/vehicle-images-YYYYMMDD.tar.gz.gpg \
  | tar -tzf - >/dev/null
```

Rehearse a restore in a new isolated directory with restrictive permissions. GPG prompts for the key; do not put it on the command line:

```sh
install -d -m 0700 /var/tmp/mator-vehicle-images-restore-check
gpg --decrypt /approved/off-host/path/vehicle-images-YYYYMMDD.tar.gz.gpg \
  | tar -xzpf - -C /var/tmp/mator-vehicle-images-restore-check
test -s /var/tmp/mator-vehicle-images-restore-check/mator-vehicle-images/metadata.json
```

Compare the restored registry and candidate-file inventory with the source using a checksum manifest generated before backup and stored alongside the encrypted archive. Remove the isolated restore only after the comparison passes. For recovery, stop the one PM2 process, preserve the current data directory by renaming it, restore the archive to `/var/lib`, restore the dedicated service account ownership and `0700` directory permissions, verify the inventory, then start exactly one PM2 fork and check readiness. Keep the preserved directory until health and admin review are confirmed. Never run restore over the live directory or remove prior approved Cloudinary objects during registry rollback.

## Isolated VPS staging

Use `deploy/vehicle-images/ecosystem.staging.config.cjs` and `vehicle-images-staging.env.example` for the non-customer-facing staging process. It uses the distinct process name `mator-vehicle-images-staging`, one PM2 fork running as the dedicated `mator-vehicle-images-staging` OS account, loopback port `8048`, its own owner-only environment file, and an initially empty `/var/lib/mator-vehicle-images-staging` registry. Set `VEHICLE_IMAGE_ENVIRONMENT=staging` and `VEHICLE_IMAGE_CLOUDINARY_PUBLIC_ID_PREFIX=mator/vehicle-images-staging` in that file. Staging startup rejects any other prefix, including production vehicle and product-image namespaces. Do not configure the production backend to call this port, create a reverse-proxy route, import existing images, or add production Cloudinary/OpenAI credentials. Both generation and publication must remain false until a separately approved staging upload test. Candidate approval is refused while publication is disabled; no Cloudinary adapter is constructed.

For the staging Cloudinary upload test, use the existing Cloudinary credential names only in `/etc/mator/vehicle-images-staging.env` (owner-only mode `0600`): `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET`. Never put them in a shell command, app/client environment, repository, or logs. Keep publication disabled until the test is explicitly authorized. Before enabling it, identify a Chevrolet candidate whose identity and transparent preview have been reviewed and explicitly approved. The current checked-in Chevrolet asset matrix lists previews as pending approval or rejected, so it does not itself provide an approved fixture. Once both approvals exist, enable publication only for the staging process, approve that one candidate through the authenticated admin API, and verify its returned public ID starts with `mator/vehicle-images-staging/`. Then disable publication again. Do not use the production API or production prefix for this test.

Staging may contain only synthetic identities and test fixtures and is disposable. Before its first start, rehearse encrypted backup and isolated restore using a temporary synthetic directory. Keep the staging-only key at `/root/.config/mator/vehicle-images-staging-backup.key` (mode `0600`), separate from `/var/backups/mator-vehicle-images-staging` and from the service environment. Create the key once; preserve it for future restores and never regenerate it while archives exist. Encrypt the rehearsal archive with GPG AES-256, verify decryption and archive listing, restore into a new `0700` temp directory, and compare the restored file tree/checksums with the synthetic source before starting PM2. A same-host staging backup only protects against accidental staging-data loss; it is not a VPS disaster-recovery backup. Do not put customer records, customer images, or production assets into staging. If staging starts to hold anything non-disposable, stop and provision an approved off-host backup destination and external key custody before continuing.
