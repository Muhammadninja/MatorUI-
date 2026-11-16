import { describe, expect, it, vi } from 'vitest';
import { createWikimediaCommonsProvider } from './vehicle-image-wikimedia-provider.mjs';
import sharp from 'sharp';
import { hasPublishableRights } from './vehicle-image-acquisition.mjs';
import { processLicensedPhoto } from './vehicle-image-processing.mjs';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createVehicleImagePipeline } from './vehicle-image-pipeline.mjs';

function response({ status = 200, json, bytes = json ? Buffer.from(JSON.stringify(json)) : Buffer.from('private image') } = {}) {
  return { ok: status >= 200 && status < 300, status,
    headers: { get: () => String(bytes.length) },
    json: async () => json, arrayBuffer: async () => bytes };
}

const page = (licenseUrl, overrides = {}) => ({
  title: 'File:Chevrolet_Spark_photo.jpg',
  imageinfo: [{ url: 'https://upload.wikimedia.org/wikipedia/commons/a/a0/spark.jpg', mime: 'image/jpeg', width: 1200, height: 800,
    extmetadata: { LicenseUrl: { value: licenseUrl }, LicenseShortName: { value: 'CC BY 4.0' },
      Artist: { value: 'Example Photographer' }, Attribution: { value: 'Example Photographer / Wikimedia Commons' },
      License: { value: 'Creative Commons Attribution 4.0' }, ...overrides } }],
});

describe('Wikimedia Commons sourcing policy', () => {
  it('returns image bytes with structured, commercial-license provenance', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(response({ json: { query: { pages: [] } } }))
      .mockResolvedValueOnce(response({ json: { query: { pages: [page('https://creativecommons.org/licenses/by-sa/4.0')] } } }))
      .mockResolvedValueOnce(response());
    const provider = createWikimediaCommonsProvider({ fetchImpl, minRequestIntervalMs: 0 });
    const [candidate] = await provider.acquire({ identity: { manufacturer: 'Chevrolet', model: 'Spark', generation: 'M300', marketRegion: 'UZ' }, subjectKey: 'spark' });
    expect(candidate.source).toMatchObject({ provider: 'wikimedia-commons', license: 'CC-BY-SA-4.0', author: 'Example Photographer', sourcePage: expect.stringContaining('commons.wikimedia.org/wiki/File:Chevrolet_Spark_photo.jpg') });
    expect(candidate.contentType).toBe('image/jpeg');
    expect(candidate.bytes).toEqual(Buffer.from('private image'));
    expect(candidate.source.confidence).toContain('manual-identity-review-required');
  });

  it.each([
    ['noncommercial', 'https://creativecommons.org/licenses/by-nc/4.0/'],
    ['no derivatives', 'https://creativecommons.org/licenses/by-nd/4.0/'],
    ['unknown', 'https://example.org/license'],
  ])('rejects %s licenses', async (_name, license) => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(response({ json: { query: { pages: [page(license)] } } }));
    const provider = createWikimediaCommonsProvider({ fetchImpl, minRequestIntervalMs: 0 });
    expect(await provider.acquire({ identity: { manufacturer: 'Chevrolet', model: 'Spark' } })).toEqual([]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('rejects external download hosts and prevents image fetch', async () => {
    const result = page('https://creativecommons.org/licenses/by/4.0/');
    result.imageinfo[0].url = 'https://attacker.example/image.jpg';
    const fetchImpl = vi.fn().mockResolvedValueOnce(response({ json: { query: { pages: [result] } } }));
    const provider = createWikimediaCommonsProvider({ fetchImpl, minRequestIntervalMs: 0 });
    expect(await provider.acquire({ identity: { manufacturer: 'Chevrolet', model: 'Spark' } })).toEqual([]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('requires commercial rights evidence and normalizes opaque photos without creating transparency', async () => {
    const rights = { provider: 'wikimedia-commons', license: 'CC-BY-SA-4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
      sourcePage: 'https://commons.wikimedia.org/wiki/File:Test.jpg', sourceUrl: 'https://upload.wikimedia.org/test.jpg',
      author: 'Photographer', attribution: 'Photographer / Commons', licenseEvidence: 'CC BY-SA 4.0' };
    expect(hasPublishableRights(rights)).toBe(true);
    expect(hasPublishableRights({ ...rights, license: 'CC-BY-NC-4.0' })).toBe(false);
    expect(hasPublishableRights({ ...rights, licenseUrl: 'https://creativecommons.org/licenses/by-nc/4.0/' })).toBe(false);
    expect(hasPublishableRights({ ...rights, author: '' })).toBe(false);
    const bytes = await sharp({ create: { width: 800, height: 600, channels: 3, background: '#777' } }).jpeg().toBuffer();
    const photo = await processLicensedPhoto(bytes);
    const metadata = await sharp(photo.bytes).metadata();
    expect(metadata.format).toBe('webp');
    expect(metadata.hasAlpha).toBe(false);
    expect(photo.checks.framing).toBe('licensed-photo-preserved');
    expect(photo.checks.identity).toContain('manual-review-required');
  });

  it('creates a private review candidate and only publishes after explicit rights and identity review', async () => {
    const dataDir = await mkdtemp(path.join(os.tmpdir(), 'wikimedia-pipeline-'));
    try {
      const jpeg = await sharp({ create: { width: 800, height: 600, channels: 3, background: '#555' } }).jpeg().toBuffer();
      const rights = { provider: 'wikimedia-commons', kind: 'licensed-photo', license: 'CC-BY-4.0',
        licenseName: 'CC BY 4.0', licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
        sourceUrl: 'https://upload.wikimedia.org/test.jpg', sourcePage: 'https://commons.wikimedia.org/wiki/File:Test.jpg',
        author: 'Photographer', attribution: 'Photographer / Commons', licenseEvidence: 'CC BY 4.0',
        provenance: { sourcePage: 'https://commons.wikimedia.org/wiki/File:Test.jpg' } };
      const photoProvider = { id: 'wikimedia-commons', autoPublish: false, acquire: vi.fn(async () => [{ bytes: jpeg, contentType: 'image/jpeg', source: rights }]) };
      const assetStore = { publish: vi.fn(async () => ({ url: 'https://res.cloudinary.com/test/image/upload/v1/test.webp', key: 'mator/vehicle-images/test' })) };
      const pipeline = createVehicleImagePipeline({ dataDir, adminToken: 'pipeline-test-admin-token', photoProvider,
        publicationEnabled: true, publicationCandidateAllowlist: ['controlled-test-candidate'], assetStore, autoRun: false });
      await pipeline.initialize();
      const identity = { makeId: 'chevrolet', modelId: 'review-fixture', modelYear: 2024, generationId: null,
        faceliftId: null, bodyType: null, trimId: null, identityStatus: 'unverified' };
      await pipeline.submitCanonicalRequest({ identity, vehicle: { manufacturer: 'Chevrolet', model: 'Review Fixture' } });
      await pipeline.runQueuedJobs();
      let [candidate] = pipeline.reviewQueue(true)[0].candidates;
      expect(candidate).toMatchObject({ status: 'pending', license: 'CC-BY-4.0', attribution: 'Photographer / Commons', identityReviewRequired: true });
      await expect(pipeline.decideCandidate(candidate.id, 'approve', true, { rightsConfirmation: { confirmed: true, reference: 'Commons license checked' }, identityConfirmation: { confirmed: true, reference: 'Exact vehicle checked' } })).rejects.toMatchObject({ status: 403 });
      expect(assetStore.publish).not.toHaveBeenCalled();
      // The allowlist models the one-candidate controlled test mode; no broad publication switch is inferred.
      const isolated = createVehicleImagePipeline({ dataDir, adminToken: 'pipeline-test-admin-token', photoProvider,
        publicationEnabled: true, publicationCandidateAllowlist: [candidate.id], assetStore, autoRun: false });
      await isolated.initialize();
      candidate = isolated.reviewQueue(true)[0].candidates[0];
      await isolated.decideCandidate(candidate.id, 'approve', true, {
        rightsConfirmation: { confirmed: true, reference: 'Commons CC BY 4.0 terms checked' },
        identityConfirmation: { confirmed: true, reference: 'Exact generation and model checked' },
      });
      expect(assetStore.publish).toHaveBeenCalledWith(expect.objectContaining({ kind: 'licensed-photo', rights: expect.objectContaining({ attribution: 'Photographer / Commons' }) }));
      expect(isolated.resolveCanonicalStatus(identity, { contract: 2 }).asset.url).toContain('cloudinary.com');
    } finally { await rm(dataDir, { recursive: true, force: true }); }
  });
});
