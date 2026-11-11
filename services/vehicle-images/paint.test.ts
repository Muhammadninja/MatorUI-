import { expect, test } from 'vitest';

import { VEHICLE_COLOR_SWATCHES } from '@/utils/vehicle-color';

import { PAINT_KEYS, PAINT_MATCH_DISTANCE, paintForHex, parseHex } from './paint';

test('every colour the picker offers has its own paint key', () => {
  const paints = VEHICLE_COLOR_SWATCHES.map((s) => paintForHex(s.hex));
  expect(paints).toEqual([...PAINT_KEYS]);
});

test('the match distance can never claim two swatches at once', () => {
  const rgbs = VEHICLE_COLOR_SWATCHES.map((s) => parseHex(s.hex)!);
  for (let i = 0; i < rgbs.length; i++) {
    for (let j = i + 1; j < rgbs.length; j++) {
      const d = Math.hypot(...rgbs[i].map((c, k) => c - rgbs[j][k]));
      expect(d).toBeGreaterThan(PAINT_MATCH_DISTANCE * 2);
    }
  }
});

test('parses only real hex colours', () => {
  expect(parseHex('#c42b2b')).toEqual([196, 43, 43]);
  expect(parseHex(' C42B2B ')).toEqual([196, 43, 43]);
  expect(parseHex('#fff')).toEqual([255, 255, 255]);
  for (const bad of [undefined, null, '', '#12345', '#GGGGGG', 'white']) expect(parseHex(bad)).toBeNull();
});

test('an unmatched or invalid colour is no paint, not black', () => {
  expect(paintForHex('#ZZZZZZ')).toBeNull();
  expect(paintForHex('#7B3FA0')).toBeNull();
  expect(paintForHex('#16181C')).toBe('black');
});
