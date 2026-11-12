import { Platform, type TextInputProps } from 'react-native';

/** Used until the backend reports `otp_length` for the current request. */
export const DEFAULT_OTP_LENGTH = 6;

/** The backend's verify DTOs accept codes of 4–8 characters. */
export function resolveOtpLength(length: number | undefined): number {
  return Number.isInteger(length) && length! >= 4 && length! <= 8
    ? (length as number)
    : DEFAULT_OTP_LENGTH;
}

export function otpPlaceholder(length: number): string {
  return '12345678'.slice(0, length);
}

/**
 * Reduce whatever reached the field to the code. Typing, pasting and native
 * autofill all arrive through `onChangeText`, so all of them pass through here:
 *   - a pasted "483 917" or "483-917" is one code;
 *   - a pasted sentence yields its code-length number, not the digits of a phone
 *     number that happens to precede it;
 *   - a suggestion inserted beside a partly typed code replaces it, since iOS
 *     inserts at the cursor rather than replacing the field.
 */
export function normalizeOtpInput(raw: string, length: number, previous = ''): string {
  const exactRun = raw.split(/\D+/).find((run) => run.length === length);
  if (exactRun) return exactRun;
  const digits = raw.replace(/\D/g, '');
  if (digits.length === previous.length + length && digits.startsWith(previous)) {
    return digits.slice(previous.length);
  }
  return digits.slice(0, length);
}

/**
 * The OS hints that surface an SMS code above the keyboard. They need no SMS
 * permission or dependency: the OS reads the message and the app only receives
 * the text it inserts.
 */
export function otpAutofillProps(
  os: string = Platform.OS,
): Pick<TextInputProps, 'textContentType' | 'autoComplete' | 'importantForAutofill'> {
  if (os === 'ios') return { textContentType: 'oneTimeCode' };
  if (os === 'android') return { autoComplete: 'sms-otp', importantForAutofill: 'yes' };
  return {};
}
