import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
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
  generationId: 'byd-han-gen1', faceliftId: null, bodyType: null, trimId: null,
  marketRegion: 'UZ',
};
const bydHanDisplay = { manufacturer: 'BYD', model: 'Han', generation: 'Han generation 1', marketRegion: 'UZ' };

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
  await pipeline.decideCandidate(candidate.id, 'approve', true, {
    rightsConfirmation: { confirmed: true, reference: 'Owner-supplied image, rights checked' },
  });
  return candidate;
}

/** Internal routes get the backend's contract header unless a test passes `contract: null`. */
function invokeServer(server, { method, url, token, body, contract = url.startsWith('/internal/') ? '2' : null }) {
  return new Promise((resolve) => {
    const request = Readable.from(body === undefined ? [] : [Buffer.from(JSON.stringify(body))]);
    request.method = method;
    request.url = url;
    request.headers = {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(contract != null ? { 'x-mator-vehicle-image-contract': contract } : {}),
    };
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
    const tuple = ['mator-vehicle-image-v2', 'byd', 'byd-han', 2024, 'byd-han-gen1', null, null, null, 'UZ'];
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

  it('reuses approved catalog identities before creating generation work and rejects market mismatches', async () => {
    const generate = vi.fn();
    const { pipeline } = await setup({ provider: { generate } });
    const cobalt = {
      makeId: 'chevrolet', modelId: 'cobalt', modelYear: 2020,
      generationId: null, faceliftId: null, bodyType: 'sedan', trimId: null,
      marketRegion: 'UZ',
    };
    const reused = await pipeline.submitCanonicalRequest({
      identity: cobalt,
      vehicle: { manufacturer: 'Chevrolet', model: 'Cobalt', marketRegion: 'UZ' },
    });
    expect(reused).toMatchObject({ reused: true, job: null, asset: { catalogAssetKey: 'cobalt-gen2', url: null } });
    expect(pipeline.resolveCanonicalStatus(cobalt)).toMatchObject({ status: 'approved', asset: { catalogAssetKey: 'cobalt-gen2' } });

    const wrongMarket = { ...cobalt, marketRegion: 'US' };
    const missing = await pipeline.submitCanonicalRequest({
      identity: wrongMarket,
      vehicle: { manufacturer: 'Chevrolet', model: 'Cobalt', marketRegion: 'US' },
    });
    expect(missing.job).toBeNull();
    expect(pipeline.resolveCanonicalStatus(wrongMarket).status).toBe('needs_review');
    expect(generate).not.toHaveBeenCalled();
  });

  it('keeps the Spark candidate pending and never queues it when catalog identity is uncertain', async () => {
    const generate = vi.fn();
    const { pipeline, dataDir } = await setup({ provider: { generate } });
    const spark = {
      makeId: 'chevrolet', modelId: 'spark', modelYear: 2020,
      generationId: null, faceliftId: null, bodyType: 'hatchback', trimId: null,
      marketRegion: 'UZ',
    };
    const result = await pipeline.submitCanonicalRequest({
      identity: spark,
      vehicle: { manufacturer: 'Chevrolet', model: 'Spark', marketRegion: 'UZ' },
    });
    expect(result.job).toBeNull();
    expect(pipeline.resolveCanonicalStatus(spark).status).toBe('needs_review');
    await pipeline.runQueuedJobs();
    const restarted = createVehicleImagePipeline({
      dataDir, adminToken, requestToken, provider: { generate },
      generationEnabled: true, autoRun: false,
    });
    await restarted.initialize();
    expect(restarted.resolveCanonicalStatus(spark).status).toBe('needs_review');
    await restarted.runQueuedJobs();
    expect(generate).not.toHaveBeenCalled();
  });

  it('quarantines previously queued market-ambiguous canonical jobs on restart', async () => {
    const dataDir = await mkdtemp(path.join(os.tmpdir(), 'vehicle-image-legacy-queue-'));
    dirs.push(dataDir);
    const legacyIdentity = {
      makeId: 'chevrolet', modelId: 'spark', modelYear: 2020,
      generationId: null, faceliftId: null, bodyType: 'hatchback', trimId: null,
    };
    const identityKey = canonicalVehicleIdentityKey(legacyIdentity);
    const requestId = 'legacy-request';
    await writeFile(path.join(dataDir, 'metadata.json'), JSON.stringify({
      requests: [{
        id: requestId, vehicle: { manufacturer: 'Chevrolet', model: 'Spark', year: 2020 },
        canonicalIdentity: legacyIdentity, identityKey, status: 'pending', createdAt: new Date().toISOString(),
      }],
      candidates: [], published: [],
      jobs: [{ id: 'legacy-job', requestId, identityKey, status: 'queued', attempts: 0, maxAttempts: 3 }],
      identityLinks: [],
    }));
    const generate = vi.fn();
    const pipeline = createVehicleImagePipeline({
      dataDir, adminToken, requestToken, provider: { generate },
      generationEnabled: true, autoRun: true,
    });
    await pipeline.initialize();
    expect(pipeline.resolveCanonicalStatus(legacyIdentity).status).toBe('needs_review');
    expect(pipeline.listPending(true)[0].job.status).toBe('cancelled');
    await pipeline.runQueuedJobs();
    expect(generate).not.toHaveBeenCalled();
  });

  it('keeps Nexia 2 and Nexia 3 identities distinct while reusing only the approved Nexia 3 asset', async () => {
    const generate = vi.fn();
    const { pipeline } = await setup({ provider: { generate }, generationEnabled: false });
    const nexia2 = {
      makeId: 'chevrolet', modelId: 'nexia-2', modelYear: 2016,
      generationId: null, faceliftId: null, bodyType: 'sedan', trimId: null,
      marketRegion: 'UZ',
    };
    const nexia3 = { ...nexia2, modelId: 'nexia-3' };
    expect(canonicalVehicleIdentityKey(nexia2)).not.toBe(canonicalVehicleIdentityKey(nexia3));
    const n2 = await pipeline.submitCanonicalRequest({ identity: nexia2, vehicle: { manufacturer: 'Chevrolet', model: 'Nexia 2', marketRegion: 'UZ' } });
    const n3 = await pipeline.submitCanonicalRequest({ identity: nexia3, vehicle: { manufacturer: 'Chevrolet', model: 'Nexia 3', marketRegion: 'UZ' } });
    expect(n2.job).toBeNull();
    expect(pipeline.resolveCanonicalStatus(nexia2).status).toBe('needs_review');
    expect(n3).toMatchObject({ reused: true, job: null, asset: { catalogAssetKey: 'nexia-r3' } });
    await pipeline.runQueuedJobs();
    expect(generate).not.toHaveBeenCalled();
  });

  it('keeps pending catalog art private until an admin has both approval provenance and a deliverable asset', async () => {
    const { pipeline } = await setup();
    expect(() => pipeline.listCatalogAssets(false)).toThrow(/administrator authorization/);
    const before = pipeline.listCatalogAssets(true).find((asset) => asset.id === 'spark-m300');
    expect(before.approvalStatus).toBe('pending');
    await expect(pipeline.decideCatalogAsset('spark-m300', 'approve', 'owner approved', true))
      .rejects.toMatchObject({ status: 409 });
    expect(pipeline.listCatalogAssets(true).find((asset) => asset.id === 'spark-m300').approvalStatus)
      .toBe('pending');
  });

  it('removes a rejected catalog mapping from resolution and preserves the review decision after restart', async () => {
    const { pipeline, dataDir } = await setup();
    const cobalt = {
      makeId: 'chevrolet', modelId: 'cobalt', modelYear: 2020,
      generationId: null, faceliftId: null, bodyType: 'sedan', trimId: null,
      marketRegion: 'UZ',
    };
    await pipeline.decideCatalogAsset('cobalt-gen2', 'reject', 'owner review', true);
    expect(pipeline.resolveCanonicalStatus(cobalt).status).toBe('needs_review');
    const restarted = createVehicleImagePipeline({ dataDir, adminToken, requestToken });
    await restarted.initialize();
    expect(restarted.resolveCanonicalStatus(cobalt).status).toBe('needs_review');
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
    // Contract 2: a verified identity with no image source is awaiting a source, not in identity review.
    expect(accepted.body).toMatchObject({ identityKey: canonicalVehicleIdentityKey(byrHanIdentity), status: 'awaiting_source' });

    const resolved = await invokeServer(server, {
      method: 'POST', url: '/internal/v1/vehicle-images/resolve', token: requestToken,
      body: { identity: byrHanIdentity },
    });
    expect(resolved.status).toBe(200);
    expect(resolved.body).toMatchObject({ status: 'awaiting_source', requestId: accepted.body.requestId });
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
      vehicle: { manufacturer: 'BYD', model: 'Tang', generation: 'Han generation 1', marketRegion: 'UZ' },
    }, true)).rejects.toMatchObject({ status: 409 });
  });
});
