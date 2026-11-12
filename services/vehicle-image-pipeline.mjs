import { createServer } from 'node:http';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import { processGeneratedImage } from './vehicle-image-processing.mjs';

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const ACTIVE_JOB_STATES = new Set(['queued', 'running', 'awaiting_approval']);
const ADMIN_ONLY_TERMINAL_JOB_STATES = new Set(['failed', 'rejected']);
const CANONICAL_IDENTITY_VERSION = 'mator-vehicle-image-v1';
const TRANSPORT_DIAGNOSTIC_FIELDS = [
  'errorName',
  'errorCode',
  'errorErrno',
  'errorSyscall',
  'causeName',
  'causeCode',
  'causeErrno',
  'causeSyscall',
];

function sanitizeTransportDiagnostics(value) {
  if (!value || typeof value !== 'object') return undefined;
  const result = {};
  for (const field of TRANSPORT_DIAGNOSTIC_FIELDS) {
    const entry = value[field];
    if (field.endsWith('Errno')) {
      if (Number.isInteger(entry)) result[field] = entry;
    } else if (typeof entry === 'string' && /^[A-Za-z0-9_.-]{1,80}$/.test(entry)) {
      result[field] = entry;
    }
  }
  return Object.keys(result).length ? result : undefined;
}

function normalize(value) {
  return String(value ?? '')
    .trim()
    .toLocaleLowerCase('en-US')
    .replace(/\s+/g, ' ');
}

export function vehicleIdentityKey(vehicle) {
  return [
    vehicle.manufacturer ?? vehicle.make,
    vehicle.model,
    vehicle.year,
    vehicle.generation ?? '',
    vehicle.facelift ?? '',
    vehicle.bodyStyle ?? '',
    vehicle.trim ?? '',
    vehicle.exteriorColor ?? '',
  ]
    .map(normalize)
    .join('|');
}

function canonicalTextId(value, name, maxLength = 64) {
  if (typeof value !== 'string') throw new Error(`${name} must be text`);
  const normalized = value.trim();
  if (
    !normalized || normalized.length > maxLength ||
    /[\u0000-\u001f\u007f]/.test(normalized)
  ) throw new Error(`${name} is invalid`);
  return normalized;
}

function canonicalCatalogId(value, name) {
  const normalized = canonicalTextId(value, name);
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(normalized))
    throw new Error(`${name} must be a canonical catalog ID`);
  return normalized;
}

function optionalCanonicalTextId(value, name, maxLength = 64) {
  if (value === null) return null;
  if (maxLength !== 64) return canonicalTextId(value, name, maxLength);
  return canonicalCatalogId(value, name);
}

export function validateCanonicalVehicleIdentity(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('canonical identity is required');
  const requiredFields = ['makeId', 'modelId', 'modelYear', 'generationId', 'faceliftId', 'bodyType', 'trimId'];
  if (Object.keys(value).some((field) => !requiredFields.includes(field)))
    throw new Error('canonical identity contains unsupported fields');
  if (requiredFields.some((field) => !Object.hasOwn(value, field)))
    throw new Error('canonical identity must include every ordered identity field');
  if (!Number.isInteger(value.modelYear) || value.modelYear < 1886 || value.modelYear > 2200)
    throw new Error('modelYear must be a valid model year');
  return {
    makeId: canonicalCatalogId(value.makeId, 'makeId'),
    modelId: canonicalCatalogId(value.modelId, 'modelId'),
    modelYear: value.modelYear,
    generationId: optionalCanonicalTextId(value.generationId, 'generationId'),
    faceliftId: optionalCanonicalTextId(value.faceliftId, 'faceliftId'),
    bodyType: value.bodyType === null ? null : canonicalTextId(value.bodyType, 'bodyType', 60),
    trimId: optionalCanonicalTextId(value.trimId, 'trimId'),
  };
}

export function canonicalVehicleIdentityTuple(identity) {
  const value = validateCanonicalVehicleIdentity(identity);
  return [
    CANONICAL_IDENTITY_VERSION,
    value.makeId,
    value.modelId,
    value.modelYear,
    value.generationId,
    value.faceliftId,
    value.bodyType,
    value.trimId,
  ];
}

export function canonicalVehicleIdentityKey(identity) {
  return createHash('sha256')
    .update(JSON.stringify(canonicalVehicleIdentityTuple(identity)))
    .digest('hex');
}

function validateVehicle(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('vehicle is required');
  const manufacturer = String(value.manufacturer ?? value.make ?? '').trim();
  const model = String(value.model ?? '').trim();
  const year = Number(value.year);
  if (!manufacturer || !model || !Number.isInteger(year) || year < 1886 || year > 2200) {
    throw new Error('manufacturer, model and valid model year are required');
  }
  const optionalText = (key) => {
    if (value[key] == null || value[key] === '') return null;
    if (typeof value[key] !== 'string') throw new Error(`${key} must be text`);
    return value[key].trim() || null;
  };
  return {
    manufacturer,
    make: manufacturer,
    model,
    year,
    generation: optionalText('generation'),
    facelift: optionalText('facelift'),
    bodyStyle: optionalText('bodyStyle'),
    trim: optionalText('trim'),
    exteriorColor: optionalText('exteriorColor'),
  };
}

function validateCanonicalDisplay(value, identity) {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('vehicle display facts are required');
  const allowedFields = ['manufacturer', 'model', 'generation', 'facelift', 'trim'];
  if (Object.keys(value).some((field) => !allowedFields.includes(field)))
    throw new Error('vehicle display contains unsupported fields');
  const manufacturer = canonicalTextId(value.manufacturer, 'vehicle.manufacturer', 120);
  const model = canonicalTextId(value.model, 'vehicle.model', 120);
  const optionalLabel = (field) => {
    if (value[field] == null) return null;
    return canonicalTextId(value[field], `vehicle.${field}`, 120);
  };
  const generation = optionalLabel('generation');
  const facelift = optionalLabel('facelift');
  const trim = optionalLabel('trim');
  for (const [id, label, field] of [
    [identity.generationId, generation, 'generation'],
    [identity.faceliftId, facelift, 'facelift'],
    [identity.trimId, trim, 'trim'],
  ]) {
    if ((id === null) !== (label === null))
      throw new Error(`vehicle.${field} must be supplied only with its canonical ID`);
  }
  return {
    manufacturer,
    make: manufacturer,
    model,
    year: identity.modelYear,
    generation,
    facelift,
    bodyStyle: identity.bodyType,
    trim,
    exteriorColor: null,
  };
}

function defaultImageValidator(bytes) {
  return processGeneratedImage(bytes);
}

export function createVehicleImagePipeline({
  dataDir,
  adminToken,
  requestToken = null,
  provider = null,
  generationEnabled = false,
  autoRun = false,
  imageValidator = defaultImageValidator,
  assetStore = null,
  maxAttempts = 3,
  jobTimeoutMs = 120_000,
  retryDelayMs = 250,
} = {}) {
  if (!dataDir) throw new Error('dataDir is required');
  if (!adminToken || adminToken.length < 16)
    throw new Error('adminToken must be at least 16 characters');
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 10)
    throw new Error('maxAttempts must be between 1 and 10');
  const dbPath = path.join(dataDir, 'metadata.json');
  const privateDir = path.join(dataDir, 'private');
  let db = { requests: [], candidates: [], published: [], jobs: [], identityLinks: [] };
  let writeQueue = Promise.resolve();
  let workerPromise = null;
  let initialized = false;
  const publishInProgress = new Set();
  const identityLinkInProgress = new Set();

  async function initialize() {
    await mkdir(privateDir, { recursive: true, mode: 0o700 });
    try {
      db = JSON.parse(await readFile(dbPath, 'utf8'));
      db.jobs ??= [];
      db.identityLinks ??= [];
      const remap = new Map();
      for (const request of db.requests) {
        request.vehicle = validateVehicle(request.vehicle);
        if (request.canonicalIdentity) {
          request.canonicalIdentity = validateCanonicalVehicleIdentity(request.canonicalIdentity);
          if (canonicalVehicleIdentityKey(request.canonicalIdentity) !== request.identityKey)
            throw new Error('persisted canonical identity key does not match its tuple');
          if (request.activeVersion) request.status = 'approved';
          continue;
        }
        const oldKey = request.identityKey;
        request.identityKey = vehicleIdentityKey(request.vehicle);
        remap.set(oldKey, request.identityKey);
        if (request.activeVersion) request.status = 'approved';
      }
      for (const item of db.published)
        item.identityKey = remap.get(item.identityKey) ?? item.identityKey;
      for (const link of db.identityLinks) {
        link.identity = validateCanonicalVehicleIdentity(link.identity);
        if (canonicalVehicleIdentityKey(link.identity) !== link.identityKey)
          throw new Error('persisted identity link key does not match its tuple');
        link.legacyIdentityKey = remap.get(link.legacyIdentityKey) ?? link.legacyIdentityKey;
      }
      for (const job of db.jobs) {
        if (job.status === 'running') {
          job.status = 'failed';
          job.lastError = 'interrupted-provider-outcome-unknown';
          job.completedAt = new Date().toISOString();
        }
      }
      await persist();
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      await persist();
    }
    if (provider && generationEnabled && autoRun) queueMicrotask(() => void runQueuedJobs());
    initialized = true;
  }

  function persist() {
    writeQueue = writeQueue.then(async () => {
      const temp = `${dbPath}.${randomUUID()}.tmp`;
      await writeFile(temp, JSON.stringify(db, null, 2), { mode: 0o600 });
      await rename(temp, dbPath);
    });
    return writeQueue;
  }

  function requireAdmin(authorized) {
    if (!authorized)
      throw Object.assign(new Error('administrator authorization required'), { status: 403 });
  }

  function isAuthorized(header, expectedToken = adminToken) {
    if (typeof header !== 'string' || !header.startsWith('Bearer ')) return false;
    const supplied = Buffer.from(header.slice(7));
    const expected = Buffer.from(expectedToken);
    return supplied.length === expected.length && timingSafeEqual(supplied, expected);
  }

  function requireRequestService(header) {
    if (!requestToken || !isAuthorized(header, requestToken))
      throw Object.assign(new Error('service authorization required'), { status: 403 });
  }

  function activeJob(identityKey) {
    return db.jobs.find(
      (job) => job.identityKey === identityKey && ACTIVE_JOB_STATES.has(job.status),
    );
  }

  function latestJob(identityKey) {
    return [...db.jobs].reverse().find((job) => job.identityKey === identityKey) ?? null;
  }

  function createJob(request, forceRegenerate = false) {
    const job = {
      id: randomUUID(),
      requestId: request.id,
      identityKey: request.identityKey,
      status: 'queued',
      attempts: 0,
      maxAttempts,
      forceRegenerate,
      createdAt: new Date().toISOString(),
    };
    db.jobs.push(job);
    return job;
  }

  async function submitRequest(input, referenceImages = []) {
    const vehicle = validateVehicle(input);
    const identityKey = vehicleIdentityKey(vehicle);
    let request = db.requests.find((item) => item.identityKey === identityKey);
    const duplicate = Boolean(request);
    if (!request) {
      request = {
        id: randomUUID(),
        vehicle,
        identityKey,
        status: 'pending',
        createdAt: new Date().toISOString(),
      };
      if (!Array.isArray(referenceImages) || referenceImages.length > 10)
        throw new Error('referenceImages must contain at most 10 images');
      request.referenceAssets = [];
      let totalBytes = 0;
      for (const reference of referenceImages) {
        const bytes = Buffer.from(String(reference.data ?? ''), 'base64');
        const type = reference.contentType;
        const validSignature =
          type === 'image/png'
            ? bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
            : type === 'image/jpeg'
              ? bytes[0] === 255 && bytes[1] === 216 && bytes.at(-2) === 255 && bytes.at(-1) === 217
              : type === 'image/webp' &&
                bytes.subarray(0, 4).toString() === 'RIFF' &&
                bytes.subarray(8, 12).toString() === 'WEBP';
        totalBytes += bytes.length;
        if (!validSignature || bytes.length === 0 || totalBytes > 12 * 1024 * 1024)
          throw new Error(
            'reference images must be valid PNG, JPEG or WebP and total at most 12 MB',
          );
        const id = randomUUID();
        await writeFile(path.join(privateDir, id), bytes, { mode: 0o600, flag: 'wx' });
        request.referenceAssets.push({ id, contentType: type });
      }
      db.requests.push(request);
    }
    const reusableAsset = resolve(identityKey);
    const previousJob = latestJob(identityKey);
    let job = null;
    if (
      !reusableAsset && !activeJob(identityKey) &&
      !ADMIN_ONLY_TERMINAL_JOB_STATES.has(previousJob?.status)
    ) job = createJob(request);
    await persist();
    if (job && provider && generationEnabled && autoRun) queueMicrotask(() => void runQueuedJobs());
    return {
      request,
      duplicate,
      reused: Boolean(reusableAsset),
      asset: reusableAsset,
      job,
      activeJob: activeJob(identityKey) ?? job,
      previousJob: !job && !reusableAsset ? previousJob : null,
    };
  }

  async function submitCanonicalRequest(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input))
      throw new Error('canonical request body is required');
    if (Object.keys(input).some((field) => !['identity', 'vehicle'].includes(field)))
      throw new Error('canonical request contains unsupported fields');
    const identity = validateCanonicalVehicleIdentity(input.identity);
    const identityKey = canonicalVehicleIdentityKey(identity);
    const vehicle = validateCanonicalDisplay(input.vehicle, identity);
    let request = db.requests.find(
      (item) => item.identityKey === identityKey && item.canonicalIdentity,
    );
    const duplicate = Boolean(request);
    if (!request) {
      request = {
        id: randomUUID(),
        vehicle,
        canonicalIdentity: identity,
        identityKey,
        status: 'pending',
        createdAt: new Date().toISOString(),
        referenceAssets: [],
      };
      db.requests.push(request);
    }
    const reusableAsset = resolve(identityKey);
    const previousJob = latestJob(identityKey);
    let job = null;
    if (
      !reusableAsset && !activeJob(identityKey) &&
      !ADMIN_ONLY_TERMINAL_JOB_STATES.has(previousJob?.status)
    ) job = createJob(request);
    await persist();
    if (job && provider && generationEnabled && autoRun) queueMicrotask(() => void runQueuedJobs());
    return {
      request,
      duplicate,
      reused: Boolean(reusableAsset),
      asset: reusableAsset,
      job,
      activeJob: activeJob(identityKey) ?? job,
      previousJob: !job && !reusableAsset ? previousJob : null,
      identityKey,
    };
  }

  function listPending(authorized) {
    requireAdmin(authorized);
    return db.requests
      .filter(
        (request) =>
          request.status !== 'rejected' &&
          (request.status === 'pending' ||
            activeJob(request.identityKey) ||
            db.candidates.some(
              (candidate) => candidate.requestId === request.id && candidate.status === 'pending',
            )),
      )
      .map((request) => ({
        ...request,
        job:
          [...db.jobs]
            .reverse()
            .find(
              (job) =>
                job.requestId === request.id &&
                ['queued', 'running', 'failed', 'awaiting_approval', 'rejected'].includes(
                  job.status,
                ),
            ) ?? null,
        candidates: db.candidates
          .filter((candidate) => candidate.requestId === request.id)
          .map(
            ({
              id,
              status,
              createdAt,
              source,
              quality,
              identityReviewRequired,
              model,
              providerLatencyMs,
              processingLatencyMs,
              providerUsage,
              estimatedCostUsd,
            }) => ({
              id,
              status,
              createdAt,
              source,
              quality,
              identityReviewRequired,
              model,
              providerLatencyMs,
              processingLatencyMs,
              providerUsage,
              estimatedCostUsd,
            }),
          ),
      }));
  }

  async function saveCandidate(requestId, bytes, contentType, metadata = {}) {
    const request = db.requests.find((item) => item.id === requestId);
    if (!request || request.status === 'rejected')
      throw Object.assign(new Error('request not found'), { status: 404 });
    const id = randomUUID();
    await writeFile(path.join(privateDir, id), bytes, { mode: 0o600, flag: 'wx' });
    const candidate = {
      id,
      requestId,
      contentType,
      size: bytes.length,
      status: 'pending',
      source: metadata.source ?? 'manual',
      provider: metadata.provider,
      model: metadata.model,
      width: metadata.width,
      height: metadata.height,
      quality: metadata.quality,
      identityReviewRequired: metadata.source === 'generated' ? true : undefined,
      providerLatencyMs: metadata.providerLatencyMs,
      providerRequestId: metadata.providerRequestId,
      providerUsage: metadata.providerUsage,
      estimatedCostUsd: metadata.estimatedCostUsd,
      processingLatencyMs: metadata.processingLatencyMs,
      createdAt: new Date().toISOString(),
    };
    db.candidates.push(candidate);
    await persist();
    return candidate;
  }

  async function uploadCandidate(requestId, { contentType, bytes }, authorized) {
    requireAdmin(authorized);
    if (!IMAGE_TYPES.has(contentType))
      throw Object.assign(new Error('only JPEG, PNG and WebP images are accepted'), {
        status: 415,
      });
    if (!Buffer.isBuffer(bytes) || bytes.length === 0 || bytes.length > MAX_IMAGE_BYTES)
      throw Object.assign(new Error('image must be between 1 byte and 8 MB'), { status: 413 });
    const signatures = {
      'image/png': bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
      'image/jpeg':
        bytes[0] === 255 && bytes[1] === 216 && bytes.at(-2) === 255 && bytes.at(-1) === 217,
      'image/webp':
        bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP',
    };
    if (!signatures[contentType])
      throw Object.assign(new Error('image content does not match its declared type'), {
        status: 415,
      });
    return saveCandidate(requestId, bytes, contentType, { source: 'manual' });
  }

  async function runJob(job) {
    if (!provider) return;
    const request = db.requests.find((item) => item.id === job.requestId);
    if (!request || activeJob(job.identityKey) !== job) return;
    job.status = 'running';
    job.startedAt = new Date().toISOString();
    await persist();
    let lastFailure = 'provider failure';
    while (job.attempts < maxAttempts) {
      job.attempts += 1;
      delete job.transportDiagnostics;
      delete job.providerHttpStatus;
      delete job.providerErrorCode;
      const controller = new AbortController();
      let timer;
      let generated;
      try {
        await persist();
        const referenceImages = await Promise.all(
          (request.referenceAssets ?? []).map(async (asset) => ({
            bytes: await readFile(path.join(privateDir, asset.id)),
            contentType: asset.contentType,
          })),
        );
        const operation = provider.generate({
          vehicle: request.vehicle,
          referenceImages,
          signal: controller.signal,
        });
        const timeout = new Promise((_, reject) => {
          timer = setTimeout(() => {
            controller.abort();
            reject(new Error('provider timeout'));
          }, jobTimeoutMs);
        });
        generated = await Promise.race([operation, timeout]);
        clearTimeout(timer);
        if (!generated || !Buffer.isBuffer(generated.bytes))
          throw new Error('provider returned invalid image data');
        const processingStartedAt = Date.now();
        const processed = await imageValidator(generated.bytes);
        const processingLatencyMs = Date.now() - processingStartedAt;
        const candidate = await saveCandidate(request.id, processed.bytes, processed.contentType, {
          source: 'generated',
          provider: generated.provider ?? provider.name ?? 'custom',
          model: generated.model,
          width: processed.width,
          height: processed.height,
          quality: processed.checks,
          providerLatencyMs: generated.providerLatencyMs,
          providerRequestId: generated.providerRequestId,
          providerUsage: generated.providerUsage,
          estimatedCostUsd: generated.estimatedCostUsd,
          processingLatencyMs,
        });
        job.status = 'awaiting_approval';
        job.resultCandidateId = candidate.id;
        job.providerLatencyMs = generated.providerLatencyMs;
        job.providerRequestId = generated.providerRequestId;
        job.providerUsage = generated.providerUsage;
        job.estimatedCostUsd = generated.estimatedCostUsd;
        job.processingLatencyMs = processingLatencyMs;
        job.completedAt = new Date().toISOString();
        delete job.lastError;
        delete job.transportDiagnostics;
        await persist();
        return;
      } catch (error) {
        clearTimeout(timer);
        lastFailure = controller.signal.aborted
          ? 'provider timeout'
          : error?.name === 'ImageQualityError'
            ? `quality:${error.message}`
            : error?.message === 'provider timeout'
              ? 'provider timeout'
              : error?.message === 'image provider request timed out'
                ? 'provider timeout'
                : 'provider failure';
        job.lastError = lastFailure;
        if (generated) {
          job.providerLatencyMs = generated.providerLatencyMs;
          job.providerRequestId = generated.providerRequestId;
          job.providerUsage = generated.providerUsage;
          job.estimatedCostUsd = generated.estimatedCostUsd;
        }
        if (Number.isFinite(error?.providerLatencyMs))
          job.providerLatencyMs = error.providerLatencyMs;
        if (error?.providerRequestId) job.providerRequestId = error.providerRequestId;
        if (Number.isInteger(error?.providerHttpStatus))
          job.providerHttpStatus = error.providerHttpStatus;
        if (typeof error?.providerErrorCode === 'string')
          job.providerErrorCode = error.providerErrorCode;
        const diagnostics = sanitizeTransportDiagnostics(error?.transportDiagnostics);
        if (diagnostics) job.transportDiagnostics = diagnostics;
        job.lastQualityFailure = error?.name === 'ImageQualityError' ? error.message : undefined;
        await persist();
        if (job.attempts < maxAttempts && retryDelayMs > 0)
          await new Promise((resolve) =>
            setTimeout(resolve, retryDelayMs * 2 ** (job.attempts - 1)),
          );
      }
    }
    job.status = 'failed';
    job.completedAt = new Date().toISOString();
    job.lastError = lastFailure;
    await persist();
  }

  async function runQueuedJobs() {
    if (!provider || !generationEnabled) return false;
    if (workerPromise) return workerPromise;
    workerPromise = (async () => {
      while (true) {
        const job = db.jobs.find((item) => item.status === 'queued');
        if (!job) return;
        await runJob(job);
      }
    })().finally(() => {
      workerPromise = null;
    });
    await workerPromise;
    return true;
  }

  async function regenerateRequest(requestId, authorized) {
    requireAdmin(authorized);
    const request = db.requests.find((item) => item.id === requestId);
    if (!request) throw Object.assign(new Error('request not found'), { status: 404 });
    if (activeJob(request.identityKey))
      throw Object.assign(new Error('generation is already active'), { status: 409 });
    const job = createJob(request, true);
    await persist();
    if (provider && generationEnabled && autoRun) queueMicrotask(() => void runQueuedJobs());
    return job;
  }

  async function decideCandidate(candidateId, decision, authorized) {
    requireAdmin(authorized);
    if (!['approve', 'reject'].includes(decision))
      throw new Error('decision must be approve or reject');
    const candidate = db.candidates.find(
      (item) => item.id === candidateId && item.status === 'pending',
    );
    if (!candidate) throw Object.assign(new Error('pending candidate not found'), { status: 404 });
    const request = db.requests.find((item) => item.id === candidate.requestId);
    if (!request) throw Object.assign(new Error('request not found'), { status: 404 });
    if (decision === 'approve' && publishInProgress.has(request.identityKey))
      throw Object.assign(new Error('candidate approval is already in progress'), { status: 409 });
    if (decision === 'approve') publishInProgress.add(request.identityKey);
    try {
      let publishedAsset = null;
      if (decision === 'approve' && assetStore) {
        const prior = db.published.filter((item) => item.identityKey === request.identityKey);
        const version = Math.max(0, ...prior.map((item) => item.version)) + 1;
        const bytes = await readFile(path.join(privateDir, candidate.id));
        publishedAsset = await assetStore.publish({
          bytes,
          contentType: candidate.contentType,
          identityKey: request.identityKey,
          version,
          candidateId,
        });
      }
    candidate.status = decision === 'approve' ? 'approved' : 'rejected';
    candidate.decidedAt = new Date().toISOString();
    if (decision === 'approve') {
      const prior = db.published.filter((item) => item.identityKey === request.identityKey);
      const version = Math.max(0, ...prior.map((item) => item.version)) + 1;
      candidate.version = version;
      db.published.push({
        identityKey: request.identityKey,
        candidateId,
        version,
        publicUrl: publishedAsset?.url,
        storageKey: publishedAsset?.key,
        createdAt: candidate.decidedAt,
      });
      request.status = 'approved';
      request.activeVersion = version;
      const job = db.jobs.find((item) => item.resultCandidateId === candidate.id);
      if (job) job.status = 'approved';
      for (const waiting of db.jobs) {
        if (
          waiting.requestId === request.id &&
          waiting.id !== job?.id &&
          waiting.status === 'queued'
        ) {
          waiting.status = 'cancelled';
          waiting.completedAt = new Date().toISOString();
        }
      }
    } else {
      const job = db.jobs.find((item) => item.resultCandidateId === candidate.id);
      if (job) job.status = 'rejected';
      if (!request.activeVersion) request.status = 'pending';
    }
    await persist();
    return candidate;
    } finally {
      publishInProgress.delete(request.identityKey);
    }
  }

  function resolve(vehicle) {
    const key =
      typeof vehicle === 'string' ? vehicle : vehicleIdentityKey(validateVehicle(vehicle));
    const request = db.requests.find((item) => item.identityKey === key && item.activeVersion);
    const published = request && db.published.find(
      (item) => item.identityKey === key && item.version === request.activeVersion,
    );
    return request
      ? {
          identityKey: key,
          version: request.activeVersion,
          url: published?.publicUrl ?? `/published/${encodeURIComponent(key)}/v${request.activeVersion}`,
        }
      : null;
  }

  function resolveCanonicalStatus(identityInput) {
    const identity = validateCanonicalVehicleIdentity(identityInput);
    const identityKey = canonicalVehicleIdentityKey(identity);
    const request = db.requests.find(
      (item) => item.identityKey === identityKey && item.canonicalIdentity,
    );
    if (!request) {
      return { identityKey, identity, status: 'not_found', requestId: null, jobId: null, asset: null };
    }
    const asset = resolve(identityKey);
    const job = latestJob(identityKey);
    const status = asset
      ? 'approved'
      : ACTIVE_JOB_STATES.has(job?.status)
        ? job.status
        : ADMIN_ONLY_TERMINAL_JOB_STATES.has(job?.status)
          ? job.status
          : 'pending';
    return {
      identityKey,
      identity,
      status,
      requestId: request.id,
      jobId: job?.id ?? null,
      asset: asset ? { url: asset.url, version: asset.version } : null,
    };
  }

  async function linkLegacyIdentity(input, authorized) {
    requireAdmin(authorized);
    if (!input || typeof input !== 'object' || Array.isArray(input) ||
      Object.keys(input).some((field) => !['legacyIdentityKey', 'identity', 'vehicle'].includes(field)))
      throw new Error('legacy identity link body is invalid');
    const { legacyIdentityKey, identity: identityInput, vehicle: displayInput } = input;
    const legacyKey = canonicalTextId(legacyIdentityKey, 'legacyIdentityKey', 512);
    const identity = validateCanonicalVehicleIdentity(identityInput);
    const identityKey = canonicalVehicleIdentityKey(identity);
    const vehicle = validateCanonicalDisplay(displayInput, identity);
    if (identityLinkInProgress.has(identityKey))
      throw Object.assign(new Error('canonical identity link is already in progress'), { status: 409 });
    identityLinkInProgress.add(identityKey);
    try {
      const existingLink = db.identityLinks.find((item) => item.identityKey === identityKey);
      if (existingLink) {
        if (existingLink.legacyIdentityKey !== legacyKey)
          throw Object.assign(new Error('canonical identity is already linked to another legacy identity'), { status: 409 });
        return { duplicate: true, identityLink: existingLink, asset: resolve(identityKey) };
      }
      const linkedLegacy = db.identityLinks.find((item) => item.legacyIdentityKey === legacyKey);
      if (linkedLegacy)
        throw Object.assign(new Error('legacy identity is already linked to another canonical identity'), { status: 409 });
      const legacyRequest = db.requests.find(
        (item) => !item.canonicalIdentity && item.identityKey === legacyKey,
      );
      if (!legacyRequest || !legacyRequest.activeVersion)
        throw Object.assign(new Error('approved legacy identity not found'), { status: 404 });
      if (
        normalize(legacyRequest.vehicle.manufacturer) !== normalize(vehicle.manufacturer) ||
        normalize(legacyRequest.vehicle.model) !== normalize(vehicle.model) ||
        legacyRequest.vehicle.year !== vehicle.year
      ) throw Object.assign(new Error('legacy and canonical vehicle facts do not match'), { status: 409 });

      const sourceVersions = db.published
        .filter((item) => item.identityKey === legacyKey)
        .sort((a, b) => a.version - b.version);
      if (!sourceVersions.some((item) => item.version === legacyRequest.activeVersion))
        throw Object.assign(new Error('active legacy publication is missing'), { status: 409 });
      for (const version of sourceVersions) {
        if (!db.candidates.some((item) => item.id === version.candidateId && item.status === 'approved'))
          throw Object.assign(new Error('legacy publication history contains an unapproved candidate'), { status: 409 });
      }

      const existingCanonical = db.requests.find(
        (item) => item.identityKey === identityKey && item.canonicalIdentity,
      );
      if (db.published.some((item) => item.identityKey === identityKey) || activeJob(identityKey))
        throw Object.assign(new Error('canonical identity already has publication or active generation history'), { status: 409 });
      if (existingCanonical && (
        normalize(existingCanonical.vehicle.manufacturer) !== normalize(vehicle.manufacturer) ||
        normalize(existingCanonical.vehicle.model) !== normalize(vehicle.model) ||
        existingCanonical.vehicle.year !== vehicle.year
      )) throw Object.assign(new Error('canonical request display facts do not match'), { status: 409 });

      const now = new Date().toISOString();
      const request = existingCanonical ?? {
        id: randomUUID(),
        vehicle,
        canonicalIdentity: identity,
        identityKey,
        status: 'approved',
        createdAt: now,
        referenceAssets: [],
      };
      const previousRequest = existingCanonical
        ? { status: existingCanonical.status, activeVersion: existingCanonical.activeVersion, legacyIdentityKey: existingCanonical.legacyIdentityKey }
        : null;
      const identityLink = {
        identityKey,
        identity,
        legacyIdentityKey: legacyKey,
        linkedAt: now,
        linkedBy: 'admin',
        linkedVersions: sourceVersions.map((item) => item.version),
      };
      if (!existingCanonical) db.requests.push(request);
      request.status = 'approved';
      request.activeVersion = legacyRequest.activeVersion;
      request.legacyIdentityKey = legacyKey;
      db.identityLinks.push(identityLink);
      const linkedVersions = sourceVersions.map((item) => ({
        ...item,
        identityKey,
        linkedFromIdentityKey: legacyKey,
        linkedAt: now,
      }));
      db.published.push(...linkedVersions);
      try {
        await persist();
      } catch (error) {
        db.published = db.published.filter(
          (item) => !(item.identityKey === identityKey && item.linkedAt === now),
        );
        db.identityLinks = db.identityLinks.filter((item) => item !== identityLink);
        if (existingCanonical) Object.assign(existingCanonical, previousRequest);
        else db.requests = db.requests.filter((item) => item.id !== request.id);
        throw error;
      }
      return { duplicate: false, identityLink, asset: resolve(identityKey) };
    } finally {
      identityLinkInProgress.delete(identityKey);
    }
  }

  async function rollback(vehicle, version, authorized) {
    requireAdmin(authorized);
    const key =
      typeof vehicle === 'string' ? vehicle : vehicleIdentityKey(validateVehicle(vehicle));
    const published = db.published.find(
      (item) => item.identityKey === key && item.version === Number(version),
    );
    const request = db.requests.find((item) => item.identityKey === key);
    if (!published || !request)
      throw Object.assign(new Error('published version not found'), { status: 404 });
    request.activeVersion = published.version;
    request.status = 'approved';
    await persist();
    return resolve(key);
  }

  async function readCandidate(candidateId, authorized) {
    requireAdmin(authorized);
    const candidate = db.candidates.find((item) => item.id === candidateId);
    if (!candidate) return null;
    return {
      bytes: await readFile(path.join(privateDir, candidate.id)),
      contentType: candidate.contentType,
    };
  }

  async function readPublished(identityKey, version) {
    const item = db.published.find(
      (entry) => entry.identityKey === identityKey && entry.version === Number(version),
    );
    if (!item) return null;
    const candidate = db.candidates.find(
      (entry) => entry.id === item.candidateId && entry.status === 'approved',
    );
    if (!candidate) return null;
    return {
      bytes: await readFile(path.join(privateDir, candidate.id)),
      contentType: candidate.contentType,
    };
  }

  function server() {
    return createServer(async (req, res) => {
      const send = (status, body, type = 'application/json') => {
        res.writeHead(status, { 'content-type': type, 'cache-control': 'no-store' });
        res.end(type === 'application/json' ? JSON.stringify(body) : body);
      };
      const isAdmin = isAuthorized(req.headers.authorization);
      try {
        const url = new URL(req.url, 'http://localhost');
        if (req.method === 'GET' && (url.pathname === '/health/live' || url.pathname === '/health/ready')) {
          const ready = initialized;
          return send(url.pathname.endsWith('/live') || ready ? 200 : 503, {
            status: url.pathname.endsWith('/live') ? 'live' : ready ? 'ready' : 'starting',
          });
        }
        if (req.method === 'POST' && url.pathname === '/requests') {
          if (requestToken ? !isAuthorized(req.headers.authorization, requestToken) : !isAdmin)
            requireAdmin(false);
          const body = await readJson(req);
          return send(201, await submitRequest(body.vehicle, body.referenceImages ?? []));
        }
        if (req.method === 'POST' && url.pathname === '/internal/v1/vehicle-images/requests') {
          requireRequestService(req.headers.authorization);
          const body = await readJson(req);
          const result = await submitCanonicalRequest(body);
          const status = resolveCanonicalStatus(body.identity);
          return send(status.status === 'approved' ? 200 : 202, {
            ...status,
            duplicate: result.duplicate,
            reused: result.reused,
            deduplicated: result.duplicate || result.reused || Boolean(result.activeJob && !result.job),
          });
        }
        if (req.method === 'POST' && url.pathname === '/internal/v1/vehicle-images/resolve') {
          requireRequestService(req.headers.authorization);
          const body = await readJson(req);
          return send(200, resolveCanonicalStatus(body.identity));
        }
        if (req.method === 'GET' && url.pathname === '/admin/requests')
          return send(200, listPending(isAdmin));
        if (req.method === 'POST' && url.pathname === '/admin/jobs/process') {
          requireAdmin(isAdmin);
          await runQueuedJobs();
          return send(200, { ok: true });
        }
        const regenMatch = /^\/admin\/requests\/([^/]+)\/regenerate$/.exec(url.pathname);
        if (req.method === 'POST' && regenMatch)
          return send(202, await regenerateRequest(decodeURIComponent(regenMatch[1]), isAdmin));
        const candidateMatch = /^\/admin\/requests\/([^/]+)\/candidates$/.exec(url.pathname);
        if (req.method === 'POST' && candidateMatch) {
          requireAdmin(isAdmin);
          const body = await readJson(req);
          return send(
            201,
            await uploadCandidate(
              decodeURIComponent(candidateMatch[1]),
              { contentType: body.contentType, bytes: Buffer.from(body.data, 'base64') },
              true,
            ),
          );
        }
        const previewMatch = /^\/admin\/candidates\/([^/]+)\/preview$/.exec(url.pathname);
        if (req.method === 'GET' && previewMatch) {
          requireAdmin(isAdmin);
          const asset = await readCandidate(decodeURIComponent(previewMatch[1]), true);
          return asset
            ? send(200, asset.bytes, asset.contentType)
            : send(404, { error: 'candidate not found' });
        }
        const decisionMatch = /^\/admin\/candidates\/([^/]+)\/(approve|reject)$/.exec(url.pathname);
        if (req.method === 'POST' && decisionMatch)
          return send(
            200,
            await decideCandidate(decodeURIComponent(decisionMatch[1]), decisionMatch[2], isAdmin),
          );
        if (req.method === 'POST' && url.pathname === '/admin/rollback') {
          requireAdmin(isAdmin);
          const body = await readJson(req);
          return send(200, await rollback(body.identityKey, body.version, true));
        }
        if (req.method === 'POST' && url.pathname === '/admin/identity-links') {
          requireAdmin(isAdmin);
          const body = await readJson(req);
          return send(200, await linkLegacyIdentity(body, true));
        }
        if (req.method === 'GET' && url.pathname === '/resolve') {
          const result = resolve(url.searchParams.get('identityKey'));
          return result ? send(200, result) : send(404, { error: 'no approved image' });
        }
        const publishedMatch = /^\/published\/([^/]+)\/v(\d+)$/.exec(url.pathname);
        if (req.method === 'GET' && publishedMatch) {
          const asset = await readPublished(
            decodeURIComponent(publishedMatch[1]),
            publishedMatch[2],
          );
          return asset
            ? send(200, asset.bytes, asset.contentType)
            : send(404, { error: 'image not found' });
        }
        return send(404, { error: 'not found' });
      } catch (error) {
        return send(error.status ?? 400, { error: error.message });
      }
    });
  }

  return {
    initialize,
    submitRequest,
    submitCanonicalRequest,
    resolveCanonicalStatus,
    linkLegacyIdentity,
    listPending,
    uploadCandidate,
    decideCandidate,
    resolve,
    rollback,
    readCandidate,
    readPublished,
    regenerateRequest,
    runQueuedJobs,
    health: () => ({ live: true, ready: initialized }),
    server,
  };
}

async function readJson(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_IMAGE_BYTES * 2.5)
      throw Object.assign(new Error('request body too large'), { status: 413 });
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
