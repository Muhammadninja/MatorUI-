// Test-device UI text only. Never persist raw hierarchies or screenshots here.
import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
const LOG = process.env.MOCK_LOG || '/tmp/mator-e2e-mock.log';
const scrub = (text) => text
  .replace(/\+?998[\d ()-]{9,}/g, '[TEST_PHONE]')
  .replace(/srv_(?:access|refresh)_[a-z0-9_]+/g, '[TEST_TOKEN]');
try {
  const activity = execFileSync('adb', ['shell', 'dumpsys', 'activity', 'activities'], { encoding: 'utf8', timeout: 10000 });
  if (!/^.*(?:topResumedActivity|mResumedActivity).*com[.]mator[.]e2e\//m.test(activity)) {
    // Component names only, e.g. another app or a system dialog that took focus.
    const front = activity.match(/(?:topResumedActivity|mResumedActivity).*?\{[^}]*?\s([\w.]+\/[\w.$]+)/)?.[1] ?? 'none';
    appendFileSync(LOG, `\n[UI diagnostic skipped: dedicated test app is not resumed; resumed: ${front}]\n`);
  } else {
  const xml = execFileSync('adb', ['exec-out', 'uiautomator', 'dump', '/proc/self/fd/1'], { encoding: 'utf8', timeout: 15000 });
  const scrubbed = scrub(xml);
  // Each node on its own line makes keyboard and clipping state reviewable.
  appendFileSync(LOG, '\n[redacted test-device UI]\n' + scrubbed.replace(/><node/g, '>\n<node') + '\n');
  }
} catch {
  appendFileSync(LOG, '\n[UI diagnostic unavailable]\n');
}
// Crash and JS-error lines only, so a test app that died can be told apart
// from one that lost focus. Same redaction as the UI text.
try {
  const crash = execFileSync('adb', ['logcat', '-d', '-v', 'brief', 'AndroidRuntime:E', 'ReactNativeJS:E', 'ActivityManager:I', '*:S'],
    { encoding: 'utf8', timeout: 15000 });
  const lines = crash.split('\n').filter((l) => /AndroidRuntime|ReactNativeJS|com[.]mator[.]e2e/.test(l)).slice(-80);
  appendFileSync(LOG, '\n[redacted crash and focus log]\n' + scrub(lines.join('\n')) + '\n');
} catch {
  appendFileSync(LOG, '\n[crash log unavailable]\n');
}
