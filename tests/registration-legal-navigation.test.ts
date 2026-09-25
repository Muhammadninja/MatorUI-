/**
 * Registration → legal document → Back, run through the REAL navigation.
 *
 * QA: opening a document from the sign-in sheet and pressing Back landed on
 * Explore (Home), and the half-finished registration was gone.
 *
 * Nothing here is a hand-written navigation state. The test:
 *   1. builds the route tree from the files in `app/` (layouts' real
 *      `initialRouteName`, the screens each layout declares, Stack vs Tabs),
 *   2. turns an href into a state with expo-router's own `getStateFromPath`,
 *   3. picks the target navigator with expo-router's `findDivergentState`,
 *      exactly as `router.push` does (getNavigationAction.ts),
 *   4. applies PUSH / GO_BACK with React Navigation's own StackRouter and
 *      TabRouter — GO_BACK from the focused navigator upwards, as
 *      `router.back()` / Android back / swipe-back reach it.
 *
 * React keys every screen by its route key, so a route that keeps its key
 * (and stays in the stack) is the SAME mounted component: its useState — the
 * typed phone, the OTP code, the current step — survives. That is what the
 * key assertions below pin.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, relative } from 'node:path';

import { describe, expect, test } from 'vitest';

import { LEGAL_DOCUMENT_TYPES, legalDocumentSlug, legalDocumentTypeFromSlug } from '@/types/legal';

const req = createRequire(import.meta.url);
const APP = join(__dirname, '..', 'app');

// The forked getStateFromPath uses one pure helper from React Navigation's
// `native` barrel, but the barrel itself imports react-native (Flow source
// Node cannot parse). Seed the cache with just that helper while the fork
// loads, then drop the seed so nothing else ever sees it.
const nativeBarrel = req.resolve('expo-router/build/react-navigation/native/index.js');
req.cache[nativeBarrel] = {
  id: nativeBarrel,
  filename: nativeBarrel,
  loaded: true,
  exports: {
    validatePathConfig: req('expo-router/build/react-navigation/core/validatePathConfig')
      .validatePathConfig,
  },
} as unknown as NodeJS.Module;
const { getStateFromPath } = req('expo-router/build/fork/getStateFromPath');
delete req.cache[nativeBarrel];

const { inMemoryContext } = req('expo-router/internal/testing');
const { getRoutes, getReactNavigationConfig } = req('expo-router/internal/routing');
const { findDivergentState, getPayloadFromStateRoute } = req(
  'expo-router/build/global-state/stateUtils',
);
const { StackRouter, TabRouter } = req('expo-router/build/react-navigation/routers');
const { resolveHref } = req('expo-router/build/link/href');

// ── The app's route tree ──────────────────────────────────────────────────

type RouteNode = {
  route: string;
  contextKey: string;
  type: string;
  children: RouteNode[];
  initialRouteName?: string;
};
type Route = { key: string; name: string; params?: Record<string, unknown>; state?: NavState };
type NavState = { key: string; type: string; index: number; routes: Route[] };
type Router = {
  getInitialState(o: object): NavState;
  getRehydratedState(s: object, o: object): NavState;
  getStateForAction(s: NavState, a: object, o: object): NavState | null;
};
type Navigator = { node: RouteNode; kind: 'stack' | 'tab'; routeNames: string[]; router: Router };

function files(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) files(path, acc);
    else if (/\.tsx?$/.test(entry)) acc.push(path);
  }
  return acc;
}

const source = (contextKey: string) => readFileSync(join(APP, contextKey), 'utf8');

const modules = Object.fromEntries(
  files(APP).map((file) => {
    const initial = readFileSync(file, 'utf8').match(
      /unstable_settings\s*=\s*\{[^}]*initialRouteName:\s*'([^']+)'/,
    )?.[1];
    return [
      relative(APP, file),
      {
        default: () => null,
        ...(initial ? { unstable_settings: { initialRouteName: initial } } : {}),
      },
    ];
  }),
);
const ROOT_NODE: RouteNode = getRoutes(inMemoryContext(modules), { ignoreEntryPoints: true });
const LINKING = getReactNavigationConfig(ROOT_NODE, true);

const navigators = new Map<RouteNode, Navigator>();
/** The navigator a layout renders, as expo-router builds it: Stack or Tabs from
 *  the layout source; declared screens first, in declared order. */
function navigatorOf(node: RouteNode): Navigator {
  let nav = navigators.get(node);
  if (!nav) {
    const src = source(node.contextKey);
    const kind = /<Tabs\b/.test(src) ? 'tab' : 'stack';
    const names = node.children.map((c) => c.route);
    const declared = [...src.matchAll(/<(?:Stack|Tabs)\.Screen\s+name="([^"]+)"/g)]
      .map((m) => m[1]!)
      .filter((n) => names.includes(n));
    const routeNames = [...declared, ...names.filter((n) => !declared.includes(n))];
    const options = { initialRouteName: node.initialRouteName };
    const router = kind === 'tab' ? TabRouter(options) : StackRouter(options);
    nav = { node, kind, routeNames, router };
    navigators.set(node, nav);
  }
  return nav;
}
const ROOT = navigatorOf(ROOT_NODE);

function childNavigator(nav: Navigator, name: string): Navigator | undefined {
  const child = nav.node.children.find((c) => c.route === name);
  return child?.type === 'layout' ? navigatorOf(child) : undefined;
}

const config = (nav: Navigator, routeParamList: Record<string, unknown> = {}) => ({
  routeNames: nav.routeNames,
  routeParamList,
  routeGetIdList: {},
});

// ── Mounting, the way useNavigationBuilder does ──────────────────────────

/** A child navigator's first state: from `params.screen` (a nested navigate
 *  / push), otherwise its own initial state. */
function mount(nav: Navigator, params?: Record<string, unknown>): NavState {
  const screen =
    typeof params?.screen === 'string' && params.initial !== false ? params.screen : undefined;
  const state = screen
    ? nav.router.getRehydratedState(
        { routes: [{ name: screen, params: params!.params }] },
        config(nav, { [screen]: params!.params }),
      )
    : nav.router.getInitialState(config(nav));
  return mountChildren(nav, state);
}

/** Stacks keep every route mounted; tabs mount only the focused tab (lazy). */
function mountChildren(nav: Navigator, state: NavState): NavState {
  return {
    ...state,
    routes: state.routes.map((route, i) => {
      const child = childNavigator(nav, route.name);
      if (!child) return route;
      if (route.state) return { ...route, state: hydrate(child, route.state) };
      return nav.kind === 'stack' || i === state.index
        ? { ...route, state: mount(child, route.params) }
        : route;
    }),
  };
}

function hydrate(nav: Navigator, partial: object): NavState {
  const state =
    'key' in partial ? (partial as NavState) : nav.router.getRehydratedState(partial, config(nav));
  return mountChildren(nav, state);
}

/** Cold start on a URL. */
const launch = (href: string) => hydrate(ROOT, getStateFromPath(href, LINKING));

// ── router.push / router.back ────────────────────────────────────────────

function applyAt(nav: Navigator, state: NavState, key: string, action: object): NavState | null {
  if (state.key === key) {
    const next = nav.router.getStateForAction(state, action, config(nav));
    return next && mountChildren(nav, next);
  }
  let handled = false;
  const routes = state.routes.map((route) => {
    if (handled || !route.state) return route;
    const next = applyAt(childNavigator(nav, route.name)!, route.state, key, action);
    if (!next) return route;
    handled = true;
    return { ...route, state: next };
  });
  return handled ? { ...state, routes } : null;
}

/** `router.push(href)` — getNavigateAction: target the navigator where the
 *  current and the target state diverge. */
function push(root: NavState, href: string | object): NavState {
  const path = typeof href === 'string' ? href : resolveHref(href);
  const { navigationState, actionStateRoute } = findDivergentState(
    getStateFromPath(path, LINKING),
    root,
  );
  const { screen, params } = getPayloadFromStateRoute(actionStateRoute ?? {});
  const type = navigationState.type === 'stack' ? 'PUSH' : 'NAVIGATE';
  const action = { type, target: navigationState.key, payload: { name: screen, params } };
  const next = applyAt(ROOT, root, navigationState.key, action);
  if (!next) throw new Error(`push(${path}) was not handled`);
  return next;
}

/** `router.back()` — GO_BACK from the focused navigator, bubbling up. */
function back(root: NavState): NavState {
  const chain: NavState[] = [];
  for (let s: NavState | undefined = root; s; s = s.routes[s.index]!.state) chain.push(s);
  for (const state of chain.reverse()) {
    const next = applyAt(ROOT, root, state.key, { type: 'GO_BACK' });
    if (next) return next;
  }
  throw new Error('GO_BACK was not handled');
}

/** The focused route names from the root down, and the focused leaf. */
function focus(root: NavState): { path: string[]; leaf: Route } {
  const path: string[] = [];
  let state = root;
  for (;;) {
    const route = state.routes[state.index]!;
    path.push(route.name);
    if (!route.state) return { path, leaf: route };
    state = route.state;
  }
}

const routeNamed = (state: NavState, name: string) => state.routes.find((r) => r.name === name)!;

// ── Scenarios ────────────────────────────────────────────────────────────

/** The sign-in sheet opened from the Garage tab (screenshots 1 and 6). */
function sheetOverGarage(): NavState {
  return push(launch('/garage'), '/sign-in');
}

describe('the real route tree', () => {
  test('the sheet and its documents share the (auth) stack', () => {
    const auth = childNavigator(ROOT, '(auth)')!;
    expect(auth.kind).toBe('stack');
    expect(auth.routeNames).toEqual(expect.arrayContaining(['sign-in', 'legal/[type]']));
    expect(childNavigator(ROOT, '(tabs)')!.kind).toBe('tab');
  });

  test('the sign-in sheet opens over Garage', () => {
    const root = sheetOverGarage();
    expect(root.routes.map((r) => r.name)).toEqual(['(tabs)', '(auth)']);
    expect(focus(root).path).toEqual(['(auth)', 'sign-in']);
  });
});

describe.each(LEGAL_DOCUMENT_TYPES.map((type) => [legalDocumentSlug(type), type] as const))(
  'registration sheet → /legal/%s → Back',
  (slug, type) => {
    // Exactly what the sheet's `openLegalDoc` pushes.
    const href = { pathname: '/legal/[type]', params: { type: slug } };

    test('opens the document over the sheet, in the (auth) stack', () => {
      const before = sheetOverGarage();
      const opened = push(before, href);

      expect(resolveHref(href)).toBe(`/legal/${slug}`);
      expect(focus(opened).path).toEqual(['(auth)', 'legal/[type]']);
      // The route renders exactly this document.
      expect(legalDocumentTypeFromSlug(focus(opened).leaf.params?.type)).toBe(type);
      // No second (tabs) mounted over the sheet — the old failure mode.
      expect(opened.routes.map((r) => r.name)).toEqual(['(tabs)', '(auth)']);
      // The sheet is still in the stack, under the document, same instance.
      const auth = routeNamed(opened, '(auth)');
      expect(auth.key).toBe(routeNamed(before, '(auth)').key);
      expect(auth.state!.routes.map((r) => r.name)).toEqual(['sign-in', 'legal/[type]']);
      expect(auth.state!.routes[0]!.key).toBe(routeNamed(before, '(auth)').state!.routes[0]!.key);
    });

    test('Back returns to the very same sheet — phone, code and step intact', () => {
      const before = sheetOverGarage();
      const returned = back(push(before, href));

      expect(focus(returned).path).toEqual(['(auth)', 'sign-in']);
      // Identical to before the detour: same route keys → same mounted
      // component → its state (phone, OTP code, phase) is untouched.
      expect(returned).toEqual(before);
    });
  },
);

describe('the old behaviour — why Back used to land on Home', () => {
  test.each(['/terms', '/privacy', '/personal-data-consent'])(
    'pushing the Profile route %s from the sheet buries the sheet under Explore',
    (href) => {
      const opened = push(sheetOverGarage(), href);
      // A second (tabs) is pushed over the sheet…
      expect(opened.routes.map((r) => r.name)).toEqual(['(tabs)', '(auth)', '(tabs)']);
      expect(focus(opened).path).toEqual(['(tabs)', '(profile)', href.slice(1)]);

      // …whose Profile stack holds only the document, so Back falls through
      // to its tab history: the first tab, Explore. The sheet stays below.
      const afterBack = back(opened);
      expect(focus(afterBack).path).toEqual(['(tabs)', '(explore)', 'explore']);
      expect(afterBack.index).toBe(2);
    },
  );
});

describe('outside registration: Profile → Settings → document → Back', () => {
  test.each(['/terms', '/privacy', '/personal-data-consent'])(
    '%s pushes inside the Profile stack and Back returns to Settings',
    (href) => {
      const settings = push(launch('/profile'), '/settings-security');
      expect(focus(settings).path).toEqual(['(tabs)', '(profile)', 'settings-security']);

      const opened = push(settings, href);
      expect(focus(opened).path).toEqual(['(tabs)', '(profile)', href.slice(1)]);
      expect(opened.routes.map((r) => r.name)).toEqual(['(tabs)']);

      const returned = back(opened);
      expect(focus(returned).path).toEqual(['(tabs)', '(profile)', 'settings-security']);
      expect(returned).toEqual(settings);
    },
  );

  test('the sign-in route change did not touch the Profile routes', () => {
    const layout = source('(tabs)/(profile)/_layout.tsx');
    for (const name of ['terms', 'privacy', 'personal-data-consent']) {
      expect(layout).toContain(`name="${name}"`);
    }
  });
});

describe('an unknown slug', () => {
  test('still opens over the sheet (the route then shows "unavailable")', () => {
    const opened = push(sheetOverGarage(), '/legal/cookie_policy');
    expect(focus(opened).path).toEqual(['(auth)', 'legal/[type]']);
    expect(legalDocumentTypeFromSlug(focus(opened).leaf.params?.type)).toBeNull();
    expect(focus(back(opened)).path).toEqual(['(auth)', 'sign-in']);
  });
});
