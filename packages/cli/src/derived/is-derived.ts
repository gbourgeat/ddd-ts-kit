import type { Config } from '../config/index.js';

/**
 * What `npm run regenerate` rewrites: the dependency rules, the context map, the barrels and lists
 * of each context, the contracts and their clients. Such a file is never merged by hand: it is
 * written again from the sources. `path` is relative to the project root, with POSIX separators.
 */
export function isDerived(path: string, { contextsDir }: Pick<Config, 'contextsDir'>): boolean {
  const [context, file, ...deeper] = path.startsWith(`${contextsDir}/`)
    ? path.slice(contextsDir.length + 1).split('/')
    : [];

  const ofAContext =
    context !== undefined &&
    deeper.length === 0 &&
    (file === 'CONTEXT.md' || file === `${context}.declarations.ts` || file === `${context}.dependencies.ts`);

  return (
    ofAContext ||
    path === '.dependency-cruiser.cjs' ||
    path === 'docs/context-map.md' ||
    /^(?:openapi|docs\/integration|clients)\//.test(path)
  );
}
