/**
 * `normalizePartTitle` against REAL titles pulled from prod
 * (`GET https://api.mator.uz/v1/catalog/parts`, 2026-10-01, 254 rows sampled).
 *
 * Every `raw` below is a string a seller actually typed. The point of the
 * suite is twofold: prove the chaotic shapes come out predictable, and pin the
 * cases where the normalizer must KEEP ITS HANDS OFF — a clean title must
 * survive byte-identical, and no rule may shorten a title into meaninglessness.
 */
import { describe, expect, it, test } from 'vitest';

import { cardTitleKeywords, normalizePartTitle } from './part-title';

describe('normalizePartTitle — edge junk', () => {
  test.each([
    ['Трупка гидравлики.', 'Трупка гидравлики'],
    ['Ремень зубчатый,', 'Ремень зубчатый'],
    ['Фильтр масляный Lada-', 'Фильтр масляный'],
    ['  Клапан впускной  ', 'Клапан впускной'],
  ])('%j → %j', (raw, title) => {
    expect(normalizePartTitle(raw).title).toBe(title);
  });

  test('strips a pile-up of trailing punctuation and lifts the model', () => {
    expect(normalizePartTitle('Полик для авто Cobalt-,')).toEqual({
      title: 'Полик для авто',
      detail: 'Cobalt',
    });
  });
});

describe('normalizePartTitle — SHOUTING', () => {
  test('a fully upper-case title becomes sentence case', () => {
    expect(normalizePartTitle('ОПОРА, ПЕРЕДНИЙ АМОРТИЗАТОР').title).toBe(
      'Опора, передний амортизатор',
    );
  });

  test('a single shouted word is calmed down', () => {
    expect(normalizePartTitle('БОЛТ поддона').title).toBe('Болт поддона');
  });

  test('keeps real acronyms upper-case', () => {
    expect(normalizePartTitle('Трос переключения АКПП').title).toBe('Трос переключения АКПП');
    expect(normalizePartTitle('Подушка ДВС').title).toBe('Подушка ДВС');
  });

  test('leaves Latin brand clusters alone — they are cased on purpose', () => {
    expect(normalizePartTitle('Масло моторное AMINOL PREMIUM PMG3 10W40 SL/CF 4Л')).toEqual({
      title: 'Масло моторное AMINOL PREMIUM PMG3',
      detail: '4 л · 10W40 SL/CF',
    });
  });
});

describe('normalizePartTitle — qualifiers move to the detail line', () => {
  test('bracketed side marker', () => {
    expect(normalizePartTitle('Фара перед (лев)')).toEqual({
      title: 'Фара перед',
      detail: 'лев',
    });
  });

  test('a shouted bracketed marker is calmed too', () => {
    expect(normalizePartTitle('Подушка ДВС (ЛЕВ)')).toEqual({
      title: 'Подушка ДВС',
      detail: 'лев',
    });
  });

  test('vehicle model glued on the end', () => {
    expect(normalizePartTitle('Брызговики комплект Onix B')).toEqual({
      title: 'Брызговики комплект',
      detail: 'Onix B',
    });
    expect(normalizePartTitle('Полик для авто Damas Evakor')).toEqual({
      title: 'Полик для авто',
      detail: 'Damas Evakor',
    });
    expect(normalizePartTitle('Электродвигатель насоса топливного Onix')).toEqual({
      title: 'Электродвигатель насоса топливного',
      detail: 'Onix',
    });
  });

  test('spec-code run', () => {
    expect(normalizePartTitle('Видеорегистратор UNISTAR GL 005 2KA 1080P WI-FI')).toEqual({
      title: 'Видеорегистратор UNISTAR',
      detail: 'GL 005 2KA 1080P WI-FI',
    });
  });

  test('volume tail is normalized and lifted', () => {
    expect(normalizePartTitle('Стеклоомывающая жидкость 3L')).toEqual({
      title: 'Стеклоомывающая жидкость',
      detail: '3 л',
    });
  });

  test('two multi-word halves glued by a hyphen split', () => {
    expect(normalizePartTitle('СТЕКЛО В СБОРЕ-ВЕТРОВОЕ СТЕКЛО')).toEqual({
      title: 'Стекло в сборе',
      detail: 'ветровое стекло',
    });
  });

  test('a long comma clause splits', () => {
    expect(normalizePartTitle('Шарнир внутренний переднего привода в комплекте, лв')).toEqual({
      title: 'Шарнир внутренний переднего привода в комплекте',
      detail: 'лв',
    });
  });
});

describe('normalizePartTitle — brand de-duplication', () => {
  test('drops a brand repeated at the end', () => {
    expect(normalizePartTitle('Фильтр масляный Lada', { brand: 'Lada' })).toEqual({
      title: 'Фильтр масляный',
    });
    expect(normalizePartTitle('Фильтр воздушный Lada', { brand: 'Lada' })).toEqual({
      title: 'Фильтр воздушный',
    });
  });

  test('keeps a brand that opens the product name', () => {
    expect(normalizePartTitle('Shell Helix Ultra 5W-30 оригинал', { brand: 'Shell' })).toEqual({
      title: 'Shell Helix Ultra',
      detail: '5W-30 оригинал',
    });
  });
});

describe('normalizePartTitle — refuses to over-trim', () => {
  test('a short comma title stays whole', () => {
    expect(normalizePartTitle('Тяга, стабилизатор задн.').title).toBe('Тяга, стабилизатор задн');
  });

  test('a model name that IS the product name survives', () => {
    // Two words, and cutting at the model would leave one — rule declines.
    expect(normalizePartTitle('Фара Onix').title).toBe('Фара Onix');
  });

  test('a title made only of spec codes is left alone', () => {
    expect(normalizePartTitle('GL 005 2KA').title).toBe('GL 005 2KA');
  });

  // The Maestro buy-path flows assert these two titles verbatim
  // (.maestro/flows/flow-04, flow-05 + subflows/open-item-detail). A rule that
  // rewrites either of them breaks the E2E suite, so they are pinned here
  // where the failure is cheap to read.
  test('titles the E2E flows assert on are never rewritten', () => {
    expect(normalizePartTitle('Brembo Front Brake Pads')).toEqual({
      title: 'Brembo Front Brake Pads',
    });
    expect(normalizePartTitle('Bosch Brake Rotor')).toEqual({ title: 'Bosch Brake Rotor' });
  });

  test('already-clean titles come out byte-identical', () => {
    for (const clean of [
      'Brembo Front Brake Pads',
      'Bosch Brake Rotor',
      'Камера заднего вида',
      'Фара противотуманная правая',
      'Поршень двигателя',
      'Подкрылок передний левый',
      'Усилитель бампера',
      'Полуось передняя левая',
      'Реле стеклоочистителей',
      'Автогерметик',
    ]) {
      expect(normalizePartTitle(clean)).toEqual({ title: clean });
    }
  });

  test('empty input stays empty rather than throwing', () => {
    expect(normalizePartTitle('')).toEqual({ title: '' });
    expect(normalizePartTitle(null)).toEqual({ title: '' });
    expect(normalizePartTitle(undefined)).toEqual({ title: '' });
    expect(normalizePartTitle('   ---   ')).toEqual({ title: '' });
  });
});

describe('cardTitleKeywords', () => {
  it('keeps the side and model a two-line card would cut', () => {
    expect(cardTitleKeywords('Рычаг подвески нижний в сборе передний левый Lacetti')).toBe(
      'передний левый Lacetti',
    );
    // "правый" fits in the first two lines; only the trailing "лв" is at risk.
    expect(cardTitleKeywords('Фонарь задний правый в сборе с проводкой лв')).toBe('лв');
  });

  it('says nothing for a title that fits', () => {
    expect(cardTitleKeywords('Фара передняя левая')).toBeNull();
    expect(cardTitleKeywords('Суппорт тормозной передний')).toBeNull();
  });

  it('skips words the detail line already shows', () => {
    expect(
      cardTitleKeywords('Амортизатор задней подвески газомасляный Cobalt', 'Cobalt'),
    ).toBeNull();
  });

  it('ignores ordinary words and lowercase latin', () => {
    expect(cardTitleKeywords('Комплект ремня генератора с роликом натяжителя и болтами')).toBeNull();
    expect(cardTitleKeywords('Прокладка клапанной крышки двигателя rubber seal')).toBeNull();
  });

  it('keeps a model code like T300', () => {
    expect(cardTitleKeywords('Опора переднего амортизатора с подшипником T300')).toBe('T300');
  });
});
