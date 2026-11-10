import { isDedicatedE2EApp } from '@/config/environment';

let sequence = 0;
const routes = new Set([
  '__root', 'index', '(tabs)', '(explore)', 'explore', '(auth)',
  'select-language', 'sign-in', '(profile)', 'profile', 'liked', '(cart)', 'cart',
]);
export type StartupScope = 'root-navigation' | 'cart-controller' | 'likes-controller' |
  'auth-layout' | 'language-route' | 'sign-in-route' | 'index-gate' | 'auth-language';

/** Only route names and boolean/numeric flags; never params, URLs or account data. */
export function traceStartup(event: StartupScope, flags: Record<string, boolean | number> = {}) {
  if (!isDedicatedE2EApp()) return;
  const safe = Object.fromEntries(Object.entries(flags)
    .filter(([key, value]) => /^[a-z]+$/i.test(key) &&
      (typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value)))));
  console.info(`[e2e-startup ${++sequence}] ${event}`, JSON.stringify(safe));
}

export function traceStartupRoutes(raw: unknown) {
  if (!isDedicatedE2EApp()) return;
  const names: string[] = [];
  let state = raw as { index?: number; routes?: { name?: string; state?: unknown }[] } | undefined;
  for (let depth = 0; state && depth < 8; depth++) {
    const route = state.routes?.[state.index ?? 0];
    if (!route) break;
    names.push(routes.has(route.name ?? '') ? route.name! : 'other');
    state = route.state as typeof state;
  }
  console.info(`[e2e-startup ${++sequence}] routes`, names.join(' > '));
}

export function traceStartupLink(url: string | null) {
  if (!isDedicatedE2EApp()) return;
  let kind = 'none';
  if (url) {
    try {
      const parsed = new URL(url);
      const route = `${parsed.hostname}${parsed.pathname}`.replace(/^\/+|\/+$/g, '');
      kind = parsed.protocol === 'mator-e2e:' && ['liked', 'profile', 'select-language', 'sign-in'].includes(route)
        ? route : 'other';
    } catch { kind = 'invalid'; }
  }
  console.info(`[e2e-startup ${++sequence}] initial-link`, kind);
}
