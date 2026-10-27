import fs from 'node:fs';
import path from 'node:path';

const SKIPPED_DIRECTORIES = new Set(['node_modules', 'dist', '.git', '.worktrees']);

/** Where a walk starts, and what it leaves out. */
export interface Walk {
  readonly root: string;
  /** The directory walked, relative to the root: the entries visited are relative to the root too. */
  readonly directory: string;
  /** True for an entry not to visit, nor, for a directory, what it holds. */
  readonly skip?: (file: string, isDirectory: boolean) => boolean;
}

/** Visits every entry below the directory, sorted by name, directories before what they hold. */
export function walkDirectory(walk: Walk, visit: (file: string, isDirectory: boolean) => void): void {
  const { root, directory, skip } = walk;

  for (const entry of entriesOf(root, directory)) {
    const relative = `${directory}/${entry.name}`;
    const isDirectory = entry.isDirectory();

    if (skip?.(relative, isDirectory) === true) {
      continue;
    }

    if (!isDirectory) {
      visit(relative, false);
    } else if (!SKIPPED_DIRECTORIES.has(entry.name)) {
      visit(relative, true);
      walkDirectory({ ...walk, directory: relative }, visit);
    }
  }
}

function entriesOf(root: string, directory: string): fs.Dirent[] {
  try {
    return fs
      .readdirSync(path.join(root, directory), { withFileTypes: true })
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}
