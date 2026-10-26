import fs from 'node:fs';
import path from 'node:path';
import { errorCodeOf } from './error-code-of';

/**
 * What a dry run says of a file the real run could not write: the file is not a regular file, or
 * the nearest existing folder above it is not a folder (a device a sandbox mounts in its place)
 * or is not writable (a read-only mount).
 */
export function cannotWrite(absolute: string, at = absolute): boolean {
  const stat = statOf(at);

  if (stat === 'missing') {
    const parent = path.dirname(at);

    return parent !== at && cannotWrite(absolute, parent);
  }

  if (stat === 'unreadable' || (at === absolute ? !stat.isFile() : !stat.isDirectory())) {
    return true;
  }

  try {
    fs.accessSync(at, fs.constants.W_OK);

    return false;
  } catch {
    return true;
  }
}

function statOf(absolute: string): fs.Stats | 'missing' | 'unreadable' {
  try {
    return fs.statSync(absolute);
  } catch (error) {
    const code = errorCodeOf(error);

    // ENOTDIR: a file or a device stands where a folder of the path goes, looked at one level up.
    return code === 'ENOENT' || code === 'ENOTDIR' ? 'missing' : 'unreadable';
  }
}
