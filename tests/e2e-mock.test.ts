import { spawn, type ChildProcess } from 'node:child_process';
import { afterAll, beforeAll, expect, test } from 'vitest';

let child: ChildProcess;
let base: string;
beforeAll(async () => {
  child = spawn(process.execPath, ['.maestro/mock-server/standalone-server.mjs'], {
    env: { ...process.env, PORT: '0' }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  base = await new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Mock startup timed out')), 10000);
    child.once('error', reject);
    child.once('exit', () => reject(new Error('Mock exited')));
    child.stdout!.on('data', (chunk) => {
      const port = String(chunk).match(/Mator mock server → http:\/\/localhost:(\d+)/)?.[1];
      if (port) { clearTimeout(timer); resolve(`http://127.0.0.1:${port}`); }
    });
  });
});
afterAll(() => child?.kill());
const post = (path: string, body: object) => fetch(`${base}${path}`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});
async function request(phone: string) {
  return (await post('/v1/auth/phone/request-otp', { phone_e164: phone })).json();
}
async function signIn(phone: string) {
  const otp = await request(phone);
  return (await post('/v1/auth/phone/verify-otp', {
    request_id: otp.request_id, phone_e164: phone, otp_code: '123456',
  })).json();
}
test('synthetic accounts keep distinct stable owners across sign-in, /me and refresh', async () => {
  const a = await signIn('+998900000001');
  const b = await signIn('+998900000002');
  const again = await signIn('+998900000001');
  expect(a.user.id).toBe(again.user.id);
  expect(a.user.id).not.toBe(b.user.id);
  const me = await fetch(`${base}/v1/me`, { headers: { Authorization: `Bearer ${a.tokens.access_token}` } });
  expect((await me.json()).id).toBe(a.user.id);
  const refresh = await post('/v1/auth/token/refresh', { refresh_token: a.tokens.refresh_token });
  expect((await refresh.json()).tokens.access_token).toBe(a.tokens.access_token);
  expect((await fetch(`${base}/v1/me`)).status).toBe(401);
});
test('rejects unknown accounts, wrong OTPs, missing challenges, reuse and reset challenges', async () => {
  expect((await post('/v1/auth/phone/request-otp', { phone_e164: '+998900000003' })).status).toBe(422);
  const phone = '+998900000001';
  const otp = await request(phone);
  const payload = { request_id: otp.request_id, phone_e164: phone, otp_code: '654321' };
  expect((await post('/v1/auth/phone/verify-otp', payload)).status).toBe(422);
  payload.otp_code = '123456';
  expect((await post('/v1/auth/phone/verify-otp', payload)).status).toBe(200);
  expect((await post('/v1/auth/phone/verify-otp', payload)).status).toBe(422);
  const next = await request(phone);
  await post('/__e2e/reset', {});
  expect((await post('/v1/auth/phone/verify-otp', { ...payload, request_id: next.request_id })).status).toBe(422);
});
