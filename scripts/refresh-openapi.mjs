// Copies the API's OpenAPI spec into this package, then regenerates the committed types.
//
// Monorepo-only maintenance helper. After the repos are split, download the spec from the API repo
// (or its release) into openapi/openapi.yaml and run `pnpm gen:api`; delete this script.
//
// Usage: pnpm api:refresh <path-to-ledgertax-api>   (default: ../ledgertax-api)
import { execFileSync } from 'node:child_process';
import { copyFileSync } from 'node:fs';
import { resolve } from 'node:path';

const api = resolve(process.argv[2] ?? '../ledgertax-api');
copyFileSync(resolve(api, 'openapi.yaml'), resolve('openapi', 'openapi.yaml'));
execFileSync(process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm', ['gen:api'], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
});
console.log('OpenAPI spec and generated types refreshed.');
