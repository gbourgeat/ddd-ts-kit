import path from 'node:path';
import type { AliasRoot } from './alias-root.js';
import type { BuildLayout } from './build-layout.js';
import { DEFAULT_BUILD_LAYOUT } from './default-build-layout.js';
import { SOURCE_CONDITION } from './source-condition.js';

export type ImportTargets = string | Readonly<Record<string, string>>;

/**
 * The `imports` of package.json for these roots: the one declaration every tool resolves an alias
 * from. A built tree answers its source under the source condition and its compiled file
 * otherwise; a tree that is never built answers its source.
 */
export function importMap(
  roots: readonly AliasRoot[],
  layout: BuildLayout = DEFAULT_BUILD_LAYOUT,
): Record<string, ImportTargets> {
  return Object.fromEntries(roots.map((root) => [`${root.prefix}*.js`, targetsOf(root, layout)]));
}

function targetsOf({ directory, compiled }: AliasRoot, { rootDir, outDir }: BuildLayout): ImportTargets {
  const source = `./${directory}/*.ts`;

  if (!compiled) {
    return source;
  }

  const emitted = path.posix.join(outDir, path.posix.relative(rootDir, directory));

  return { [SOURCE_CONDITION]: source, default: `./${emitted}/*.js` };
}
