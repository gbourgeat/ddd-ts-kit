import fs from 'node:fs';
import path from 'node:path';

/**
 * The files of a drizzle-kit migrations folder and of its `meta/`, by their path relative to the
 * project root (POSIX separators), with their content: read before and after drizzle-kit runs, they
 * tell what it wrote.
 */
export function migrationFiles(root: string, folder: string): Map<string, string> {
  const files = new Map<string, string>();

  for (const directory of [folder, `${folder}/meta`]) {
    for (const name of filesIn(path.join(root, directory))) {
      files.set(`${directory}/${name}`, fs.readFileSync(path.join(root, directory, name), 'utf8'));
    }
  }

  return files;
}

function filesIn(directory: string): string[] {
  try {
    return fs
      .readdirSync(directory, { withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .sort();
  } catch {
    return [];
  }
}
