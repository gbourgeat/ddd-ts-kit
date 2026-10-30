import fs from 'node:fs';
import { CliError } from '../cli-error';
import { runGit } from '../commit/run-git';
import { CONFIG_FILE, type Config, readConfig } from '../config';
import { describeOnDisk } from '../docs/describe-on-disk';
import { readContexts } from '../docs/read-contexts';
import { Workspace } from '../workspace';
import { grantSources } from './grant-sources';
import type { ProjectTree } from './project-tree';

/**
 * The project as `commit` holds it, written into `directory` (under the temporary directory of
 * the system, never a checkout of the working tree) through an index of its own, and every context
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

  const config = configIn(directory);

  if (typeof config === 'string') {
    return { ws, config: undefined, contexts: [], problem: config };
  }

  const grants = grantSources(ws, config);

  try {
    return { ws, config, grants, contexts: describeOnDisk(ws, config, readContexts(ws, config)) };
  } catch (error) {
    if (!(error instanceof CliError)) {
      throw error;
    }

    return { ws, config, grants, contexts: [], problem: error.message.replace(/\.$/, '') };
  }
}

/**
 * Writes the files of the project at `commit` into `directory`; false when the commit holds none
 * there. Read into an index of its own and checked out from it, where `git archive` would leave out
 * what `export-ignore` of `.gitattributes` names (the specs, the documents of a package).
 */
function extracted(root: string, commit: string, directory: string): boolean {
  const index = `${directory}.index`;
  const environment = { GIT_INDEX_FILE: index };
  const prefix = runGit(root, ['rev-parse', '--show-prefix'])?.trim() ?? '';
  const top = runGit(root, ['rev-parse', '--show-toplevel'])?.trim() ?? root;

  fs.mkdirSync(directory, { recursive: true });

  try {
    // `<commit>:<prefix>` is the tree of the project, which may stand below the top of the repository.
    if (runGit(root, ['read-tree', '--end-of-options', `${commit}:${prefix}`], environment) === undefined) {
      return false;
    }

    if (runGit(top, ['checkout-index', '--all', `--prefix=${directory}/`], environment) === undefined) {
      throw new CliError(
        `The tree of ${commit.slice(0, 7)} could not be written under ${directory}.`,
        'Check the room left in the temporary directory of the system, then run digest again.',
      );
    }

    return true;
  } finally {
    fs.rmSync(index, { force: true });
  }
}

/** The config of the tree, or why it could not be read. */
function configIn(directory: string): Config | string {
  try {
    return readConfig(directory).config;
  } catch (error) {
    if (!(error instanceof CliError)) {
      throw error;
    }

    return error.message.replace(/\.$/, '');
  }
}
