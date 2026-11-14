import fs from 'node:fs';
import path from 'node:path';
import { pruneEmptied } from './prune-emptied';

/** Removes a file of the project from the disk and, when asked, the folders it leaves empty. */
export function removeFile(root: string, file: string, pruning: boolean): void {
  fs.rmSync(path.join(root, file), { force: true });

  if (pruning) {
    pruneEmptied(root, path.posix.dirname(file));
  }
}
