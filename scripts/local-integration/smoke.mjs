import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import path from 'node:path';
import { state, ports, assertLocalEnvironment } from './settings.mjs';

const environment = JSON.parse(await fs.readFile(path.join(state, 'environment.json'), 'utf8'));
assertLocalEnvironment(environment);
const base = `http://127.0.0.1:${ports.api}`;
const requests = [];
let token;
async function call(method, route, body) {
  const response = await fetch(base + route, {
    method, redirect: 'error', signal: AbortSignal.timeout(15000),
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  requests.push({ method, route, status: response.status });
  if (!response.ok) throw Error(`${method} ${route} returned ${response.status}`);
  return response.json();
}

try {
  const health = await call('GET', '/health');
  assert.equal(health.database, 'up');
  const otp = await call('POST', '/v1/auth/phone/request-otp', {
    phone_e164: '+998900000001', country_iso2: 'UZ', channel: 'sms', lang: 'ru',
  });
  assert.ok(otp.dev_otp_code, 'Local-only test authorization must be explicitly enabled');
  const auth = await call('POST', '/v1/auth/phone/verify-otp', {
    phone_e164: '+998900000001', request_id: otp.request_id, otp_code: otp.dev_otp_code,
  });
  token = auth.tokens.access_token;
  const created = await call('POST', '/v1/garage/vehicles', {
    make_id: 'chevrolet', model_id: 'cobalt', year: 2024, trim_id: 'cobalt-p1-elegant',
    nickname: 'LOCAL TEST HTTP smoke — disposable vehicle', is_primary: false,
  });
  await call('POST', `/v1/garage/vehicles/${created.id}/set-primary`, {});
  let garage = await call('GET', '/v1/garage/vehicles');
  assert.equal(garage.vehicles.find((vehicle) => vehicle.id === created.id).is_primary, true);
  await call('POST', '/v1/garage/vehicles/veh_local_seed/set-primary', {});
  await call('DELETE', `/v1/garage/vehicles/${created.id}`);
  garage = await call('GET', '/v1/garage/vehicles');
  assert.equal(garage.vehicles.find((vehicle) => vehicle.id === 'veh_local_seed').is_primary, true);
  const compatibility = {};
  for (const [key, status, isCompatible] of [
    ['exact', 'EXACT_MATCH', true], ['no', 'NOT_COMPATIBLE', false],
    ['unknown', 'UNCERTAIN', false], ['universal', 'UNIVERSAL', true],
  ]) {
    const result = await call('POST', `/v1/catalog/parts/part_local_${key}/check-compatibility`, {
      vehicleId: 'veh_local_seed',
    });
    assert.equal(result.status, status);
    assert.equal(result.isCompatible, isCompatible);
    compatibility[key] = { status: result.status, isCompatible: result.isCompatible, color: result.badge.color };
  }
  await call('POST', '/v1/cart/clear', {});
  let cart = await call('POST', '/v1/cart/items', { part_id: 'part_local_exact', quantity: 1 });
  const line = cart.items[0].id;
  cart = await call('PATCH', `/v1/cart/items/${line}`, { quantity: 3 });
  assert.equal(cart.subtotal_uzs, 300000);
  cart = await call('DELETE', `/v1/cart/items/${line}`);
  assert.deepEqual(cart.items, []);
  cart = await call('POST', '/v1/cart/items', { part_id: 'part_local_exact', quantity: 2 });
  assert.equal((await call('GET', '/v1/cart')).subtotal_uzs, 200000);
  const addresses = await call('GET', '/v1/account/addresses');
  const address = (addresses.items || addresses.addresses || addresses).find((value) => value.id === 'addr_local_test');
  assert.ok(address, 'Synthetic checkout address must be available');
  const shipping = await call('POST', '/v1/shipping/quote', { delivery_address_id: address.id });
  assert.equal(shipping.options.find((option) => option.type === 'pickup').price_uzs, 0);
  assert.equal(shipping.options.find((option) => option.type === 'courier').price_uzs, 25000);
  await call('GET', '/v1/account/payment-methods');
  const order = await call('POST', '/v1/orders', {
    cart_snapshot: { delivery_address_id: address.id, delivery_method: 'courier' },
    vehicle_id: 'veh_local_seed', payment_type: 'cash', contact_phone_e164: '+998900000001',
  });
  assert.equal(order.subtotal_uzs, 200000);
  assert.equal(order.total_uzs, 230000);
  assert.equal(order.total_uzs, order.subtotal_uzs + order.delivery_uzs + order.service_fee_uzs - order.discount_uzs);
  assert.deepEqual((await call('GET', '/v1/cart')).items, []);
  const result = {
    timestamp: new Date().toISOString(), environment: 'local integration',
    realRequests: true, syntheticData: true, compatibility,
    garageCreateSelectDelete: 'passed', cartAddQuantityRemoveRead: 'passed',
    checkoutCashOrder: { id: order.order_id, total: order.total_uzs, status: order.status },
    unverified: ['native UI', 'cold app restart', 'SMS', 'email', 'push', 'payment sandbox', 'real delivery'],
    requests,
  };
  await fs.writeFile(path.join(state, 'smoke-results.json'), JSON.stringify(result, null, 2), { mode: 0o600 });
  console.log(`PASS: ${requests.length} real local HTTP requests; Garage, four fitment cases, cart, cash checkout. No external payment.`);
  console.log('Cart is now empty. Run seed to restore populated audit data.');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
