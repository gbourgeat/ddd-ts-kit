import fs from 'node:fs';
import path from 'node:path';
import { expect } from 'vitest';
import { cli, read, walk } from '../helpers';
import { runIn } from './run-in';
import { NATIVE_COMPILER } from './type-errors';

const INTEGRATION = [
  'docs/integration/README.md',
  'docs/integration/asyncapi.yaml',
  'docs/integration/event-catalog.md',
];

/** What `npm run build` and the documentation checks of the pipeline run: the compiler in build mode, the aliases of its output rewritten, then every generated contract, written and compared. */
export function buildAndCheckDocuments(root: string): void {
  const node = (...args: string[]): string => runIn(root, { command: process.execPath, args });

  node(NATIVE_COMPILER, '-p', 'tsconfig.build.json');

  expect(cli(root, 'build-aliases').code).toBe(0);

  node('dist/scripts/events.js');
  node('dist/scripts/events.js', '--check');

  expect(walk(root, 'docs/integration')).toEqual(INTEGRATION);
  expect(read(root, 'docs/integration/event-catalog.md')).toContain('Consumers: `shipping`');
  expect(fs.existsSync(path.join(root, 'dist/src/apps/shipping/main.js'))).toBe(true);
  expect(fs.existsSync(path.join(root, 'dist/src/apps/worker/main.js'))).toBe(true);
  expect(cli(root, 'check').code).toBe(0);
  expect(cli(root, 'docs', '--check').code).toBe(0);

  if (!fs.existsSync(path.join(root, 'scripts/openapi.ts'))) {
    return;
  }

  node('dist/scripts/openapi.js');
  node('dist/scripts/openapi.js', '--check');

  expect(read(root, 'openapi/openapi.yaml')).toContain('\n  securitySchemes:\n');
}
