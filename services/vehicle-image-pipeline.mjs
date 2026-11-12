import { createServer } from 'node:http';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { processGeneratedImage } from './vehicle-image-processing.mjs';

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const ACTIVE_JOB_STATES = new Set(['queued', 'running', 'awaiting_approval']);

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
  ]
    .map(normalize)
    .join('|');
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
  };
}

function defaultImageValidator(bytes) {
  return processGeneratedImage(bytes);
}

export function createVehicleImagePipeline({
  dataDir,
  adminToken,
  provider = null,
  autoRun = true,
  imageValidator = defaultImageValidator,
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
  let db = { requests: [], candidates: [], published: [], jobs: [] };
  let writeQueue = Promise.resolve();
  let workerPromise = null;

  async function initialize() {
    await mkdir(privateDir, { recursive: true, mode: 0o700 });
    try {
      db = JSON.parse(await readFile(dbPath, 'utf8'));
      db.jobs ??= [];
      const remap = new Map();
      for (const request of db.requests) {
        request.vehicle = validateVehicle(request.vehicle);
        const oldKey = request.identityKey;
        request.identityKey = vehicleIdentityKey(request.vehicle);
        remap.set(oldKey, request.identityKey);
        if (request.activeVersion) request.status = 'approved';
      }
      for (const item of db.published)
        item.identityKey = remap.get(item.identityKey) ?? item.identityKey;
      for (const job of db.jobs) {
        if (job.status === 'running') job.status = job.attempts < maxAttempts ? 'queued' : 'failed';
      }
      await persist();
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      await persist();
    }
    if (provider && autoRun) queueMicrotask(() => void runQueuedJobs());
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

  function activeJob(identityKey) {
    return db.jobs.find(
      (job) => job.identityKey === identityKey && ACTIVE_JOB_STATES.has(job.status),
    );
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
    let job = null;
    if (!reusableAsset && !activeJob(identityKey)) job = createJob(request);
    await persist();
    if (job && provider && autoRun) queueMicrotask(() => void runQueuedJobs());
    return {
      request,
      duplicate,
      reused: Boolean(reusableAsset),
      asset: reusableAsset,
      job,
      activeJob: activeJob(identityKey) ?? job,
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
          .map(({ id, status, createdAt, source, quality, identityReviewRequired }) => ({
            id,
            status,
            createdAt,
            source,
            quality,
            identityReviewRequired,
          })),
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
      const controller = new AbortController();
      let timer;
      try {
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
        const generated = await Promise.race([operation, timeout]);
        clearTimeout(timer);
        if (!generated || !Buffer.isBuffer(generated.bytes))
          throw new Error('provider returned invalid image data');
        const processed = await imageValidator(generated.bytes);
        const candidate = await saveCandidate(request.id, processed.bytes, processed.contentType, {
          source: 'generated',
          provider: generated.provider ?? provider.name ?? 'custom',
          model: generated.model,
          width: processed.width,
          height: processed.height,
          quality: processed.checks,
        });
        job.status = 'awaiting_approval';
        job.resultCandidateId = candidate.id;
        job.completedAt = new Date().toISOString();
        delete job.lastError;
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
    if (!provider) return;
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
    return workerPromise;
  }

  async function regenerateRequest(requestId, authorized) {
    requireAdmin(authorized);
    const request = db.requests.find((item) => item.id === requestId);
    if (!request) throw Object.assign(new Error('request not found'), { status: 404 });
    if (activeJob(request.identityKey))
      throw Object.assign(new Error('generation is already active'), { status: 409 });
    const job = createJob(request, true);
    await persist();
    if (provider && autoRun) queueMicrotask(() => void runQueuedJobs());
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
  }

  function resolve(vehicle) {
    const key =
      typeof vehicle === 'string' ? vehicle : vehicleIdentityKey(validateVehicle(vehicle));
    const request = db.requests.find((item) => item.identityKey === key && item.activeVersion);
    return request
      ? {
          identityKey: key,
          version: request.activeVersion,
          url: `/published/${encodeURIComponent(key)}/v${request.activeVersion}`,
        }
      : null;
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
      const isAdmin = req.headers.authorization === `Bearer ${adminToken}`;
      try {
        const url = new URL(req.url, 'http://localhost');
        if (req.method === 'POST' && url.pathname === '/requests') {
          const body = await readJson(req);
          return send(201, await submitRequest(body.vehicle, body.referenceImages ?? []));
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
    listPending,
    uploadCandidate,
    decideCandidate,
    resolve,
    rollback,
    readCandidate,
    readPublished,
    regenerateRequest,
    runQueuedJobs,
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
