import { Banknote, CreditCard, Wallet, type LucideIcon } from 'lucide-react-native';

import type { PaymentType } from '@/services/orders-service';

export type PaymentOption = {
  id: PaymentType;
  label: string;
  /** One-line explainer shown under the label at checkout. */
  description: string;
  icon: LucideIcon;
};

/**
 * The three supported payment methods for the Uzbek market. These are fixed,
 * always-available choices made at checkout — there is no stored card. Payme
 * is paid online; Terminal is a card reader the courier brings; Cash is
 * cash-on-delivery.
 */
export const PAYMENT_OPTIONS: PaymentOption[] = [
  { id: 'payme', label: 'Payme', description: 'Pay online with Payme', icon: Wallet },
  { id: 'terminal', label: 'Terminal', description: 'Card terminal on delivery', icon: CreditCard },
  { id: 'cash', label: 'Cash', description: 'Cash on delivery', icon: Banknote },
];

export const DEFAULT_PAYMENT_TYPE: PaymentType = 'payme';
