import fs from 'node:fs';
import path from 'node:path';
import { expect } from 'vitest';
import { cli, read, walk } from '../helpers.js';
import { runIn } from './run-in.js';
import { NATIVE_COMPILER } from './type-errors.js';

const INTEGRATION = ['docs/integration/README.md', 'docs/integration/asyncapi.json', 'docs/integration/event-catalog.md'];

/** What `npm run build` and the documentation checks of the pipeline run: the compiler in build mode, then every generated contract, written and compared. */
export function buildAndCheckDocuments(root: string): void {
  const node = (...args: string[]): string => runIn(root, { command: process.execPath, args });

  node(NATIVE_COMPILER, '-p', 'tsconfig.build.json');
  node('dist/scripts/events.js');
  node('dist/scripts/events.js', '--check');

  expect(walk(root, 'docs/integration')).toEqual(INTEGRATION);
  expect(read(root, 'docs/integration/event-catalog.md')).toContain('Consumers: `shipping`');
  expect(fs.existsSync(path.join(root, 'dist/src/apps/shipping/main.js'))).toBe(true);
  expect(fs.existsSync(path.join(root, 'dist/src/apps/worker/main.js'))).toBe(true);
  expect(cli(root, 'check').code).toBe(0);
  expect(cli(root, 'docs', '--check').code).toBe(0);

  if (!fs.existsSync(path.join(root, 'scripts/openapi.ts'))) return;

  node('dist/scripts/openapi.js');
  node('dist/scripts/openapi.js', '--check');

  expect(read(root, 'openapi/openapi.json')).toContain('"securitySchemes"');
}
