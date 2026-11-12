import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { expect, test } from 'vitest';

const script = readFileSync('scripts/e2e-ui-diagnostic.mjs', 'utf8')
  .replace(/^import .*;$/gm, '');

function diagnose(resumed = true, failedLogcat = false) {
  const saved: string[] = [];
  const calls: string[][] = [];
  runInNewContext(script, {
    process: { env: {} },
    appendFileSync: (_path: string, text: string) => saved.push(text),
    execFileSync: (command: string, args: string[]) => {
      expect(command).toBe('adb');
      calls.push(args);
      if (args.includes('dumpsys')) return `mResumedActivity: ${resumed ? 'com.mator.e2e' : 'other.app'}/.MainActivity`;
      if (args.includes('pidof')) return '123';
      if (args[0] === 'logcat' && args.includes('--pid')) {
        if (failedLogcat) throw new Error('unredacted-private-error');
        return 'E/ReactNativeJS: fixture +998900000001 srv_access_account_a Bearer opaque-token';
      }
      if (args[0] === 'logcat') {
        return ['I/ActivityManager: Start proc 1:com.mator.e2e/u0a1',
          'E/AndroidRuntime: Process: other.app private-other-app-error'].join('\n');
      }
      return '<node text="+998900000002 srv_refresh_account_b" />';
    },
  });
  return { saved: saved.join(''), calls };
}

test('captures only bounded errors from the dedicated process and scrubs before persistence', () => {
  const { saved, calls } = diagnose();
  const logcat = calls.find((args) => args[0] === 'logcat' && args.includes('--pid'));
  expect(logcat).toEqual(['logcat', '-d', '-t', '2000', '--pid', '123', '-v', 'brief',
    'ReactNativeJS:E', 'ReactNative:E', 'AndroidRuntime:E', '*:S']);
  expect(saved).toContain('[redacted dedicated-app errors]');
  expect(saved).toContain('[redacted test-device UI]');
  expect(saved).not.toMatch(/99890000000[12]|srv_access_account_a|srv_refresh_account_b|opaque-token/);
  expect(saved).toContain('[TEST_PHONE]');
  expect(saved).toContain('Bearer [REDACTED]');
});

test('does not read logcat or UI from another resumed app', () => {
  const { saved, calls } = diagnose(false);
  // Only the test app's own crash/focus lines; no other-app errors or UI.
  expect(calls.some((args) => args.includes('--pid') || args.includes('uiautomator'))).toBe(false);
  expect(saved).toContain('dedicated test app is not resumed');
  expect(saved).not.toContain('[redacted test-device UI]');
  expect(saved).toContain('com.mator.e2e');
  expect(saved).not.toContain('private-other-app-error');
});

test('logcat failure preserves UI evidence without persisting raw error text', () => {
  const { saved } = diagnose(true, true);
  expect(saved).toContain('dedicated-app error diagnostic unavailable');
  expect(saved).toContain('[redacted test-device UI]');
  expect(saved).not.toContain('unredacted-private-error');
});
