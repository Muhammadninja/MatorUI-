import { afterEach, describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadRegistryFile, REGISTRY_FILE, registryFingerprint } from '../services/vehicle-image-registry.mjs';

const script = fileURLToPath(new URL('./vehicle-image-registry-sync.mjs', import.meta.url));
const directories = [];
afterEach(() => { for (const dir of directories.splice(0)) rmSync(dir, { recursive: true, force: true }); });

function backend() {
  const root = mkdtempSync(path.join(os.tmpdir(), 'mator-registry-sync-'));
  directories.push(root);
  const dir = path.join(root, 'src/garage/vehicle-images');
  mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'vehicle-image-catalog.data.ts');
  const sync = (...flags) => spawnSync(process.execPath, [script, '--backend', root, ...flags], { encoding: 'utf8' });
  expect(sync().status).toBe(0);
  return { file, sync };
}

describe('cross-component registry synchronization', () => {
  it('embeds the exact canonical Pipeline bytes and derives the Backend fingerprint from them', () => {
    const { file, sync } = backend();
    const generated = readFileSync(file, 'utf8');
    const source = generated.split('String.raw`')[1].split('`;')[0];
    expect(source).toBe(readFileSync(REGISTRY_FILE, 'utf8'));
    expect(registryFingerprint(source)).toBe(loadRegistryFile().sha256);
    expect(generated).toContain("createHash('sha256')\n  .update(VEHICLE_IMAGE_CATALOG_SOURCE)");
    expect(sync('--check').status).toBe(0);
  });

  it('rejects source drift even when the fingerprint declaration is unchanged', () => {
    const { file, sync } = backend();
    const original = readFileSync(file, 'utf8');
    const changed = original.replace('"trimPrefixes": ["nexia-2-"]', '"trimPrefixes": ["wrong-generation-"]');
    expect(changed).not.toBe(original);
    writeFileSync(file, changed);
    const check = sync('--check');
    expect(check.status).toBe(1);
    expect(check.stderr).toContain('backend registry source or provenance differs');
    expect(readFileSync(file, 'utf8')).toBe(changed); // A check must never repair silently.
  });

  it('rejects a forged checksum or stale generated provenance', () => {
    const { file, sync } = backend();
    writeFileSync(file, readFileSync(file, 'utf8').replace(".digest('hex')", ".digest('hex') + 'forged'"));
    expect(sync('--check').status).toBe(1);
  });
});
