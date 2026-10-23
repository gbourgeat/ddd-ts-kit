import type { Config } from '../config';
import { isRecord } from '../config/values/is-record';
import type { Workspace } from '../workspace';
import type { PlannedClient } from './planned-client';

/** The lockfile npm writes, which `npm ci` refuses while a workspace package is missing from it. */
const NPM_LOCKFILE = 'package-lock.json';

/**
 * The directories of the clients that the npm lockfile does not link yet: until `npm install`
 * rewrites it, the frozen install of a pipeline (`npm ci`) refuses the lock. None under pnpm,
 * whose frozen install accepts a new workspace package, nor in a project without a lockfile.
 */
export function unlockedClients(ws: Workspace, config: Config, clients: readonly PlannedClient[]): string[] {
  const text = config.stack.packageManager === 'pnpm' ? undefined : ws.read(NPM_LOCKFILE);

  if (text === undefined) {
    return [];
  }

  const packages = lockedPackages(text);

  if (packages === undefined) {
    return [];
  }

  return clients
    .filter(({ packageName, directory }) => !links(packages[`node_modules/${packageName}`], directory))
    .map(({ directory }) => directory);
}

/** A lockfile that cannot be read is left to npm, which says it better. */
function lockedPackages(text: string): Readonly<Record<string, unknown>> | undefined {
  try {
    const lock: unknown = JSON.parse(text);
    const packages = isRecord(lock) ? lock['packages'] : undefined;

    return isRecord(packages) ? packages : undefined;
  } catch {
    return undefined;
  }
}

function links(entry: unknown, directory: string): boolean {
  return isRecord(entry) && entry['link'] === true && entry['resolved'] === directory;
}
