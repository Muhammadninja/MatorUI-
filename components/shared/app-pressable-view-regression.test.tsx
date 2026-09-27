/**
 * AppPressableView family — structural guard tests.
 *
 * Until jest-react-native is configured, vitest can't render the
 * pressable family (`react-native`'s Flow-typed entry + lucide-react-
 * native's RN re-exports defeat both the rollup parser and the alias
 * shims). These tests instead enforce structural invariants by reading
 * the source files directly. They catch the specific regression class
 * that hurt us before: subtle layout changes to the inner Pressable
 * style array that quietly broke every consumer.
 *
 *   1. AppPressableView's source still gates the inner-pressable fill
 *      on `fillContainer` (the regression added unconditional fill).
 *   2. The AppCard, AppRowItem, AppSectionHeader, AppBanner,
 *      AppOverlayHeader, AppErrorBoundary, AppTabBar files exist at
 *      their canonical paths.
 *
 * The day jest-react-native lands, replace this file with real
 * `render(<AppButton title="x"/>)` snapshot tests.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, test } from 'vitest';

const ROOT = join(__dirname, '../..');

function read(rel: string): string {
  const path = join(ROOT, rel);
  expect(existsSync(path), `expected file to exist: ${rel}`).toBe(true);
  return readFileSync(path, 'utf8');
}

describe('AppPressableView — fillContainer gate', () => {
  test('innerLayout does NOT unconditionally inject width/height 100%', () => {
    const source = read('components/shared/app-view/app-pressable-view.tsx');
    // Find the innerLayout useMemo block and assert it does not blindly
    // emit `{ width: '100%', height: '100%' }`. The regression added
    // that as a literal at the top of the returned ViewStyle.
    const innerLayoutBlock = source.slice(
      source.indexOf('const innerLayout'),
      source.indexOf('const base = useMemo'),
    );
    expect(innerLayoutBlock).not.toMatch(/width:\s*['"]100%['"]\s*,\s*height:\s*['"]100%['"]/);
  });

  test('fill is still gated on the fillContainer prop in the Pressable style array', () => {
    const source = read('components/shared/app-view/app-pressable-view.tsx');
    // The conditional must still exist somewhere downstream — either
    // `fillContainer ? { flex: 1, width: '100%', height: '100%' } : null`
    // or an equivalent ternary form.
    const hasGuardedFill = /fillContainer\s*\?\s*\{[^}]*width:\s*['"]100%['"]/.test(source);
    expect(hasGuardedFill).toBe(true);
  });
});

describe('Shared component family — files present', () => {
  test.each([
    ['components/shared/app-view/app-view.tsx', 'AppView'],
    ['components/shared/app-view/app-pressable-view.tsx', 'AppPressableView'],
    ['components/shared/app-button/app-button.tsx', 'AppButton'],
    ['components/shared/app-card.tsx', 'AppCard'],
    ['components/shared/app-row-item.tsx', 'AppRowItem'],
    ['components/shared/app-section-header.tsx', 'AppSectionHeader'],
    ['components/shared/app-banner.tsx', 'AppBanner'],
    ['components/shared/app-overlay-header.tsx', 'AppOverlayHeader'],
    ['components/shared/app-error-boundary.tsx', 'AppErrorBoundary'],
    ['components/shared/app-tab-bar/app-tab-bar.tsx', 'AppTabBar'],
  ])('%s exists and exports %s', (rel, sym) => {
    const source = read(rel);
    expect(source).toMatch(new RegExp(`(export (default )?function|export const|export class) ${sym}\\b`));
  });
});

describe('AppTabBar relocation', () => {
  test('the old customs path no longer exists', () => {
    expect(existsSync(join(ROOT, 'components/customs'))).toBe(false);
  });

  test('the debug `height: 50` (or 80) pin was removed from container styles', () => {
    const source = read('components/shared/app-tab-bar/app-tab-bar.tsx');
    const container = source.match(/container:\s*\{[^}]+\}/)?.[0] ?? '';
    expect(container).not.toMatch(/height:\s*(50|80)\b/);
  });
});

describe('AppPressableView — collapse detector', () => {
  /**
   * The guard that reports a row which has actually shrunk to its content and
   * lost its flex column. It has to MEASURE: an earlier static version
   * ("row + flex child + no fillContainer") fired 27 times across healthy
   * screens, because a column parent stretches those rows anyway. A warning
   * that cries wolf gets ignored, so the width check is the whole point.
   */
  test('warns from onLayout on a measured width, not from a static guess', () => {
    const source = read('components/shared/app-view/app-pressable-view.tsx');
    expect(source).toMatch(/COLLAPSE_WIDTH_PX/);
    // The decision must read the laid-out width...
    expect(source).toMatch(/event\.nativeEvent\.layout/);
    expect(source).toMatch(/width >= COLLAPSE_WIDTH_PX/);
    // ...and it must actually be wired to the inner Pressable.
    expect(source).toMatch(/onLayout=\{onCollapseLayout\}/);
  });

  test('the detector is dev-only and fires at most once per instance', () => {
    const source = read('components/shared/app-view/app-pressable-view.tsx');
    const hook = source.slice(
      source.indexOf('function useCollapseWarning'),
      source.indexOf('export type AppPressableViewProps'),
    );
    expect(hook).toMatch(/__DEV__/);
    expect(hook).toMatch(/warned\.current/);
  });
});
