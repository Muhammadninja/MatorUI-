#!/usr/bin/env node
// Read-only inspection. Never print literal credentials, account data or placeholders.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');

const markers = {
  orders: 'MockOrdersTransport', search: 'MockSearchTransport', auth: 'MockAuthTransport',
  catalog: 'MOCK_CATALOG_ITEMS', legal: 'Mock paragraph body used by offline builds',
  quickFilters: 'mock-quick-filters-v1', testIdentity: 'usr_test_001',
  cartSimulation: 'MockCartTransport: simulated failure',
  cart: 'MockCartTransport', notifications: 'MockNotificationsTransport',
  chat: 'MockChatTransport', orderFixture: 'ORD-8790', promoImage: 'picsum.photos',
};
const secretPatterns = {
  privateKey: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  awsAccessKey: /AKIA[0-9A-Z]{16}/,
  staticJwt: /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/,
};
const addressPlaceholder = JSON.parse(fs.readFileSync(path.join(__dirname, '../locales/en.json'), 'utf8'))
  .account.streetPlaceholder;
const report = { artifacts: [] };
if (process.argv.length < 3) throw new Error('Pass exported .hbc and/or release .apk paths.');
for (const filename of process.argv.slice(2)) {
  const bytes = fs.readFileSync(filename);
  const isApk = filename.endsWith('.apk');
  const readAsset = (name) => execFileSync('unzip', ['-p', filename, name], { maxBuffer: 64 * 1024 * 1024 });
  const bundle = isApk ? readAsset('assets/index.android.bundle') : bytes;
  const text = bundle.toString('latin1');
  const item = {
    file: path.basename(filename), sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
    fixtureMarkersPresent: Object.fromEntries(Object.entries(markers).map(([key, value]) => [key, text.includes(value)])),
    credentialPatternsFound: Object.fromEntries(Object.entries(secretPatterns).map(([key, regex]) => [key, regex.test(text)])),
    englishAddressPlaceholderPresent: text.includes(addressPlaceholder),
  };
  if (isApk) {
    const config = JSON.parse(readAsset('assets/app.config').toString('utf8'));
    const environment = config.extra?.appEnvironment;
    item.environment = environment && {
      name: environment.name, apiBaseUrl: environment.apiBaseUrl,
      httpDomains: environment.httpDomains, allowDevOtp: environment.allowDevOtp,
    };
    item.productionApiVerified = environment?.name === 'production' &&
      environment.apiBaseUrl === 'https://api.mator.uz' &&
      environment.httpDomains === '' && environment.allowDevOtp === false;
    if (!item.productionApiVerified) process.exitCode = 1;
  }
  if (Object.values(item.fixtureMarkersPresent).some(Boolean) ||
      Object.values(item.credentialPatternsFound).some(Boolean)) process.exitCode = 1;
  report.artifacts.push(item);
}
console.log(JSON.stringify(report, null, 2));
