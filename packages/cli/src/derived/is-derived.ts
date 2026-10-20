import type { Config } from '../config/index.js';
import { isDeclarationsFile } from '../declared/index.js';

/**
 * What `npm run regenerate` rewrites: the dependency rules, the context map, the declarations and
 * lists of each context (at its root and in its role folders), the contracts and their clients.
 * Such a file is never merged by hand: it is written again from the sources. `path` is relative
 * to the project root, with POSIX separators.
 */
export function isDerived(path: string, { contextsDir }: Pick<Config, 'contextsDir'>): boolean {
  const [context, ...inside] = path.startsWith(`${contextsDir}/`) ? path.slice(contextsDir.length + 1).split('/') : [];
  const file = inside.join('/');

  const ofAContext =
    context !== undefined &&
    (file === 'CONTEXT.md' || file === `${context}.dependencies.ts` || isDeclarationsFile(context, file));

  return (
    ofAContext ||
    path === '.dependency-cruiser.cjs' ||
    path === 'docs/context-map.md' ||
    /^(?:openapi|docs\/integration|clients)\//.test(path)
  );
}
