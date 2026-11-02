// Synthetic records only. Run through run.mjs seed; never source a backend .env.
const { PrismaClient } = require('@prisma/client');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const prisma = new PrismaClient();

function assertLocal() {
  const url = new URL(process.env.DATABASE_URL || '');
  if (url.hostname !== '127.0.0.1' || url.pathname !== '/mator_integration' ||
      url.username !== 'mator_local' || process.env.NODE_ENV !== 'development' ||
      process.env.AUTH_DEV_MODE !== 'true' || process.env.DIRECT_URL !== process.env.DATABASE_URL) {
    throw Error('Synthetic seed refuses any non-local integration database');
  }
}

async function main() {
  assertLocal();
  const user = await prisma.appUser.upsert({
    where: { phoneE164: '+998900000001' },
    update: { firstName: 'Local', lastName: 'Integration — локальная синтетическая проверка' },
    create: { phoneE164: '+998900000001', phoneVerified: true,
      firstName: 'Local', lastName: 'Integration — локальная синтетическая проверка' },
  });
  await prisma.catalogSeller.upsert({
    where: { id: 'seller_local_test' },
    update: { name: 'LOCAL TEST — синтетический продавец / sinov sotuvchisi' },
    create: { id: 'seller_local_test', name: 'LOCAL TEST — синтетический продавец / sinov sotuvchisi', city: 'Tashkent' },
  });
  const trim = await prisma.vehicleTrim.findUniqueOrThrow({ where: { id: 'cobalt-p1-elegant' } });
  const engine = await prisma.vehicleEngine.findFirstOrThrow({ orderBy: { sortOrder: 'asc' } });
  const category = await prisma.partCategory.findFirstOrThrow({ where: { level: 1 }, orderBy: { sortOrder: 'asc' } });
  const longModel = { makeId: 'chevrolet',
    name: 'LOCAL TEST — Длинная семейная модель автомобиля / Oilaviy safarlar uchun uzun nomli model', sortOrder: 999 };
  await prisma.vehicleModelRef.upsert({ where: { id: 'local-long-model' }, update: longModel,
    create: { id: 'local-long-model', ...longModel } });
  const longTrim = { modelId: 'local-long-model',
    name: 'LOCAL TEST — Расширенная комплектация для дальних поездок / Uzoq safar uchun kengaytirilgan toʻplam', sortOrder: 999 };
  await prisma.vehicleTrim.upsert({ where: { id: 'local-long-trim' }, update: longTrim,
    create: { id: 'local-long-trim', ...longTrim } });
  // Idempotence preserves a tester's selection and edited data on re-seed.
  for (const [id, year, nickname, primary, color] of [
    ['veh_local_seed', 2024, 'LOCAL TEST — основной Cobalt / asosiy avtomobil', true, '#F4F5F7'],
    ['veh_local_second', 2023, 'LOCAL TEST — автомобиль с длинным названием / uzoq nomli sinov avtomobili', false, '#121820'],
    ['veh_local_third', 2022, 'LOCAL TEST — семейный автомобиль для дальних поездок / oilaviy uzoq safarlar uchun', false, '#CC302A'],
  ]) {
    const reference = id === 'veh_local_second'
      ? { modelId: 'local-long-model', trimId: 'local-long-trim' }
      : { modelId: 'cobalt', trimId: trim.id };
    await prisma.vehicle.upsert({ where: { id }, update: id === 'veh_local_second' ? reference : {}, create: {
      id, userId: user.id, makeId: 'chevrolet', ...reference, year,
      engineId: engine.id, nickname, isPrimary: primary,
      colorHex: color, mileageKm: 125000, transmission: 'AUTOMATIC', fuelType: 'PETROL',
    } });
  }
  const products = [
    ['exact', 'LOCAL TEST Exact — Комплект передних тормозных колодок для автомобиля / Old tormoz kolodkalari toʻplami', 100000, 'FITS'],
    ['no', 'LOCAL TEST Incompatible — Несовместимая контрольная запчасть / Mos kelmaydigan nazorat ehtiyot qismi', 120000, 'DOES_NOT_FIT'],
    ['unknown', 'LOCAL TEST Unknown — Нет подтверждённых данных совместимости / Moslik haqida tasdiqlangan maʼlumot yoʻq', 130000, null],
    ['universal', 'LOCAL TEST Universal — Универсальные автомобильные принадлежности / Barcha avtomobillar uchun aksessuarlar', 50000, null],
  ];
  for (const [key, title, price, status] of products) {
    const id = `part_local_${key}`;
    const values = { title, priceUzs: price, stockQty: 100, inStock: true,
      isUniversal: key === 'universal', oemNumbers: [`LOCAL-${key}`] };
    await prisma.catalogPart.upsert({ where: { id }, update: values, create: {
      id, ...values, categoryId: category.id, sellerId: 'seller_local_test', gmNumbers: [], images: [],
    } });
    if (status) {
      const values = { partId: id, trimId: trim.id, engineId: engine.id, years: [2024], status, source: 'LOCAL_SYNTHETIC' };
      await prisma.partCompatibility.upsert({ where: { id: `compat_local_${key}` },
        update: values, create: { id: `compat_local_${key}`, ...values } });
    }
  }
  await prisma.address.upsert({ where: { id: 'addr_local_test' }, update: {}, create: {
    id: 'addr_local_test', userId: user.id, isDefault: true, regionCode: '01',
    label: 'LOCAL TEST — Дом / Uy — длинная подпись адреса',
    fullText: 'LOCAL SYNTHETIC — Ташкент, тестовая улица с длинным названием, дом 123, подъезд 4, квартира 56 / Toshkent, uzun nomli sinov koʻchasi, 123-uy, 56-xonadon',
  } });
  const cart = await prisma.cart.upsert({ where: { userId: user.id }, update: {},
    create: { id: 'cart_local_test', userId: user.id } });
  for (const [key, quantity] of [['exact', 2], ['universal', 1], ['unknown', 1]]) {
    const part = await prisma.catalogPart.findUniqueOrThrow({ where: { id: `part_local_${key}` } });
    const existing = await prisma.cartItem.findFirst({ where: { cartId: cart.id, partId: part.id } });
    if (existing) continue;
    // Don't reset quantities the tester changed; after checkout seed refills.
    await prisma.cartItem.upsert({ where: { id: `item_local_${key}` }, update: {}, create: {
      id: `item_local_${key}`, cartId: cart.id, partId: part.id, vehicleId: 'veh_local_seed',
      title: part.title, quantity, priceUzsSnapshot: part.priceUzs,
    } });
  }
  const counts = {
    vehicles: await prisma.vehicle.count({ where: { id: { in: ['veh_local_seed', 'veh_local_second', 'veh_local_third'] } } }),
    parts: await prisma.catalogPart.count({ where: { id: { startsWith: 'part_local_' } } }),
    compatibilityRows: await prisma.partCompatibility.count({ where: { id: { startsWith: 'compat_local_' } } }),
    addresses: await prisma.address.count({ where: { id: 'addr_local_test' } }),
    cartParts: new Set((await prisma.cartItem.findMany({ where: { cartId: cart.id }, select: { partId: true } })).map((item) => item.partId)).size,
  };
  assert.deepEqual(counts, { vehicles: 3, parts: 4, compatibilityRows: 2, addresses: 1, cartParts: 3 });
  fs.writeFileSync('local-seed-result.json', JSON.stringify(counts, null, 2), { mode: 0o600 });
  console.log('Synthetic seed ready: +998900000001; 3 vehicles, 4 compatibility cases, long RU/UZ labels, address and filled cart.');
  console.log('Verified managed fixture counts:', JSON.stringify(counts));
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; }).finally(() => prisma.$disconnect());
