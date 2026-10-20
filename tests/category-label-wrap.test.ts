/**
 * The home grid's category labels must keep ONE type size on every device.
 *
 * The bug this pins: "Электрооборудование" is wider than a 31.5% grid cell, so
 * the cell broke it wherever the line ran out ("Электрооборудован / ие"), and
 * the first fix — shrinking the type until the word fit — left that tile set
 * in 9pt beside its 12.5pt neighbours. `softWrapLabel` instead hands the text
 * engine a break opportunity at the word's compound seam, so flexbox wraps it
 * at full size and every tile matches.
 */

import { describe, expect, test } from 'vitest';

import { softWrapLabel } from '@/utils/category-label';

const ZWSP = '​';
/** What a grid cell fits on one line at 12.5pt. */
const MAX = 13;

/** The label as the text engine would lay it out in a cell that wide. */
function lines(label: string, max = MAX): string[] {
  const out: string[] = [];
  let line = '';
  for (const word of softWrapLabel(label, max).split(/(?:\s+|​)/)) {
    const candidate = line ? `${line} ${word}` : word;
    if (candidate.length > max && line) {
      out.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) out.push(line);
  return out;
}

describe('softWrapLabel', () => {
  test('a word that already fits is returned untouched', () => {
    expect(softWrapLabel('Тормоза', MAX)).toBe('Тормоза');
    expect(softWrapLabel('Масла и жидкости', MAX)).toBe('Масла и жидкости');
  });

  test('a long compound breaks at its seam, not mid-syllable', () => {
    expect(softWrapLabel('Электрооборудование', MAX)).toBe(`Электро${ZWSP}оборудование`);
    expect(softWrapLabel('Стеклоочистители', MAX)).toBe(`Стекло${ZWSP}очистители`);
  });

  test('every segment of a broken word fits the column', () => {
    for (const label of ['Электрооборудование', 'Стеклоочистители', 'Кондиционирование']) {
      for (const line of lines(label)) expect(line.length).toBeLessThanOrEqual(MAX);
    }
  });

  test('the catalogue grid never needs more than two lines', () => {
    const grid = [
      'Тормоза',
      'Аккумуляторы',
      'Фильтры',
      'Зажигание',
      'Двигатель',
      'Электрооборудование',
      'Масла и жидкости',
      'Ремни и шланги',
      'Стеклоочистители',
      'Освещение',
      'Подвеска',
      'Кузов и экстерьер',
    ];
    for (const label of grid) expect(lines(label).length).toBeLessThanOrEqual(2);
  });

  test('a break never leaves a stub of a line', () => {
    for (const label of ['Автомат', 'Электрооборудование', 'Кондиционирование']) {
      for (const part of softWrapLabel(label, 6).split(ZWSP)) {
        expect(part.length).toBeGreaterThanOrEqual(4);
      }
    }
  });

  test('only break hints are added — the visible text is unchanged', () => {
    for (const label of ['Электрооборудование', 'Масла и жидкости', 'Windshield wipers']) {
      expect(softWrapLabel(label, MAX).split(ZWSP).join('')).toBe(label);
    }
  });

  test('a word with no syllable seam (a part number) is left alone', () => {
    expect(softWrapLabel('GM96570755XX', 6)).toBe('GM96570755XX');
  });

  test('spacing in a multi-word label survives verbatim', () => {
    expect(softWrapLabel('Кузов и экстерьер', MAX)).toBe('Кузов и экстерьер');
  });
});
