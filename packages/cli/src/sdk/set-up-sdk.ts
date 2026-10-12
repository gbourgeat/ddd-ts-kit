import type { Config } from '../config/index.js';
import type { Workspace } from '../workspace/index.js';
import { plannedClients } from './planned-clients.js';
import { wireSdk } from './wire-sdk.js';
import { writeClients } from './write-clients.js';

/**
 * The clients of the contract and what the project needs around them, as "sdk" asks: what `init
 * --sdk` writes in a new project and `ddd-ts-kit sdk` in any project, again at each change of the
 * contract. Answers the directories of clients whose document is gone, for the caller to say.
 */
export function setUpSdk(ws: Workspace, config: Config): string[] {
  if (config.sdk === undefined || config.stack.http === 'none') {
    return [];
  }

  const clients = plannedClients(ws, config);

  wireSdk(ws, config, clients);

  return writeClients(ws, config, clients);
}
