import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const serverEntrypoint = fileURLToPath(new URL('../scripts/vehicle-image-server.mjs', import.meta.url));

describe('vehicle image server entrypoint', () => {
  it('parses with the deployed Node runtime before release', () => {
    expect(() => execFileSync(process.execPath, ['--check', serverEntrypoint])).not.toThrow();
  });
});
