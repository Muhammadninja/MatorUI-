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
const authed = (token: string, method: string, path: string, body?: object, headers: Record<string, string> = {}) =>
  fetch(`${base}${path}`, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...headers },
    body: body ? JSON.stringify(body) : undefined });
const state = async () => (await fetch(`${base}/__e2e/state`)).json();
test('server carts are per account, exact in tiyin, and closed to guests', async () => {
  await post('/__e2e/reset', {});
  const a = (await signIn('+998900000001')).tokens.access_token;
  const b = (await signIn('+998900000002')).tokens.access_token;
  expect((await fetch(`${base}/v1/cart`)).status).toBe(401);
  const added = await (await authed(a, 'POST', '/v1/cart/items', { part_id: 'mann-cabin-filter', quantity: 1 })).json();
  const line = added.items[0];
  const patched = await (await authed(a, 'PATCH', `/v1/cart/items/${line.id}`, { quantity: 3 })).json();
  expect(patched.subtotal_uzs).toBe(197190.72);
  expect((await (await authed(b, 'GET', '/v1/cart')).json()).items).toEqual([]);
  expect((await authed(b, 'DELETE', `/v1/cart/items/${line.id}`)).status).toBe(404);
  expect((await state()).carts.e2e_a).toEqual([{ part_id: 'mann-cabin-filter', quantity: 3 }]);
});
test('one Idempotency-Key creates one order, also when the first response is lost', async () => {
  await post('/__e2e/reset', {});
  const a = (await signIn('+998900000001')).tokens.access_token;
  await authed(a, 'POST', '/v1/cart/items', { part_id: 'mann-cabin-filter', quantity: 3 });
  const order = { cart_snapshot: { delivery_method: 'courier', delivery_address_id: 'addr_e2e_home', promo_code: null }, payment_type: 'cash' };
  await post('/__e2e/faults', { method: 'POST', path: '/v1/orders', mode: 'fail' });
  await post('/__e2e/faults', { method: 'POST', path: '/v1/orders', mode: 'drop' });
  const key = { 'Idempotency-Key': 'ord_unit_key_1' };
  expect((await authed(a, 'POST', '/v1/orders', order, key)).status).toBe(503);
  await expect(authed(a, 'POST', '/v1/orders', order, key)).rejects.toThrow();
  const replay = await authed(a, 'POST', '/v1/orders', order, key);
  expect(replay.status).toBe(201);
  expect((await replay.json()).total_uzs).toBe(227190.72);
  expect((await authed(a, 'POST', '/v1/orders', { ...order, payment_type: 'payme' }, key)).status).toBe(409);
  const s = await state();
  expect(s.orders.e2e_a).toHaveLength(1);
  expect(s.orderPosts).toBe(3); // the injected 503 never reached the handler
  expect(s.orderRequests).toBe(4);
  expect(s.idempotencyKeys).toBe(1);
  expect((await state()).carts.e2e_a).toEqual([]);
  // Without a key, as on the backend source: the order empties the cart, so a
  // blind retry is refused with "Cart is empty" although the order exists.
  await authed(a, 'POST', '/v1/cart/items', { part_id: 'mann-fuel-filter', quantity: 1 });
  expect((await authed(a, 'POST', '/v1/orders', order)).status).toBe(201);
  const retry = await authed(a, 'POST', '/v1/orders', order);
  expect(retry.status).toBe(400);
  expect((await retry.json()).message).toBe('Cart is empty');
  expect((await state()).orders.e2e_a).toHaveLength(2);
});
test('delay faults hold the response; orders are invisible to other accounts', async () => {
  await post('/__e2e/reset', {});
  const a = (await signIn('+998900000001')).tokens.access_token;
  const b = (await signIn('+998900000002')).tokens.access_token;
  await post('/__e2e/faults', { method: 'GET', path: '/v1/cart', mode: 'delay', ms: 300 });
  const started = Date.now();
  expect((await authed(a, 'GET', '/v1/cart')).status).toBe(200);
  expect(Date.now() - started).toBeGreaterThanOrEqual(280);
  await authed(a, 'POST', '/v1/cart/items', { part_id: 'mann-fuel-filter', quantity: 1 });
  const created = await (await authed(a, 'POST', '/v1/orders', { cart_snapshot: { delivery_method: 'courier' } })).json();
  expect((await authed(b, 'GET', `/v1/orders/${created.order_id}`)).status).toBe(404);
  expect((await authed(a, 'GET', `/v1/orders/${created.order_id}`)).status).toBe(200);
});
