import {
  aliasRoots,
  directoryAlias,
  FIXED_ALIAS_ROOTS,
  mapperTargetText,
  moduleNameMapper,
  specifierSuffix,
} from '../alias';
import type { Config } from '../config';
import type { RenderContext } from '../templating';

/**
 * The alias of each tree and of each directory of the config, without a final slash: a template
 * writes the rest of the path after it, then `ext`: what a specifier ends with under
 * "importExtension". `index` completes the alias of a directory: nothing under `none`, `/index.js`
 * under `js`. `jestMapper` is the lines of the mapping jest is given.
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
    ext: specifierSuffix(config.importExtension),
    index: specifierSuffix(config.importExtension) === '' ? '' : '/index.js',
    extensionless: specifierSuffix(config.importExtension) === '',
    jestMapper: jestMapperLines(config),
  };
}

function jestMapperLines(config: Config): string {
  return Object.entries(moduleNameMapper(aliasRoots(config), specifierSuffix(config.importExtension)))
    .map(([pattern, target]) => `'${pattern.replaceAll('\\', '\\\\')}': ${mapperTargetText(target)},`)
    .join('\n    ');
}
