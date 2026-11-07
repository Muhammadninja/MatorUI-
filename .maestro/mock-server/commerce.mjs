/**
 * Cart, checkout and orders for the disposable loopback mock, in the live
 * backend's wire shapes (see services/cart-api.ts and services/orders-api.ts).
 * State is per synthetic account and cleared by POST /__e2e/reset.
 *
 * Test controls (loopback only, never in the app):
 *   POST /__e2e/faults  { method, path, mode: fail|delay|drop, status?, ms?, times? }
 *     fail  → answer `status` (503) without processing
 *     delay → wait `ms`, then process normally
 *     drop  → process, then close the socket: a lost response after commit
 *   GET  /__e2e/state   → orders, processed order POSTs (injected `fail`
 *                         excluded), idempotency keys and carts per account.
 *                         Waits up to 10 s for open app requests unless ?nosettle.
 */
import { PARTS_BY_ID } from './catalog-fixtures.mjs';

const DELIVERY_UZS = 25000;
const SERVICE_FEE_UZS = 5000;
const KEY_PATTERN = /^[A-Za-z0-9:_-]{8,128}$/;

// Synthetic address only; no real person or place.
const ADDRESSES = [
  { id: 'addr_e2e_home', label: 'Home', street: 'Test street 1', district: 'Test district', full_text: 'Test street 1, Test district', is_default: true },
];

let carts = new Map();
let orders = new Map();
let keys = new Map();
let orderPosts = [];
let faults = [];
let seq = 0;
let inFlight = 0;

/** Counts an app request until its response closes, so state reads can settle. */
function trackRequest(res) {
  inFlight += 1;
  res.once('close', () => { inFlight -= 1; });
}

export function resetCommerce() {
  carts = new Map(); orders = new Map(); keys = new Map(); orderPosts = []; faults = []; seq = 0;
}

const money = (n) => Math.round(n * 100) / 100;

function unitPrice(part) {
  if (typeof part.price_uzs === 'number') return part.price_uzs;
  const n = Number(String(part.price_label || '').replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function cartOf(account) {
  if (!carts.has(account)) carts.set(account, []);
  return carts.get(account);
}

function apiCart(account) {
  const items = cartOf(account);
  const subtotal = money(items.reduce((s, l) => s + l.price_uzs * l.quantity, 0));
  return { items, promo: null, subtotal_uzs: subtotal, total_uzs: subtotal };
}

/** Matches the next armed fault for this request, consuming one use. */
function takeFault(method, pathname) {
  const i = faults.findIndex((f) => f.method === method && pathname.startsWith(f.path));
  if (i === -1) return null;
  const fault = faults[i];
  fault.times -= 1;
  if (fault.times <= 0) faults.splice(i, 1);
  return fault;
}

/** Tracks an app request and applies its armed fault. True when already answered. */
export async function applyFault(req, res, pathname, send) {
  if (pathname.startsWith('/__e2e/')) return false;
  trackRequest(res);
  const fault = takeFault(req.method, pathname);
  if (fault?.mode === 'fail') { send(res, fault.status, { error: { code: 'E2E_INJECTED_FAILURE' } }); return true; }
  if (fault?.mode === 'delay') await new Promise((done) => setTimeout(done, fault.ms));
  // send() closes the socket instead of answering: the response is lost.
  if (fault?.mode === 'drop') res.dropResponse = true;
  return false;
}

function buildOrder(account, body) {
  const lines = cartOf(account);
  const pickup = body?.cart_snapshot?.delivery_method === 'pickup';
  const items = lines.map((l) => ({
    part_id: l.part_id, title: l.title, qty: l.quantity, price_uzs: l.price_uzs,
    line_total_uzs: money(l.price_uzs * l.quantity),
  }));
  const subtotal = money(items.reduce((s, l) => s + l.line_total_uzs, 0));
  const delivery = pickup ? 0 : DELIVERY_UZS;
  seq += 1;
  return {
    order_id: `ord_e2e_${String(seq).padStart(4, '0')}`,
    status: 'pending_payment',
    subtotal_uzs: subtotal, delivery_uzs: delivery, service_fee_uzs: SERVICE_FEE_UZS, discount_uzs: 0,
    total_uzs: money(subtotal + delivery + SERVICE_FEE_UZS), currency: 'UZS',
    delivery_method: pickup ? 'pickup' : 'courier',
    delivery_address_id: body?.cart_snapshot?.delivery_address_id ?? null,
    payment_type: body?.payment_type ?? null,
    items, created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  };
}

/**
 * Handles commerce routes. Returns true when the request was answered.
 * `account` is the synthetic account id for the bearer token, or null.
 */
export async function handleCommerce(req, pathname, account, { send, readBody }) {
  const { method } = req;

  if (pathname === '/__e2e/faults' && method === 'POST') {
    const f = await readBody(req);
    if (!['fail', 'delay', 'drop'].includes(f.mode) || !f.method || !f.path) {
      send(400, { error: 'method, path and mode are required' }); return true;
    }
    faults.push({ method: f.method, path: f.path, mode: f.mode, status: f.status || 503, ms: Math.min(f.ms || 0, 15000), times: f.times || 1 });
    send(200, { armed: faults.length }); return true;
  }
  if (pathname === '/__e2e/state' && method === 'GET') {
    const settle = !new URL(req.url, 'http://mock').searchParams.has('nosettle');
    for (const until = Date.now() + 10000; settle && inFlight > 0 && Date.now() < until;) {
      await new Promise((done) => setTimeout(done, 50));
    }
    const byAccount = (m) => Object.fromEntries([...m].map(([a, v]) => [a, v]));
    send(200, {
      orders: byAccount(new Map([...orders].map(([a, list]) => [a, list.map((o) => ({ order_id: o.order_id, total_uzs: o.total_uzs }))]))),
      orderPosts: orderPosts.length,
      idempotencyKeys: [...new Set(orderPosts.map((p) => p.key).filter(Boolean))].length,
      unkeyedOrderPosts: orderPosts.filter((p) => !p.key).length,
      carts: byAccount(new Map([...carts].map(([a, l]) => [a, l.map(({ part_id, quantity }) => ({ part_id, quantity }))]))),
      pendingFaults: faults.length,
    });
    return true;
  }

  const commerce = pathname === '/v1/cart' || pathname.startsWith('/v1/cart/')
    || pathname === '/v1/orders' || pathname.startsWith('/v1/orders/')
    || pathname === '/v1/account/addresses' || pathname === '/v1/shipping/quote';
  if (!commerce) return false;
  // Unauthenticated calls keep the legacy suite's handlers further down.
  if (!account) {
    if (pathname.startsWith('/v1/cart')) { send(401, { error: { code: 'UNAUTHORIZED' } }); return true; }
    return false;
  }

  // ── Cart: every mutation returns the full canonical cart ──
  if (pathname === '/v1/cart' && method === 'GET') { send(200, apiCart(account)); return true; }
  if (pathname === '/v1/cart/items' && method === 'POST') {
    const body = await readBody(req);
    const part = PARTS_BY_ID[body.part_id];
    const qty = Number(body.quantity) || 1;
    if (!part) { send(404, { error: { code: 'NOT_FOUND', message: 'Part not found' } }); return true; }
    const lines = cartOf(account);
    const line = lines.find((l) => l.part_id === part.id);
    if (line) line.quantity += qty;
    else {
      seq += 1;
      lines.push({ id: `item_e2e_${seq}`, part_id: part.id, title: part.title, price_uzs: unitPrice(part), quantity: qty, imageUrl: null });
    }
    send(200, apiCart(account)); return true;
  }
  if (pathname.startsWith('/v1/cart/items/')) {
    const id = decodeURIComponent(pathname.slice('/v1/cart/items/'.length));
    const lines = cartOf(account);
    const idx = lines.findIndex((l) => l.id === id);
    if (idx === -1) { send(404, { error: { code: 'NOT_FOUND', message: 'Cart item not found' } }); return true; }
    if (method === 'PATCH') {
      const qty = Number((await readBody(req)).quantity);
      if (!Number.isInteger(qty) || qty < 1 || qty > 999) { send(400, { error: { code: 'VALIDATION_FAILED' } }); return true; }
      lines[idx].quantity = qty;
      send(200, apiCart(account)); return true;
    }
    if (method === 'DELETE') { lines.splice(idx, 1); send(200, apiCart(account)); return true; }
  }
  if (pathname === '/v1/cart/clear' && method === 'POST') { carts.set(account, []); send(200, apiCart(account)); return true; }

  // ── Checkout reads ──
  if (pathname === '/v1/account/addresses' && method === 'GET') { send(200, { items: ADDRESSES }); return true; }
  if (pathname === '/v1/shipping/quote' && method === 'POST') {
    send(200, { options: [{ type: 'courier', label: 'Courier', price_uzs: DELIVERY_UZS, eta_days_min: 1, eta_days_max: 2 }], currency: 'UZS' });
    return true;
  }

  // ── Orders: built from the server cart, deduplicated by Idempotency-Key ──
  if (pathname === '/v1/orders' && method === 'POST') {
    const body = await readBody(req);
    const key = req.headers['idempotency-key'] || null;
    orderPosts.push({ account, key });
    if (key && !KEY_PATTERN.test(key)) { send(400, { error: { code: 'INVALID_IDEMPOTENCY_KEY' } }); return true; }
    const fingerprint = JSON.stringify(body);
    const prior = key ? keys.get(`${account}:${key}`) : null;
    if (prior) {
      if (prior.fingerprint !== fingerprint) { send(409, { error: { code: 'IDEMPOTENCY_KEY_REUSED' } }); return true; }
      send(201, prior.order); return true;
    }
    if (cartOf(account).length === 0) { send(400, { message: 'Cart is empty' }); return true; }
    const order = buildOrder(account, body);
    if (!orders.has(account)) orders.set(account, []);
    orders.get(account).push(order);
    // As the backend's createFromCart does, in the same transaction.
    carts.set(account, []);
    if (key) keys.set(`${account}:${key}`, { fingerprint, order });
    send(201, order); return true;
  }
  if (pathname === '/v1/orders' && method === 'GET') { send(200, { items: [...(orders.get(account) || [])].reverse(), next_cursor: null }); return true; }
  if (pathname.startsWith('/v1/orders/') && method === 'GET') {
    const id = decodeURIComponent(pathname.slice('/v1/orders/'.length));
    const order = (orders.get(account) || []).find((o) => o.order_id === id);
    if (!order) { send(404, { error: { code: 'NOT_FOUND' } }); return true; }
    send(200, order); return true;
  }
  return false;
}
