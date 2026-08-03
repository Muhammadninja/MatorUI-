import Constants from 'expo-constants';
import type { NotificationResponse } from 'expo-notifications';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';
import { Platform } from 'react-native';

import { useUserContext } from '@/contexts/user.context';
import { useAppNotifications } from '@/hooks/use-app-notifications';
import { getDeviceId } from '@/services/device-id';
import { registerDevice } from '@/services/notifications-service';

/**
 * Registers this install for push once the user is signed in — permission →
 * Expo push token → `POST /v1/devices/register` — so server/admin delivery-status
 * pushes actually reach the device (the in-app inbox already works via
 * `GET /v1/notifications`; this adds the OS-level banner). Also routes a tapped
 * notification to its backend-supplied `deeplinkPath`.
 *
 * Best-effort: mount once near the app root. It never throws into render, and if
 * token acquisition fails (e.g. a simulator without an EAS projectId) it simply
 * retries on the next sign-in.
 */
export function useDeviceRegistration(): void {
  const { isAuthenticated } = useUserContext();

  const onResponse = useCallback((response: NotificationResponse) => {
    const data = response.notification.request.content.data as
      | { deeplinkPath?: unknown }
      | undefined;
    const path = typeof data?.deeplinkPath === 'string' ? data.deeplinkPath : null;
    if (!path) return;
    try {
      router.push(path as never);
    } catch {
      // Malformed / unknown deeplink — ignore rather than crash on a tap.
    }
  }, []);

  const { register, permission } = useAppNotifications({ onResponse });

  // `register`/`permission` read through refs so the effect only re-runs on the
  // auth transition, not on every render.
  const registerRef = useRef(register);
  registerRef.current = register;
  const permissionRef = useRef(permission);
  permissionRef.current = permission;

  const doneRef = useRef(false);

  useEffect(() => {
    if (!isAuthenticated) {
      doneRef.current = false; // allow re-registration on the next sign-in
      return;
    }
    if (doneRef.current) return;
    doneRef.current = true;

    void (async () => {
      try {
        const token = await registerRef.current(); // permission prompt + Expo token (may be null)
        await registerDevice({
          installId: await getDeviceId(),
          platform: Platform.OS === 'ios' ? 'ios' : 'android',
          expoPushToken: token,
          permissionsGranted: permissionRef.current === 'granted' || !!token,
          osVersion: String(Platform.Version),
          appVersion: Constants.expoConfig?.version ?? undefined,
        });
      } catch {
        // Best-effort — never block the app; retry on the next sign-in.
        doneRef.current = false;
      }
    })();
  }, [isAuthenticated]);
}

export default useDeviceRegistration;
