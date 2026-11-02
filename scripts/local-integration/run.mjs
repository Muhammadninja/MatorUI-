#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { prepare } from './prepare.mjs';
import {
  state, backend, ports, database, databaseUser, cleanEnv, assertLocalEnvironment,
} from './settings.mjs';

const scripts = path.dirname(fileURLToPath(import.meta.url));
const command = process.argv[2];
const pgData = path.join(state, 'postgres');
const redisPid = path.join(state, 'redis.pid');
const apiTitle = `mator-local-${createHash('sha256').update(state).digest('hex').slice(0, 16)}`;

function run(bin, args, env = cleanEnv, cwd = state, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { cwd, env, stdio: 'inherit', ...options });
    child.once('error', reject);
    child.once('exit', (code) => code === 0 ? resolve() : reject(Error(`${bin} exited ${code}`)));
  });
}
async function exists(file) {
  try { await fs.access(file); return true; } catch { return false; }
}
function capture(bin, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { cwd: state, env: cleanEnv, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    child.stdout.on('data', (chunk) => { output += chunk; });
    child.once('error', reject);
    child.once('exit', (code) => code === 0 ? resolve(output.trim()) : reject(Object.assign(Error(`${bin} identity check failed`), { exitCode: code })));
  });
}
async function assertPostgres() {
  const lines = (await fs.readFile(path.join(pgData, 'postmaster.pid'), 'utf8')).split('\n');
  if (path.resolve(lines[1]) !== pgData || lines[3] !== String(ports.postgres)) {
    throw Error('PostgreSQL cluster/port identity mismatch; refusing any connection');
  }
  const args = await capture('ps', ['-p', lines[0], '-o', 'command=']);
  if (!args.includes(pgData)) throw Error('PostgreSQL process does not belong to this runtime');
}
async function assertRedis() {
  const pid = (await fs.readFile(redisPid, 'utf8')).trim();
  const info = await capture('redis-cli', ['-h', '127.0.0.1', '-p', String(ports.redis), 'INFO', 'server']);
  const directory = await capture('redis-cli', ['-h', '127.0.0.1', '-p', String(ports.redis), '--raw', 'CONFIG', 'GET', 'dir']);
  if (!info.split(/\r?\n/).includes(`process_id:${pid}`) ||
      await fs.realpath(directory.split('\n')[1]) !== await fs.realpath(state)) {
    throw Error('Redis process/directory identity mismatch; refusing to use it');
  }
}
async function busy(port) {
  return new Promise((resolve) => {
    const socket = net.connect(port, '127.0.0.1');
    socket.once('connect', () => { socket.destroy(); resolve(true); });
    socket.once('error', () => resolve(false));
  });
}
async function marker() {
  if (!await exists(path.join(state, '.mator-local-integration'))) {
    throw Error('No integration runtime marker. Run setup first.');
  }
}
async function env() {
  await marker();
  const value = JSON.parse(await fs.readFile(path.join(state, 'environment.json'), 'utf8'));
  assertLocalEnvironment(value);
  return value;
}
async function startServices() {
  await marker();
  if (!await exists(path.join(pgData, 'PG_VERSION'))) {
    if (await busy(ports.postgres)) throw Error('PostgreSQL port occupied; choose MATOR_POSTGRES_PORT');
    await run('initdb', ['-D', pgData, '-A', 'trust', '-U', databaseUser, '--no-locale', '-E', 'UTF8']);
  }
  if (!await busy(ports.postgres)) {
    await run('pg_ctl', ['-D', pgData, '-l', path.join(state, 'postgres.log'), '-o',
      `-p ${ports.postgres} -h 127.0.0.1 -k ${state}`, 'start']);
  } else {
    // Refuse a port owned by any other cluster. Never connect and guess.
    await run('pg_ctl', ['-D', pgData, 'status']);
  }
  await assertPostgres();
  if (!await busy(ports.redis)) {
    await run('redis-server', ['--bind', '127.0.0.1', '--port', String(ports.redis),
      '--dir', state, '--dbfilename', 'integration.rdb', '--daemonize', 'yes',
      '--pidfile', redisPid, '--logfile', path.join(state, 'redis.log')]);
  } else {
    if (!await exists(redisPid)) throw Error('Redis port occupied by another instance; choose MATOR_REDIS_PORT');
  }
  for (let attempt = 0; attempt < 50 && !await exists(redisPid); attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  await assertRedis();
  // Cluster is dedicated and marked. CREATE DATABASE has no external target.
  const check = spawn('psql', ['-h', '127.0.0.1', '-p', String(ports.postgres), '-U', databaseUser,
    '-d', 'postgres', '-tAc', `SELECT 1 FROM pg_database WHERE datname='${database}'`],
  { cwd: state, env: cleanEnv, stdio: ['ignore', 'pipe', 'inherit'] });
  let result = '';
  check.stdout.on('data', (chunk) => { result += chunk; });
  await new Promise((resolve, reject) => {
    check.once('error', reject);
    check.once('exit', (code) => code === 0 ? resolve() : reject(Error('Database existence check failed')));
  });
  if (result.trim() !== '1') {
    await run('createdb', ['-h', '127.0.0.1', '-p', String(ports.postgres), '-U', databaseUser, database]);
  }
}
async function seed() {
  const localEnv = await env();
  await assertPostgres();
  await run(process.execPath, [path.join(backend, 'node_modules/ts-node/dist/bin.js'),
    '--compiler-options', '{"module":"commonjs"}', 'src/prisma/seed.ts'], localEnv, backend);
  // Resolve dependencies from the copied backend, never from frontend mocks.
  await fs.copyFile(path.join(scripts, 'seed.cjs'), path.join(backend, 'local-integration-seed.cjs'));
  await run(process.execPath, ['local-integration-seed.cjs'], localEnv, backend);
}
async function setup() {
  if (await busy(ports.api)) throw Error('Backend port occupied; stop its owner or choose MATOR_API_PORT');
  await prepare();
  const localEnv = await env();
  await startServices();
  await run('npm', ['ci', '--no-audit', '--no-fund'], localEnv, backend);
  await run(process.execPath, ['node_modules/prisma/build/index.js', 'generate'], localEnv, backend);
  await run(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy'], localEnv, backend);
  await seed();
  await run('npm', ['run', 'build'], localEnv, backend);
  console.log('Local environment prepared. Run start, then smoke in another terminal.');
}
async function start() {
  const localEnv = await env();
  await startServices();
  if (await busy(ports.api)) throw Error('Backend API port occupied; refusing to replace an existing process');
  const log = await fs.open(path.join(state, 'backend.log'), 'a', 0o600);
  const child = spawn(process.execPath, [`--title=${apiTitle}`, '--require', './local-no-external.cjs', 'dist/src/main.js'], {
    cwd: backend, env: localEnv, stdio: ['ignore', log.fd, log.fd],
  });
  await fs.writeFile(path.join(state, 'backend.pid'), String(child.pid));
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
  console.log(`Local backend starting at http://127.0.0.1:${ports.api}; log: ${path.join(state, 'backend.log')}`);
  await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (code, signal) => code === 0 || signal ? resolve() : reject(Error(`Backend exited ${code}; inspect its private log`)));
  });
  await fs.unlink(path.join(state, 'backend.pid')).catch(() => {});
  await log.close();
}
async function stop() {
  await env();
  // Only this directory's process IDs/cluster are eligible. No killall/reset.
  const apiPid = path.join(state, 'backend.pid');
  if (await exists(apiPid)) {
    try {
      const pid = (await fs.readFile(apiPid, 'utf8')).trim();
      const title = await capture('ps', ['-p', pid, '-o', 'command=']);
      if (title !== apiTitle) throw Error('Backend PID belongs to another process; refusing to stop it');
      process.kill(Number(pid), 'SIGTERM');
    }
    catch (error) { if (error.code !== 'ESRCH' && error.exitCode !== 1) throw error; }
  }
  if (await busy(ports.redis)) {
    await assertRedis();
    process.kill(Number(await fs.readFile(redisPid, 'utf8')), 'SIGTERM');
  }
  if (await exists(path.join(pgData, 'postmaster.pid'))) {
    await assertPostgres();
    await run('pg_ctl', ['-D', pgData, 'stop', '-m', 'fast']);
  }
  console.log('Local services stopped; data preserved.');
}

try {
  if (command === 'setup') await setup();
  else if (command === 'services') await startServices();
  else if (command === 'start') await start();
  else if (command === 'seed') await seed();
  else if (command === 'smoke') {
    await env();
    await assertPostgres();
    await assertRedis();
    const pid = (await fs.readFile(path.join(state, 'backend.pid'), 'utf8')).trim();
    if (await capture('ps', ['-p', pid, '-o', 'command=']) !== apiTitle) throw Error('Local backend process identity mismatch');
    await run(process.execPath, [path.join(scripts, 'smoke.mjs')], { ...cleanEnv,
      MATOR_INTEGRATION_DIR: state, MATOR_API_PORT: String(ports.api),
      MATOR_POSTGRES_PORT: String(ports.postgres), MATOR_REDIS_PORT: String(ports.redis) });
  } else if (command === 'stop') await stop();
  else if (command === 'status') {
    for (const [name, port] of Object.entries(ports)) console.log(`${name}: 127.0.0.1:${port} ${await busy(port) ? 'listening' : 'stopped'}`);
  } else throw Error('Usage: node scripts/local-integration/run.mjs setup|services|start|seed|smoke|stop|status');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
