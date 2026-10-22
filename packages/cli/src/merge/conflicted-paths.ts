import fs from 'node:fs';
import path from 'node:path';
import type { ConflictedPath } from './conflicted-path';
import { objectBytes } from './object-bytes';
import type { StageEntry } from './preview-merge';

/** Where the text a merge wrote for a conflicted path is read: the tree `merge-tree` wrote, or the working tree. */
export type MergedFrom = { readonly tree: string } | 'worktree';

type Sides = Readonly<Record<'base' | 'ours' | 'theirs' | 'merged', Buffer | undefined>>;

const STAGES = { base: 1, ours: 2, theirs: 3 } as const;

/** The conflicted paths with the text of each side and what the merge wrote, read in one pass. */
export function conflictedPaths(
  top: string,
  conflicts: ReadonlyMap<string, readonly StageEntry[]>,
  from: MergedFrom,
): ConflictedPath[] {
  const files = [...conflicts.keys()];

  const bytes = objectBytes(
    top,
    [...conflicts.values()].flat().map((entry) => entry.object),
  );

  const trees =
    from === 'worktree'
      ? new Map<string, Buffer>()
      : objectBytes(
          top,
          files.map((file) => `${from.tree}:${file}`),
        );

  return files.map((file) => {
    const side = (key: keyof typeof STAGES): Buffer | undefined => {
      const entry = conflicts.get(file)?.find((candidate) => candidate.stage === STAGES[key]);

      return entry === undefined || entry.mode === '160000' ? undefined : bytes.get(entry.object);
    };

    const merged = from === 'worktree' ? readIfFile(path.join(top, file)) : trees.get(`${from.tree}:${file}`);

    return pathOf(file, { base: side('base'), ours: side('ours'), theirs: side('theirs'), merged });
  });
}

function pathOf(file: string, sides: Sides): ConflictedPath {
  const text = (key: keyof Sides): Partial<Record<keyof Sides, string>> => {
    const content = sides[key];

    return content === undefined ? {} : { [key]: content.toString('utf8') };
  };

  return {
    file,
    binary: Object.values(sides).some((content) => content?.includes(0) === true),
    ...text('base'),
    ...text('ours'),
    ...text('theirs'),
    ...text('merged'),
  };
}

function readIfFile(file: string): Buffer | undefined {
  try {
    return fs.readFileSync(file);
  } catch {
    return undefined;
  }
}
