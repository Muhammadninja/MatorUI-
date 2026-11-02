const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const preload = path.join(__dirname, 'no-external.cjs');

test('isolated backend rejects external HTTP, HTTPS, fetch and sockets before I/O', () => {
  const result = spawnSync(process.execPath, ['--require', preload, '-e', `
    const assert = require('node:assert/strict');
    for (const action of [
      () => require('node:http').get('http://example.com'),
      () => require('node:https').request('https://example.com'),
      () => fetch('https://example.com'),
      () => require('node:net').connect(443, 'example.com'),
      () => new (require('node:net').Socket)().connect({host:'example.com',port:443}),
      () => require('node:tls').connect({port:443,host:'example.com'}),
    ]) assert.throws(action, { code: 'LOCAL_EXTERNAL_NETWORK_DISABLED' });
  `], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
});

test('settings reject production and mismatched local database targets', () => {
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', `
    import assert from 'node:assert/strict';
    import { assertLocalEnvironment, databaseUrl, ports } from './scripts/local-integration/settings.mjs';
    const valid={DATABASE_URL:databaseUrl,DIRECT_URL:databaseUrl,NODE_ENV:'development',AUTH_DEV_MODE:'true',REDIS_HOST:'127.0.0.1',REDIS_PORT:String(ports.redis)};
    assert.doesNotThrow(()=>assertLocalEnvironment(valid));
    for(const change of [{NODE_ENV:'production'},{DATABASE_URL:'postgresql://prod@api.mator.uz/live'},{AUTH_DEV_MODE:'false'},{REDIS_HOST:'remote.example'}])
      assert.throws(()=>assertLocalEnvironment({...valid,...change}));
  `], { cwd: path.resolve(__dirname, '../..'), encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
});
