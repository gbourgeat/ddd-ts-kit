import fs from 'node:fs';
import path from 'node:path';

const SKIPPED_DIRECTORIES = new Set(['node_modules', 'dist', '.git']);

/** Visits every entry below `directory`, sorted by name, directories before what they hold. */
export function walkDirectory(root: string, directory: string, visit: (file: string, isDirectory: boolean) => void): void {
  for (const entry of entriesOf(root, directory)) {
    const relative = `${directory}/${entry.name}`;

    if (!entry.isDirectory()) {
      visit(relative, false);
    } else if (!SKIPPED_DIRECTORIES.has(entry.name)) {
      visit(relative, true);
      walkDirectory(root, relative, visit);
    }
  }
}

function entriesOf(root: string, directory: string): fs.Dirent[] {
  try {
    return fs.readdirSync(path.join(root, directory), { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}
