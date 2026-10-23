import { readTemplate } from '../templating';
import type { ClientDocument } from './client-document';
import { CLIENT_TSCONFIG } from './client-tsconfig';
import { renderClient } from './render-client';
import { renderErrors } from './render-errors';
import { renderIndex } from './render-index';
import { renderOperations } from './render-operations';
import { renderReadme } from './render-readme';
import { renderSchemas } from './render-schemas';

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
