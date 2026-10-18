import fs from 'node:fs';
import path from 'node:path';
import type { Config } from '../config/index.js';
import { inDialect } from '../package-manager/in-dialect.js';
import type { DependencyInstall } from './install-dependencies.js';
import { WORKTREES_DIR } from './worktree-home.js';

/**
 * What to say of the dependencies of a worktree: installed, or the command to install them. A
 * worktree of `.worktrees/` without its own `node_modules` is the worst case: Node resolves the
 * packages of the main checkout above it, and its tests pass against the trunk's versions.
 */
export function installNotes(inside: string, config: Config, install: DependencyInstall | undefined): string[] {
  if (install?.ok === true) {
    return [`dependencies installed in the worktree with \`${install.command}\` (${install.seconds} s).`];
  }

  if (install === undefined && fs.existsSync(path.join(inside, 'node_modules'))) {
    return [];
  }

  const failed = install === undefined ? '' : `\`${install.command}\` failed (${install.seconds} s). `;

  const borrowed = inside.split(path.sep).includes(WORKTREES_DIR)
    ? ' Until then Node resolves the packages of the main checkout above it, the versions of the trunk, and the guard refuses the code of its contexts.'
    : '';

  return [
    `${failed}Install the dependencies before any work: \`cd ${inside} && ${inDialect('npm ci', config.stack.packageManager)}\`.${borrowed}`,
  ];
}
