import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import sharp from 'sharp';
import { createVehicleImagePipeline, vehicleIdentityKey } from './vehicle-image-pipeline.mjs';
import { processGeneratedImage } from './vehicle-image-processing.mjs';
import { buildVehicleImagePrompt, OpenAIImageProvider } from './vehicle-image-provider.mjs';
import { createCloudinaryAssetStore } from './vehicle-image-cloudinary-store.mjs';
import {
  isVehicleImageGenerationEnabled,
  isVehicleImagePublicationEnabled,
} from './vehicle-image-env.mjs';

const dirs = [];
const token = 'local-admin-token-for-tests';
async function fixtureImage({ opaqueBackground = false, touchEdge = false } = {}) {
  const width = 320;
  const height = 160;
  const raw = Buffer.alloc(width * height * 4);
  if (opaqueBackground) raw.fill(255);
  const left = touchEdge ? 0 : 32;
  const top = touchEdge ? 0 : 20;
  for (let y = top; y < height - 20; y += 1) {
    for (let x = left; x < width - 32; x += 1) {
      const offset = (y * width + x) * 4;
      raw[offset] = 40;
      raw[offset + 1] = 100;
      raw[offset + 2] = 180;
      raw[offset + 3] = 255;
    }
  }
  return sharp(raw, { raw: { width, height, channels: 4 } })
    .png()
    .toBuffer();
}
async function setup(options = {}) {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), 'vehicle-image-pipeline-test-'));
  dirs.push(dataDir);
  const pipeline = createVehicleImagePipeline({
    dataDir,
    adminToken: token,
    retryDelayMs: 0,
    autoRun: false,
    generationEnabled: options.generationEnabled ?? Boolean(options.provider),
    publicationEnabled: options.publicationEnabled ?? true,
    ...options,
  });
  await pipeline.initialize();
  return { pipeline, dataDir };
}
function invokeServer(server, { method, url, token, body }) {
  return new Promise((resolve) => {
    const request = Readable.from(body ? [Buffer.from(JSON.stringify(body))] : []);
    request.method = method;
    request.url = url;
    request.headers = {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'content-type': 'application/json' } : {}),
    };
    const response = {
      writeHead(status) { this.status = status; },
      end(raw) { resolve({ status: this.status, body: raw ? JSON.parse(raw) : null }); },
    };
    server.emit('request', request, response);
  });
}
afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('vehicle image pipeline', () => {
  it('defaults paid generation to off and requires the exact explicit opt-in', () => {
    expect(isVehicleImageGenerationEnabled(undefined)).toBe(false);
    expect(isVehicleImageGenerationEnabled('false')).toBe(false);
    expect(isVehicleImageGenerationEnabled('TRUE')).toBe(false);
    expect(isVehicleImageGenerationEnabled('true')).toBe(true);
    expect(isVehicleImagePublicationEnabled(undefined)).toBe(false);
    expect(isVehicleImagePublicationEnabled('false')).toBe(false);
    expect(isVehicleImagePublicationEnabled('TRUE')).toBe(false);
    expect(isVehicleImagePublicationEnabled('true')).toBe(true);
  });

  it('refuses candidate approval and publication while publication is disabled', async () => {
    const publish = vi.fn();
    const { pipeline } = await setup({
      assetStore: { publish },
      publicationEnabled: false,
    });
    const result = await pipeline.submitRequest({ make: 'BYD', model: 'Han', year: 2024 });
    const candidate = await pipeline.uploadCandidate(
      result.request.id,
      { contentType: 'image/png', bytes: await fixtureImage() },
      true,
    );
    await expect(pipeline.decideCandidate(candidate.id, 'approve', true))
      .rejects.toMatchObject({ status: 503 });
    expect(publish).not.toHaveBeenCalled();
    expect(candidate.status).toBe('pending');
    expect(pipeline.resolve(result.request.identityKey)).toBeNull();
  });

  it('records canonical requests without provider calls, including admin processing and restart', async () => {
    const dataDir = await mkdtemp(path.join(os.tmpdir(), 'vehicle-image-disabled-generation-'));
    dirs.push(dataDir);
    const requestToken = 'server-to-server-request-token-for-disabled-generation-tests';
    const generate = vi.fn();
    const publish = vi.fn();
    const pipeline = createVehicleImagePipeline({
      dataDir,
      adminToken: token,
      requestToken,
      provider: { generate },
      assetStore: { publish },
      publicationEnabled: false,
    });
    await pipeline.initialize();
    const identity = {
      makeId: 'daewoo', modelId: 'nexia', modelYear: 2016,
      generationId: 'nexia-2', faceliftId: null, bodyType: null, trimId: null,
    };
    const vehicle = { manufacturer: 'Daewoo', model: 'Nexia', generation: 'Nexia 2' };
    const requestBody = { identity, vehicle };
    const first = await invokeServer(pipeline.server(), {
      method: 'POST', url: '/internal/v1/vehicle-images/requests',
      token: requestToken, body: requestBody,
    });
    expect(first.status, JSON.stringify(first.body)).toBe(202);
    expect(first.body.status).toBe('queued');
    const duplicate = await invokeServer(pipeline.server(), {
      method: 'POST', url: '/internal/v1/vehicle-images/requests',
      token: requestToken, body: requestBody,
    });
    expect(duplicate.status).toBe(202);
    expect(duplicate.body.deduplicated).toBe(true);

    const unauthorizedRequest = await invokeServer(pipeline.server(), {
      method: 'POST', url: '/internal/v1/vehicle-images/requests',
      body: requestBody,
    });
    expect(unauthorizedRequest.status).toBe(403);
    const unauthorizedAdmin = await invokeServer(pipeline.server(), {
      method: 'POST', url: '/admin/jobs/process',
    });
    expect(unauthorizedAdmin.status).toBe(403);

    const candidateUpload = await invokeServer(pipeline.server(), {
      method: 'POST',
      url: `/admin/requests/${encodeURIComponent(first.body.requestId)}/candidates`,
      token,
      body: {
        contentType: 'image/png',
        data: (await fixtureImage()).toString('base64'),
      },
    });
    expect(candidateUpload.status).toBe(201);
    const unauthorizedApproval = await invokeServer(pipeline.server(), {
      method: 'POST',
      url: `/admin/candidates/${encodeURIComponent(candidateUpload.body.id)}/approve`,
      token: requestToken,
    });
    expect(unauthorizedApproval.status).toBe(403);
    const disabledApproval = await invokeServer(pipeline.server(), {
      method: 'POST',
      url: `/admin/candidates/${encodeURIComponent(candidateUpload.body.id)}/approve`,
      token,
    });
    expect(disabledApproval.status).toBe(503);
    expect(publish).not.toHaveBeenCalled();

    const response = await invokeServer(pipeline.server(), {
      method: 'POST', url: '/admin/jobs/process', token: token,
    });
    expect(response.status).toBe(200);
    expect(generate).not.toHaveBeenCalled();

    const registryPath = path.join(dataDir, 'metadata.json');
    const registry = JSON.parse(await readFile(registryPath, 'utf8'));
    registry.jobs[0].status = 'failed';
    registry.jobs[0].completedAt = new Date().toISOString();
    await writeFile(registryPath, JSON.stringify(registry));

    const restartedProvider = { generate: vi.fn() };
    const restarted = createVehicleImagePipeline({
      dataDir,
      adminToken: token,
      requestToken,
      provider: restartedProvider,
    });
    await restarted.initialize();
    const regeneration = await invokeServer(restarted.server(), {
      method: 'POST',
      url: `/admin/requests/${encodeURIComponent(first.body.requestId)}/regenerate`,
      token,
    });
    expect(regeneration.status).toBe(202);
    const restartedProcess = await invokeServer(restarted.server(), {
      method: 'POST', url: '/admin/jobs/process', token,
    });
    expect(restartedProcess.status).toBe(200);
    await restarted.runQueuedJobs();
    expect(restarted.listPending(true)[0].job.status).toBe('queued');
    expect(restartedProvider.generate).not.toHaveBeenCalled();
  });

  it('reports health only after the persistent registry is initialized', async () => {
    const dataDir = await mkdtemp(path.join(os.tmpdir(), 'vehicle-image-health-'));
    dirs.push(dataDir);
    const pipeline = createVehicleImagePipeline({ dataDir, adminToken: token });
    expect(pipeline.health()).toEqual({ live: true, ready: false });
    await pipeline.initialize();
    expect(pipeline.health()).toEqual({ live: true, ready: true });
  });

  it('does not automatically repeat a provider call after an interrupted running job', async () => {
    const { pipeline, dataDir } = await setup();
    const { job } = await pipeline.submitRequest({ make: 'BYD', model: 'Han', year: 2024 });
    const registryPath = path.join(dataDir, 'metadata.json');
    const registry = JSON.parse(await readFile(registryPath, 'utf8'));
    const storedJob = registry.jobs.find((item) => item.id === job.id);
    storedJob.status = 'running';
    storedJob.attempts = 1;
    await writeFile(registryPath, JSON.stringify(registry));
    const restarted = createVehicleImagePipeline({ dataDir, adminToken: token,
      provider: { generate: vi.fn() }, autoRun: false });
    await restarted.initialize();
    expect(restarted.listPending(true)[0].job).toMatchObject({
      status: 'failed', lastError: 'interrupted-provider-outcome-unknown',
    });
    await restarted.runQueuedJobs();
    expect(restarted.listPending(true)[0].job.status).toBe('failed');
  });

  it('publishes approved WebP through the storage adapter and resolves its stable URL', async () => {
    const publish = vi.fn(async () => ({
      url: 'https://res.cloudinary.com/demo/image/upload/v123/mator/vehicle-images/hash/v1.webp',
      key: 'mator/vehicle-images/hash/v1',
    }));
    const { pipeline } = await setup({ assetStore: { publish } });
    const result = await pipeline.submitRequest({ make: 'BYD', model: 'Han', year: 2024 });
    const bytes = await fixtureImage();
    const candidate = await pipeline.uploadCandidate(result.request.id,
      { contentType: 'image/png', bytes }, true);
    expect(publish).not.toHaveBeenCalled();
    await pipeline.decideCandidate(candidate.id, 'approve', true);
    expect(publish).toHaveBeenCalledOnce();
    expect(pipeline.resolve(result.request.identityKey).url).toContain('https://res.cloudinary.com/');
  });

  it('uploads approved WebP with signed server credentials and validates the provider URL', async () => {
    let request;
    const store = createCloudinaryAssetStore({
      cloudName: 'demo', apiKey: 'server-key', apiSecret: 'server-secret',
      fetchImpl: vi.fn(async (url, options) => {
        request = { url, options };
        return { ok: true, json: async () => ({
          secure_url: 'https://res.cloudinary.com/demo/image/upload/v1/example.webp',
          public_id: options.body.get('public_id'),
        }) };
      }),
    });
    const result = await store.publish({
      bytes: await fixtureImage(), contentType: 'image/png', identityKey: 'byd|han|2024|||||',
      version: 1, candidateId: 'candidate',
    });
    expect(result.url).toMatch(/^https:\/\/res\.cloudinary\.com\//);
    expect(request.url).toBe('https://api.cloudinary.com/v1_1/demo/image/upload');
    expect(request.options.headers).toBeUndefined();
    expect(request.options.body.get('api_key')).toBe('server-key');
    expect(request.options.body.get('overwrite')).toBe('true');
    const signed = `overwrite=true&public_id=${request.options.body.get('public_id')}&timestamp=${request.options.body.get('timestamp')}server-secret`;
    expect(request.options.body.get('signature')).toBe(createHash('sha1').update(signed).digest('hex'));
  });

  it('deduplicates equivalent requests including manufacturer and expanded identity fields', async () => {
    const { pipeline, dataDir } = await setup();
    const vehicle = {
      manufacturer: 'Genesis',
      model: 'GV80',
      year: 2025,
      generation: 'JX1',
      facelift: '2025',
      bodyStyle: 'SUV',
      trim: 'Prestige',
    };
    const a = await pipeline.submitRequest(vehicle);
    const b = await pipeline.submitRequest({
      ...vehicle,
      manufacturer: ' genesis ',
      model: 'gv80',
    });
    expect(a.duplicate).toBe(false);
    expect(b.duplicate).toBe(true);
    expect(b.request.id).toBe(a.request.id);
    expect(pipeline.listPending(true)).toHaveLength(1);
    const white = await pipeline.submitRequest({ ...vehicle, exteriorColor: 'White' });
    expect(white.duplicate).toBe(false);
    expect(white.request.id).not.toBe(a.request.id);
    expect(pipeline.listPending(true)).toHaveLength(2);
    const restarted = createVehicleImagePipeline({ dataDir, adminToken: token });
    await restarted.initialize();
    expect(restarted.listPending(true)).toHaveLength(2);
    expect(vehicleIdentityKey(vehicle)).not.toBe(
      vehicleIdentityKey({ ...vehicle, facelift: '2024' }),
    );
  });

  it('reuses an approved asset without scheduling a generation job', async () => {
    const generate = vi.fn();
    const { pipeline } = await setup({ provider: { generate } });
    const vehicle = { make: 'Lexus', model: 'TX', year: 2024 };
    const { request } = await pipeline.submitRequest(vehicle);
    const image = await fixtureImage();
    const candidate = await pipeline.uploadCandidate(
      request.id,
      { contentType: 'image/png', bytes: image },
      true,
    );
    await pipeline.decideCandidate(candidate.id, 'approve', true);
    const duplicate = await pipeline.submitRequest(vehicle);
    expect(duplicate.reused).toBe(true);
    expect(duplicate.asset.version).toBe(1);
    expect(duplicate.job).toBeNull();
    expect(generate).not.toHaveBeenCalled();
  });

  it('generates asynchronously, normalizes to transparent 1200x600 WebP and awaits approval', async () => {
    const input = await fixtureImage();
    const generate = vi.fn(async () => ({ bytes: input, provider: 'test', model: 'mock-image' }));
    const { pipeline } = await setup({ provider: { generate }, autoRun: true });
    const result = await pipeline.submitRequest({ make: 'Genesis', model: 'GV80', year: 2025 });
    await pipeline.runQueuedJobs();
    expect(generate).toHaveBeenCalledTimes(1);
    expect(result.job.status).toBe('awaiting_approval');
    const row = pipeline.listPending(true)[0];
    const candidate = row.candidates[0];
    expect(candidate.source).toBe('generated');
    expect(candidate.identityReviewRequired).toBe(true);
    expect(candidate.quality).toMatchObject({
      integrity: 'pass',
      format: 'pass',
      dimensions: 'pass',
      transparency: 'pass',
      identity: 'unverified-manual-review-required',
    });
    expect(await pipeline.readPublished(result.request.identityKey, 1)).toBeNull();
    const duplicate = await pipeline.submitRequest({ make: 'Genesis', model: 'GV80', year: 2025 });
    expect(duplicate.job).toBeNull();
    expect(duplicate.activeJob.status).toBe('awaiting_approval');
    const preview = await pipeline.readCandidate(candidate.id, true);
    const meta = await sharp(preview.bytes).metadata();
    expect(meta).toMatchObject({ format: 'webp', width: 1200, height: 600, hasAlpha: true });
    await pipeline.decideCandidate(candidate.id, 'approve', true);
    expect(pipeline.resolve(result.request.identityKey).version).toBe(1);
  });

  it('coalesces concurrent equivalent requests into one generation job', async () => {
    const generate = vi.fn(async () => ({ bytes: await fixtureImage(), provider: 'test' }));
    const { pipeline } = await setup({ provider: { generate } });
    const [a, b, c] = await Promise.all([
      pipeline.submitRequest({ make: 'Genesis', model: 'GV80', year: 2025 }),
      pipeline.submitRequest({ make: ' genesis ', model: 'gv80', year: 2025 }),
      pipeline.submitRequest({ make: 'GENESIS', model: 'GV80', year: 2025 }),
    ]);
    await pipeline.runQueuedJobs();
    expect(new Set([a.request.id, b.request.id, c.request.id]).size).toBe(1);
    expect(
      new Set([
        a.job?.id ?? a.activeJob?.id,
        b.job?.id ?? b.activeJob?.id,
        c.job?.id ?? c.activeJob?.id,
      ]).size,
    ).toBe(1);
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it('retries provider timeouts up to the configured attempt limit', async () => {
    const generate = vi.fn(
      ({ signal }) =>
        new Promise((_, reject) =>
          signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true }),
        ),
    );
    const { pipeline } = await setup({ provider: { generate }, maxAttempts: 2, jobTimeoutMs: 5 });
    const { job } = await pipeline.submitRequest({ make: 'Lexus', model: 'TX', year: 2024 });
    await pipeline.runQueuedJobs();
    expect(generate).toHaveBeenCalledTimes(2);
    expect(job).toMatchObject({ status: 'failed', attempts: 2, lastError: 'provider timeout' });
  });

  it('records provider errors and exhausts bounded retries', async () => {
    const generate = vi.fn(async () => {
      throw new Error('private provider details');
    });
    const { pipeline } = await setup({ provider: { generate }, maxAttempts: 2 });
    const { job } = await pipeline.submitRequest({ make: 'Lexus', model: 'TX', year: 2024 });
    await pipeline.runQueuedJobs();
    expect(generate).toHaveBeenCalledTimes(2);
    expect(job).toMatchObject({ status: 'failed', attempts: 2, lastError: 'provider failure' });
    expect(JSON.stringify(job)).not.toContain('private provider details');
  });

  it('records a sanitized HTTP status and error code without persisting provider messages', async () => {
    const provider = new OpenAIImageProvider({
      apiKey: 'test-key-not-a-secret',
      fetchImpl: async () =>
        new Response(
          JSON.stringify({
            error: { code: 'invalid_api_key', message: 'sensitive provider body must not persist' },
          }),
          { status: 401, headers: { 'x-request-id': 'req_test-safe-id' } },
        ),
    });
    let failure;
    try {
      await provider.generate({ vehicle: { manufacturer: 'BYD', model: 'Han', year: 2024 } });
    } catch (error) {
      failure = error;
    }
    expect(failure).toMatchObject({
      providerHttpStatus: 401,
      providerErrorCode: 'invalid_api_key',
      providerRequestId: 'req_test-safe-id',
    });
    expect(failure.message).toBe('image provider returned HTTP 401');
    expect(JSON.stringify(failure)).not.toContain('sensitive provider body');
  });

  it('retains safe native fetch cause codes without retaining the transport message', async () => {
    const cause = Object.assign(new Error('socket path contained private material'), {
      code: 'ENOTFOUND',
      errno: -3008,
      syscall: 'getaddrinfo',
      hostname: 'api.openai.com',
    });
    const provider = new OpenAIImageProvider({
      apiKey: 'test-key-not-a-secret',
      fetchImpl: async () => {
        throw new TypeError('fetch failed', { cause });
      },
    });
    let failure;
    try {
      await provider.generate({ vehicle: { manufacturer: 'BYD', model: 'Han', year: 2024 } });
    } catch (error) {
      failure = error;
    }
    expect(failure.transportDiagnostics).toMatchObject({
      errorName: 'TypeError',
      causeName: 'Error',
      causeCode: 'ENOTFOUND',
      causeErrno: -3008,
      causeSyscall: 'getaddrinfo',
    });
    expect(failure.message).toBe('image provider request failed');
    expect(JSON.stringify(failure.transportDiagnostics)).not.toContain('private material');
    expect(JSON.stringify(failure.transportDiagnostics)).not.toContain('api.openai.com');
  });

  it('creates one fresh retry job after failure and does not reuse a failed job', async () => {
    const generate = vi
      .fn()
      .mockRejectedValueOnce(
        Object.assign(new Error('provider failure'), {
          providerHttpStatus: 503,
          providerErrorCode: 'server_error',
          transportDiagnostics: {
            errorName: 'TypeError',
            causeCode: 'ENOTFOUND',
            causeErrno: -3008,
            causeSyscall: 'getaddrinfo',
            rawMessage: 'must not persist',
          },
        }),
      )
      .mockImplementationOnce(async () => ({ bytes: await fixtureImage(), provider: 'test' }));
    const { pipeline } = await setup({ provider: { generate }, maxAttempts: 1 });
    const vehicle = { make: 'BYD', model: 'Han', year: 2024 };
    const first = await pipeline.submitRequest(vehicle);
    await pipeline.runQueuedJobs();
    expect(first.job).toMatchObject({
      status: 'failed',
      attempts: 1,
      providerHttpStatus: 503,
      providerErrorCode: 'server_error',
      transportDiagnostics: {
        errorName: 'TypeError',
        causeCode: 'ENOTFOUND',
        causeErrno: -3008,
        causeSyscall: 'getaddrinfo',
      },
    });
    expect(JSON.stringify(first.job.transportDiagnostics)).not.toContain('must not persist');

    const duplicate = await pipeline.submitRequest(vehicle);
    expect(duplicate.request.id).toBe(first.request.id);
    expect(duplicate.job).toBeNull();
    expect(duplicate.previousJob.id).toBe(first.job.id);
    expect(duplicate.previousJob.status).toBe('failed');
    const retry = await pipeline.regenerateRequest(first.request.id, true);
    expect(retry.id).not.toBe(first.job.id);
    expect(retry.status).toBe('queued');
    expect(pipeline.listPending(true)).toHaveLength(1);
    await pipeline.runQueuedJobs();
    expect(generate).toHaveBeenCalledTimes(2);
    expect(retry).toMatchObject({ status: 'awaiting_approval', attempts: 1 });
  });

  it('rejects invalid output and flags edge-clipped subject output', async () => {
    await expect(processGeneratedImage(Buffer.alloc(100, 1))).rejects.toThrow(
      'not a decodable raster',
    );
    await expect(
      processGeneratedImage(await fixtureImage({ opaqueBackground: true })),
    ).rejects.toThrow('not meaningfully transparent');
    await expect(processGeneratedImage(await fixtureImage({ touchEdge: true }))).rejects.toThrow(
      'possible vehicle clipping',
    );
  });

  it('fails a generation job when the provider returns corrupt image bytes', async () => {
    const generate = vi.fn(async () => ({ bytes: Buffer.alloc(120, 7), provider: 'test' }));
    const { pipeline } = await setup({ provider: { generate }, maxAttempts: 1 });
    const { job } = await pipeline.submitRequest({ make: 'Lexus', model: 'TX', year: 2024 });
    await pipeline.runQueuedJobs();
    expect(job).toMatchObject({ status: 'failed', attempts: 1 });
    expect(job.lastQualityFailure).toMatch(/decodable raster/);
    expect(pipeline.listPending(true)[0].candidates).toHaveLength(0);
  });

  it('keeps rejected candidates private and supports admin regeneration and approval', async () => {
    const generate = vi.fn(async () => ({ bytes: await fixtureImage(), provider: 'test' }));
    const { pipeline } = await setup({ provider: { generate } });
    const { request } = await pipeline.submitRequest({
      make: 'Genesis',
      model: 'GV80',
      year: 2025,
    });
    await pipeline.runQueuedJobs();
    const rejectedCandidate = pipeline.listPending(true)[0].candidates[0];
    await pipeline.decideCandidate(rejectedCandidate.id, 'reject', true);
    expect(pipeline.resolve(request.identityKey)).toBeNull();
    await expect(pipeline.readCandidate(rejectedCandidate.id, false)).rejects.toThrow(
      'administrator authorization required',
    );
    await pipeline.regenerateRequest(request.id, true);
    await pipeline.runQueuedJobs();
    const replacement = pipeline
      .listPending(true)[0]
      .candidates.find((item) => item.status === 'pending');
    await pipeline.decideCandidate(replacement.id, 'approve', true);
    expect(pipeline.resolve(request.identityKey).version).toBe(1);
    expect(generate).toHaveBeenCalledTimes(2);
  });

  it('supports rollback and leaves an unrelated vehicle pending', async () => {
    const { pipeline } = await setup();
    const genesis = await pipeline.submitRequest({ make: 'Genesis', model: 'GV80', year: 2025 });
    const lexus = await pipeline.submitRequest({ make: 'Lexus', model: 'TX', year: 2024 });
    const firstImage = await fixtureImage();
    const first = await pipeline.uploadCandidate(
      genesis.request.id,
      { contentType: 'image/png', bytes: firstImage },
      true,
    );
    await pipeline.decideCandidate(first.id, 'approve', true);
    const second = await pipeline.uploadCandidate(
      genesis.request.id,
      { contentType: 'image/png', bytes: firstImage },
      true,
    );
    await pipeline.decideCandidate(second.id, 'approve', true);
    await pipeline.rollback(genesis.request.identityKey, 1, true);
    expect(pipeline.resolve(genesis.request.identityKey).version).toBe(1);
    expect(pipeline.listPending(true).some((item) => item.id === lexus.request.id)).toBe(true);
  });

  it('builds prompts from known facts only and the OpenAI adapter uses documented image fields', async () => {
    const prompt = buildVehicleImagePrompt({
      manufacturer: 'Genesis',
      model: 'GV80',
      year: 2025,
      generation: null,
      facelift: null,
      bodyStyle: null,
      trim: null,
    });
    expect(prompt).toContain('Manufacturer: Genesis');
    expect(prompt).not.toContain('Generation:');
    expect(
      buildVehicleImagePrompt({
        manufacturer: 'Chevrolet',
        model: 'Captiva',
        year: 2020,
        exteriorColor: 'White',
      }),
    ).toContain('Exterior color: White');
    const calls = [];
    const provider = new OpenAIImageProvider({
      apiKey: 'test-key-not-a-secret',
      fetchImpl: async (url, options) => {
        calls.push({ url, options });
        return new Response(
          JSON.stringify({
            data: [{ b64_json: Buffer.from('fake').toString('base64') }],
            usage: {
              input_tokens: 100,
              input_tokens_details: { image_tokens: 20, text_tokens: 80 },
              output_tokens: 200,
              output_tokens_details: { image_tokens: 200, text_tokens: 0 },
            },
          }),
          { status: 200 },
        );
      },
    });
    const result = await provider.generate({
      vehicle: { manufacturer: 'Genesis', model: 'GV80', year: 2025 },
      referenceImages: [{ bytes: await fixtureImage(), contentType: 'image/png' }],
    });
    expect(calls[0].url).toContain('/edits');
    expect(calls[0].options.headers.authorization).toBe('Bearer test-key-not-a-secret');
    expect(calls[0].options.body.get('model')).toBe('gpt-image-2.6-sunburst');
    expect(calls[0].options.body.get('size')).toBe('1536x1024');
    expect(calls[0].options.body.get('background')).toBe('transparent');
    expect(calls[0].options.body.get('output_format')).toBe('webp');
    expect(calls[0].options.body.getAll('image[]')).toHaveLength(1);
    expect(result.bytes.toString()).toBe('fake');
    expect(result.providerLatencyMs).toEqual(expect.any(Number));
    expect(result.providerUsage.input_tokens).toBe(100);
    expect(result.estimatedCostUsd).toBeCloseTo((80 * 5 + 20 * 8 + 200 * 30) / 1_000_000);
  });

  it('stores supplied reference images privately and passes them to the provider', async () => {
    const captured = vi.fn(async ({ referenceImages }) => ({
      bytes: await fixtureImage(),
      provider: 'test',
      referenceCount: referenceImages.length,
    }));
    const { pipeline } = await setup({ provider: { generate: captured } });
    const reference = await fixtureImage();
    const { request } = await pipeline.submitRequest(
      { make: 'Genesis', model: 'GV80', year: 2025 },
      [{ contentType: 'image/png', data: reference.toString('base64') }],
    );
    await pipeline.runQueuedJobs();
    expect(captured).toHaveBeenCalledWith(
      expect.objectContaining({
        referenceImages: [expect.objectContaining({ bytes: reference, contentType: 'image/png' })],
      }),
    );
    expect(request.referenceAssets[0]).not.toHaveProperty('bytes');
  });
});
