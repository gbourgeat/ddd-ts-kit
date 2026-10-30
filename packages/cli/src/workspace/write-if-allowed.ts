import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { DiskWrites } from './disk-writes';
import { errorCodeOf } from './error-code-of';
import { BLOCKED, realPathOf, type RealPath } from './real-path-of';

/** The errors of a path this process may not write: read-only, denied, or a file or device where a folder goes. */
const PROTECTED = new Set(['EACCES', 'EPERM', 'EROFS', 'EEXIST', 'ENOTDIR', 'EISDIR']);

/** The disk the file is written on, and its real path when the plan already resolved it (`refuseLeaving`). */
interface WriteOptions {
  readonly disk?: DiskWrites;
  readonly real?: RealPath;
}

/** One file on its way: where it lands, what it holds, the disk that writes it. */
interface Writing {
  readonly target: string;
  readonly content: string;
  readonly disk: DiskWrites;
}

/**
 * Writes the file, its folders first, whole or not at all: the content goes to a temporary file
 * beside it (`<name>.<random>.tmp`), which is then renamed into place, so that a process stopped
 * half way leaves the earlier content or the new one, never a part. A link in its place is written
 * through, to where it points. False when the path is protected here, a file this process may not
 * write included (as a dry run says, `cannotWrite`), any other error thrown.
 */
export function writeIfAllowed(
  absolute: string,
  content: string,
  { disk = fs, real = realPathOf(absolute) }: WriteOptions = {},
): boolean {
  const target = real ?? absolute;

  if (target === BLOCKED || !isWritable(target)) {
    return false;
  }

  try {
    writeWhole({ target, content, disk });

    return true;
  } catch (error) {
    if (PROTECTED.has(errorCodeOf(error) ?? '')) {
      return false;
    }

    throw error;
  }
}

/** A file that exists is written over only when this process may write it: a rename would replace a read-only one. */
function isWritable(target: string): boolean {
  if (!fs.existsSync(target)) {
    return true;
  }

  try {
    fs.accessSync(target, fs.constants.W_OK);

    return true;
  } catch {
    return false;
  }
}

/** The temporary file never stays: renamed into place, or removed when the write or the rename fails. */
function writeWhole(writing: Writing): void {
  const { target, content, disk } = writing;

  fs.mkdirSync(path.dirname(target), { recursive: true });

  const temporary = path.join(path.dirname(target), `${path.basename(target)}.${randomBytes(6).toString('hex')}.tmp`);

  try {
    disk.writeFileSync(temporary, content);
    keepModeOf(target, temporary);
    moveInto(temporary, writing);
  } finally {
    fs.rmSync(temporary, { force: true });
  }
}

/** A file written over keeps its mode, such as the executable bit of a hook script. */
function keepModeOf(target: string, temporary: string): void {
  const earlier = fs.statSync(target, { throwIfNoEntry: false });

  if (earlier?.isFile() === true) {
    fs.chmodSync(temporary, earlier.mode & 0o7777);
  }
}

/**
 * The rename into place. A file that is a mount point (a config a container binds) cannot be
 * replaced, the rename answering EBUSY: it is written in place, as before the temporary files.
 */
function moveInto(temporary: string, { target, content, disk }: Writing): void {
  try {
    disk.renameSync(temporary, target);
  } catch (error) {
    if (errorCodeOf(error) !== 'EBUSY') {
      throw error;
    }

    disk.writeFileSync(target, content);
  }
}
