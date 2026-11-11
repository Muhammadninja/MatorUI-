/**
 * Category art must keep true transparency: a flattened export (RGB on a baked
 * white backdrop) shows as a white square on the dark card. Two of the
 * 2026-11-10 candidates arrived that way and had to be cut out first.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

const DIR = join(__dirname, '../assets/categories');
const files = readdirSync(DIR).filter((f) => f.endsWith('.png'));

describe('approved category art', () => {
  test('is all there', () => {
    expect(files.sort()).toEqual([
      'brakes-rotor-caliper.png',
      'climate-ac-compressor.png',
      'electrical-battery.png',
      'engine-turbo.png',
      'suspension-coilover.png',
      'transmission-gearbox.png',
    ]);
  });

  test.each(files)('%s is an RGBA PNG, 1024 square', (file) => {
    const png = readFileSync(join(DIR, file));
    // IHDR: width @16, height @20, bit depth @24, colour type @25 (6 = RGBA).
    expect(png.subarray(1, 4).toString('latin1')).toBe('PNG');
    expect(png.readUInt32BE(16)).toBe(1024);
    expect(png.readUInt32BE(20)).toBe(1024);
    expect(png[25]).toBe(6);
  });
});
