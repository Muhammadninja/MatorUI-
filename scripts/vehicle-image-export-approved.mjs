import { createHash } from 'node:crypto';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const args = Object.fromEntries(process.argv.slice(2).map((arg) => {
  const [key, ...value] = arg.replace(/^--/, '').split('=');
  return [key, value.join('=')];
}));
if (!args['source-dir'] || !args['output-dir']) {
  console.error('Usage: node scripts/vehicle-image-export-approved.mjs --source-dir=/path/to/pipeline-data --output-dir=/secure/export');
  process.exit(2);
}
const sourceDir = path.resolve(args['source-dir']);
const outputDir = path.resolve(args['output-dir']);
const registry = JSON.parse(await readFile(path.join(sourceDir, 'metadata.json'), 'utf8'));
const request = registry.requests.find((entry) => entry.identityKey === 'byd|han|2024|||||');
const publication = registry.published.find((entry) =>
  entry.identityKey === request?.identityKey && entry.version === 1,
);
const candidate = registry.candidates.find((entry) =>
  entry.id === publication?.candidateId && entry.status === 'approved' && entry.contentType === 'image/webp',
);
if (!request || !publication || !candidate)
  throw new Error('approved BYD Han 2024 Published v1 asset was not found');
const bytes = await readFile(path.join(sourceDir, 'private', candidate.id));
const metadata = await sharp(bytes).metadata();
if (metadata.format !== 'webp' || metadata.width !== 1200 || metadata.height !== 600 || !metadata.hasAlpha)
  throw new Error('approved source asset failed WebP, dimensions or alpha validation');
await mkdir(outputDir, { recursive: true, mode: 0o700 });
const outputMetadata = await stat(outputDir);
if (!outputMetadata.isDirectory() || (outputMetadata.mode & 0o077) !== 0)
  throw new Error('export directory must be a private directory with owner-only permissions');
await writeFile(path.join(outputDir, 'byd-han-2024-v1.webp'), bytes, { mode: 0o600, flag: 'wx' });
const manifest = {
  vehicle: { manufacturer: request.vehicle.manufacturer, model: request.vehicle.model, year: request.vehicle.year },
  identityKey: request.identityKey,
  version: 1,
  sourceCandidateId: candidate.id,
  contentType: 'image/webp',
  width: metadata.width,
  height: metadata.height,
  hasAlpha: metadata.hasAlpha,
  sizeBytes: bytes.length,
  sha256: createHash('sha256').update(bytes).digest('hex'),
  exportedAt: new Date().toISOString(),
};
await writeFile(path.join(outputDir, 'manifest.json'), JSON.stringify(manifest, null, 2), { mode: 0o600, flag: 'wx' });
console.log(JSON.stringify({ outputDir, file: 'byd-han-2024-v1.webp', sizeBytes: bytes.length, sha256: manifest.sha256 }));
