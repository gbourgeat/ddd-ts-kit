import { DERIVED_FILES } from './derived-files';
import type { DerivedTree } from './derived-tree';

/**
 * What `npm run regenerate` rewrites whole, the kinds of `DERIVED_FILES` it regenerates: the
 * dependency rules, the context map, the declarations and lists of each context (at its root and
 * in its role folders), its CONTEXT.md, the contracts and their clients, and, when the platform is
 * known, the OpenAPI documents of the platform. Such a file is never merged by hand: it is written
 * again from the sources. `path` is relative to the project root, with POSIX separators.
 */
export function isDerived(path: string, tree: DerivedTree): boolean {
  return DERIVED_FILES.some((kind) => kind.regenerated && kind.covers(path, tree));
}
