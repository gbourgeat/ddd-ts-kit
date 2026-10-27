import fs from 'node:fs';
import path from 'node:path';

/** A folder a removed file leaves empty goes with it, and so does its parent once empty: a moved use case leaves no folder behind. */
export function pruneEmptied(root: string, directory: string): void {
  const absolute = path.join(root, directory);

  if (directory === '.' || directory === '' || !fs.existsSync(absolute) || fs.readdirSync(absolute).length > 0) {
    return;
  }

  fs.rmdirSync(absolute);
  pruneEmptied(root, path.posix.dirname(directory));
}
