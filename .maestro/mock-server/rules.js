/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Maestro Mock Server rules — Mator offline E2E suite
 * Docs: https://docs.maestro.dev/advanced/mock-server
 *
 * The Maestro Mock Server evaluates this file per intercepted request. Each
 * `router.<method>(path, handler)` registers a matcher; the handler shapes the
 * response. Because every rule returns a hardcoded payload, the app never
 * touches Supabase or NHTSA — the whole suite runs offline & deterministically.
 *
 * Run it:
 *   maestro mock-server .maestro/mock-server/rules.js --port 8080
 *
 * Then build/launch the app with:
 *   EXPO_PUBLIC_API_BASE_URL=http://localhost:8080
 * (or on a physical device, the mock host's LAN IP). See ../README.md.
 *
 * These three rules mirror the exact contract the Supabase REST backend is
 * being built to. When the backend ships, delete this file and point
 * EXPO_PUBLIC_API_BASE_URL at the real gateway — the flows don't change.
 * ─────────────────────────────────────────────────────────────────────────────
 */

// Single source of truth for the seeded vehicle, shared across rules so Flow 1
// (decode) and Flow 3 (fitment-scoped parts) never drift apart.
const SEEDED_CAR = { make: 'CHEVROLET', model: 'Cobalt', year: 2022 };

// ── FLOW 1 ───────────────────────────────────────────────────────────────────
// POST /v1/auth/decode-vin  → hardcoded successful decode.
router.post('/v1/auth/decode-vin', (req, res) => {
  // Optional request assertion: echo a 422 for a malformed VIN so negative-path
  // tests can exercise the error branch without a real validator.
  const vin = (req.body && req.body.vin) || '';
  if (typeof vin !== 'string' || vin.replace(/\s/g, '').length !== 17) {
    res.status = 422;
    res.body = { success: false, error: { code: 'INVALID_LENGTH', message: 'VIN must be 17 characters.' } };
    return;
  }

  res.status = 200;
  res.headers = { 'Content-Type': 'application/json' };
  res.body = {
    success: true,
    car: { make: SEEDED_CAR.make, model: SEEDED_CAR.model, year: SEEDED_CAR.year },
  };
});

// ── AUTH: passwordless phone OTP (backend.json wire shape) ───────────────────
// request-otp hands back a request_id + dev_otp_code (so offline/E2E builds
// auto-fill); verify-otp accepts any 6-digit code and returns { user, tokens }.
const pendingOtps = {}; // request_id → { phone_e164 }
router.post('/v1/auth/phone/request-otp', (req, res) => {
  const body = req.body || {};
  const requestId = `otp_${Math.random().toString(36).slice(2, 12)}`;
  pendingOtps[requestId] = { phone_e164: body.phone_e164 };
  res.status = 200; res.headers = { 'Content-Type': 'application/json' };
  res.body = {
    request_id: requestId,
    phone_e164: body.phone_e164 || '+998901234567',
    expires_at: new Date(Date.now() + 300000).toISOString(),
    resend_after_seconds: 60,
    otp_length: 6,
    delivery_channel: 'sms',
    is_existing_user: true,
    next_screen: 'AuthOtpVerifyScreen',
    dev_otp_code: '123456', // MOCK ONLY — the real backend omits this.
  };
});
router.post('/v1/auth/phone/verify-otp', (req, res) => {
  const body = req.body || {};
  const code = typeof body.otp_code === 'string' ? body.otp_code.trim() : '';
  res.headers = { 'Content-Type': 'application/json' };
  if (!/^\d{6}$/.test(code)) {
    res.status = 422; res.body = { error: { code: 'INVALID_CODE', message: 'Enter the 6-digit code.' } };
    return;
  }
  const p = pendingOtps[body.request_id] || {};
  delete pendingOtps[body.request_id];
  const id = `usr_${Math.random().toString(36).slice(2, 10)}`;
  res.status = 200;
  res.body = {
    user: {
      id,
      phone_e164: p.phone_e164 || body.phone_e164 || '+998901234567',
      display_name: null,
      avatar_url: null,
      myid_status: 'not_verified',
      transaction_limit_uzs: 0,
      created_at: '2026-01-01T00:00:00.000Z',
    },
    tokens: {
      access_token: `srv_access_${id}`,
      access_token_expires_at: new Date(Date.now() + 3600000).toISOString(),
      refresh_token: `srv_refresh_${id}`,
      refresh_token_expires_at: new Date(Date.now() + 7776000000).toISOString(),
      token_type: 'Bearer',
    },
    requires_myid_verification: false,
    next_screen: 'Tabs',
  };
});
router.post('/v1/auth/token/refresh', (req, res) => {
  res.headers = { 'Content-Type': 'application/json' };
  const id = `usr_${Math.random().toString(36).slice(2, 10)}`;
  res.status = 200;
  res.body = {
    tokens: {
      access_token: `srv_access_${id}`,
      access_token_expires_at: new Date(Date.now() + 3600000).toISOString(),
      refresh_token: `srv_refresh_${id}`,
      refresh_token_expires_at: new Date(Date.now() + 7776000000).toISOString(),
      token_type: 'Bearer',
    },
  };
});

// ── FLOW 3 ───────────────────────────────────────────────────────────────────
// GET /v1/catalog/parts?systemId=brakes → two brake parts.
// Matches whether the build sends `systemId` (spec) or `category` (live app).
//
// Shape MUST be the backend's `ApiCatalogPart` (nested brand/category, snake_case
// price/stock/oem) — HttpCatalogTransport.mapPartToCatalogItem() reads exactly
// these fields. In particular `brand.name` becomes the filter chip the Stage-3
// flow taps, so it must be present. See services/catalog-service.ts.
router.get('/v1/catalog/parts', (req, res) => {
  const system = (req.queryParams.systemId || req.queryParams.category || '').toLowerCase();

  const CATALOG = {
    brakes: [
      {
        id: 'brembo-fp',
        title: 'Brembo Front Brake Pads',
        brand: { id: 'brembo', name: 'Brembo' },       // → description "Brembo · …" + filter chip
        category: { id: 'brakes', name: 'Brake System' },
        oem_numbers: ['BREMBO P59049'],
        price_label: '$89.00',
        in_stock: true,
        region: 'europe',
        images: ['https://cdn.mator.local/parts/brembo-fp.png'],
        specs: [{ label: 'Position', value: 'Front axle' }],
        features: ['Low-dust compound', 'OE-spec fitment'],
      },
      {
        id: 'bosch-rotor',
        title: 'Bosch Brake Rotor',
        brand: { id: 'bosch', name: 'Bosch' },
        category: { id: 'brakes', name: 'Brake System' },
        oem_numbers: ['BOSCH 0986479R89'],
        price_label: '$54.50',
        in_stock: true,
        region: 'europe',
        images: ['https://cdn.mator.local/parts/bosch-rotor.png'],
        specs: [{ label: 'Diameter', value: '256 mm' }],
        features: ['Vented', 'Anti-corrosion coating'],
      },
    ],
  };

  // ?q=<term> → title/brand substring search across every part (Flow 9).
  const q = (req.queryParams.q || '').trim().toLowerCase();
  const all = Object.values(CATALOG).flat();
  const items = q
    ? all.filter((p) => p.title.toLowerCase().includes(q) || (p.brand && p.brand.name.toLowerCase().includes(q)))
    : CATALOG[system] || [];
  res.status = 200;
  res.headers = { 'Content-Type': 'application/json' };
  res.body = { items, total: items.length, page: 1, page_size: 50, next_page: null };
});

// ── BUY PATH ─────────────────────────────────────────────────────────────────
// GET /v1/catalog/parts/:id → a single ApiCatalogPart for the Item Detail screen
// (HttpCatalogTransport.detail reads the object directly). Unknown id → 404 so
// the screen's real "Product not found" branch is exercised.
const ALL_PARTS = {
  'brembo-fp': {
    id: 'brembo-fp', title: 'Brembo Front Brake Pads',
    brand: { id: 'brembo', name: 'Brembo' }, category: { id: 'brakes', name: 'Brake System' },
    oem_numbers: ['BREMBO P59049'], price_label: '$89.00', in_stock: true, region: 'europe',
    images: ['https://cdn.mator.local/parts/brembo-fp.png'],
    specs: [{ label: 'Position', value: 'Front axle' }], features: ['Low-dust compound', 'OE-spec fitment'],
  },
  'bosch-rotor': {
    id: 'bosch-rotor', title: 'Bosch Brake Rotor',
    brand: { id: 'bosch', name: 'Bosch' }, category: { id: 'brakes', name: 'Brake System' },
    oem_numbers: ['BOSCH 0986479R89'], price_label: '$54.50', in_stock: true, region: 'europe',
    images: ['https://cdn.mator.local/parts/bosch-rotor.png'],
    specs: [{ label: 'Diameter', value: '256 mm' }], features: ['Vented', 'Anti-corrosion coating'],
  },
};
router.get('/v1/catalog/parts/:id', (req, res) => {
  const part = ALL_PARTS[req.params.id];
  res.headers = { 'Content-Type': 'application/json' };
  if (!part) {
    res.status = 404;
    res.body = { error: { code: 'NOT_FOUND', message: `No part ${req.params.id}` } };
    return;
  }
  res.status = 200;
  res.body = part;
});

// ── BUY PATH: checkout + orders ──────────────────────────────────────────────
// Ported from services/orders-api.ts seeds. The app build routes `orders` over
// HTTP, so checkout hits these — they MUST be arrays (the orders hooks call
// .findIndex on them); the generic catch-all object would crash the screen.
const ADDRESSES = [
  { id: 'addr_home', label: 'Home', name: 'Alex Marino', line1: '128 Marrakesh Rd, Suite 4', city: 'Brooklyn, NY 11211', isDefault: true, is_default: true, lat: 41.3111, lng: 69.2797 },
  { id: 'addr_shop', label: 'Shop', name: 'Alex Marino', line1: '2210 W Industrial Blvd', city: 'Long Island City, NY 11101', isDefault: false, is_default: false, lat: 41.3385, lng: 69.3345 },
];
const PAYMENT_METHODS = [
  { id: 'pm_mc_4242', brand: 'Mastercard', last4: '4242', exp: '09/27', isDefault: true },
  { id: 'pm_visa_1881', brand: 'Visa', last4: '1881', exp: '03/26', isDefault: false },
];
const createdOrders = {}; // orderId → raw backend order (stateful across requests)

router.get('/v1/account/addresses', (_req, res) => {
  res.status = 200; res.headers = { 'Content-Type': 'application/json' }; res.body = ADDRESSES;
});
router.get('/v1/account/payment-methods', (_req, res) => {
  res.status = 200; res.headers = { 'Content-Type': 'application/json' }; res.body = PAYMENT_METHODS;
});
router.post('/v1/shipping/quote', (_req, res) => {
  res.status = 200; res.headers = { 'Content-Type': 'application/json' };
  res.body = {
    options: [
      { type: 'pickup', label: 'Olib ketish', available: true, price_uzs: 0, quote_id: null, unavailable_reason: null },
      { type: 'courier', label: 'Kuryer', available: true, price_uzs: 15000, quote_id: 'mock_quote', unavailable_reason: null },
    ],
    currency: 'UZS',
  };
});
// The backend's real order shape, since the app reads its status and payment type.
router.post('/v1/orders', (req, res) => {
  const body = req.body || {};
  const orderId = `ord_${40000 + Math.floor(Math.random() * 60000)}`;
  createdOrders[orderId] = {
    order_id: orderId,
    status: 'pending_payment',
    payment_type: body.payment_type || null,
    delivery_method: body.cart_snapshot ? body.cart_snapshot.delivery_method : null,
    delivery_address_id: body.cart_snapshot ? body.cart_snapshot.delivery_address_id : null,
    subtotal_uzs: 89000,
    delivery_uzs: 15000,
    total_uzs: 104000,
    currency: 'UZS',
    items: [{ part_id: 'brembo-fp', title: 'Brembo Front Brake Pads', qty: 1, price_uzs: 89000, line_total_uzs: 89000 }],
    created_at: '2026-07-13T10:00:00.000Z',
  };
  res.status = 201; res.headers = { 'Content-Type': 'application/json' };
  res.body = createdOrders[orderId];
});
router.get('/v1/shipping/coverage', (_req, res) => {
  res.status = 200; res.headers = { 'Content-Type': 'application/json' };
  res.body = { configured: true, bounds: { min_lat: 41.2, min_lng: 69.1, max_lat: 41.4, max_lng: 69.4 } };
});
router.get('/v1/addresses/reverse', (_req, res) => {
  res.status = 200; res.headers = { 'Content-Type': 'application/json' };
  res.body = { address: null, within_coverage: true, attribution: null };
});
// What the app searches through while a buyer types an address.
router.get('/v1/addresses/suggestions', (_req, res) => {
  res.status = 200; res.headers = { 'Content-Type': 'application/json' };
  res.body = {
    items: [
      { id: '1', title: 'Amir Temur 12', subtitle: 'Yunusobod, Toshkent', city: 'Toshkent', district: 'Yunusobod', street: 'Amir Temur', house_number: '12', lat: 41.3111, lng: 69.2797 },
    ],
    attribution: 'Map data © OpenStreetMap contributors, licensed under the ODbL.',
  };
});
router.get('/v1/orders', (_req, res) => {
  res.status = 200;
  res.headers = { 'Content-Type': 'application/json' };
  res.body = {
    page: 1, pageSize: 20, total: 5,
    items: [
      { id: 'ORD-8821', date: 'May 28, 2026', status: 'Delivered', items: 3, total: '$486.00', summary: 'Garrett GTX3582R + 2 items' },
      { id: 'ORD-8790', date: 'May 14, 2026', status: 'In Transit', items: 1, total: '$1,249.00', summary: 'KW Coilovers V3 Suspension Kit' },
      { id: 'ORD-8741', date: 'Apr 30, 2026', status: 'Delivered', items: 2, total: '$920.00', summary: 'Vossen HF-5 Wheels + 1 item' },
      { id: 'ORD-8703', date: 'Apr 12, 2026', status: 'Cancelled', items: 1, total: '$340.00', summary: 'Brembo GT Big Brake Kit' },
      { id: 'ORD-8682', date: 'Mar 27, 2026', status: 'Delivered', items: 4, total: '$2,100.00', summary: 'Full suspension overhaul bundle' },
    ],
  };
});
router.get('/v1/orders/:id', (req, res) => {
  const detail = createdOrders[req.params.id];
  res.headers = { 'Content-Type': 'application/json' };
  if (!detail) { res.status = 404; res.body = { code: 'NOT_FOUND', message: `No order ${req.params.id}` }; return; }
  res.status = 200; res.body = detail;
});

// ── Catch-all ────────────────────────────────────────────────────────────────
// Any endpoint the flows don't explicitly mock returns an empty-but-valid shape
// instead of a hung request, so an unmocked call surfaces as a benign empty
// state rather than a flaky timeout. Tighten to 404 if you want strict coverage.
router.all('*', (req, res) => {
  res.status = 200;
  res.headers = { 'Content-Type': 'application/json' };
  res.body = { items: [], total: 0, page: 1, pageSize: 50 };
});
