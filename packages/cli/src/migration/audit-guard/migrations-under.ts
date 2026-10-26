import fs from 'node:fs';
import path from 'node:path';

/** The migrations under a folder of the project, by their path from the root (POSIX separators), with their content. */
export function migrationsUnder(root: string, folder: string, migration: RegExp): Map<string, string> {
  const directory = path.join(root, folder);

  if (!fs.existsSync(directory)) {
    return new Map();
  }

  const files = fs
    .readdirSync(directory, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && migration.test(entry.name))
    .map((entry) => path.join(entry.parentPath, entry.name));

  return new Map(
    files.sort().map((file) => [path.relative(root, file).split(path.sep).join('/'), fs.readFileSync(file, 'utf8')]),
  );
}
