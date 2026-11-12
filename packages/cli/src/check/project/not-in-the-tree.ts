import path from 'node:path';
import type { Config } from '../../config';
import { gitIgnored, type Ignored } from './git-ignored';
import { isUnder } from './is-under';
import { SKIPPED_DIRECTORIES } from './skipped-directories';

/**
 * The tree under the source root is what git sees: an entry git ignores is not read, nor a
 * dot-directory under the contexts directory, which a tool writes and no context declares, nor a
 * directory no walk enters (`SKIPPED_DIRECTORIES`). `ddd-ts-kit check` walks with it, and so does a
 * command that judges, before it writes, what a rule will judge.
 */
export function notInTheTree(root: string, { sourceRoot, contextsDir }: Config): Ignored {
  const ignored = gitIgnored(root, sourceRoot);

  return (file, isDirectory) =>
    ignored(file, isDirectory) ||
    (isDirectory && SKIPPED_DIRECTORIES.has(path.posix.basename(file))) ||
    (isDirectory && file !== contextsDir && isUnder(file, contextsDir) && path.posix.basename(file).startsWith('.'));
}
