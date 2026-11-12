import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { createVehicleImagePipeline, vehicleIdentityKey } from './vehicle-image-pipeline.mjs';
import { processGeneratedImage } from './vehicle-image-processing.mjs';
import { buildVehicleImagePrompt, OpenAIImageProvider } from './vehicle-image-provider.mjs';

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
    ...options,
  });
  await pipeline.initialize();
  return { pipeline, dataDir };
}
afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('vehicle image pipeline', () => {
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
    const restarted = createVehicleImagePipeline({ dataDir, adminToken: token });
    await restarted.initialize();
    expect(restarted.listPending(true)).toHaveLength(1);
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

  it('builds prompts from known facts only and the OpenAI adapter supports references', async () => {
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
    const calls = [];
    const provider = new OpenAIImageProvider({
      apiKey: 'test-key-not-a-secret',
      fetchImpl: async (url, options) => {
        calls.push({ url, options });
        return new Response(
          JSON.stringify({ data: [{ b64_json: Buffer.from('fake').toString('base64') }] }),
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
    expect(result.bytes.toString()).toBe('fake');
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
