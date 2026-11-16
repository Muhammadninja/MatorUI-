import { afterEach, describe, expect, it, vi } from 'vitest';
import { copyFile, mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import {
  canonicalVehicleIdentityKey,
  createVehicleImagePipeline,
  registryHandshake,
  requestedContract,
} from './vehicle-image-pipeline.mjs';
import { createRepositoryArtworkProvider } from './vehicle-image-acquisition.mjs';
import { expectedRegistrySha256 } from './vehicle-image-env.mjs';
import { loadRegistryFile } from './vehicle-image-registry.mjs';
import sharp from 'sharp';

/**
 * Contract 2 as the Mator backend speaks it
 * (Backend src/garage/vehicle-images/vehicle-image.pipeline-client.ts):
 * `x-mator-vehicle-image-contract: 2`, Bearer request token, registry
 * handshake, and parseStatusResult's field rules.
 */
const servicesDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(servicesDir, '..');
const adminToken = 'local-admin-token-for-contract2-tests';
const requestToken = 'server-to-server-request-token-for-contract2-tests';
const REGISTRY_SHA = loadRegistryFile().sha256;
const OTHER_SHA = 'f'.repeat(64);
const V2 = { 'x-mator-vehicle-image-contract': '2' };
const BACKEND_STATUSES = [
  'not_found', 'pending', 'queued', 'running', 'awaiting_approval',
  'awaiting_source', 'failed', 'rejected', 'approved', 'needs_review',
];
const confirmation = { confirmed: true, reference: 'Compared with chevrolet.uz model page' };
const admin = { id: 'adm_1', email: 'owner@example.test', name: 'Owner' };
const dirs = [];
async function transparentFixture() {
  const subject = Buffer.alloc(800 * 450 * 4);
  for (let i = 0; i < subject.length; i += 4) subject.set([220, 40, 20, 255], i);
  return sharp({ create: { width: 1200, height: 800, channels: 4,
    background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: subject, raw: { width: 800, height: 450, channels: 4 }, left: 200, top: 320 }])
    .png().toBuffer();
}

const unverified = (modelId, modelYear, extra = {}) => ({
  makeId: 'chevrolet', modelId, modelYear, generationId: null, faceliftId: null,
  bodyType: null, trimId: null, identityStatus: 'unverified', ...extra,
});
const verified = (modelId, modelYear, extra = {}) => ({
  makeId: 'chevrolet', modelId, modelYear, generationId: null, faceliftId: null,
  bodyType: null, trimId: null, marketRegion: 'UZ', ...extra,
});

async function tempDir() {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'vehicle-image-contract2-'));
  dirs.push(dir);
  return dir;
}

async function setup(options = {}) {
  const dataDir = options.dataDir ?? await tempDir();
  const photoSegmenter = options.photoSegmenter ?? (options.photoProvider ? {
    ready: async () => true,
    removeBackground: transparentFixture,
  } : null);
  const pipeline = createVehicleImagePipeline({
    dataDir, adminToken, requestToken, autoRun: false, retryDelayMs: 0,
    artworkProvider: createRepositoryArtworkProvider({ rootDir: repoRoot }),
    publicationEnabled: true,
    assetStore: { publish: vi.fn(async ({ version, candidateId }) => ({ url: `https://cdn.example.test/${candidateId}/v${version}.webp`, key: candidateId })) },
    expectedRegistrySha256: REGISTRY_SHA,
    photoSegmenter,
    ...options,
  });
  await pipeline.initialize();
  return { pipeline, dataDir };
}

function commonsFixture(bytes) {
  const source = {
    provider: 'wikimedia-commons', license: 'CC-BY-4.0', licenseName: 'CC BY 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/', licenseEvidence: 'CC BY 4.0',
    sourcePage: 'https://commons.wikimedia.org/wiki/File:Chevrolet_Spark.jpg',
    sourceUrl: 'https://upload.wikimedia.org/test/chevrolet-spark.jpg',
    author: 'Test photographer', attribution: 'Test photographer / Commons',
  };
  return { id: 'wikimedia-commons', autoPublish: false,
    acquire: async () => [{ bytes, contentType: 'image/jpeg', source }] };
}
const rightsConfirmation = { confirmed: true, reference: 'Commons CC BY 4.0 license and attribution checked' };
const imageQualityConfirmation = { confirmed: true, reference: 'Cutout edges and car parts checked' };

function call(server, { method, url, token, body, headers = {} }) {
  return new Promise((resolve) => {
    const request = Readable.from(body === undefined ? [] : [Buffer.from(JSON.stringify(body))]);
    request.method = method;
    request.url = url;
    request.headers = { ...(token ? { authorization: `Bearer ${token}` } : {}), ...headers };
    const response = {
      writeHead(status) { this.status = status; },
      end(raw) { resolve({ status: this.status, body: raw ? JSON.parse(raw) : null }); },
    };
    server.emit('request', request, response);
  });
}

/** `token: null` sends no Authorization header (undefined would fall back to the default). */
const resolveCall = (server, identity, headers = V2, token = requestToken) =>
  call(server, { method: 'POST', url: '/internal/v1/vehicle-images/resolve', token, body: { identity }, headers });
const requestCall = (server, identity, vehicle, headers = V2, token = requestToken) =>
  call(server, { method: 'POST', url: '/internal/v1/vehicle-images/requests', token, body: { identity, vehicle }, headers });

/**
 * The backend's parseStatusResult acceptance rules, restated so a field the
 * backend would refuse fails here first.
 */
function expectBackendAccepts(body, identity) {
  expect(body.identityKey).toBe(canonicalVehicleIdentityKey(identity));
  expect(BACKEND_STATUSES).toContain(body.status);
  expect(body.registry).toEqual(expect.objectContaining({ sha256: REGISTRY_SHA }));
  expect(Object.hasOwn(body, 'requestId')).toBe(true);
  expect(body.requestId === null || (typeof body.requestId === 'string' && body.requestId.length <= 64)).toBe(true);
  expect(Object.hasOwn(body, 'subjectKey')).toBe(true);
  expect(body.subjectKey === null || (typeof body.subjectKey === 'string' && body.subjectKey.length <= 200)).toBe(true);
  expect(Object.hasOwn(body, 'asset')).toBe(true);
  if (body.status === 'approved') expect(body.asset).not.toBeNull();
  if (body.asset) {
    expect(Number.isInteger(body.asset.version) && body.asset.version >= 1).toBe(true);
    if (body.asset.identityConfirmed !== undefined) expect(typeof body.asset.identityConfirmed).toBe('boolean');
    if (body.asset.thumbnailUrl !== undefined) expect(body.asset.thumbnailUrl).toMatch(/^https:\/\//);
  }
  if (body.status === 'approved' && identity.identityStatus === 'unverified')
    expect(body.asset.identityConfirmed).toBe(true);
  // Nothing internal leaks: no filesystem paths, tokens or private candidate data.
  const text = JSON.stringify(body);
  expect(text).not.toMatch(/\/private\/|metadata\.json|\/var\/lib|\/tmp\//);
  expect(text).not.toContain(requestToken);
  expect(text).not.toContain(adminToken);
}

afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('readiness and the registry fingerprint', () => {
  it('is ready with contract 2, the capabilities and the configured registry fingerprint', async () => {
    const { pipeline } = await setup();
    const ready = await call(pipeline.server(), { method: 'GET', url: '/health/ready' });
    expect(ready.status).toBe(200);
    expect(ready.body).toEqual({
      status: 'ready',
      registry: expect.objectContaining({ sha256: REGISTRY_SHA, check: 'ok' }),
      contract: 2,
      supportedContracts: [2],
      capabilities: { artwork: true, wikimedia: false, backgroundRemoval: false, generation: false, publication: true },
    });
  });

  it.each([
    ['unconfigured', null],
    ['unconfigured', ''],
    ['invalid', 'not-a-sha'],
    ['invalid', 'a'.repeat(63)],
    ['mismatch', OTHER_SHA],
  ])('is not ready when the fingerprint is %s (%j), and serves nothing internal', async (check, expected) => {
    const { pipeline } = await setup({ expectedRegistrySha256: expected });
    const server = pipeline.server();
    const ready = await call(server, { method: 'GET', url: '/health/ready' });
    expect(ready.status).toBe(503);
    expect(ready.body.status).toBe(`registry_${check}`);
    expect(ready.body.registry.check).toBe(check);
    // The backend reads any non-200 readiness as "not ready".
    const live = await call(server, { method: 'GET', url: '/health/live' });
    expect(live).toEqual({ status: 200, body: { status: 'live' } });
    const resolved = await resolveCall(server, verified('nexia-3', 2019, { bodyType: 'sedan' }));
    expect(resolved.status).toBe(503);
    expect(resolved.body).toEqual({ error: `registry_${check}` });
  });

  it('reads the fingerprint setting strictly', () => {
    expect(expectedRegistrySha256(undefined)).toBeNull();
    expect(expectedRegistrySha256('  ')).toBeNull();
    expect(expectedRegistrySha256(` ${REGISTRY_SHA} `)).toBe(REGISTRY_SHA);
    expect(registryHandshake(REGISTRY_SHA, REGISTRY_SHA.toUpperCase())).toBe('ok');
    expect(registryHandshake(REGISTRY_SHA, undefined)).toBe('not_enforced');
  });
});

describe('contract header and authentication', () => {
  it('accepts contract 2 on both internal routes', async () => {
    const { pipeline } = await setup();
    const server = pipeline.server();
    const identity = verified('nexia-3', 2019, { bodyType: 'sedan' });
    expect((await resolveCall(server, identity)).status).toBe(200);
    expect((await requestCall(server, identity, { manufacturer: 'Chevrolet', model: 'Nexia', marketRegion: 'UZ' })).status).toBe(200);
  });

  it.each([
    ['contract_header_required', {}],
    ['contract_unsupported', { 'x-mator-vehicle-image-contract': '1' }],
    ['contract_unsupported', { 'x-mator-vehicle-image-contract': '3' }],
    ['contract_header_invalid', { 'x-mator-vehicle-image-contract': 'two' }],
    ['contract_header_invalid', { 'x-mator-vehicle-image-contract': '2.0' }],
  ])('refuses %s on both routes without touching state', async (code, headers) => {
    const { pipeline } = await setup();
    const server = pipeline.server();
    const identity = unverified('spark', 2019);
    const resolved = await resolveCall(server, identity, headers);
    const requested = await requestCall(server, identity, { manufacturer: 'Chevrolet', model: 'Spark' }, headers);
    for (const response of [resolved, requested]) {
      expect(response.status).toBe(428);
      expect(response.body).toEqual({ error: code, supportedContracts: [2] });
    }
    expect(pipeline.reviewQueue(true)).toHaveLength(0);
  });

  it('still requires the Bearer request token, checked before the contract', async () => {
    const { pipeline } = await setup();
    const server = pipeline.server();
    const identity = unverified('spark', 2019);
    for (const token of [null, 'wrong-token', adminToken]) {
      expect((await resolveCall(server, identity, V2, token)).status).toBe(403);
      expect((await requestCall(server, identity, { manufacturer: 'Chevrolet', model: 'Spark' }, V2, token)).status).toBe(403);
    }
    // No token and no header: authentication wins, nothing about the contract is revealed.
    expect(await resolveCall(server, identity, {}, null)).toEqual({ status: 403, body: { error: 'service authorization required' } });
    expect(pipeline.reviewQueue(true)).toHaveLength(0);
  });
});

describe('response fields', () => {
  it('resolve answers with every field the backend parses', async () => {
    const { pipeline } = await setup();
    const server = pipeline.server();
    const catalogIdentity = verified('nexia-3', 2019, { bodyType: 'sedan' });
    const catalog = await resolveCall(server, catalogIdentity);
    expectBackendAccepts(catalog.body, catalogIdentity);
    expect(catalog.body).toMatchObject({ status: 'approved', subjectKey: 'catalog:nexia-r3', requestId: null });
    expect(catalog.body.asset).toMatchObject({ version: 1, catalogAssetKey: expect.any(String) });

    const unknown = unverified('spark', 2019);
    const missing = await resolveCall(server, unknown);
    expectBackendAccepts(missing.body, unknown);
    expect(missing.body).toMatchObject({ status: 'not_found', requestId: null, subjectKey: null, asset: null });
  });

  it('request answers with every field the backend parses', async () => {
    const { pipeline } = await setup();
    const server = pipeline.server();
    const spark = unverified('spark', 2019);
    const accepted = await requestCall(server, spark, { manufacturer: 'Chevrolet', model: 'Spark' });
    expect(accepted.status).toBe(202);
    expectBackendAccepts(accepted.body, spark);
    expect(accepted.body.requestId).toEqual(expect.any(String));
    expect(accepted.body.subjectKey).toMatch(/^identity:/);
    expect(accepted.body.asset).toBeNull();
  });
});

describe('identity key', () => {
  // Golden keys computed by the backend's own canonicalIdentityKey
  // (Backend vehicle-image.identity.ts; the first five are also pinned in
  // vehicle-image.identity.spec.ts, the market one was computed from it on 2026-11-15).
  it.each([
    [{ makeId: 'byd', modelId: 'byd-han', modelYear: 2024, generationId: null, faceliftId: null, bodyType: null, trimId: null },
      'c35f59f25a1783cef099ae687bd3b067e2e7d3429679d27b508a3eb08ba36cdb'],
    [{ makeId: 'chevrolet', modelId: 'cobalt', modelYear: 2022, generationId: null, faceliftId: null, bodyType: 'sedan', trimId: 'cobalt-p4-ltz' },
      '43c116d7c2187bd37fee4f14f764c00e4e8b098bd791aa4e817199a9abed5f0f'],
    [{ makeId: 'chevrolet', modelId: 'genrta-lacetti', modelYear: 2015, generationId: null, faceliftId: null, bodyType: 'хэтчбек', trimId: null },
      'ee4397b81acdaeb00282ffb9373b1074c51b13e2c2cce29a3be02042a477a6ad'],
    [unverified('spark', 2019), 'c009a7ce3f192b1623a954df4062bbc675372b7970df57247ff0fc2a23616f70'],
    [unverified('malibu', 2021, { trimId: 'malibu-2-premier' }), '570f79326e211ed030082aec3ec341976150ce7eaf7991eb3f8a2ccbc7130620'],
    [verified('cobalt', 2022, { generationId: 'cobalt-gen2', bodyType: 'sedan' }),
      '26f06f3aab1af81560ec1a41101fb0d1c7d33a17381e46626dabc3e42f8ebbd2'],
  ])('matches the backend key for %j', async (identity, key) => {
    expect(canonicalVehicleIdentityKey(identity)).toBe(key);
    const { pipeline } = await setup();
    const answer = await resolveCall(pipeline.server(), identity);
    expect(answer.body.identityKey).toBe(key);
  });
});

describe('unverified identities', () => {
  async function sparkWithCandidate() {
    const bytes = await sharp({ create: { width: 800, height: 600, channels: 3, background: '#777' } }).jpeg().toBuffer();
    const { pipeline, dataDir } = await setup({ artworkProvider: null, photoProvider: commonsFixture(bytes) });
    const spark = unverified('spark', 2019);
    const accepted = await requestCall(pipeline.server(), spark, { manufacturer: 'Chevrolet', model: 'Spark' });
    await pipeline.runQueuedJobs();
    const queue = pipeline.reviewQueue(true).find((item) => item.identity.modelId === 'spark');
    return { pipeline, dataDir, spark, accepted, candidate: queue.candidates[0] };
  }

  it('accepts an unverified identity into reviewed acquisition', async () => {
    const { pipeline, spark, accepted, candidate } = await sparkWithCandidate();
    expect(accepted.status).toBe(202);
    expect(candidate).toBeTruthy();
    const status = await resolveCall(pipeline.server(), spark);
    expectBackendAccepts(status.body, spark);
    expect(status.body).toMatchObject({ status: 'awaiting_approval', asset: null });
  });

  it('never answers approved without an explicit human identity confirmation', async () => {
    const { pipeline, spark, candidate } = await sparkWithCandidate();
    // Approving the image alone is refused for an unverified identity.
    await expect(pipeline.decideCandidate(candidate.id, 'approve', true, { actor: admin }))
      .rejects.toMatchObject({ status: 409 });
    const after = await resolveCall(pipeline.server(), spark);
    expect(after.body.status).not.toBe('approved');
    expect(after.body.asset).toBeNull();
  });

  it('does not return an unconfirmed published image (legacy or shared data) as approved', async () => {
    const { pipeline, dataDir, spark, candidate } = await sparkWithCandidate();
    await pipeline.decideCandidate(candidate.id, 'approve', true, { actor: admin, identityConfirmation: confirmation, rightsConfirmation, imageQualityConfirmation });
    // Simulate a published record without a confirmation, as only older or
    // hand-edited data could hold, and restart from disk.
    const { readFile, writeFile } = await import('node:fs/promises');
    const file = path.join(dataDir, 'metadata.json');
    const db = JSON.parse(await readFile(file, 'utf8'));
    for (const item of db.published) { item.identityConfirmed = false; delete item.confirmation; }
    await writeFile(file, JSON.stringify(db));
    const restarted = createVehicleImagePipeline({ dataDir, adminToken, requestToken, expectedRegistrySha256: REGISTRY_SHA });
    await restarted.initialize();
    const status = await resolveCall(restarted.server(), spark);
    expectBackendAccepts(status.body, spark);
    expect(status.body).toMatchObject({ status: 'needs_review', asset: null });
  });

  it('answers approved with identityConfirmed true once a person confirmed the identity', async () => {
    const { pipeline, spark, candidate } = await sparkWithCandidate();
    await pipeline.decideCandidate(candidate.id, 'approve', true, { actor: admin, identityConfirmation: confirmation, rightsConfirmation, imageQualityConfirmation });
    const status = await resolveCall(pipeline.server(), spark);
    expectBackendAccepts(status.body, spark);
    expect(status.body).toMatchObject({
      status: 'approved',
      asset: { version: 1, identityConfirmed: true, url: expect.stringMatching(/^https:\/\//) },
    });
    const repeat = await requestCall(pipeline.server(), spark, { manufacturer: 'Chevrolet', model: 'Spark' });
    expect(repeat.status).toBe(200);
    expect(repeat.body).toMatchObject({ status: 'approved', deduplicated: true, asset: { identityConfirmed: true } });
  });
});

describe('persisted data and review', () => {
  it('reads metadata written by the pipeline build staging runs today (4b9f769)', async () => {
    const dataDir = await tempDir();
    await copyFile(path.join(servicesDir, 'vehicle-image-fixtures', 'metadata-4b9f769.json'), path.join(dataDir, 'metadata.json'));
    const { pipeline } = await setup({ dataDir });
    const server = pipeline.server();
    const han = { makeId: 'byd', modelId: 'byd-han', modelYear: 2024, generationId: null, faceliftId: null, bodyType: null, trimId: null };
    const approved = await resolveCall(server, han);
    expectBackendAccepts(approved.body, han);
    expect(approved.body).toMatchObject({
      status: 'approved', requestId: '2cb0261a-0e80-40bd-9c9a-ce3e29f49007',
      subjectKey: `identity:${canonicalVehicleIdentityKey(han)}`,
      asset: { version: 1, identityConfirmed: true, url: 'https://cdn.example.test/d8a38581-bfba-4d5d-b60c-cd89663bbe47/v1.webp' },
    });
    // A market-less legacy identity with an old queued job goes to identity review, it is not generated.
    const cobalt = { makeId: 'chevrolet', modelId: 'cobalt', modelYear: 2022, generationId: null, faceliftId: null, bodyType: 'sedan', trimId: 'cobalt-p4-ltz' };
    const review = await resolveCall(server, cobalt);
    expectBackendAccepts(review.body, cobalt);
    expect(review.body.status).toBe('needs_review');
    // The legacy free-form request is still resolvable by its text key.
    expect(pipeline.resolve({ make: 'Chevrolet', model: 'Nexia', year: 2016 })).toMatchObject({ version: 1 });
  });

  it('keeps approval and publication working through the admin routes', async () => {
    const bytes = await sharp({ create: { width: 800, height: 600, channels: 3, background: '#777' } }).jpeg().toBuffer();
    const { pipeline } = await setup({ artworkProvider: null, photoProvider: commonsFixture(bytes) });
    const server = pipeline.server();
    const spark = unverified('spark', 2019);
    await requestCall(server, spark, { manufacturer: 'Chevrolet', model: 'Spark' });
    await pipeline.runQueuedJobs();
    const candidate = pipeline.reviewQueue(true).find((item) => item.identity.modelId === 'spark').candidates[0];
    const url = `/admin/candidates/${candidate.id}/approve`;
    expect((await call(server, { method: 'POST', url, token: requestToken, body: { identityConfirmation: confirmation } })).status).toBe(403);
    expect((await call(server, { method: 'POST', url, token: adminToken, body: {} })).status).toBe(409);
    const approved = await call(server, { method: 'POST', url, token: adminToken, body: {
      identityConfirmation: confirmation, rightsConfirmation, imageQualityConfirmation, actor: admin,
    } });
    expect(approved.status, JSON.stringify(approved.body)).toBe(200);
    const status = await resolveCall(server, spark);
    expect(status.body).toMatchObject({ status: 'approved', asset: {
      identityConfirmed: true, license: 'CC-BY-4.0', attribution: 'Test photographer / Commons',
    } });
  });
});
