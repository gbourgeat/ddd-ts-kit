import { AsyncLocalStorage } from 'node:async_hooks';
import type { Permission } from '../permissions/permission.js';

// Follows the asynchronous call chain of the handler it was opened around: concurrent messages never share it.
const asked = new AsyncLocalStorage<Set<string>>();

/** Runs `work` while recording the permissions `Access` is asked about, and answers them with its result. */
export async function recordingAskedPermissions<T>(
  work: () => Promise<T>,
): Promise<{ readonly result: T; readonly asked: ReadonlySet<string> }> {
  const permissions = new Set<string>();
  const result = await asked.run(permissions, work);

  return { result, asked: permissions };
}

/** Called by `Access` for every question; outside of a recording, it does nothing. */
export function recordAsked(permission: Permission): void {
  asked.getStore()?.add(permission.id);
}
