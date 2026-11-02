import { createInstance } from 'i18next';
import { expect, test, vi } from 'vitest';
import ru from '@/locales/ru.json';
import uz from '@/locales/uz.json';
import en from '@/locales/en.json';
vi.mock('lucide-react-native', () => ({ Banknote: () => null, CreditCard: () => null, Wallet: () => null }));
import { PAYMENT_OPTIONS } from '@/constants/payment-options';
import { localizeShipping } from '@/services/checkout-presentation';

const resources = { ru: { translation: ru }, uz: { translation: uz }, en: { translation: en } };

test.each([
  ['ru', 'Самовывоз', 'Сегодня', 'Наличные'],
  ['uz', 'Olib ketish', 'Bugun', 'Naqd pul'],
  ['en', 'Pickup', 'Today', 'Cash'],
])('checkout copy follows %s without changing the quote', async (lng, pickup, today, cash) => {
  const i18n = createInstance();
  await i18n.init({ lng, resources });
  const option = { key: 'pickup', label: 'Olib ketish', eta: 'Today', price: 0 };
  expect(localizeShipping(option, i18n.t)).toEqual({ label: pickup, eta: today });
  expect(option).toEqual({ key: 'pickup', label: 'Olib ketish', eta: 'Today', price: 0 });
  expect(PAYMENT_OPTIONS.map((p) => p.id)).toEqual(['payme', 'terminal', 'cash']);
  expect(i18n.t(PAYMENT_OPTIONS[2].labelKey)).toBe(cash);
  for (const p of PAYMENT_OPTIONS) {
    expect(i18n.exists(p.labelKey)).toBe(true);
    expect(i18n.exists(p.descriptionKey)).toBe(true);
  }
});

test('courier ranges and single-day plurals are localized from transport ETA', async () => {
  const i18n = createInstance();
  await i18n.init({ lng: 'ru', resources });
  expect(localizeShipping({ key: 'courier', label: 'Kuryer', eta: '1-3d', price: 25000 }, i18n.t))
    .toEqual({ label: 'Курьер', eta: '1–3 дн.' });
  expect(localizeShipping({ key: 'courier', label: '', eta: '1d', price: 25000 }, i18n.t).eta).toBe('1 день');
  expect(localizeShipping({ key: 'courier', label: '', eta: '2d', price: 25000 }, i18n.t).eta).toBe('2 дня');
  expect(localizeShipping({ key: 'courier', label: '', eta: '5d', price: 25000 }, i18n.t).eta).toBe('5 дней');
});

test('unknown carrier copy is retained without inventing an ETA', async () => {
  const i18n = createInstance();
  await i18n.init({ lng: 'ru', resources });
  expect(localizeShipping({ key: 'custom', label: 'Special carrier', eta: 'Call to arrange', price: 123 }, i18n.t))
    .toEqual({ label: 'Special carrier', eta: 'Call to arrange' });
});
