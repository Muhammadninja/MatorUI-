import { useCallback, useEffect, useState } from 'react';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { toastService, type Toast } from '@/services/toast-service';
import { AppToast } from './app-toast';

export default function AppToastHost() {
  const insets = useSafeAreaInsets();
  const [toasts, setToasts] = useState<readonly Toast[]>([]);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => toastService.subscribe(setToasts), []);

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => subscription.remove();
  }, []);

  const handleDismiss = useCallback((id: string) => {
    toastService.dismiss(id);
  }, []);

  const toast = toasts[0];
  if (!toast) return null;

  // Absolutely positioned over the screen, so showing a toast never shifts the
  // page. The single slot keeps its instance when a new toast replaces the
  // current one: the text swaps in place rather than replaying the entrance.
  return (
    <View pointerEvents="box-none" style={[styles.container, { paddingTop: insets.top + 8 }]}>
      <AppToast toast={toast} onDismiss={handleDismiss} reduceMotion={reduceMotion} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    zIndex: 9999,
    elevation: 9999,
  },
});
