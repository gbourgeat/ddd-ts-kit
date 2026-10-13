import { assertFileKey } from './assert-file-key.js';
import { FileError } from './file-error.js';
import { STAGING_PREFIX } from './staged-key-of.js';

/** Refuses a key the storages refuse, and one under `staging/`, which the purge would take for a staged file. */
export function assertFinalKey(key: string): string {
  if (assertFileKey(key).startsWith(STAGING_PREFIX)) {
    throw FileError.invalidKey(key);
  }

  return key;
}
