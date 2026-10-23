import fs from 'node:fs';
import path from 'node:path';
import { CliError } from '../../cli-error';
import { runGit } from '../../commit/run-git';
import { CONFIG_FILE, readConfig } from '../../config';
import { modulesByContext } from '../../model-modules';
import type { MergeRepository } from './merge-repository';

/** Where the contexts live when the directory holds no config: a repository checked without a project. */
const DEFAULT_CONTEXTS_DIR = 'src/contexts';

/** The repository of the project at `root`, which may hold no config: the check needs git only. */
export function mergeRepositoryOf(root: string): MergeRepository {
  const top = runGit(root, ['rev-parse', '--show-toplevel'])?.trim();

  if (top === undefined || top === '') {
    throw new CliError(
      `${root} is not inside a git repository.`,
      'Run it from the worktree of the branch, or pass --cwd <worktree>.',
    );
  }

  const config = fs.existsSync(path.join(root, CONFIG_FILE)) ? readConfig(root).config : undefined;

  return {
    top,
    prefix: runGit(root, ['rev-parse', '--show-prefix'])?.trim() ?? '',
    contextsDir: config?.contextsDir ?? DEFAULT_CONTEXTS_DIR,
    modules: config === undefined ? {} : modulesByContext(config),
  };
}
