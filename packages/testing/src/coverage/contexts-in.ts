import fs from 'node:fs';

/** The bounded contexts of a project: the directories directly inside its contexts directory, sorted. */
export function contextsIn(directory: string): string[] {
  if (!fs.existsSync(directory)) {
    return [];
  }

  return fs
    .readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}
