import { currentRuntime } from './installed-runtime';

/** Whether the work in progress reads under an elevation (`acrossTenants`), as the execution scope of the runtime says. */
export function isElevatedWork(): boolean {
  return currentRuntime().scope?.current()?.elevation !== undefined;
}
