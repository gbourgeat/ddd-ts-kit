import { AsyncLocalStorage } from 'node:async_hooks';
import type { Permission } from '../permissions/permission';

/** What `Access` answered last about each permission asked: `undefined` while the question is being decided. */
export type AskedPermissions = ReadonlyMap<string, boolean | undefined>;

// Follows the asynchronous call chain of the handler it was opened around: concurrent messages never share it.
const asked = new AsyncLocalStorage<Map<string, boolean | undefined>>();

/** Runs `work` while recording the permissions `Access` is asked about and its last answer on each, and answers them with its result. */
export async function recordingAskedPermissions<T>(
  work: () => Promise<T>,
): Promise<{ readonly result: T; readonly asked: AskedPermissions }> {
  const permissions = new Map<string, boolean | undefined>();
  const result = await asked.run(permissions, work);

  return { result, asked: permissions };
}

/** Called by `Access` for every question, before it is decided; outside of a recording, it does nothing. */
export function recordAsked(permission: Permission): void {
  asked.getStore()?.set(permission.id, undefined);
}

/** Called by `Access` with the answer to a question: the last one on a permission is what the handler went on with. */
export function recordDecided(permission: Permission, allowed: boolean): void {
  asked.getStore()?.set(permission.id, allowed);
}
