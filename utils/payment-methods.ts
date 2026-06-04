export type PaymentCard = {
  id: string;
  brand: string;
  last4: string;
  holder: string;
  expiry: string;
  color: string;
  accentColor: string;
};

export type CardDraft = {
  holder: string;
  number: string;
  expiry: string;
  cvv: string;
};

export const INITIAL_PAYMENT_CARDS: PaymentCard[] = [
  {
    id: '1',
    brand: 'VISA',
    last4: '4289',
    holder: 'M. Abdullaev',
    expiry: '09/28',
    color: '#0d0d0d',
    accentColor: 'rgba(255,255,255,0.07)',
  },
  {
    id: '2',
    brand: 'MC',
    last4: '8821',
    holder: 'M. Abdullaev',
    expiry: '03/27',
    color: '#0f0c29',
    accentColor: 'rgba(255,255,255,0.07)',
  },
];

export const EMPTY_CARD_DRAFT: CardDraft = {
  holder: '',
  number: '',
  expiry: '',
  cvv: '',
};

export function sanitizeCardNumber(value: string) {
  return value.replace(/\D/g, '');
}

export function sanitizeExpiry(value: string) {
  return value.replace(/\D/g, '');
}

export function sanitizeCvv(value: string) {
  return value.replace(/\D/g, '');
}

export function isCardDraftValid(draft: CardDraft) {
  return (
    !!draft.holder.trim() &&
    sanitizeCardNumber(draft.number).length >= 16 &&
    sanitizeExpiry(draft.expiry).length === 4 &&
    sanitizeCvv(draft.cvv).length >= 3
  );
}

export function detectCardBrand(cardNumber: string) {
  if (cardNumber.startsWith('4')) {
    return 'VISA';
  }

  if (/^5[1-5]/.test(cardNumber) || /^2(2[2-9]|[3-6]|7[01])/.test(cardNumber)) {
    return 'MC';
  }

  return 'CARD';
}

export function formatCardNumberInput(value: string) {
  return sanitizeCardNumber(value)
    .slice(0, 16)
    .replace(/(.{4})/g, '$1 ')
    .trim();
}

export function formatExpiryInput(value: string) {
  const digits = sanitizeExpiry(value).slice(0, 4);

  if (digits.length <= 2) {
    return digits;
  }

  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

export function formatCvvInput(value: string) {
  return sanitizeCvv(value).slice(0, 4);
}

export function buildPaymentCard(draft: CardDraft, id: string): PaymentCard {
  const sanitizedCardNumber = sanitizeCardNumber(draft.number);
  const brand = detectCardBrand(sanitizedCardNumber);

  return {
    id,
    brand,
    last4: sanitizedCardNumber.slice(-4),
    holder: draft.holder.trim(),
    expiry: draft.expiry,
    color: brand === 'VISA' ? '#161616' : brand === 'MC' ? '#102542' : '#202020',
    accentColor: 'rgba(255,255,255,0.07)',
  };
}
