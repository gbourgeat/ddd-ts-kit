import path from 'node:path';
import type { Config } from '../config';
import { isRecord } from '../config/values/is-record';
import type { Workspace } from '../workspace';
import { clientPackageName } from './client-package-name';
import { CLIENTS_DIRECTORY } from './clients-directory';
import { contractDocuments } from './contract-documents';
import type { PlannedClient } from './planned-client';

/** One client per document of the contract, named by "sdk.name". */
export function plannedClients(ws: Workspace, config: Config, sdk: NonNullable<Config['sdk']>): PlannedClient[] {
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
