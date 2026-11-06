// Test-device UI text only. Never persist raw hierarchies or screenshots here.
import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
try {
  execFileSync('adb', ['shell', 'uiautomator', 'dump', '/sdcard/mator-e2e-ui.xml'], { stdio: 'ignore', timeout: 15000 });
  const xml = execFileSync('adb', ['exec-out', 'cat', '/sdcard/mator-e2e-ui.xml'], { encoding: 'utf8', timeout: 10000 });
  const scrubbed = xml
    .replace(/\+?998[\d ()-]{9,}/g, '[TEST_PHONE]')
    .replace(/srv_(?:access|refresh)_[a-z0-9_]+/g, '[TEST_TOKEN]');
  // Each node on its own line makes keyboard and clipping state reviewable.
  appendFileSync('/tmp/mator-e2e-mock.log', '\n[redacted test-device UI]\n' + scrubbed.replace(/><node/g, '>\n<node') + '\n');
} catch {
  appendFileSync('/tmp/mator-e2e-mock.log', '\n[UI diagnostic unavailable]\n');
}
