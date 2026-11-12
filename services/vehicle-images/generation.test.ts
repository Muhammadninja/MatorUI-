import { describe, expect, test } from 'vitest';

import {
  optionYears,
  parseVehicleGeneration,
  pictureModelId,
} from './generation';
import { resolveVehicleImage } from './resolver';

const N150 = { id: 'nexia-2', name: 'Nexia 2', year_from: 2008, year_to: 2016 };
const R3 = { id: 'nexia-3', name: 'Nexia 3', year_from: 2016, year_to: 2022 };

describe('parseVehicleGeneration', () => {
  test('reads a year-resolved generation', () => {
    expect(
      parseVehicleGeneration({ status: 'resolved', source: 'year', model: { id: 'nexia-3', name: 'Nexia 3' }, options: [] }),
    ).toEqual({ status: 'resolved', source: 'year', model: { id: 'nexia-3', name: 'Nexia 3' }, options: [] });
  });

  test('reads the backend options for a shared year', () => {
    expect(
      parseVehicleGeneration({ status: 'choice_required', source: null, model: null, options: [N150, R3] }),
    ).toEqual({
      status: 'choice_required',
      source: null,
      model: null,
      options: [
        { id: 'nexia-2', name: 'Nexia 2', yearFrom: 2008, yearTo: 2016 },
        { id: 'nexia-3', name: 'Nexia 3', yearFrom: 2016, yearTo: 2022 },
      ],
    });
  });

  test('an older backend, or anything malformed, is ignored rather than half-shown', () => {
    for (const raw of [
      undefined,
      null,
      'resolved',
      { status: 'guessed' },
      { status: 'resolved', model: null },
      { status: 'resolved', model: { id: '', name: 'X' } },
      { status: 'choice_required', options: [N150] },
      { status: 'choice_required', options: [N150, { id: 7 }] },
    ]) {
      expect(parseVehicleGeneration(raw)).toBeUndefined();
    }
  });

  test('unresolved carries nothing to pick', () => {
    expect(parseVehicleGeneration({ status: 'unresolved', options: [N150] })).toEqual({
      status: 'unresolved',
      source: null,
      model: null,
      options: [],
    });
  });
});

describe('the picture follows the backend, with the existing approved images', () => {
  const chevy = (modelId: string | undefined, trimId?: string) =>
    resolveVehicleImage({ brandId: 'chevrolet', modelId, trimId, year: 2016 });

  test('a resolved Nexia shows that generation’s approved image', () => {
    const r3 = parseVehicleGeneration({ status: 'resolved', source: 'owner', model: { id: 'nexia-3', name: 'Nexia 3' }, options: [N150, R3] });
    const n150 = parseVehicleGeneration({ status: 'resolved', source: 'owner', model: { id: 'nexia-2', name: 'Nexia 2' }, options: [N150, R3] });
    expect(chevy(pictureModelId('nexia', r3))).toMatchObject({ kind: 'image', bodyKey: 'nexia-r3' });
    expect(chevy(pictureModelId('nexia', n150))).toMatchObject({ kind: 'image', bodyKey: 'nexia-n150' });
  });

  test('an open or unresolved generation keeps the placeholder: nothing is guessed', () => {
    for (const raw of [
      { status: 'choice_required', options: [N150, R3] },
      { status: 'unresolved' },
      undefined,
    ]) {
      expect(chevy(pictureModelId('nexia', parseVehicleGeneration(raw)))).toEqual({
        kind: 'placeholder',
        reason: 'generation-unverified',
      });
    }
  });

  test('a trim keeps its own path (the backend sends no generation then)', () => {
    expect(chevy(pictureModelId('nexia', undefined), 'nexia-2-dlx')).toMatchObject({ bodyKey: 'nexia-n150' });
  });

  test('other models are untouched', () => {
    expect(pictureModelId('cobalt', undefined)).toBe('cobalt');
    expect(chevy(pictureModelId('cobalt', undefined))).toMatchObject({ bodyKey: 'cobalt-gen2' });
  });
});

describe('optionYears', () => {
  test('formats the build years the backend sent', () => {
    expect(optionYears({ id: 'a', name: 'A', yearFrom: 2008, yearTo: 2016 })).toBe('2008–2016');
    expect(optionYears({ id: 'a', name: 'A', yearFrom: 2016, yearTo: 2016 })).toBe('2016');
    expect(optionYears({ id: 'a', name: 'A', yearFrom: null, yearTo: 2016 })).toBe('');
  });
});
