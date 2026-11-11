import { posix } from 'node:path';
import type { AliasRoot } from '../alias';
import type { Workspace } from '../workspace';

const SPECIFIER = /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)(['"])([^'"\n]+)\1/g;
const EXTENSION = /\.(?:ts|js)$/;

/** Where a file of the context sits and how its imports are read. */
export interface Importing {
  readonly directory: string;
  readonly file: string;
  readonly roots: readonly AliasRoot[];
}

/** The files of the context a file imports, relative to the context and with their extension, by alias or relative path. */
export function importsOf(ws: Workspace, { directory, file, roots }: Importing): string[] {
  const text = ws.read(`${directory}/${file}`) ?? '';

  return [...text.matchAll(SPECIFIER)].flatMap(([, , specifier = '']) => {
    const bare = specifier.replace(EXTENSION, '');
    const root = roots.find(({ prefix }) => bare.startsWith(prefix));

    const target = bare.startsWith('.')
      ? posix.join(posix.dirname(`${directory}/${file}`), bare)
      : root === undefined
        ? undefined
        : `${root.directory}/${bare.slice(root.prefix.length)}`;

    return target !== undefined && target.startsWith(`${directory}/`)
      ? [`${target.slice(directory.length + 1)}.ts`]
      : [];
  });
}
