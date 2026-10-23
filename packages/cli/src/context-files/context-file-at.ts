import type { ContextFile } from './context-file';

/**
 * Where a file of a context is, relative to it: at the root, unless only the place an earlier
 * version wrote it holds it. `exists` is given a path relative to the context.
 */
export function contextFileAt(file: ContextFile, context: string, exists: (relative: string) => boolean): string {
  const root = file.root(context);

  return !exists(root) && exists(file.earlier(context)) ? file.earlier(context) : root;
}
