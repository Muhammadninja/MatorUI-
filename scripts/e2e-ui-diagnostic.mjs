// Test-device UI text only. Never persist raw hierarchies or screenshots here.
import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
const LOG = process.env.MOCK_LOG || '/tmp/mator-e2e-mock.log';
const scrub = (text) => text
  .replace(/\+?998[\d ()-]{9,}/g, '[TEST_PHONE]')
  .replace(/srv_(?:access|refresh)_[a-z0-9_]+/g, '[TEST_TOKEN]')
  .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [REDACTED]');
try {
  const activity = execFileSync('adb', ['shell', 'dumpsys', 'activity', 'activities'], { encoding: 'utf8', timeout: 10000 });
  if (!/^.*(?:topResumedActivity|mResumedActivity).*com[.]mator[.]e2e\//m.test(activity)) {
    // Component names only, e.g. another app or a system dialog that took focus.
    const front = activity.match(/(?:topResumedActivity|mResumedActivity).*?\{[^}]*?\s([\w.]+\/[\w.$]+)/)?.[1] ?? 'none';
    appendFileSync(LOG, `\n[UI diagnostic skipped: dedicated test app is not resumed; resumed: ${front}]\n`);
  } else {
  // Only errors from the currently running disposable app process. Never save
  // raw logcat, other app logs, or an auth/profile screenshot for diagnostics.
  try {
    const pid = execFileSync('adb', ['shell', 'pidof', 'com.mator.e2e'], { encoding: 'utf8', timeout: 10000 }).trim();
    if (/^\d+$/.test(pid)) {
      const errors = execFileSync('adb', ['logcat', '-d', '-t', '2000', '--pid', pid, '-v', 'brief',
        'ReactNativeJS:E', 'ReactNative:E', 'AndroidRuntime:E', '*:S'],
        { encoding: 'utf8', timeout: 10000, maxBuffer: 1024 * 1024 });
      appendFileSync(LOG, '\n[redacted dedicated-app errors]\n' + scrub(errors) + '\n');
    }
  } catch {
    appendFileSync(LOG, '\n[dedicated-app error diagnostic unavailable]\n');
  }
  const xml = execFileSync('adb', ['exec-out', 'uiautomator', 'dump', '/proc/self/fd/1'], { encoding: 'utf8', timeout: 15000 });
  const scrubbed = scrub(xml);
  // Each node on its own line makes keyboard and clipping state reviewable.
  appendFileSync(LOG, '\n[redacted test-device UI]\n' + scrubbed.replace(/><node/g, '>\n<node') + '\n');
  }
} catch {
  appendFileSync(LOG, '\n[UI diagnostic unavailable]\n');
}
// Crash and process/focus lines naming the test app only, so a test app that
// died can be told apart from one that lost focus. Same redaction as the UI text.
try {
  const crash = execFileSync('adb', ['logcat', '-d', '-v', 'brief', 'AndroidRuntime:E', 'ActivityManager:I', '*:S'],
    { encoding: 'utf8', timeout: 15000 });
  const lines = crash.split('\n').filter((l) => /com[.]mator[.]e2e/.test(l)).slice(-80);
  appendFileSync(LOG, '\n[redacted crash and focus log]\n' + scrub(lines.join('\n')) + '\n');
} catch {
  appendFileSync(LOG, '\n[crash log unavailable]\n');
}
