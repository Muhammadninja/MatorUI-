import { describe, expect, test } from 'vitest';

import en from '../../locales/en.json';
import ru from '../../locales/ru.json';
import uz from '../../locales/uz.json';
import {
  approvedImageUrl,
  IMAGE_STATUS_POLL_DELAYS_MS,
  nextImagePollDelay,
  parseVehicleImage,
  placeholderMessageKey,
} from './image-status';

const URL_V2 = 'https://res.cloudinary.com/mator/image/upload/mator/vehicle-images/abc/v2.webp';

describe('parseVehicleImage (backend vehicle_image)', () => {
  test('approved with an https url is the image', () => {
    expect(parseVehicleImage({ status: 'approved', url: URL_V2, version: 2, reason: null })).toEqual({
      status: 'approved',
      url: URL_V2,
      version: 2,
    });
  });

  test('keeps license credit and source links on an approved Commons image', () => {
    expect(parseVehicleImage({ status: 'approved', url: URL_V2, version: 2,
      attribution: 'Photographer / Commons', author: 'Photographer', license: 'CC-BY-4.0',
      license_url: 'https://creativecommons.org/licenses/by/4.0/',
      source_page: 'https://commons.wikimedia.org/wiki/File:Car.jpg',
      source_title: 'File:Car.jpg', modifications: 'Resized and converted to WebP' })).toMatchObject({
      attribution: 'Photographer / Commons', author: 'Photographer', license: 'CC-BY-4.0',
      licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
      sourcePage: 'https://commons.wikimedia.org/wiki/File:Car.jpg',
      sourceTitle: 'File:Car.jpg', modifications: 'Resized and converted to WebP',
    });
  });

  test('pending and unavailable never carry a url', () => {
    expect(parseVehicleImage({ status: 'pending', url: URL_V2, version: 1, reason: null })).toEqual({
      status: 'pending',
      url: null,
      version: null,
    });
    expect(parseVehicleImage({ status: 'unavailable', url: null, version: null, reason: 'rejected' })).toEqual({
      status: 'unavailable',
      url: null,
      version: null,
      reason: 'rejected',
    });
  });

  test.each([null, '/published/abc/v1', 'http://cdn.test/a.webp', 'https://'])(
    'approved without a usable https url (%s) reads as pending',
    (url) => {
      expect(parseVehicleImage({ status: 'approved', url, version: 1 })?.status).toBe('pending');
    },
  );

  test.each([undefined, null, 'approved', {}, { status: 'queued' }])('ignores a missing or unknown field (%j)', (raw) => {
    expect(parseVehicleImage(raw)).toBeUndefined();
  });

  test('approvedImageUrl only for approved', () => {
    expect(approvedImageUrl({ status: 'approved', url: URL_V2, version: 2 })).toBe(URL_V2);
    expect(approvedImageUrl({ status: 'pending', url: null, version: null })).toBeNull();
    expect(approvedImageUrl(undefined)).toBeNull();
  });
});

describe('placeholderMessageKey', () => {
  test.each(['pending', null, undefined] as const)('1.0 (pipeline frozen): %s promises nothing', (status) => {
    expect(placeholderMessageKey(status)).toBe('vehicleImage.unavailable');
    expect(placeholderMessageKey(status, 'awaiting_review')).toBe('vehicleImage.unavailable');
  });

  test.each(['pending', null, undefined] as const)('with pipeline progress on, %s reads as being prepared', (status) => {
    expect(placeholderMessageKey(status, null, true)).toBe('vehicleImage.preparing');
    expect(placeholderMessageKey(status, 'awaiting_review', true)).toBe('vehicleImage.awaitingReview');
  });

  test('unavailable promises nothing', () => {
    expect(placeholderMessageKey('unavailable')).toBe('vehicleImage.unavailable');
  });

  test('both messages exist in every language', () => {
    for (const locale of [en, ru, uz]) {
      expect(locale.vehicleImage.preparing).toBeTruthy();
      expect(locale.vehicleImage.unavailable).toBeTruthy();
    }
    expect(ru.vehicleImage.preparing).toBe('Изображение готовится');
  });
});

describe('pending refresh schedule', () => {
  test('backs off and then stops: no endless polling', () => {
    expect(IMAGE_STATUS_POLL_DELAYS_MS.map((_, i) => nextImagePollDelay(i))).toEqual([
      30_000, 60_000, 120_000, 300_000, 600_000,
    ]);
    expect(nextImagePollDelay(IMAGE_STATUS_POLL_DELAYS_MS.length)).toBe(false);
    expect(nextImagePollDelay(100)).toBe(false);
  });

  test('a pending image says why: being prepared or being checked by a person', async () => {
    const { parseVehicleImage: parse, placeholderMessageKey: key } = await import('./image-status');
    expect(parse({ status: 'pending', stage: 'awaiting_review', url: null, version: null }))
      .toEqual({ status: 'pending', url: null, version: null, stage: 'awaiting_review' });
    expect(parse({ status: 'pending', stage: 'bogus', url: null, version: null }))
      .toEqual({ status: 'pending', url: null, version: null });
    expect(key('pending', 'awaiting_review', true)).toBe('vehicleImage.awaitingReview');
    expect(key('pending', 'processing', true)).toBe('vehicleImage.preparing');
    expect(key('pending', null, true)).toBe('vehicleImage.preparing');
    expect(key('unavailable', 'awaiting_review')).toBe('vehicleImage.unavailable');
  });
});

