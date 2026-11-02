import type { ShippingOption } from '@/services/orders-service';

type Translate = (key: string, values?: Record<string, unknown>) => string;

/** Localize stable shipping types and the ETA formats emitted by our transport.
 * Unknown carrier text remains server-owned; no fee, key or selection changes. */
export function localizeShipping(option: ShippingOption, t: Translate) {
  const label = option.key === 'pickup' ? t('checkout.pickup')
    : option.key === 'courier' ? t('checkout.courier') : option.label;
  if (option.eta === 'Today') return { label, eta: t('checkout.etaToday') };
  const match = /^(\d+)(?:[-–](\d+))?(?:d| days?)$/.exec(option.eta);
  if (!match) return { label, eta: option.eta };
  const min = Number(match[1]);
  const max = match[2] === undefined ? min : Number(match[2]);
  if (!Number.isSafeInteger(min) || !Number.isSafeInteger(max) || max < min) return { label, eta: option.eta };
  return { label, eta: min === 0 && max === 0 ? t('checkout.etaToday')
    : min === max ? t('checkout.etaDays', { count: min })
    : t('checkout.etaRange', { min, max }) };
}
