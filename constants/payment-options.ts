import { Banknote, CreditCard, Wallet, type LucideIcon } from 'lucide-react-native';
import type { ImageSourcePropType } from 'react-native';

import PaymeLogo from '../assets/payments/payme.png';

import type { PaymentType } from '@/services/orders-service';

export type PaymentOption = {
  id: PaymentType;
  labelKey: string;
  /** One-line explainer shown under the label at checkout. */
  descriptionKey: string;
  icon: LucideIcon;
  /** The provider's own logo, shown instead of the icon where it exists. */
  logo?: { source: ImageSourcePropType; aspectRatio: number };
};

/**
 * The three supported payment methods for the Uzbek market. These are fixed,
 * always-available choices made at checkout — there is no stored card. Payme
 * is paid online; Terminal is a card reader the courier brings; Cash is
 * cash-on-delivery.
 */
export const PAYMENT_OPTIONS: PaymentOption[] = [
  {
    id: 'payme',
    labelKey: 'paymentMethods.payme',
    descriptionKey: 'paymentMethods.paymeDescription',
    icon: Wallet,
    // Payme's colour mark from business.help.paycom.uz/resursy: black type on its
    // cyan badge, which reads on light and dark cards alike.
    logo: { source: PaymeLogo, aspectRatio: 1045 / 344 },
  },
  { id: 'terminal', labelKey: 'paymentMethods.terminal', descriptionKey: 'paymentMethods.terminalDescription', icon: CreditCard },
  { id: 'cash', labelKey: 'paymentMethods.cash', descriptionKey: 'paymentMethods.cashDescription', icon: Banknote },
];

export const DEFAULT_PAYMENT_TYPE: PaymentType = 'payme';
