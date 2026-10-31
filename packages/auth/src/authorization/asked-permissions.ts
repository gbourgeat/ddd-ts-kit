import { AsyncLocalStorage } from 'node:async_hooks';
import type { Permission } from '../permissions/permission';

/** Each permission asked about, and whether `Access` allowed it at least once, whatever the order the answers came in. */
export type AskedPermissions = ReadonlyMap<string, boolean>;

// Follows the asynchronous call chain of the handler it was opened around: concurrent messages never share it.
const asked = new AsyncLocalStorage<Map<string, boolean>>();

/** Runs `work` while recording the permissions `Access` is asked about and whether one answer allowed each, and answers them with its result. */
export async function recordingAskedPermissions<T>(
  work: () => Promise<T>,
): Promise<{ readonly result: T; readonly asked: AskedPermissions }> {
  const permissions = new Map<string, boolean>();
  const result = await asked.run(permissions, work);

  return { result, asked: permissions };
}

/** Called by `Access` for every question, before it is decided; outside of a recording, it does nothing. */
export function recordAsked(permission: Permission): void {
  const permissions = asked.getStore();

  if (permissions !== undefined && !permissions.has(permission.id)) {
    permissions.set(permission.id, false);
  }
}

/** Called by `Access` with the answer to a question: one allowed answer is enough for the permission, a denial never takes it back. */
export function recordDecided(permission: Permission, allowed: boolean): void {
  if (allowed) {
    asked.getStore()?.set(permission.id, true);
  }
}
