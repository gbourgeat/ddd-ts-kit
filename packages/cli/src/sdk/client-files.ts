import { readTemplate } from '../templating/index.js';
import type { ClientDocument } from './client-document.js';
import { CLIENT_TSCONFIG } from './client-tsconfig.js';
import { renderClient } from './render-client.js';
import { renderErrors } from './render-errors.js';
import { renderIndex } from './render-index.js';
import { renderOperations } from './render-operations.js';
import { renderReadme } from './render-readme.js';
import { renderSchemas } from './render-schemas.js';

/**
 * Every file of a client the generator owns, relative to its directory: its sources, its README
 * and its compiler options. package.json is not among them: the team owns its version.
 */
export function clientFiles(document: ClientDocument, packageName: string, directory: string): [string, string][] {
  return [
    ['README.md', renderReadme(document, { packageName, directory })],
    ['tsconfig.json', CLIENT_TSCONFIG],
    ['src/client.ts', renderClient(document)],
    ['src/errors.ts', renderErrors(document)],
    ['src/index.ts', renderIndex(document)],
    ['src/operations.ts', renderOperations(document)],
    ['src/runtime.ts', readTemplate('sdk/runtime.ts.tpl')],
    ['src/schemas.ts', renderSchemas(document)],
  ];
}
