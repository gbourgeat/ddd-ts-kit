import { FileError } from './file-error.js';
import { isFileKey } from './is-file-key.js';

/** For a connector: refuses a key `isFileKey` refuses, before anything is touched. */
export function assertFileKey(key: string): string {
  if (!isFileKey(key)) {
    throw FileError.invalidKey(key);
  }

  return key;
}
