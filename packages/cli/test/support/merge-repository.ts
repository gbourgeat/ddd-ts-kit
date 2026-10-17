import fs from 'node:fs';
import path from 'node:path';
import { tempDir, write } from '../helpers.js';
import { git } from './git.js';

/** Files to write, by path; `null` deletes the file. */
export type Files = Readonly<Record<string, string | null>>;

/** What the base holds, then what each side changes from it. */
export interface Histories {
  readonly base: Files;
  readonly ours: Files;
  readonly theirs: Files;
}

/**
 * A throwaway repository without any project config: a base commit on `main`, the branch
 * `build/billing` (ours) and `main` (theirs) each changing it once, `build/billing` checked out.
 */
export function mergeRepository(histories: Histories): string {
  const root = tempDir('merge');

  git(root, 'init', '--quiet', '--initial-branch', 'main');
  commit(root, histories.base, 'chore: base');
  git(root, 'switch', '--quiet', '--create', 'build/billing');
  commit(root, histories.ours, 'feat(billing): ours');
  git(root, 'switch', '--quiet', 'main');
  commit(root, histories.theirs, 'feat(billing): theirs');
  git(root, 'switch', '--quiet', 'build/billing');

  return root;
}

/** Writes the files and commits them all. */
export function commit(root: string, files: Files, message: string): void {
  writeFiles(root, files);
  git(root, 'add', '--all');
  git(root, 'commit', '--quiet', '--allow-empty', '--message', message);
}

/** Starts `git merge main`, which may stop on conflicts, and writes the resolution; nothing is committed. */
export function startMerge(root: string, resolution: Files, ...options: readonly string[]): void {
  try {
    git(root, 'merge', '--no-ff', '--no-commit', ...options, 'main');
  } catch {
    // A conflict leaves the merge in progress: the resolution below settles it.
  }

  writeFiles(root, resolution);
}

/** Merges main with the resolution written over what git produced, and commits the merge with `message`. */
export function mergeWith(root: string, resolution: Files, message = 'Merge main into build/billing'): void {
  startMerge(root, resolution);
  git(root, 'add', '--all');
  git(root, 'commit', '--quiet', '--message', message);
}

function writeFiles(root: string, files: Files): void {
  for (const [file, content] of Object.entries(files)) {
    if (content === null) {
      fs.rmSync(path.join(root, file), { force: true });
    } else {
      write(root, file, content);
    }
  }
}
