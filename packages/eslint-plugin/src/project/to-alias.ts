import type { AliasRoot } from './alias-root.js';

const EXTENSION = /\.(?:ts|js)$/;

/**
 * The specifier that names a file of the project, given by its path from the project root with
 * or without its extension, ending with `suffix` (`.js`, or nothing); nothing when the file is
 * under no aliased tree.
 */
export function toAlias(roots: readonly AliasRoot[], file: string, suffix: string): string | undefined {
  const root = roots.find(({ directory }) => file.startsWith(`${directory}/`));

  if (root === undefined) {
    return undefined;
  }

  return `${root.prefix}${file.slice(root.directory.length + 1).replace(EXTENSION, '')}${suffix}`;
}
