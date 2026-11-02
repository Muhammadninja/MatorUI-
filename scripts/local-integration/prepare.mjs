import fs from 'node:fs/promises';
import path from 'node:path';
import { generateKeyPairSync } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { root, backendSource, backend, state, ports, databaseUrl, cleanEnv } from './settings.mjs';

export async function prepare() {
  await fs.mkdir(state, { recursive: true, mode: 0o700 });
  await fs.mkdir(backend, { recursive: true, mode: 0o700 });
  const verified = JSON.parse(await fs.readFile(path.join(root, 'config/local-integration/services.json'), 'utf8')).backendRevisionVerified;
  const revision = spawnSync('git', ['-C', backendSource, 'rev-parse', 'HEAD'], { encoding: 'utf8', env: cleanEnv });
  let source = backendSource;
  if (revision.status === 0) {
    const commit = spawnSync('git', ['-C', backendSource, 'cat-file', '-e', `${verified}^{commit}`], { env: cleanEnv });
    if (commit.status !== 0) throw Error(`Required backend revision ${verified} is missing; fetch that commit before setup`);
    const prefixResult = spawnSync('git', ['-C', backendSource, 'rev-parse', '--show-prefix'], { encoding: 'utf8', env: cleanEnv });
    const prefix = prefixResult.stdout.trim();
    const snapshot = path.join(state, 'source-snapshot');
    await fs.mkdir(snapshot, { recursive: true });
    const archive = spawnSync('git', ['-C', backendSource, 'archive', '--format=tar', verified,
      'src', 'prisma', 'docs', 'test', 'scripts', 'package.json', 'package-lock.json',
      'tsconfig.json', 'tsconfig.build.json', 'nest-cli.json'], { env: cleanEnv, maxBuffer: 100 * 1024 * 1024 });
    if (archive.status !== 0) throw Error('Cannot archive committed backend source');
    const archivePath = path.join(state, 'backend-source.tar');
    await fs.writeFile(archivePath, archive.stdout, { mode: 0o600 });
    const extracted = spawnSync('tar', ['-xf', archivePath, '-C', snapshot], { env: cleanEnv });
    if (extracted.status !== 0) throw Error('Cannot extract committed backend snapshot');
    // git archive from a subdirectory produces paths relative to that directory.
    source = await fs.stat(path.join(snapshot, 'package.json')).then(() => snapshot).catch(() => path.join(snapshot, prefix));
  } else {
    const archiveRevision = (await fs.readFile(path.join(source, '.mator-backend-revision'), 'utf8')).trim();
    if (archiveRevision !== verified) throw Error('Archive source has no matching .mator-backend-revision marker');
  }
  for (const name of ['src', 'prisma', 'docs', 'test', 'scripts']) {
    await fs.cp(path.join(source, name), path.join(backend, name), {
      recursive: true,
      filter: (entry) => !/(^|\/)\.|\.(pem|key|p8|p12)$/.test(path.relative(source, entry)),
    });
  }
  for (const name of ['package.json', 'package-lock.json', 'tsconfig.json', 'tsconfig.build.json', 'nest-cli.json']) {
    await fs.copyFile(path.join(source, name), path.join(backend, name));
  }
  // A local-only adapter, kept in this repository instead of relying on dirty
  // files or changes to the backend deployment. Never modifies backendSource.
  const mainPath = path.join(backend, 'src/main.ts');
  const main = await fs.readFile(mainPath, 'utf8');
  const listen = 'await app.listen(process.env.PORT ?? 3000);';
  if (!main.includes(listen)) throw Error('Backend bootstrap changed; review the local loopback adapter');
  const servicePath = path.join(backend, 'src/catalog/parts/parts.service.ts');
  const service = await fs.readFile(servicePath, 'utf8');
  const unknown = "status: 'UNCERTAIN',\n        isCompatible: true,";
  const safeUnknown = "status: 'UNCERTAIN',\n        isCompatible: false,";
  if (!service.includes(unknown) && !service.includes(safeUnknown)) {
    throw Error('Compatibility implementation changed; review the local adapter');
  }
  // Normalize a backend checkout that already includes the upstream bug fix;
  // then apply the same committed adapter to either clean or fixed source.
  await fs.writeFile(servicePath, service.replace(safeUnknown, unknown));
  const patch = path.join(root, 'config/local-integration/backend-local.patch');
  // Apply exact context blocks ourselves. `git apply` inside an ignored nested
  // runtime can silently skip paths belonging to the parent frontend worktree.
  for (const section of (await fs.readFile(patch, 'utf8')).split('diff --git ').slice(1)) {
    const relative = section.split('\n')[0].split(' b/')[1];
    if (!relative || relative.includes('..') || path.isAbsolute(relative)) throw Error('Invalid local patch path');
    const target = path.join(backend, relative);
    let content = await fs.readFile(target, 'utf8');
    for (const hunk of section.split(/^@@[^\n]*\n/m).slice(1)) {
      const lines = hunk.split('\n').filter((line) => /^[ +\-]/.test(line));
      const before = lines.filter((line) => !line.startsWith('+')).map((line) => line.slice(1)).join('\n');
      const after = lines.filter((line) => !line.startsWith('-')).map((line) => line.slice(1)).join('\n');
      if (content.split(before).length !== 2) throw Error(`Local adapter context changed in ${relative}`);
      content = content.replace(before, after);
    }
    await fs.writeFile(target, content);
  }
  const patchedMain = await fs.readFile(mainPath, 'utf8');
  const patchedService = await fs.readFile(servicePath, 'utf8');
  const patchedModule = await fs.readFile(path.join(backend, 'src/app.module.ts'), 'utf8');
  if (!patchedMain.includes("app.listen(process.env.PORT ?? 3000, '127.0.0.1')") ||
      !patchedService.includes(safeUnknown) || !patchedModule.includes('ignoreEnvFile: true')) {
    throw Error('Local adapter verification failed; refusing to prepare an unsafe runtime');
  }
  // Fixed local JWTs are generated once, so backend restarts preserve sessions.
  let keys;
  try { keys = JSON.parse(await fs.readFile(path.join(state, 'jwt.json'), 'utf8')); }
  catch (error) {
    if (error.code !== 'ENOENT') throw error;
    keys = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    await fs.writeFile(path.join(state, 'jwt.json'), JSON.stringify(keys), { mode: 0o600 });
  }
  const env = {
    ...cleanEnv, PORT: String(ports.api), DATABASE_URL: databaseUrl, DIRECT_URL: databaseUrl,
    REDIS_HOST: '127.0.0.1', REDIS_PORT: String(ports.redis), AUTH_DEV_MODE: 'true',
    SMS_PROVIDER: 'log', TELEGRAM_POLLING_DISABLED: 'true',
    TELEGRAM_BOT_TOKEN: '123456:local-integration-unused',
    CLOUDINARY_CLOUD_NAME: 'local-unused', CLOUDINARY_API_KEY: 'local-unused',
    CLOUDINARY_API_SECRET: 'local-unused', BLUEPRINT_ENABLED: 'false',
    BFL_API_KEY: 'local-unused',
    JWT_PRIVATE_KEY: keys.privateKey, JWT_PUBLIC_KEY: keys.publicKey, JWT_KID: 'local-integration',
  };
  await fs.writeFile(path.join(state, 'environment.json'), JSON.stringify(env), { mode: 0o600 });
  await fs.copyFile(path.join(root, 'scripts/local-integration/no-external.cjs'), path.join(backend, 'local-no-external.cjs'));
  // No .env is copied or sourced; Prisma/Nest get only this explicit child env.
  await fs.writeFile(path.join(state, 'source.json'), JSON.stringify({
    backendSource, revision: verified, preparedAt: new Date().toISOString(),
    note: 'Local adapter: loopback listener; UNCERTAIN isCompatible=false.',
  }, null, 2));
  await fs.writeFile(path.join(state, '.mator-local-integration'), 'isolated local integration runtime\n');
}
