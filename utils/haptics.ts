import * as Haptics from 'expo-haptics';

export type HapticKind = 'selection' | 'success' | 'warning' | 'error' | false;

export async function triggerHaptic(kind: HapticKind) {
  if (!kind) return;

  try {
    if (kind === 'selection') {
      await Haptics.selectionAsync();
      return;
    }

    const feedbackType =
      kind === 'success'
        ? Haptics.NotificationFeedbackType.Success
        : kind === 'warning'
          ? Haptics.NotificationFeedbackType.Warning
          : Haptics.NotificationFeedbackType.Error;

    await Haptics.notificationAsync(feedbackType);
  } catch {
    // Haptics are optional at runtime.
  }
}
