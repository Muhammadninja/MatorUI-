import { describe, expect, test } from 'vitest';

import en from '../../locales/en.json';
import ru from '../../locales/ru.json';
import uz from '../../locales/uz.json';
import { placeholderMessageKey, type VehicleImageStatus } from './image-status';

describe('placeholderMessageKey', () => {
  test.each<VehicleImageStatus | null | undefined>(['queued', 'generating', 'pending_review', 'approved', null, undefined])(
    'an image on its way (%s) reads as being prepared',
    (status) => {
      expect(placeholderMessageKey(status)).toBe('vehicleImage.preparing');
    },
  );

  test.each<VehicleImageStatus>(['failed', 'unavailable'])('%s promises nothing', (status) => {
    expect(placeholderMessageKey(status)).toBe('vehicleImage.unavailable');
  });

  test('both messages exist in every language', () => {
    for (const locale of [en, ru, uz]) {
      expect(locale.vehicleImage.preparing).toBeTruthy();
      expect(locale.vehicleImage.unavailable).toBeTruthy();
    }
    expect(ru.vehicleImage.preparing).toBe('Изображение готовится');
  });
});
