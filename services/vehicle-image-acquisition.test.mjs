import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import {
  canonicalVehicleIdentityKey,
  canonicalVehicleIdentityTuple,
  createVehicleImagePipeline,
} from './vehicle-image-pipeline.mjs';
import {
  artworkEntriesFor,
  createRepositoryArtworkProvider,
  publicationDecision,
} from './vehicle-image-acquisition.mjs';
import { artworkPath, loadRegistryFile, REGISTRY_FILE } from './vehicle-image-registry.mjs';
import { createLocalAssetStore } from './vehicle-image-local-store.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const adminToken = 'local-admin-token-for-acquisition-tests';
const requestToken = 'server-to-server-request-token-for-acquisition-tests';
const dirs = [];

const verified = (modelId, modelYear, extra = {}) => ({
  makeId: 'chevrolet', modelId, modelYear, generationId: null, faceliftId: null,
  bodyType: null, trimId: null, marketRegion: 'UZ', ...extra,
});
const unverified = (modelId, modelYear, extra = {}) => ({
  makeId: 'chevrolet', modelId, modelYear, generationId: null, faceliftId: null,
  bodyType: null, trimId: null, identityStatus: 'unverified', ...extra,
});
const display = (identity, model) => ({
  manufacturer: 'Chevrolet', model,
  ...(identity.trimId ? { trim: 'Premier' } : {}),
  ...(identity.marketRegion ? { marketRegion: identity.marketRegion } : {}),
});
const confirmation = { confirmed: true, reference: 'Compared with chevrolet.uz model page' };
const admin = { id: 'adm_1', email: 'owner@example.test', name: 'Owner' };

async function tempDir(prefix) {
  const dir = await mkdtemp(path.join(os.tmpdir(), prefix));
  dirs.push(dir);
  return dir;
}

async function setup(options = {}) {
  const dataDir = options.dataDir ?? await tempDir('vehicle-image-acquisition-');
  const pipeline = createVehicleImagePipeline({
    dataDir, adminToken, requestToken, autoRun: false, retryDelayMs: 0,
    artworkProvider: createRepositoryArtworkProvider({ rootDir: repoRoot }),
    publicationEnabled: true,
    assetStore: { publish: vi.fn(async ({ version, candidateId }) => ({ url: `https://cdn.example.test/${candidateId}/v${version}.webp`, key: candidateId })) },
    ...options,
  });
  await pipeline.initialize();
  return { pipeline, dataDir };
}

async function transparentPng({ width = 320, height = 160 } = {}) {
  const raw = Buffer.alloc(width * height * 4);
  for (let y = 20; y < height - 20; y += 1) {
    for (let x = 32; x < width - 32; x += 1) {
      const offset = (y * width + x) * 4;
      raw[offset] = 30;
      raw[offset + 1] = 90;
      raw[offset + 2] = 170;
      raw[offset + 3] = 255;
    }
  }
  return sharp(raw, { raw: { width, height, channels: 4 } }).png().toBuffer();
}

function call(server, { method, url, token, body, headers = {} }) {
  return new Promise((resolve) => {
    const request = Readable.from(body === undefined ? [] : [Buffer.from(JSON.stringify(body))]);
    request.method = method;
    request.url = url;
    request.headers = { ...(token ? { authorization: `Bearer ${token}` } : {}), ...headers };
    const response = {
      writeHead(status, responseHeaders) { this.status = status; this.headers = responseHeaders; },
      end(raw) {
        let parsed = raw;
        try { parsed = raw ? JSON.parse(raw) : null; } catch { /* binary */ }
        resolve({ status: this.status, headers: this.headers, body: parsed });
      },
    };
    server.emit('request', request, response);
  });
}
const v2 = { 'x-mator-vehicle-image-contract': '2' };

afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('identity contract: unverified identities', () => {
  it('hashes an unverified identity in its own namespace, never as a legacy or market identity', () => {
    const identity = unverified('spark', 2019);
    expect(canonicalVehicleIdentityTuple(identity)).toEqual([
      'mator-vehicle-image-unverified-v1', 'chevrolet', 'spark', 2019, null, null, null, null,
    ]);
    const { identityStatus, ...legacy } = identity;
    expect(identityStatus).toBe('unverified');
    expect(canonicalVehicleIdentityKey(identity)).not.toBe(canonicalVehicleIdentityKey(legacy));
    expect(canonicalVehicleIdentityKey(identity)).not.toBe(canonicalVehicleIdentityKey({ ...legacy, marketRegion: 'UZ' }));
    expect(() => canonicalVehicleIdentityKey({ ...identity, marketRegion: 'UZ' })).toThrow(/both/);
    expect(() => canonicalVehicleIdentityKey({ ...identity, identityStatus: 'verified' })).toThrow(/identityStatus/);
  });
});

describe('registry fingerprint handshake', () => {
  it('reports the SHA-256 of the registry bytes in readiness and contract-2 answers only', async () => {
    const { pipeline } = await setup();
    const sha = createHash('sha256').update(await readFile(REGISTRY_FILE)).digest('hex');
    expect(pipeline.registry.sha256).toBe(sha);
    expect(loadRegistryFile().sha256).toBe(sha);
    const server = pipeline.server();
    const ready = await call(server, { method: 'GET', url: '/health/ready' });
    expect(ready.body).toMatchObject({ status: 'ready', registry: { sha256: sha }, contract: 2 });
    const body = { identity: verified('nexia-3', 2019, { bodyType: 'sedan' }) };
    // A client without the contract header no longer gets a contract-1 answer.
    const legacy = await call(server, { method: 'POST', url: '/internal/v1/vehicle-images/resolve', token: requestToken, body });
    expect(legacy.status).toBe(428);
    expect(legacy.body.registry).toBeUndefined();
    const current = await call(server, { method: 'POST', url: '/internal/v1/vehicle-images/resolve', token: requestToken, body, headers: v2 });
    expect(current.body).toMatchObject({ status: 'approved', registry: { sha256: sha }, subjectKey: 'catalog:nexia-r3' });
  });
});

describe('repository artwork acquisition', () => {
  it('proposes the Nexia 2 artwork privately and shares one job across its years', async () => {
    const { pipeline } = await setup();
    const years = [2009, 2010, 2012, 2014, 2016];
    const results = await Promise.all(years.flatMap((year) => [1, 2].map(() => pipeline.submitCanonicalRequest({
      identity: verified('nexia-2', year, { bodyType: 'sedan' }),
      vehicle: { manufacturer: 'Chevrolet', model: 'Nexia 2', marketRegion: 'UZ' },
    }))));
    expect(new Set(results.map((result) => result.subjectKey))).toEqual(new Set(['catalog:nexia-n150']));
    expect(results.filter((result) => result.job)).toHaveLength(1);
    await pipeline.runQueuedJobs();
    const status = pipeline.resolveCanonicalStatus(verified('nexia-2', 2014, { bodyType: 'sedan' }), { contract: 2 });
    expect(status.status).toBe('awaiting_approval');
    const [entry] = pipeline.reviewQueue(true).filter((item) => item.subjectKey === 'catalog:nexia-n150');
    expect(entry.members).toHaveLength(years.length - 1);
    expect(entry.candidates).toHaveLength(1);
    expect(entry.candidates[0]).toMatchObject({
      source: 'repository-artwork', catalogAssetId: 'nexia-n150', basis: 'verified-mapping',
      license: 'owner-supplied', policy: { autoPublish: false },
    });
    expect(entry.candidates[0].policy.reasons).toContain('provider-requires-review');

    await expect(pipeline.decideCandidate(entry.candidates[0].id, 'approve', true, { actor: admin }))
      .rejects.toMatchObject({ status: 409 });
    for (const year of years) {
      expect(pipeline.resolveCanonicalStatus(verified('nexia-2', year, { bodyType: 'sedan' }), { contract: 2 }))
        .toMatchObject({ status: 'awaiting_approval' });
    }
    expect(pipeline.metrics(true).counters.requestsDeduplicated).toBeGreaterThan(0);
  });

  it('never proposes the Tracker 3 artwork for a Tracker 2, or defective artwork at all', async () => {
    const { pipeline } = await setup();
    for (const [modelId, year, model] of [['tracker-2', 2015, 'Tracker'], ['captiva', 2016, 'Captiva'], ['onix', 2021, 'Onix']]) {
      const identity = unverified(modelId, year);
      const result = await pipeline.submitCanonicalRequest({ identity, vehicle: display(identity, model) });
      expect(result.job).toBeNull();
      expect(pipeline.resolveCanonicalStatus(identity, { contract: 2 }).status).toBe('awaiting_source');
      expect(pipeline.resolveCanonicalStatus(identity).status).toBe('needs_review');
    }
    const tracker = unverified('tracker', 2021);
    await pipeline.submitCanonicalRequest({ identity: tracker, vehicle: display(tracker, 'Tracker') });
    await pipeline.runQueuedJobs();
    const queue = pipeline.reviewQueue(true);
    expect(queue.find((item) => item.identity.modelId === 'tracker').candidates[0].catalogAssetId).toBe('tracker-gen3');
    expect(queue.find((item) => item.identity.modelId === 'tracker-2').candidates).toHaveLength(0);
  });

  it('keeps Malibu 1 and Malibu 2 apart: only a Malibu 2 trim from 2020 gets the facelift artwork', async () => {
    const { pipeline } = await setup();
    const malibu1 = unverified('malibu', 2014, { trimId: 'malibu-1-lt' });
    const malibu2 = unverified('malibu', 2021, { trimId: 'malibu-2-premier' });
    const malibu2early = unverified('malibu', 2017, { trimId: 'malibu-2-lt' });
    const noTrim = unverified('malibu', 2021);
    for (const identity of [malibu1, malibu2, malibu2early, noTrim])
      await pipeline.submitCanonicalRequest({ identity, vehicle: display(identity, 'Malibu') });
    await pipeline.runQueuedJobs();
    const byYearTrim = (identity) => pipeline.resolveCanonicalStatus(identity, { contract: 2 }).status;
    expect(byYearTrim(malibu1)).toBe('awaiting_source');
    expect(byYearTrim(malibu2early)).toBe('awaiting_source');
    expect(byYearTrim(noTrim)).toBe('awaiting_source');
    expect(byYearTrim(malibu2)).toBe('awaiting_approval');
    const candidate = pipeline.reviewQueue(true).find((item) => item.identity.trimId === 'malibu-2-premier').candidates[0];
    expect(candidate).toMatchObject({ catalogAssetId: 'malibu-gen2-facelift', basis: 'hint', identityReviewRequired: true });
  });

  it('requires an identity confirmation before publishing for an unverified identity', async () => {
    const { pipeline } = await setup();
    const spark = unverified('spark', 2019);
    await pipeline.submitCanonicalRequest({ identity: spark, vehicle: display(spark, 'Spark') });
    await pipeline.runQueuedJobs();
    const [candidate] = pipeline.reviewQueue(true).find((item) => item.identity.modelId === 'spark').candidates;
    await expect(pipeline.decideCandidate(candidate.id, 'approve', true, { actor: admin }))
      .rejects.toMatchObject({ status: 409 });
    await expect(pipeline.decideCandidate(candidate.id, 'approve', true, { actor: admin, identityConfirmation: { confirmed: true, reference: 'x' } }))
      .rejects.toMatchObject({ status: 400 });
    await expect(pipeline.decideCandidate(candidate.id, 'approve', true, { actor: admin, identityConfirmation: confirmation }))
      .rejects.toMatchObject({ status: 409 });
    expect(pipeline.resolveCanonicalStatus(spark, { contract: 2 }).status).toBe('awaiting_approval');
  });

  it('applies an approved year scope to later identities without a new job', async () => {
    const { pipeline } = await setup();
    const first = unverified('tracker', 2021);
    await pipeline.submitCanonicalRequest({ identity: first, vehicle: display(first, 'Tracker') });
    const waiting = unverified('tracker', 2022);
    await pipeline.submitCanonicalRequest({ identity: waiting, vehicle: display(waiting, 'Tracker') });
    await pipeline.runQueuedJobs();
    const candidate = pipeline.reviewQueue(true).find((item) => item.identity.modelYear === 2021).candidates[0];
    await expect(pipeline.decideCandidate(candidate.id, 'approve', true, {
      actor: admin, identityConfirmation: confirmation, scope: { yearFrom: 2022, yearTo: 2024 },
    })).rejects.toMatchObject({ status: 400 });
    await expect(pipeline.decideCandidate(candidate.id, 'approve', true, {
      actor: admin, identityConfirmation: confirmation, scope: { yearFrom: 2020, yearTo: 2025 },
    })).rejects.toMatchObject({ status: 409 });
    expect(pipeline.resolveCanonicalStatus(waiting, { contract: 2 }).status).toBe('awaiting_approval');
    const later = unverified('tracker', 2024);
    const result = await pipeline.submitCanonicalRequest({ identity: later, vehicle: display(later, 'Tracker') });
    expect(result.reused).toBe(false);
    expect(pipeline.resolveCanonicalStatus(later, { contract: 2 }).subjectKey).toMatch(/^identity:/);
    const outside = unverified('tracker', 2026);
    const separate = await pipeline.submitCanonicalRequest({ identity: outside, vehicle: display(outside, 'Tracker') });
    expect(separate.subjectKey).toMatch(/^identity:/);
    const otherTrim = unverified('tracker', 2023, { trimId: 'tracker-3-premier' });
    const trimmed = await pipeline.submitCanonicalRequest({ identity: otherTrim, vehicle: display(otherTrim, 'Tracker') });
    expect(trimmed.subjectKey).toMatch(/^identity:/);
  });

  it('remembers a rejection: the same picture is never proposed or uploaded again for that subject', async () => {
    const { pipeline } = await setup();
    const orlando = unverified('orlando', 2015);
    const first = await pipeline.submitCanonicalRequest({ identity: orlando, vehicle: display(orlando, 'Orlando') });
    await pipeline.runQueuedJobs();
    const [candidate] = pipeline.reviewQueue(true)[0].candidates;
    await pipeline.decideCandidate(candidate.id, 'reject', true, { actor: admin, reason: 'wrong generation' });
    expect(pipeline.resolveCanonicalStatus(orlando, { contract: 2 }).status).toBe('rejected');
    await expect(pipeline.retryAcquisition(first.request.id, true, { actor: admin })).rejects.toMatchObject({ status: 409 });
    const again = await pipeline.submitCanonicalRequest({ identity: orlando, vehicle: display(orlando, 'Orlando') });
    expect(again.job).toBeNull();
    // The very bytes the reviewer rejected: re-uploading them for this vehicle is refused.
    const artwork = await createRepositoryArtworkProvider({ rootDir: repoRoot }).read({ storageRef: 'assets/vehicles/chevrolet/orlando/white.webp' });
    const processed = await (await import('./vehicle-image-processing.mjs')).processFramedArtwork(artwork.bytes);
    await expect(pipeline.uploadCandidate(first.request.id, { contentType: 'image/webp', bytes: processed.bytes }, true))
      .rejects.toMatchObject({ status: 409 });
    expect(pipeline.requestHistory(first.request.id, true).decisions[0]).toMatchObject({ action: 'reject', reason: 'wrong generation' });
  });

  it('re-runs an interrupted free artwork job after a restart but never an interrupted paid call', async () => {
    const dataDir = await tempDir('vehicle-image-artwork-restart-');
    const spark = unverified('spark', 2018);
    const nexia = verified('nexia-2', 2012, { bodyType: 'sedan' });
    const { pipeline } = await setup({ dataDir });
    const sparkRequest = await pipeline.submitCanonicalRequest({ identity: spark, vehicle: display(spark, 'Spark') });
    const nexiaRequest = await pipeline.submitCanonicalRequest({ identity: nexia, vehicle: { manufacturer: 'Chevrolet', model: 'Nexia 2', marketRegion: 'UZ' } });
    const stored = JSON.parse(await readFile(path.join(dataDir, 'metadata.json'), 'utf8'));
    const sparkJob = stored.jobs.find((job) => job.requestId === sparkRequest.request.id);
    sparkJob.status = 'running';
    sparkJob.phase = 'artwork';
    const nexiaJob = stored.jobs.find((job) => job.requestId === nexiaRequest.request.id);
    nexiaJob.status = 'running';
    nexiaJob.phase = 'generation';
    await writeFile(path.join(dataDir, 'metadata.json'), JSON.stringify(stored));
    const { pipeline: restarted } = await setup({ dataDir });
    expect(restarted.resolveCanonicalStatus(nexia, { contract: 2 }).status).toBe('failed');
    expect(restarted.resolveCanonicalStatus(spark, { contract: 2 }).status).toBe('queued');
    await restarted.runQueuedJobs();
    expect(restarted.resolveCanonicalStatus(spark, { contract: 2 }).status).toBe('awaiting_approval');
  });
});

describe('approval policy', () => {
  it('auto-publishes only a verified identity from a licensed auto-publish provider with passing checks', async () => {
    const licensed = { autoPublish: true, license: 'licensed-for-publication' };
    const quality = { integrity: 'pass', format: 'pass', clipping: 'edge-check-pass', identity: 'unverified-manual-review-required' };
    expect(publicationDecision({ identityVerified: true, provider: licensed, quality, publicationEnabled: true }))
      .toEqual({ autoPublish: true, reasons: [] });
    expect(publicationDecision({ identityVerified: false, provider: licensed, quality, publicationEnabled: true }).reasons)
      .toEqual(['identity-unverified']);
    expect(publicationDecision({ identityVerified: true, provider: { ...licensed, license: 'owner-supplied' }, quality, publicationEnabled: true }).reasons)
      .toEqual(['licence-requires-review']);
    expect(publicationDecision({ identityVerified: true, provider: licensed, quality: { ...quality, clipping: 'flagged' }, publicationEnabled: true }).reasons)
      .toEqual(['quality-requires-review']);
    expect(publicationDecision({ identityVerified: true, provider: licensed, quality, publicationEnabled: false }).reasons)
      .toEqual(['publication-disabled']);
  });

  it('never automatically publishes provider claims without verified provenance', async () => {
    const provider = {
      generate: vi.fn(async () => ({ bytes: await transparentPng({ width: 1400, height: 700 }), contentType: 'image/png', provider: 'licensed-test' })),
      autoPublish: true,
      license: 'licensed-for-publication',
    };
    const { pipeline } = await setup({ provider, generationEnabled: true, artworkProvider: null });
    const han = { makeId: 'byd', modelId: 'byd-han', modelYear: 2024, generationId: 'byd-han-gen1', faceliftId: null, bodyType: null, trimId: null, marketRegion: 'UZ' };
    await pipeline.submitCanonicalRequest({ identity: han, vehicle: { manufacturer: 'BYD', model: 'Han', generation: 'Han 1', marketRegion: 'UZ' } });
    await pipeline.runQueuedJobs();
    expect(pipeline.resolveCanonicalStatus(han, { contract: 2 }).status).toBe('awaiting_approval');
    expect(pipeline.requestHistory(pipeline.resolveCanonicalStatus(han).requestId, true).decisions).toEqual([]);
  });
});

describe('uploads and paths', () => {
  it('refuses unsafe uploads: wrong type, oversized, undecodable, opaque', async () => {
    const { pipeline } = await setup();
    const spark = unverified('spark', 2017);
    const { request } = await pipeline.submitCanonicalRequest({ identity: spark, vehicle: display(spark, 'Spark') });
    const png = await transparentPng();
    await expect(pipeline.uploadCandidate(request.id, { contentType: 'image/gif', bytes: png }, true)).rejects.toMatchObject({ status: 415 });
    await expect(pipeline.uploadCandidate(request.id, { contentType: 'image/jpeg', bytes: png }, true)).rejects.toMatchObject({ status: 415 });
    await expect(pipeline.uploadCandidate(request.id, { contentType: 'image/png', bytes: Buffer.alloc(9 * 1024 * 1024) }, true)).rejects.toMatchObject({ status: 413 });
    const corrupt = Buffer.concat([png.subarray(0, 64), Buffer.alloc(64)]);
    await expect(pipeline.uploadCandidate(request.id, { contentType: 'image/png', bytes: corrupt }, true)).rejects.toMatchObject({ status: 422 });
    const opaque = await sharp({ create: { width: 400, height: 200, channels: 3, background: '#fff' } }).png().toBuffer();
    await expect(pipeline.uploadCandidate(request.id, { contentType: 'image/png', bytes: opaque }, true)).rejects.toMatchObject({ status: 422 });
    await expect(pipeline.uploadCandidate(request.id, { contentType: 'image/png', bytes: png }, false)).rejects.toThrow(/administrator/);
    const accepted = await pipeline.uploadCandidate(request.id, { contentType: 'image/png', bytes: png, uploadedBy: admin }, true);
    expect(accepted).toMatchObject({ source: 'manual', uploadedBy: admin, quality: { transparency: 'pass' } });
  });

  it('reads artwork only from the artwork directories', async () => {
    expect(artworkPath(repoRoot, '../../etc/passwd')).toBeNull();
    expect(artworkPath(repoRoot, 'assets/vehicles/../../.env')).toBeNull();
    expect(artworkPath(repoRoot, '/etc/passwd')).toBeNull();
    expect(artworkPath(repoRoot, 'app.json')).toBeNull();
    expect(artworkPath(repoRoot, 'assets/vehicles/chevrolet/spark-m300/white.webp')).toBe(
      path.join(repoRoot, 'assets/vehicles/chevrolet/spark-m300/white.webp'));
    const provider = createRepositoryArtworkProvider({ rootDir: repoRoot });
    await expect(provider.read({ storageRef: 'assets/vehicles/../../package.json' })).rejects.toThrow(/outside/);
  });

  it('matches hints by model, years and trim prefix only', () => {
    const catalog = { assets: [{ id: 'x', makeId: 'chevrolet', storageRef: 'assets/vehicles/x.webp', modelMappings: [],
      identityVerified: false, approvalStatus: 'pending', candidateFor: [{ modelId: 'malibu', yearFrom: 2020, trimPrefixes: ['malibu-2-'] }] }] };
    const options = { effectiveStatus: (asset) => asset.approvalStatus, coversMapping: () => false };
    expect(artworkEntriesFor(catalog, unverified('malibu', 2021, { trimId: 'malibu-2-lt' }), options)).toHaveLength(1);
    expect(artworkEntriesFor(catalog, unverified('malibu', 2019, { trimId: 'malibu-2-lt' }), options)).toHaveLength(0);
    expect(artworkEntriesFor(catalog, unverified('malibu', 2021, { trimId: 'malibu-1-lt' }), options)).toHaveLength(0);
    expect(artworkEntriesFor(catalog, unverified('malibu', 2021), options)).toHaveLength(0);
    expect(artworkEntriesFor(catalog, { ...unverified('malibu', 2021, { trimId: 'malibu-2-lt' }), makeId: 'daewoo' }, options)).toHaveLength(0);
    // Hints never apply to a market-claiming identity: only verified mappings do.
    const { identityStatus, ...claimed } = unverified('malibu', 2021, { trimId: 'malibu-2-lt' });
    expect(identityStatus).toBe('unverified');
    expect(artworkEntriesFor(catalog, { ...claimed, marketRegion: 'UZ' }, options)).toHaveLength(0);
  });
});

describe('local asset store', () => {
  it('writes content-addressed immutable files with a thumbnail and serves only their names', async () => {
    const dir = await tempDir('vehicle-image-store-');
    const store = createLocalAssetStore({ dir, publicBaseUrl: 'https://images.example.test/assets' });
    expect(() => createLocalAssetStore({ dir, publicBaseUrl: 'http://images.example.test' })).toThrow(/https/);
    const bytes = await transparentPng({ width: 400, height: 200 });
    const first = await store.publish({ bytes, identityKey: 'k'.repeat(64), version: 1, candidateId: 'c1' });
    expect(first.url).toMatch(/^https:\/\/images\.example\.test\/assets\/[0-9a-f]{32}\/v1-[0-9a-f]{16}\.webp$/);
    expect(first.thumbnailUrl).toMatch(/-600\.webp$/);
    const retry = await store.publish({ bytes, identityKey: 'k'.repeat(64), version: 1, candidateId: 'c1' });
    expect(retry.url).toBe(first.url);
    const files = await readdir(path.join(dir, first.key.split('/')[0]));
    expect(files).toHaveLength(2);
    const served = await store.serve(first.key);
    expect((await sharp(served.bytes).metadata())).toMatchObject({ format: 'webp', width: 1200, height: 600 });
    expect(await store.serve('../../etc/passwd')).toBeNull();
    expect(await store.serve(`${first.key.split('/')[0]}/v1-${'0'.repeat(16)}.webp`)).toBeNull();
  });

  it('serves published files with immutable caching through the pipeline', async () => {
    const dir = await tempDir('vehicle-image-store-route-');
    const store = createLocalAssetStore({ dir, publicBaseUrl: 'https://images.example.test/assets' });
    const { pipeline } = await setup({ assetStore: store });
    const spark = unverified('spark', 2016);
    await pipeline.submitCanonicalRequest({ identity: spark, vehicle: display(spark, 'Spark') });
    await pipeline.runQueuedJobs();
    const [candidate] = pipeline.reviewQueue(true)[0].candidates;
    await expect(pipeline.decideCandidate(candidate.id, 'approve', true, { actor: admin, identityConfirmation: confirmation }))
      .rejects.toMatchObject({ status: 409 });
    expect(await call(pipeline.server(), { method: 'GET', url: '/assets/unknown.webp' })).toMatchObject({ status: 404 });
  });
});

describe('administration endpoints', () => {
  it('keeps the review queue, history, metrics and retry behind the admin token and records the actor', async () => {
    const { pipeline } = await setup();
    const server = pipeline.server();
    const spark = unverified('spark', 2015);
    await pipeline.submitCanonicalRequest({ identity: spark, vehicle: display(spark, 'Spark') });
    for (const url of ['/admin/review-queue', '/admin/metrics']) {
      expect((await call(server, { method: 'GET', url, token: requestToken })).status).toBe(403);
      expect((await call(server, { method: 'GET', url })).status).toBe(403);
    }
    await pipeline.runQueuedJobs();
    const queue = await call(server, { method: 'GET', url: '/admin/review-queue', token: adminToken });
    const [entry] = queue.body;
    expect(entry).toMatchObject({ verification: 'unverified', status: 'awaiting_approval' });
    const denied = await call(server, { method: 'POST', url: `/admin/candidates/${entry.candidates[0].id}/approve`, token: requestToken, body: {} });
    expect(denied.status).toBe(403);
    const rejected = await call(server, {
      method: 'POST', url: `/admin/candidates/${entry.candidates[0].id}/reject`, token: adminToken,
      body: { actor: admin, reason: 'roof rails differ' },
    });
    expect(rejected.status).toBe(200);
    const history = await call(server, { method: 'GET', url: `/admin/requests/${entry.requestId}/history`, token: adminToken });
    expect(history.body.decisions[0]).toMatchObject({ action: 'reject', actor: admin, reason: 'roof rails differ' });
    const metrics = await call(server, { method: 'GET', url: '/admin/metrics', token: adminToken });
    expect(metrics.body).toMatchObject({ capabilities: { artwork: true }, counters: { rejections: 1 } });
    expect(JSON.stringify(metrics.body)).not.toContain(adminToken);
  });
});
