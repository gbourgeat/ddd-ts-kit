import path from 'node:path';
import type { Config } from '../config/index.js';
import { isRecord } from '../config/values/is-record.js';
import type { Workspace } from '../workspace/index.js';
import { clientPackageName } from './client-package-name.js';
import { CLIENTS_DIRECTORY } from './clients-directory.js';
import { contractDocuments } from './contract-documents.js';
import type { PlannedClient } from './planned-client.js';

/** One client per document of the contract, named by "sdk.name"; none while the config asks for no client. */
export function plannedClients(ws: Workspace, config: Config): PlannedClient[] {
  const sdk = config.sdk;

  if (sdk === undefined) {
    return [];
  }

  const project = projectName(ws);

  return contractDocuments(ws, config).map((document) => ({
    document,
    packageName: clientPackageName(sdk.name, project, document.name),
    directory: `${CLIENTS_DIRECTORY}/${document.name}`,
  }));
}

/** The name in package.json, the name of the directory without one. */
function projectName(ws: Workspace): string {
  try {
    const manifest: unknown = JSON.parse(ws.read('package.json') ?? '{}');
    const name = isRecord(manifest) ? manifest['name'] : undefined;

    return typeof name === 'string' && name !== '' ? name : path.basename(path.resolve(ws.root));
  } catch {
    return path.basename(path.resolve(ws.root));
  }
}
