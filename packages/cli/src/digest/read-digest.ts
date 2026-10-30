import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runGit } from '../commit/run-git';
import type { Config } from '../config';
import { branchPoints } from './branch-points';
import { changedPaths } from './changed-paths';
import { contextChanges } from './context-changes';
import type { Digest } from './digest';
import { filesToRead } from './files-to-read';
import { newSpecTitles } from './new-spec-titles';
import type { ProjectTree } from './project-tree';
import { treeAt } from './tree-at';

/**
 * The digest of what HEAD changes since it forked from `base`. Both sides are read from git: each
 * commit is extracted under the temporary directory of the system, described there as `describe`
 * reads a project, and removed afterwards; the working tree is never checked out nor read, and a
 * change not committed is said in a note, not digested. The config of the working tree places the
 * files only when HEAD holds none.
 */
export function readDigest(root: string, base: string, current: Config): Digest {
  const points = branchPoints(root, base);
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'ddd-ts-kit-digest-'));

  try {
    const trees = [
      treeAt(root, points.baseCommit, path.join(scratch, 'base')),
      treeAt(root, points.head, path.join(scratch, 'head')),
    ] as const;

    const paths = changedPaths(root, points.baseCommit, points.head);

    return {
      base,
      ...points,
      contexts: contextChanges(...trees),
      specs: newSpecTitles(trees, paths),
      ...filesToRead(trees[1].config ?? current, trees, paths),
      notes: notesOf(root, trees),
    };
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
}

function notesOf(root: string, [before, after]: readonly [ProjectTree, ProjectTree]): string[] {
  const uncommitted = (runGit(root, ['status', '--porcelain', '--untracked-files=normal', '--', '.']) ?? '')
    .split('\n')
    .filter((line) => line !== '').length;

  return [
    ...(before.problem === undefined ? [] : [`The contexts of the base are not described: ${before.problem}.`]),
    ...(after.problem === undefined ? [] : [`The contexts of HEAD are not described: ${after.problem}.`]),
    ...(uncommitted === 0
      ? []
      : [`${uncommitted} file(s) changed and not committed are not in the digest: commit them, then run it again.`]),
  ];
}
