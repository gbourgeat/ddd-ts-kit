import type { Config } from '../config';
import { one } from '../stack/one';
import type { RenderContext } from '../templating';
import { LOCKFILES } from './lockfiles';

/** The package manager as template variables: which one, whether package.json pins it, and the lockfile it writes. */
export function packageManagerVars(config: Config): RenderContext {
  const { packageManager } = config.stack;

  return {
    ...one(packageManager, ['npm', 'pnpm']),
    name: packageManager,
    pinned: packageManager !== 'npm',
    lockfile: LOCKFILES[packageManager],
  };
}
