/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Standalone offline mock server — zero dependencies, plain Node http.
 *
 * Why this exists alongside rules.js:
 *   Expo INLINES `EXPO_PUBLIC_*` at bundle time, so on a real device/build the
 *   app's traffic goes to whatever host you compiled in — it does NOT route
 *   through Maestro's proxy automatically. The most reliable offline setup is
 *   therefore: run this tiny server, and build/start the app with
 *   EXPO_PUBLIC_API_BASE_URL pointing straight at it. Same contract as
 *   rules.js, but self-hosted and CI-friendly (no Maestro Cloud needed).
 *
 * Run:   node .maestro/mock-server/standalone-server.mjs           # :8080
 *        PORT=9090 node .maestro/mock-server/standalone-server.mjs
 *
 * Start it BEFORE `maestro test .maestro/`. It logs every request so you can
 * confirm the app is actually hitting the mock (and see which VIN/system it
 * asked for) while debugging a flaky flow.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import http from 'node:http';

const PORT = Number(process.env.PORT || 8080);
const SEEDED_CAR = { make: 'CHEVROLET', model: 'Cobalt', year: 2022 };

// Backend `ApiCatalogPart` shape (nested brand/category, snake_case fields) so
// HttpCatalogTransport maps it correctly — `brand.name` drives the filter chip.
// `units_sold` powers the vehicle-bestsellers ranking (see the parts handler).
// Every seeded part fits the demo Chevrolet Cobalt (UZ market), so the garage
// "Shop parts that fit" screen renders a populated bestsellers list.
const BRAKE_PARTS = [
  { id: 'brembo-fp', title: 'Brembo Front Brake Pads',
    brand: { id: 'brembo', name: 'Brembo' }, category: { id: 'brakes', name: 'Brake System' },
    oem_numbers: ['BREMBO P59049'], price_label: '$89.00', in_stock: true, region: 'europe', units_sold: 1240,
    images: ['https://cdn.mator.local/parts/brembo-fp.png'],
    specs: [{ label: 'Position', value: 'Front axle' }], features: ['Low-dust compound', 'OE-spec fitment'] },
  { id: 'bosch-rotor', title: 'Bosch Brake Rotor',
    brand: { id: 'bosch', name: 'Bosch' }, category: { id: 'brakes', name: 'Brake System' },
    oem_numbers: ['BOSCH 0986479R89'], price_label: '$54.50', in_stock: true, region: 'europe', units_sold: 870,
    images: ['https://cdn.mator.local/parts/bosch-rotor.png'],
    specs: [{ label: 'Diameter', value: '256 mm' }], features: ['Vented', 'Anti-corrosion coating'] },
];

const FILTER_PARTS = [
  { id: 'mann-oil-filter', title: 'MANN Oil Filter W 71/2',
    brand: { id: 'mann', name: 'MANN-FILTER' }, category: { id: 'filters', name: 'Filters' },
    oem_numbers: ['MANN W712'], price_label: '$8.90', in_stock: true, region: 'europe', units_sold: 2100,
    images: ['https://cdn.mator.local/parts/mann-oil-filter.png'],
    specs: [{ label: 'Type', value: 'Spin-on' }], features: ['OE-spec media', 'Anti-drain valve'] },
  { id: 'mann-air-filter', title: 'MANN Air Filter C 26 168',
    brand: { id: 'mann', name: 'MANN-FILTER' }, category: { id: 'filters', name: 'Filters' },
    oem_numbers: ['MANN C26168'], price_label: '$12.40', in_stock: true, region: 'europe', units_sold: 1580,
    images: ['https://cdn.mator.local/parts/mann-air-filter.png'],
    specs: [{ label: 'Shape', value: 'Panel' }], features: ['High dust capacity'] },
];

const IGNITION_PARTS = [
  { id: 'ngk-spark-plugs', title: 'NGK Spark Plugs (set of 4)',
    brand: { id: 'ngk', name: 'NGK' }, category: { id: 'ignition', name: 'Ignition' },
    oem_numbers: ['NGK BKR6E'], price_label: '$18.00', in_stock: true, region: 'korea', units_sold: 1960,
    images: ['https://cdn.mator.local/parts/ngk-spark-plugs.png'],
    specs: [{ label: 'Gap', value: '1.0 mm' }], features: ['Nickel electrode', 'Set of 4'] },
];

const SERVICE_PARTS = [
  { id: 'varta-battery', title: 'Varta Blue Dynamic 60Ah Battery',
    brand: { id: 'varta', name: 'Varta' }, category: { id: 'batteries', name: 'Batteries' },
    oem_numbers: ['VARTA D59'], price_label: '$96.00', in_stock: true, region: 'europe', units_sold: 640,
    images: ['https://cdn.mator.local/parts/varta-battery.png'],
    specs: [{ label: 'Capacity', value: '60 Ah' }], features: ['540A cold-crank'] },
  { id: 'bosch-wiper', title: 'Bosch Aerotwin Wiper Blades',
    brand: { id: 'bosch', name: 'Bosch' }, category: { id: 'wipers', name: 'Wipers' },
    oem_numbers: ['BOSCH A designation'], price_label: '$22.50', in_stock: true, region: 'europe', units_sold: 1120,
    images: ['https://cdn.mator.local/parts/bosch-wiper.png'],
    specs: [{ label: 'Length', value: '600/400 mm' }], features: ['Beam design', 'All-season rubber'] },
];

const CATALOG = {
  brakes: BRAKE_PARTS,
  filters: FILTER_PARTS,
  ignition: IGNITION_PARTS,
  batteries: [SERVICE_PARTS[0]],
  wipers: [SERVICE_PARTS[1]],
};

// Flat list / id lookup. `ALL_PARTS` is every seeded part (used for search and
// the vehicle-fit / bestsellers list); `PARTS_BY_ID` backs the detail endpoint.
const ALL_PARTS = Object.values(CATALOG).flat();
const PARTS_BY_ID = Object.fromEntries(ALL_PARTS.map((p) => [p.id, p]));

// ── BUY PATH: checkout + orders ──────────────────────────────────────────────
// Ported verbatim from services/orders-api.ts' seed data so the response shapes
// match what the orders hooks (useAddresses / usePaymentMethods /
// useShippingQuote / useCreateOrder / useOrder) read. These endpoints make the
// suite work even when the app build routes the `orders` domain over HTTP
// (EXPO_PUBLIC_HTTP_DOMAINS includes it) rather than the in-memory mock — the
// generic catch-all returns an object, but these hooks need real arrays.
const ADDRESSES = [
  { id: 'addr_home', label: 'Home', name: 'Alex Marino', line1: '128 Marrakesh Rd, Suite 4', city: 'Brooklyn, NY 11211', isDefault: true },
  { id: 'addr_shop', label: 'Shop', name: 'Alex Marino', line1: '2210 W Industrial Blvd', city: 'Long Island City, NY 11101', isDefault: false },
];
const PAYMENT_METHODS = [
  { id: 'pm_mc_4242', brand: 'Mastercard', last4: '4242', exp: '09/27', isDefault: true },
  { id: 'pm_visa_1881', brand: 'Visa', last4: '1881', exp: '03/26', isDefault: false },
];
const SHIPPING_OPTIONS = [
  { key: 'standard', label: 'Standard', eta: '3-5 business days', price: 0 },
  { key: 'express', label: 'Express', eta: '1-2 business days', price: 9.99 },
  { key: 'same_day', label: 'Same day', eta: 'By 9 PM today', price: 19.99 },
];

// Order-history list (GET /v1/orders) — ported from services/orders-api.ts
// SEED_ORDERS so the history screen renders a populated list.
const ORDER_HISTORY = {
  page: 1,
  pageSize: 20,
  total: 5,
  items: [
    { id: 'ORD-8821', date: 'May 28, 2026', status: 'Delivered', items: 3, total: '$486.00', summary: 'Garrett GTX3582R + 2 items' },
    { id: 'ORD-8790', date: 'May 14, 2026', status: 'In Transit', items: 1, total: '$1,249.00', summary: 'KW Coilovers V3 Suspension Kit' },
    { id: 'ORD-8741', date: 'Apr 30, 2026', status: 'Delivered', items: 2, total: '$920.00', summary: 'Vossen HF-5 Wheels + 1 item' },
    { id: 'ORD-8703', date: 'Apr 12, 2026', status: 'Cancelled', items: 1, total: '$340.00', summary: 'Brembo GT Big Brake Kit' },
    { id: 'ORD-8682', date: 'Mar 27, 2026', status: 'Delivered', items: 4, total: '$2,100.00', summary: 'Full suspension overhaul bundle' },
  ],
};

// Orders created via POST /v1/orders, keyed by id so the confirmation screen's
// GET /v1/orders/:id resolves the just-placed order (stateful within a run).
const createdOrders = new Map();

function orderDetail(id, totalLabel) {
  return {
    id,
    status: 'placed',
    statusLabel: 'Processing',
    etaWindow: '3-5 business days',
    placedAt: 'Jul 13, 2026',
    currentStepIndex: 0,
    steps: [
      { key: 'placed', label: 'Order placed', caption: 'Just now' },
      { key: 'packed', label: 'Packed', caption: '—' },
      { key: 'shipped', label: 'Shipped', caption: '—' },
      { key: 'out_for_delivery', label: 'Out for delivery', caption: '—' },
      { key: 'delivered', label: 'Delivered', caption: '—' },
    ],
    destination: ADDRESSES[0],
    courier: null,
    items: [{ id: 'brembo-fp', title: 'Brembo Front Brake Pads', quantity: 1, price: '$89.00' }],
    totalLabel: totalLabel || '$—.—',
  };
}

// ── AUTH: passwordless phone OTP (backend.json wire shape) ───────────────────
// request-otp stores the pending request by request_id; verify-otp accepts any
// 6-digit code and returns { user, tokens }. `dev_otp_code` lets demo/E2E builds
// auto-fill the code so the suite stays buttons-only.
const pendingOtps = new Map();
const OTP_DEV_CODE = '123456';

function authTokens(id) {
  return {
    access_token: `srv_access_${id}`,
    access_token_expires_at: new Date(Date.now() + 3600000).toISOString(),
    refresh_token: `srv_refresh_${id}`,
    refresh_token_expires_at: new Date(Date.now() + 7776000000).toISOString(),
    token_type: 'Bearer',
  };
}

function authUser(pending) {
  const id = `usr_${Math.random().toString(36).slice(2, 10)}`;
  const p = pending || {};
  return {
    id,
    phone_e164: p.phone_e164 || '+998901234567',
    display_name: null,
    avatar_url: null,
    myid_status: 'not_verified',
    transaction_limit_uzs: 0,
    created_at: '2026-01-01T00:00:00.000Z',
  };
}

// ── GARAGE: stateful vehicles CRUD ───────────────────────────────────────────
// Backend `ServerVehicle` DTO shape (snake_case, nested make/model/trim/engine,
// color_hex, mileage_km) so the client's HttpGarageTransport.toClientVehicle maps
// it correctly. Stateful within a run so add/edit/delete/set-primary all work.
let garageSeq = 3;
const MAKE_NAMES = {
  make_chevrolet: 'Chevrolet', make_toyota: 'Toyota', make_kia: 'Kia',
  make_hyundai: 'Hyundai', make_subaru: 'Subaru', make_byd: 'BYD',
};
function titleize(id) {
  return String(id || '').replace(/^[a-z]+_/, '').replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase()) || 'Unknown';
}
function garageVehicle(v) {
  return {
    id: v.id,
    user_id: 'usr_test_001',
    is_primary: !!v.is_primary,
    nickname: v.nickname ?? null,
    make: { id: v.make_id, name: MAKE_NAMES[v.make_id] || titleize(v.make_id), logo_url: null },
    model: { id: v.model_id, name: titleize(v.model_id).replace(/^\w+\s/, '') || titleize(v.model_id) },
    year: v.year,
    trim: v.trim_id ? { id: v.trim_id, name: titleize(v.trim_id) } : null,
    engine: v.engine_id
      ? { id: v.engine_id, name: titleize(v.engine_id), displacement_cc: v.displacement_cc, fuel_type: v.fuel_type }
      : null,
    transmission: v.transmission,
    drivetrain: v.drivetrain,
    color_hex: v.color_hex || '#1F2A37',
    vin: v.vin ?? null,
    license_plate: v.license_plate ?? null,
    registration_region_code: v.registration_region_code ?? null,
    mileage_km: v.mileage_km ?? null,
    fuel_type: v.fuel_type,
    model_3d: null,
    created_at: v.created_at || '2026-01-01T00:00:00.000Z',
    updated_at: '2026-07-15T00:00:00.000Z',
  };
}
let GARAGE = [
  garageVehicle({
    id: 'veh_seed_cobalt', make_id: 'make_chevrolet', model_id: 'model_cobalt', year: 2019,
    trim_id: 'trim_ls_at', engine_id: 'engine_b15d2_1_5l', displacement_cc: 1485,
    transmission: 'automatic', drivetrain: 'fwd', color_hex: '#1F2A37', fuel_type: 'petrol',
    vin: 'KL1MJ6CA8KB123456', license_plate: '01A123BC', registration_region_code: '01',
    mileage_km: 67420, nickname: 'Mening Cobaltim', is_primary: true, created_at: '2025-01-10T00:00:00.000Z',
  }),
  garageVehicle({
    id: 'veh_seed_gentra', make_id: 'make_chevrolet', model_id: 'model_gentra', year: 2021,
    trim_id: 'trim_ltz', engine_id: 'engine_1_5l', displacement_cc: 1485,
    transmission: 'automatic', drivetrain: 'fwd', color_hex: '#E8EAED', fuel_type: 'petrol',
    license_plate: '30B456CD', registration_region_code: '30', mileage_km: 32110,
    nickname: 'Oilaviy', is_primary: false, created_at: '2025-06-01T00:00:00.000Z',
  }),
];
function garageSorted() {
  return [...GARAGE].sort((a, b) =>
    a.is_primary === b.is_primary
      ? Date.parse(b.created_at) - Date.parse(a.created_at)
      : a.is_primary ? -1 : 1);
}

function send(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) });
  res.end(payload);
}

function readBody(req) {
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
      try { resolve(raw ? JSON.parse(raw) : {}); } catch { resolve({}); }
    });
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const { pathname } = url;
  console.log(`[mock] ${req.method} ${req.url}`);

  // FLOW 1 — POST /v1/auth/decode-vin
  if (req.method === 'POST' && pathname === '/v1/auth/decode-vin') {
    const body = await readBody(req);
    const vin = typeof body.vin === 'string' ? body.vin.replace(/\s/g, '') : '';
    if (vin.length !== 17) {
      return send(res, 422, { success: false, error: { code: 'INVALID_LENGTH', message: 'VIN must be 17 characters.' } });
    }
    return send(res, 200, { success: true, car: { ...SEEDED_CAR } });
  }

  // AUTH — POST /v1/auth/phone/request-otp → { request_id, ..., dev_otp_code }
  if (req.method === 'POST' && pathname === '/v1/auth/phone/request-otp') {
    const body = await readBody(req);
    const requestId = `otp_${Math.random().toString(36).slice(2, 12)}`;
    pendingOtps.set(requestId, { phone_e164: body.phone_e164 });
    return send(res, 200, {
      request_id: requestId,
      phone_e164: body.phone_e164 || '+998901234567',
      expires_at: new Date(Date.now() + 300000).toISOString(),
      resend_after_seconds: 60,
      otp_length: 6,
      delivery_channel: 'sms',
      is_existing_user: true,
      next_screen: 'AuthOtpVerifyScreen',
      dev_otp_code: OTP_DEV_CODE, // MOCK ONLY — the real backend omits this.
    });
  }

  // AUTH — POST /v1/auth/phone/verify-otp → { user, tokens } (any 6-digit code).
  if (req.method === 'POST' && pathname === '/v1/auth/phone/verify-otp') {
    const body = await readBody(req);
    const code = typeof body.otp_code === 'string' ? body.otp_code.trim() : '';
    if (!/^\d{6}$/.test(code)) {
      return send(res, 422, { error: { code: 'INVALID_CODE', message: 'Enter the 6-digit code.' } });
    }
    const pending = pendingOtps.get(body.request_id);
    pendingOtps.delete(body.request_id);
    const user = authUser(pending);
    return send(res, 200, {
      user,
      tokens: authTokens(user.id),
      requires_myid_verification: false,
      next_screen: 'Tabs',
    });
  }

  // AUTH — POST /v1/auth/token/refresh → { tokens }
  if (req.method === 'POST' && pathname === '/v1/auth/token/refresh') {
    const id = `usr_${Math.random().toString(36).slice(2, 10)}`;
    return send(res, 200, { tokens: authTokens(id) });
  }

  // FLOW 9 — POST /v1/search  → SearchResponse (the REAL search backend the
  // Search screen now calls via useSearch/HttpSearchTransport). Title/brand
  // substring match over the same parts, mapped to the SearchResult shape.
  if (req.method === 'POST' && pathname === '/v1/search') {
    const body = await readBody(req);
    const q = String(body.query || '').trim().toLowerCase();
    const matched = q
      ? Object.values(PARTS_BY_ID).filter(
          (p) =>
            p.title.toLowerCase().includes(q) ||
            (p.brand && p.brand.name.toLowerCase().includes(q)),
        )
      : [];
    const results = matched.map((p) => ({
      id: p.id,
      title: p.title,
      description: (p.features || []).join(' · '),
      price: p.price_label || '',
      priceLabel: p.price_label || '',
      category: p.category ? p.category.name : '',
      status: p.in_stock ? 'In stock' : 'Out of stock',
    }));
    return send(res, 200, {
      query: q,
      requestId: body.requestId ?? null,
      results,
      total: results.length,
      nextPageToken: null,
      durationMs: 12,
      facetCounts: { categories: {}, price: {}, minRating: {} },
      appliedFilters: body.filters ?? {},
      didYouMean: null,
      suggestedCategories: [],
    });
  }

  // GET /v1/typeahead?q=<prefix>&limit=  → { suggestions:[{ text, type }] }
  // The app's HttpSearchTransport.typeahead maps `type` → `kind`.
  if (req.method === 'GET' && pathname === '/v1/typeahead') {
    const prefix = (url.searchParams.get('q') || '').trim().toLowerCase();
    const limit = Number(url.searchParams.get('limit')) || 6;
    const suggestions = prefix
      ? Object.values(PARTS_BY_ID)
          .filter((p) => p.title.toLowerCase().includes(prefix))
          .slice(0, limit)
          .map((p) => ({ text: p.title, type: 'product', productId: p.id }))
      : [];
    return send(res, 200, { prefix, suggestions });
  }

  // FLOW 3 / 9 — GET /v1/catalog/parts
  //   ?systemId=|?category=<sys>  → parts in that system (browse)
  //   ?q=<term>                   → title/brand substring search (browse/category)
  //   ?make=&model=[&sort=bestseller] → vehicle-fit list, sales-ranked
  //     (the garage "Shop parts that fit" bestsellers screen). Mirrors the real
  //     backend's existing `sort=bestseller`. Every seeded part fits the demo
  //     Cobalt, so make/model returns the full list ranked by units_sold.
  //   &brand=<id>[,<id>…]         → only those part brands. As on the real
  //     backend, `facets.brands` (the parts screen's brand chips) is counted
  //     before the brand filter, so a picked brand keeps the others on offer.
  if (req.method === 'GET' && pathname === '/v1/catalog/parts') {
    const q = (url.searchParams.get('q') || '').trim().toLowerCase();
    const make = (url.searchParams.get('make') || '').trim();
    const model = (url.searchParams.get('model') || '').trim();
    const sort = (url.searchParams.get('sort') || '').trim().toLowerCase();
    const system = (url.searchParams.get('systemId') || url.searchParams.get('category') || '').toLowerCase();

    let items;
    if (q) {
      items = ALL_PARTS.filter(
        (p) => p.title.toLowerCase().includes(q) || (p.brand && p.brand.name.toLowerCase().includes(q)),
      );
    } else if (make || model) {
      // Vehicle fitment — the demo catalog fits the seeded Chevrolet Cobalt.
      items = [...ALL_PARTS];
    } else if (system) {
      items = CATALOG[system] || [];
    } else {
      items = [...ALL_PARTS];
    }

    // Bestseller ranking — matches the real backend's `sort=bestseller` (singular).
    // Also the default order for a vehicle-fit request. Highest units_sold first.
    if (sort === 'bestseller' || make || model) {
      items = [...items].sort((a, b) => (b.units_sold || 0) - (a.units_sold || 0));
    }

    const brandCounts = new Map();
    for (const p of items) {
      if (!p.brand) continue;
      const seen = brandCounts.get(p.brand.id);
      brandCounts.set(p.brand.id, { id: p.brand.id, name: p.brand.name, count: (seen?.count || 0) + 1 });
    }
    const brands = (url.searchParams.get('brand') || '').split(',').filter(Boolean);
    if (brands.length) items = items.filter((p) => p.brand && brands.includes(p.brand.id));
    return send(res, 200, {
      items,
      total: items.length,
      page: 1,
      page_size: 50,
      next_page: null,
      facets: { brands: [...brandCounts.values()] },
    });
  }

  // BUY PATH — GET /v1/catalog/parts/:id  → a single ApiCatalogPart (Item Detail).
  // HttpCatalogTransport.detail() reads the object directly; a 404 becomes the
  // screen's "Product not found" state, so unknown ids return 404 (not a 200
  // empty shape) to exercise the real not-found branch.
  if (req.method === 'GET' && pathname.startsWith('/v1/catalog/parts/')) {
    const id = decodeURIComponent(pathname.slice('/v1/catalog/parts/'.length));
    const part = PARTS_BY_ID[id];
    if (!part) return send(res, 404, { error: { code: 'NOT_FOUND', message: `No part ${id}` } });
    return send(res, 200, part);
  }

  // BUY PATH — checkout reads: addresses + payment methods (must be ARRAYS, not
  // the catch-all object, or the orders hooks crash on .findIndex).
  if (req.method === 'GET' && pathname === '/v1/account/addresses') {
    return send(res, 200, ADDRESSES);
  }
  if (req.method === 'GET' && pathname === '/v1/account/payment-methods') {
    return send(res, 200, PAYMENT_METHODS);
  }

  // BUY PATH — POST /v1/shipping/quote → ShippingOption[] (standard is free ≥ $500,
  // mirroring the mock transport's rule). Without this the quote is empty and
  // "Place order" no-ops (checkout guards on a selected shipping option).
  if (req.method === 'POST' && pathname === '/v1/shipping/quote') {
    const body = await readBody(req);
    const subtotal = Number(body.subtotal) || 0;
    const opts = SHIPPING_OPTIONS.map((o) =>
      o.key === 'standard' && subtotal >= 500 ? { ...o, price: 0 } : o,
    );
    return send(res, 200, opts);
  }

  // BUY PATH — POST /v1/orders → CreateOrderResult; seeds a detail row so the
  // confirmation's GET /v1/orders/:id resolves the new order.
  if (req.method === 'POST' && pathname === '/v1/orders') {
    const body = await readBody(req);
    const orderId = `M-${40000 + Math.floor(Math.random() * 60000)}`;
    const shipping = SHIPPING_OPTIONS.find((o) => o.key === body.shippingOptionKey);
    const eta = shipping ? shipping.eta : '3-5 business days';
    const totalLabel = body.totalLabel || '$—.—';
    createdOrders.set(orderId, orderDetail(orderId, totalLabel));
    return send(res, 200, { orderId, eta, totalLabel });
  }

  // ORDERS — GET /v1/orders → order-history list (Flow 10).
  if (req.method === 'GET' && pathname === '/v1/orders') {
    return send(res, 200, ORDER_HISTORY);
  }

  // BUY PATH — GET /v1/orders/:id → the just-placed OrderDetail (confirmation).
  if (req.method === 'GET' && pathname.startsWith('/v1/orders/')) {
    const id = decodeURIComponent(pathname.slice('/v1/orders/'.length));
    const detail = createdOrders.get(id);
    if (!detail) return send(res, 404, { error: { code: 'NOT_FOUND', message: `No order ${id}` } });
    return send(res, 200, detail);
  }

  // GARAGE — GET /v1/garage/vehicles → { vehicles } (primary first, then newest).
  if (req.method === 'GET' && pathname === '/v1/garage/vehicles') {
    return send(res, 200, { vehicles: garageSorted() });
  }

  // GARAGE — POST /v1/garage/vehicles → { vehicle } (create; honors is_primary).
  if (req.method === 'POST' && pathname === '/v1/garage/vehicles') {
    const body = await readBody(req);
    garageSeq += 1;
    const makePrimary = body.is_primary === true || GARAGE.length === 0;
    if (makePrimary) GARAGE = GARAGE.map((v) => ({ ...v, is_primary: false }));
    const created = garageVehicle({
      ...body,
      id: `veh_${garageSeq}_${Math.random().toString(36).slice(2, 8)}`,
      is_primary: makePrimary,
      created_at: new Date().toISOString(),
    });
    GARAGE.push(created);
    return send(res, 201, { vehicle: created });
  }

  // GARAGE — /v1/garage/vehicles/:id  (GET · PATCH · DELETE) + /set-primary.
  if (pathname.startsWith('/v1/garage/vehicles/')) {
    const rest = pathname.slice('/v1/garage/vehicles/'.length);
    const setPrimary = rest.endsWith('/set-primary');
    const id = decodeURIComponent(setPrimary ? rest.slice(0, -'/set-primary'.length) : rest);
    const idx = GARAGE.findIndex((v) => v.id === id);

    if (req.method === 'POST' && setPrimary) {
      if (idx === -1) return send(res, 404, { error: 'Vehicle not found' });
      GARAGE = GARAGE.map((v) => ({ ...v, is_primary: v.id === id }));
      return send(res, 200, { vehicles: garageSorted() });
    }
    if (req.method === 'GET') {
      if (idx === -1) return send(res, 404, { error: 'Vehicle not found' });
      return send(res, 200, { vehicle: GARAGE[idx] });
    }
    if (req.method === 'PATCH') {
      if (idx === -1) return send(res, 404, { error: 'Vehicle not found' });
      const body = await readBody(req);
      if (body.is_primary === true) GARAGE = GARAGE.map((v) => ({ ...v, is_primary: v.id === id }));
      // Re-derive from merged raw so nested make/model/etc. rebuild cleanly.
      const merged = garageVehicle({
        id, make_id: body.make_id ?? GARAGE[idx].make.id, model_id: body.model_id ?? GARAGE[idx].model.id,
        year: body.year ?? GARAGE[idx].year, trim_id: body.trim_id ?? GARAGE[idx].trim?.id,
        engine_id: body.engine_id ?? GARAGE[idx].engine?.id, displacement_cc: GARAGE[idx].engine?.displacement_cc,
        transmission: body.transmission ?? GARAGE[idx].transmission, drivetrain: body.drivetrain ?? GARAGE[idx].drivetrain,
        color_hex: body.color_hex ?? GARAGE[idx].color_hex, fuel_type: body.fuel_type ?? GARAGE[idx].fuel_type,
        vin: body.vin ?? GARAGE[idx].vin, license_plate: body.license_plate ?? GARAGE[idx].license_plate,
        registration_region_code: GARAGE[idx].registration_region_code,
        mileage_km: body.mileage_km ?? GARAGE[idx].mileage_km, nickname: body.nickname ?? GARAGE[idx].nickname,
        is_primary: GARAGE.find((v) => v.id === id).is_primary, created_at: GARAGE[idx].created_at,
      });
      GARAGE = GARAGE.map((v) => (v.id === id ? merged : v));
      return send(res, 200, { vehicle: merged });
    }
    if (req.method === 'DELETE') {
      if (idx === -1) return send(res, 404, { error: 'Vehicle not found' });
      const wasPrimary = GARAGE[idx].is_primary;
      GARAGE = GARAGE.filter((v) => v.id !== id);
      if (wasPrimary && GARAGE.length > 0) {
        const oldest = garageSorted().slice().reverse()[0];
        GARAGE = GARAGE.map((v) => ({ ...v, is_primary: v.id === oldest.id }));
      }
      res.writeHead(204); res.end(); return;
    }
  }

  // Catch-all: valid empty shape so unmocked calls don't hang the suite.
  return send(res, 200, { items: [], total: 0, page: 1, pageSize: 50 });
});

server.listen(PORT, () => {
  console.log(`Mator mock server → http://localhost:${PORT}`);
  console.log('  POST /v1/auth/decode-vin');
  console.log('  GET  /v1/catalog/parts?systemId=brakes | ?q=<term>  (browse | search)');
  console.log('  GET  /v1/catalog/parts/:id           (item detail)');
  console.log('  GET  /v1/account/addresses|payment-methods  (checkout)');
  console.log('  POST /v1/shipping/quote  ·  POST /v1/orders');
  console.log('  GET  /v1/orders  (history)  ·  GET /v1/orders/:id  (track)');
  console.log('Point EXPO_PUBLIC_API_BASE_URL at this host, then run: maestro test .maestro/');
});
