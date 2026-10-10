import path from 'node:path';
import { pathToFileURL } from 'node:url';

/** Loads a generated TypeScript file that imports nothing at run time, to call what it exports. */
export async function importGenerated(root: string, file: string): Promise<unknown> {
  const loaded: unknown = await import(pathToFileURL(path.join(root, file)).href);

  return loaded;
}
