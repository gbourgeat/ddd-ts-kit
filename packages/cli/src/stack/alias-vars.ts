import { aliasRoots, directoryAlias, FIXED_ALIAS_ROOTS, moduleNameMapper } from '../alias/index.js';
import type { Config } from '../config/index.js';
import type { RenderContext } from '../templating/index.js';

/**
 * The alias of each tree and of each directory of the config, without a final slash: a template
 * writes the rest of the path after it. `jestMapper` is the lines of the mapping jest is given.
 */
export function aliasVars(config: Config): RenderContext {
  const roots = aliasRoots(config);
  const { test, scripts, generated } = FIXED_ALIAS_ROOTS;

  return {
    source: directoryAlias(roots, config.sourceRoot),
    platform: directoryAlias(roots, config.platformDir),
    contexts: directoryAlias(roots, config.contextsDir),
    sharedKernel: directoryAlias(roots, config.sharedKernelDir),
    test: test.prefix.slice(0, -1),
    scripts: scripts.prefix.slice(0, -1),
    generated: generated.prefix.slice(0, -1),
    jestMapper: jestMapperLines(config),
  };
}

function jestMapperLines(config: Config): string {
  return Object.entries(moduleNameMapper(aliasRoots(config)))
    .map(([pattern, target]) => `'${pattern.replaceAll('\\', '\\\\')}': '${target}',`)
    .join('\n    ');
}
