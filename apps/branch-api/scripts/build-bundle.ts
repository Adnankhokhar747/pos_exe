import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

// Produces apps/branch-api/bundle/ — a self-contained, single-file build of
// the Branch API that the packaged desktop app spawns as a child process
// (apps/desktop/main/branch-api-process.ts). Plain `nest build` output isn't
// enough on its own: it still `require()`s its node_modules tree, and this is
// a pnpm workspace where that tree is symlinks into a workspace-root store
// that won't exist once the app is installed on another machine — so this
// bundles everything pure-JS via esbuild and copies the handful of native
// dependencies (Prisma's query engine, argon2) in as real files instead of
// dangling symlinks. Run after `pnpm build` (needs dist/ to already exist).
//
// Usage: `ts-node scripts/build-bundle.ts`

const ROOT = path.join(__dirname, '..');
const WORKSPACE_ROOT = path.join(ROOT, '..', '..');
const BUNDLE_DIR = path.join(ROOT, 'bundle');
const PNPM_STORE = path.join(WORKSPACE_ROOT, 'node_modules', '.pnpm');

function findStoreDir(prefix: string): string {
  const match = fs.readdirSync(PNPM_STORE).find((name) => name.startsWith(prefix));
  if (!match) throw new Error(`Could not find a pnpm store entry starting with "${prefix}" under ${PNPM_STORE}`);
  return path.join(PNPM_STORE, match, 'node_modules');
}

function copyDereferenced(from: string, to: string): void {
  fs.rmSync(to, { recursive: true, force: true });
  fs.cpSync(from, to, { recursive: true, dereference: true });
}

console.log('[bundle] clearing previous bundle...');
fs.rmSync(BUNDLE_DIR, { recursive: true, force: true });
fs.mkdirSync(BUNDLE_DIR, { recursive: true });

console.log('[bundle] running esbuild...');
const esbuildBin = path.join(findStoreDir('esbuild@'), 'esbuild', 'bin', 'esbuild');
execFileSync(
  process.execPath,
  [
    esbuildBin,
    path.join(ROOT, 'dist', 'main.js'),
    '--bundle',
    '--platform=node',
    '--target=node20',
    '--external:@prisma/client',
    '--external:.prisma/client',
    '--external:argon2',
    // NestJS optionally lazy-loads these two adapters if you actually use
    // WebSockets/microservices transports; this app uses neither, but
    // `@nestjs/core` still contains the require() calls that reference
    // them, which esbuild resolves eagerly at bundle time unless told not to.
    '--external:@nestjs/websockets',
    '--external:@nestjs/websockets/socket-module',
    '--external:@nestjs/microservices',
    '--external:@nestjs/microservices/microservices-module',
    '--external:class-transformer/storage',
    `--outfile=${path.join(BUNDLE_DIR, 'main.js')}`,
  ],
  { stdio: 'inherit' },
);

console.log('[bundle] copying native dependencies (Prisma engine, argon2)...');
const prismaClientPkgDir = findStoreDir('@prisma+client@');
copyDereferenced(path.join(prismaClientPkgDir, '@prisma', 'client'), path.join(BUNDLE_DIR, 'node_modules', '@prisma', 'client'));
copyDereferenced(path.join(prismaClientPkgDir, '.prisma', 'client'), path.join(BUNDLE_DIR, 'node_modules', '.prisma', 'client'));
// Leftover query-engine rename temp files from interrupted `prisma generate` runs on this
// dev machine — harmless if present, but never something a real build should ship.
for (const entry of fs.readdirSync(path.join(BUNDLE_DIR, 'node_modules', '.prisma', 'client'))) {
  if (entry.includes('.tmp')) fs.rmSync(path.join(BUNDLE_DIR, 'node_modules', '.prisma', 'client', entry));
}

// argon2's own transitive deps (@phc/format, node-addon-api, node-gyp-build) live as
// siblings inside its pnpm store folder, not nested under argon2/node_modules — copying
// only the "argon2" subfolder leaves `require('@phc/format')` unresolved once this bundle
// is copied out of the monorepo (it silently "worked" in-place during dev because Node's
// module resolution walked up past bundle/ into this repo's real node_modules and found it
// there by coincidence). Copy the whole store folder so it's genuinely self-contained.
const argon2StoreDir = findStoreDir('argon2@');
for (const entry of fs.readdirSync(argon2StoreDir)) {
  copyDereferenced(path.join(argon2StoreDir, entry), path.join(BUNDLE_DIR, 'node_modules', entry));
}

console.log('[bundle] copying prisma migrations...');
fs.cpSync(path.join(ROOT, 'prisma', 'migrations'), path.join(BUNDLE_DIR, 'prisma', 'migrations'), { recursive: true });

console.log(`[bundle] done: ${BUNDLE_DIR}`);
