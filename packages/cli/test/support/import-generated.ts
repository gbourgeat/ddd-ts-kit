import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

/**
 * Loads a generated TypeScript file, to call what it exports. A file that imports another one
 * of the project through the default alias (`@/platform/...`) is loaded through a copy whose
 * imports name those files, since nothing here reads the `paths` of the project.
 */
export async function importGenerated(root: string, file: string): Promise<unknown> {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  const target = source.includes("from '@/") ? resolvedCopy(root, file, source) : path.join(root, file);
  const loaded: unknown = await import(pathToFileURL(target).href);

  return loaded;
}

function resolvedCopy(root: string, file: string, source: string): string {
  const resolved = source.replaceAll(
    /from '@\/([^']+)'/g,
    (_, imported: string) => `from '${pathToFileURL(path.join(root, 'src', `${imported}.ts`)).href}'`,
  );

  const copy = path.join(root, file.replace(/\.ts$/, '.resolved.ts'));

  fs.writeFileSync(copy, resolved);

  return copy;
}
