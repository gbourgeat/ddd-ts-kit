import fs from 'node:fs';
import path from 'node:path';
import { errorCodeOf } from './error-code-of';

/** The errors of a path this process may not write: read-only, denied, or a file or device where a folder goes. */
const PROTECTED = new Set(['EACCES', 'EPERM', 'EROFS', 'EEXIST', 'ENOTDIR', 'EISDIR']);

/** Writes the file, its folders first; false when the path is protected here, any other error thrown. */
export function writeIfAllowed(absolute: string, content: string): boolean {
  try {
    fs.mkdirSync(path.dirname(absolute), { recursive: true });
    fs.writeFileSync(absolute, content);

    return true;
  } catch (error) {
    if (PROTECTED.has(errorCodeOf(error) ?? '')) {
      return false;
    }

    throw error;
  }
}
