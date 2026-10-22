import type { Config } from '../config';
import type { AliasRoot } from './alias-root';
import { FIXED_ALIAS_ROOTS } from './fixed-alias-roots';

type Aliased = Pick<Config, 'importAlias' | 'sourceRoot'> & { readonly stack: Pick<Config['stack'], 'orm'> };

/**
 * Every tree of a project whose files are imported by an alias: the source root under
 * `importAlias`, the tests, the scripts, and the client Prisma generates next to them.
 */
export function aliasRoots(config: Aliased): AliasRoot[] {
  const { test, scripts, generated } = FIXED_ALIAS_ROOTS;

  return [
    { prefix: config.importAlias, directory: config.sourceRoot },
    test,
    scripts,
    ...(config.stack.orm === 'prisma' ? [generated] : []),
  ];
}
