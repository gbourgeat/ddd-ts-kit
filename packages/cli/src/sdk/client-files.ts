import { readTemplate } from '../templating';
import type { Stack } from '../config';
import { CLIENT_TSCONFIG } from './client-tsconfig';
import type { PlannedClient } from './planned-client';
import { renderClient } from './render-client';
import { renderErrors } from './render-errors';
import { renderIndex } from './render-index';
import { renderOperations } from './render-operations';
import { renderOrpc } from './render-orpc';
import { renderReadme } from './render-readme';
import { renderSchemas } from './render-schemas';

/** How the API serves its routes besides HTTP: `stack.rpc`. */
export type Rpc = Stack['rpc'];

/**
 * Every file of a client the generator owns, relative to its directory: its sources, its README
 * and its compiler options, and the oRPC contract of its procedures when the API serves them.
 * package.json is not among them: the team owns its version.
 */
export function clientFiles(
  { document, packageName, directory }: PlannedClient,
  rpc: Rpc = 'none',
): [string, string][] {
  return [
    ['README.md', renderReadme(document, { packageName, directory, rpc })],
    ['tsconfig.json', CLIENT_TSCONFIG],
    ['src/client.ts', renderClient(document)],
    ['src/errors.ts', renderErrors(document)],
    ['src/index.ts', renderIndex(document)],
    ['src/operations.ts', renderOperations(document)],
    ...(rpc === 'orpc' ? [['src/orpc.ts', renderOrpc(document)] satisfies [string, string]] : []),
    ['src/runtime.ts', readTemplate('sdk/runtime.ts.tpl')],
    ['src/schemas.ts', renderSchemas(document)],
  ];
}
