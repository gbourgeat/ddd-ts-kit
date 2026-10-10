import { openPersistence } from './open-persistence.js';
import type { Persistence } from './persistence.js';

/** For the scripts that only list routes: nothing to connect to here. */
export function inertPersistence(): Persistence {
  return openPersistence();
}
