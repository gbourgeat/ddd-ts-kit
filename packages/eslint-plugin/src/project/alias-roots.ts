import type { AliasRoot } from './alias-root.js';
import type { Config } from './config.js';

const TEST: AliasRoot = { prefix: '#test/', directory: 'test' };
const SCRIPTS: AliasRoot = { prefix: '#scripts/', directory: 'scripts' };
const GENERATED: AliasRoot = { prefix: '#generated/', directory: 'generated' };

/**
 * Every tree of a project whose files are imported by an alias: the source root under
 * `importAlias`, the tests, the scripts, and the client Prisma generates next to them. Mirrors
 * `aliasRoots` of the CLI.
 */
export function aliasRoots(config: Config): AliasRoot[] {
  return [
    { prefix: config.importAlias, directory: config.sourceRoot },
    TEST,
    SCRIPTS,
    ...(config.stack.orm === 'prisma' ? [GENERATED] : []),
  ];
}
