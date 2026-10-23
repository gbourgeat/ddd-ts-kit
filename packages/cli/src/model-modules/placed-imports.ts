import type { AliasRoot } from '../alias/index.js';

const SPECIFIER = /(\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)(['"])([^'"\n]+)\2/g;
const SUFFIX = /\.(?:js|ts)$/;

/**
 * The text of a module with every alias import of a file of a context naming where the file is
 * placed: `place` takes a path written without modules of the model to the module that holds it.
 */
export function placedImports(text: string, roots: readonly AliasRoot[], place: (file: string) => string): string {
  return text.replace(SPECIFIER, (whole: string, ...groups: string[]) => {
    const [before = '', quote = '', specifier = ''] = groups;
    const suffix = SUFFIX.exec(specifier)?.[0] ?? '';
    const bare = specifier.slice(0, specifier.length - suffix.length);
    const root = roots.find(({ prefix }) => bare.startsWith(prefix));

    if (root === undefined) {
      return whole;
    }

    const target = `${root.directory}/${bare.slice(root.prefix.length)}`;
    const placed = place(`${target}.ts`).replace(/\.ts$/, '');

    return placed === target
      ? whole
      : `${before}${quote}${root.prefix}${placed.slice(root.directory.length + 1)}${suffix}${quote}`;
  });
}
