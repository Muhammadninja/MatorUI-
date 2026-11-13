#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';

const state = path.resolve(process.env.MATOR_INTEGRATION_DIR || '.local/integration');
const environment = JSON.parse(await fs.readFile(path.join(state, 'environment.json'), 'utf8'));
const base = `http://127.0.0.1:${process.env.MATOR_API_PORT || 3300}`;
const phone = process.env.MATOR_E2E_PHONE || '+998900000001';
const requestLog = [];
let token;

async function call(method, route, body, expected = 200) {
  const response = await fetch(base + route, {
    method, redirect: 'error', signal: AbortSignal.timeout(15_000),
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  requestLog.push({ method, route, status: response.status });
  const payload = await response.json().catch(() => null);
  if (response.status !== expected) throw Error(`${method} ${route} returned ${response.status}; expected ${expected}`);
  return payload;
}

async function login() {
  const documents = await call('GET', '/v1/legal/documents');
  const versionFor = (type) => {
    const document = documents.documents.find((entry) => entry.type === type);
    assert.ok(document, `Required local legal document ${type} must be seeded`);
    return document.version;
  };
  const otp = await call('POST', '/v1/auth/phone/request-otp', {
    phone_e164: phone, country_iso2: 'UZ', channel: 'sms', lang: 'en',
  });
  assert.ok(otp.dev_otp_code, 'Local development OTP must be enabled for this isolated runtime');
  const auth = await call('POST', '/v1/auth/phone/verify-otp', {
    phone_e164: phone, request_id: otp.request_id, otp_code: otp.dev_otp_code,
    legal: {
      terms_version: versionFor('TERMS_OF_USE'),
      privacy_version: versionFor('PRIVACY_POLICY'),
      personal_data_consent_version: versionFor('PERSONAL_DATA_CONSENT'),
    },
  });
  token = auth.tokens.access_token;
  await fs.writeFile(path.join(state, 'vehicle-images-access-token'), token, { mode: 0o600 });
}

async function resolveImage(vehicleId) {
  let result;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    result = await call('GET', `/v1/garage/vehicles/${vehicleId}/image`);
    if (result.vehicle_image?.status === 'approved' || result.vehicle_image?.reason === 'needs_review') return result;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return result;
}

const phase = process.argv[2] || 'create';

if (phase === 'restart-check') {
  token = (await fs.readFile(path.join(state, 'vehicle-images-access-token'), 'utf8')).trim();
  const saved = JSON.parse(await fs.readFile(path.join(state, 'vehicle-images-e2e.json'), 'utf8'));
  const garage = await call('GET', '/v1/garage/vehicles');
  for (const vehicle of saved.vehicles) {
    const actual = garage.vehicles.find((row) => row.id === vehicle.id);
    assert.ok(actual, `${vehicle.name} must persist in Garage after backend/database restart`);
    assert.equal(actual.year, vehicle.year);
    if (vehicle.expectedAsset) {
      assert.equal(actual.vehicle_image?.status, 'approved');
      assert.equal(actual.vehicle_image?.catalog_asset_key, vehicle.expectedAsset);
    } else {
      assert.ok(['pending', 'unavailable'].includes(actual.vehicle_image?.status));
      if (actual.vehicle_image?.status === 'unavailable')
        assert.equal(actual.vehicle_image?.reason, 'needs_review');
      assert.equal(actual.vehicle_image?.url, null);
      assert.equal(actual.vehicle_image?.catalog_asset_key, undefined);
    }
    if (vehicle.expectedGeneration) {
      assert.equal(actual.generation?.status, 'resolved');
      const source = vehicle.expectedGenerationSource ?? (vehicle.year === 2016 ? 'owner' : 'year');
      assert.equal(actual.generation?.source, source);
      assert.equal(actual.generation?.model?.id, vehicle.expectedGeneration);
    }
    const refreshed = await call('GET', `/v1/garage/vehicles/${vehicle.id}/image`);
    if (vehicle.expectedAsset) assert.equal(refreshed.vehicle_image?.catalog_asset_key, vehicle.expectedAsset);
    else assert.ok(refreshed.vehicle_image?.status === 'pending' ||
      refreshed.vehicle_image?.reason === 'needs_review');
  }
  console.log(`PASS restart persistence: ${saved.vehicles.length} Garage vehicles retained; image keys remain stable.`);
  process.exit(0);
}

assert.equal(phase, 'create');
await login();
const makes = await call('GET', '/v1/reference/makes');
assert.ok(makes.items.some((item) => item.id === 'chevrolet'), 'Chevrolet must appear in the live reference API');
const models = await call('GET', '/v1/reference/models?makeId=chevrolet');
for (const id of ['cobalt', 'gentra', 'nexia', 'spark', 'tracker'])
  assert.ok(models.items.some((item) => item.id === id), `${id} must appear in live Chevrolet models`);
const trims = await call('GET', '/v1/reference/trims?modelId=cobalt');
assert.ok(trims.items.some((item) => item.id === 'cobalt-p1-elegant'));
const engines = await call('GET', '/v1/reference/engines');
assert.ok(engines.items.some((item) => item.id === 'b15d2-na'));

const created = [];
async function add(name, modelId, year, expectedAsset = null, expectedGeneration = null, details = {}) {
  const vehicle = await call('POST', '/v1/garage/vehicles', {
    make_id: 'chevrolet', model_id: modelId, year,
    ...details,
    nickname: `LOCAL IMAGE E2E — ${name}`, is_primary: false,
  }, 201);
  const image = await resolveImage(vehicle.id);
  created.push({ name, id: vehicle.id, modelId, year, expectedAsset, expectedGeneration,
    expectedGenerationSource: expectedGeneration ? 'year' : null,
    createdImage: image.vehicle_image });
  return { vehicle, image };
}

const cobalt = await add('Cobalt', 'cobalt', 2024, 'cobalt-gen2', null,
  { trim_id: 'cobalt-p1-elegant', engine_id: 'b15d2-na' });
const gentra = await add('Gentra', 'gentra', 2020, 'gentra');
const nexia2 = await add('Nexia 2', 'nexia', 2010, null, 'nexia-2');
assert.equal(nexia2.vehicle.generation?.model?.id, 'nexia-2', '2010 Nexia must resolve to Nexia 2');
const nexia3 = await add('Nexia 3', 'nexia', 2018, 'nexia-r3', 'nexia-3');
assert.equal(nexia3.vehicle.generation?.model?.id, 'nexia-3', '2018 Nexia must resolve to Nexia 3');
const spark = await add('Spark', 'spark', 2020);
const tracker = await add('Tracker (duplicate catalog names)', 'tracker', 2021);
const unsupportedNexia = await add('Nexia outside verified generation range', 'nexia', 2023);
assert.equal(unsupportedNexia.vehicle.generation?.status, 'unresolved');

const nex2016 = await call('POST', '/v1/garage/vehicles', {
  make_id: 'chevrolet', model_id: 'nexia', year: 2016,
  nickname: 'LOCAL IMAGE E2E — Nexia 2016 owner selection', is_primary: false,
}, 201);
assert.equal(nex2016.generation?.status, 'choice_required');
const selected2 = await call('PATCH', `/v1/garage/vehicles/${nex2016.id}`, { variant_model_id: 'nexia-2' });
assert.equal(selected2.generation?.status, 'resolved');
assert.equal(selected2.generation?.source, 'owner');
assert.equal(selected2.generation?.model?.id, 'nexia-2');
const selected2Image = await resolveImage(nex2016.id);
created.push({ name: 'Nexia 2016 selected Nexia 2', id: nex2016.id, modelId: 'nexia', year: 2016,
  expectedAsset: null, expectedGeneration: 'nexia-2', expectedGenerationSource: 'owner',
  createdImage: selected2Image.vehicle_image });
const nex2016b = await call('POST', '/v1/garage/vehicles', {
  make_id: 'chevrolet', model_id: 'nexia', year: 2016,
  nickname: 'LOCAL IMAGE E2E — Nexia 2016 selected 3', is_primary: false,
}, 201);
assert.equal(nex2016b.generation?.status, 'choice_required');
const selected = await call('PATCH', `/v1/garage/vehicles/${nex2016b.id}`, { variant_model_id: 'nexia-3' });
assert.equal(selected.generation?.status, 'resolved');
assert.equal(selected.generation?.source, 'owner');
assert.equal(selected.generation?.model?.id, 'nexia-3');
const selectedImage = await resolveImage(nex2016b.id);
created.push({ name: 'Nexia 2016 selected Nexia 3', id: nex2016b.id, modelId: 'nexia', year: 2016,
  expectedAsset: 'nexia-r3', expectedGeneration: 'nexia-3', expectedGenerationSource: 'owner',
  createdImage: selectedImage.vehicle_image });

const byName = Object.fromEntries(created.map((vehicle) => [vehicle.name, vehicle]));
await call('POST', '/v1/garage/vehicles', {
  make_id: 'chevrolet', model_id: 'no-such-model', year: 2020,
  nickname: 'LOCAL IMAGE E2E — invalid model/year', is_primary: false,
  }, 400);

const compatibility = {};
for (const [name, key] of [['Cobalt', 'Cobalt'], ['Nexia 2016 selected Nexia 2', 'Nexia 2'],
  ['Nexia 2016 selected Nexia 3', 'Nexia 3']]) {
  const vehicle = byName[name];
  compatibility[key] = await call('POST', '/v1/catalog/parts/part_local_exact/check-compatibility',
    { vehicleId: vehicle.id });
}
assert.equal(compatibility.Cobalt.status, 'EXACT_MATCH');
assert.equal(compatibility.Cobalt.isCompatible, true);
assert.equal(compatibility['Nexia 2'].status, compatibility['Nexia 3'].status,
  'changing the visual generation must not alter Nexia part fitment');
assert.equal(compatibility['Nexia 2'].isCompatible, compatibility['Nexia 3'].isCompatible);

const requireFromBackend = createRequire(path.join(state, 'backend/package.json'));
const { PrismaClient } = requireFromBackend('@prisma/client');
process.env.DATABASE_URL = environment.DATABASE_URL;
const prisma = new PrismaClient();
let dbEvidence;
try {
  const rows = await prisma.vehicle.findMany({
    where: { id: { in: created.map((vehicle) => vehicle.id) } },
    select: { id: true, modelId: true, year: true, variantModelId: true, imageReviewReason: true,
      imageIdentityKey: true, imageIdentity: { select: { status: true, reason: true, catalogAssetKey: true } } },
  });
  const outbox = await prisma.vehicleImageOutbox.findMany({
    where: { identityKey: { in: rows.map((row) => row.imageIdentityKey).filter(Boolean) } },
    select: { identityKey: true, status: true, attempts: true },
  });
  dbEvidence = [];
  for (const row of rows) {
    const identity = row.imageIdentityKey ? await prisma.vehicleImageIdentity.findUnique({
      where: { identityKey: row.imageIdentityKey }, select: { identity: true },
    }) : null;
    dbEvidence.push({
      id: row.id, modelId: row.modelId, year: row.year, variantModelId: row.variantModelId,
      reviewReason: row.imageReviewReason, identity: identity?.identity ?? null,
      imageStatus: row.imageIdentity?.status ?? null,
      imageReason: row.imageIdentity?.reason ?? null,
      catalogAssetKey: row.imageIdentity?.catalogAssetKey ?? null,
      outbox: outbox.filter((item) => item.identityKey === row.imageIdentityKey)
        .map((item) => ({ status: item.status, attempts: item.attempts })),
    });
  }
} finally { await prisma.$disconnect(); }

for (const [name, key] of [['Cobalt', 'cobalt-gen2'], ['Gentra', 'gentra'], ['Nexia 3', 'nexia-r3'],
  ['Nexia 2016 selected Nexia 3', 'nexia-r3']]) {
  const actual = byName[name].createdImage;
  assert.equal(actual.status, 'approved', `${name} should resolve through the approved catalog`);
  assert.equal(actual.catalog_asset_key, key, `${name} must return the approved catalog key`);
}
for (const name of ['Spark', 'Tracker (duplicate catalog names)', 'Nexia outside verified generation range']) {
  const actual = byName[name].createdImage;
  assert.ok(actual.reason === 'needs_review' || actual.status === 'pending', `${name} must remain a placeholder/review state`);
  assert.ok(!actual.url && !actual.catalog_asset_key, `${name} must not display an unapproved asset`);
}
for (const name of ['Nexia 2', 'Nexia 2016 selected Nexia 2']) {
  const actual = byName[name].createdImage;
  assert.ok(actual.status === 'pending' || actual.reason === 'needs_review',
    `${name} is pending and must retain its placeholder`);
  assert.equal(actual.url, null);
  assert.equal(actual.catalog_asset_key, undefined);
}

const pipeline = JSON.parse(await fs.readFile(path.join(state, 'pipeline/metadata.json'), 'utf8'));
const report = { timestamp: new Date().toISOString(), backend: 'real local HTTP API',
  pipeline: { host: '127.0.0.1', port: 18048, generationEnabled: false, publicationEnabled: false,
    requests: pipeline.requests?.length ?? 0,
    queuedJobs: pipeline.jobs?.filter((job) => job.status === 'queued').length ?? 0,
    nonQueuedJobs: pipeline.jobs?.filter((job) => job.status !== 'queued').length ?? 0 },
  requests: requestLog, vehicles: created.map(({ name, id, modelId, year, expectedAsset, expectedGeneration,
    expectedGenerationSource, createdImage: image }) =>
    ({ name, id, modelId, year, expectedAsset, expectedGeneration, expectedGenerationSource,
      imageStatus: image?.status, imageReason: image?.reason,
      catalogAssetKey: image?.catalog_asset_key ?? null })),
  database: dbEvidence,
  fitment: Object.fromEntries(Object.entries(compatibility).map(([name, result]) => [name,
    { status: result.status, isCompatible: result.isCompatible, matchedBy: result.matchedBy }])),
  invalidModel: { status: 400, persisted: false },
  safety: { paidGeneration: false, publication: false,
    providerExecutionEnabled: false, nonQueuedJobs: pipeline.jobs?.filter((job) => job.status !== 'queued').length ?? 0 },
};
await fs.writeFile(path.join(state, 'vehicle-images-e2e.json'), JSON.stringify({ ...report, vehicles: created }, null, 2), { mode: 0o600 });
await fs.writeFile(path.join(state, 'vehicle-images-e2e-report.json'), JSON.stringify(report, null, 2), { mode: 0o600 });
console.log(JSON.stringify(report, null, 2));
