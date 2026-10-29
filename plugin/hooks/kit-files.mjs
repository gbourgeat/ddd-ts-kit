// The files the guard keeps in a project (its state, the run and the report of a worker), under the
// folder .ddd-ts-kit that a repository could commit as a link, or with a link under the name of one
// of them (`.ddd-ts-kit/report.md -> ~/.bashrc`). A write goes through no link: no folder from
// .ddd-ts-kit down may be one, and the file is opened without following one. A write that cannot be
// made is skipped: the guard fails open.
import { closeSync, constants, lstatSync, mkdirSync, openSync, writeSync } from 'node:fs';
import { dirname, sep } from 'node:path';

const KIT_FOLDER = '.ddd-ts-kit';
const WRITE_NO_LINK = constants.O_WRONLY | constants.O_CREAT | constants.O_TRUNC | constants.O_NOFOLLOW;

/** Writes `text` to `file`, readable by this user only, unless a link stands on the way. */
export function writeKitFile(file, text) {
  if (linkedFolder(file)) {
    return;
  }
  let descriptor;
  try {
    mkdirSync(dirname(file), { recursive: true });
    descriptor = openSync(file, WRITE_NO_LINK, 0o600);
    writeSync(descriptor, text);
  } catch {
    // A link under the name of the file, a folder in its place: not written.
  } finally {
    if (descriptor !== undefined) {
      closeSync(descriptor);
    }
  }
}

/** Whether a folder of the path of `file`, from the last .ddd-ts-kit down, is a link. */
export function linkedFolder(file) {
  const parts = file.split(sep);
  for (let end = parts.lastIndexOf(KIT_FOLDER) + 1; end < parts.length; end += 1) {
    if (lstatSync(parts.slice(0, end).join(sep), { throwIfNoEntry: false })?.isSymbolicLink()) {
      return true;
    }
  }
  return false;
}
