import fs from 'node:fs';
import path from 'node:path';
import { migrationFiles } from './migration-files';

/**
 * The bytes of each file of a drizzle-kit migrations folder and of its `meta/`, by their path
 * relative to the project root (POSIX separators): what a replay that stops puts back, whatever
 * the encoding of a file.
 */
export function snapshotMigrationFolder(root: string, folder: string): Map<string, Buffer> {
  return new Map(
    [...migrationFiles(root, folder).keys()].map((file) => [file, fs.readFileSync(path.join(root, file))]),
  );
}
