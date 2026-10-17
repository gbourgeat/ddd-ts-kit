import fs from 'node:fs';
import path from 'node:path';
import { CliError } from '../../cli-error.js';
import { runGit } from '../../commit/run-git.js';
import { CONFIG_FILE, readConfig } from '../../config/index.js';
import type { MergeRepository } from './merge-repository.js';

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

  const configured = fs.existsSync(path.join(root, CONFIG_FILE));

  return {
    top,
    prefix: runGit(root, ['rev-parse', '--show-prefix'])?.trim() ?? '',
    contextsDir: configured ? readConfig(root).config.contextsDir : DEFAULT_CONTEXTS_DIR,
  };
}
