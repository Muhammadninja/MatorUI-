import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { toastService, type Toast } from '@/services/toast-service';
import { AppToast } from './app-toast';

export default function AppToastHost() {
  const insets = useSafeAreaInsets();
  const [toasts, setToasts] = useState<readonly Toast[]>([]);

  useEffect(() => toastService.subscribe(setToasts), []);

  const handleDismiss = useCallback((id: string) => {
    toastService.dismiss(id);
  }, []);

  if (toasts.length === 0) return null;

  return (
    <View
      pointerEvents="box-none"
      style={[styles.container, { paddingTop: insets.top + 8 }]}
    >
      {toasts.map((toast) => (
        <View key={toast.id} style={styles.slot}>
          <AppToast toast={toast} onDismiss={handleDismiss} />
        </View>
      ))}
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
    gap: 10,
    zIndex: 9999,
    elevation: 9999,
  },
  slot: {
    width: '100%',
  },
});
