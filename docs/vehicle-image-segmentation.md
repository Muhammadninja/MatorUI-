# Vehicle image segmentation operations

Wikimedia photographs are never sent to review as opaque catalog images. The
Pipeline sends each licensed source photo to a private Unix socket served by
`vehicle-image-segmenter.service`. The worker runs the U2Net model through
`rembg` and ONNX Runtime on CPU, validates a transparent PNG result, and returns
it to the Pipeline for bounded framing as transparent WebP. If the service is
not ready, acquisition retries and Pipeline readiness is false; it does not
fall back to the street photograph.

## Runtime contract

- Python 3.12 virtual environment: `/opt/mator/vehicle-image-segmenter/venv`
- Pinned dependencies: `services/vehicle-image-segmenter/requirements.txt`
- Model: `u2net`, CPU provider, Apache-2.0 weights from [U-2-Net](https://github.com/xuebinqin/U-2-Net)
- Library: `rembg` (MIT); dependency and model notices must remain available
- Private socket: `/run/mator-vehicle-image-segmenter/api.sock`
- Private model directory: `/var/lib/mator-vehicle-image-segmenter`
- One inference at a time; 8 MB source limit; 20 MP source limit; 120-second client timeout; low-confidence matte values below 192/255 are discarded and the result is rechecked for clipping and coverage
- systemd bounds: 1.5 GiB memory, 512 MiB swap, 150% CPU, 32 tasks
- The model must be downloaded into `U2NET_HOME` before service startup. The
  systemd service has no outbound network access and listens only on its Unix socket.
  Keep rembg's model checksum verification enabled (`MODEL_CHECKSUM_DISABLED` unset).

Install the Python 3.12 venv OS component if absent, then create the venv and
install the pinned requirements in the dedicated application directory. Run
`new_session("u2net", providers=["CPUExecutionProvider"])` once with
`REMBG_HOME=/var/lib/mator-vehicle-image-segmenter` before enabling the unit.
This prefetch uses rembg's standard checksum verification. Start the service and require
`GET /health/ready` over the Unix socket before enabling Wikimedia acquisition.

## Image and rights handling

The source photo and its Commons metadata remain in private candidate storage.
Only the transformed, quality-checked transparent output is eligible for
publication. Admin shows the processed result on white and provides a private
original-image comparison. Attribution, source page, license identifier, URL,
and license evidence remain attached to the candidate and published mapping.
CC BY-SA derivatives retain their attribution and share-alike obligations.

Manual uploads and repository artwork are rights-pending. A filename, upload,
or free-text claim is not evidence. Until the server has a verified rights
record for Mator-owned or supplier-licensed images, only Commons records that
pass the explicit commercial-license contract can pass the current publication
gate. Never enable unrestricted publication to work around a missing record.

## Health and rollback

Check `systemctl is-active vehicle-image-segmenter`, the private socket health
endpoint, Pipeline `/health/ready` (`capabilities.backgroundRemoval` must be
true), and `systemctl show ... -p MemoryPeakUSec -p CPUUsageNSec` after a sample
inference. A missing socket, model, invalid alpha mask, clipped subject, or
timeout keeps the candidate out of review and retries within the existing job
policy. Roll back the Pipeline release and disable the new unit together if
health regresses; publication remains disabled during rollout verification.
