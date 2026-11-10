// Direct Android startup probe: disposable app, loopback mock, no Maestro/input.
// All captures are from a cleared guest session; never use with a production ID.
import { execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const APP = 'com.mator.e2e';
const output = process.argv[2];
if (!output) throw new Error('Usage: node scripts/diagnose-startup.mjs <new-output-directory>');
mkdirSync(output, { recursive: false });
const scrub = (s) => s
  .replace(/\+?998[\d ()-]{9,}/g, '[TEST_PHONE]')
  .replace(/srv_(?:access|refresh)_[a-z0-9_]+/g, '[TEST_TOKEN]')
  .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [REDACTED]');
const save = (name, text) => writeFileSync(path.join(output, name), scrub(text));
function command(binary, args) {
  try {
    return execFileSync(binary, args, { encoding: 'utf8', timeout: 25000, maxBuffer: 4 * 1024 * 1024 });
  } catch (error) {
    return `[command failed] ${binary} ${args.join(' ')}\n${error.stdout ?? ''}\n${error.stderr ?? ''}`;
  }
}
const adb = (...args) => command('adb', args);
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const apk = 'android/app/build/outputs/apk/release/app-release.apk';
const apkHash = createHash('sha256').update(readFileSync(apk)).digest('hex');
const installed = adb('shell', 'pm', 'path', APP).trim().replace(/^package:/, '');
if (!installed.startsWith('/data/app/') || installed.includes('\n')) throw new Error('Dedicated APK not installed');
const installedHash = adb('shell', 'sha256sum', installed).split(/\s/)[0];
if (installedHash !== apkHash) throw new Error('Installed APK differs from local APK');
save('versions.log', [
  `UTC: ${new Date().toISOString()}`, `APK SHA256: ${apkHash}`,
  `Git HEAD (build predates checkpoint): ${command('git', ['rev-parse', 'HEAD']).trim()}`,
  `Package: ${APP}`, `Installed APK SHA256: ${installedHash}`,
  `Device: ${adb('shell', 'getprop', 'ro.build.fingerprint').trim()}`,
  `AVD: ${adb('shell', 'getprop', 'ro.boot.qemu.avd_name').trim()}`,
  `Animator scale: ${adb('shell', 'settings', 'get', 'global', 'animator_duration_scale').trim()}`,
  'Reproduction: mock ready; clear app log; pm clear dedicated app; am start -W MAIN/LAUNCHER;',
  'wait 8s with no input or UI automation; capture frame/resources; then dump UI hierarchy.',
  'Repeat 3 times; no sign-in, production calls, orders or payments.',
].join('\n'));
function resources(name) {
  const mem = adb('shell', 'cat', '/proc/meminfo').split('\n')
    .filter((line) => /^(MemTotal|MemFree|MemAvailable|SwapTotal|SwapFree):/.test(line)).join('\n');
  const cpu = adb('shell', 'dumpsys', 'cpuinfo').split('\n')
    .filter((line) => /CPU usage|TOTAL|com[.]mator[.]e2e|system_server|surfaceflinger|kswapd/.test(line)).join('\n');
  const anr = adb('shell', 'dumpsys', 'activity', 'lastanr').split('\n')
    .filter((line) => /ANR time|Reason:|No ANR/.test(line)).join('\n');
  save(name, `${new Date().toISOString()}\n${mem}\n${cpu}\n${anr}\n`);
}
const mockLines = [];
const mock = spawn(process.execPath, ['.maestro/mock-server/standalone-server.mjs'], {
  env: { ...process.env, PORT: '8080' }, stdio: ['ignore', 'pipe', 'pipe'],
});
mock.stdout.on('data', (data) => mockLines.push(String(data)));
mock.stderr.on('data', (data) => mockLines.push(String(data)));
try {
  for (let i = 0; ; i++) {
    if (mock.exitCode !== null) throw new Error('Mock did not start');
    try { await fetch('http://127.0.0.1:8080/'); break; } catch { /* Wait for bind. */ }
    if (i === 50) throw new Error('Mock readiness timed out');
    await pause(200);
  }
  resources('resources-before.log');
  const results = [];
  for (let run = 1; run <= 3; run++) {
    adb('logcat', '-c');
    const cleared = adb('shell', 'pm', 'clear', APP);
    if (!cleared.includes('Success')) throw new Error('Dedicated app clear failed');
    const launch = adb('shell', 'am', 'start', '-W', '-n', `${APP}/.MainActivity`,
      '-a', 'android.intent.action.MAIN', '-c', 'android.intent.category.LAUNCHER');
    save(`run-${run}-launch.log`, `${new Date().toISOString()}\n${cleared}\n${launch}`);
    await pause(8000);
    // No UI automation has run yet. Check dedicated focus before saving pixels.
    const activity = adb('shell', 'dumpsys', 'activity', 'activities');
    if (/^.*(?:topResumedActivity|mResumedActivity).*com[.]mator[.]e2e\//m.test(activity)) {
      const frame = execFileSync('adb', ['exec-out', 'screencap', '-p'], { timeout: 25000 });
      writeFileSync(path.join(output, `run-${run}-guest.png`), frame);
    }
    resources(`run-${run}-resources.log`);
    const pid = adb('shell', 'pidof', APP).trim();
    if (/^\d+$/.test(pid)) save(`run-${run}-app.log`, adb('logcat', '-d', '--pid', pid, '-v', 'threadtime'));
    const ui = adb('exec-out', 'uiautomator', 'dump', '/proc/self/fd/1');
    save(`run-${run}-ui.xml`, ui);
    const result = { run, pid, languageScreen: ui.includes('resource-id="language-screen"'),
      englishRow: ui.includes('resource-id="language-option-en"'), anrDialog: /isn.t responding/.test(ui) };
    results.push(result);
    console.log(JSON.stringify(result));
    if (!result.languageScreen || result.anrDialog) break; // Inspect before another attempt.
  }
  save('results.json', JSON.stringify(results, null, 2));
} finally {
  mock.kill();
  save('mock.log', mockLines.join(''));
}
