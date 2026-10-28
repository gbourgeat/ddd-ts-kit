import fs from 'node:fs';
import path from 'node:path';
import { isTypeOnlyFile } from './is-type-only-file';

/** The files of the given layer directories (posix, from `root`) that declare types only, as posix paths from `root`. */
export function typeOnlyFiles(root: string, directories: readonly string[]): string[] {
  return directories.flatMap((directory) => {
    const absolute = path.join(root, directory);

    if (!fs.existsSync(absolute)) {
      return [];
    }

    return fs
      .readdirSync(absolute, { withFileTypes: true, recursive: true })
      .filter((entry) => entry.isFile() && isSource(entry.name))
      .map((entry) => path.join(entry.parentPath, entry.name))
      .filter(isTypeOnlyFile)
      .map((file) => path.relative(root, file).split(path.sep).join('/'));
  });
}

function isSource(name: string): boolean {
  return /(?<!\.d)\.[cm]?ts$/.test(name) && !/\.(?:spec|test)\.[cm]?ts$/.test(name);
}
