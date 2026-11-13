import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { Readable } from 'node:stream';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import {
  canonicalVehicleIdentityKey,
  canonicalVehicleIdentityTuple,
  createVehicleImagePipeline,
} from './vehicle-image-pipeline.mjs';

const dirs = [];
const adminToken = 'local-admin-token-for-canonical-tests';
const requestToken = 'server-to-server-request-token-for-tests';
const byrHanIdentity = {
  makeId: 'byd', modelId: 'byd-han', modelYear: 2024,
  generationId: null, faceliftId: null, bodyType: null, trimId: null,
};
const bydHanDisplay = { manufacturer: 'BYD', model: 'Han' };

async function fixtureImage() {
  const raw = Buffer.alloc(320 * 160 * 4);
  for (let y = 24; y < 140; y += 1) {
    for (let x = 32; x < 288; x += 1) {
      const offset = (y * 320 + x) * 4;
      raw[offset] = 32;
      raw[offset + 1] = 96;
      raw[offset + 2] = 180;
      raw[offset + 3] = 255;
    }
  }
  return sharp(raw, { raw: { width: 320, height: 160, channels: 4 } }).png().toBuffer();
}

async function setup(options = {}) {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), 'vehicle-image-canonical-test-'));
  dirs.push(dataDir);
  const pipeline = createVehicleImagePipeline({
    dataDir, adminToken, requestToken, autoRun: false, retryDelayMs: 0,
    generationEnabled: options.generationEnabled ?? Boolean(options.provider), ...options,
    publicationEnabled: options.publicationEnabled ?? true,
  });
  await pipeline.initialize();
  return { pipeline, dataDir };
}

async function publishManualCandidate(pipeline, requestId) {
  const candidate = await pipeline.uploadCandidate(
    requestId,
    { contentType: 'image/png', bytes: await fixtureImage() },
    true,
  );
  await pipeline.decideCandidate(candidate.id, 'approve', true);
  return candidate;
}

function invokeServer(server, { method, url, token, body }) {
  return new Promise((resolve) => {
    const request = Readable.from(body === undefined ? [] : [Buffer.from(JSON.stringify(body))]);
    request.method = method;
    request.url = url;
    request.headers = token ? { authorization: `Bearer ${token}` } : {};
    const response = {
      writeHead(status, headers) {
        this.status = status;
        this.headers = headers;
      },
      end(raw) {
        resolve({ status: this.status, body: raw ? JSON.parse(raw) : null });
      },
    };
    server.emit('request', request, response);
  });
}

afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('canonical vehicle identity integration', () => {
  it('hashes the exact ordered tuple deterministically and rejects incomplete or extra identity data', () => {
    const tuple = ['mator-vehicle-image-v1', 'byd', 'byd-han', 2024, null, null, null, null];
    expect(canonicalVehicleIdentityTuple(byrHanIdentity)).toEqual(tuple);
    expect(canonicalVehicleIdentityKey(byrHanIdentity)).toBe(
      createHash('sha256').update(JSON.stringify(tuple)).digest('hex'),
    );
    expect(canonicalVehicleIdentityKey(byrHanIdentity)).toBe(canonicalVehicleIdentityKey({ ...byrHanIdentity }));
    expect(() => canonicalVehicleIdentityKey({ ...byrHanIdentity, trimId: undefined })).toThrow(/trimId/);
    expect(() => canonicalVehicleIdentityKey({ ...byrHanIdentity, vin: 'not-allowed' })).toThrow(/unsupported/);
    expect(() => canonicalVehicleIdentityKey({ ...byrHanIdentity, modelId: 'bad model id' })).toThrow(/canonical catalog ID/);
    expect(() => canonicalVehicleIdentityKey({ ...byrHanIdentity, modelYear: 2024.5 })).toThrow(/modelYear/);
  });

  it('coalesces concurrent canonical requests and reuses an approved asset immediately', async () => {
    const generate = vi.fn();
    const { pipeline } = await setup({ provider: { generate } });
    const request = { identity: byrHanIdentity, vehicle: bydHanDisplay };
    const [first, second, third] = await Promise.all([
      pipeline.submitCanonicalRequest(request),
      pipeline.submitCanonicalRequest(request),
      pipeline.submitCanonicalRequest(request),
    ]);
    expect(new Set([first.request.id, second.request.id, third.request.id]).size).toBe(1);
    expect(new Set([
      first.job?.id ?? first.activeJob?.id,
      second.job?.id ?? second.activeJob?.id,
      third.job?.id ?? third.activeJob?.id,
    ]).size).toBe(1);
    expect(pipeline.resolveCanonicalStatus(byrHanIdentity).status).toBe('queued');

    const candidate = await publishManualCandidate(pipeline, first.request.id);
    const reused = await pipeline.submitCanonicalRequest(request);
    expect(reused.reused).toBe(true);
    expect(reused.job).toBeNull();
    expect(reused.asset.version).toBe(1);
    expect(pipeline.resolveCanonicalStatus(byrHanIdentity)).toMatchObject({
      status: 'approved', asset: { version: 1 },
    });
    await expect(pipeline.readCandidate(candidate.id, true)).resolves.toMatchObject({ contentType: 'image/png' });
    expect(generate).not.toHaveBeenCalled();
  });

  it('authenticates internal request and resolve routes with the service token', async () => {
    const { pipeline, dataDir } = await setup();
    const server = pipeline.server();
    const body = { identity: byrHanIdentity, vehicle: bydHanDisplay };
    const denied = await invokeServer(server, {
      method: 'POST', url: '/internal/v1/vehicle-images/requests', token: 'wrong', body,
    });
    expect(denied.status).toBe(403);
    expect(pipeline.listPending(true)).toHaveLength(0);

    const accepted = await invokeServer(server, {
      method: 'POST', url: '/internal/v1/vehicle-images/requests', token: requestToken, body,
    });
    expect(accepted.status, JSON.stringify(accepted.body)).toBe(202);
    expect(accepted.body).toMatchObject({ identityKey: canonicalVehicleIdentityKey(byrHanIdentity), status: 'queued' });

    const resolved = await invokeServer(server, {
      method: 'POST', url: '/internal/v1/vehicle-images/resolve', token: requestToken,
      body: { identity: byrHanIdentity },
    });
    expect(resolved.status).toBe(200);
    expect(resolved.body).toMatchObject({ status: 'queued', requestId: accepted.body.requestId });
  });

  it('does not restart a failed canonical job unless an administrator regenerates it', async () => {
    const generate = vi.fn(async () => { throw new Error('provider unavailable'); });
    const { pipeline } = await setup({ provider: { generate }, maxAttempts: 1 });
    const first = await pipeline.submitCanonicalRequest({ identity: byrHanIdentity, vehicle: bydHanDisplay });
    await pipeline.runQueuedJobs();
    const duplicate = await pipeline.submitCanonicalRequest({ identity: byrHanIdentity, vehicle: bydHanDisplay });
    expect(duplicate.job).toBeNull();
    expect(duplicate.previousJob.status).toBe('failed');
    expect(pipeline.resolveCanonicalStatus(byrHanIdentity).status).toBe('failed');
    expect(generate).toHaveBeenCalledTimes(1);
    const retry = await pipeline.regenerateRequest(first.request.id, true);
    expect(retry.forceRegenerate).toBe(true);
    expect(retry.status).toBe('queued');
  });

  it('links a legacy text identity without replacing it and copies version history as canonical pointers', async () => {
    const { pipeline, dataDir } = await setup();
    const legacy = await pipeline.submitRequest({ make: 'BYD', model: 'Han', year: 2024 });
    const v1 = await publishManualCandidate(pipeline, legacy.request.id);
    const v2 = await publishManualCandidate(pipeline, legacy.request.id);
    const legacyBefore = pipeline.resolve(legacy.request.identityKey);
    expect(legacyBefore.version).toBe(2);

    const server = pipeline.server();
    const linkBody = {
      legacyIdentityKey: legacy.request.identityKey,
      identity: byrHanIdentity,
      vehicle: bydHanDisplay,
    };
    const denied = await invokeServer(server, {
      method: 'POST', url: '/admin/identity-links', token: requestToken, body: linkBody,
    });
    expect(denied.status).toBe(403);
    const linkResponse = await invokeServer(server, {
      method: 'POST', url: '/admin/identity-links', token: adminToken, body: linkBody,
    });
    expect(linkResponse.status).toBe(200);
    const link = linkResponse.body;
    expect(link.duplicate).toBe(false);
    expect(link.asset.version).toBe(2);
    expect(pipeline.resolve(legacy.request.identityKey)).toEqual(legacyBefore);
    expect(pipeline.resolveCanonicalStatus(byrHanIdentity)).toMatchObject({
      status: 'approved', asset: { version: 2 },
    });
    const reusedResponse = await invokeServer(server, {
      method: 'POST', url: '/internal/v1/vehicle-images/requests', token: requestToken,
      body: { identity: byrHanIdentity, vehicle: bydHanDisplay },
    });
    expect(reusedResponse.status).toBe(200);
    expect(reusedResponse.body).toMatchObject({
      status: 'approved', deduplicated: true, asset: { version: 2 },
    });

    const duplicateLink = await pipeline.linkLegacyIdentity({
      legacyIdentityKey: legacy.request.identityKey,
      identity: byrHanIdentity,
      vehicle: bydHanDisplay,
    }, true);
    expect(duplicateLink.duplicate).toBe(true);
    await pipeline.rollback(canonicalVehicleIdentityKey(byrHanIdentity), 1, true);
    expect(pipeline.resolveCanonicalStatus(byrHanIdentity).asset.version).toBe(1);

    const registry = JSON.parse(await readFile(path.join(dataDir, 'metadata.json'), 'utf8'));
    expect(registry.identityLinks).toHaveLength(1);
    expect(registry.requests.filter((item) => item.identityKey === legacy.request.identityKey)).toHaveLength(1);
    expect(registry.published.filter((item) => item.identityKey === legacy.request.identityKey)).toHaveLength(2);
    expect(registry.published.filter((item) => item.identityKey === canonicalVehicleIdentityKey(byrHanIdentity)))
      .toMatchObject([{ candidateId: v1.id, version: 1 }, { candidateId: v2.id, version: 2 }]);
    const restarted = createVehicleImagePipeline({ dataDir, adminToken, requestToken, autoRun: false });
    await restarted.initialize();
    expect(restarted.resolveCanonicalStatus(byrHanIdentity)).toMatchObject({
      status: 'approved', asset: { version: 1 },
    });
    expect(restarted.resolve(legacy.request.identityKey).version).toBe(2);
  });

  it('rejects a legacy link with mismatched display facts', async () => {
    const { pipeline } = await setup();
    const legacy = await pipeline.submitRequest({ make: 'BYD', model: 'Han', year: 2024 });
    await publishManualCandidate(pipeline, legacy.request.id);
    await expect(pipeline.linkLegacyIdentity({
      legacyIdentityKey: legacy.request.identityKey,
      identity: byrHanIdentity,
      vehicle: { manufacturer: 'BYD', model: 'Tang' },
    }, true)).rejects.toMatchObject({ status: 409 });
  });
});
