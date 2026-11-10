import { useEffect } from 'react';
import { Linking } from 'react-native';
import { useNavigationContainerRef } from 'expo-router';

import { isDedicatedE2EApp } from '@/config/environment';
import { useLanguageContext } from '@/contexts/language.context';
import { useUserContext } from '@/contexts/user.context';
import { getCurrentSession } from '@/services/auth-storage';
import { traceStartup, traceStartupLink, traceStartupRoutes, type StartupScope } from '@/services/e2e-startup-trace';

export function useE2EStartupMount(scope: StartupScope) {
  useEffect(() => {
    traceStartup(scope, { mounted: true });
    return () => traceStartup(scope, { mounted: false });
  }, [scope]);
}

/** Lives outside keyed account providers, so it observes their navigation teardown. */
export function E2EStartupObserver() {
  const navigation = useNavigationContainerRef();
  const { isHydrating, isAuthenticated, profile } = useUserContext();
  const { isHydrated, hasChosen } = useLanguageContext();
  useEffect(() => {
    traceStartup('auth-language', { hydrating: isHydrating, authenticated: isAuthenticated,
      profile: !!profile, session: !!getCurrentSession(), language: isHydrated, chosen: hasChosen });
  }, [isHydrating, isAuthenticated, profile, isHydrated, hasChosen]);
  useEffect(() => {
    if (!isDedicatedE2EApp()) return;
    traceStartupRoutes(navigation.getRootState());
    const unsubscribe = navigation.addListener('state', () => traceStartupRoutes(navigation.getRootState()));
    void Linking.getInitialURL().then(traceStartupLink, () => traceStartupLink(null));
    return unsubscribe;
  }, [navigation]);
  return null;
}
