import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { CliError } from '../cli-error';
import { runGit } from '../commit/run-git';
import { CONFIG_FILE, type Config, readConfig } from '../config';
import { describeOnDisk } from '../docs/describe-on-disk';
import { readContexts } from '../docs/read-contexts';
import { Workspace } from '../workspace';
import type { ProjectTree } from './project-tree';

/**
 * The project as `commit` holds it, extracted by `git archive` into `directory` (under the
 * temporary directory of the system, never a checkout of the working tree), and every context
 * `describe` reads there. A commit that holds no project at this path, or a config this version
 * cannot read, describes no context, and says why.
 */
export function treeAt(root: string, commit: string, directory: string): ProjectTree {
  const ws = new Workspace(directory, false);

  if (!extracted(root, commit, directory) || !ws.exists(CONFIG_FILE)) {
    return {
      ws,
      config: undefined,
      contexts: [],
      problem: `${commit.slice(0, 7)} holds no ${CONFIG_FILE} at this path`,
    };
  }

  try {
    const { config } = readConfig(directory);

    return { ws, config, contexts: describeOnDisk(ws, config, readContexts(ws, config)) };
  } catch (error) {
    if (!(error instanceof CliError)) {
      throw error;
    }

    return { ws, config: configOf(directory), contexts: [], problem: error.message.replace(/\.$/, '') };
  }
}

/** Writes the tree of the project at `commit` into `directory`; false when the commit holds none there. */
function extracted(root: string, commit: string, directory: string): boolean {
  const archive = `${directory}.tar`;

  fs.mkdirSync(directory, { recursive: true });

  // Run from the project, which may stand below the top of the repository, git archives its directory alone.
  if (runGit(root, ['archive', '--format=tar', `--output=${archive}`, '--end-of-options', commit]) === undefined) {
    return false;
  }

  const tar = spawnSync('tar', ['-xf', archive, '-C', directory], {
    stdio: ['ignore', 'ignore', 'pipe'],
    encoding: 'utf8',
  });

  fs.rmSync(archive, { force: true });

  if (tar.status !== 0) {
    throw new CliError(
      `The tree of ${commit.slice(0, 7)} could not be extracted: ${tar.error?.message ?? tar.stderr.trim()}.`,
      'digest extracts the base with tar: install it, or run `git archive` and `tar -x` by hand to see why.',
    );
  }

  return true;
}

function configOf(directory: string): Config | undefined {
  try {
    return readConfig(directory).config;
  } catch {
    return undefined;
  }
}
