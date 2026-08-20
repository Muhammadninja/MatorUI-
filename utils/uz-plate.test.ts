import { describe, expect, test } from 'vitest';

import { formatUzPlate, isValidUzPlate, normalizeUzPlate } from './uz-plate';

describe('normalizeUzPlate — slot-aware mask', () => {
  test('canonicalizes Format A (letter · 3 digits · 2 letters)', () => {
    expect(normalizeUzPlate('01A123BC')).toBe('01A123BC');
    expect(normalizeUzPlate('01 a 123 bc')).toBe('01A123BC');
    expect(normalizeUzPlate('  01-A-123-BC ')).toBe('01A123BC');
  });

  test('canonicalizes Format B (3 digits · 3 letters)', () => {
    expect(normalizeUzPlate('10777AFG')).toBe('10777AFG');
    expect(normalizeUzPlate('10 777 afg')).toBe('10777AFG');
    expect(normalizeUzPlate('10| 777afg')).toBe('10777AFG');
  });

  test('keeps partial input as the user types', () => {
    expect(normalizeUzPlate('0')).toBe('0');
    expect(normalizeUzPlate('01')).toBe('01');
    expect(normalizeUzPlate('01A')).toBe('01A');
    expect(normalizeUzPlate('01A12')).toBe('01A12');
  });

  test('drops characters that do not fit the next slot of the committed format', () => {
    // Format A (letter after region): a stray digit in a letter slot is skipped.
    expect(normalizeUzPlate('01A1239BC')).toBe('01A123BC');
    // Format B (digit after region): a stray letter inside the number is skipped.
    expect(normalizeUzPlate('107A77AFG')).toBe('10777AFG');
  });

  test('never exceeds 8 characters', () => {
    expect(normalizeUzPlate('01A123BCEXTRA')).toBe('01A123BC');
  });
});

describe('formatUzPlate — grouped display', () => {
  test('groups Format A: region · series · number · series', () => {
    expect(formatUzPlate('01A123BC')).toBe('01 A 123 BC');
    expect(formatUzPlate('30Z777XY')).toBe('30 Z 777 XY');
  });

  test('groups Format B: region · number · series', () => {
    expect(formatUzPlate('10777AFG')).toBe('10 777 AFG');
    expect(formatUzPlate('10| 777afg')).toBe('10 777 AFG');
  });

  test('groups partial input without trailing separators', () => {
    expect(formatUzPlate('01')).toBe('01');
    expect(formatUzPlate('01A')).toBe('01 A');
    expect(formatUzPlate('01A12')).toBe('01 A 12');
    expect(formatUzPlate('1077')).toBe('10 77');
  });
});

describe('isValidUzPlate', () => {
  test('true for a complete plate in either format', () => {
    expect(isValidUzPlate('01A123BC')).toBe(true);
    expect(isValidUzPlate('01 A 123 BC')).toBe(true);
    expect(isValidUzPlate('10777AFG')).toBe(true);
    expect(isValidUzPlate('10 777 AFG')).toBe(true);
  });

  test('false for incomplete or malformed input', () => {
    expect(isValidUzPlate('')).toBe(false);
    expect(isValidUzPlate('01A123B')).toBe(false); // Format A: one letter short
    expect(isValidUzPlate('10777AF')).toBe(false); // Format B: one letter short
    expect(isValidUzPlate('1A123BC')).toBe(false); // region too short
  });
});
