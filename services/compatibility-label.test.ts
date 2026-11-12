import { describe, expect, test } from 'vitest';

import en from '../locales/en.json';
import ru from '../locales/ru.json';
import uz from '../locales/uz.json';
import { compatibilityLabelKey, compatibilityVerdict } from './compatibility-service';

const read = (locale: Record<string, unknown>, key: string) =>
  key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown>)[part], locale) as string;

describe('compatibility badge from the API status', () => {
  test.each([
    ['EXACT_MATCH', 'compatible', 'itemDetail.fitConfirmed'],
    ['UNIVERSAL', 'compatible', 'catalog.universalFit'],
    ['NOT_COMPATIBLE', 'incompatible', 'itemDetail.fitNotCompatible'],
    ['UNCERTAIN', 'unknown', 'itemDetail.fitUnknown'],
    ['SOMETHING_NEW', 'unknown', 'itemDetail.fitUnknown'],
  ])('%s → %s, %s', (status, verdict, key) => {
    expect(compatibilityVerdict(status)).toBe(verdict);
    expect(compatibilityLabelKey(status)).toBe(key);
  });

  test('an unconfirmed fit says so in every language', () => {
    expect(read(en, 'itemDetail.fitUnknown')).toBe('Compatibility not confirmed');
    expect(read(ru, 'itemDetail.fitUnknown')).toBe('Совместимость не установлена');
    expect(read(uz, 'itemDetail.fitUnknown')).toBe('Moslik tasdiqlanmagan');
  });

  test('the model list names its scope, distinct from a fit verdict', () => {
    expect(read(en, 'vehicleParts.forMyModel')).toBe('For my model');
    expect(read(ru, 'vehicleParts.forMyModel')).toBe('По моей модели');
    expect(read(ru, 'vehicleParts.forMyModel')).not.toBe(read(ru, 'itemDetail.fitConfirmed'));
  });
});
