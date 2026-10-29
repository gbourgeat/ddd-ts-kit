import path from 'node:path';
import { posix } from './values/posix';

/** The directory as the kit reads it: forward slashes, `.` and `..` resolved, no `./` before it and no `/` after it. */
export function normalizedDirectory(value: string): string {
  return posix(path.posix.normalize(posix(value)));
}
