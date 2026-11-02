import { Banknote, CreditCard, Wallet, type LucideIcon } from 'lucide-react-native';

import type { PaymentType } from '@/services/orders-service';

export type PaymentOption = {
  id: PaymentType;
  labelKey: string;
  /** One-line explainer shown under the label at checkout. */
  descriptionKey: string;
  icon: LucideIcon;
};

/**
 * The three supported payment methods for the Uzbek market. These are fixed,
 * always-available choices made at checkout — there is no stored card. Payme
 * is paid online; Terminal is a card reader the courier brings; Cash is
 * cash-on-delivery.
 */
export const PAYMENT_OPTIONS: PaymentOption[] = [
  { id: 'payme', labelKey: 'paymentMethods.payme', descriptionKey: 'paymentMethods.paymeDescription', icon: Wallet },
  { id: 'terminal', labelKey: 'paymentMethods.terminal', descriptionKey: 'paymentMethods.terminalDescription', icon: CreditCard },
  { id: 'cash', labelKey: 'paymentMethods.cash', descriptionKey: 'paymentMethods.cashDescription', icon: Banknote },
];

export const DEFAULT_PAYMENT_TYPE: PaymentType = 'payme';
