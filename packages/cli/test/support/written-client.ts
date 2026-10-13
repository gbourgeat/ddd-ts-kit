import { clientFiles } from '../../src/sdk/client-files.js';
import { clientManifest } from '../../src/sdk/client-manifest.js';
import { readClientDocument } from '../../src/sdk/read-client-document.js';
import { tempDir, write } from '../helpers.js';

/** The client of a contract written to a temporary directory as `ddd-ts-kit sdk` writes it: the directory. */
export function writtenClient(contract: unknown, packageName: string): string {
  const root = tempDir('client');
  const document = readClientDocument({ name: 'api', source: 'openapi/openapi.yaml' }, contract);

  for (const [file, content] of clientFiles(document, packageName, 'clients/api')) {
    write(root, file, content);
  }

  write(
    root,
    'package.json',
    clientManifest({ name: packageName, version: '1.0.0', title: document.title, access: undefined }, undefined),
  );

  return root;
}
