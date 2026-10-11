import type { Config } from '../config/index.js';
import { one } from '../stack/one.js';
import type { RenderContext } from '../templating/index.js';
import { LOCKFILES } from './lockfiles.js';

/** The package manager as template variables: which one, whether corepack provides it, and the lockfile it writes. */
export function packageManagerVars(config: Config): RenderContext {
  const { packageManager } = config.stack;

  return {
    ...one(packageManager, ['npm', 'pnpm']),
    name: packageManager,
    corepack: packageManager !== 'npm',
    lockfile: LOCKFILES[packageManager],
  };
}
