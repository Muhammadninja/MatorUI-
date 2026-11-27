import { requireOptionalNativeModule } from 'expo';

/**
 * Whether this binary has the clipboard native module. Builds up to 1.1.0
 * shipped without expo-clipboard, and importing it there throws "Cannot find
 * native module 'ExpoClipboard'". Those builds get a JS update, so the copy
 * button is only offered when the module is really present; elsewhere the
 * value stays selectable and the system "Copy" menu does the job.
 */
export const canCopyToClipboard = requireOptionalNativeModule('ExpoClipboard') != null;

/** Copy `value`; false when this build can't (no native module or it failed). */
export async function copyToClipboard(value: string): Promise<boolean> {
  if (!canCopyToClipboard) return false;
  try {
    const Clipboard = await import('expo-clipboard');
    await Clipboard.setStringAsync(value);
    return true;
  } catch {
    return false;
  }
}
