import path from 'node:path';
import { normalizedDirectory } from './normalized-directory';

/** True for a directory that leads out of the project once normalised: absolute, on a drive, or above the root. */
export function leavesProject(value: string): boolean {
  const normalized = normalizedDirectory(value);

  return (
    path.posix.isAbsolute(normalized) ||
    /^[A-Za-z]:/.test(normalized) ||
    normalized === '..' ||
    normalized.startsWith('../')
  );
}
