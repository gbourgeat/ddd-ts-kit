import { clientFiles, type Rpc } from '../../src/sdk/client-files';
import { clientManifest } from '../../src/sdk/client-manifest';
import { readClientDocument } from '../../src/sdk/read-client-document';
import { tempDir, write } from '../helpers';

/** The client of a contract written to a temporary directory as `ddd-ts-kit sdk` writes it: the directory. */
export function writtenClient(contract: unknown, packageName: string, rpc: Rpc = 'none'): string {
  const root = tempDir('client');
  const document = readClientDocument({ name: 'api', source: 'openapi/openapi.yaml' }, contract);

  for (const [file, content] of clientFiles({ document, packageName, directory: 'clients/api' }, rpc)) {
    write(root, file, content);
  }

  write(
    root,
    'package.json',
    clientManifest({ name: packageName, version: '1.0.0', title: document.title, access: undefined, rpc }, undefined),
  );

  return root;
}
