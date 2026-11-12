import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createVehicleImagePipeline } from '../services/vehicle-image-pipeline.mjs';

const token = process.env.VEHICLE_IMAGE_ADMIN_TOKEN;
if (!token || token.length < 16) {
  console.error('Set VEHICLE_IMAGE_ADMIN_TOKEN to a value of at least 16 characters.');
  process.exit(1);
}
const dataDir =
  process.env.VEHICLE_IMAGE_DATA_DIR ??
  (await mkdtemp(path.join(os.tmpdir(), 'mator-vehicle-images-')));
const temporary = !process.env.VEHICLE_IMAGE_DATA_DIR;
const pipeline = createVehicleImagePipeline({ dataDir, adminToken: token });
await pipeline.initialize();
const server = pipeline.server();
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const admin = { authorization: `Bearer ${token}` };
const request = async (vehicle) =>
  (
    await fetch(`${base}/requests`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ vehicle }),
    })
  ).json();
const genesis = await request({ make: 'Genesis', model: 'GV80', year: 2025 });
const lexus = await request({ make: 'Lexus', model: 'TX', year: 2024 });
const duplicate = await request({ make: ' genesis ', model: 'GV80', year: 2025 });
const queue = await (await fetch(`${base}/admin/requests`, { headers: admin })).json();
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a2ioAAAAASUVORK5CYII=',
  'base64',
);
const candidate = await (
  await fetch(`${base}/admin/requests/${genesis.request.id}/candidates`, {
    method: 'POST',
    headers: { ...admin, 'content-type': 'application/json' },
    body: JSON.stringify({ contentType: 'image/png', data: png.toString('base64') }),
  })
).json();
const privateUrl = `${base}/published/${encodeURIComponent(genesis.request.identityKey)}/v1`;
const before = await fetch(privateUrl);
const approval = await fetch(`${base}/admin/candidates/${candidate.id}/approve`, {
  method: 'POST',
  headers: admin,
});
const resolved = await (
  await fetch(`${base}/resolve?identityKey=${encodeURIComponent(genesis.request.identityKey)}`)
).json();
const published = await fetch(new URL(resolved.url, base));
const finalQueue = await (await fetch(`${base}/admin/requests`, { headers: admin })).json();

console.log(
  JSON.stringify(
    {
      dataDir,
      genesisQueued: queue.some((r) => r.id === genesis.request.id),
      lexusQueued: queue.some((r) => r.id === lexus.request.id),
      duplicateReusedRequest: duplicate.duplicate && duplicate.request.id === genesis.request.id,
      imageStatusBeforeApproval: before.status,
      approvalStatus: approval.status,
      resolvedUrl: resolved.url,
      imageStatusAfterApproval: published.status,
      lexusStillPending: finalQueue.some((r) => r.id === lexus.request.id),
    },
    null,
    2,
  ),
);
server.close();
if (temporary) await rm(dataDir, { recursive: true, force: true });
