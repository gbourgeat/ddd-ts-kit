import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { DiskWrites } from './disk-writes';
import { errorCodeOf } from './error-code-of';
import { BLOCKED, realPathOf } from './real-path-of';

/**
 * The errors of a path this process may not write: read-only, denied, a file or device where a
 * folder goes, or a mount (what a sandbox binds over a path it protects) the rename cannot replace.
 */
const PROTECTED = new Set(['EACCES', 'EPERM', 'EROFS', 'EEXIST', 'ENOTDIR', 'EISDIR', 'EBUSY']);

/**
 * Writes the file, its folders first, whole or not at all: the content goes to a temporary file
 * beside it (`<name>.<random>.tmp`), which is then renamed into place, so that a process stopped
 * half way leaves the earlier content or the new one, never a part. A link in its place is written
 * through, to where it points. False when the path is protected here, any other error thrown.
 */
export function writeIfAllowed(absolute: string, content: string, disk: DiskWrites = fs): boolean {
  const target = realPathOf(absolute) ?? absolute;

  if (target === BLOCKED) {
    return false;
  }

  try {
    writeWhole(target, content, disk);

    return true;
  } catch (error) {
    if (PROTECTED.has(errorCodeOf(error) ?? '')) {
      return false;
    }

    throw error;
  }
}

/** The temporary file is removed when the write or the rename fails: what stays is complete. */
function writeWhole(target: string, content: string, disk: DiskWrites): void {
  fs.mkdirSync(path.dirname(target), { recursive: true });

  const temporary = path.join(path.dirname(target), `${path.basename(target)}.${randomBytes(6).toString('hex')}.tmp`);

  try {
    disk.writeFileSync(temporary, content);
    keepModeOf(target, temporary);
    disk.renameSync(temporary, target);
  } catch (error) {
    fs.rmSync(temporary, { force: true });

    throw error;
  }
}

/** A file written over keeps its mode, such as the executable bit of a hook script. */
function keepModeOf(target: string, temporary: string): void {
  const earlier = fs.statSync(target, { throwIfNoEntry: false });

  if (earlier?.isFile() === true) {
    fs.chmodSync(temporary, earlier.mode & 0o7777);
  }
}
