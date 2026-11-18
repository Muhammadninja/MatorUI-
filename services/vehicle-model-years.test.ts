import { describe, expect, test } from 'vitest';

import { ApiError } from './api-client';
import { DEFAULT_YEARS_BACK, modelYearChoices, unsupportedYearRange } from './vehicle-model-years';

describe('modelYearChoices', () => {
  test('a discontinued model offers only its build years, newest first (Lacetti 2026 is not offered)', () => {
    const years = modelYearChoices({ yearFrom: 2002, yearTo: 2024 }, 2026);
    expect(years[0]).toBe(2024);
    expect(years.at(-1)).toBe(2002);
    expect(years).toHaveLength(23);
    expect(years).not.toContain(2026);
  });

  test('a model still produced stops at this year, never next year the backend accepts', () => {
    expect(modelYearChoices({ yearFrom: 2023, yearTo: 2027 }, 2026)).toEqual([2026, 2025, 2024, 2023]);
  });

  test('no stated start keeps the open window back from this year', () => {
    const years = modelYearChoices({ yearFrom: null, yearTo: 2027 }, 2026);
    expect(years[0]).toBe(2026);
    expect(years).toHaveLength(DEFAULT_YEARS_BACK);
  });

  test('an older backend or the bundled catalog (no range) keeps the previous behaviour', () => {
    expect(modelYearChoices({}, 2026)).toEqual(modelYearChoices(undefined, 2026));
    expect(modelYearChoices(undefined, 2026)).toHaveLength(DEFAULT_YEARS_BACK);
  });
});

describe('unsupportedYearRange', () => {
  const rejection = (details: unknown) =>
    new ApiError(400, 'VEHICLE_YEAR_UNSUPPORTED', 'Lacetti is not available for 2026.', {
      code: 'VEHICLE_YEAR_UNSUPPORTED', message: 'Lacetti is not available for 2026.', details,
    });

  test('reads the range from the backend rejection', () => {
    expect(unsupportedYearRange(rejection({ year: 2026, year_from: 2002, year_to: 2024 })))
      .toEqual({ yearFrom: 2002, yearTo: 2024 });
    expect(unsupportedYearRange(rejection({ year: 1990, year_from: null, year_to: 2024 })))
      .toEqual({ yearFrom: null, yearTo: 2024 });
  });

  test('anything else is not a year rejection', () => {
    expect(unsupportedYearRange(new ApiError(400, 'BAD_REQUEST', 'x'))).toBeNull();
    expect(unsupportedYearRange(new Error('network'))).toBeNull();
    expect(unsupportedYearRange(rejection({ year_from: 2002 }))).toBeNull();
  });
});
