import { createServer } from 'node:http';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

function normalize(value) {
  return String(value ?? '')
    .trim()
    .toLocaleLowerCase('en-US')
    .replace(/\s+/g, ' ');
}

export function vehicleIdentityKey(vehicle) {
  const identity = [
    vehicle.make,
    vehicle.model,
    vehicle.year,
    vehicle.generation ?? '',
    vehicle.bodyStyle ?? '',
  ];
  return identity.map(normalize).join('|');
}

function validateVehicle(value) {
  if (!value || typeof value !== 'object') throw new Error('vehicle is required');
  const make = String(value.make ?? '').trim();
  const model = String(value.model ?? '').trim();
  const year = Number(value.year);
  if (!make || !model || !Number.isInteger(year) || year < 1886 || year > 2200) {
    throw new Error('make, model and valid model year are required');
  }
  return {
    make,
    model,
    year,
    generation: value.generation?.trim() || null,
    bodyStyle: value.bodyStyle?.trim() || null,
  };
}

export function createVehicleImagePipeline({ dataDir, adminToken }) {
  if (!dataDir) throw new Error('dataDir is required');
  if (!adminToken || adminToken.length < 16)
    throw new Error('adminToken must be at least 16 characters');
  const dbPath = path.join(dataDir, 'metadata.json');
  const privateDir = path.join(dataDir, 'private');
  let db = { requests: [], candidates: [], published: [] };
  let writeQueue = Promise.resolve();

  async function initialize() {
    await mkdir(privateDir, { recursive: true, mode: 0o700 });
    try {
      db = JSON.parse(await readFile(dbPath, 'utf8'));
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      await persist();
    }
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

  async function submitRequest(input) {
    const vehicle = validateVehicle(input);
    const identityKey = vehicleIdentityKey(vehicle);
    const existing = db.requests.find((item) => item.identityKey === identityKey);
    if (existing) return { request: existing, duplicate: true };
    const request = {
      id: randomUUID(),
      vehicle,
      identityKey,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    db.requests.push(request);
    await persist();
    return { request, duplicate: false };
  }

  function listPending(authorized) {
    requireAdmin(authorized);
    return db.requests
      .filter((request) => request.status === 'pending')
      .map((request) => ({
        ...request,
        candidates: db.candidates
          .filter((candidate) => candidate.requestId === request.id)
          .map(({ id, status, createdAt }) => ({ id, status, createdAt })),
      }));
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
      createdAt: new Date().toISOString(),
    };
    db.candidates.push(candidate);
    await persist();
    return candidate;
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
          return send(201, await submitRequest(body.vehicle));
        }
        if (req.method === 'GET' && url.pathname === '/admin/requests')
          return send(200, listPending(isAdmin));
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
    readPublished,
    server,
  };
}

async function readJson(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_IMAGE_BYTES * 2)
      throw Object.assign(new Error('request body too large'), { status: 413 });
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
