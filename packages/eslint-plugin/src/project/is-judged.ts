import type { AliasRoot } from './alias-root.js';
import type { LintedFile } from './linted-file.js';

/** Written by a tool and never linted as project code. */
const BUILD_PRODUCTS = ['generated'];

/** A source under an aliased tree the team writes: the source root, the tests and the scripts. The import rules judge no other file. */
export function isJudged(roots: readonly AliasRoot[], file: LintedFile): boolean {
  return roots.some(({ directory }) => !BUILD_PRODUCTS.includes(directory) && file.path.startsWith(`${directory}/`));
}
