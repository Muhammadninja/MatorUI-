import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { createVehicleImagePipeline } from '../services/vehicle-image-pipeline.mjs';
import { createImageProvider } from '../services/vehicle-image-provider.mjs';

const cases = [
  {
    slug: 'chevrolet-captiva-2020',
    vehicle: { manufacturer: 'Chevrolet', model: 'Captiva', year: 2020, exteriorColor: 'White' },
    referenceSource:
      'https://www.chevroletarabia.com/content/dam/chevrolet/middle-east/egypt/english/index/download-a-brochure/2020-brochures/Captiva_brochure.pdf',
  },
  {
    slug: 'byd-han-2024',
    vehicle: { manufacturer: 'BYD', model: 'Han', year: 2024 },
    referenceSource: 'https://www.byd.com/material/byd-site/eu/pdfs/han/HAN-0224-BPS-EN-V5-web.pdf',
  },
  {
    slug: 'genesis-gv80-2025',
    vehicle: { manufacturer: 'Genesis', model: 'GV80', year: 2025, facelift: '2024 refresh' },
    referenceSource: 'https://newsroom.genesis.com/genesis-gv80/',
  },
];

const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry-run');
const checkConfig = args.has('--check-config');

async function loadSecretEnvFile() {
  if (process.env.OPENAI_API_KEY || !process.env.VEHICLE_IMAGE_ENV_FILE) return;
  const source = path.resolve(process.env.VEHICLE_IMAGE_ENV_FILE);
  const metadata = await stat(source);
  if (!metadata.isFile() || (metadata.mode & 0o077) !== 0) {
    throw new Error(
      'configured environment file must be a regular file with owner-only permissions',
    );
  }
  const contents = await readFile(source, 'utf8');
  for (const line of contents.split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?OPENAI_API_KEY\s*=\s*(.*?)\s*$/);
    if (!match) continue;
    let value = match[1];
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    )
      value = value.slice(1, -1);
    else value = value.replace(/\s+#.*$/, '').trim();
    if (value) process.env.OPENAI_API_KEY = value;
    break;
  }
}

await loadSecretEnvFile();
if (checkConfig) {
  console.log(
    JSON.stringify(
      {
        cwd: process.cwd(),
        dotenvAutoLoaded: false,
        externalEnvFileConfigured: Boolean(process.env.VEHICLE_IMAGE_ENV_FILE),
        openAiApiKeyAvailable: Boolean(process.env.OPENAI_API_KEY),
        model: process.env.VEHICLE_IMAGE_MODEL ?? 'gpt-image-2.6-sunburst',
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

const caseArg = [...args].find((arg) => arg.startsWith('--case='));
const selectedCase = caseArg ? caseArg.slice('--case='.length) : null;
if (selectedCase && !cases.some((item) => item.slug === selectedCase)) {
  console.error('Unknown validation case.');
  process.exit(2);
}
const selectedCases = selectedCase ? cases.filter((item) => item.slug === selectedCase) : cases;
if (!dryRun && !args.has('--confirm-paid-generation')) {
  console.error(
    'No API calls made. After explicit cost authorization, pass --confirm-paid-generation.',
  );
  process.exit(2);
}
if (!dryRun && !process.env.OPENAI_API_KEY) {
  console.error(
    'Set OPENAI_API_KEY in the process environment; do not put it in a file or command history.',
  );
  process.exit(2);
}

const dataDir = path.resolve(
  process.env.VEHICLE_IMAGE_VALIDATION_DIR ?? '/private/tmp/mator-vehicle-image-validation',
);
const referenceDir = process.env.VEHICLE_IMAGE_REFERENCE_DIR
  ? path.resolve(process.env.VEHICLE_IMAGE_REFERENCE_DIR)
  : null;
const token = randomBytes(32).toString('hex');
const provider = dryRun ? null : createImageProvider();
const pipeline = createVehicleImagePipeline({
  dataDir,
  adminToken: token,
  provider,
  autoRun: false,
  maxAttempts: 1,
  jobTimeoutMs: 180_000,
});
await pipeline.initialize();

function html(value) {
  return String(value).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
}

async function referenceFor(testCase) {
  if (!referenceDir) return [];
  const names = await readdir(referenceDir).catch(() => []);
  const name = names.find(
    (entry) => entry.startsWith(testCase.slug + '.') && /\.(png|jpe?g|webp)$/i.test(entry),
  );
  if (!name) return [];
  const bytes = await readFile(path.join(referenceDir, name));
  const ext = path.extname(name).toLowerCase();
  const contentType = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
  return [{ data: bytes.toString('base64'), contentType }];
}

const records = [];
for (const testCase of selectedCases) {
  const references = await referenceFor(testCase);
  const first = await pipeline.submitRequest(testCase.vehicle, references);
  const duplicate = await pipeline.submitRequest(testCase.vehicle);
  records.push({
    slug: testCase.slug,
    vehicle: testCase.vehicle,
    requestId: first.request.id,
    jobId: first.job?.id ?? first.activeJob?.id ?? null,
    duplicateReusedRequest: duplicate.request.id === first.request.id,
    duplicateReusedJob: Boolean(
      (first.job?.id ?? first.activeJob?.id) &&
      duplicate.activeJob?.id === (first.job?.id ?? first.activeJob?.id),
    ),
    reusedApprovedAsset: first.reused,
    referenceCount: first.request.referenceAssets?.length ?? 0,
    referenceSource: testCase.referenceSource,
  });
}

if (!dryRun) await pipeline.runQueuedJobs();
const db = JSON.parse(await readFile(path.join(dataDir, 'metadata.json'), 'utf8'));
for (const record of records) {
  const request = db.requests.find((item) => item.id === record.requestId);
  const job = db.jobs.find((item) => item.id === record.jobId);
  record.status =
    job?.status ?? (request?.status === 'approved' ? 'reused-approved-asset' : 'no-job');
  record.candidateId = job?.resultCandidateId ?? null;
  Object.assign(
    record,
    job
      ? {
          attempts: job.attempts,
          providerLatencyMs: job.providerLatencyMs,
          providerRequestId: job.providerRequestId,
          providerHttpStatus: job.providerHttpStatus,
          providerErrorCode: job.providerErrorCode,
          transportDiagnostics: job.transportDiagnostics,
          processingLatencyMs: job.processingLatencyMs,
          providerUsage: job.providerUsage,
          estimatedCostUsd: job.estimatedCostUsd,
          error: job.lastError,
        }
      : {},
  );
}
const manifest = {
  createdAt: new Date().toISOString(),
  mode: dryRun ? 'dry-run-no-provider-calls' : 'paid-generation',
  provider: process.env.VEHICLE_IMAGE_PROVIDER ?? 'openai',
  model: process.env.VEHICLE_IMAGE_MODEL ?? 'gpt-image-2.6-sunburst',
  noAutomaticApprovalOrPublication: true,
  outputContract: '1200x600 transparent WebP',
  cases: records,
};
await mkdir(dataDir, { recursive: true, mode: 0o700 });
await writeFile(path.join(dataDir, 'validation-manifest.json'), JSON.stringify(manifest, null, 2), {
  mode: 0o600,
});
const cards = records
  .map((record) => {
    const candidate = db.candidates.find((item) => item.id === record.candidateId);
    return `<article><h2>${html(record.vehicle.manufacturer)} ${html(record.vehicle.model)} ${record.vehicle.year}</h2><p>Status: ${html(record.status)} · Candidate: ${html(record.candidateId ?? 'none')}</p>${candidate ? `<img src="private/${html(candidate.id)}" alt="Private candidate for manual identity review">` : '<p>No candidate yet.</p>'}<pre>${html(JSON.stringify({ providerLatencyMs: record.providerLatencyMs, processingLatencyMs: record.processingLatencyMs, providerUsage: record.providerUsage, estimatedCostUsd: record.estimatedCostUsd, error: record.error }, null, 2))}</pre></article>`;
  })
  .join('\n');
await writeFile(
  path.join(dataDir, 'preview.html'),
  `<!doctype html><meta charset="utf-8"><title>Private vehicle image candidates</title><style>body{font:16px system-ui;background:#222;color:#eee;margin:2rem}article{margin:2rem 0;padding:1rem;background:#333}img{display:block;width:min(100%,1200px);background:repeating-conic-gradient(#aaa 0 25%,#eee 0 50%) 0/20px 20px}pre{white-space:pre-wrap}</style><h1>Private candidates — visual vehicle accuracy requires manual review</h1>${cards}`,
  { mode: 0o600 },
);
console.log(
  JSON.stringify(
    {
      dataDir,
      mode: manifest.mode,
      candidates: records.map(
        ({
          slug,
          status,
          candidateId,
          providerLatencyMs,
          processingLatencyMs,
          estimatedCostUsd,
          duplicateReusedRequest,
          duplicateReusedJob,
        }) => ({
          slug,
          status,
          candidateId,
          providerLatencyMs,
          processingLatencyMs,
          estimatedCostUsd,
          duplicateReusedRequest,
          duplicateReusedJob,
        }),
      ),
      preview: path.join(dataDir, 'preview.html'),
      autoApproval: false,
    },
    null,
    2,
  ),
);
