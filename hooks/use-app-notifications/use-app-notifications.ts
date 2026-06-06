import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

/**
 * Thin wrapper around expo-notifications.
 *
 *  - Lazy permission: never asks unless the caller calls `register()`.
 *  - Returns the Expo push token so the backend can register the device.
 *  - Exposes a fire-and-forget `scheduleLocal()` for in-app reminders
 *    (debounce keys, in-flight cart sync confirmations, etc.).
 *  - Listener cleanup is automatic — receives + responses are wired on
 *    mount and torn down on unmount.
 */

export type NotificationPayload = {
  title: string;
  body?: string;
  data?: Record<string, unknown>;
};

export type UseAppNotificationsValue = {
  permission: 'unknown' | 'granted' | 'denied';
  pushToken: string | null;
  error: string | null;
  register: () => Promise<string | null>;
  scheduleLocal: (payload: NotificationPayload, delaySeconds?: number) => Promise<string | null>;
  cancel: (notificationId: string) => Promise<void>;
  cancelAll: () => Promise<void>;
};

export function useAppNotifications(options?: {
  onReceived?: (notification: Notifications.Notification) => void;
  onResponse?: (response: Notifications.NotificationResponse) => void;
}): UseAppNotificationsValue {
  const [permission, setPermission] = useState<'unknown' | 'granted' | 'denied'>('unknown');
  const [pushToken, setPushToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Hold the latest callbacks in refs so listeners aren't reattached on
  // every render and consumers can change handler identity freely.
  const onReceivedRef = useRef(options?.onReceived);
  const onResponseRef = useRef(options?.onResponse);
  useEffect(() => {
    onReceivedRef.current = options?.onReceived;
    onResponseRef.current = options?.onResponse;
  }, [options?.onReceived, options?.onResponse]);

  useEffect(() => {
    const receiveSub = Notifications.addNotificationReceivedListener((n) => {
      onReceivedRef.current?.(n);
    });
    const responseSub = Notifications.addNotificationResponseReceivedListener((r) => {
      onResponseRef.current?.(r);
    });
    return () => {
      receiveSub.remove();
      responseSub.remove();
    };
  }, []);

  const register = useCallback(async (): Promise<string | null> => {
    try {
      const existing = await Notifications.getPermissionsAsync();
      let status = existing.status;
      if (status !== 'granted') {
        const requested = await Notifications.requestPermissionsAsync();
        status = requested.status;
      }
      if (status !== 'granted') {
        setPermission('denied');
        setError('Notification permission denied');
        return null;
      }
      setPermission('granted');

      // Android requires a default channel before showing notifications.
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'Default',
          importance: Notifications.AndroidImportance.DEFAULT,
        });
      }

      const projectId =
        (Constants.expoConfig as { extra?: { eas?: { projectId?: string } } } | null)?.extra?.eas
          ?.projectId ??
        (Constants.easConfig as { projectId?: string } | null)?.projectId;

      const tokenResponse = await Notifications.getExpoPushTokenAsync(
        projectId ? { projectId } : undefined,
      );
      setPushToken(tokenResponse.data);
      return tokenResponse.data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Notification register failed';
      setError(message);
      return null;
    }
  }, []);

  const scheduleLocal = useCallback(
    async (payload: NotificationPayload, delaySeconds = 0): Promise<string | null> => {
      try {
        const id = await Notifications.scheduleNotificationAsync({
          content: {
            title: payload.title,
            body: payload.body,
            data: payload.data,
          },
          trigger:
            delaySeconds > 0
              ? ({ type: 'timeInterval', seconds: delaySeconds } as unknown as Notifications.NotificationTriggerInput)
              : null,
        });
        return id;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Schedule failed');
        return null;
      }
    },
    [],
  );

  const cancel = useCallback(async (notificationId: string) => {
    try {
      await Notifications.cancelScheduledNotificationAsync(notificationId);
    } catch {
      // Already cancelled or unknown id — silent.
    }
  }, []);

  const cancelAll = useCallback(async () => {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
    } catch {
      // ignore
    }
  }, []);

  return {
    permission,
    pushToken,
    error,
    register,
    scheduleLocal,
    cancel,
    cancelAll,
  };
}

export default useAppNotifications;
