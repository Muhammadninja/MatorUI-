import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createVehicleImagePipeline, vehicleIdentityKey } from './vehicle-image-pipeline.mjs';

const dirs = [];
const token = 'local-admin-token-for-tests';
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a2ioAAAAASUVORK5CYII=',
  'base64',
);
async function setup() {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), 'vehicle-image-pipeline-test-'));
  dirs.push(dataDir);
  const pipeline = createVehicleImagePipeline({ dataDir, adminToken: token });
  await pipeline.initialize();
  return { pipeline, dataDir };
}
afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('vehicle image pipeline', () => {
  it('deduplicates equivalent vehicle identities and persists the queue', async () => {
    const { pipeline, dataDir } = await setup();
    const a = await pipeline.submitRequest({ make: 'Genesis', model: 'GV80', year: 2025 });
    const b = await pipeline.submitRequest({ make: ' genesis ', model: 'gv80', year: 2025 });
    expect(a.duplicate).toBe(false);
    expect(b.duplicate).toBe(true);
    expect(b.request.id).toBe(a.request.id);
    expect(pipeline.listPending(true)).toHaveLength(1);
    const restarted = createVehicleImagePipeline({ dataDir, adminToken: token });
    await restarted.initialize();
    expect(restarted.listPending(true)).toHaveLength(1);
  });

  it('keeps uploaded bytes private until admin approval and publishes a versioned URL', async () => {
    const { pipeline } = await setup();
    const { request } = await pipeline.submitRequest({
      make: 'Genesis',
      model: 'GV80',
      year: 2025,
    });
    await expect(
      pipeline.uploadCandidate(request.id, { contentType: 'image/png', bytes: png }, false),
    ).rejects.toThrow('administrator authorization required');
    expect(() => pipeline.listPending(false)).toThrow('administrator authorization required');
    const candidate = await pipeline.uploadCandidate(
      request.id,
      { contentType: 'image/png', bytes: png },
      true,
    );
    expect(await pipeline.readPublished(request.identityKey, 1)).toBeNull();
    expect(pipeline.resolve(request.identityKey)).toBeNull();
    await pipeline.decideCandidate(candidate.id, 'approve', true);
    expect(pipeline.resolve(request.identityKey)).toEqual({
      identityKey: request.identityKey,
      version: 1,
      url: `/published/${encodeURIComponent(request.identityKey)}/v1`,
    });
    expect((await pipeline.readPublished(request.identityKey, 1)).bytes).toEqual(png);
  });

  it('supports generation and body style in identity and can roll back versions', async () => {
    const { pipeline } = await setup();
    const vehicle = {
      make: 'Genesis',
      model: 'GV80',
      year: 2025,
      generation: 'JX1',
      bodyStyle: 'SUV',
    };
    expect(vehicleIdentityKey(vehicle)).not.toBe(
      vehicleIdentityKey({ ...vehicle, generation: 'JX2' }),
    );
    const { request } = await pipeline.submitRequest(vehicle);
    const first = await pipeline.uploadCandidate(
      request.id,
      { contentType: 'image/png', bytes: png },
      true,
    );
    await pipeline.decideCandidate(first.id, 'approve', true);
    const second = await pipeline.uploadCandidate(
      request.id,
      { contentType: 'image/png', bytes: png },
      true,
    );
    await pipeline.decideCandidate(second.id, 'approve', true);
    await pipeline.rollback(request.identityKey, 1, true);
    expect(pipeline.resolve(request.identityKey).version).toBe(1);
  });

  it('serves an inaccessible URL before approval and leaves Lexus pending', async () => {
    const { pipeline } = await setup();
    const genesis = await pipeline.submitRequest({ make: 'Genesis', model: 'GV80', year: 2025 });
    const lexus = await pipeline.submitRequest({ make: 'Lexus', model: 'TX', year: 2024 });
    const server = pipeline.server();
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    try {
      const base = `http://127.0.0.1:${server.address().port}`;
      const url = `${base}/published/${encodeURIComponent(genesis.request.identityKey)}/v1`;
      expect((await fetch(url)).status).toBe(404);
      const unauthorized = await fetch(`${base}/admin/requests`);
      expect(unauthorized.status).toBe(403);
      const candidate = await pipeline.uploadCandidate(
        genesis.request.id,
        { contentType: 'image/png', bytes: png },
        true,
      );
      await pipeline.decideCandidate(candidate.id, 'approve', true);
      expect((await fetch(url)).status).toBe(200);
      expect(pipeline.listPending(true).map((item) => item.id)).toEqual([lexus.request.id]);
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  it('rejects image type spoofing and rejects candidates without admin authorization', async () => {
    const { pipeline } = await setup();
    const { request } = await pipeline.submitRequest({ make: 'Lexus', model: 'TX', year: 2024 });
    await expect(
      pipeline.uploadCandidate(
        request.id,
        { contentType: 'image/png', bytes: Buffer.from('not an image') },
        true,
      ),
    ).rejects.toThrow('image content does not match');
  });
});
