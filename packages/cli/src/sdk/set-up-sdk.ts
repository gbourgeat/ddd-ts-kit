import type { Config } from '../config';
import type { Workspace } from '../workspace';
import { plannedClients } from './planned-clients';
import type { SdkSetUp } from './sdk-set-up';
import { unlockedClients } from './unlocked-clients';
import { wireSdk } from './wire-sdk';
import { writeClients } from './write-clients';

/**
 * The clients of the contract and what the project needs around them, as "sdk" asks: what `init
 * --sdk` writes in a new project and `ddd-ts-kit sdk` in any project, again at each change of the
 * contract. Answers what is left to do, for the caller to say: the clients whose document is
 * gone, and those the npm lockfile does not link yet.
 */
export function setUpSdk(ws: Workspace, config: Config): SdkSetUp {
  if (config.sdk === undefined || config.stack.http === 'none') {
    return { gone: [], unlocked: [] };
  }

  const clients = plannedClients(ws, config);

  wireSdk(ws, config, clients);

  return { gone: writeClients(ws, config, clients), unlocked: unlockedClients(ws, config, clients) };
}
