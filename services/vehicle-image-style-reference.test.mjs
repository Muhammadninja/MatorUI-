import { describe, expect, it } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { loadStyleReference } from './vehicle-image-env.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const COBALT = 'assets/vehicles/chevrolet/cobalt-gen2/white.webp';

describe('loadStyleReference', () => {
  it('is off when unset, so generation runs without a style image', async () => {
    expect(await loadStyleReference(undefined, repoRoot)).toBeNull();
    expect(await loadStyleReference('', repoRoot)).toBeNull();
  });

  it('loads the approved Cobalt from a path relative to the checkout', async () => {
    const reference = await loadStyleReference(COBALT, repoRoot);
    expect(reference.contentType).toBe('image/webp');
    expect(reference.bytes.equals(await readFile(path.join(repoRoot, COBALT)))).toBe(true);
  });

  it('fails at startup on a file that cannot be the style image', async () => {
    await expect(loadStyleReference('README.md', repoRoot)).rejects.toThrow('.png or .webp');
    await expect(loadStyleReference('assets/vehicles/missing.webp', repoRoot)).rejects.toThrow();
  });
});
