import { useEffect } from 'react';
import { traceStartup, type StartupScope } from '@/services/e2e-startup-trace';

export function useE2EStartupMount(scope: StartupScope) {
  useEffect(() => {
    traceStartup(scope, { mounted: true });
    return () => traceStartup(scope, { mounted: false });
  }, [scope]);
}
