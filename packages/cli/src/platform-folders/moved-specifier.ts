import path from 'node:path';
import type { AliasRoot } from '../alias/index.js';

const SUFFIX = /\.(?:js|ts)$/;

/** Where a file and the files it imports are now, by their paths from the project root without extension. */
export interface Relocation {
  readonly roots: readonly AliasRoot[];
  /** The new path of every moved file, by its old path, both without extension. */
  readonly moved: ReadonlyMap<string, string>;
}

/**
 * The specifier written in `file` once the files moved, or nothing when it names the same file
 * as before: an alias names the new path of a moved file, a relative path is recomputed from
 * where the importing file is now. The extension, or its absence, stays as it was written.
 */
export function movedSpecifier(specifier: string, file: string, relocation: Relocation): string | undefined {
  const suffix = SUFFIX.exec(specifier)?.[0] ?? '';
  const bare = specifier.slice(0, specifier.length - suffix.length);

  if (bare.startsWith('.')) {
    const relative = relativeSpecifier(bare, file, relocation.moved);

    return relative === undefined ? undefined : `${relative}${suffix}`;
  }

  const root = relocation.roots.find(({ prefix }) => bare.startsWith(prefix));
  const target = root === undefined ? undefined : `${root.directory}/${bare.slice(root.prefix.length)}`;
  const moved = target === undefined ? undefined : relocation.moved.get(target);

  return root === undefined || moved === undefined
    ? undefined
    : `${root.prefix}${moved.slice(root.directory.length + 1)}${suffix}`;
}

function relativeSpecifier(bare: string, file: string, moved: Relocation['moved']): string | undefined {
  const importing = file.replace(SUFFIX, '');
  const target = path.posix.join(path.posix.dirname(importing), bare);
  const from = moved.get(importing) ?? importing;
  const to = moved.get(target) ?? target;

  if (from === importing && to === target) {
    return undefined;
  }

  const relative = path.posix.relative(path.posix.dirname(from), to);

  return relative.startsWith('.') ? relative : `./${relative}`;
}
