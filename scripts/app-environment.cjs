#!/usr/bin/env node
const { spawn } = require('node:child_process');
const path = require('node:path');
const { environmentFrom } = require('../config/environment-policy.cjs');

const [name, ...providedArgs] = process.argv.slice(2);
if (!['local', 'production'].includes(name)) {
  console.error('Usage: node scripts/app-environment.cjs <local|production> [start|export|config] [Expo options]');
  process.exit(1);
}
const args = providedArgs.length
  ? providedArgs
  : ['start', '--localhost', '--port', '8082', '--clear'];
if (!['start', 'export', 'config'].includes(args[0])) {
  console.error('Expected an Expo start, export or config command.');
  process.exit(1);
}
if (args[0] === 'start' && !args.includes('--clear')) args.push('--clear');
const env = { ...process.env };
if (name === 'local' && env.MATOR_API_PORT &&
    (!/^\d+$/.test(env.MATOR_API_PORT) || Number(env.MATOR_API_PORT) < 1024 || Number(env.MATOR_API_PORT) > 65535)) {
  console.error('MATOR_API_PORT must be an unprivileged TCP port (1024–65535).');
  process.exit(1);
}
// Never inherit public variables or backend test-auth switches from a shell or
// an earlier session. Expo's config snapshot is the authoritative public source.
for (const key of Object.keys(env)) {
  if (key.startsWith('EXPO_PUBLIC_') || key === 'AUTH_DEV_MODE') delete env[key];
}
Object.assign(env, {
  EXPO_NO_DOTENV: '1', EXPO_NO_TELEMETRY: '1', AUTH_DEV_MODE: 'false',
  NODE_OPTIONS: `${env.NODE_OPTIONS || ''} --dns-result-order=ipv4first`.trim(),
  EXPO_PUBLIC_APP_ENV: name,
  EXPO_PUBLIC_API_BASE_URL: name === 'local'
    ? `http://127.0.0.1:${env.MATOR_API_PORT || '3300'}`
    : 'https://api.mator.uz',
  EXPO_PUBLIC_HTTP_DOMAINS: '',
  EXPO_PUBLIC_ALLOW_DEV_OTP: name === 'local' ? 'true' : 'false',
  EXPO_PUBLIC_SENTRY_DSN: '',
});
if (args[0] === 'export') env.NODE_ENV = 'production';
environmentFrom(env, args[0] === 'export');
console.log(`Mator environment: ${name}; API ${env.EXPO_PUBLIC_API_BASE_URL}; dotenv files disabled.`);
const root = path.resolve(__dirname, '..');
const child = spawn(process.execPath, [require.resolve('expo/bin/cli'), ...args], {
  cwd: root, env, stdio: 'inherit',
});
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => child.kill(signal));
}
child.on('exit', (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
child.on('error', () => { console.error('Could not start Expo. Run npm ci first.'); process.exit(1); });
